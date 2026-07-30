// ─── Broken Link Scanner ──────────────────────────────────────────────────────
// Real implementation: fetches the target page, extracts all <a href> links,
// then HEAD-checks each one with a concurrency limit. No browser required.

import * as cheerio from "cheerio";
import type { AuditScanner, AuditContext, BrokenLinkResult } from "../audit-types";

export interface BrokenLinkAdapter {
  crawl(url: string, options?: { maxLinks?: number; timeout?: number }): Promise<{
    links: Array<{
      url: string;
      statusCode: number;
      foundOn: string;
      linkText?: string;
      isExternal: boolean;
      redirectTo?: string;
    }>;
  }>;
}

// ─── Real HTTP crawler ─────────────────────────────────────────────────────────

const realBrokenLinkAdapter: BrokenLinkAdapter = {
  async crawl(pageUrl, options = {}) {
    const maxLinks = options.maxLinks ?? 50;
    const timeoutMs = options.timeout ?? 8000;
    const origin = new URL(pageUrl).origin;

    // ── Step 1: Fetch the target page and extract all links ──────────────────
    let html = "";
    try {
      const res = await fetch(pageUrl, {
        signal: AbortSignal.timeout(15000),
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; QAPortalBot/1.0)",
          "Accept": "text/html,*/*;q=0.8",
        },
        redirect: "follow",
      });
      html = await res.text();
    } catch {
      return { links: [] };
    }

    const $ = cheerio.load(html);
    const rawLinks: Array<{ href: string; text: string }> = [];

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href")?.trim();
      const text = $(el).text().trim().slice(0, 100);
      if (href) rawLinks.push({ href, text });
    });

    // ── Step 2: Resolve and de-duplicate URLs ────────────────────────────────
    const seen = new Set<string>();
    const resolved: Array<{ url: string; text: string; isExternal: boolean }> = [];

    for (const { href, text } of rawLinks) {
      if (resolved.length >= maxLinks) break;
      if (
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:")
      ) continue;

      let fullUrl: string;
      try {
        fullUrl = new URL(href, pageUrl).href;
      } catch {
        continue;
      }
      if (seen.has(fullUrl)) continue;
      seen.add(fullUrl);

      resolved.push({
        url: fullUrl,
        text,
        isExternal: !fullUrl.startsWith(origin),
      });
    }

    // ── Step 3: Check each link with concurrency limit of 8 ─────────────────
    const CONCURRENCY = 8;
    const results: Array<{
      url: string;
      statusCode: number;
      foundOn: string;
      linkText?: string;
      isExternal: boolean;
      redirectTo?: string;
    }> = [];

    for (let i = 0; i < resolved.length; i += CONCURRENCY) {
      const batch = resolved.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async ({ url, text, isExternal }) => {
          try {
            // Try HEAD first (faster), fall back to GET for servers that don't support HEAD
            let res: Response | null = null;
            try {
              res = await fetch(url, {
                method: "HEAD",
                signal: AbortSignal.timeout(timeoutMs),
                headers: {
                  "User-Agent": "Mozilla/5.0 (compatible; QAPortalBot/1.0)",
                },
                redirect: "follow",
              });
            } catch {
              // HEAD might fail on some servers; try GET with small response
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

            // Detect redirects
            let redirectTo: string | undefined;
            if (res.redirected && res.url !== url) {
              redirectTo = res.url;
            }

            return {
              url,
              statusCode: res.status,
              foundOn: pageUrl,
              linkText: text || undefined,
              isExternal,
              redirectTo,
            };
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
  readonly description = "Crawls the page and HEAD-checks every link for broken/redirected URLs";
  readonly version = "2.0.0";
  readonly adapter = "real-http-crawl";

  private crawlerAdapter: BrokenLinkAdapter;

  constructor(adapter: BrokenLinkAdapter = realBrokenLinkAdapter) {
    this.crawlerAdapter = adapter;
  }

  async run(context: AuditContext): Promise<BrokenLinkResult> {
    const startedAt = new Date();
    const maxLinks = context.options?.maxLinksToCheck ?? 50;

    try {
      const { links } = await this.crawlerAdapter.crawl(context.url, {
        maxLinks,
        timeout: 8000,
      });

      const internalLinks = links.filter(l => !l.isExternal).length;
      const externalLinks = links.filter(l => l.isExternal).length;

      // Broken = 4xx, 5xx, timeout (0), or connection error (-1)
      const brokenLinks: BrokenLinkResult["brokenLinks"] = links
        .filter(l => l.statusCode === 0 || l.statusCode === -1 || l.statusCode >= 400)
        .map(l => {
          let errorType: "404" | "500" | "timeout" | "ssl-error" | "dns-error" | undefined;
          if (l.statusCode === 0 || l.statusCode === -1) errorType = "timeout";
          else if (l.statusCode === 404) errorType = "404";
          else if (l.statusCode >= 500) errorType = "500";
          return {
            url: l.url,
            statusCode: l.statusCode,
            foundOn: l.foundOn,
            linkText: l.linkText,
            errorType,
          };
        });

      // Redirects (3xx or redirected flag from fetch)
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
        totalLinksChecked: links.length,
        brokenLinks,
        redirectChains,
        externalLinks,
        internalLinks,
        brokenImages: 0, // Would need browser to detect broken <img> resources
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
