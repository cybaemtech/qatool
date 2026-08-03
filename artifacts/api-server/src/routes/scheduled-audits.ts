import { Router } from "express";
import { db } from "@workspace/db";
import { scheduledAuditsTable, projectsTable, auditRunsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { runPlaywrightAudit } from "../lib/audit-engine";

const router = Router();

function computeNextRunAt(frequency: string, hour: number): Date {
  const now = new Date();
  const next = new Date();
  next.setUTCHours(hour, 0, 0, 0);
  if (next <= now) {
    if (frequency === "daily") next.setUTCDate(next.getUTCDate() + 1);
    else if (frequency === "weekly") next.setUTCDate(next.getUTCDate() + 7);
    else if (frequency === "monthly") next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next;
}

function formatSchedule(s: Record<string, unknown>) {
  return {
    ...s,
    nextRunAt: s.nextRunAt instanceof Date ? s.nextRunAt.toISOString() : s.nextRunAt,
    lastRunAt: s.lastRunAt instanceof Date ? s.lastRunAt.toISOString() : s.lastRunAt,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
  };
}

router.get("/scheduled-audits", requireAuth, async (req, res) => {
  const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
  const status = req.query.status as string | undefined;

  const conditions = [];
  if (projectId) conditions.push(eq(scheduledAuditsTable.projectId, projectId));
  if (status) conditions.push(eq(scheduledAuditsTable.status, status as "active" | "paused" | "disabled"));

  const rows = await db
    .select({
      id: scheduledAuditsTable.id,
      name: scheduledAuditsTable.name,
      projectId: scheduledAuditsTable.projectId,
      projectName: projectsTable.name,
      createdById: scheduledAuditsTable.createdById,
      frequency: scheduledAuditsTable.frequency,
      hour: scheduledAuditsTable.hour,
      status: scheduledAuditsTable.status,
      nextRunAt: scheduledAuditsTable.nextRunAt,
      lastRunAt: scheduledAuditsTable.lastRunAt,
      createdAt: scheduledAuditsTable.createdAt,
    })
    .from(scheduledAuditsTable)
    .leftJoin(projectsTable, eq(scheduledAuditsTable.projectId, projectsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(scheduledAuditsTable.createdAt);

  res.json(rows.map(r => formatSchedule(r as unknown as Record<string, unknown>)));
});

router.post("/scheduled-audits", requireAuth, async (req, res) => {
  const { name, projectId, frequency, hour, status } = req.body;
  if (!name || !projectId || !frequency || hour === undefined) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const nextRunAt = computeNextRunAt(frequency, Number(hour));
  const [row] = await db.insert(scheduledAuditsTable).values({
    name,
    projectId: Number(projectId),
    createdById: req.user!.userId,
    frequency: frequency as "daily" | "weekly" | "monthly",
    hour: Number(hour),
    status: (status ?? "active") as "active" | "paused" | "disabled",
    nextRunAt,
  }).returning();

  const [withProject] = await db
    .select({
      id: scheduledAuditsTable.id,
      name: scheduledAuditsTable.name,
      projectId: scheduledAuditsTable.projectId,
      projectName: projectsTable.name,
      createdById: scheduledAuditsTable.createdById,
      frequency: scheduledAuditsTable.frequency,
      hour: scheduledAuditsTable.hour,
      status: scheduledAuditsTable.status,
      nextRunAt: scheduledAuditsTable.nextRunAt,
      lastRunAt: scheduledAuditsTable.lastRunAt,
      createdAt: scheduledAuditsTable.createdAt,
    })
    .from(scheduledAuditsTable)
    .leftJoin(projectsTable, eq(scheduledAuditsTable.projectId, projectsTable.id))
    .where(eq(scheduledAuditsTable.id, row.id))
    .limit(1);

  res.status(201).json(formatSchedule(withProject as unknown as Record<string, unknown>));
});

router.get("/scheduled-audits/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db
    .select({
      id: scheduledAuditsTable.id,
      name: scheduledAuditsTable.name,
      projectId: scheduledAuditsTable.projectId,
      projectName: projectsTable.name,
      createdById: scheduledAuditsTable.createdById,
      frequency: scheduledAuditsTable.frequency,
      hour: scheduledAuditsTable.hour,
      status: scheduledAuditsTable.status,
      nextRunAt: scheduledAuditsTable.nextRunAt,
      lastRunAt: scheduledAuditsTable.lastRunAt,
      createdAt: scheduledAuditsTable.createdAt,
    })
    .from(scheduledAuditsTable)
    .leftJoin(projectsTable, eq(scheduledAuditsTable.projectId, projectsTable.id))
    .where(eq(scheduledAuditsTable.id, id))
    .limit(1);

  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatSchedule(row as unknown as Record<string, unknown>));
});

router.patch("/scheduled-audits/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { name, frequency, hour, status } = req.body;
  const updates: Record<string, unknown> = {};
  if (name) updates.name = name;
  if (frequency) updates.frequency = frequency;
  if (hour !== undefined) updates.hour = Number(hour);
  if (status) updates.status = status;
  if (frequency || hour !== undefined) {
    updates.nextRunAt = computeNextRunAt(frequency ?? "weekly", Number(hour ?? 9));
  }
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" }); return;
  }
  const [updated] = await db.update(scheduledAuditsTable).set(updates).where(eq(scheduledAuditsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }

  const [withProject] = await db
    .select({
      id: scheduledAuditsTable.id,
      name: scheduledAuditsTable.name,
      projectId: scheduledAuditsTable.projectId,
      projectName: projectsTable.name,
      createdById: scheduledAuditsTable.createdById,
      frequency: scheduledAuditsTable.frequency,
      hour: scheduledAuditsTable.hour,
      status: scheduledAuditsTable.status,
      nextRunAt: scheduledAuditsTable.nextRunAt,
      lastRunAt: scheduledAuditsTable.lastRunAt,
      createdAt: scheduledAuditsTable.createdAt,
    })
    .from(scheduledAuditsTable)
    .leftJoin(projectsTable, eq(scheduledAuditsTable.projectId, projectsTable.id))
    .where(eq(scheduledAuditsTable.id, id))
    .limit(1);

  res.json(formatSchedule(withProject as unknown as Record<string, unknown>));
});

router.delete("/scheduled-audits/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(scheduledAuditsTable).where(eq(scheduledAuditsTable.id, id));
  res.status(204).send();
});

