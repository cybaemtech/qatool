import { Router } from "express";
import { db } from "@workspace/db";
import { crawlJobsTable, crawlPagesTable, projectsTable, screenshotsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { runCrawlJob } from "../lib/crawler-engine";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatJob(j: Record<string, unknown>) {
  return {
    ...j,
    startedAt:   j.startedAt   instanceof Date ? j.startedAt.toISOString()   : j.startedAt,
    completedAt: j.completedAt instanceof Date ? j.completedAt.toISOString() : j.completedAt,
    createdAt:   j.createdAt   instanceof Date ? j.createdAt.toISOString()   : j.createdAt,
  };
}

function formatPage(p: Record<string, unknown>) {
  return {
    ...p,
    startedAt:   p.startedAt   instanceof Date ? p.startedAt.toISOString()   : p.startedAt,
    completedAt: p.completedAt instanceof Date ? p.completedAt.toISOString() : p.completedAt,
    createdAt:   p.createdAt   instanceof Date ? p.createdAt.toISOString()   : p.createdAt,
  };
}

const JOB_SELECT = {
  id:               crawlJobsTable.id,
  projectId:        crawlJobsTable.projectId,
  projectName:      projectsTable.name,
  createdById:      crawlJobsTable.createdById,
  startUrl:         crawlJobsTable.startUrl,
  maxPages:         crawlJobsTable.maxPages,
  maxDepth:         crawlJobsTable.maxDepth,
  concurrencyLimit: crawlJobsTable.concurrencyLimit,
  respectRobotsTxt: crawlJobsTable.respectRobotsTxt,
  discoverSitemap:  crawlJobsTable.discoverSitemap,
  status:           crawlJobsTable.status,
  startedAt:        crawlJobsTable.startedAt,
  completedAt:      crawlJobsTable.completedAt,
  errorMessage:     crawlJobsTable.errorMessage,
  pagesDiscovered:  crawlJobsTable.pagesDiscovered,
  pagesAudited:     crawlJobsTable.pagesAudited,
  pagesFailed:      crawlJobsTable.pagesFailed,
  overallScore:     crawlJobsTable.overallScore,
  avgPerformance:   crawlJobsTable.avgPerformance,
  avgAccessibility: crawlJobsTable.avgAccessibility,
  avgSeo:           crawlJobsTable.avgSeo,
  avgSecurity:      crawlJobsTable.avgSecurity,
  createdAt:        crawlJobsTable.createdAt,
};

// ─── GET /crawl-jobs ──────────────────────────────────────────────────────────
router.get("/crawl-jobs", requireAuth, async (req, res) => {
  const projectId   = req.query.projectId  ? Number(req.query.projectId)  : undefined;
  const auditRunId  = req.query.auditRunId ? Number(req.query.auditRunId) : undefined;

  // If looking up via auditRunId — find which crawl job contains it
  if (auditRunId) {
    const [page] = await db.select({ crawlJobId: crawlPagesTable.crawlJobId })
      .from(crawlPagesTable)
      .where(eq(crawlPagesTable.auditRunId, auditRunId))
      .limit(1);
    if (!page) { res.json([]); return; }

    const rows = await db
      .select(JOB_SELECT)
      .from(crawlJobsTable)
      .leftJoin(projectsTable, eq(crawlJobsTable.projectId, projectsTable.id))
      .where(eq(crawlJobsTable.id, page.crawlJobId))
      .limit(1);
    res.json(rows.map(r => formatJob(r as unknown as Record<string, unknown>)));
    return;
  }

  const rows = await db
    .select(JOB_SELECT)
    .from(crawlJobsTable)
    .leftJoin(projectsTable, eq(crawlJobsTable.projectId, projectsTable.id))
    .where(projectId ? eq(crawlJobsTable.projectId, projectId) : undefined)
    .orderBy(crawlJobsTable.createdAt);

  res.json(rows.map(r => formatJob(r as unknown as Record<string, unknown>)));
});

// ─── POST /crawl-jobs ─────────────────────────────────────────────────────────
router.post("/crawl-jobs", requireAuth, async (req, res) => {
  const { projectId, startUrl, maxPages, maxDepth, concurrencyLimit, respectRobotsTxt, discoverSitemap } = req.body;
  if (!projectId || !startUrl) {
    res.status(400).json({ error: "projectId and startUrl are required" });
    return;
  }

  const [job] = await db.insert(crawlJobsTable).values({
    projectId:        Number(projectId),
    createdById:      req.user!.userId,
    startUrl,
    maxPages:         maxPages           !== undefined ? Number(maxPages)           : 50,
    maxDepth:         maxDepth           !== undefined ? Number(maxDepth)           : 3,
    concurrencyLimit: concurrencyLimit   !== undefined ? Number(concurrencyLimit)   : 3,
    respectRobotsTxt: respectRobotsTxt   !== undefined ? Boolean(respectRobotsTxt)  : true,
    discoverSitemap:  discoverSitemap    !== undefined ? Boolean(discoverSitemap)   : true,
    status:           "pending",
  }).returning();

  // Run crawl in background
  runCrawlJob(job.id).catch(() => {});

  const [withProject] = await db
    .select(JOB_SELECT)
    .from(crawlJobsTable)
    .leftJoin(projectsTable, eq(crawlJobsTable.projectId, projectsTable.id))
    .where(eq(crawlJobsTable.id, job.id))
    .limit(1);

  res.status(201).json(formatJob(withProject as unknown as Record<string, unknown>));
});

// ─── GET /crawl-jobs/:id ──────────────────────────────────────────────────────
router.get("/crawl-jobs/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db
    .select(JOB_SELECT)
    .from(crawlJobsTable)
    .leftJoin(projectsTable, eq(crawlJobsTable.projectId, projectsTable.id))
    .where(eq(crawlJobsTable.id, id))
    .limit(1);

  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatJob(row as unknown as Record<string, unknown>));
});

