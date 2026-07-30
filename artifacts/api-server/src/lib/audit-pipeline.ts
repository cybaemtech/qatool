// ─── Audit Pipeline ───────────────────────────────────────────────────────────
// Executes scanners sequentially, collecting results and stage metadata.
// Each stage is tracked so the frontend can display real progress.
// Future: add parallel execution by setting options.parallelExecution = true.

import { logger } from "./logger";
import { scannerRegistry } from "./scanner-registry";
import type { AuditContext, AuditResult, ScannerName } from "./audit-types";

// ─── Pipeline stage record ────────────────────────────────────────────────────

export interface PipelineStage {
  name: ScannerName;
  label: string;
  order: number;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
}

export interface PipelineResult {
  /** Partial scanner outputs — each scanner key is set after that scanner runs */
  scannerOutputs: Partial<AuditResult>;
  /** Stage-by-stage execution record for the timeline UI */
  stages: PipelineStage[];
  /** Whether any critical scanner failed */
  hadCriticalFailure: boolean;
}

// ─── Pipeline executor ────────────────────────────────────────────────────────

export class AuditPipeline {
  /**
   * Run all registered scanners in order, returning partial results and
   * a full stage log.  Individual scanner failures are caught and recorded
   * as "failed" stages; only stages marked `critical: true` abort the pipeline.
   */
  async run(context: AuditContext): Promise<PipelineResult> {
    const registeredScanners = scannerRegistry.getAll();

    const stages: PipelineStage[] = registeredScanners.map((rs) => ({
      name: rs.scanner.name,
      label: rs.stageLabel,
      order: rs.order,
      status: "pending",
    }));

    const scannerOutputs: Partial<AuditResult> = {};
    let hadCriticalFailure = false;

    for (let i = 0; i < registeredScanners.length; i++) {
      const { scanner, stageLabel, critical } = registeredScanners[i];
      const stage = stages[i];

      stage.status = "running";
      stage.startedAt = new Date().toISOString();
      logger.info({ auditRunId: context.auditRunId, stage: scanner.name }, stageLabel);

      try {
        const result = await scanner.run(context);
        stage.status = "completed";
        stage.completedAt = new Date().toISOString();
        stage.durationMs = result.durationMs;

        // Map scanner output to the correct key on AuditResult
        this.assignScannerResult(scannerOutputs, scanner.name, result);
      } catch (err) {
        stage.status = "failed";
        stage.completedAt = new Date().toISOString();
        stage.error = err instanceof Error ? err.message : String(err);

        logger.error(
          { auditRunId: context.auditRunId, stage: scanner.name, err },
          `Scanner "${scanner.name}" failed`,
        );

        if (critical) {
          hadCriticalFailure = true;
          // Mark remaining stages as skipped
          for (let j = i + 1; j < stages.length; j++) {
            stages[j].status = "skipped";
          }
          break;
        }
      }
    }

    return { scannerOutputs, stages, hadCriticalFailure };
  }

  private assignScannerResult(
    outputs: Partial<AuditResult>,
    name: ScannerName,
    result: unknown,
  ): void {
    switch (name) {
      case "performance":      outputs.performance      = result as AuditResult["performance"];      break;
      case "accessibility":    outputs.accessibility    = result as AuditResult["accessibility"];    break;
      case "seo":              outputs.seo              = result as AuditResult["seo"];              break;
      case "security":         outputs.security         = result as AuditResult["security"];         break;
      case "broken-links":     outputs.brokenLinks      = result as AuditResult["brokenLinks"];      break;
      case "console-errors":   outputs.consoleErrors    = result as AuditResult["consoleErrors"];    break;
      case "network":          outputs.networkRequests  = result as AuditResult["networkRequests"];  break;
      case "screenshot":       outputs.screenshots      = result as AuditResult["screenshots"];      break;
      case "technology":       outputs.technologies     = result as AuditResult["technologies"];     break;
      case "ai-summary":       outputs.aiSummary        = result as AuditResult["aiSummary"];        break;
    }
  }
}

export const auditPipeline = new AuditPipeline();
