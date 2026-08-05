// ─── Website Crawler Engine ───────────────────────────────────────────────────
// BFS crawler: discovers all pages on a site, runs a full audit on each
// page concurrently (up to concurrencyLimit), and stores per-page results.
//
// Respects: maxPages, maxDepth, ignorePatterns, includePatterns,
//           robots.txt (User-agent: * Disallow parsing), sitemap.xml discovery.
//
// Filtered out: mailto:, tel:, javascript:, anchor-only (#), logout/admin URLs.
// Concurrency: configurable via crawlJobsTable.concurrencyLimit (default 3).

import { db } from "@workspace/db";
import { crawlJobsTable, crawlPagesTable, auditRunsTable, screenshotsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { auditExecutionService } from "./audit-execution-service";
import { withPage } from "./scanners/playwright-browser";

// ─── Simple semaphore for concurrency control ─────────────────────────────────

class Semaphore {
  private available: number;
  private readonly queue: Array<() => void> = [];

  constructor(limit: number) {
    this.available = Math.max(1, limit);
  }

  acquire(): Promise<void> {
    if (this.available > 0) {
      this.available--;
      return Promise.resolve();
    }
    return new Promise<void>(resolve => this.queue.push(resolve));
  }

  release(): void {
    const next = this.queue.shift();
    if (next) { next(); } else { this.available++; }
  }
}

// ─── robots.txt parser (User-agent: * Disallow only) ─────────────────────────

async function fetchDisallowedPaths(baseUrl: string): Promise<string[]> {
  try {
    const r = await fetch(`${baseUrl}/robots.txt`, { signal: AbortSignal.timeout(6000) });
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
    for (const m of text.matchAll(/<loc>(.*?)<\/loc>/g)) {
      const u = m[1]?.trim();
      if (u) urls.push(u);
    }
  } catch { /* ignore */ }
  return urls;
}

// ─── URL sanity filter ────────────────────────────────────────────────────────

const SKIP_SCHEMES = /^(mailto:|tel:|javascript:|data:|ftp:|file:)/i;
const SKIP_PATH_SEGMENTS = /(\/logout|\/sign-out|\/signout|\/wp-admin|\/admin\/|\/wp-login|\/account\/delete)/i;

function shouldSkipUrl(url: string): boolean {
  if (SKIP_SCHEMES.test(url)) return true;
  if (url.startsWith("#")) return true;
  try {
    const u = new URL(url);
    if (u.hash && !u.pathname && !u.search) return true; // anchor-only
    if (SKIP_PATH_SEGMENTS.test(u.pathname)) return true;
  } catch {
    return true; // unparseable
  }
  return false;
}

function normalizeUrl(raw: string): string {
  return raw.split("#")[0].replace(/\/$/, "") || raw;
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
          .filter((h) => Boolean(h));
      }, baseOrigin);
      return [...new Set(hrefs.filter(h => h.startsWith(baseOrigin)))];
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

// ─── Single page audit + storage ─────────────────────────────────────────────

async function auditOnePage(
  crawlJobId: number,
  projectId: number,
  pageRow: { id: number },
  url: string,
): Promise<{
  auditRunId: number | null;
  overall: number | null;
  perf: number | null;
  a11y: number | null;
  seo: number | null;
  bp: number | null;
  sec: number | null;
}> {
  const [auditRun] = await db.insert(auditRunsTable).values({
    projectId,
    status: "pending",
    bugsFound: 0,
  }).returning();

  // Run audit synchronously — we need results before continuing
  await auditExecutionService.execute(auditRun.id, url);

  // Fetch completed result
  const [completed] = await db.select().from(auditRunsTable)
    .where(eq(auditRunsTable.id, auditRun.id)).limit(1);

  const overall = completed?.overallScore ?? null;
  const perf    = completed?.performanceScore ?? null;
  const a11y    = completed?.accessibilityScore ?? null;
  const seo     = completed?.seoScore ?? null;
  const bp      = completed?.bestPracticesScore ?? null;

  // Extract security score from findings JSONB
  const findings = completed?.findings as Record<string, unknown> | null;
  const secData  = findings?.security as { score?: number } | null;
  const sec      = secData?.score ?? null;

  // Extract page metadata from SEO findings
  const seoData  = findings?.seo as Record<string, unknown> | null;
  const metaTags = seoData?.metaTags as Record<string, unknown> | null;
  const headings = seoData?.headingStructure as Record<string, unknown> | null;

  await db.update(crawlPagesTable).set({
    status:             "completed",
    auditRunId:         auditRun.id,
    overallScore:       overall,
    performanceScore:   perf,
    accessibilityScore: a11y,
    seoScore:           seo,
    bestPracticesScore: bp,
    securityScore:      sec,
    pageTitle:          (metaTags?.title as string) ?? null,
    metaDescription:    (metaTags?.description as string) ?? null,
    h1Count:            (headings?.h1Count as number) ?? null,
    completedAt:        new Date(),
  }).where(eq(crawlPagesTable.id, pageRow.id));

  // Link screenshots to this crawl page
  await db.update(screenshotsTable)
    .set({ crawlPageId: pageRow.id })
    .where(eq(screenshotsTable.auditRunId, auditRun.id));

  return { auditRunId: auditRun.id, overall, perf, a11y, seo, bp, sec };
}

// ─── Main crawl runner ────────────────────────────────────────────────────────

