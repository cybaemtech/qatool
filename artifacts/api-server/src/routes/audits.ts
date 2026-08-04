import { Router } from "express";
import { db } from "@workspace/db";
import { auditRunsTable, projectsTable, bugsTable, screenshotsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { CreateAuditBody, ListAuditsQueryParams, GetAuditParams, CancelAuditParams } from "@workspace/api-zod";
import { runPlaywrightAudit } from "../lib/audit-engine";
import { logger } from "../lib/logger";

const router = Router();

function formatAudit(a: Record<string, unknown>, projectName?: string | null) {
  return {
    ...a,
    projectName: projectName ?? null,
    createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt,
    startedAt: a.startedAt instanceof Date ? (a.startedAt as Date).toISOString() : a.startedAt ?? null,
    completedAt: a.completedAt instanceof Date ? (a.completedAt as Date).toISOString() : a.completedAt ?? null,
  };
}

router.get("/audits", requireAuth, async (req, res) => {
  const query = ListAuditsQueryParams.safeParse({
    projectId: req.query.projectId ? Number(req.query.projectId) : undefined,
    status: req.query.status,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });

  const conditions = [];
  if (query.success && query.data.projectId) {
    conditions.push(eq(auditRunsTable.projectId, query.data.projectId));
  }
  if (query.success && query.data.status) {
    conditions.push(eq(auditRunsTable.status, query.data.status as "pending" | "running" | "completed" | "failed" | "cancelled"));
  }

  const limit = (query.success && query.data.limit) ? query.data.limit : 50;

  const audits = await db
    .select({
      id: auditRunsTable.id,
      projectId: auditRunsTable.projectId,
      projectName: projectsTable.name,
      createdById: auditRunsTable.createdById,
      status: auditRunsTable.status,
      startedAt: auditRunsTable.startedAt,
      completedAt: auditRunsTable.completedAt,
      durationMs: auditRunsTable.durationMs,
      overallScore: auditRunsTable.overallScore,
      bugsFound: auditRunsTable.bugsFound,
      performanceScore: auditRunsTable.performanceScore,
      accessibilityScore: auditRunsTable.accessibilityScore,
      seoScore: auditRunsTable.seoScore,
      bestPracticesScore: auditRunsTable.bestPracticesScore,
      findings: auditRunsTable.findings,
      aiSummary: auditRunsTable.aiSummary,
      createdAt: auditRunsTable.createdAt,
    })
    .from(auditRunsTable)
    .leftJoin(projectsTable, eq(auditRunsTable.projectId, projectsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditRunsTable.createdAt))
    .limit(limit);

  res.json(audits.map(a => formatAudit(a as Record<string, unknown>, a.projectName)));
});

router.post("/audits", requireAuth, async (req, res) => {
  const parsed = CreateAuditBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { projectId } = parsed.data;

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const [auditRun] = await db.insert(auditRunsTable).values({
    projectId,
    createdById: req.user!.userId,
    status: "pending",
    bugsFound: 0,
  }).returning();

  res.status(201).json(formatAudit({ ...auditRun }, project.name));

  // Run audit in background (non-blocking)
  runPlaywrightAudit(auditRun.id, project.url).catch((err: unknown) => {
    logger.error({ err, auditRunId: auditRun.id }, "Background audit failed");
  });
});

router.get("/audits/:id", requireAuth, async (req, res) => {
  const params = GetAuditParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [audit] = await db
    .select({
      id: auditRunsTable.id,
      projectId: auditRunsTable.projectId,
      projectName: projectsTable.name,
      createdById: auditRunsTable.createdById,
      status: auditRunsTable.status,
      startedAt: auditRunsTable.startedAt,
      completedAt: auditRunsTable.completedAt,
      durationMs: auditRunsTable.durationMs,
      overallScore: auditRunsTable.overallScore,
      bugsFound: auditRunsTable.bugsFound,
      performanceScore: auditRunsTable.performanceScore,
      accessibilityScore: auditRunsTable.accessibilityScore,
      seoScore: auditRunsTable.seoScore,
      bestPracticesScore: auditRunsTable.bestPracticesScore,
      findings: auditRunsTable.findings,
      aiSummary: auditRunsTable.aiSummary,
      createdAt: auditRunsTable.createdAt,
    })
    .from(auditRunsTable)
    .leftJoin(projectsTable, eq(auditRunsTable.projectId, projectsTable.id))
    .where(eq(auditRunsTable.id, params.data.id))
    .limit(1);

  if (!audit) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }
  res.json(formatAudit(audit as Record<string, unknown>, audit.projectName));
});

