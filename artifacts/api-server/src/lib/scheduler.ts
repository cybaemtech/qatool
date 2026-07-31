// ─── Audit Scheduler Service ──────────────────────────────────────────────────
// Checks every minute for scheduled audits that are due to run.
// Uses node-cron internally. No external queue required.

import { db } from "@workspace/db";
import { scheduledAuditsTable, projectsTable, auditRunsTable } from "@workspace/db";
import { eq, and, lte, isNull, or } from "drizzle-orm";
import { logger } from "./logger";
import { runPlaywrightAudit } from "./audit-engine";

// Resolve IANA timezone offset for a given Date
function toTZ(date: Date, tz: string): Date {
  try {
    const str = date.toLocaleString("en-CA", { timeZone: tz, hour12: false });
    return new Date(str.replace(", ", "T"));
  } catch {
    return date;
  }
}

function addInterval(date: Date, frequency: string, tz: string): Date {
  const local = toTZ(date, tz);
  const next = new Date(local);
  if (frequency === "daily")        next.setDate(next.getDate() + 1);
  else if (frequency === "weekly")  next.setDate(next.getDate() + 7);
  else if (frequency === "monthly") next.setMonth(next.getMonth() + 1);
  else                              next.setDate(next.getDate() + 1); // fallback
  // Convert back: difference in ms
  const delta = next.getTime() - local.getTime();
  return new Date(date.getTime() + delta);
}

async function processDueSchedules(): Promise<void> {
  const now = new Date();
  try {
    // Find active schedules whose nextRunAt is in the past (or null but enabled)
    const due = await db
      .select({
        id:         scheduledAuditsTable.id,
        name:       scheduledAuditsTable.name,
        projectId:  scheduledAuditsTable.projectId,
        frequency:  scheduledAuditsTable.frequency,
        timezone:   scheduledAuditsTable.timezone,
        repeatMode: scheduledAuditsTable.repeatMode,
        endDate:    scheduledAuditsTable.endDate,
        maxRuns:    scheduledAuditsTable.maxRuns,
        runCount:   scheduledAuditsTable.runCount,
        nextRunAt:  scheduledAuditsTable.nextRunAt,
        enabled:    scheduledAuditsTable.enabled,
        projectUrl: projectsTable.url,
      })
      .from(scheduledAuditsTable)
      .innerJoin(projectsTable, eq(scheduledAuditsTable.projectId, projectsTable.id))
      .where(
        and(
          eq(scheduledAuditsTable.status, "active"),
          eq(scheduledAuditsTable.enabled, true),
          or(
            isNull(scheduledAuditsTable.nextRunAt),
            lte(scheduledAuditsTable.nextRunAt, now),
          ),
        ),
      );

    for (const schedule of due) {
      // Check repeat-mode constraints
      if (schedule.repeatMode === "until" && schedule.endDate && now > schedule.endDate) {
        await db.update(scheduledAuditsTable)
          .set({ status: "disabled", enabled: false })
          .where(eq(scheduledAuditsTable.id, schedule.id));
        continue;
      }
      if (schedule.repeatMode === "once" && schedule.runCount > 0) {
        await db.update(scheduledAuditsTable)
          .set({ status: "disabled", enabled: false })
          .where(eq(scheduledAuditsTable.id, schedule.id));
        continue;
      }
      if (schedule.maxRuns !== null && schedule.runCount >= (schedule.maxRuns ?? 0)) {
        await db.update(scheduledAuditsTable)
          .set({ status: "disabled", enabled: false })
          .where(eq(scheduledAuditsTable.id, schedule.id));
        continue;
      }

      logger.info({ scheduleId: schedule.id, name: schedule.name }, "Scheduler: firing scheduled audit");

      try {
        // Create an audit run
        const [auditRun] = await db.insert(auditRunsTable).values({
          projectId: schedule.projectId,
          status:    "pending",
          bugsFound: 0,
        }).returning();

        // Compute next run time
        const nextRunAt = addInterval(now, schedule.frequency, schedule.timezone ?? "UTC");

        // Update schedule bookkeeping
        await db.update(scheduledAuditsTable).set({
          lastRunAt: now,
          nextRunAt,
          runCount: (schedule.runCount ?? 0) + 1,
        }).where(eq(scheduledAuditsTable.id, schedule.id));

        // Fire the audit in background
        runPlaywrightAudit(auditRun.id, schedule.projectUrl).catch((err) => {
          logger.error({ scheduleId: schedule.id, auditRunId: auditRun.id, err }, "Scheduled audit run failed");
        });
      } catch (err) {
        logger.error({ scheduleId: schedule.id, err }, "Scheduler: failed to create audit run");
      }
    }
  } catch (err) {
    logger.error({ err }, "Scheduler: error checking due schedules");
  }
}

let schedulerTimer: ReturnType<typeof setInterval> | null = null;

export function startScheduler(): void {
  if (schedulerTimer) return; // already running
  logger.info("Audit scheduler started (checking every 60s)");
  // Run immediately on start, then every 60 seconds
  processDueSchedules().catch(() => {});
  schedulerTimer = setInterval(() => {
    processDueSchedules().catch(() => {});
  }, 60_000);
}

export function stopScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    logger.info("Audit scheduler stopped");
  }
}
