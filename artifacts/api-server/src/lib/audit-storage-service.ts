// ─── Audit Storage Service ────────────────────────────────────────────────────
// Responsible for all database persistence operations related to audits.
// Inject a custom implementation to swap out storage backends.

import { db } from "@workspace/db";
import {
  auditRunsTable,
  bugsTable,
  screenshotsTable,
  notificationsTable,
  usersTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import type { AuditFinding, ScannerName, AuditResult } from "./audit-types";

// ─── Interface ────────────────────────────────────────────────────────────────

export interface AuditStorageService {
  /** Mark an audit run as "running" and record start time */
  markRunning(auditRunId: number): Promise<void>;

  /** Persist a bug derived from an audit finding */
  createBug(projectId: number, auditRunId: number, finding: AuditFinding): Promise<void>;

  /** Persist a screenshot captured during the audit */
  saveScreenshot(auditRunId: number, deviceType: string, dataUrl: string): Promise<void>;

  /** Persist the final completed audit result */
  saveFinalResult(auditRunId: number, result: FinalAuditPersist): Promise<void>;

  /** Mark an audit run as failed */
  markFailed(auditRunId: number, durationMs: number): Promise<void>;

  /** Send a notification to all users */
  notifyAllUsers(event: NotificationEvent): Promise<void>;
}

export interface FinalAuditPersist {
  durationMs: number;
  overallScore: number;
  bugsFound: number;
  performanceScore: number;
  accessibilityScore: number;
  seoScore: number;
  bestPracticesScore: number;
  findings: Record<string, unknown>;
  aiSummary: string;
}

export interface NotificationEvent {
  type: "audit_completed" | "audit_failed" | "critical_issue" | "audit_started";
  title: string;
  message: string;
  relatedId: number;
  relatedType: string;
}

// ─── Drizzle / PostgreSQL implementation ─────────────────────────────────────

class DrizzleAuditStorageService implements AuditStorageService {
  async markRunning(auditRunId: number): Promise<void> {
    await db
      .update(auditRunsTable)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(auditRunsTable.id, auditRunId));
  }

  async createBug(
    projectId: number,
    auditRunId: number,
    finding: AuditFinding,
  ): Promise<void> {
    try {
      await db.insert(bugsTable).values({
        projectId,
        auditRunId,
        title: finding.title,
        description: finding.description,
        severity: finding.severity === "info" ? "low" : finding.severity,
        status: "open",
        priority: finding.severity === "info" ? "low" : finding.severity,
      });
    } catch (err) {
      logger.warn({ err, findingId: finding.id }, "Failed to persist bug");
    }
  }

  async saveScreenshot(
    auditRunId: number,
    deviceType: string,
    dataUrl: string,
  ): Promise<void> {
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

  async saveFinalResult(
    auditRunId: number,
    result: FinalAuditPersist,
  ): Promise<void> {
    await db
      .update(auditRunsTable)
      .set({
        status: "completed",
        completedAt: new Date(),
        durationMs: result.durationMs,
        overallScore: result.overallScore,
        bugsFound: result.bugsFound,
        performanceScore: result.performanceScore,
        accessibilityScore: result.accessibilityScore,
        seoScore: result.seoScore,
        bestPracticesScore: result.bestPracticesScore,
        findings: result.findings as unknown as Record<string, unknown>,
        aiSummary: result.aiSummary,
      })
      .where(eq(auditRunsTable.id, auditRunId));
  }

  async markFailed(auditRunId: number, durationMs: number): Promise<void> {
    await db
      .update(auditRunsTable)
      .set({ status: "failed", completedAt: new Date(), durationMs })
      .where(eq(auditRunsTable.id, auditRunId));
  }

  async notifyAllUsers(event: NotificationEvent): Promise<void> {
    try {
      const users = await db.select({ id: usersTable.id }).from(usersTable);
      for (const user of users) {
        await db.insert(notificationsTable).values({
          userId: user.id,
          type: event.type as "audit_completed" | "audit_failed" | "critical_issue",
          title: event.title,
          message: event.message,
          relatedId: event.relatedId,
          relatedType: event.relatedType,
        });
      }
    } catch (err) {
      logger.error({ err }, "Failed to create notifications");
    }
  }
}

export const auditStorageService: AuditStorageService = new DrizzleAuditStorageService();
export { DrizzleAuditStorageService };
