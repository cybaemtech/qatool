// ─── Audit Analysis Service ───────────────────────────────────────────────────
// Pure business logic: score computation, finding extraction, and grading.
// No database calls. Fully testable in isolation.

import type { AuditResult, AuditFinding } from "./audit-types";

// ─── Interface ────────────────────────────────────────────────────────────────

export interface AuditAnalysisService {
  /** Weighted average of all category scores → 0–100 */
  computeOverallScore(scores: CategoryScores): number;

  /** Compute best-practices score from scanner outputs */
  computeBestPracticesScore(result: Partial<AuditResult>): number;

  /** Extract actionable findings from all scanner outputs */
  extractFindings(result: Partial<AuditResult>): AuditFinding[];

  /** Letter grade from numeric score */
  scoreToGrade(score: number): "A" | "B" | "C" | "D" | "F";
}

export interface CategoryScores {
  performance: number;
  accessibility: number;
  seo: number;
  security: number;
  bestPractices: number;
}

// ─── Implementation ───────────────────────────────────────────────────────────

class DefaultAuditAnalysisService implements AuditAnalysisService {
  /**
   * Weighted average.
   * Performance and security have higher weight because they most
   * directly affect real users and business risk.
   */
  computeOverallScore(scores: CategoryScores): number {
    return Math.round(
      scores.performance * 0.25 +
        scores.accessibility * 0.2 +
        scores.seo * 0.2 +
        scores.security * 0.2 +
        scores.bestPractices * 0.15,
    );
  }

  /**
   * Best-practices score is a synthetic metric derived from security,
   * console errors, and broken links — it has no dedicated scanner.
   */
  computeBestPracticesScore(result: Partial<AuditResult>): number {
    const sslOk = result.security?.ssl.valid ? 20 : 0;
    const consoleOk = result.consoleErrors?.totalErrors === 0 ? 30 : 15;
    const linksOk = result.brokenLinks?.brokenLinks.length === 0 ? 30 : 15;
    return Math.round(sslOk + consoleOk + linksOk + 20);
  }

  extractFindings(result: Partial<AuditResult>): AuditFinding[] {
    const findings: AuditFinding[] = [];

    // ── Accessibility violations ─────────────────────────────────────────────
    if (result.accessibility?.violations) {
      for (const v of result.accessibility.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      )) {
        findings.push({
          id: `a11y-${v.id}`,
          category: "accessibility",
          severity: v.impact === "critical" ? "critical" : "high",
          title: v.description,
          description: `${v.help}. Affects ${v.affectedElements} element(s). WCAG: ${v.wcagCriteria.join(", ")}`,
          recommendation: `Review and remediate all ${v.affectedElements} element(s) failing rule "${v.id}". See: ${v.helpUrl ?? "https://www.w3.org/WAI/WCAG21/"}`,
          scanner: "accessibility",
          autoCreateBug: v.impact === "critical",
        });
      }
    }

    // ── SEO issues ───────────────────────────────────────────────────────────
    if (result.seo?.issues) {
      for (const issue of result.seo.issues.filter(
        (i) => i.severity === "critical" || i.severity === "high",
      )) {
        findings.push({
          id: `seo-${issue.id}`,
          category: "seo",
          severity: issue.severity,
          title: issue.description,
          description: issue.description,
          recommendation: issue.recommendation,
          scanner: "seo",
          autoCreateBug: issue.severity === "critical",
        });
      }
    }

    // ── Security vulnerabilities ─────────────────────────────────────────────
    if (result.security?.vulnerabilities) {
      for (const vuln of result.security.vulnerabilities.filter(
        (v) => v.severity === "critical" || v.severity === "high",
      )) {
        findings.push({
          id: `sec-${vuln.id}`,
          category: "security",
          severity: vuln.severity,
          title: vuln.title,
          description: vuln.description + (vuln.cve ? ` (${vuln.cve})` : ""),
          recommendation: vuln.recommendation,
          scanner: "security",
          autoCreateBug: true,
        });
      }
    }

    // ── Console errors ───────────────────────────────────────────────────────
    if (result.consoleErrors?.errors) {
      const errors = result.consoleErrors.errors.filter((e) => e.level === "error");
      if (errors.length > 0) {
        findings.push({
          id: "console-errors",
          category: "reliability",
          severity: result.consoleErrors.uncaughtExceptions > 0 ? "high" : "medium",
          title: `${errors.length} browser console error(s) detected`,
          description: errors
            .map((e) => e.message)
            .slice(0, 3)
            .join("\n"),
          recommendation:
            "Review and fix all JavaScript errors to prevent user-facing failures",
          scanner: "console-errors",
          autoCreateBug: result.consoleErrors.uncaughtExceptions > 0,
        });
      }
    }

    // ── Broken links ─────────────────────────────────────────────────────────
    if (result.brokenLinks?.brokenLinks && result.brokenLinks.brokenLinks.length > 0) {
      findings.push({
        id: "broken-links",
        category: "reliability",
        severity: result.brokenLinks.brokenLinks.some((l) => l.statusCode >= 500)
          ? "high"
          : "medium",
        title: `${result.brokenLinks.brokenLinks.length} broken link(s) detected`,
        description: result.brokenLinks.brokenLinks
          .map((l) => `${l.url} (${l.statusCode})`)
          .slice(0, 5)
          .join("\n"),
        recommendation:
          "Fix or redirect all broken links to prevent SEO penalties and poor user experience",
        scanner: "broken-links",
        autoCreateBug: true,
      });
    }

    // ── Network failures ─────────────────────────────────────────────────────
    if (
      result.networkRequests?.failedRequests &&
      result.networkRequests.failedRequests.length > 0
    ) {
      const serverErrors = result.networkRequests.failedRequests.filter(
        (r) => r.statusCode >= 500,
      );
      if (serverErrors.length > 0) {
        findings.push({
          id: "network-failures",
          category: "reliability",
          severity: "high",
          title: `${serverErrors.length} failed network request(s) returning 5xx errors`,
          description: serverErrors
            .map((r) => `${r.method} ${r.url} → ${r.statusCode}`)
            .slice(0, 3)
            .join("\n"),
          recommendation:
            "Investigate server-side errors on the failing endpoints and add proper error handling",
          scanner: "network",
          autoCreateBug: true,
        });
      }
    }

    return findings;
  }

  scoreToGrade(score: number): "A" | "B" | "C" | "D" | "F" {
    if (score >= 90) return "A";
    if (score >= 75) return "B";
    if (score >= 60) return "C";
    if (score >= 40) return "D";
    return "F";
  }
}

export const auditAnalysisService: AuditAnalysisService = new DefaultAuditAnalysisService();
export { DefaultAuditAnalysisService };
