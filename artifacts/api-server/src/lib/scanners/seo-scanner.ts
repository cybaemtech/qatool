// ─── SEO Scanner ───────────────────────────────────────────────────────────────
// Real implementation using built-in fetch + cheerio for HTML parsing.
// Checks meta tags, OG tags, headings, canonical, sitemap, robots.txt,
// and structured data — no browser required.

import * as cheerio from "cheerio";
import type { AuditScanner, AuditContext, SEOAnalysis } from "../audit-types";

export interface SEOAdapter {
  fetchMetadata(url: string): Promise<{
    title: string | null;
    description: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: string | null;
    twitterCard: string | null;
    canonical: string | null;
    robots: string | null;
    viewport: string | null;
    h1s: string[];
    h2s: string[];
    h3s: string[];
    sitemapFound: boolean;
    robotsTxtFound: boolean;
    structuredDataTypes: string[];
  }>;
}

const COMMON_SEO_ISSUES = [
  { id: "missing-meta-desc", severity: "high" as const, description: "Meta description is missing or too short (< 50 characters)", recommendation: "Add a unique, compelling meta description of 50–160 characters to every page" },
  { id: "duplicate-title", severity: "high" as const, description: "Duplicate page titles found across multiple pages", recommendation: "Ensure each page has a unique, descriptive title that includes primary keywords" },
  { id: "missing-alt", severity: "medium" as const, description: "Images missing alt attributes reduce accessibility and SEO", recommendation: "Add descriptive alt text to all meaningful images" },
  { id: "slow-lcp", severity: "high" as const, description: "Largest Contentful Paint > 2.5s negatively impacts Google Core Web Vitals ranking", recommendation: "Optimize hero images and critical rendering path" },
  { id: "no-sitemap", severity: "medium" as const, description: "XML sitemap not found — crawler may miss pages", recommendation: "Generate and submit a sitemap.xml to Google Search Console" },
  { id: "missing-canonical", severity: "medium" as const, description: "Canonical URL not specified — duplicate content risk", recommendation: "Add <link rel='canonical'> to every page to prevent duplicate content penalties" },
  { id: "heading-hierarchy", severity: "low" as const, description: "Heading hierarchy is inconsistent — multiple H1 or skipped levels", recommendation: "Use a single H1 per page and maintain a logical H2→H3 hierarchy" },
  { id: "no-structured-data", severity: "low" as const, description: "No structured data (JSON-LD) detected — missing rich snippet eligibility", recommendation: "Add Schema.org structured data for articles, products, FAQs, or breadcrumbs" },
  { id: "missing-og-tags", severity: "medium" as const, description: "Open Graph tags missing — poor social media preview", recommendation: "Add og:title, og:description, og:image for all shareable pages" },
];

// ─── Real adapter using fetch + cheerio ───────────────────────────────────────

const realSEOAdapter: SEOAdapter = {
  async fetchMetadata(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; QAPortalBot/1.0; +https://qa-portal.dev/bot)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
      });

      const html = await res.text();
      const $ = cheerio.load(html);

      // ── Meta tags ──────────────────────────────────────────────────────────
      const title = $("title").first().text().trim() || null;
      const description =
        $('meta[name="description"]').attr("content")?.trim() ||
        $('meta[property="og:description"]').attr("content")?.trim() ||
        null;
      const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() || null;
      const ogDescription = $('meta[property="og:description"]').attr("content")?.trim() || null;
      const ogImage = $('meta[property="og:image"]').attr("content")?.trim() || null;
      const twitterCard = $('meta[name="twitter:card"]').attr("content")?.trim() || null;
      const canonical = $('link[rel="canonical"]').attr("href")?.trim() || null;
      const robots =
        $('meta[name="robots"]').attr("content")?.trim() ||
        res.headers.get("x-robots-tag") ||
        null;
      const viewport = $('meta[name="viewport"]').attr("content")?.trim() || null;

      // ── Headings ──────────────────────────────────────────────────────────
      const h1s: string[] = [];
      $("h1").each((_, el) => {
        const text = $(el).text().trim();
        if (text) h1s.push(text);
      });
      const h2s: string[] = [];
      $("h2").each((_, el) => {
        const text = $(el).text().trim();
        if (text) h2s.push(text);
      });
      const h3s: string[] = [];
      $("h3").each((_, el) => {
        const text = $(el).text().trim();
        if (text) h3s.push(text);
      });

      // ── Structured data ────────────────────────────────────────────────────
      const structuredDataTypes: string[] = [];
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const json = JSON.parse($(el).html() || "{}");
          const types = Array.isArray(json)
            ? json.map((j: { "@type"?: string }) => j["@type"]).filter(Boolean)
            : json["@type"]
            ? [json["@type"]]
            : [];
          structuredDataTypes.push(...types);
        } catch {
          // malformed JSON-LD, skip
        }
      });

      // ── Sitemap + robots.txt ───────────────────────────────────────────────
      const origin = new URL(url).origin;

      const [sitemapRes, robotsRes] = await Promise.allSettled([
        fetch(`${origin}/sitemap.xml`, {
          method: "HEAD",
          signal: AbortSignal.timeout(8000),
          headers: { "User-Agent": "QAPortalBot/1.0" },
          redirect: "follow",
        }),
        fetch(`${origin}/robots.txt`, {
          signal: AbortSignal.timeout(8000),
          headers: { "User-Agent": "QAPortalBot/1.0" },
          redirect: "follow",
        }),
      ]);

      const sitemapFound =
        sitemapRes.status === "fulfilled" && sitemapRes.value.ok;

      // Also check if robots.txt mentions a sitemap
      let robotsTxtFound = false;
      if (robotsRes.status === "fulfilled" && robotsRes.value.ok) {
        robotsTxtFound = true;
        const robotsText = await robotsRes.value.text();
        if (!sitemapFound && robotsText.toLowerCase().includes("sitemap:")) {
          // robots.txt references a sitemap even if /sitemap.xml 404'd
        }
      }

      return {
        title,
        description,
        ogTitle,
        ogDescription,
        ogImage,
        twitterCard,
        canonical,
        robots,
        viewport,
        h1s,
        h2s,
        h3s,
        sitemapFound,
        robotsTxtFound,
        structuredDataTypes: [...new Set(structuredDataTypes)],
      };
    } finally {
      clearTimeout(timer);
    }
  },
};

