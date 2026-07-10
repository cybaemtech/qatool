import { Router } from "express";
import { db } from "@workspace/db";
import { reportsTable, auditRunsTable, projectsTable, bugsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { ListReportsQueryParams, GenerateReportBody, GetReportParams } from "@workspace/api-zod";
import { generatePdfReport } from "../lib/pdf-generator";

const router = Router();

router.get("/reports", requireAuth, async (req, res) => {
  const query = ListReportsQueryParams.safeParse({
    projectId: req.query.projectId ? Number(req.query.projectId) : undefined,
    auditRunId: req.query.auditRunId ? Number(req.query.auditRunId) : undefined,
  });

  const conditions = [];
  if (query.success) {
    if (query.data.projectId) conditions.push(eq(reportsTable.projectId, query.data.projectId));
    if (query.data.auditRunId) conditions.push(eq(reportsTable.auditRunId, query.data.auditRunId));
  }

  const reports = await db.select().from(reportsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(reportsTable.createdAt);

  res.json(reports.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.post("/reports", requireAuth, async (req, res) => {
  const parsed = GenerateReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { auditRunId } = parsed.data;

  const [audit] = await db
    .select({
      id: auditRunsTable.id,
      projectId: auditRunsTable.projectId,
      projectName: projectsTable.name,
      status: auditRunsTable.status,
      performanceScore: auditRunsTable.performanceScore,
      accessibilityScore: auditRunsTable.accessibilityScore,
      seoScore: auditRunsTable.seoScore,
      bestPracticesScore: auditRunsTable.bestPracticesScore,
      bugsFound: auditRunsTable.bugsFound,
      overallScore: auditRunsTable.overallScore,
      startedAt: auditRunsTable.startedAt,
      completedAt: auditRunsTable.completedAt,
      durationMs: auditRunsTable.durationMs,
      findings: auditRunsTable.findings,
    })
    .from(auditRunsTable)
    .leftJoin(projectsTable, eq(auditRunsTable.projectId, projectsTable.id))
    .where(eq(auditRunsTable.id, auditRunId))
    .limit(1);

  if (!audit) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }

  const [report] = await db.insert(reportsTable).values({
    projectId: audit.projectId,
    auditRunId,
    status: "generating",
  }).returning();

  res.status(201).json({ ...report, createdAt: report.createdAt.toISOString() });

  // Generate PDF in background
  const bugs = await db.select().from(bugsTable).where(eq(bugsTable.auditRunId, auditRunId));
  generatePdfReport(report.id, audit as Record<string, unknown>, bugs).catch(() => {});
});

router.get("/reports/:id", requireAuth, async (req, res) => {
  const params = GetReportParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [report] = await db.select().from(reportsTable).where(eq(reportsTable.id, params.data.id)).limit(1);
  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  res.json({ ...report, createdAt: report.createdAt.toISOString() });
});

export default router;