router.get("/audits/:id/ai-analysis", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [audit] = await db.select().from(auditRunsTable).where(eq(auditRunsTable.id, id)).limit(1);
  if (!audit) { res.status(404).json({ error: "Audit not found" }); return; }

  const perf = audit.performanceScore ?? 70;
  const acc = audit.accessibilityScore ?? 70;
  const seo = audit.seoScore ?? 70;
  const bp = audit.bestPracticesScore ?? 70;
  const bugCount = audit.bugsFound ?? 0;

  const riskLevel = perf < 50 || bugCount > 10 ? "critical" : perf < 70 || bugCount > 5 ? "high" : perf < 85 ? "medium" : "low";

  const rootCauses = [];
  if (perf < 75) rootCauses.push({ issue: "Slow page performance", cause: "Unoptimized assets and render-blocking resources", impact: "Increased bounce rate and poor user experience" });
  if (acc < 80) rootCauses.push({ issue: "Accessibility gaps", cause: "Missing ARIA attributes and inadequate color contrast", impact: "Excludes users with disabilities; WCAG non-compliance" });
  if (seo < 75) rootCauses.push({ issue: "SEO deficiencies", cause: "Missing meta tags, poor heading hierarchy, slow LCP", impact: "Reduced organic search visibility" });
  if (bp < 75) rootCauses.push({ issue: "Outdated practices", cause: "Deprecated APIs and insecure cross-origin policies", impact: "Security vulnerabilities and compatibility risks" });
  if (bugCount > 0) rootCauses.push({ issue: `${bugCount} detected issue(s)`, cause: "Runtime errors, broken links, or failed network requests", impact: "Direct functionality failures visible to end users" });

  const fixes = [];
  if (perf < 85) fixes.push({ fix: "Enable image lazy-loading and next-gen formats (WebP/AVIF)", priority: "High", effort: "Low" });
  if (perf < 75) fixes.push({ fix: "Implement code splitting and tree shaking to reduce bundle size", priority: "High", effort: "Medium" });
  if (acc < 85) fixes.push({ fix: "Add ARIA labels to all interactive elements; verify color contrast ratios", priority: "High", effort: "Low" });
  if (seo < 80) fixes.push({ fix: "Add descriptive meta descriptions and Open Graph tags to all pages", priority: "Medium", effort: "Low" });
  if (bp < 80) fixes.push({ fix: "Migrate deprecated browser APIs and enable Content Security Policy headers", priority: "Medium", effort: "Medium" });
  fixes.push({ fix: "Set up CI/CD quality gates to catch regressions before deployment", priority: "Low", effort: "High" });

  const riskFactors = [];
  if (perf < 70) riskFactors.push("Core Web Vitals below Google's recommended thresholds");
  if (bugCount > 0) riskFactors.push(`${bugCount} active issue(s) detected during automated scan`);
  if (acc < 80) riskFactors.push("Accessibility score below WCAG 2.1 AA compliance threshold");
  if (seo < 70) riskFactors.push("SEO score may cause reduced search engine visibility");
  if (riskFactors.length === 0) riskFactors.push("No major risk factors identified in this audit");

  res.json({
    auditRunId: id,
    summary: audit.aiSummary ?? `AI analysis for audit #${id}. Overall score: ${audit.overallScore ?? "N/A"}/100.`,
    rootCauseAnalysis: rootCauses,
    suggestedFixes: fixes,
    riskAssessment: {
      level: riskLevel,
      summary: `Risk level is ${riskLevel.toUpperCase()}. ${riskLevel === "critical" ? "Immediate action required." : riskLevel === "high" ? "Address within this sprint." : riskLevel === "medium" ? "Schedule for next release cycle." : "Monitor and maintain current quality."}`,
      factors: riskFactors,
    },
  });
});

router.post("/audits/:id/cancel", requireAuth, async (req, res) => {
  const params = CancelAuditParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [audit] = await db.update(auditRunsTable)
    .set({ status: "cancelled", completedAt: new Date() })
    .where(and(eq(auditRunsTable.id, params.data.id), sql`${auditRunsTable.status} IN ('pending', 'running')`))
    .returning();
  if (!audit) {
    res.status(404).json({ error: "Audit not found or not cancellable" });
    return;
  }
  res.json(formatAudit({ ...audit }, null));
});

export default router;
