import { Router } from "express";
import { db } from "@workspace/db";
import { screenshotsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/screenshots", requireAuth, async (req, res) => {
  const auditRunId = Number(req.query.auditRunId);
  if (!auditRunId || isNaN(auditRunId)) {
    res.status(400).json({ error: "auditRunId is required" });
    return;
  }
  const screenshots = await db.select().from(screenshotsTable)
    .where(eq(screenshotsTable.auditRunId, auditRunId))
    .orderBy(screenshotsTable.createdAt);
  res.json(screenshots.map(s => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
  })));
});

export default router;
