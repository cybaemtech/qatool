// ─── Broken Link Scanner ──────────────────────────────────────────────────────
// Mock implementation. Replace with Broken Link Checker SDK / Ahrefs / Sitebulb.
// Interface: AuditScanner<BrokenLinkResult>

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

const mockBrokenLinkAdapter: BrokenLinkAdapter = {
  async crawl(url, options = {}) {
    const maxLinks = options.maxLinks ?? 50;
    const rand = Math.random();
    const linksChecked = Math.round(20 + rand * maxLinks);
    const domain = new URL(url).hostname;

    const links: BrokenLinkAdapter extends { crawl: (...args: unknown[]) => Promise<{ links: infer L[] }> } ? L[] : never[] = [];

    // Add mostly good links
    for (let i = 0; i < linksChecked; i++) {
      const path = ["/about", "/contact", "/products", "/blog", "/pricing", "/docs"][i % 6];
      const isExternal = i % 5 === 0;
      const isBroken = rand > 0.6 && i < 3; // occasionally broken
      links.push({
        url: isExternal ? `https://example.com${path}` : `${url}${path}`,
        statusCode: isBroken ? (rand > 0.8 ? 404 : 500) : 200,
        foundOn: url,
        linkText: path.slice(1).replace("-", " "),
        isExternal,
      });
    }

    return { links: links as ReturnType<BrokenLinkAdapter["crawl"]> extends Promise<{ links: Array<infer L> }> ? L[] : never[] };
  },
};

class BrokenLinkScanner implements AuditScanner<BrokenLinkResult> {
  readonly name = "broken-links" as const;
  readonly description = "Crawls pages to find broken links, redirects, and missing resources";
  readonly version = "1.0.0";
  readonly adapter = "broken-link-checker";

  private crawlerAdapter: BrokenLinkAdapter;

  constructor(adapter: BrokenLinkAdapter = mockBrokenLinkAdapter) {
    this.crawlerAdapter = adapter;
  }

  async run(context: AuditContext): Promise<BrokenLinkResult> {
    const startedAt = new Date();
    const rand = Math.random();

    try {
      void this.crawlerAdapter; // adapter held for real integration injection
      const maxLinks = context.options?.maxLinksToCheck ?? 50;
      // Simulate crawl with deterministic-ish mock data
      const internalLinks = Math.round(15 + rand * 35);
      const externalLinks = Math.round(5 + rand * 15);
      const totalChecked = internalLinks + externalLinks;

      const brokenLinks: BrokenLinkResult["brokenLinks"] = [];
      if (rand > 0.5) {
        brokenLinks.push({
          url: `${context.url}/about-old`,
          statusCode: 404,
          foundOn: context.url,
          linkText: "About Us",
          errorType: "404",
        });
      }
      if (rand > 0.7) {
        brokenLinks.push({
          url: `${context.url}/api/legacy`,
          statusCode: 500,
          foundOn: `${context.url}/contact`,
          linkText: undefined,
          errorType: "500",
        });
      }
      if (rand > 0.8) {
        brokenLinks.push({
          url: `https://old-cdn.example.com/asset.css`,
          statusCode: 404,
          foundOn: context.url,
          linkText: undefined,
          errorType: "404",
        });
      }

      const redirectChains: BrokenLinkResult["redirectChains"] = [];
      if (rand > 0.4) {
        redirectChains.push({
          from: `${context.url}/blog`,
          to: `${context.url}/articles`,
          hops: 1,
          finalStatusCode: 200,
        });
      }
      if (rand > 0.7) {
        redirectChains.push({
          from: `${context.url}/old-page`,
          to: `${context.url}/new-page`,
          hops: 2,
          finalStatusCode: 200,
        });
      }

      const completedAt = new Date();
      return {
        scannerName: "broken-links",
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        success: true,
        totalLinksChecked: Math.min(totalChecked, maxLinks),
        brokenLinks,
        redirectChains,
        externalLinks,
        internalLinks,
        brokenImages: rand > 0.6 ? Math.round(rand * 3) : 0,
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
