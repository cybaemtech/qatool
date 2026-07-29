// ─── Accessibility Scanner ────────────────────────────────────────────────────
// Mock implementation. Replace with axe-core / IBM Equal Access Checker / WAVE.
// Interface: AuditScanner<AccessibilityMetrics>

import type { AuditScanner, AuditContext, AccessibilityMetrics } from "../audit-types";

// ─── Real Integration Adapter Interface ───────────────────────────────────────
// Implement and inject to switch from mock to real axe-core (via Playwright)

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

const WCAG_VIOLATIONS = [
  {
    id: "color-contrast",
    impact: "serious" as const,
    description: "Elements must have sufficient color contrast",
    help: "Ensure text has a contrast ratio of at least 4.5:1",
    helpUrl: "https://dequeuniversity.com/rules/axe/4.7/color-contrast",
    wcagCriteria: ["WCAG 1.4.3"],
    tags: ["cat.color", "wcag2aa", "wcag143"],
  },
  {
    id: "image-alt",
    impact: "critical" as const,
    description: "Images must have alternate text",
    help: "Ensure <img> elements have meaningful alt attributes",
    helpUrl: "https://dequeuniversity.com/rules/axe/4.7/image-alt",
    wcagCriteria: ["WCAG 1.1.1"],
    tags: ["cat.text-alternatives", "wcag2a", "wcag111"],
  },
  {
    id: "label",
    impact: "critical" as const,
    description: "Form elements must have labels",
    help: "Ensure every form element has a label",
    helpUrl: "https://dequeuniversity.com/rules/axe/4.7/label",
    wcagCriteria: ["WCAG 1.3.1", "WCAG 4.1.2"],
    tags: ["cat.forms", "wcag2a", "wcag131", "wcag412"],
  },
  {
    id: "link-name",
    impact: "serious" as const,
    description: "Links must have discernible text",
    help: "Ensure links have discernible text",
    helpUrl: "https://dequeuniversity.com/rules/axe/4.7/link-name",
    wcagCriteria: ["WCAG 4.1.2", "WCAG 2.4.4"],
    tags: ["cat.name-role-value", "wcag2a", "wcag244", "wcag412"],
  },
  {
    id: "button-name",
    impact: "critical" as const,
    description: "Buttons must have discernible text",
    help: "Ensure buttons have discernible text",
    helpUrl: "https://dequeuniversity.com/rules/axe/4.7/button-name",
    wcagCriteria: ["WCAG 4.1.2"],
    tags: ["cat.name-role-value", "wcag2a", "wcag412"],
  },
  {
    id: "heading-order",
    impact: "moderate" as const,
    description: "Heading levels should only increase by one",
    help: "Ensure the order of headings is semantically correct",
    helpUrl: "https://dequeuniversity.com/rules/axe/4.7/heading-order",
    wcagCriteria: ["WCAG 1.3.1"],
    tags: ["cat.semantics", "best-practice"],
  },
  {
    id: "aria-required-attr",
    impact: "critical" as const,
    description: "Required ARIA attributes must be provided",
    help: "Ensure ARIA roles have all required attributes",
    helpUrl: "https://dequeuniversity.com/rules/axe/4.7/aria-required-attr",
    wcagCriteria: ["WCAG 4.1.2"],
    tags: ["cat.aria", "wcag2a", "wcag412"],
  },
  {
    id: "keyboard",
    impact: "critical" as const,
    description: "Page must be navigable with keyboard",
    help: "Ensure all functionality is accessible from a keyboard",
    helpUrl: "https://dequeuniversity.com/rules/axe/4.7/keyboard",
    wcagCriteria: ["WCAG 2.1.1"],
    tags: ["cat.keyboard", "wcag2a", "wcag211"],
  },
];

const mockAxeAdapter: AxeCoreAdapter = {
  async analyze(_url, _options) {
    const rand = Math.random();
    const violationCount = Math.floor(rand * 5);
    const selectedViolations = WCAG_VIOLATIONS
      .sort(() => Math.random() - 0.5)
      .slice(0, violationCount)
      .map(v => ({ ...v, nodes: Array.from({ length: Math.floor(1 + Math.random() * 8) }) }));

    const passCount = WCAG_VIOLATIONS.length - violationCount;

    return {
      violations: selectedViolations,
      passes: Array.from({ length: passCount + Math.floor(rand * 20) }),
      incomplete: Array.from({ length: Math.floor(rand * 3) }),
      inapplicable: Array.from({ length: Math.floor(rand * 10) }),
    };
  },
};

class AccessibilityScanner implements AuditScanner<AccessibilityMetrics> {
  readonly name = "accessibility" as const;
  readonly description = "Scans for WCAG 2.1 AA violations using axe-core ruleset";
  readonly version = "1.0.0";
  readonly adapter = "axe-core";

  private axeAdapter: AxeCoreAdapter;

  constructor(adapter: AxeCoreAdapter = mockAxeAdapter) {
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
        wcagCriteria: (v as typeof v & { wcagCriteria?: string[] }).wcagCriteria ?? [],
        tags: v.tags,
      }));

      // Score based on violations — critical violations penalize more
      const penalty = violations.reduce((acc, v) => {
        const weights = { critical: 15, serious: 8, moderate: 4, minor: 2 };
        return acc + (weights[v.impact] * v.affectedElements);
      }, 0);
      const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));

      let wcagLevel: AccessibilityMetrics["wcagLevel"] = "AA";
      if (violations.some(v => v.impact === "critical")) wcagLevel = "non-compliant";
      else if (score >= 90) wcagLevel = "AA";
      else if (score >= 70) wcagLevel = "A";

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
