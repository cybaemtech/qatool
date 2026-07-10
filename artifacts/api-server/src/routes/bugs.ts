import { Router } from "express";
import { db } from "@workspace/db";
import { bugsTable, bugCommentsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

function formatBug(b: Record<string, unknown>) {
  return {
    ...b,
    createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : b.createdAt,
    dueDate: b.dueDate instanceof Date ? b.dueDate.toISOString() : b.dueDate ?? null,
  };
}

function formatComment(c: Record<string, unknown>) {
  return {
    ...c,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
  };
}

router.get("/bugs", requireAuth, async (req, res) => {
  const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
  const auditRunId = req.query.auditRunId ? Number(req.query.auditRunId) : undefined;
  const severity = req.query.severity as string | undefined;
  const status = req.query.status as string | undefined;
  const priority = req.query.priority as string | undefined;
  const assignedToId = req.query.assignedToId ? Number(req.query.assignedToId) : undefined;

  const conditions = [];
  if (projectId) conditions.push(eq(bugsTable.projectId, projectId));
  if (auditRunId) conditions.push(eq(bugsTable.auditRunId, auditRunId));
  if (severity) conditions.push(eq(bugsTable.severity, severity as "critical" | "high" | "medium" | "low"));
  if (status) conditions.push(eq(bugsTable.status, status as "open" | "in_progress" | "resolved" | "ignored"));
  if (priority) conditions.push(eq(bugsTable.priority, priority as "critical" | "high" | "medium" | "low"));
  if (assignedToId) conditions.push(eq(bugsTable.assignedToId, assignedToId));

  const bugs = await db
    .select({
      id: bugsTable.id,
      projectId: bugsTable.projectId,
      auditRunId: bugsTable.auditRunId,
      title: bugsTable.title,
      description: bugsTable.description,
      severity: bugsTable.severity,
      status: bugsTable.status,
      priority: bugsTable.priority,
      assignedToId: bugsTable.assignedToId,
      assignedToName: usersTable.name,
      dueDate: bugsTable.dueDate,
      resolutionNotes: bugsTable.resolutionNotes,
      screenshotUrl: bugsTable.screenshotUrl,
      createdAt: bugsTable.createdAt,
    })
    .from(bugsTable)
    .leftJoin(usersTable, eq(bugsTable.assignedToId, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(bugsTable.createdAt);

  res.json(bugs.map(b => formatBug(b as unknown as Record<string, unknown>)));
});

router.get("/bugs/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [bug] = await db
    .select({
      id: bugsTable.id,
      projectId: bugsTable.projectId,
      auditRunId: bugsTable.auditRunId,
      title: bugsTable.title,
      description: bugsTable.description,
      severity: bugsTable.severity,
      status: bugsTable.status,
      priority: bugsTable.priority,
      assignedToId: bugsTable.assignedToId,
      assignedToName: usersTable.name,
      dueDate: bugsTable.dueDate,
      resolutionNotes: bugsTable.resolutionNotes,
      screenshotUrl: bugsTable.screenshotUrl,
      createdAt: bugsTable.createdAt,
    })
    .from(bugsTable)
    .leftJoin(usersTable, eq(bugsTable.assignedToId, usersTable.id))
    .where(eq(bugsTable.id, id))
    .limit(1);

  if (!bug) { res.status(404).json({ error: "Bug not found" }); return; }
  res.json(formatBug(bug as unknown as Record<string, unknown>));
});

router.patch("/bugs/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { title, description, severity, status, priority, assignedToId, dueDate, resolutionNotes } = req.body;

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (severity) updates.severity = severity;
  if (status) updates.status = status;
  if (priority) updates.priority = priority;
  if ("assignedToId" in req.body) updates.assignedToId = assignedToId ?? null;
  if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;
  if (resolutionNotes !== undefined) updates.resolutionNotes = resolutionNotes;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" }); return;
  }

  const [updated] = await db.update(bugsTable).set(updates).where(eq(bugsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Bug not found" }); return; }

  const [bug] = await db
    .select({
      id: bugsTable.id,
      projectId: bugsTable.projectId,
      auditRunId: bugsTable.auditRunId,
      title: bugsTable.title,
      description: bugsTable.description,
      severity: bugsTable.severity,
      status: bugsTable.status,
      priority: bugsTable.priority,
      assignedToId: bugsTable.assignedToId,
      assignedToName: usersTable.name,
      dueDate: bugsTable.dueDate,
      resolutionNotes: bugsTable.resolutionNotes,
      screenshotUrl: bugsTable.screenshotUrl,
      createdAt: bugsTable.createdAt,
    })
    .from(bugsTable)
    .leftJoin(usersTable, eq(bugsTable.assignedToId, usersTable.id))
    .where(eq(bugsTable.id, id))
    .limit(1);

  res.json(formatBug(bug as unknown as Record<string, unknown>));
});

router.get("/bugs/:id/comments", requireAuth, async (req, res) => {
  const bugId = Number(req.params.id);
  const comments = await db
    .select({
      id: bugCommentsTable.id,
      bugId: bugCommentsTable.bugId,
      userId: bugCommentsTable.userId,
      userName: usersTable.name,
      content: bugCommentsTable.content,
      createdAt: bugCommentsTable.createdAt,
    })
    .from(bugCommentsTable)
    .leftJoin(usersTable, eq(bugCommentsTable.userId, usersTable.id))
    .where(eq(bugCommentsTable.bugId, bugId))
    .orderBy(bugCommentsTable.createdAt);

  res.json(comments.map(c => formatComment(c as unknown as Record<string, unknown>)));
});

router.post("/bugs/:id/comments", requireAuth, async (req, res) => {
  const bugId = Number(req.params.id);
  const { content } = req.body;
  if (!content?.trim()) {
    res.status(400).json({ error: "Content is required" }); return;
  }
  const [comment] = await db.insert(bugCommentsTable).values({
    bugId,
    userId: req.user!.userId,
    content: content.trim(),
  }).returning();

  const [withUser] = await db
    .select({
      id: bugCommentsTable.id,
      bugId: bugCommentsTable.bugId,
      userId: bugCommentsTable.userId,
      userName: usersTable.name,
      content: bugCommentsTable.content,
      createdAt: bugCommentsTable.createdAt,
    })
    .from(bugCommentsTable)
    .leftJoin(usersTable, eq(bugCommentsTable.userId, usersTable.id))
    .where(eq(bugCommentsTable.id, comment.id))
    .limit(1);

  res.status(201).json(formatComment(withUser as unknown as Record<string, unknown>));
});

export default router;
