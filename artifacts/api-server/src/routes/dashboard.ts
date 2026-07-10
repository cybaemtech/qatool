import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, auditRunsTable, bugsTable } from "@workspace/db";
import { eq, sql, avg, desc, gte, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/dashboard/summary", requireAuth, async (_req, res) => {
  const [projects] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(projectsTable);
  const [audits] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(auditRunsTable);
  const [bugs] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(bugsTable);
  const [critical] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(bugsTable)
    .where(and(eq(bugsTable.severity, "critical"), eq(bugsTable.status, "open")));
  const [perf] = await db.select({ avg: avg(auditRunsTable.performanceScore) }).from(auditRunsTable)
    .where(eq(auditRunsTable.status, "completed"));

  res.json({
    totalProjects: projects?.count ?? 0,
    totalAudits: audits?.count ?? 0,
    totalBugs: bugs?.count ?? 0,
    criticalIssues: critical?.count ?? 0,
    avgPerformanceScore: perf?.avg ? Number(perf.avg) : null,
  });
});

router.get("/dashboard/audit-trends", requireAuth, async (_req, res) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const trends = await db
    .select({
      date: sql<string>`to_char(date_trunc('day', ${auditRunsTable.createdAt}), 'YYYY-MM-DD')`,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(auditRunsTable)
    .where(gte(auditRunsTable.createdAt, thirtyDaysAgo))
    .groupBy(sql`date_trunc('day', ${auditRunsTable.createdAt})`)
    .orderBy(sql`date_trunc('day', ${auditRunsTable.createdAt})`);

  res.json(trends);
});

router.get("/dashboard/bug-severity", requireAuth, async (_req, res) => {
  const distribution = await db
    .select({
      severity: bugsTable.severity,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(bugsTable)
    .groupBy(bugsTable.severity);

  res.json(distribution);
});

router.get("/dashboard/performance-history", requireAuth, async (req, res) => {
  const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const conditions = [gte(auditRunsTable.createdAt, thirtyDaysAgo), eq(auditRunsTable.status, "completed")];
  if (projectId) conditions.push(eq(auditRunsTable.projectId, projectId));

  const history = await db
    .select({
      date: sql<string>`to_char(date_trunc('day', ${auditRunsTable.createdAt}), 'YYYY-MM-DD')`,
      performance: sql<number | null>`avg(${auditRunsTable.performanceScore})`,
      accessibility: sql<number | null>`avg(${auditRunsTable.accessibilityScore})`,
      seo: sql<number | null>`avg(${auditRunsTable.seoScore})`,
      bestPractices: sql<number | null>`avg(${auditRunsTable.bestPracticesScore})`,
    })
    .from(auditRunsTable)
    .where(and(...conditions))
    .groupBy(sql`date_trunc('day', ${auditRunsTable.createdAt})`)
    .orderBy(sql`date_trunc('day', ${auditRunsTable.createdAt})`);

  res.json(history.map(h => ({
    date: h.date,
    performance: h.performance != null ? Number(h.performance) : null,
    accessibility: h.accessibility != null ? Number(h.accessibility) : null,
    seo: h.seo != null ? Number(h.seo) : null,
    bestPractices: h.bestPractices != null ? Number(h.bestPractices) : null,
  })));
});

router.get("/dashboard/recent-activity", requireAuth, async (_req, res) => {
  const recentAudits = await db
    .select({
      id: auditRunsTable.id,
      type: sql<string>`case when ${auditRunsTable.status} = 'completed' then 'audit_completed' else 'audit_failed' end`,
      title: sql<string>`'Audit ' || ${auditRunsTable.status}`,
      description: sql<string>`'Audit run for project: ' || coalesce(${projectsTable.name}, 'Unknown')`,
      projectId: auditRunsTable.projectId,
      projectName: projectsTable.name,
      severity: sql<string | null>`null`,
      createdAt: auditRunsTable.createdAt,
    })
    .from(auditRunsTable)
    .leftJoin(projectsTable, eq(auditRunsTable.projectId, projectsTable.id))
    .where(sql`${auditRunsTable.status} IN ('completed', 'failed')`)
    .orderBy(desc(auditRunsTable.createdAt))
    .limit(5);

  const recentBugs = await db
    .select({
      id: bugsTable.id,
      type: sql<string>`'bug_found'`,
      title: sql<string>`'Bug found: ' || ${bugsTable.title}`,
      description: sql<string>`coalesce(${bugsTable.description}, 'New bug detected')`,
      projectId: bugsTable.projectId,
      projectName: projectsTable.name,
      severity: bugsTable.severity,
      createdAt: bugsTable.createdAt,
    })
    .from(bugsTable)
    .leftJoin(projectsTable, eq(bugsTable.projectId, projectsTable.id))
    .orderBy(desc(bugsTable.createdAt))
    .limit(5);

  const activity = [
    ...recentAudits.map(a => ({ ...a, createdAt: a.createdAt.toISOString() })),
    ...recentBugs.map(b => ({ ...b, createdAt: b.createdAt.toISOString() })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);

  res.json(activity);
});

export default router;