class SEOScanner implements AuditScanner<SEOAnalysis> {
  readonly name = "seo" as const;
  readonly description = "Analyzes meta tags, headings, structured data, and crawlability";
  readonly version = "2.0.0";
  readonly adapter = "real-fetch-cheerio";

  private seoAdapter: SEOAdapter;

  constructor(adapter: SEOAdapter = realSEOAdapter) {
    this.seoAdapter = adapter;
  }

  async run(context: AuditContext): Promise<SEOAnalysis> {
    const startedAt = new Date();

    try {
      const meta = await this.seoAdapter.fetchMetadata(context.url);

      // ── Issue detection based on real metadata ─────────────────────────────
      const issues: SEOAnalysis["issues"] = [];

      if (!meta.description || meta.description.length < 50) {
        issues.push(COMMON_SEO_ISSUES[0]);
      }
      if (!meta.sitemapFound) {
        issues.push(COMMON_SEO_ISSUES[4]);
      }
      if (!meta.canonical) {
        issues.push(COMMON_SEO_ISSUES[5]);
      }
      if (meta.h1s.length !== 1) {
        issues.push(COMMON_SEO_ISSUES[6]);
      }
      if (meta.structuredDataTypes.length === 0) {
        issues.push(COMMON_SEO_ISSUES[7]);
      }
      if (!meta.ogTitle || !meta.ogDescription || !meta.ogImage) {
        issues.push(COMMON_SEO_ISSUES[8]);
      }

      // Score: start at 100, deduct per issue
      const deductions: Record<string, number> = { critical: 20, high: 12, medium: 6, low: 3 };
      const penalty = issues.reduce((acc, i) => acc + (deductions[i.severity] ?? 0), 0);
      const score = Math.max(0, Math.min(100, 100 - penalty));

      const completedAt = new Date();
      return {
        scannerName: "seo",
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        success: true,
        score,
        metaTags: {
          title: meta.title,
          titleLength: meta.title?.length ?? 0,
          description: meta.description,
          descriptionLength: meta.description?.length ?? 0,
          ogTitle: meta.ogTitle,
          ogDescription: meta.ogDescription,
          ogImage: meta.ogImage,
          twitterCard: meta.twitterCard,
          canonical: meta.canonical,
          robots: meta.robots,
          viewport: meta.viewport,
        },
        headingStructure: {
          h1Count: meta.h1s.length,
          h2Count: meta.h2s.length,
          h3Count: meta.h3s.length,
          issues:
            meta.h1s.length === 0
              ? ["Missing H1 heading"]
              : meta.h1s.length > 1
              ? [`Multiple H1 headings found (${meta.h1s.length})`]
              : [],
        },
        sitemapFound: meta.sitemapFound,
        robotsTxtFound: meta.robotsTxtFound,
        structuredData: {
          found: meta.structuredDataTypes.length > 0,
          types: meta.structuredDataTypes,
          valid: meta.structuredDataTypes.length > 0,
          errors: [],
        },
        issues,
      };
    } catch (error) {
      const completedAt = new Date();
      return {
        scannerName: "seo",
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        success: false,
        error: error instanceof Error ? error.message : "SEO scan failed",
        score: 0,
        metaTags: {
          title: null,
          titleLength: 0,
          description: null,
          descriptionLength: 0,
          ogTitle: null,
          ogDescription: null,
          ogImage: null,
          twitterCard: null,
          canonical: null,
          robots: null,
          viewport: null,
        },
        headingStructure: { h1Count: 0, h2Count: 0, h3Count: 0, issues: [] },
        sitemapFound: false,
        robotsTxtFound: false,
        structuredData: { found: false, types: [], valid: false, errors: [] },
        issues: [],
      };
    }
  }
}

export default new SEOScanner();
export { SEOScanner };
