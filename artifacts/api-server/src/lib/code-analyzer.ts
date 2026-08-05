/**
 * Code Analyzer — runs ESLint on source files extracted from a ZIP or GitHub repo.
 * Uses ESLint 8's Linter class for in-memory analysis (no config files needed).
 */

import { Linter } from "eslint";
import tsParser from "@typescript-eslint/parser";
import fs from "fs/promises";
import fss from "fs";
import path from "path";
import { createWriteStream } from "fs";
import https from "https";
import http from "http";
import os from "os";
import { pipeline } from "stream/promises";
import unzipper from "unzipper";
import type { CodeIssue } from "@workspace/db";

// ─── ESLint rule explanations ─────────────────────────────────────────────────

const RULE_EXPLANATIONS: Record<string, { explanation: string; fix: string }> = {
  "no-unused-vars": {
    explanation: "A variable is declared but never read or used. Unused variables clutter the code and may indicate incomplete logic or leftover refactoring.",
    fix: "Remove the unused variable, or prefix it with an underscore (e.g., `_unused`) to signal intentional non-use.",
  },
  "no-undef": {
    explanation: "A variable is referenced that has not been declared in the current scope. This causes a ReferenceError at runtime.",
    fix: "Declare the variable with `const`, `let`, or `var`, import it from the correct module, or add it to the environment globals.",
  },
  "no-unreachable": {
    explanation: "Code appears after a `return`, `throw`, `break`, or `continue` statement and can never be executed.",
    fix: "Remove the unreachable code, or restructure the control flow so this code is reachable.",
  },
  "no-console": {
    explanation: "A `console.log` / `console.error` / etc. call was found. Console output should be removed from production code as it can leak sensitive information and degrades performance.",
    fix: "Use a proper logging library (e.g., `pino`, `winston`) or remove the console call before shipping to production.",
  },
  "eqeqeq": {
    explanation: "The loose equality operator `==` was used instead of strict equality `===`. Loose equality performs type coercion which can lead to subtle bugs.",
    fix: "Replace `==` with `===` and `!=` with `!==` for reliable comparisons without type coercion.",
  },
  "no-var": {
    explanation: "`var` was used to declare a variable. `var` is function-scoped and hoisted, which can lead to unexpected behavior. `const` and `let` are block-scoped and safer.",
    fix: "Replace `var` with `const` (if the variable is never reassigned) or `let` (if it is reassigned).",
  },
  "prefer-const": {
    explanation: "A variable declared with `let` is never reassigned after its initial declaration. Using `const` makes the intent clear and prevents accidental reassignment.",
    fix: "Change `let` to `const` for variables that are only assigned once.",
  },
  "no-shadow": {
    explanation: "A variable declaration shadows a variable with the same name in an outer scope. This can cause confusion and hard-to-track bugs.",
    fix: "Rename the inner variable to avoid the naming collision, or restructure the code to eliminate the shadowing.",
  },
  "no-eval": {
    explanation: "`eval()` executes arbitrary code from a string, creating a severe security vulnerability (code injection) and preventing JavaScript engine optimizations.",
    fix: "Refactor the logic to avoid `eval()`. Use `JSON.parse()` for JSON, `Function` constructor carefully, or redesign the feature.",
  },
  "prefer-arrow-callback": {
    explanation: "A traditional `function` expression was used where an arrow function would be shorter and avoid `this`-binding issues.",
    fix: "Replace the function expression with an arrow function: `function(x) { ... }` → `(x) => { ... }`.",
  },
  "prefer-template": {
    explanation: "String concatenation with `+` was used instead of template literals. Template literals are more readable and less error-prone.",
    fix: "Use a template literal: instead of `'Hello ' + name`, write `` `Hello ${name}` ``.",
  },
  "object-shorthand": {
    explanation: "An object property uses the long-hand form `{ key: key }` when the key and variable name are the same. Shorthand notation is cleaner.",
    fix: "Use property shorthand: `{ key: key }` → `{ key }`.",
  },
  "no-duplicate-case": {
    explanation: "Two `case` clauses in a `switch` statement have the same value. The second case will never be reached.",
    fix: "Remove the duplicate `case` label, or verify that each case handles a distinct value.",
  },
  "no-empty": {
    explanation: "An empty block statement `{}` was found (e.g., an empty `if`, `try`, or `catch` block). Empty blocks may indicate incomplete error handling or forgotten logic.",
    fix: "Add the intended logic, or add a comment inside the block if intentionally empty: `catch (e) { /* intentional no-op */ }`.",
  },
  "use-isnan": {
    explanation: "A comparison against `NaN` was made using `==` or `===`. `NaN` is the only value in JavaScript not equal to itself, so these comparisons always return `false`.",
    fix: "Use `Number.isNaN(value)` or `isNaN(value)` to check for NaN.",
  },
  "valid-typeof": {
    explanation: "The result of `typeof` was compared to an invalid string literal (e.g., `typeof x === 'boolean'` but misspelled). This comparison will always return `false`.",
    fix: "Ensure the `typeof` comparison string is one of: `'undefined'`, `'boolean'`, `'number'`, `'string'`, `'bigint'`, `'symbol'`, `'object'`, `'function'`.",
  },
  "no-dupe-args": {
    explanation: "A function has duplicate parameter names. In strict mode this is a syntax error; in sloppy mode only the last duplicate is accessible.",
    fix: "Give each parameter a unique name.",
  },
  "no-dupe-keys": {
    explanation: "An object literal has multiple properties with the same key. The later value silently overwrites the earlier one.",
    fix: "Remove or rename the duplicate property key.",
  },
  "no-loss-of-precision": {
    explanation: "A numeric literal is so large or precise that it loses precision when stored as a JavaScript floating-point number.",
    fix: "Use `BigInt` for large integers, or store the value as a string if exact representation is needed.",
  },
  "no-sparse-arrays": {
    explanation: "An array literal has empty slots (e.g., `[1, , 3]`). Sparse arrays behave inconsistently across array methods and are rarely intentional.",
    fix: "Use `undefined` explicitly: `[1, undefined, 3]`, or remove the trailing comma.",
  },
  "no-param-reassign": {
    explanation: "A function parameter was reassigned inside the function body. This mutates the caller's value for objects and makes the function harder to reason about.",
    fix: "Create a local copy of the parameter instead: `const localCopy = param;` and work with `localCopy`.",
  },
  "consistent-return": {
    explanation: "A function sometimes returns a value explicitly and sometimes returns implicitly (undefined). This inconsistency is a common source of bugs.",
    fix: "Ensure all code paths either always return a value or never return a value.",
  },
  "no-extra-semi": {
    explanation: "An unnecessary semicolon was found. Extra semicolons are harmless but indicate a mistake or copy-paste error.",
    fix: "Remove the extra semicolon.",
  },
  "no-implicit-globals": {
    explanation: "A variable or function was declared without `var`, `let`, or `const` in a browser context, making it a global variable unintentionally.",
    fix: "Add the appropriate declaration keyword (`const` or `let`) to scope the variable properly.",
  },
  "no-multi-assign": {
    explanation: "Multiple variables are assigned in a single statement (e.g., `a = b = c = 0`). This can obscure intent and cause unexpected behavior when one variable is undeclared.",
    fix: "Assign each variable separately on its own line for clarity.",
  },
  "no-nested-ternary": {
    explanation: "A ternary expression is nested inside another ternary, making the code difficult to read and understand.",
    fix: "Refactor using an `if`/`else if`/`else` statement, or extract the inner ternary into a named variable.",
  },
  "no-plusplus": {
    explanation: "The unary `++` or `--` operator was used. These operators can cause subtle bugs when whitespace is inadvertently added.",
    fix: "Use `+= 1` or `-= 1` instead of `++` or `--`.",
  },
  "no-func-assign": {
    explanation: "A function declaration was reassigned after declaration. Reassigning a function declaration can break code that calls the function by name.",
    fix: "Use a `const` or `let` variable with a function expression instead of reassigning a function declaration.",
  },
  "constructor-super": {
    explanation: "A class constructor that extends another class does not call `super()`. This is a runtime error — derived classes must call `super()` before accessing `this`.",
    fix: "Add `super(/* args */)` as the first statement in the constructor body.",
  },
  "no-this-before-super": {
    explanation: "`this` or `super` is used before calling `super()` in a derived class constructor. This is a runtime error.",
    fix: "Move the `super()` call to before any `this` access in the constructor.",
  },
};

