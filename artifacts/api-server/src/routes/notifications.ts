import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

function formatNotif(n: Record<string, unknown>) {
  return {
    ...n,
    createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : n.createdAt,
  };
}

router.get("/notifications", requireAuth, async (req, res) => {
  const unreadOnly = req.query.unreadOnly === "true";
  const userId = req.user!.userId;

  const conditions = [eq(notificationsTable.userId, userId)];
  if (unreadOnly) conditions.push(eq(notificationsTable.read, false));

  const rows = await db.select().from(notificationsTable)
    .where(and(...conditions))
    .orderBy(notificationsTable.createdAt);

  res.json(rows.map(r => formatNotif(r as unknown as Record<string, unknown>)));
});

router.patch("/notifications/mark-all-read", requireAuth, async (req, res) => {
  await db.update(notificationsTable)
    .set({ read: true })
    .where(eq(notificationsTable.userId, req.user!.userId));
  res.json({ success: true });
});

router.patch("/notifications/:id/read", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [updated] = await db.update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.user!.userId)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatNotif(updated as unknown as Record<string, unknown>));
});

export default router;
