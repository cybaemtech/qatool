import { db } from "@workspace/db";
import { auditRunsTable, bugsTable, screenshotsTable, notificationsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

interface AuditFindings {
  homepageLoaded: boolean;
  consoleErrors: string[];
  failedRequests: string[];
  brokenLinks: string[];
  formIssues: string[];
  networkErrors: string[];
  navigationChecked: boolean;
  responsiveness: { desktop: boolean; tablet: boolean; mobile: boolean };
}

// ─── Service interfaces for future real integrations ──────────────────────────

export interface PlaywrightService {
  runAudit(url: string): Promise<{
    findings: AuditFindings;
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
  generateSummary(findings: AuditFindings, scores: { performance: number; accessibility: number; seo: number; bestPractices: number }, bugCount: number): string;
}

// ─── Simulated implementations (replace with real engines in production) ──────

const simulatedPlaywright: PlaywrightService = {
  async runAudit(url: string) {
    const findings: AuditFindings = {
      homepageLoaded: true,
      consoleErrors: [],
      failedRequests: [],
      brokenLinks: [],
      formIssues: [],
      networkErrors: [],
      navigationChecked: true,
      responsiveness: { desktop: true, tablet: true, mobile: true },
    };

    const bugs: Array<{ title: string; description: string; severity: "critical" | "high" | "medium" | "low" }> = [];
    const rand = Math.random();

    if (rand > 0.7) {
      findings.consoleErrors.push("Uncaught TypeError: Cannot read properties of null");
      bugs.push({ title: "JavaScript runtime error detected", description: "Console error: Uncaught TypeError: Cannot read properties of null. This may cause functionality failures.", severity: "high" });
    }
    if (rand > 0.5) {
      findings.brokenLinks.push(`${url}/about`);
      bugs.push({ title: "Broken link detected", description: `Link to ${url}/about returns 404 Not Found.`, severity: "medium" });
    }
    if (rand > 0.8) {
      findings.failedRequests.push(`${url}/api/data`);
      bugs.push({ title: "Failed network request", description: `API request to ${url}/api/data returned 500 Internal Server Error.`, severity: "critical" });
    }
    if (rand > 0.3) {
      bugs.push({ title: "Missing form validation", description: "Contact form allows submission without required field validation.", severity: "medium" });
    }
    if (rand < 0.4) {
      bugs.push({ title: "Missing alt text on images", description: "Several images are missing alt attribute, reducing accessibility score.", severity: "low" });
    }

    const placeholderPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    return {
      findings,
      bugs,
      screenshots: [
        { deviceType: "desktop" as const, dataUrl: placeholderPng },
        { deviceType: "tablet" as const, dataUrl: placeholderPng },
        { deviceType: "mobile" as const, dataUrl: placeholderPng },
      ],
    };
  },
};

const simulatedLighthouse: LighthouseService = {
  async runAudit(_url: string) {
    const base = Math.random();
    return {
      performance: Math.round((0.55 + base * 0.4) * 100),
      accessibility: Math.round((0.65 + base * 0.3) * 100),
      seo: Math.round((0.60 + base * 0.35) * 100),
      bestPractices: Math.round((0.70 + base * 0.25) * 100),
    };
  },
};

const simulatedAiAnalyzer: AiBugAnalyzerService = {
  generateSummary(findings, scores, bugCount) {
    const avgScore = Math.round((scores.performance + scores.accessibility + scores.seo + scores.bestPractices) / 4);
    const issues = [];
    if (scores.performance < 70) issues.push("performance optimization");
    if (scores.accessibility < 80) issues.push("accessibility improvements");
    if (scores.seo < 75) issues.push("SEO enhancements");
    if (findings.consoleErrors.length > 0) issues.push("JavaScript errors");
    if (findings.brokenLinks.length > 0) issues.push("broken links");

    return `Audit completed with an overall score of ${avgScore}/100. Found ${bugCount} issue${bugCount !== 1 ? "s" : ""}.${
      issues.length > 0 ? ` Key areas: ${issues.join(", ")}.` : " The site appears to be in good health."
    } ${scores.performance < 70 ? "Performance is the most critical concern." : scores.performance >= 90 ? "Performance is excellent." : "Performance is acceptable but could be improved."}`;
  },
};

// ─── Notification helper ──────────────────────────────────────────────────────

async function notifyAllUsers(type: "audit_completed" | "audit_failed" | "critical_issue", title: string, message: string, relatedId: number, relatedType: string) {
  try {
    const users = await db.select({ id: usersTable.id }).from(usersTable);
    for (const user of users) {
      await db.insert(notificationsTable).values({ userId: user.id, type, title, message, relatedId, relatedType });
    }
  } catch (err) {
    logger.error({ err }, "Failed to create notifications");
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function runPlaywrightAudit(
  auditRunId: number,
  url: string,
  playwright: PlaywrightService = simulatedPlaywright,
  lighthouse: LighthouseService = simulatedLighthouse,
  aiAnalyzer: AiBugAnalyzerService = simulatedAiAnalyzer,
): Promise<void> {
  const startTime = Date.now();

  try {
    await db.update(auditRunsTable)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(auditRunsTable.id, auditRunId));

    logger.info({ auditRunId, url }, "Starting audit");

    // Simulate audit duration (3-8 seconds)
    await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 5000));

    const [auditResult, lighthouseScores] = await Promise.all([
      playwright.runAudit(url),
      lighthouse.runAudit(url),
    ]);

    const durationMs = Date.now() - startTime;
    const overallScore = Math.round(
      (lighthouseScores.performance + lighthouseScores.accessibility + lighthouseScores.seo + lighthouseScores.bestPractices) / 4
    );

    const [run] = await db.select({ projectId: auditRunsTable.projectId })
      .from(auditRunsTable).where(eq(auditRunsTable.id, auditRunId)).limit(1);

    const hasCritical = auditResult.bugs.some(b => b.severity === "critical");

    for (const bug of auditResult.bugs) {
      await db.insert(bugsTable).values({
        ...bug,
        projectId: run.projectId,
        auditRunId,
        status: "open",
        priority: bug.severity,
      });
    }

    for (const screenshot of auditResult.screenshots) {
      await db.insert(screenshotsTable).values({ auditRunId, deviceType: screenshot.deviceType, dataUrl: screenshot.dataUrl });
    }

    const aiSummary = aiAnalyzer.generateSummary(auditResult.findings, lighthouseScores, auditResult.bugs.length);

    await db.update(auditRunsTable).set({
      status: "completed",
      completedAt: new Date(),
      durationMs,
      overallScore,
      bugsFound: auditResult.bugs.length,
      performanceScore: lighthouseScores.performance,
      accessibilityScore: lighthouseScores.accessibility,
      seoScore: lighthouseScores.seo,
      bestPracticesScore: lighthouseScores.bestPractices,
      findings: auditResult.findings as unknown as Record<string, unknown>,
      aiSummary,
    }).where(eq(auditRunsTable.id, auditRunId));

    await notifyAllUsers("audit_completed", "Audit Completed", `Audit #${auditRunId} finished with score ${overallScore}/100. Found ${auditResult.bugs.length} issue(s).`, auditRunId, "audit");

    if (hasCritical) {
      await notifyAllUsers("critical_issue", "Critical Issue Found", `Audit #${auditRunId} found a critical severity bug that requires immediate attention.`, auditRunId, "audit");
    }

    logger.info({ auditRunId, bugsFound: auditResult.bugs.length, overallScore }, "Audit completed");
  } catch (error) {
    logger.error({ auditRunId, error }, "Audit failed");
    await db.update(auditRunsTable).set({
      status: "failed",
      completedAt: new Date(),
      durationMs: Date.now() - startTime,
    }).where(eq(auditRunsTable.id, auditRunId));
    await notifyAllUsers("audit_failed", "Audit Failed", `Audit #${auditRunId} encountered an error and could not complete.`, auditRunId, "audit");
  }
}