function getExplanation(ruleId: string | null): { explanation: string; fix: string } {
  if (!ruleId) {
    return {
      explanation: "A syntax or parse error was detected in this file. The file may contain invalid JavaScript or TypeScript syntax.",
      fix: "Review the file at the indicated line for syntax errors such as mismatched brackets, missing semicolons, or invalid syntax.",
    };
  }
  const known = RULE_EXPLANATIONS[ruleId];
  if (known) return known;
  return {
    explanation: `ESLint rule \`${ruleId}\` was violated. This rule enforces a specific code quality or style requirement.`,
    fix: `Review the ESLint documentation for rule \`${ruleId}\` for the correct resolution: https://eslint.org/docs/rules/${ruleId}`,
  };
}

// ─── ESLint linter setup ─────────────────────────────────────────────────────

function createLinter() {
  const linter = new Linter();
  // Register TypeScript parser for .ts / .tsx files
  linter.defineParser("ts-parser", tsParser as unknown as Linter.ParserModule);
  return linter;
}

const BASE_RULES: Linter.RulesRecord = {
  // Errors
  "no-unused-vars":     ["error", { vars: "all", args: "after-used", ignoreRestSiblings: true }],
  "no-unreachable":     "error",
  "no-duplicate-case":  "error",
  "no-empty":           ["error", { allowEmptyCatch: false }],
  "no-extra-semi":      "error",
  "no-func-assign":     "error",
  "no-sparse-arrays":   "error",
  "use-isnan":          "error",
  "valid-typeof":       "error",
  "no-dupe-args":       "error",
  "no-dupe-keys":       "error",
  "no-loss-of-precision":"error",
  "constructor-super":  "error",
  "no-this-before-super":"error",
  // Warnings
  "no-console":         "warn",
  "eqeqeq":             ["warn", "always", { null: "ignore" }],
  "no-var":             "warn",
  "prefer-const":       "warn",
  "no-eval":            "warn",
  "no-implicit-globals":"warn",
  "no-multi-assign":    "warn",
  "no-nested-ternary":  "warn",
  "prefer-arrow-callback":"warn",
  "prefer-template":    "warn",
  "object-shorthand":   ["warn", "always", { avoidQuotes: true }],
  // Suggestions
  "no-plusplus":        "warn",
  "no-param-reassign":  "warn",
  "consistent-return":  "warn",
};