// ─── DELETE /crawl-jobs/:id ───────────────────────────────────────────────────
router.delete("/crawl-jobs/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(crawlJobsTable).where(eq(crawlJobsTable.id, id));
  res.status(204).send();
});

// ─── GET /crawl-jobs/:id/pages ────────────────────────────────────────────────
router.get("/crawl-jobs/:id/pages", requireAuth, async (req, res) => {
  const crawlJobId = Number(req.params.id);
  const rows = await db
    .select()
    .from(crawlPagesTable)
    .where(eq(crawlPagesTable.crawlJobId, crawlJobId))
    .orderBy(crawlPagesTable.depth, crawlPagesTable.createdAt);

  res.json(rows.map(p => formatPage(p as unknown as Record<string, unknown>)));
});

// ─── GET /crawl-jobs/:id/progress ────────────────────────────────────────────
// Lightweight polling endpoint — returns live counters for progress display.
router.get("/crawl-jobs/:id/progress", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [job] = await db
    .select({
      status:          crawlJobsTable.status,
      pagesDiscovered: crawlJobsTable.pagesDiscovered,
      pagesAudited:    crawlJobsTable.pagesAudited,
      pagesFailed:     crawlJobsTable.pagesFailed,
      maxPages:        crawlJobsTable.maxPages,
      startedAt:       crawlJobsTable.startedAt,
      completedAt:     crawlJobsTable.completedAt,
    })
    .from(crawlJobsTable)
    .where(eq(crawlJobsTable.id, id))
    .limit(1);

  if (!job) { res.status(404).json({ error: "Not found" }); return; }
  res.json({
    status:          job.status,
    pagesDiscovered: job.pagesDiscovered,
    pagesAudited:    job.pagesAudited,
    pagesFailed:     job.pagesFailed,
    maxPages:        job.maxPages,
    startedAt:       job.startedAt instanceof Date ? job.startedAt.toISOString() : job.startedAt,
    completedAt:     job.completedAt instanceof Date ? job.completedAt.toISOString() : job.completedAt,
    percentComplete: job.pagesDiscovered > 0
      ? Math.round((job.pagesAudited + job.pagesFailed) / job.pagesDiscovered * 100)
      : 0,
  });
});

// ─── GET /crawl-jobs/:id/screenshots ─────────────────────────────────────────
// Returns screenshots for all pages of a crawl job.
// Optional query params: pageId (crawlPageId), deviceType
router.get("/crawl-jobs/:id/screenshots", requireAuth, async (req, res) => {
  const crawlJobId = Number(req.params.id);
  const crawlPageId = req.query.pageId  ? Number(req.query.pageId)  : undefined;
  const deviceType  = req.query.deviceType as string | undefined;

  // Find all pages for this job (optionally filtered)
  const pages = await db
    .select({ id: crawlPagesTable.id, auditRunId: crawlPagesTable.auditRunId })
    .from(crawlPagesTable)
    .where(
      crawlPageId
        ? and(eq(crawlPagesTable.crawlJobId, crawlJobId), eq(crawlPagesTable.id, crawlPageId))
        : eq(crawlPagesTable.crawlJobId, crawlJobId),
    );

  if (!pages.length) { res.json([]); return; }

  const auditRunIds = pages.map(p => p.auditRunId).filter((id): id is number => id != null);
  if (!auditRunIds.length) { res.json([]); return; }

  let conditions = inArray(screenshotsTable.auditRunId, auditRunIds);
  if (deviceType && ["desktop", "tablet", "mobile"].includes(deviceType)) {
    conditions = and(conditions, eq(screenshotsTable.deviceType, deviceType as "desktop" | "tablet" | "mobile"))!;
  }

  const screenshots = await db.select().from(screenshotsTable).where(conditions);

  // Build a pageId map: auditRunId → crawlPageId
  const auditToPage = new Map<number, number>();
  for (const p of pages) {
    if (p.auditRunId != null) auditToPage.set(p.auditRunId, p.id);
  }

  res.json(screenshots.map(s => ({
    ...s,
    crawlPageId: auditToPage.get(s.auditRunId) ?? s.crawlPageId,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
  })));
});

export default router;
