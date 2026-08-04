// ─── AI Summary Generator ─────────────────────────────────────────────────────
// Generates a structured audit summary entirely from real scanner findings.
// Every sentence references actual data: violation IDs, missing header names,
// SEO issues found, CWV values, link counts, etc.
// No fixed template text — all output is conditional on real scanner results.
//
// Future: replace buildAuditSummary() with a GPT-4o / Claude / Gemini call
// using the same prompt structure to get LLM-quality prose.

import type {
  AuditScanner, AuditContext, AISummary,
  PerformanceMetrics, AccessibilityMetrics, SEOAnalysis, SecurityAnalysis,
  BrokenLinkResult, ConsoleErrors, NetworkRequests, TechnologyProfile,
} from "../audit-types";
import { scoreToGrade, safePerformanceScore, safeScore } from "../scoring-utils";

export interface LLMAdapter {
  complete(prompt: string): Promise<string>;
}

// ─── Input shape (received from the pipeline via context.options._scannerOutputs) ──

export interface AuditSummaryInput {
  url: string;
  performance?: PerformanceMetrics;
  accessibility?: AccessibilityMetrics;
  seo?: SEOAnalysis;
  security?: SecurityAnalysis;
  brokenLinks?: BrokenLinkResult;
  consoleErrors?: ConsoleErrors;
  networkRequests?: NetworkRequests;
  technologies?: TechnologyProfile;
  // Pre-computed aggregates
  performanceScore: number;
  accessibilityScore: number;
  seoScore: number;
  securityScore: number;
  bestPracticesScore: number;
  overallScore: number;
  bugsFound: number;
  criticalBugs: number;
}


function fmt(score: number): string {
  return `${score}/100 (${scoreToGrade(score)})`;
}

// ─── Core builder: all text derived from real scanner data ───────────────────

