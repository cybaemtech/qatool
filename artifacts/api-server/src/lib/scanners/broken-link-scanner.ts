// ─── Broken Link Scanner ──────────────────────────────────────────────────────
// Uses Playwright to extract all <a href> and <img src> links from the fully
// rendered DOM (handles JS-rendered pages), then HEAD-checks each URL
// concurrently. Reports total/internal/external counts, broken links,
// redirect chains, and broken images.

import type { AuditScanner, AuditContext, BrokenLinkResult } from "../audit-types";
import { withPage } from "./playwright-browser";

export interface BrokenLinkAdapter {
  crawl(url: string, options?: { maxLinks?: number; timeout?: number }): Promise<{
    links: Array<{
      url: string;
      statusCode: number;
      foundOn: string;
      linkText?: string;
      isExternal: boolean;
      isImage: boolean;
      redirectTo?: string;
    }>;
  }>;
}

// ─── Real crawler: Playwright extraction + concurrent HEAD checks ─────────────

const realBrokenLinkAdapter: BrokenLinkAdapter = {
  async crawl(pageUrl, options = {}) {
    const maxLinks = options.maxLinks ?? 60;
    const timeoutMs = options.timeout ?? 8000;
    const origin = new URL(pageUrl).origin;

    // ── Step 1: Navigate and extract links from rendered DOM via Playwright ───
    let rawLinks: Array<{ href: string; text: string; isImage: boolean }> = [];

    try {
      rawLinks = await withPage(async (page) => {
        await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
        // Wait for JS frameworks to render links
        await page.waitForTimeout(1500);

        return page.evaluate(() => {
          const results: Array<{ href: string; text: string; isImage: boolean }> = [];

          // Anchor links
          document.querySelectorAll("a[href]").forEach(el => {
            const href = el.getAttribute("href")?.trim();
            const text = (el.textContent ?? "").trim().slice(0, 100);
            if (href) results.push({ href, text, isImage: false });
          });

          // Image sources
          document.querySelectorAll("img[src]").forEach(el => {
            const src = el.getAttribute("src")?.trim();
            if (src) results.push({ href: src, text: el.getAttribute("alt") ?? "", isImage: true });
          });

          return results;
        });
      }, { timeoutMs: 35000 });
    } catch {
      // Playwright unavailable — fall back to fetch + static HTML parse
      try {
        const { load } = await import("cheerio");
        const res = await fetch(pageUrl, {
          signal: AbortSignal.timeout(15000),
          headers: { "User-Agent": "Mozilla/5.0 (compatible; QAPortalBot/1.0)", "Accept": "text/html,*/*" },
          redirect: "follow",
        });
        const html = await res.text();
        const $ = load(html);
        $("a[href]").each((_, el) => {
          const href = $(el).attr("href")?.trim();
          const text = ($(el).text() ?? "").trim().slice(0, 100);
          if (href) rawLinks.push({ href, text, isImage: false });
        });
        $("img[src]").each((_, el) => {
          const src = $(el).attr("src")?.trim();
          if (src) rawLinks.push({ href: src, text: $(el).attr("alt") ?? "", isImage: true });
        });
      } catch {
        return { links: [] };
      }
    }

    // ── Step 2: Resolve and de-duplicate URLs ────────────────────────────────
    const seen = new Set<string>();
    const resolved: Array<{ url: string; text: string; isExternal: boolean; isImage: boolean }> = [];

    for (const { href, text, isImage } of rawLinks) {
      if (resolved.length >= maxLinks) break;
      if (
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:") ||
        href.startsWith("data:")
      ) continue;

      let fullUrl: string;
      try {
        fullUrl = new URL(href, pageUrl).href;
      } catch {
        continue;
      }

      // Normalise hash fragments
      const urlKey = fullUrl.split("#")[0];
      if (seen.has(urlKey)) continue;
      seen.add(urlKey);

      resolved.push({
        url: fullUrl,
        text,
        isExternal: !fullUrl.startsWith(origin),
        isImage,
      });
    }

    // ── Step 3: HEAD-check each URL concurrently (batches of 10) ─────────────
    const CONCURRENCY = 10;
    const results: Array<{
      url: string;
      statusCode: number;
      foundOn: string;
      linkText?: string;
      isExternal: boolean;
      isImage: boolean;
      redirectTo?: string;
    }> = [];

    for (let i = 0; i < resolved.length; i += CONCURRENCY) {
      const batch = resolved.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async ({ url, text, isExternal, isImage }) => {
          try {
            // HEAD first (faster); fall back to GET with Range if HEAD fails
            let res: Response | null = null;
            try {
              res = await fetch(url, {
                method: "HEAD",
                signal: AbortSignal.timeout(timeoutMs),
                headers: { "User-Agent": "Mozilla/5.0 (compatible; QAPortalBot/1.0)" },
                redirect: "follow",
              });
            } catch {
              res = await fetch(url, {
                method: "GET",
                signal: AbortSignal.timeout(timeoutMs),
                headers: {
                  "User-Agent": "Mozilla/5.0 (compatible; QAPortalBot/1.0)",
                  "Range": "bytes=0-1",
                },
                redirect: "follow",
              });
            }

            const redirectTo = res.redirected && res.url !== url ? res.url : undefined;

            return { url, statusCode: res.status, foundOn: pageUrl, linkText: text || undefined, isExternal, isImage, redirectTo };
          } catch (err) {
            const isTimeout =
              err instanceof Error &&
              (err.name === "TimeoutError" || err.name === "AbortError");
            return {
              url,
              statusCode: isTimeout ? 0 : -1,
              foundOn: pageUrl,
              linkText: text || undefined,
              isExternal,
              isImage,
            };
          }
        }),
      );
      results.push(...batchResults);
    }

    return { links: results };
  },
};