// POST /scheduled-audits/:id/run-now
router.post("/scheduled-audits/:id/run-now", requireAuth, async (req, res) => {
  const id = Number(req.params.id);

  const [schedule] = await db
    .select({ id: scheduledAuditsTable.id, projectId: scheduledAuditsTable.projectId, projectUrl: projectsTable.url })
    .from(scheduledAuditsTable)
    .innerJoin(projectsTable, eq(scheduledAuditsTable.projectId, projectsTable.id))
    .where(eq(scheduledAuditsTable.id, id))
    .limit(1);

  if (!schedule) { res.status(404).json({ error: "Not found" }); return; }

  const [auditRun] = await db.insert(auditRunsTable).values({
    projectId: schedule.projectId,
    status:    "pending",
    bugsFound: 0,
  }).returning();

  // Update lastRunAt and increment runCount
  await db.update(scheduledAuditsTable).set({
    lastRunAt: new Date(),
    runCount:  db.$count(scheduledAuditsTable, eq(scheduledAuditsTable.id, id)),
  }).where(eq(scheduledAuditsTable.id, id));

  // Fire audit in background
  runPlaywrightAudit(auditRun.id, schedule.projectUrl).catch(() => {});

  res.json({ auditRunId: auditRun.id, message: "Audit started" });
});

// GET /scheduled-audits/:id/history
router.get("/scheduled-audits/:id/history", requireAuth, async (req, res) => {
  const scheduleId = Number(req.params.id);

  // Verify schedule exists
  const [schedule] = await db
    .select({ id: scheduledAuditsTable.id, projectId: scheduledAuditsTable.projectId })
    .from(scheduledAuditsTable)
    .where(eq(scheduledAuditsTable.id, scheduleId))
    .limit(1);

  if (!schedule) { res.status(404).json({ error: "Not found" }); return; }

  // Return last 20 audit runs for this project, ordered newest first
  const runs = await db
    .select({
      id:                auditRunsTable.id,
      projectId:         auditRunsTable.projectId,
      projectName:       projectsTable.name,
      status:            auditRunsTable.status,
      startedAt:         auditRunsTable.startedAt,
      completedAt:       auditRunsTable.completedAt,
      durationMs:        auditRunsTable.durationMs,
      overallScore:      auditRunsTable.overallScore,
      bugsFound:         auditRunsTable.bugsFound,
      performanceScore:  auditRunsTable.performanceScore,
      accessibilityScore: auditRunsTable.accessibilityScore,
      seoScore:          auditRunsTable.seoScore,
      bestPracticesScore: auditRunsTable.bestPracticesScore,
      createdAt:         auditRunsTable.createdAt,
      createdById:       auditRunsTable.createdById,
    })
    .from(auditRunsTable)
    .leftJoin(projectsTable, eq(auditRunsTable.projectId, projectsTable.id))
    .where(eq(auditRunsTable.projectId, schedule.projectId))
    .orderBy(desc(auditRunsTable.createdAt))
    .limit(20);

  res.json(runs.map(r => ({
    ...r,
    startedAt:   r.startedAt   instanceof Date ? r.startedAt.toISOString()   : r.startedAt,
    completedAt: r.completedAt instanceof Date ? r.completedAt.toISOString() : r.completedAt,
    createdAt:   r.createdAt   instanceof Date ? r.createdAt.toISOString()   : r.createdAt,
  })));
});

export default router;