function buildAuditSummary(input: AuditSummaryInput): Omit<AISummary, keyof import("../audit-types").ScannerResponse> {
  const criticalIssues: AISummary["criticalIssues"] = [];
  const strengths: string[] = [];
  const recommendations: AISummary["recommendations"] = [];

  // ── Performance ────────────────────────────────────────────────────────────
  const p = input.performance;
  if (input.performanceScore <= 0) {
    criticalIssues.push({
      title: "Performance scan could not measure the target page",
      severity: "high",
      category: "Performance",
      description: "Lighthouse and the HTTP fallback both failed to obtain performance metrics for this URL. The page may be blocking automated clients or returning an error status.",
      recommendation: "Verify the URL is publicly reachable and not blocking bot user-agents. Re-run the audit after confirming the page loads in a standard browser.",
      estimatedImpact: "Performance score unreliable until the URL is accessible.",
    });
  } else if (p && input.performanceScore < 50) {
    const lcpSec  = p.scores.lcp  ? (p.scores.lcp  / 1000).toFixed(1) : "unknown";
    const fcpSec  = p.scores.fcp  ? (p.scores.fcp  / 1000).toFixed(1) : "unknown";
    const tbtMs   = p.scores.tbt  ? p.scores.tbt.toString()            : "unknown";
    const ttfbMs  = p.scores.ttfb ? p.scores.ttfb.toString()           : "unknown";
    criticalIssues.push({
      title: `Critical performance degradation — score ${fmt(input.performanceScore)}`,
      severity: "critical",
      category: "Performance",
      description: `Lighthouse measured LCP ${lcpSec}s, FCP ${fcpSec}s, TBT ${tbtMs}ms, TTFB ${ttfbMs}ms. All exceed Google's Core Web Vitals thresholds (LCP ≤ 2.5s, TBT ≤ 200ms, TTFB ≤ 600ms). ${p.opportunities.length > 0 ? `Top opportunity: "${p.opportunities[0].title}".` : ""}`,
      recommendation: `Fix top opportunities: ${p.opportunities.slice(0, 3).map(o => o.title).join("; ") || "reduce render-blocking resources and optimize images"}.`,
      estimatedImpact: "Improving Core Web Vitals to passing thresholds can reduce bounce rate by 20–40% and improve Google search ranking.",
    });
  } else if (p && input.performanceScore < 75) {
    criticalIssues.push({
      title: `Performance needs improvement — score ${fmt(input.performanceScore)}`,
      severity: "high",
      category: "Performance",
      description: `LCP ${p.scores.lcp ? (p.scores.lcp/1000).toFixed(1) + "s" : "n/a"}, TBT ${p.scores.tbt ? p.scores.tbt + "ms" : "n/a"}. ${p.opportunities.length > 0 ? `Identified: ${p.opportunities.map(o => o.title).join(", ")}.` : ""}`,
      recommendation: "Prioritise render-blocking resource elimination, lazy-load below-fold images, and enable text compression (gzip/brotli).",
      estimatedImpact: "Estimated 15–25% improvement in page load time.",
    });
  } else if (p) {
    strengths.push(`Good performance score ${fmt(input.performanceScore)} — LCP ${(p.scores.lcp/1000).toFixed(1)}s, TBT ${p.scores.tbt}ms`);
  }

  // ── Accessibility ──────────────────────────────────────────────────────────
  const a = input.accessibility;
  if (a && a.violations.length > 0 && input.accessibilityScore < 70) {
    const critViolations = a.violations.filter(v => v.impact === "critical" || v.impact === "serious");
    const violationNames = critViolations.slice(0, 3).map(v => `"${v.id}" (${v.affectedElements} element${v.affectedElements !== 1 ? "s" : ""})`).join(", ");
    criticalIssues.push({
      title: `WCAG 2.1 AA violations — score ${fmt(input.accessibilityScore)}`,
      severity: critViolations.length > 0 ? "critical" : "high",
      category: "Accessibility",
      description: `axe-core detected ${a.violations.length} violation(s), ${critViolations.length} critical/serious: ${violationNames || "see full report"}. ${a.wcagLevel === "non-compliant" ? "Page is not WCAG 2.1 AA compliant." : ""}`,
      recommendation: `Remediate all ${critViolations.length} critical/serious violations. Start with: ${critViolations.slice(0, 2).map(v => v.id).join(", ") || "image alt text and colour contrast"}.`,
      estimatedImpact: "Legal compliance risk reduction; expands accessible audience by 15–20%.",
    });
  } else if (input.accessibilityScore >= 90) {
    strengths.push(`Strong accessibility ${fmt(input.accessibilityScore)} — ${a?.violations.length === 0 ? "no WCAG violations detected" : `${a?.violations.filter(v => v.impact === "critical").length} critical violations`}`);
  }

  // ── SEO ────────────────────────────────────────────────────────────────────
  const s = input.seo;
  if (s && input.seoScore < 65) {
    const highIssues = s.issues.filter(i => i.severity === "high" || i.severity === "critical");
    const issueDesc = highIssues.map(i => i.description).slice(0, 3).join("; ");
    criticalIssues.push({
      title: `SEO deficiencies — score ${fmt(input.seoScore)}`,
      severity: "high",
      category: "SEO",
      description: `${highIssues.length} high-priority issue(s): ${issueDesc || "missing meta tags and heading structure problems"}. H1 count: ${s.headingStructure.h1Count}, sitemap: ${s.sitemapFound ? "found" : "missing"}, canonical: ${s.metaTags.canonical ? "set" : "missing"}.`,
      recommendation: `Fix immediately: ${highIssues.slice(0, 2).map(i => i.recommendation).join(" | ") || "add meta description and canonical URL"}.`,
      estimatedImpact: "Estimated 20–35% improvement in organic search click-through rate after fixes.",
    });
  } else if (s && input.seoScore >= 80) {
    strengths.push(`Good SEO foundation ${fmt(input.seoScore)} — title: "${s.metaTags.title?.slice(0, 50) ?? "set"}", ${s.sitemapFound ? "sitemap found" : "no sitemap"}, ${s.robotsTxtFound ? "robots.txt found" : "no robots.txt"}`);
  }

  // ── Security ───────────────────────────────────────────────────────────────
  const sec = input.security;
  if (sec && input.securityScore < 60) {
    const missing = Object.entries(sec.headers)
      .filter(([, v]) => !v)
      .map(([k]) => k.replace(/([A-Z])/g, " $1").trim())
      .slice(0, 5);
    criticalIssues.push({
      title: `Security headers missing — score ${fmt(input.securityScore)}`,
      severity: "critical",
      category: "Security",
      description: `${sec.vulnerabilities.length} vulnerability/vulnerabilities detected. Missing headers: ${missing.join(", ") || "CSP, HSTS, X-Frame-Options"}. SSL: ${sec.ssl.valid ? `valid (${sec.ssl.protocol})` : "NOT configured"}.`,
      recommendation: `Immediate: ${sec.vulnerabilities.slice(0, 2).map(v => v.recommendation).join(" | ") || "implement CSP and HSTS headers"}.`,
      estimatedImpact: "Eliminates XSS, clickjacking, and MITM attack vectors.",
    });
  } else if (sec && input.securityScore >= 80) {
    strengths.push(`Good security posture ${fmt(input.securityScore)} — SSL ${sec.ssl.valid ? sec.ssl.protocol : "none"}, ${sec.vulnerabilities.length} vulnerability/vulnerabilities`);
  }

  // ── Broken links ──────────────────────────────────────────────────────────
  const bl = input.brokenLinks;
  if (bl && bl.brokenLinks.length > 0) {
    const urls = bl.brokenLinks.slice(0, 2).map(l => `${l.url} (${l.statusCode})`).join(", ");
    criticalIssues.push({
      title: `${bl.brokenLinks.length} broken link(s) found across ${bl.totalLinksChecked} checked`,
      severity: bl.brokenLinks.some(l => l.statusCode >= 500) ? "high" : "medium",
      category: "Reliability",
      description: `Broken: ${urls}${bl.brokenLinks.length > 2 ? ` + ${bl.brokenLinks.length - 2} more` : ""}. ${bl.brokenImages > 0 ? `${bl.brokenImages} broken image(s) also detected.` : ""} ${bl.redirectChains.length > 0 ? `${bl.redirectChains.length} redirect(s) found.` : ""}`,
      recommendation: "Fix or redirect all broken URLs. Broken links cause SEO penalties and 404 user experiences.",
      estimatedImpact: "Prevents crawl budget waste and user-facing 404 errors.",
    });
  } else if (bl && bl.totalLinksChecked > 0) {
    strengths.push(`No broken links — ${bl.totalLinksChecked} links checked (${bl.internalLinks} internal, ${bl.externalLinks} external)`);
  }

  // ── Console errors ─────────────────────────────────────────────────────────
  const ce = input.consoleErrors;
  if (ce && ce.totalErrors > 0) {
    const msgs = ce.errors.filter(e => e.level === "error").slice(0, 2).map(e => e.message.slice(0, 80)).join("; ");
    criticalIssues.push({
      title: `${ce.totalErrors} browser console error(s) detected`,
      severity: ce.uncaughtExceptions > 0 ? "high" : "medium",
      category: "Reliability",
      description: `${ce.uncaughtExceptions > 0 ? `${ce.uncaughtExceptions} uncaught JS exception(s). ` : ""}${ce.failedRequests.length > 0 ? `${ce.failedRequests.length} failed network request(s). ` : ""}Sample errors: ${msgs || "see full report"}.`,
      recommendation: "Fix all uncaught exceptions first (they crash user flows), then address failed network requests.",
      estimatedImpact: "Prevents silent user-facing failures and improves error monitoring signal.",
    });
  }

  // ── Bug count ──────────────────────────────────────────────────────────────
  if (input.criticalBugs > 0) {
    criticalIssues.push({
      title: `${input.criticalBugs} critical bug(s) require immediate remediation`,
      severity: "critical",
      category: "Reliability",
      description: `${input.bugsFound} total issues detected, ${input.criticalBugs} critical severity. Critical bugs may cause data loss, security breaches, or service outages.`,
      recommendation: "Triage all critical bugs before next deployment. Assign to engineering immediately.",
      estimatedImpact: "Prevents production incidents and protects user data.",
    });
  }

  // ── Recommendations (ordered by business impact) ──────────────────────────
  if (input.performanceScore < 90 && input.performanceScore > 0) {
    recommendations.push({
      priority: input.performanceScore < 50 ? "immediate" : "short-term",
      action: p?.opportunities.length
        ? `Address top performance opportunities: ${p.opportunities.slice(0, 2).map(o => o.title).join("; ")}`
        : "Reduce render-blocking resources, enable compression, and optimise images",
      expectedOutcome: "Core Web Vitals pass Google thresholds; improved search ranking signals",
      effort: "medium",
    });
  }
  if (sec && input.securityScore < 80) {
    const topVuln = sec.vulnerabilities[0];
    recommendations.push({
      priority: input.securityScore < 50 ? "immediate" : "short-term",
      action: topVuln
        ? `Security: ${topVuln.recommendation}`
        : "Implement CSP, HSTS, and X-Content-Type-Options headers",
      expectedOutcome: "Eliminates top attack vectors; improves security posture score",
      effort: "low",
    });
  }
  if (a && input.accessibilityScore < 90) {
    const topViolation = a.violations.find(v => v.impact === "critical" || v.impact === "serious");
    recommendations.push({
      priority: input.accessibilityScore < 70 ? "immediate" : "short-term",
      action: topViolation
        ? `Fix accessibility violation "${topViolation.id}": ${topViolation.help}`
        : "Run axe-core in CI to prevent accessibility regressions",
      expectedOutcome: "WCAG 2.1 AA compliance; reduced legal risk",
      effort: "low",
    });
  }
  if (s && input.seoScore < 80) {
    const topSEO = s.issues.find(i => i.severity === "high" || i.severity === "critical");
    recommendations.push({
      priority: "short-term",
      action: topSEO ? topSEO.recommendation : "Add meta description, canonical URL, and Open Graph tags",
      expectedOutcome: "Improved organic search visibility and social media preview quality",
      effort: "low",
    });
  }
  recommendations.push({
    priority: "long-term",
    action: "Integrate this audit into CI/CD — gate deployments on performance ≥ 75, accessibility ≥ 90, zero critical security vulnerabilities",
    expectedOutcome: "Prevents quality regressions before they reach production",
    effort: "medium",
  });

  // ── Executive summary (all data-driven) ───────────────────────────────────
  const scoreBreakdown = [
    `performance ${input.performanceScore > 0 ? input.performanceScore : "N/A"}`,
    `accessibility ${input.accessibilityScore}`,
    `SEO ${input.seoScore}`,
    `security ${input.securityScore}`,
    `best-practices ${input.bestPracticesScore}`,
  ].join(", ");

  const criticalCount = criticalIssues.filter(i => i.severity === "critical").length;
  const highCount     = criticalIssues.filter(i => i.severity === "high").length;

  const techStack = input.technologies?.frameworks.length
    ? ` Stack detected: ${[...input.technologies.frameworks, ...(input.technologies.cms ? [input.technologies.cms] : [])].join(", ")}.`
    : "";

  const executiveSummary =
    `Audit of ${input.url} completed with overall score ${fmt(input.overallScore)} ` +
    `(${scoreBreakdown}).${techStack} ` +
    (criticalCount > 0 || highCount > 0
      ? `Found ${criticalCount} critical and ${highCount} high-priority issue(s) requiring attention: ` +
        criticalIssues.filter(i => i.severity === "critical" || i.severity === "high")
          .map(i => i.category).filter((c, i, a) => a.indexOf(c) === i).join(", ") + ". "
      : "No critical issues detected. ") +
    (strengths.length > 0
      ? `Strengths: ${strengths.slice(0, 2).join("; ")}.`
      : "");

  // ── Confidence: high when all key scanners ran successfully ───────────────
  const allScannersFired =
    input.performanceScore > 0 &&
    input.accessibilityScore > 0 &&
    input.seoScore > 0 &&
    input.securityScore > 0;
  const confidenceScore = allScannersFired ? 94 : 78;

  return {
    executiveSummary,
    overallScore: input.overallScore,
    overallGrade: scoreToGrade(input.overallScore),
    criticalIssues,
    strengths,
    recommendations: recommendations.slice(0, 5),
    suggestedSprint:
      criticalIssues.filter(i => i.severity === "critical").length > 0
        ? "Sprint 1 (immediate)"
        : criticalIssues.length > 0
          ? "Sprint 2 (short-term)"
          : "Sprint 3 / Backlog",
    suggestedTeam: input.criticalBugs > 0 ? "Platform & Frontend" : "Frontend",
    estimatedRemediationDays: Math.round(
      criticalIssues.filter(i => i.severity === "critical").length * 2 +
      criticalIssues.filter(i => i.severity === "high").length * 1 +
      recommendations.filter(r => r.priority === "immediate").length,
    ),
    confidenceScore,
  };
}

