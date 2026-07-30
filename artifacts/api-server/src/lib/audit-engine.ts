// ─── Audit Engine — public entry point ───────────────────────────────────────
// This file is the stable public API consumed by route handlers.
// All implementation has been extracted into the service layer:
//
//   AuditExecutionService  →  top-level orchestrator
//   AuditPipeline          →  scanner sequencing + stage tracking
//   ScannerRegistry        →  scanner registration + adapter injection
//   AuditAnalysisService   →  score computation + finding extraction
//   AuditStorageService    →  database persistence
//   AuditReportingService  →  report text / JSON generation
//
// To swap a mock scanner for a real integration (Lighthouse, axe-core, etc.):
//   import { scannerRegistry } from "./scanner-registry";
//   import { MyLighthouseScanner } from "./adapters/my-lighthouse";
//   scannerRegistry.replace("performance", new MyLighthouseScanner());

export { auditExecutionService } from "./audit-execution-service";
export { auditStorageService } from "./audit-storage-service";
export { auditAnalysisService } from "./audit-analysis-service";
export { auditReportingService } from "./audit-reporting-service";
export { scannerRegistry } from "./scanner-registry";
export { auditPipeline } from "./audit-pipeline";

// Re-export types for external consumers
export type { AuditExecutionService } from "./audit-execution-service";
export type { AuditStorageService, FinalAuditPersist, NotificationEvent } from "./audit-storage-service";
export type { AuditAnalysisService, CategoryScores } from "./audit-analysis-service";
export type { AuditReportingService, AuditReportInput, AuditReportSummary } from "./audit-reporting-service";
export type { ScannerRegistry, RegisteredScanner } from "./scanner-registry";
export type { AuditPipeline, PipelineResult, PipelineStage } from "./audit-pipeline";

// ─── Backward-compatible export ───────────────────────────────────────────────
// Routes still call runPlaywrightAudit(auditRunId, url) — no changes required.

import { auditExecutionService } from "./audit-execution-service";

export async function runAuditEngine(auditRunId: number, url: string): Promise<void> {
  return auditExecutionService.execute(auditRunId, url);
}

export const runPlaywrightAudit = runAuditEngine;

// Legacy service interfaces — kept so any external code that imported them
// directly from this file continues to compile without changes.
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
  generateSummary(
    findings: Record<string, unknown>,
    scores: { performance: number; accessibility: number; seo: number; bestPractices: number },
    bugCount: number,
  ): string;
}
