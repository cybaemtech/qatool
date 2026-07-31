// ─── SEO Scanner ───────────────────────────────────────────────────────────────
// Uses Playwright to inspect the fully rendered DOM — handles SPAs where
// headings, meta tags, and OG data are injected by React/Vue/Angular/Helmet.
// Falls back to fetch+cheerio if Playwright is unavailable.
// Also checks sitemap.xml, robots.txt, and structured data.

import type { AuditScanner, AuditContext, SEOAnalysis } from "../audit-types";
import { withPage } from "./playwright-browser";

export interface SEOAdapter {
  fetchMetadata(url: string): Promise<{
    title: string | null;
    description: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: string | null;
    twitterCard: string | null;
    twitterTitle: string | null;
    twitterDescription: string | null;
    canonical: string | null;
    robots: string | null;
    viewport: string | null;
    h1s: string[];
    h2s: string[];
    h3s: string[];
    imagesWithoutAlt: number;
    totalImages: number;
    sitemapFound: boolean;
    robotsTxtFound: boolean;
    structuredDataTypes: string[];
    lang: string | null;
  }>;
}

// ─── Issue catalogue ─────────────────────────────────────────────────────────

const ISSUE_DEFS = {
  "missing-meta-desc": { severity: "high" as const,
    description: "Meta description is missing or too short (< 50 characters)",
    recommendation: "Add a unique, compelling meta description of 50–160 characters to every page" },
  "missing-alt": { severity: "medium" as const,
    description: "Images are missing alt attributes — reduces accessibility and SEO",
    recommendation: "Add descriptive alt text to all meaningful images; use alt=\"\" for decorative images" },
  "no-sitemap": { severity: "medium" as const,
    description: "XML sitemap not found — search crawlers may miss pages",
    recommendation: "Generate a sitemap.xml, submit it to Google Search Console, and reference it in robots.txt" },
  "missing-canonical": { severity: "medium" as const,
    description: "Canonical URL not specified — duplicate content risk",
    recommendation: "Add <link rel='canonical' href='...'> to every page to prevent duplicate content penalties" },
  "heading-hierarchy": { severity: "low" as const,
    description: "Heading hierarchy is inconsistent (no H1, multiple H1s, or skipped levels)",
    recommendation: "Use exactly one H1 per page and maintain a logical H2 → H3 hierarchy" },
  "no-structured-data": { severity: "low" as const,
    description: "No structured data (JSON-LD / Schema.org) detected — missing rich snippet eligibility",
    recommendation: "Add Schema.org structured data for articles, products, FAQs, breadcrumbs, or organisation" },
  "missing-og-tags": { severity: "medium" as const,
    description: "Open Graph tags (og:title, og:description, og:image) are incomplete or missing",
    recommendation: "Add all three og: tags plus og:url and og:type to every shareable page" },
  "missing-twitter-card": { severity: "low" as const,
    description: "Twitter Card meta tags are absent — plain link previews on X/Twitter",
    recommendation: "Add twitter:card, twitter:title, twitter:description, and twitter:image meta tags" },
  "missing-lang": { severity: "low" as const,
    description: "HTML lang attribute is missing — affects screen readers and search localisation",
    recommendation: "Add lang='en' (or appropriate language code) to the <html> element" },
};

// ─── Playwright adapter (primary) ─────────────────────────────────────────────