class BrokenLinkScanner implements AuditScanner<BrokenLinkResult> {
  readonly name = "broken-links" as const;
  readonly description =
    "Playwright-based crawler: extracts all links and images from the rendered DOM, then HEAD-checks each URL for broken/redirected resources";
  readonly version = "3.0.0";
  readonly adapter = "playwright-extract-http-check";

  private crawlerAdapter: BrokenLinkAdapter;

  constructor(adapter: BrokenLinkAdapter = realBrokenLinkAdapter) {
    this.crawlerAdapter = adapter;
  }

  async run(context: AuditContext): Promise<BrokenLinkResult> {
    const startedAt = new Date();
    const maxLinks = context.options?.maxLinksToCheck ?? 60;

    try {
      const { links } = await this.crawlerAdapter.crawl(context.url, {
        maxLinks,
        timeout: 8000,
      });

      const anchorLinks = links.filter(l => !l.isImage);
      const imageLinks  = links.filter(l => l.isImage);

      const internalLinks = anchorLinks.filter(l => !l.isExternal).length;
      const externalLinks = anchorLinks.filter(l => l.isExternal).length;

      // Broken = 4xx, 5xx, network timeout (0), or connection error (-1)
      const brokenLinks: BrokenLinkResult["brokenLinks"] = anchorLinks
        .filter(l => l.statusCode === 0 || l.statusCode === -1 || l.statusCode >= 400)
        .map(l => {
          let errorType: "404" | "500" | "timeout" | "ssl-error" | "dns-error" | undefined;
          if (l.statusCode === 0 || l.statusCode === -1) errorType = "timeout";
          else if (l.statusCode === 404)    errorType = "404";
          else if (l.statusCode >= 500)     errorType = "500";
          return {
            url: l.url,
            statusCode: l.statusCode,
            foundOn: l.foundOn,
            linkText: l.linkText,
            errorType,
          };
        });

      // Broken images (img src that returns 4xx/5xx/timeout)
      const brokenImages = imageLinks.filter(
        l => l.statusCode === 0 || l.statusCode === -1 || l.statusCode >= 400,
      ).length;

      // Redirect chains — URLs where fetch followed a redirect
      const redirectChains: BrokenLinkResult["redirectChains"] = links
        .filter(l => l.redirectTo)
        .map(l => ({
          from: l.url,
          to: l.redirectTo!,
          hops: 1,
          finalStatusCode: l.statusCode,
        }));

      const completedAt = new Date();
      return {
        scannerName: "broken-links",
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        success: true,
        totalLinksChecked: anchorLinks.length,
        brokenLinks,
        redirectChains,
        externalLinks,
        internalLinks,
        brokenImages,
      };
    } catch (error) {
      const completedAt = new Date();
      return {
        scannerName: "broken-links",
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        success: false,
        error: error instanceof Error ? error.message : "Broken link scan failed",
        totalLinksChecked: 0,
        brokenLinks: [],
        redirectChains: [],
        externalLinks: 0,
        internalLinks: 0,
        brokenImages: 0,
      };
    }
  }
}

export default new BrokenLinkScanner();
export { BrokenLinkScanner };
