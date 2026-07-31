// ─── Website Crawler Engine ───────────────────────────────────────────────────
// BFS crawler: discovers all pages on a site, runs a full audit on each,
// and stores per-page results in crawlPagesTable.
//
// Respects: maxPages, maxDepth, ignorePatterns, includePatterns,
//           robots.txt (simple User-agent: * Disallow parsing), sitemap.xml discovery.

import { db } from "@workspace/db";
import { crawlJobsTable, crawlPagesTable, auditRunsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { runPlaywrightAudit } from "./audit-engine";
import { withPage } from "./scanners/playwright-browser";

// ─── robots.txt parser (minimal) ─────────────────────────────────────────────

async function fetchDisallowedPaths(baseUrl: string): Promise<string[]> {
  try {
    const r = await fetch(`${baseUrl}/robots.txt`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return [];
    const text = await r.text();
    const disallowed: string[] = [];
    let inUserAgentAll = false;
    for (const line of text.split("\n")) {
      const l = line.trim();
      if (l.toLowerCase().startsWith("user-agent:")) {
        inUserAgentAll = l.includes("*");
      } else if (inUserAgentAll && l.toLowerCase().startsWith("disallow:")) {
        const path = l.split(":")[1]?.trim();
        if (path) disallowed.push(path);
      }
    }
    return disallowed;
  } catch {
    return [];
  }
}

// ─── sitemap.xml URL discovery ────────────────────────────────────────────────

async function fetchSitemapUrls(baseUrl: string): Promise<string[]> {
  const urls: string[] = [];
  try {
    const r = await fetch(`${baseUrl}/sitemap.xml`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return urls;
    const text = await r.text();
    const matches = text.matchAll(/<loc>(.*?)<\/loc>/g);
    for (const m of matches) {
      const u = m[1]?.trim();
      if (u) urls.push(u);
    }
  } catch { /* ignore */ }
  return urls;
}

// ─── Link extraction via Playwright ──────────────────────────────────────────

async function extractLinks(pageUrl: string, baseOrigin: string): Promise<string[]> {
  try {
    return await withPage(async (page) => {
      await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
      const hrefs: string[] = await page.evaluate((origin) => {
        return Array.from(document.querySelectorAll("a[href]"))
          .map((a) => {
            try { return new URL((a as HTMLAnchorElement).href, origin).href; }
            catch { return ""; }
          })
          .filter((h) => h.startsWith(origin));
      }, baseOrigin);
      return [...new Set(hrefs)];
    }, { timeoutMs: 30000 });
  } catch {
    return [];
  }
}

// ─── Pattern matching ─────────────────────────────────────────────────────────

function matchesAny(url: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    try {
      if (new RegExp(pattern).test(url)) return true;
    } catch {
      if (url.includes(pattern)) return true;
    }
  }
  return false;
}

// ─── Main crawl runner ────────────────────────────────────────────────────────

export async function runCrawlJob(crawlJobId: number): Promise<void> {
  const [job] = await db.select().from(crawlJobsTable).where(eq(crawlJobsTable.id, crawlJobId)).limit(1);
  if (!job) throw new Error(`Crawl job ${crawlJobId} not found`);

  logger.info({ crawlJobId, url: job.startUrl }, "Crawl job started");

  await db.update(crawlJobsTable).set({ status: "running", startedAt: new Date() })
    .where(eq(crawlJobsTable.id, crawlJobId));

  try {
    const baseOrigin = new URL(job.startUrl).origin;
    const ignorePatterns = (job.ignorePatterns as string[]) ?? [];
    const includePatterns = (job.includePatterns as string[]) ?? [];

    // robots.txt
    const disallowed = job.respectRobotsTxt ? await fetchDisallowedPaths(baseOrigin) : [];

    // Sitemap discovery
    const sitemapUrls: string[] = job.discoverSitemap ? await fetchSitemapUrls(baseOrigin) : [];

    // BFS queue
    const visited = new Set<string>();
    const queue: Array<{ url: string; depth: number }> = [{ url: job.startUrl, depth: 0 }];

    // Seed from sitemap
    for (const u of sitemapUrls) {
      if (u.startsWith(baseOrigin)) queue.push({ url: u, depth: 1 });
    }

    let pagesDiscovered = 0;
    let pagesAudited = 0;
    let pagesFailed = 0;
    const scores: number[] = [];
    const perfScores: number[] = [];
    const a11yScores: number[] = [];
    const seoScores: number[] = [];
    const secScores: number[] = [];

    while (queue.length > 0 && pagesDiscovered < job.maxPages) {
      const item = queue.shift()!;
      const normalizedUrl = item.url.split("#")[0].replace(/\/$/, "") || item.url;

      if (visited.has(normalizedUrl)) continue;
      visited.add(normalizedUrl);

      // Pattern filters
      if (ignorePatterns.length > 0 && matchesAny(normalizedUrl, ignorePatterns)) continue;
      if (includePatterns.length > 0 && !matchesAny(normalizedUrl, includePatterns)) continue;

      // robots.txt filter
      if (disallowed.some((d) => d !== "/" && new URL(normalizedUrl).pathname.startsWith(d))) continue;

      pagesDiscovered++;

      // Create page row
      const [pageRow] = await db.insert(crawlPagesTable).values({
        crawlJobId,
        url: normalizedUrl,
        depth: item.depth,
        status: "running",
        startedAt: new Date(),
      }).returning();

      // Run the full audit on this page
      try {
        const [auditRun] = await db.insert(auditRunsTable).values({
          projectId: job.projectId,
          status:    "pending",
          bugsFound: 0,
        }).returning();

        // Run audit synchronously (we need results before continuing)
        await runPlaywrightAudit(auditRun.id, normalizedUrl);

        // Fetch the completed audit run
        const [completedRun] = await db.select().from(auditRunsTable)
          .where(eq(auditRunsTable.id, auditRun.id)).limit(1);

        const overall = completedRun?.overallScore ?? null;
        const perf    = completedRun?.performanceScore ?? null;
        const a11y    = completedRun?.accessibilityScore ?? null;
        const seo     = completedRun?.seoScore ?? null;

        // Extract metadata from findings
        const findings = completedRun?.findings as Record<string, unknown> | null;
        const seoData  = findings?.seo as Record<string, unknown> | null;
        const metaTags = seoData?.metaTags as Record<string, unknown> | null;
        const headings = seoData?.headingStructure as Record<string, unknown> | null;

        await db.update(crawlPagesTable).set({
          status:          "completed",
          auditRunId:      auditRun.id,
          overallScore:    overall,
          performanceScore: perf,
          accessibilityScore: a11y,
          seoScore:        seo,
          pageTitle:       (metaTags?.title as string) ?? null,
          metaDescription: (metaTags?.description as string) ?? null,
          h1Count:         (headings?.h1Count as number) ?? null,
          completedAt:     new Date(),
        }).where(eq(crawlPagesTable.id, pageRow.id));

        if (overall != null) scores.push(overall);
        if (perf != null) perfScores.push(perf);
        if (a11y != null) a11yScores.push(a11y);
        if (seo != null) seoScores.push(seo);
        if (completedRun?.bestPracticesScore != null) secScores.push(completedRun.bestPracticesScore);
        pagesAudited++;

        // Discover more links (only if we haven't hit depth limit)
        if (item.depth < job.maxDepth) {
          const links = await extractLinks(normalizedUrl, baseOrigin);
          for (const link of links) {
            const norm = link.split("#")[0].replace(/\/$/, "") || link;
            if (!visited.has(norm)) {
              queue.push({ url: norm, depth: item.depth + 1 });
            }
          }
        }
      } catch (err) {
        pagesFailed++;
        await db.update(crawlPagesTable).set({
          status:      "failed",
          errorMessage: err instanceof Error ? err.message : String(err),
          completedAt: new Date(),
        }).where(eq(crawlPagesTable.id, pageRow.id));
        logger.warn({ crawlJobId, url: normalizedUrl, err }, "Crawl: page audit failed");
      }

      // Update job progress
      await db.update(crawlJobsTable).set({
        pagesDiscovered,
        pagesAudited,
        pagesFailed,
      }).where(eq(crawlJobsTable.id, crawlJobId));
    }

    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

    await db.update(crawlJobsTable).set({
      status:          "completed",
      completedAt:     new Date(),
      pagesDiscovered,
      pagesAudited,
      pagesFailed,
      overallScore:    avg(scores),
      avgPerformance:  avg(perfScores),
      avgAccessibility: avg(a11yScores),
      avgSeo:          avg(seoScores),
    }).where(eq(crawlJobsTable.id, crawlJobId));

    logger.info({ crawlJobId, pagesAudited, pagesDiscovered }, "Crawl job completed");
  } catch (err) {
    await db.update(crawlJobsTable).set({
      status:       "failed",
      completedAt:  new Date(),
      errorMessage: err instanceof Error ? err.message : String(err),
    }).where(eq(crawlJobsTable.id, crawlJobId));
    logger.error({ crawlJobId, err }, "Crawl job failed");
    throw err;
  }
}
