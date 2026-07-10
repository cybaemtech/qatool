import { useMemo, useRef, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Bot, Sparkles, Send, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AuditRun,
  AuditAiAnalysis,
  Bug,
} from "@workspace/api-client-react";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CopilotConsoleError {
  message: string;
  severity: string;
  explanation?: string;
  cause?: string;
  fix?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface AiCopilotPanelProps {
  audit: AuditRun;
  aiAnalysis: AuditAiAnalysis | undefined;
  bugs: Bug[];
  consoleErrors: CopilotConsoleError[];
}

const QUICK_PROMPTS = [
  "Why is my performance score low?",
  "What should I fix first?",
  "Which issues give the biggest score improvement?",
  "Explain this console error in simple words.",
  "Explain SEO problems.",
  "Explain accessibility issues.",
  "Generate a fix checklist.",
  "Estimate developer effort.",
  "Summarize this audit for a manager.",
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function scoreWord(score: number | null | undefined) {
  if (score == null) return "unavailable";
  if (score >= 90) return "excellent";
  if (score >= 70) return "decent but improvable";
  if (score >= 50) return "weak";
  return "critical";
}

function categorize(bug: Bug): "performance" | "seo" | "accessibility" | "best-practices" | "other" {
  const text = `${bug.title} ${bug.description ?? ""}`.toLowerCase();
  if (/(load|render|bundle|slow|speed|lcp|cls|tti|blocking|cache|perf)/.test(text)) return "performance";
  if (/(seo|meta|sitemap|robots|canonical|title tag|alt text|crawl)/.test(text)) return "seo";
  if (/(a11y|accessib|aria|contrast|screen reader|keyboard|alt attribute)/.test(text)) return "accessibility";
  if (/(security|deprecat|console|best practice|https|mixed content)/.test(text)) return "best-practices";
  return "other";
}

const SEVERITY_WEIGHT: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const EFFORT_HOURS: Record<string, number> = { low: 2, medium: 6, high: 16 };

function effortWordFromSeverity(severity: string) {
  if (severity === "critical" || severity === "high") return "high";
  if (severity === "medium") return "medium";
  return "low";
}

function formatList(items: string[]) {
  return items.map((i) => `• ${i}`).join("\n");
}

// ─── Response generator (rule-based, driven entirely by existing audit data) ──

function generateAnswer(
  question: string,
  ctx: AiCopilotPanelProps
): string {
  const { audit, aiAnalysis, bugs, consoleErrors } = ctx;
  const q = question.toLowerCase();

  const sortedBugs = [...bugs].sort(
    (a, b) => (SEVERITY_WEIGHT[b.severity] ?? 0) - (SEVERITY_WEIGHT[a.severity] ?? 0)
  );

  // 1. Why is my performance score low?
  if (/why.*(performance|perf).*(low|bad|poor)|performance.*score.*(low|why)/.test(q)) {
    const score = audit.performanceScore;
    const perfBugs = bugs.filter((b) => categorize(b) === "performance");
    const rootCauses = (aiAnalysis?.rootCauseAnalysis ?? []).filter((r) =>
      /(load|render|bundle|slow|speed|perf)/i.test(`${r.issue ?? ""} ${r.cause ?? ""}`)
    );
    const lines: string[] = [];
    lines.push(`Your Performance score is ${score != null ? Math.round(score) : "—"}/100 — ${scoreWord(score)}.`);
    if (rootCauses.length) {
      lines.push("", "Root causes identified by the audit:");
      lines.push(formatList(rootCauses.map((r) => `${r.issue}${r.cause ? ` — ${r.cause}` : ""}`)));
    }
    if (perfBugs.length) {
      lines.push("", `${perfBugs.length} performance-related bug(s) found:`);
      lines.push(formatList(perfBugs.slice(0, 5).map((b) => `[${b.severity}] ${b.title}`)));
    }
    if (!rootCauses.length && !perfBugs.length) {
      lines.push("", "No specific performance root causes were logged for this audit yet — the score is likely driven by general page-load weight (render-blocking assets, unoptimized images, or large JS bundles are the most common culprits).");
    }
    return lines.join("\n");
  }

  // 2. What should I fix first?
  if (/what.*(fix|do).*first|fix first|prioritiz/.test(q)) {
    if (sortedBugs.length === 0) {
      return "There are no open bugs logged against this audit, so there's nothing urgent to prioritize — nice work.";
    }
    const top = sortedBugs.slice(0, 3);
    const lines = [`Based on severity, tackle these first:`, ""];
    lines.push(
      formatList(
        top.map((b, i) => `${i + 1}. [${b.severity.toUpperCase()}] ${b.title}${b.description ? ` — ${b.description}` : ""}`)
      )
    );
    if (aiAnalysis?.suggestedFixes?.length) {
      const highPriority = aiAnalysis.suggestedFixes.filter((f) => f.priority === "high" || f.priority === "critical");
      if (highPriority.length) {
        lines.push("", "The AI analysis also flags these as high priority:");
        lines.push(formatList(highPriority.map((f) => `${f.fix} (${f.effort} effort)`)));
      }
    }
    return lines.join("\n");
  }

  // 3. Which issues give the biggest score improvement?
  if (/biggest.*(score|improvement)|score improvement|most impact/.test(q)) {
    const scores: [string, number | null | undefined][] = [
      ["Performance", audit.performanceScore],
      ["Accessibility", audit.accessibilityScore],
      ["SEO", audit.seoScore],
      ["Best Practices", audit.bestPracticesScore],
    ];
    const lowest = [...scores].sort((a, b) => (a[1] ?? 100) - (b[1] ?? 100))[0];
    const lines = [
      `Your lowest category is ${lowest[0]} (${lowest[1] != null ? Math.round(lowest[1]) : "—"}/100) — improving it will move your overall score the most, since the categories are weighted roughly equally.`,
    ];
    const critical = bugs.filter((b) => b.severity === "critical" || b.severity === "high");
    if (critical.length) {
      lines.push("", `Fixing these ${critical.length} critical/high severity bug(s) will have the biggest measurable effect:`);
      lines.push(formatList(critical.slice(0, 5).map((b) => b.title)));
    }
    if (aiAnalysis?.riskAssessment?.factors?.length) {
      lines.push("", "Risk factors contributing most to score loss:");
      lines.push(formatList(aiAnalysis.riskAssessment.factors));
    }
    return lines.join("\n");
  }

  // 4. Explain this console error in simple words.
  if (/console error|explain.*error/.test(q)) {
    if (!consoleErrors.length) {
      return "No console errors were captured in this audit run — the page loaded cleanly from a JavaScript console perspective.";
    }
    const worst = [...consoleErrors].sort((a, b) => (a.severity === "error" ? -1 : 1))[0];
    const lines = [`"${worst.message}"`, ""];
    lines.push(`In plain terms: ${worst.explanation ?? "This indicates something failed while the page was running JavaScript."}`);
    if (worst.cause) lines.push("", `Likely cause: ${worst.cause}`);
    if (worst.fix) lines.push("", `Suggested fix: ${worst.fix}`);
    if (consoleErrors.length > 1) {
      lines.push("", `There are ${consoleErrors.length} console messages total — ask me again to walk through another one, or open the Console tab for the full list.`);
    }
    return lines.join("\n");
  }

  // 5. Explain SEO problems.
  if (/seo/.test(q)) {
    const score = audit.seoScore;
    const seoBugs = bugs.filter((b) => categorize(b) === "seo");
    const lines = [`SEO score: ${score != null ? Math.round(score) : "—"}/100 (${scoreWord(score)}).`];
    if (seoBugs.length) {
      lines.push("", "Specific SEO issues found:");
      lines.push(formatList(seoBugs.map((b) => `[${b.severity}] ${b.title}${b.description ? ` — ${b.description}` : ""}`)));
    } else if (score != null && score < 90) {
      lines.push(
        "",
        "No individual SEO bugs are logged, but a sub-90 score usually comes from missing meta descriptions, missing alt text, unoptimized title tags, or a missing/invalid sitemap or robots.txt."
      );
    } else {
      lines.push("", "No major SEO issues detected in this audit.");
    }
    return lines.join("\n");
  }

  // 6. Explain accessibility issues.
  if (/accessib|a11y/.test(q)) {
    const score = audit.accessibilityScore;
    const a11yBugs = bugs.filter((b) => categorize(b) === "accessibility");
    const lines = [`Accessibility score: ${score != null ? Math.round(score) : "—"}/100 (${scoreWord(score)}).`];
    if (a11yBugs.length) {
      lines.push("", "Specific accessibility issues found:");
      lines.push(formatList(a11yBugs.map((b) => `[${b.severity}] ${b.title}${b.description ? ` — ${b.description}` : ""}`)));
    } else if (score != null && score < 90) {
      lines.push(
        "",
        "No individual accessibility bugs are logged, but scores in this range are typically caused by low color contrast, missing ARIA labels, unlabeled form fields, or non-keyboard-navigable interactive elements."
      );
    } else {
      lines.push("", "No major accessibility issues detected in this audit.");
    }
    return lines.join("\n");
  }

  // 7. Generate a fix checklist.
  if (/checklist/.test(q)) {
    if (!sortedBugs.length && !aiAnalysis?.suggestedFixes?.length) {
      return "There's nothing to check off — no open bugs or suggested fixes are attached to this audit.";
    }
    const lines = ["Fix checklist for this audit:", ""];
    if (sortedBugs.length) {
      lines.push(formatList(sortedBugs.map((b) => `[ ] (${b.severity}) ${b.title}`)));
    }
    if (aiAnalysis?.suggestedFixes?.length) {
      lines.push("", "Additional AI-suggested fixes:");
      lines.push(formatList(aiAnalysis.suggestedFixes.map((f) => `[ ] ${f.fix} — ${f.priority ?? "normal"} priority, ${f.effort ?? "unknown"} effort`)));
    }
    return lines.join("\n");
  }

  // 8. Estimate developer effort.
  if (/effort|how long|estimate/.test(q)) {
    if (aiAnalysis?.suggestedFixes?.length) {
      const totalHours = aiAnalysis.suggestedFixes.reduce((sum, f) => sum + (EFFORT_HOURS[f.effort ?? "medium"] ?? 6), 0);
      const lines = [
        `Estimated effort across ${aiAnalysis.suggestedFixes.length} suggested fix(es): roughly ${totalHours} developer-hours (${(totalHours / 8).toFixed(1)} working days).`,
        "",
        "Breakdown:",
      ];
      lines.push(formatList(aiAnalysis.suggestedFixes.map((f) => `${f.fix} — ${f.effort ?? "medium"} effort (~${EFFORT_HOURS[f.effort ?? "medium"] ?? 6}h)`)));
      return lines.join("\n");
    }
    if (sortedBugs.length) {
      const totalHours = sortedBugs.reduce((sum, b) => sum + (EFFORT_HOURS[effortWordFromSeverity(b.severity)] ?? 6), 0);
      const lines = [
        `Estimated effort across ${sortedBugs.length} bug(s): roughly ${totalHours} developer-hours (${(totalHours / 8).toFixed(1)} working days), based on severity.`,
        "",
      ];
      lines.push(formatList(sortedBugs.map((b) => `${b.title} — ${effortWordFromSeverity(b.severity)} effort (~${EFFORT_HOURS[effortWordFromSeverity(b.severity)]}h)`)));
      return lines.join("\n");
    }
    return "No bugs or suggested fixes are logged for this audit, so there's no remaining effort to estimate.";
  }

  // 9. Summarize this audit for a manager.
  if (/manager|summar/.test(q)) {
    const lines: string[] = [];
    lines.push(
      `Audit #${audit.id} for ${audit.projectName ?? `project #${audit.projectId}`} finished with an overall score of ${audit.overallScore != null ? Math.round(audit.overallScore) : "—"}/100.`
    );
    lines.push(
      `Scores — Performance: ${audit.performanceScore != null ? Math.round(audit.performanceScore) : "—"}, Accessibility: ${audit.accessibilityScore != null ? Math.round(audit.accessibilityScore) : "—"}, SEO: ${audit.seoScore != null ? Math.round(audit.seoScore) : "—"}, Best Practices: ${audit.bestPracticesScore != null ? Math.round(audit.bestPracticesScore) : "—"}.`
    );
    lines.push(`${bugs.length} bug(s) found, ${bugs.filter((b) => b.severity === "critical").length} critical.`);
    if (aiAnalysis?.riskAssessment?.level) {
      lines.push(`Overall risk level: ${aiAnalysis.riskAssessment.level.toUpperCase()}.`);
    }
    if (aiAnalysis?.summary || audit.aiSummary) {
      lines.push("", aiAnalysis?.summary ?? audit.aiSummary ?? "");
    }
    lines.push("", "Recommendation: " + (sortedBugs.length ? `address the ${sortedBugs.filter((b) => b.severity === "critical" || b.severity === "high").length} critical/high-severity issue(s) before the next release.` : "no urgent action required — the site is in good shape."));
    return lines.join("\n");
  }

  // Fallback — generic contextual answer using whatever the question mentions.
  const fallbackLines = [
    "I can answer questions about this specific audit using its scores, bugs, and console findings. Try one of the suggested questions below, or ask about a score, a bug, or a console error by name.",
  ];
  return fallbackLines.join("\n");
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AiCopilotPanel(props: AiCopilotPanelProps) {
  const { audit } = props;
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hi! I'm your AI Copilot for this audit. Ask me why a score is low, what to fix first, or pick a question below.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isThinking]);

  const canAnswer = audit.status === "completed";

  const ask = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || isThinking) return;
    const userMsg: ChatMessage = { id: `${Date.now()}-u`, role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsThinking(true);

    // Simulate a brief thinking delay for a conversational feel; answer is generated
    // synchronously from existing audit data already loaded on this page.
    window.setTimeout(() => {
      const answer = canAnswer
        ? generateAnswer(trimmed, props)
        : "This audit hasn't finished running yet — I'll have scores, bugs, and console data to work with once it completes.";
      setMessages((prev) => [...prev, { id: `${Date.now()}-a`, role: "assistant", content: answer }]);
      setIsThinking(false);
    }, 450);
  };

  return (
    <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-blue-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base text-indigo-900">AI Copilot</CardTitle>
              <Badge className="bg-indigo-600 text-white text-[10px]">
                <Sparkles className="h-2.5 w-2.5 mr-1" /> AI
              </Badge>
            </div>
            <CardDescription className="text-indigo-600/70">
              Ask questions about this audit — answered from its scores, bugs, and findings
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Chat transcript */}
        <div
          ref={scrollRef}
          className="max-h-96 overflow-y-auto space-y-3 rounded-xl bg-white/80 border border-indigo-100 p-3"
        >
          {messages.map((m) => (
            <div key={m.id} className={cn("flex gap-2", m.role === "user" && "flex-row-reverse")}>
              <div
                className={cn(
                  "h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                  m.role === "user" ? "bg-slate-700" : "bg-indigo-600"
                )}
              >
                {m.role === "user" ? <User className="h-3.5 w-3.5 text-white" /> : <Bot className="h-3.5 w-3.5 text-white" />}
              </div>
              <div
                className={cn(
                  "rounded-lg px-3 py-2 text-xs whitespace-pre-line max-w-[85%] leading-relaxed",
                  m.role === "user" ? "bg-slate-700 text-white" : "bg-indigo-50 text-foreground border border-indigo-100"
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {isThinking && (
            <div className="flex gap-2">
              <div className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-indigo-600">
                <Bot className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="rounded-lg px-3 py-2 text-xs bg-indigo-50 border border-indigo-100 flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
              </div>
            </div>
          )}
        </div>

        {/* Quick prompt chips */}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => ask(p)}
              disabled={isThinking}
              className="text-[11px] px-2.5 py-1 rounded-full border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-100 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Input */}
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the AI Copilot about this audit…"
            className="text-xs h-9 bg-white"
            disabled={isThinking}
          />
          <Button type="submit" size="icon" className="h-9 w-9 flex-shrink-0" disabled={isThinking || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
