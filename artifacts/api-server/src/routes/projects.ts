import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, usersTable, auditRunsTable, bugsTable } from "@workspace/db";
import { eq, sql, desc, ilike, and, count, avg } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import {
  CreateProjectBody,
  UpdateProjectBody,
  GetProjectParams,
  UpdateProjectParams,
  DeleteProjectParams,
  GetProjectStatsParams,
} from "@workspace/api-zod";

const router = Router();

function projectRow(p: Record<string, unknown>) {
  return {
    ...p,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    lastAuditAt: p.lastAuditAt ? new Date(p.lastAuditAt as string).toISOString() : null,
  };
}

router.get("/projects", requireAuth, async (req, res) => {
  const { search, environment, sortBy, sortDir } = req.query as Record<string, string>;

  const conditions = [];
  if (search) conditions.push(ilike(projectsTable.name, `%${search}%`));
  if (environment) conditions.push(eq(projectsTable.environment, environment as "development" | "staging" | "production"));

  const projects = await db
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
      url: projectsTable.url,
      environment: projectsTable.environment,
      description: projectsTable.description,
      auditTemplate: projectsTable.auditTemplate,
      techProfile: projectsTable.techProfile,
      createdById: projectsTable.createdById,
      createdByName: usersTable.name,
      createdAt: projectsTable.createdAt,
      auditCount: sql<number>`cast(count(distinct ${auditRunsTable.id}) as int)`,
      openBugCount: sql<number>`cast(count(distinct case when ${bugsTable.status} = 'open' then ${bugsTable.id} end) as int)`,
      lastAuditAt: sql<Date | null>`max(${auditRunsTable.createdAt})`,
    })
    .from(projectsTable)
    .leftJoin(usersTable, eq(projectsTable.createdById, usersTable.id))
    .leftJoin(auditRunsTable, eq(auditRunsTable.projectId, projectsTable.id))
    .leftJoin(bugsTable, eq(bugsTable.projectId, projectsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(projectsTable.id, usersTable.name)
    .orderBy(sortDir === "asc" ? projectsTable.createdAt : desc(projectsTable.createdAt));

  res.json(projects.map(p => projectRow(p as unknown as Record<string, unknown>)));
});

router.post("/projects", requireAuth, async (req, res) => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { name, url, environment, description, auditTemplate } = parsed.data;
  const [project] = await db.insert(projectsTable).values({
    name,
    url,
    environment: environment as "development" | "staging" | "production",
    description: description ?? null,
    auditTemplate: (auditTemplate as "react" | "vite" | "nextjs" | "wordpress" | "shopify" | "laravel" | "nodejs_api" | "static" | "custom") ?? "custom",
    createdById: req.user!.userId,
  }).returning();
  res.status(201).json({
    ...project,
    createdByName: req.user!.email,
    createdAt: project.createdAt.toISOString(),
    auditCount: 0,
    openBugCount: 0,
    lastAuditAt: null,
  });
});

router.get("/projects/:id", requireAuth, async (req, res) => {
  const params = GetProjectParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [project] = await db
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
      url: projectsTable.url,
      environment: projectsTable.environment,
      description: projectsTable.description,
      auditTemplate: projectsTable.auditTemplate,
      techProfile: projectsTable.techProfile,
      createdById: projectsTable.createdById,
      createdByName: usersTable.name,
      createdAt: projectsTable.createdAt,
      auditCount: sql<number>`cast(count(distinct ${auditRunsTable.id}) as int)`,
      openBugCount: sql<number>`cast(count(distinct case when ${bugsTable.status} = 'open' then ${bugsTable.id} end) as int)`,
      lastAuditAt: sql<Date | null>`max(${auditRunsTable.createdAt})`,
    })
    .from(projectsTable)
    .leftJoin(usersTable, eq(projectsTable.createdById, usersTable.id))
    .leftJoin(auditRunsTable, eq(auditRunsTable.projectId, projectsTable.id))
    .leftJoin(bugsTable, eq(bugsTable.projectId, projectsTable.id))
    .where(eq(projectsTable.id, params.data.id))
    .groupBy(projectsTable.id, usersTable.name)
    .limit(1);

  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  res.json(projectRow(project as unknown as Record<string, unknown>));
});

router.patch("/projects/:id", requireAuth, async (req, res) => {
  const params = UpdateProjectParams.safeParse({ id: Number(req.params.id) });
  const body = UpdateProjectBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid request" }); return; }

  const updates: Record<string, unknown> = {};
  if (body.data.name) updates.name = body.data.name;
  if (body.data.url) updates.url = body.data.url;
  if (body.data.environment) updates.environment = body.data.environment;
  if (body.data.description !== undefined) updates.description = body.data.description;
  if ((body.data as Record<string, unknown>).auditTemplate) updates.auditTemplate = (body.data as Record<string, unknown>).auditTemplate;

  const [project] = await db.update(projectsTable).set(updates).where(eq(projectsTable.id, params.data.id)).returning();
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  res.json({ ...project, createdAt: project.createdAt.toISOString(), auditCount: 0, openBugCount: 0, lastAuditAt: null, createdByName: null });
});