const playwrightSEOAdapter: SEOAdapter = {
  async fetchMetadata(url) {
    return withPage(async (page) => {
      // Capture x-robots-tag from HTTP response before navigation
      let xRobotsTag: string | null = null;
      page.on("response", res => {
        if (res.url() === url || res.url().split("?")[0] === url.split("?")[0]) {
          xRobotsTag = res.headers()["x-robots-tag"] ?? null;
        }
      });

      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      // Extra pause for React Helmet / dynamic meta injection
      await page.waitForTimeout(1000);

      const meta = await page.evaluate(() => {
        const getMeta = (sel: string) =>
          (document.querySelector(sel) as HTMLMetaElement | null)?.getAttribute("content")?.trim() ?? null;
        const getLink = (sel: string) =>
          (document.querySelector(sel) as HTMLLinkElement | null)?.getAttribute("href")?.trim() ?? null;

        const h1s: string[] = [];
        document.querySelectorAll("h1").forEach(el => {
          const t = el.textContent?.trim();
          if (t) h1s.push(t);
        });
        const h2s: string[] = [];
        document.querySelectorAll("h2").forEach(el => {
          const t = el.textContent?.trim();
          if (t) h2s.push(t);
        });
        const h3s: string[] = [];
        document.querySelectorAll("h3").forEach(el => {
          const t = el.textContent?.trim();
          if (t) h3s.push(t);
        });

        let totalImages = 0;
        let imagesWithoutAlt = 0;
        document.querySelectorAll("img").forEach(img => {
          totalImages++;
          const alt = img.getAttribute("alt");
          if (alt === null || (alt === "" && !img.hasAttribute("role"))) imagesWithoutAlt++;
        });

        const structuredDataTypes: string[] = [];
        document.querySelectorAll('script[type="application/ld+json"]').forEach(el => {
          try {
            const json = JSON.parse(el.textContent ?? "{}");
            const types = Array.isArray(json)
              ? json.map((j: Record<string, unknown>) => j["@type"] as string).filter(Boolean)
              : json["@type"] ? [json["@type"] as string] : [];
            structuredDataTypes.push(...types);
          } catch { /* malformed JSON-LD */ }
        });

        return {
          title: document.title?.trim() || null,
          description: getMeta('meta[name="description"]') ?? getMeta('meta[property="og:description"]'),
          ogTitle: getMeta('meta[property="og:title"]'),
          ogDescription: getMeta('meta[property="og:description"]'),
          ogImage: getMeta('meta[property="og:image"]'),
          twitterCard: getMeta('meta[name="twitter:card"]'),
          twitterTitle: getMeta('meta[name="twitter:title"]'),
          twitterDescription: getMeta('meta[name="twitter:description"]'),
          canonical: getLink('link[rel="canonical"]'),
          robots: getMeta('meta[name="robots"]'),
          viewport: getMeta('meta[name="viewport"]'),
          lang: document.documentElement.getAttribute("lang"),
          h1s,
          h2s,
          h3s,
          totalImages,
          imagesWithoutAlt,
          structuredDataTypes: [...new Set(structuredDataTypes)],
        };
      });

      // robots from HTTP header overrides meta tag
      const robots = xRobotsTag ?? meta.robots;

      // Check sitemap + robots.txt concurrently via plain HTTP
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
      const robotsTxtFound =
        robotsRes.status === "fulfilled" && robotsRes.value.ok;

      return { ...meta, robots, sitemapFound, robotsTxtFound };
    }, { timeoutMs: 45000 });
  },
};

// ─── Fetch+cheerio fallback ───────────────────────────────────────────────────

const fetchSEOAdapter: SEOAdapter = {
  async fetchMetadata(url) {
    const { load } = await import("cheerio");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; QAPortalBot/1.0)",
          "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
        },
        redirect: "follow",
      });

      const html = await res.text();
      const $ = load(html);

      const title = $("title").first().text().trim() || null;
      const description =
        $('meta[name="description"]').attr("content")?.trim() ||
        $('meta[property="og:description"]').attr("content")?.trim() || null;
      const ogTitle       = $('meta[property="og:title"]').attr("content")?.trim() || null;
      const ogDescription = $('meta[property="og:description"]').attr("content")?.trim() || null;
      const ogImage       = $('meta[property="og:image"]').attr("content")?.trim() || null;
      const twitterCard   = $('meta[name="twitter:card"]').attr("content")?.trim() || null;
      const twitterTitle  = $('meta[name="twitter:title"]').attr("content")?.trim() || null;
      const twitterDescription = $('meta[name="twitter:description"]').attr("content")?.trim() || null;
      const canonical     = $('link[rel="canonical"]').attr("href")?.trim() || null;
      const robots        = $('meta[name="robots"]').attr("content")?.trim() || res.headers.get("x-robots-tag") || null;
      const viewport      = $('meta[name="viewport"]').attr("content")?.trim() || null;
      const lang          = $("html").attr("lang") || null;

      const h1s: string[] = [];
      $("h1").each((_, el) => { const t = $(el).text().trim(); if (t) h1s.push(t); });
      const h2s: string[] = [];
      $("h2").each((_, el) => { const t = $(el).text().trim(); if (t) h2s.push(t); });
      const h3s: string[] = [];
      $("h3").each((_, el) => { const t = $(el).text().trim(); if (t) h3s.push(t); });

      let totalImages = 0;
      let imagesWithoutAlt = 0;
      $("img").each((_, el) => {
        totalImages++;
        if (!$(el).attr("alt")) imagesWithoutAlt++;
      });

      const structuredDataTypes: string[] = [];
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const json = JSON.parse($(el).html() || "{}");
          const types = Array.isArray(json)
            ? json.map((j: Record<string, unknown>) => j["@type"] as string).filter(Boolean)
            : json["@type"] ? [json["@type"] as string] : [];
          structuredDataTypes.push(...types);
        } catch { /* skip */ }
      });

      const origin = new URL(url).origin;
      const [sitemapRes, robotsRes] = await Promise.allSettled([
        fetch(`${origin}/sitemap.xml`, { method: "HEAD", signal: AbortSignal.timeout(8000), redirect: "follow" }),
        fetch(`${origin}/robots.txt`,  { signal: AbortSignal.timeout(8000), redirect: "follow" }),
      ]);

      return {
        title, description, ogTitle, ogDescription, ogImage,
        twitterCard, twitterTitle, twitterDescription,
        canonical, robots, viewport, lang,
        h1s, h2s, h3s, totalImages, imagesWithoutAlt,
        sitemapFound:  sitemapRes.status === "fulfilled" && sitemapRes.value.ok,
        robotsTxtFound: robotsRes.status === "fulfilled" && robotsRes.value.ok,
        structuredDataTypes: [...new Set(structuredDataTypes)],
      };
    } finally {
      clearTimeout(timer);
    }
  },
};

