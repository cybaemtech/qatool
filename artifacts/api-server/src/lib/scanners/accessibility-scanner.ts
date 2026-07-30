// ─── Accessibility Scanner ────────────────────────────────────────────────────
// Real implementation using axe-core via @axe-core/playwright.
// Runs WCAG 2.1 AA ruleset against the live page rendered in Chromium.

import { AxeBuilder } from "@axe-core/playwright";
import type { AuditScanner, AuditContext, AccessibilityMetrics } from "../audit-types";
import { withPage } from "./playwright-browser";

export interface AxeCoreAdapter {
  analyze(url: string, options?: { wcagLevel?: "A" | "AA" | "AAA" }): Promise<{
    violations: Array<{
      id: string;
      impact: "critical" | "serious" | "moderate" | "minor";
      description: string;
      help: string;
      helpUrl: string;
      tags: string[];
      nodes: unknown[];
    }>;
    passes: Array<unknown>;
    incomplete: Array<unknown>;
    inapplicable: Array<unknown>;
  }>;
}

// ─── Real adapter: axe-core via Playwright ────────────────────────────────────

const realAxeAdapter: AxeCoreAdapter = {
  async analyze(url, options = {}) {
    return withPage(async (page) => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
      // Give JS time to render dynamic content
      await page.waitForTimeout(1500);

      const wcagLevel = options.wcagLevel ?? "AA";
      const tags =
        wcagLevel === "AAA"
          ? ["wcag2a", "wcag2aa", "wcag2aaa", "best-practice"]
          : wcagLevel === "AA"
          ? ["wcag2a", "wcag2aa", "best-practice"]
          : ["wcag2a", "best-practice"];

      const results = await new AxeBuilder({ page })
        .withTags(tags)
        .analyze();

      return {
        violations: results.violations.map(v => ({
          id: v.id,
          impact: (v.impact ?? "minor") as "critical" | "serious" | "moderate" | "minor",
          description: v.description,
          help: v.help,
          helpUrl: v.helpUrl,
          tags: v.tags,
          nodes: v.nodes,
        })),
        passes: results.passes,
        incomplete: results.incomplete,
        inapplicable: results.inapplicable,
      };
    }, { timeoutMs: 40000 });
  },
};

class AccessibilityScanner implements AuditScanner<AccessibilityMetrics> {
  readonly name = "accessibility" as const;
  readonly description = "Scans for WCAG 2.1 AA violations using axe-core via Playwright";
  readonly version = "2.0.0";
  readonly adapter = "axe-core-playwright";

  private axeAdapter: AxeCoreAdapter;

  constructor(adapter: AxeCoreAdapter = realAxeAdapter) {
    this.axeAdapter = adapter;
  }

  async run(context: AuditContext): Promise<AccessibilityMetrics> {
    const startedAt = new Date();

    try {
      const result = await this.axeAdapter.analyze(context.url, { wcagLevel: "AA" });

      const violations = result.violations.map(v => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        help: v.help,
        helpUrl: v.helpUrl,
        affectedElements: v.nodes.length,
        wcagCriteria: v.tags
          .filter(t => /wcag\d+/.test(t))
          .map(t => t.toUpperCase().replace("WCAG", "WCAG ")),
        tags: v.tags,
      }));

      // Score: start at 100, deduct per violation weighted by impact × node count
      const weights: Record<string, number> = {
        critical: 15,
        serious: 8,
        moderate: 4,
        minor: 2,
      };
      const penalty = violations.reduce(
        (acc, v) => acc + (weights[v.impact] ?? 2) * Math.min(v.affectedElements, 5),
        0,
      );
      const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));

      let wcagLevel: AccessibilityMetrics["wcagLevel"] = "AA";
      if (violations.some(v => v.impact === "critical")) wcagLevel = "non-compliant";
      else if (score < 70) wcagLevel = "A";
      else if (score >= 90) wcagLevel = "AA";

      const completedAt = new Date();
      return {
        scannerName: "accessibility",
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        success: true,
        score,
        violations,
        passes: result.passes.length,
        incomplete: result.incomplete.length,
        inapplicable: result.inapplicable.length,
        wcagLevel,
      };
    } catch (error) {
      const completedAt = new Date();
      return {
        scannerName: "accessibility",
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        success: false,
        error: error instanceof Error ? error.message : "Accessibility scan failed",
        score: 0,
        violations: [],
        passes: 0,
        incomplete: 0,
        inapplicable: 0,
        wcagLevel: "non-compliant",
      };
    }
  }
}

export default new AccessibilityScanner();
export { AccessibilityScanner };
