// ─── Audit Execution Service ──────────────────────────────────────────────────
// Top-level orchestrator: initialises the pipeline, delegates to sub-services,
// and persists the result.  This is the single entry point called by routes.
//
// Dependency graph:
//   AuditExecutionService
//     → AuditPipeline          (runs scanners via ScannerRegistry)
//     → AuditAnalysisService   (computes scores and extracts findings)
//     → AuditStorageService    (persists to DB)
//     → AuditReportingService  (builds report text, not persisted here)

import { db } from "@workspace/db";
import { auditRunsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { auditPipeline } from "./audit-pipeline";
import { auditAnalysisService } from "./audit-analysis-service";
import { auditStorageService } from "./audit-storage-service";
import type { AuditContext } from "./audit-types";
import { safePerformanceScore, safeScore } from "./scoring-utils";

// ─── Interface ────────────────────────────────────────────────────────────────

export interface AuditExecutionService {
  /**
   * Run the full audit pipeline for a given audit run ID and target URL.
   * This is intentionally async-fire-and-forget: the route handler calls it
   * after returning HTTP 201 to the client, so the audit runs in the background.
   */
  execute(auditRunId: number, url: string): Promise<void>;
}

// ─── Implementation ───────────────────────────────────────────────────────────

class DefaultAuditExecutionService implements AuditExecutionService {
  async execute(auditRunId: number, url: string): Promise<void> {
    const startTime = Date.now();

    try {
      // ── Stage 0: Initialise ───────────────────────────────────────────────
      await auditStorageService.markRunning(auditRunId);

      const [run] = await db
        .select({ projectId: auditRunsTable.projectId })
        .from(auditRunsTable)
        .where(eq(auditRunsTable.id, auditRunId))
        .limit(1);

      if (!run) throw new Error(`Audit run ${auditRunId} not found`);

      logger.info({ auditRunId, url }, "Audit execution started");

      const context: AuditContext = {
        url,
        auditRunId,
        projectId: run.projectId,
        environment: "production",
        options: { screenshotDevices: ["desktop", "tablet", "mobile"] },
      };

      // ── Stage 1–N: Run scanner pipeline ──────────────────────────────────
      const { scannerOutputs, stages } = await auditPipeline.run(context);

      // ── Scoring ───────────────────────────────────────────────────────────
      // Use safeScore/safePerformanceScore so that a scanner that ran but
      // failed (returning explicit 0 with success:false) falls back to a
      // neutral default instead of collapsing the overall score.
      const perfScore = safePerformanceScore(scannerOutputs.performance);
      const accScore  = safeScore(scannerOutputs.accessibility);
      const seoScore  = safeScore(scannerOutputs.seo);
      const secScore  = safeScore(scannerOutputs.security);
      const bpScore = auditAnalysisService.computeBestPracticesScore(scannerOutputs);

      const overallScore = auditAnalysisService.computeOverallScore({
        performance: perfScore,
        accessibility: accScore,
        seo: seoScore,
        security: secScore,
        bestPractices: bpScore,
      });

      // ── Finding extraction + bug creation ─────────────────────────────────
      const findings = auditAnalysisService.extractFindings(scannerOutputs);
      const bugsToCreate = findings.filter((f) => f.autoCreateBug);

      for (const finding of bugsToCreate) {
        await auditStorageService.createBug(run.projectId, auditRunId, finding);
      }

      // ── Screenshot persistence ────────────────────────────────────────────
      if (scannerOutputs.screenshots?.screenshots) {
        for (const shot of scannerOutputs.screenshots.screenshots) {
          await auditStorageService.saveScreenshot(auditRunId, shot.deviceType, shot.dataUrl);
        }
      }

      // ── Build findings payload ─────────────────────────────────────────────
      // _pipeline is stored alongside scanner data so the frontend can render
      // the real execution timeline instead of simulated phases.
      const aiSummaryText =
        scannerOutputs.aiSummary?.executiveSummary ??
        `Audit completed with overall score ${overallScore}/100. Found ${bugsToCreate.length} issue(s).`;

      const findingsPayload: Record<string, unknown> = {
        performance: scannerOutputs.performance,
        accessibility: scannerOutputs.accessibility,
        seo: scannerOutputs.seo,
        security: scannerOutputs.security,
        brokenLinks: scannerOutputs.brokenLinks,
        consoleErrors: scannerOutputs.consoleErrors,
        networkRequests: scannerOutputs.networkRequests,
        technologies: scannerOutputs.technologies,
        // Pipeline execution record — used by the frontend timeline
        _pipeline: {
          stages,
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - startTime,
        },
      };

      // ── Persist final result ──────────────────────────────────────────────
      const durationMs = Date.now() - startTime;
      await auditStorageService.saveFinalResult(auditRunId, {
        durationMs,
        overallScore,
        bugsFound: bugsToCreate.length,
        performanceScore: perfScore,
        accessibilityScore: accScore,
        seoScore: seoScore,
        bestPracticesScore: bpScore,
        findings: findingsPayload,
        aiSummary: aiSummaryText,
      });

      // ── Notifications ─────────────────────────────────────────────────────
      await auditStorageService.notifyAllUsers({
        type: "audit_completed",
        title: "Audit Completed",
        message: `Audit #${auditRunId} finished with score ${overallScore}/100. Found ${bugsToCreate.length} issue(s).`,
        relatedId: auditRunId,
        relatedType: "audit",
      });

      const hasCritical = bugsToCreate.some((f) => f.severity === "critical");
      if (hasCritical) {
        await auditStorageService.notifyAllUsers({
          type: "critical_issue",
          title: "Critical Issue Found",
          message: `Audit #${auditRunId} found ${bugsToCreate.filter((f) => f.severity === "critical").length} critical severity bug(s) requiring immediate attention.`,
          relatedId: auditRunId,
          relatedType: "audit",
        });
      }

      logger.info(
        { auditRunId, bugsFound: bugsToCreate.length, overallScore, durationMs },
        "Audit execution completed",
      );
    } catch (error) {
      const durationMs = Date.now() - startTime;
      logger.error({ auditRunId, error }, "Audit execution failed");
      await auditStorageService.markFailed(auditRunId, durationMs);
      await auditStorageService.notifyAllUsers({
        type: "audit_failed",
        title: "Audit Failed",
        message: `Audit #${auditRunId} encountered an error and could not complete.`,
        relatedId: auditRunId,
        relatedType: "audit",
      });
    }
  }
}

export const auditExecutionService: AuditExecutionService = new DefaultAuditExecutionService();
export { DefaultAuditExecutionService };
