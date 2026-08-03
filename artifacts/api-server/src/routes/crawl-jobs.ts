import { Router } from "express";
import { db } from "@workspace/db";
import { crawlJobsTable, crawlPagesTable, projectsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { runCrawlJob } from "../lib/crawler-engine";

const router = Router();

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

// GET /crawl-jobs
router.get("/crawl-jobs", requireAuth, async (req, res) => {
  const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
  const rows = await db
    .select({
      id:              crawlJobsTable.id,
      projectId:       crawlJobsTable.projectId,
      projectName:     projectsTable.name,
      createdById:     crawlJobsTable.createdById,
      startUrl:        crawlJobsTable.startUrl,
      maxPages:        crawlJobsTable.maxPages,
      maxDepth:        crawlJobsTable.maxDepth,
      respectRobotsTxt: crawlJobsTable.respectRobotsTxt,
      discoverSitemap: crawlJobsTable.discoverSitemap,
      status:          crawlJobsTable.status,
      startedAt:       crawlJobsTable.startedAt,
      completedAt:     crawlJobsTable.completedAt,
      errorMessage:    crawlJobsTable.errorMessage,
      pagesDiscovered: crawlJobsTable.pagesDiscovered,
      pagesAudited:    crawlJobsTable.pagesAudited,
      pagesFailed:     crawlJobsTable.pagesFailed,
      overallScore:    crawlJobsTable.overallScore,
      avgPerformance:  crawlJobsTable.avgPerformance,
      avgAccessibility: crawlJobsTable.avgAccessibility,
      avgSeo:          crawlJobsTable.avgSeo,
      avgSecurity:     crawlJobsTable.avgSecurity,
      createdAt:       crawlJobsTable.createdAt,
    })
    .from(crawlJobsTable)
    .leftJoin(projectsTable, eq(crawlJobsTable.projectId, projectsTable.id))
    .where(projectId ? eq(crawlJobsTable.projectId, projectId) : undefined)
    .orderBy(crawlJobsTable.createdAt);

  res.json(rows.map(r => formatJob(r as unknown as Record<string, unknown>)));
});

// POST /crawl-jobs
router.post("/crawl-jobs", requireAuth, async (req, res) => {
  const { projectId, startUrl, maxPages, maxDepth, respectRobotsTxt, discoverSitemap } = req.body;
  if (!projectId || !startUrl) {
    res.status(400).json({ error: "projectId and startUrl are required" });
    return;
  }

  const [job] = await db.insert(crawlJobsTable).values({
    projectId:       Number(projectId),
    createdById:     req.user!.userId,
    startUrl,
    maxPages:        maxPages  !== undefined ? Number(maxPages)  : 50,
    maxDepth:        maxDepth  !== undefined ? Number(maxDepth)  : 3,
    respectRobotsTxt: respectRobotsTxt !== undefined ? Boolean(respectRobotsTxt) : true,
    discoverSitemap:  discoverSitemap  !== undefined ? Boolean(discoverSitemap)  : true,
    status:          "pending",
  }).returning();

  // Run crawl in background
  runCrawlJob(job.id).catch(() => {});

  const [withProject] = await db
    .select({
      id:              crawlJobsTable.id,
      projectId:       crawlJobsTable.projectId,
      projectName:     projectsTable.name,
      createdById:     crawlJobsTable.createdById,
      startUrl:        crawlJobsTable.startUrl,
      maxPages:        crawlJobsTable.maxPages,
      maxDepth:        crawlJobsTable.maxDepth,
      respectRobotsTxt: crawlJobsTable.respectRobotsTxt,
      discoverSitemap: crawlJobsTable.discoverSitemap,
      status:          crawlJobsTable.status,
      startedAt:       crawlJobsTable.startedAt,
      completedAt:     crawlJobsTable.completedAt,
      errorMessage:    crawlJobsTable.errorMessage,
      pagesDiscovered: crawlJobsTable.pagesDiscovered,
      pagesAudited:    crawlJobsTable.pagesAudited,
      pagesFailed:     crawlJobsTable.pagesFailed,
      overallScore:    crawlJobsTable.overallScore,
      avgPerformance:  crawlJobsTable.avgPerformance,
      avgAccessibility: crawlJobsTable.avgAccessibility,
      avgSeo:          crawlJobsTable.avgSeo,
      avgSecurity:     crawlJobsTable.avgSecurity,
      createdAt:       crawlJobsTable.createdAt,
    })
    .from(crawlJobsTable)
    .leftJoin(projectsTable, eq(crawlJobsTable.projectId, projectsTable.id))
    .where(eq(crawlJobsTable.id, job.id))
    .limit(1);

  res.status(201).json(formatJob(withProject as unknown as Record<string, unknown>));
});

// GET /crawl-jobs/:id
router.get("/crawl-jobs/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db
    .select({
      id:              crawlJobsTable.id,
      projectId:       crawlJobsTable.projectId,
      projectName:     projectsTable.name,
      createdById:     crawlJobsTable.createdById,
      startUrl:        crawlJobsTable.startUrl,
      maxPages:        crawlJobsTable.maxPages,
      maxDepth:        crawlJobsTable.maxDepth,
      respectRobotsTxt: crawlJobsTable.respectRobotsTxt,
      discoverSitemap: crawlJobsTable.discoverSitemap,
      status:          crawlJobsTable.status,
      startedAt:       crawlJobsTable.startedAt,
      completedAt:     crawlJobsTable.completedAt,
      errorMessage:    crawlJobsTable.errorMessage,
      pagesDiscovered: crawlJobsTable.pagesDiscovered,
      pagesAudited:    crawlJobsTable.pagesAudited,
      pagesFailed:     crawlJobsTable.pagesFailed,
      overallScore:    crawlJobsTable.overallScore,
      avgPerformance:  crawlJobsTable.avgPerformance,
      avgAccessibility: crawlJobsTable.avgAccessibility,
      avgSeo:          crawlJobsTable.avgSeo,
      avgSecurity:     crawlJobsTable.avgSecurity,
      createdAt:       crawlJobsTable.createdAt,
    })
    .from(crawlJobsTable)
    .leftJoin(projectsTable, eq(crawlJobsTable.projectId, projectsTable.id))
    .where(eq(crawlJobsTable.id, id))
    .limit(1);

  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatJob(row as unknown as Record<string, unknown>));
});

// DELETE /crawl-jobs/:id
router.delete("/crawl-jobs/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(crawlJobsTable).where(eq(crawlJobsTable.id, id));
  res.status(204).send();
});

// GET /crawl-jobs/:id/pages
router.get("/crawl-jobs/:id/pages", requireAuth, async (req, res) => {
  const crawlJobId = Number(req.params.id);
  const rows = await db
    .select()
    .from(crawlPagesTable)
    .where(eq(crawlPagesTable.crawlJobId, crawlJobId))
    .orderBy(crawlPagesTable.depth, crawlPagesTable.createdAt);

  res.json(rows.map(p => formatPage(p as unknown as Record<string, unknown>)));
});

export default router;