// Rules that require semantic type information (don't work in Linter without type-checker)
const TS_INCOMPATIBLE_RULES: Set<string> = new Set([
  "no-unused-vars",   // covered by TS itself; causes false positives on imports
  "no-undef",         // TS handles this
  "no-implicit-globals",
]);

function getConfigForFile(filename: string): Linter.Config {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const isTs = ext === "ts" || ext === "tsx";

  const rules = { ...BASE_RULES };
  if (isTs) {
    for (const r of TS_INCOMPATIBLE_RULES) delete rules[r];
  } else {
    rules["no-undef"] = "error";
  }

  return {
    parser: isTs ? "ts-parser" : undefined,
    parserOptions: {
      ecmaVersion: "latest" as Linter.ParserOptions["ecmaVersion"],
      sourceType: "module",
      ecmaFeatures: { jsx: true },
      ...(isTs ? { jsx: true } : {}),
    },
    env: { browser: true, node: true, es2022: true },
    rules,
  };
}

// ─── File collection ──────────────────────────────────────────────────────────

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", ".cache", "out", "vendor"]);
const ANALYZE_EXTS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);

async function collectFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  async function walk(current: string) {
    let entries: import("fs").Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch { return; }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) await walk(path.join(current, entry.name));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ANALYZE_EXTS.has(ext)) results.push(path.join(current, entry.name));
      }
    }
  }
  await walk(dir);
  return results;
}

// ─── Context extraction ───────────────────────────────────────────────────────

function extractContext(lines: string[], errorLine: number, contextSize = 5): { context: string; startLine: number } {
  const startLine = Math.max(1, errorLine - contextSize);
  const endLine = Math.min(lines.length, errorLine + contextSize);
  const context = lines.slice(startLine - 1, endLine).join("\n");
  return { context, startLine };
}

// ─── Score computation ────────────────────────────────────────────────────────

