// ─── SEO Scanner ───────────────────────────────────────────────────────────────
// Mock implementation. Replace with Google Search Console API / Screaming Frog.
// Interface: AuditScanner<SEOAnalysis>

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

const mockSEOAdapter: SEOAdapter = {
  async fetchMetadata(url) {
    const rand = Math.random();
    const hasDesc = rand > 0.3;
    const hasOg = rand > 0.4;
    return {
      title: `${new URL(url).hostname} — Home`,
      description: hasDesc ? "We build quality software solutions for modern enterprises." : null,
      ogTitle: hasOg ? "Welcome to Our Platform" : null,
      ogDescription: hasOg ? "Build faster with our tools" : null,
      ogImage: hasOg ? `${url}/og-image.png` : null,
      twitterCard: rand > 0.5 ? "summary_large_image" : null,
      canonical: rand > 0.4 ? url : null,
      robots: "index, follow",
      viewport: "width=device-width, initial-scale=1",
      h1s: rand > 0.2 ? ["Welcome to Our Platform"] : [],
      h2s: ["Features", "Pricing", "About"],
      h3s: ["Performance", "Security", "Reliability"],
      sitemapFound: rand > 0.3,
      robotsTxtFound: rand > 0.2,
      structuredDataTypes: rand > 0.5 ? ["Organization", "WebPage"] : [],
    };
  },
};

class SEOScanner implements AuditScanner<SEOAnalysis> {
  readonly name = "seo" as const;
  readonly description = "Analyzes meta tags, headings, structured data, and crawlability";
  readonly version = "1.0.0";
  readonly adapter = "custom-fetch";

  private seoAdapter: SEOAdapter;

  constructor(adapter: SEOAdapter = mockSEOAdapter) {
    this.seoAdapter = adapter;
  }

  async run(context: AuditContext): Promise<SEOAnalysis> {
    const startedAt = new Date();

    try {
      const meta = await this.seoAdapter.fetchMetadata(context.url);
      const rand = Math.random();

      // Determine active issues based on metadata
      const issues: SEOAnalysis["issues"] = [];

      if (!meta.description || meta.description.length < 50) {
        issues.push(COMMON_SEO_ISSUES[0]);
      }
      if (rand > 0.7) issues.push(COMMON_SEO_ISSUES[1]); // duplicate title
      if (rand > 0.5) issues.push(COMMON_SEO_ISSUES[2]); // missing alt
      if (!meta.sitemapFound) issues.push(COMMON_SEO_ISSUES[4]);
      if (!meta.canonical) issues.push(COMMON_SEO_ISSUES[5]);
      if (meta.h1s.length !== 1) issues.push(COMMON_SEO_ISSUES[6]);
      if (meta.structuredDataTypes.length === 0) issues.push(COMMON_SEO_ISSUES[7]);
      if (!meta.ogTitle) issues.push(COMMON_SEO_ISSUES[8]);

      // Score: start at 100, deduct per issue
      const deductions = { critical: 20, high: 12, medium: 6, low: 3 };
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
          issues: meta.h1s.length === 0
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
        metaTags: { title: null, titleLength: 0, description: null, descriptionLength: 0, ogTitle: null, ogDescription: null, ogImage: null, twitterCard: null, canonical: null, robots: null, viewport: null },
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
