// ─── Audit Execution Engine ───────────────────────────────────────────────────
// Modular, layered audit engine. Each scanner is independent and replaceable.
// Swap mock scanners for real integrations (Playwright, Lighthouse, axe-core,
// OWASP ZAP, etc.) by injecting a real adapter — zero architecture changes needed.

import { db } from "@workspace/db";
import { auditRunsTable, bugsTable, screenshotsTable, notificationsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import type { AuditContext, AuditResult, AuditFinding, ScannerName } from "./audit-types";
import {
  performanceScanner,
  accessibilityScanner,
  seoScanner,
  securityScanner,
  brokenLinkScanner,
  consoleErrorCollector,
  networkAnalyzer,
  screenshotCapture,
  technologyDetector,
  aiSummaryGenerator,
} from "./scanners/index";

// ─── Legacy adapter interfaces (kept for backward compatibility) ──────────────
// External code that previously injected PlaywrightService / LighthouseService
// can continue to do so — those interfaces still work alongside the new engine.

export interface PlaywrightService {
  runAudit(url: string): Promise<{
    findings: Record<string, unknown>;
    bugs: Array<{ title: string; description: string; severity: "critical" | "high" | "medium" | "low" }>;
    screenshots: Array<{ deviceType: "desktop" | "tablet" | "mobile"; dataUrl: string }>;
  }>;
}

export interface LighthouseService {
  runAudit(url: string): Promise<{
    performance: number;
    accessibility: number;
    seo: number;
    bestPractices: number;
  }>;
}

export interface AiBugAnalyzerService {
  generateSummary(findings: Record<string, unknown>, scores: { performance: number; accessibility: number; seo: number; bestPractices: number }, bugCount: number): string;
}

// ─── Storage Layer ────────────────────────────────────────────────────────────

async function notifyAllUsers(
  type: "audit_completed" | "audit_failed" | "critical_issue" | "audit_started",
  title: string,
  message: string,
  relatedId: number,
  relatedType: string,
) {
  try {
    const users = await db.select({ id: usersTable.id }).from(usersTable);
    for (const user of users) {
      await db.insert(notificationsTable).values({
        userId: user.id,
        type: type as "audit_completed" | "audit_failed" | "critical_issue",
        title,
        message,
        relatedId,
        relatedType,
      });
    }
  } catch (err) {
    logger.error({ err }, "Failed to create notifications");
  }
}

async function persistScannerScreenshots(auditRunId: number, deviceType: string, dataUrl: string) {
  try {
    await db.insert(screenshotsTable).values({
      auditRunId,
      deviceType: deviceType as "desktop" | "tablet" | "mobile",
      dataUrl,
    });
  } catch (err) {
    logger.error({ err, auditRunId, deviceType }, "Failed to save screenshot");
  }
}

async function persistBug(
  projectId: number,
  auditRunId: number,
  finding: AuditFinding,
) {
  await db.insert(bugsTable).values({
    projectId,
    auditRunId,
    title: finding.title,
    description: finding.description,
    severity: finding.severity === "info" ? "low" : finding.severity,
    status: "open",
    priority: finding.severity === "info" ? "low" : finding.severity,
  });
}

// ─── Score computation ────────────────────────────────────────────────────────

function computeOverallScore(
  perf: number,
  acc: number,
  seo: number,
  security: number,
  bestPractices: number,
): number {
  // Weighted average: performance and security have higher weight
  return Math.round(
    (perf * 0.25) + (acc * 0.2) + (seo * 0.2) + (security * 0.2) + (bestPractices * 0.15),
  );
}

function extractFindings(result: Partial<AuditResult>): AuditFinding[] {
  const findings: AuditFinding[] = [];

  // From accessibility violations
  if (result.accessibility?.violations) {
    for (const v of result.accessibility.violations.filter(v => v.impact === "critical" || v.impact === "serious")) {
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

  // From SEO issues
  if (result.seo?.issues) {
    for (const issue of result.seo.issues.filter(i => i.severity === "critical" || i.severity === "high")) {
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

  // From security vulnerabilities
  if (result.security?.vulnerabilities) {
    for (const vuln of result.security.vulnerabilities.filter(v => v.severity === "critical" || v.severity === "high")) {
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

  // From console errors
  if (result.consoleErrors?.errors) {
    const errors = result.consoleErrors.errors.filter(e => e.level === "error");
    if (errors.length > 0) {
      findings.push({
        id: "console-errors",
        category: "reliability",
        severity: result.consoleErrors.uncaughtExceptions > 0 ? "high" : "medium",
        title: `${errors.length} browser console error(s) detected`,
        description: errors.map(e => e.message).slice(0, 3).join("\n"),
        recommendation: "Review and fix all JavaScript errors to prevent user-facing failures",
        scanner: "console-errors",
        autoCreateBug: result.consoleErrors.uncaughtExceptions > 0,
      });
    }
  }

  // From broken links
  if (result.brokenLinks?.brokenLinks && result.brokenLinks.brokenLinks.length > 0) {
    findings.push({
      id: "broken-links",
      category: "reliability",
      severity: result.brokenLinks.brokenLinks.some(l => l.statusCode >= 500) ? "high" : "medium",
      title: `${result.brokenLinks.brokenLinks.length} broken link(s) detected`,
      description: result.brokenLinks.brokenLinks.map(l => `${l.url} (${l.statusCode})`).slice(0, 5).join("\n"),
      recommendation: "Fix or redirect all broken links to prevent SEO penalties and poor user experience",
      scanner: "broken-links",
      autoCreateBug: true,
    });
  }

  // From network failures
  if (result.networkRequests?.failedRequests && result.networkRequests.failedRequests.length > 0) {
    const serverErrors = result.networkRequests.failedRequests.filter(r => r.statusCode >= 500);
    if (serverErrors.length > 0) {
      findings.push({
        id: "network-failures",
        category: "reliability",
        severity: "high",
        title: `${serverErrors.length} failed network request(s) returning 5xx errors`,
        description: serverErrors.map(r => `${r.method} ${r.url} → ${r.statusCode}`).slice(0, 3).join("\n"),
        recommendation: "Investigate server-side errors on the failing endpoints and add proper error handling",
        scanner: "network",
        autoCreateBug: true,
      });
    }
  }

  return findings;
}

// ─── Main Engine ──────────────────────────────────────────────────────────────

export async function runAuditEngine(
  auditRunId: number,
  url: string,
): Promise<void> {
  const startTime = Date.now();

  try {
    // ── Stage: Initializing ─────────────────────────────────────────────────
    await db.update(auditRunsTable)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(auditRunsTable.id, auditRunId));

    const [run] = await db.select({ projectId: auditRunsTable.projectId })
      .from(auditRunsTable)
      .where(eq(auditRunsTable.id, auditRunId))
      .limit(1);

    if (!run) throw new Error(`Audit run ${auditRunId} not found`);

    logger.info({ auditRunId, url }, "Audit engine started");

    const context: AuditContext = {
      url,
      auditRunId,
      projectId: run.projectId,
      environment: "production",
      options: { screenshotDevices: ["desktop", "tablet", "mobile"] },
    };

    const result: Partial<AuditResult> = {};

    // ── Stage: Running Performance Scanner ─────────────────────────────────
    logger.info({ auditRunId }, "Running performance scanner");
    result.performance = await performanceScanner.run(context);

    // ── Stage: Running Accessibility Scanner ────────────────────────────────
    logger.info({ auditRunId }, "Running accessibility scanner");
    result.accessibility = await accessibilityScanner.run(context);

    // ── Stage: Running SEO Scanner ──────────────────────────────────────────
    logger.info({ auditRunId }, "Running SEO scanner");
    result.seo = await seoScanner.run(context);

    // ── Stage: Running Security Scanner ────────────────────────────────────
    logger.info({ auditRunId }, "Running security scanner");
    result.security = await securityScanner.run(context);

    // ── Stage: Running Broken Link Scanner ─────────────────────────────────
    logger.info({ auditRunId }, "Running broken link scanner");
    result.brokenLinks = await brokenLinkScanner.run(context);

    // ── Stage: Collecting Console Logs ──────────────────────────────────────
    logger.info({ auditRunId }, "Collecting console errors");
    result.consoleErrors = await consoleErrorCollector.run(context);

    // ── Stage: Analyzing Network ────────────────────────────────────────────
    logger.info({ auditRunId }, "Analyzing network requests");
    result.networkRequests = await networkAnalyzer.run(context);

    // ── Stage: Capturing Screenshots ────────────────────────────────────────
    logger.info({ auditRunId }, "Capturing screenshots");
    result.screenshots = await screenshotCapture.run(context);

    // ── Stage: Detecting Technologies ───────────────────────────────────────
    logger.info({ auditRunId }, "Detecting technologies");
    result.technologies = await technologyDetector.run(context);

    // ── Compute scores and extract findings ─────────────────────────────────
    const perfScore = result.performance?.scores.performance ?? 70;
    const accScore = result.accessibility?.score ?? 70;
    const seoScore = result.seo?.score ?? 70;
    const secScore = result.security?.score ?? 70;
    const bpScore = Math.round(
      ((result.security?.ssl.valid ? 20 : 0) +
        (result.consoleErrors && result.consoleErrors.totalErrors === 0 ? 30 : 15) +
        (result.brokenLinks && result.brokenLinks.brokenLinks.length === 0 ? 30 : 15) +
        20),
    );

    const overallScore = computeOverallScore(perfScore, accScore, seoScore, secScore, bpScore);
    const findings = extractFindings(result);
    const bugsToCreate = findings.filter(f => f.autoCreateBug);

    // ── Stage: Generating AI Summary ────────────────────────────────────────
    logger.info({ auditRunId }, "Generating AI summary");
    const contextWithScores: AuditContext = {
      ...context,
      options: {
        ...context.options,
        _scores: {
          performanceScore: perfScore,
          accessibilityScore: accScore,
          seoScore: seoScore,
          securityScore: secScore,
          bestPracticesScore: bpScore,
          bugsFound: bugsToCreate.length,
          criticalBugs: bugsToCreate.filter(f => f.severity === "critical").length,
        },
      } as AuditContext["options"],
    };
    result.aiSummary = await aiSummaryGenerator.run(contextWithScores);

    const durationMs = Date.now() - startTime;
    const hasCritical = bugsToCreate.some(f => f.severity === "critical");

    // ── Stage: Persisting to database ───────────────────────────────────────
    logger.info({ auditRunId, bugCount: bugsToCreate.length }, "Persisting audit results");

    // Save bugs
    for (const finding of bugsToCreate) {
      try {
        await persistBug(run.projectId, auditRunId, finding);
      } catch (err) {
        logger.warn({ err, finding: finding.id }, "Failed to persist bug");
      }
    }

    // Save screenshots
    if (result.screenshots?.screenshots) {
      for (const shot of result.screenshots.screenshots) {
        await persistScannerScreenshots(auditRunId, shot.deviceType, shot.dataUrl);
      }
    }

    // Build raw findings JSONB for storage
    const rawFindings: Record<string, unknown> = {
      performance: result.performance,
      accessibility: result.accessibility,
      seo: result.seo,
      security: result.security,
      brokenLinks: result.brokenLinks,
      consoleErrors: result.consoleErrors,
      networkRequests: result.networkRequests,
      technologies: result.technologies,
    };

    const aiSummaryText = result.aiSummary?.executiveSummary ?? `Audit completed with overall score ${overallScore}/100. Found ${bugsToCreate.length} issue(s).`;

    // ── Stage: Creating report ───────────────────────────────────────────────
    await db.update(auditRunsTable).set({
      status: "completed",
      completedAt: new Date(),
      durationMs,
      overallScore,
      bugsFound: bugsToCreate.length,
      performanceScore: perfScore,
      accessibilityScore: accScore,
      seoScore: seoScore,
      bestPracticesScore: bpScore,
      findings: rawFindings as unknown as Record<string, unknown>,
      aiSummary: aiSummaryText,
    }).where(eq(auditRunsTable.id, auditRunId));

    // ── Notifications ────────────────────────────────────────────────────────
    await notifyAllUsers(
      "audit_completed",
      "Audit Completed",
      `Audit #${auditRunId} finished with score ${overallScore}/100. Found ${bugsToCreate.length} issue(s).`,
      auditRunId,
      "audit",
    );

    if (hasCritical) {
      await notifyAllUsers(
        "critical_issue",
        "Critical Issue Found",
        `Audit #${auditRunId} found ${bugsToCreate.filter(f => f.severity === "critical").length} critical severity bug(s) requiring immediate attention.`,
        auditRunId,
        "audit",
      );
    }

    logger.info({ auditRunId, bugsFound: bugsToCreate.length, overallScore, durationMs }, "Audit completed");
  } catch (error) {
    logger.error({ auditRunId, error }, "Audit engine failed");
    await db.update(auditRunsTable).set({
      status: "failed",
      completedAt: new Date(),
      durationMs: Date.now() - startTime,
    }).where(eq(auditRunsTable.id, auditRunId));
    await notifyAllUsers(
      "audit_failed",
      "Audit Failed",
      `Audit #${auditRunId} encountered an error and could not complete.`,
      auditRunId,
      "audit",
    );
  }
}

// ─── Backward-compatible export ───────────────────────────────────────────────
// Routes that call runPlaywrightAudit() continue to work unchanged.

export const runPlaywrightAudit = runAuditEngine;