router.delete("/projects/:id", requireAuth, async (req, res) => {
  const params = DeleteProjectParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(projectsTable).where(eq(projectsTable.id, params.data.id));
  res.status(204).send();
});

router.get("/projects/:id/stats", requireAuth, async (req, res) => {
  const params = GetProjectStatsParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const pid = params.data.id;

  const [auditStats] = await db
    .select({
      totalAudits: sql<number>`cast(count(*) as int)`,
      avgPerf: avg(auditRunsTable.performanceScore),
      avgAcc: avg(auditRunsTable.accessibilityScore),
      avgSeo: avg(auditRunsTable.seoScore),
      avgBp: avg(auditRunsTable.bestPracticesScore),
    })
    .from(auditRunsTable)
    .where(and(eq(auditRunsTable.projectId, pid), eq(auditRunsTable.status, "completed")));

  const [bugStats] = await db
    .select({
      totalBugs: sql<number>`cast(count(*) as int)`,
      openBugs: sql<number>`cast(count(case when ${bugsTable.status} = 'open' then 1 end) as int)`,
    })
    .from(bugsTable)
    .where(eq(bugsTable.projectId, pid));

  res.json({
    projectId: pid,
    totalAudits: auditStats?.totalAudits ?? 0,
    totalBugs: bugStats?.totalBugs ?? 0,
    openBugs: bugStats?.openBugs ?? 0,
    avgPerformanceScore: auditStats?.avgPerf ? Number(auditStats.avgPerf) : null,
    avgAccessibilityScore: auditStats?.avgAcc ? Number(auditStats.avgAcc) : null,
    avgSeoScore: auditStats?.avgSeo ? Number(auditStats.avgSeo) : null,
    avgBestPracticesScore: auditStats?.avgBp ? Number(auditStats.avgBp) : null,
  });
});

router.get("/projects/:id/health-score", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const [lastAudit] = await db.select()
    .from(auditRunsTable)
    .where(and(eq(auditRunsTable.projectId, id), eq(auditRunsTable.status, "completed")))
    .orderBy(desc(auditRunsTable.createdAt))
    .limit(1);

  const [bugCounts] = await db
    .select({
      openBugs: sql<number>`cast(count(case when ${bugsTable.status} = 'open' then 1 end) as int)`,
      criticalBugs: sql<number>`cast(count(case when ${bugsTable.severity} = 'critical' and ${bugsTable.status} = 'open' then 1 end) as int)`,
    })
    .from(bugsTable)
    .where(eq(bugsTable.projectId, id));

  const perf = lastAudit?.performanceScore ?? 70;
  const acc = lastAudit?.accessibilityScore ?? 70;
  const seo = lastAudit?.seoScore ?? 70;
  const bp = lastAudit?.bestPracticesScore ?? 70;
  const openBugs = bugCounts?.openBugs ?? 0;
  const criticalBugs = bugCounts?.criticalBugs ?? 0;

  const baseScore = (perf + acc + seo + bp) / 4;
  const bugPenalty = Math.min(openBugs * 2 + criticalBugs * 5, 30);
  const score = Math.max(0, Math.round(baseScore - bugPenalty));

  const status = score >= 90 ? "excellent" : score >= 75 ? "good" : score >= 60 ? "warning" : "critical";

  res.json({
    score,
    status,
    breakdown: {
      performance: lastAudit?.performanceScore ?? null,
      accessibility: lastAudit?.accessibilityScore ?? null,
      seo: lastAudit?.seoScore ?? null,
      bestPractices: lastAudit?.bestPracticesScore ?? null,
      openBugs,
      criticalBugs,
    },
  });
});

router.get("/projects/:id/tech-profile", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [project] = await db.select({ techProfile: projectsTable.techProfile }).from(projectsTable).where(eq(projectsTable.id, id)).limit(1);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  res.json(project.techProfile ?? { framework: null, frontendStack: null, backendStack: null, cms: null, database: null, notes: null });
});

router.put("/projects/:id/tech-profile", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { framework, frontendStack, backendStack, cms, database, notes } = req.body;
  const [updated] = await db.update(projectsTable)
    .set({ techProfile: { framework, frontendStack, backendStack, cms, database, notes } })
    .where(eq(projectsTable.id, id))
    .returning({ techProfile: projectsTable.techProfile });
  if (!updated) { res.status(404).json({ error: "Project not found" }); return; }
  res.json(updated.techProfile);
});

export default router;