export async function runCrawlJob(crawlJobId: number): Promise<void> {
  const [job] = await db.select().from(crawlJobsTable)
    .where(eq(crawlJobsTable.id, crawlJobId)).limit(1);
  if (!job) throw new Error(`Crawl job ${crawlJobId} not found`);

  logger.info({ crawlJobId, url: job.startUrl }, "Crawl job started");

  await db.update(crawlJobsTable)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(crawlJobsTable.id, crawlJobId));

  try {
    const baseOrigin       = new URL(job.startUrl).origin;
    const ignorePatterns   = (job.ignorePatterns as string[]) ?? [];
    const includePatterns  = (job.includePatterns as string[]) ?? [];
    const concurrencyLimit = job.concurrencyLimit ?? 3;
    const sem              = new Semaphore(concurrencyLimit);

    // robots.txt
    const disallowed = job.respectRobotsTxt ? await fetchDisallowedPaths(baseOrigin) : [];

    // Sitemap discovery
    const sitemapUrls = job.discoverSitemap ? await fetchSitemapUrls(baseOrigin) : [];

    // BFS queue
    const visited = new Set<string>();
    const queue: Array<{ url: string; depth: number }> = [{ url: job.startUrl, depth: 0 }];

    for (const u of sitemapUrls) {
      if (u.startsWith(baseOrigin)) queue.push({ url: u, depth: 1 });
    }

    let pagesDiscovered = 0;
    let pagesAudited    = 0;
    let pagesFailed     = 0;

    const scores:    number[] = [];
    const perfSc:    number[] = [];
    const a11ySc:    number[] = [];
    const seoSc:     number[] = [];
    const secSc:     number[] = [];

    // Active audit promises (concurrency window)
    const inflight: Array<Promise<void>> = [];

    const processPage = async (item: { url: string; depth: number }): Promise<void> => {
      await sem.acquire();
      try {
        const normalizedUrl = normalizeUrl(item.url);

        // Cancel check: another concurrent task may have already visited
        if (visited.has(normalizedUrl)) return;
        visited.add(normalizedUrl);

        // Skip filtered URLs
        if (shouldSkipUrl(normalizedUrl)) return;
        if (ignorePatterns.length > 0 && matchesAny(normalizedUrl, ignorePatterns)) return;
        if (includePatterns.length > 0 && !matchesAny(normalizedUrl, includePatterns)) return;
        if (disallowed.some(d => d !== "/" && new URL(normalizedUrl).pathname.startsWith(d))) return;

        pagesDiscovered++;

        const [pageRow] = await db.insert(crawlPagesTable).values({
          crawlJobId,
          url:      normalizedUrl,
          depth:    item.depth,
          status:   "running",
          startedAt: new Date(),
        }).returning();

        try {
          const result = await auditOnePage(crawlJobId, job.projectId, pageRow, normalizedUrl);
          if (result.overall != null) scores.push(result.overall);
          if (result.perf   != null) perfSc.push(result.perf);
          if (result.a11y   != null) a11ySc.push(result.a11y);
          if (result.seo    != null) seoSc.push(result.seo);
          if (result.sec    != null) secSc.push(result.sec);
          pagesAudited++;

          // Discover more links only if we haven't hit depth limit
          if (item.depth < job.maxDepth && pagesDiscovered < job.maxPages) {
            const links = await extractLinks(normalizedUrl, baseOrigin);
            for (const link of links) {
              const norm = normalizeUrl(link);
              if (!visited.has(norm) && pagesDiscovered + inflight.length < job.maxPages) {
                const child = { url: norm, depth: item.depth + 1 };
                const p = processPage(child).finally(() => {
                  const idx = inflight.indexOf(p);
                  if (idx !== -1) inflight.splice(idx, 1);
                });
                inflight.push(p);
              }
            }
          }
        } catch (err) {
          pagesFailed++;
          await db.update(crawlPagesTable).set({
            status:       "failed",
            errorMessage: err instanceof Error ? err.message : String(err),
            completedAt:  new Date(),
          }).where(eq(crawlPagesTable.id, pageRow.id));
          logger.warn({ crawlJobId, url: normalizedUrl, err }, "Crawl: page audit failed");
        }
      } finally {
        sem.release();
        // Update job progress
        await db.update(crawlJobsTable).set({
          pagesDiscovered,
          pagesAudited,
          pagesFailed,
        }).where(eq(crawlJobsTable.id, crawlJobId)).catch(() => {});
      }
    };

    // Drain the initial BFS queue within maxPages
    while (queue.length > 0 && pagesDiscovered < job.maxPages) {
      const item = queue.shift()!;
      const norm = normalizeUrl(item.url);
      if (visited.has(norm)) continue;

      const p = processPage(item).finally(() => {
        const idx = inflight.indexOf(p);
        if (idx !== -1) inflight.splice(idx, 1);
      });
      inflight.push(p);

      // Throttle: wait if we've hit the concurrency limit
      if (inflight.length >= concurrencyLimit) {
        await Promise.race(inflight);
      }
    }

    // Drain all in-flight audits — including promises added dynamically during
    // page processing. Promise.all(inflight) would only wait for items in the
    // array at call time; inflight grows as child pages are discovered, so we
    // loop until every promise (including newly-enqueued children) has settled.
    while (inflight.length > 0) {
      await Promise.race(inflight);
    }

    const avg = (arr: number[]) =>
      arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

    await db.update(crawlJobsTable).set({
      status:          "completed",
      completedAt:     new Date(),
      pagesDiscovered,
      pagesAudited,
      pagesFailed,
      overallScore:    avg(scores),
      avgPerformance:  avg(perfSc),
      avgAccessibility: avg(a11ySc),
      avgSeo:          avg(seoSc),
      avgSecurity:     avg(secSc),
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