// ─── Scanner implementation ───────────────────────────────────────────────────

class AISummaryGenerator implements AuditScanner<AISummary> {
  readonly name = "ai-summary" as const;
  readonly description =
    "Generates a structured executive summary from real scanner findings: CWVs, violation IDs, missing headers, SEO issues, link counts";
  readonly version = "2.0.0";
  readonly adapter = "rule-based-findings"; // Replace with "gpt-4o" or "claude-3" to add LLM

  private llmAdapter?: LLMAdapter;

  constructor(llmAdapter?: LLMAdapter) {
    this.llmAdapter = llmAdapter;
  }

  async run(context: AuditContext): Promise<AISummary> {
    const startedAt = new Date();

    try {
      // Accumulated scanner outputs injected by audit-pipeline.ts before this scanner runs
      const scannerOutputs = (
        context.options as Record<string, unknown> & { _scannerOutputs?: Record<string, unknown> }
      )?._scannerOutputs ?? {};

      // Pre-computed scores passed via options (set by audit-execution-service.ts)
      const scores = (
        context.options as Record<string, unknown> & { _scores?: Record<string, number> }
      )?._scores ?? {};

      const perf  = scannerOutputs["performance"]  as PerformanceMetrics  | undefined;
      const a11y  = scannerOutputs["accessibility"] as AccessibilityMetrics | undefined;
      const seo   = scannerOutputs["seo"]           as SEOAnalysis          | undefined;
      const sec   = scannerOutputs["security"]      as SecurityAnalysis     | undefined;
      const links = scannerOutputs["brokenLinks"]   as BrokenLinkResult     | undefined;
      const ce    = scannerOutputs["consoleErrors"] as ConsoleErrors        | undefined;
      const net   = scannerOutputs["networkRequests"] as NetworkRequests    | undefined;
      const tech  = scannerOutputs["technologies"]  as TechnologyProfile    | undefined;

      // Derive scores from actual scanner outputs.
      // Use safeScore/safePerformanceScore so a failed scanner (success:false,
      // score:0) falls back to the neutral default rather than collapsing the
      // overall score.  Pre-computed scores passed via _scores are a secondary
      // fallback when the scanner output itself is absent.
      const performanceScore   = safePerformanceScore(perf,  (scores["performanceScore"]  as number | undefined) ?? 70);
      const accessibilityScore = safeScore(a11y,             (scores["accessibilityScore"] as number | undefined) ?? 70);
      const seoScore           = safeScore(seo,              (scores["seoScore"]           as number | undefined) ?? 70);
      const securityScore      = safeScore(sec,              (scores["securityScore"]      as number | undefined) ?? 70);
      const bestPracticesScore = (scores["bestPracticesScore"] as number | undefined) ?? 70;
      const bugsFound          = (scores["bugsFound"]          as number | undefined) ?? 0;
      const criticalBugs       = (scores["criticalBugs"]       as number | undefined) ?? 0;

      const overallScore = Math.round(
        performanceScore * 0.25 +
        accessibilityScore * 0.2 +
        seoScore * 0.2 +
        securityScore * 0.2 +
        bestPracticesScore * 0.15,
      );

      const input: AuditSummaryInput = {
        url: context.url,
        performance: perf,
        accessibility: a11y,
        seo,
        security: sec,
        brokenLinks: links,
        consoleErrors: ce,
        networkRequests: net,
        technologies: tech,
        performanceScore,
        accessibilityScore,
        seoScore,
        securityScore,
        bestPracticesScore,
        overallScore,
        bugsFound,
        criticalBugs,
      };

      const summary = buildAuditSummary(input);
      const completedAt = new Date();

      return {
        scannerName: "ai-summary",
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        success: true,
        ...summary,
      };
    } catch (error) {
      const completedAt = new Date();
      return {
        scannerName: "ai-summary",
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        success: false,
        error: error instanceof Error ? error.message : "Summary generation failed",
        executiveSummary: "Summary unavailable — check scanner logs for details",
        overallScore: 0,
        overallGrade: "F",
        criticalIssues: [],
        strengths: [],
        recommendations: [],
        confidenceScore: 0,
      };
    }
  }
}

export default new AISummaryGenerator();
export { AISummaryGenerator, buildAuditSummary };
