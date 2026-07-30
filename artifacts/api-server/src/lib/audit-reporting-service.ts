// ─── Audit Reporting Service ──────────────────────────────────────────────────
// Converts a completed AuditResult into a human-readable report.
// Future: swap generateTextReport for generatePdfReport (pdfkit) with zero
// changes to callers — just implement the interface.

import type { AuditResult } from "./audit-types";

// ─── Interface ────────────────────────────────────────────────────────────────

export interface AuditReportingService {
  /**
   * Generate a plain-text audit report suitable for download or email.
   * Returns the report as a string; caller is responsible for persistence.
   */
  generateTextReport(result: AuditReportInput): string;

  /** Generate a structured JSON summary for API responses */
  generateJsonSummary(result: AuditReportInput): AuditReportSummary;
}

export interface AuditReportInput {
  auditRunId: number;
  projectName: string;
  url: string;
  durationMs: number;
  overallScore: number;
  performanceScore: number;
  accessibilityScore: number;
  seoScore: number;
  bestPracticesScore: number;
  bugsFound: number;
  criticalBugs: number;
  aiSummary: string;
  scannerData?: Partial<AuditResult>;
}

export interface AuditReportSummary {
  auditRunId: number;
  generatedAt: string;
  overallGrade: string;
  scores: Record<string, number>;
  topIssues: string[];
  aiSummary: string;
  reportUrl: string;
}

// ─── Implementation ───────────────────────────────────────────────────────────

class DefaultAuditReportingService implements AuditReportingService {
  generateTextReport(input: AuditReportInput): string {
    const generated = new Date().toISOString();
    const durationSec = (input.durationMs / 1000).toFixed(1);
    const grade = this.toGrade(input.overallScore);

    const hr = "─".repeat(60);

    const lines: string[] = [
      "QA AUTOMATION PORTAL — AUDIT REPORT",
      hr,
      `Project       : ${input.projectName}`,
      `URL           : ${input.url}`,
      `Audit ID      : #${input.auditRunId}`,
      `Generated     : ${generated}`,
      `Duration      : ${durationSec}s`,
      hr,
      "SCORES",
      hr,
      `Overall Score    : ${input.overallScore}/100  (Grade: ${grade})`,
      `Performance      : ${input.performanceScore}/100`,
      `Accessibility    : ${input.accessibilityScore}/100`,
      `SEO              : ${input.seoScore}/100`,
      `Best Practices   : ${input.bestPracticesScore}/100`,
      hr,
      "ISSUES",
      hr,
      `Total Bugs Found : ${input.bugsFound}`,
      `Critical Bugs    : ${input.criticalBugs}`,
      hr,
      "AI SUMMARY",
      hr,
      input.aiSummary,
      hr,
    ];

    // Scanner-specific sections when full data is available
    if (input.scannerData) {
      const { performance, accessibility, security, brokenLinks, technologies } =
        input.scannerData;

      if (performance?.opportunities && performance.opportunities.length > 0) {
        lines.push("PERFORMANCE OPPORTUNITIES", hr);
        for (const opp of performance.opportunities) {
          const savings = opp.potentialSavingsMs
            ? `~${opp.potentialSavingsMs}ms`
            : opp.potentialSavingsBytes
              ? `~${Math.round(opp.potentialSavingsBytes / 1024)}KB`
              : "";
          lines.push(`  • ${opp.title}${savings ? ` (${savings})` : ""}`);
        }
        lines.push(hr);
      }

      if (accessibility?.violations && accessibility.violations.length > 0) {
        lines.push("ACCESSIBILITY VIOLATIONS", hr);
        for (const v of accessibility.violations) {
          lines.push(`  [${v.impact.toUpperCase()}] ${v.description} — ${v.affectedElements} element(s)`);
        }
        lines.push(hr);
      }

      if (security?.vulnerabilities && security.vulnerabilities.length > 0) {
        lines.push("SECURITY VULNERABILITIES", hr);
        for (const vuln of security.vulnerabilities) {
          lines.push(`  [${vuln.severity.toUpperCase()}] ${vuln.title}`);
          if (vuln.cve) lines.push(`    CVE: ${vuln.cve}`);
        }
        lines.push(hr);
      }

      if (brokenLinks?.brokenLinks && brokenLinks.brokenLinks.length > 0) {
        lines.push("BROKEN LINKS", hr);
        for (const link of brokenLinks.brokenLinks) {
          lines.push(`  ${link.statusCode}  ${link.url}`);
        }
        lines.push(hr);
      }

      if (technologies?.libraries && technologies.libraries.length > 0) {
        lines.push("DETECTED TECHNOLOGIES", hr);
        lines.push(
          technologies.libraries
            .map((t) => `  • ${t.name} ${t.version ?? ""}`.trim())
            .join("\n"),
        );
        lines.push(hr);
      }
    }

    lines.push("END OF REPORT");
    return lines.join("\n");
  }

  generateJsonSummary(input: AuditReportInput): AuditReportSummary {
    const topIssues: string[] = [];
    if (input.criticalBugs > 0) topIssues.push(`${input.criticalBugs} critical bug(s) require immediate attention`);
    if (input.performanceScore < 75) topIssues.push("Performance score below threshold — Core Web Vitals need improvement");
    if (input.accessibilityScore < 80) topIssues.push("Accessibility score below WCAG 2.1 AA compliance target");
    if (input.seoScore < 75) topIssues.push("SEO score may impact search engine visibility");

    return {
      auditRunId: input.auditRunId,
      generatedAt: new Date().toISOString(),
      overallGrade: this.toGrade(input.overallScore),
      scores: {
        overall: input.overallScore,
        performance: input.performanceScore,
        accessibility: input.accessibilityScore,
        seo: input.seoScore,
        bestPractices: input.bestPracticesScore,
      },
      topIssues,
      aiSummary: input.aiSummary,
      reportUrl: `/api/reports/download/report-${input.auditRunId}-${Date.now()}.txt`,
    };
  }

  private toGrade(score: number): string {
    if (score >= 90) return "A";
    if (score >= 75) return "B";
    if (score >= 60) return "C";
    if (score >= 40) return "D";
    return "F";
  }
}

export const auditReportingService: AuditReportingService = new DefaultAuditReportingService();
export { DefaultAuditReportingService };