export function computeCodeQualityScore(errors: number, warnings: number, suggestions: number, files: number): number {
  if (files === 0) return 100;
  // Weight by issues-per-file ratio to not penalize large projects excessively
  const errorPenalty   = Math.min(errors   / files, 10) * 5;
  const warnPenalty    = Math.min(warnings  / files, 10) * 2;
  const suggPenalty    = Math.min(suggestions / files, 10) * 0.5;
  const raw = 100 - errorPenalty - warnPenalty - suggPenalty;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

// ─── Core analysis ───────────────────────────────────────────────────────────

export interface AnalysisResult {
  issues: CodeIssue[];
  filesAnalyzed: number;
  errorCount: number;
  warningCount: number;
  suggestionCount: number;
  overallScore: number;
}

const SUGGESTION_RULES = new Set(["no-plusplus", "no-param-reassign", "consistent-return"]);

export async function analyzeDirectory(dir: string): Promise<AnalysisResult> {
  const linter = createLinter();
  const files = await collectFiles(dir);
  const issues: CodeIssue[] = [];

  for (const filePath of files) {
    let source: string;
    try {
      source = await fs.readFile(filePath, "utf-8");
    } catch { continue; }

    const relPath = path.relative(dir, filePath);
    const config = getConfigForFile(filePath);
    const lines = source.split("\n");

    let messages: Linter.LintMessage[];
    try {
      messages = linter.verify(source, config, { filename: filePath });
    } catch {
      continue; // skip files that fail catastrophically
    }

    for (const msg of messages) {
      const ruleId = msg.ruleId ?? null;
      const { explanation, fix } = getExplanation(ruleId);

      let sev: CodeIssue["severity"];
      if (SUGGESTION_RULES.has(ruleId ?? "")) {
        sev = "suggestion";
      } else if (msg.severity === 2) {
        sev = "error";
      } else {
        sev = "warning";
      }

      const { context, startLine } = extractContext(lines, msg.line);
      issues.push({
        file: relPath,
        line: msg.line,
        column: msg.column,
        rule: ruleId,
        severity: sev,
        message: msg.message,
        aiExplanation: explanation,
        aiFixSuggestion: fix,
        codeContext: context,
        contextStartLine: startLine,
      });
    }
  }

  const errorCount      = issues.filter(i => i.severity === "error").length;
  const warningCount    = issues.filter(i => i.severity === "warning").length;
  const suggestionCount = issues.filter(i => i.severity === "suggestion").length;

  return {
    issues,
    filesAnalyzed: files.length,
    errorCount,
    warningCount,
    suggestionCount,
    overallScore: computeCodeQualityScore(errorCount, warningCount, suggestionCount, files.length),
  };
}

// ─── ZIP extraction ───────────────────────────────────────────────────────────

export async function extractZip(zipPath: string, destDir: string): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });
  await new Promise<void>((resolve, reject) => {
    fss.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: destDir }))
      .on("close", resolve)
      .on("error", reject);
  });
}

// ─── GitHub archive download ──────────────────────────────────────────────────

export async function downloadGitHubArchive(repoUrl: string, destZip: string): Promise<string> {
  // Parse: https://github.com/owner/repo  or  github.com/owner/repo
  const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/.\s]+)/i);
  if (!match) throw new Error("Invalid GitHub URL. Expected: https://github.com/owner/repo");
  const [, owner, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, "");

  // Try main then master
  const branches = ["main", "master", "HEAD"];
  for (const branch of branches) {
    const archiveUrl = `https://github.com/${owner}/${cleanRepo}/archive/refs/heads/${branch}.zip`;
    try {
      await downloadFile(archiveUrl, destZip);
      return `${owner}/${cleanRepo}`;
    } catch { continue; }
  }
  throw new Error(`Could not download archive for ${owner}/${cleanRepo}. Check the repository URL and ensure it is public.`);
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https://") ? https : http;
    const file = createWriteStream(dest);
    const req = protocol.get(url, { headers: { "User-Agent": "QA-Portal/1.0" } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fss.unlink(dest, () => {});
        downloadFile(res.headers.location!, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        fss.unlink(dest, () => {});
        reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
        return;
      }
      pipeline(res, file).then(resolve).catch(reject);
    });
    req.on("error", (err) => { file.close(); fss.unlink(dest, () => {}); reject(err); });
    req.setTimeout(30000, () => { req.destroy(); reject(new Error("Download timed out")); });
  });
}

// ─── Temp directory helpers ───────────────────────────────────────────────────

export function makeTempDir(prefix: string): string {
  return fss.mkdtempSync(path.join(os.tmpdir(), prefix));
}
