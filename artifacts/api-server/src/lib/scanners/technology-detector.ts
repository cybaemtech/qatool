// ─── Technology Detector ──────────────────────────────────────────────────────
// Mock implementation. Replace with Wappalyzer Node.js library or BuiltWith API.
// Interface: AuditScanner<TechnologyProfile>

import type { AuditScanner, AuditContext, TechnologyProfile } from "../audit-types";

export interface TechDetectionAdapter {
  detect(url: string): Promise<{
    technologies: Array<{
      name: string;
      version?: string;
      categories: string[];
      confidence: number;
    }>;
  }>;
}

const COMMON_STACKS = [
  { frameworks: ["React", "Next.js"], cms: undefined, cdn: "Cloudflare", server: "Vercel", webServer: "nginx" },
  { frameworks: ["Vue.js", "Nuxt"], cms: undefined, cdn: "Fastly", server: "Netlify", webServer: "nginx" },
  { frameworks: ["Angular"], cms: undefined, cdn: "CloudFront", server: "AWS", webServer: "Apache" },
  { frameworks: ["React"], cms: "WordPress", cdn: "Cloudflare", server: "WP Engine", webServer: "nginx" },
  { frameworks: ["jQuery"], cms: "Shopify", cdn: "Shopify CDN", server: "Shopify", webServer: "nginx" },
];

const mockTechAdapter: TechDetectionAdapter = {
  async detect(_url) {
    const rand = Math.random();
    const stack = COMMON_STACKS[Math.floor(rand * COMMON_STACKS.length)];

    const technologies = [
      ...stack.frameworks.map(f => ({ name: f, categories: ["UI Frameworks"], confidence: 90 + Math.round(rand * 10) })),
      { name: "TypeScript", categories: ["Programming Languages"], confidence: 70 },
      { name: "Webpack", version: "5.x", categories: ["Module Bundlers"], confidence: 80 },
      { name: "Google Analytics", categories: ["Analytics"], confidence: 95 },
      { name: "Hotjar", categories: ["Analytics"], confidence: rand > 0.5 ? 85 : 0 },
      { name: "Google Tag Manager", categories: ["Tag Managers"], confidence: rand > 0.4 ? 90 : 0 },
      { name: "reCAPTCHA", categories: ["Security"], confidence: rand > 0.6 ? 88 : 0 },
      { name: "Stripe", categories: ["Payment Processors"], confidence: rand > 0.7 ? 80 : 0 },
      { name: stack.cdn ?? "Cloudflare", categories: ["CDN"], confidence: 75 },
      { name: "Inter", categories: ["Web Fonts"], confidence: 85 },
      { name: "Bootstrap", categories: ["CSS Frameworks"], confidence: rand > 0.5 ? 70 : 0 },
      { name: "Tailwind CSS", categories: ["CSS Frameworks"], confidence: rand > 0.6 ? 80 : 0 },
    ].filter(t => t.confidence > 0);

    return { technologies };
  },
};

class TechnologyDetector implements AuditScanner<TechnologyProfile> {
  readonly name = "technology" as const;
  readonly description = "Identifies frameworks, libraries, CDN, CMS, analytics, and hosting provider";
  readonly version = "1.0.0";
  readonly adapter = "wappalyzer";

  private techAdapter: TechDetectionAdapter;

  constructor(adapter: TechDetectionAdapter = mockTechAdapter) {
    this.techAdapter = adapter;
  }

  async run(context: AuditContext): Promise<TechnologyProfile> {
    const startedAt = new Date();

    try {
      const { technologies } = await this.techAdapter.detect(context.url);
      const rand = Math.random();
      const stack = COMMON_STACKS[Math.floor(rand * COMMON_STACKS.length)];

      const byCategory = (cat: string) =>
        technologies.filter(t => t.categories.includes(cat)).map(t => t.name);

      const frameworks = technologies
        .filter(t => t.categories.includes("UI Frameworks") || t.categories.includes("JavaScript Frameworks"))
        .map(t => t.name);

      const libraries = technologies
        .filter(t => t.categories.includes("JavaScript Libraries") || t.categories.includes("CSS Frameworks") || t.categories.includes("Module Bundlers"))
        .map(t => ({
          name: t.name,
          version: t.version,
          category: t.categories.includes("CSS Frameworks") ? "css-framework" : "js-library",
        } as TechnologyProfile["libraries"][number]));

      const completedAt = new Date();
      return {
        scannerName: "technology",
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        success: true,
        cms: stack.cms,
        frameworks,
        libraries,
        cdn: stack.cdn,
        hosting: stack.server,
        analytics: byCategory("Analytics"),
        advertising: byCategory("Advertising Networks"),
        security: byCategory("Security"),
        fonts: technologies.filter(t => t.categories.includes("Web Fonts")).map(t => t.name),
        languages: ["JavaScript", "TypeScript", "HTML5", "CSS3"],
        server: stack.server,
        webServer: stack.webServer,
        jsRuntime: "Node.js",
      };
    } catch (error) {
      const completedAt = new Date();
      return {
        scannerName: "technology",
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        success: false,
        error: error instanceof Error ? error.message : "Technology detection failed",
        frameworks: [],
        libraries: [],
        analytics: [],
        advertising: [],
        security: [],
        fonts: [],
        languages: [],
      };
    }
  }
}

export default new TechnologyDetector();
export { TechnologyDetector };