// ─── Composed adapter: Playwright primary, fetch fallback ─────────────────────

const composedSEOAdapter: SEOAdapter = {
  async fetchMetadata(url) {
    try {
      return await playwrightSEOAdapter.fetchMetadata(url);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(`[seo-scanner] Playwright unavailable (${reason.slice(0, 80)}); falling back to fetch+cheerio`);
      return fetchSEOAdapter.fetchMetadata(url);
    }
  },
};

class SEOScanner implements AuditScanner<SEOAnalysis> {
  readonly name = "seo" as const;
  readonly description =
    "Playwright-rendered DOM inspection: meta tags, headings, OG, Twitter Card, structured data, sitemap, robots";
  readonly version = "3.0.0";
  readonly adapter = "playwright-dom+fetch-fallback";

  private seoAdapter: SEOAdapter;

  constructor(adapter: SEOAdapter = composedSEOAdapter) {
    this.seoAdapter = adapter;
  }

  async run(context: AuditContext): Promise<SEOAnalysis> {
    const startedAt = new Date();

    try {
      const meta = await this.seoAdapter.fetchMetadata(context.url);

      // ── Issue detection ────────────────────────────────────────────────────
      const issues: SEOAnalysis["issues"] = [];

      if (!meta.description || meta.description.length < 50) {
        issues.push({ id: "missing-meta-desc", ...ISSUE_DEFS["missing-meta-desc"] });
      }
      if (meta.imagesWithoutAlt > 0) {
        issues.push({
          id: "missing-alt",
          severity: "medium",
          description: `${meta.imagesWithoutAlt} of ${meta.totalImages} image(s) are missing alt attributes`,
          recommendation: ISSUE_DEFS["missing-alt"].recommendation,
        });
      }
      if (!meta.sitemapFound) {
        issues.push({ id: "no-sitemap", ...ISSUE_DEFS["no-sitemap"] });
      }
      if (!meta.canonical) {
        issues.push({ id: "missing-canonical", ...ISSUE_DEFS["missing-canonical"] });
      }
      if (meta.h1s.length !== 1) {
        issues.push({
          id: "heading-hierarchy",
          severity: "low",
          description: meta.h1s.length === 0
            ? "No H1 heading found on the page"
            : `${meta.h1s.length} H1 headings found — only one is allowed per page`,
          recommendation: ISSUE_DEFS["heading-hierarchy"].recommendation,
        });
      }
      if (meta.structuredDataTypes.length === 0) {
        issues.push({ id: "no-structured-data", ...ISSUE_DEFS["no-structured-data"] });
      }
      if (!meta.ogTitle || !meta.ogDescription || !meta.ogImage) {
        const missing = [
          !meta.ogTitle       && "og:title",
          !meta.ogDescription && "og:description",
          !meta.ogImage       && "og:image",
        ].filter(Boolean).join(", ");
        issues.push({
          id: "missing-og-tags",
          severity: "medium",
          description: `Open Graph tags missing: ${missing}`,
          recommendation: ISSUE_DEFS["missing-og-tags"].recommendation,
        });
      }
      if (!meta.twitterCard) {
        issues.push({ id: "missing-twitter-card", ...ISSUE_DEFS["missing-twitter-card"] });
      }
      if (!meta.lang) {
        issues.push({ id: "missing-lang", ...ISSUE_DEFS["missing-lang"] });
      }

      // ── Score ────────────────────────────────────────────────────────────
      const deductions: Record<string, number> = { critical: 20, high: 12, medium: 6, low: 3 };
      const penalty = issues.reduce((acc, i) => acc + (deductions[i.severity] ?? 0), 0);
      const score   = Math.max(0, Math.min(100, 100 - penalty));

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
              ? ["Missing H1 heading — add one descriptive H1 to identify the page topic"]
              : meta.h1s.length > 1
              ? [`${meta.h1s.length} H1 headings found: "${meta.h1s.slice(0, 2).join('", "')}"${meta.h1s.length > 2 ? ", …" : ""}`]
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
          title: null, titleLength: 0, description: null, descriptionLength: 0,
          ogTitle: null, ogDescription: null, ogImage: null,
          twitterCard: null, canonical: null, robots: null, viewport: null,
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
