// ─── Technology Detector ──────────────────────────────────────────────────────
// Real implementation using built-in fetch + cheerio to detect frameworks,
// libraries, CDN, CMS, analytics, and server stack from HTML, headers,
// and script/link attributes. No browser required.

import * as cheerio from "cheerio";
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

// ─── Detection signatures ─────────────────────────────────────────────────────

interface Signature {
  name: string;
  version?: string;
  categories: string[];
  confidence: number;
  test: (ctx: {
    html: string;
    $: ReturnType<typeof cheerio.load>;
    headers: Record<string, string>;
    scripts: string[];
    metaGenerator: string;
    cookies: string;
  }) => boolean;
}

const SIGNATURES: Signature[] = [
  // ── Frameworks / SPA ────────────────────────────────────────────────────────
  { name: "React", categories: ["UI Frameworks"], confidence: 90,
    test: ({ html, scripts }) =>
      /react(?:\.min)?\.js|react-dom/i.test(scripts.join(" ")) ||
      /__NEXT_DATA__|__REACT_/i.test(html) ||
      /data-reactroot|data-reactid/i.test(html) },
  { name: "Next.js", categories: ["UI Frameworks", "JavaScript Frameworks"], confidence: 95,
    test: ({ html }) => /__NEXT_DATA__|_next\/static/i.test(html) },
  { name: "Vue.js", categories: ["UI Frameworks"], confidence: 88,
    test: ({ html, scripts }) =>
      /vue(?:\.min)?\.js|vue@/i.test(scripts.join(" ")) ||
      /data-v-[a-f0-9]+/i.test(html) ||
      /__vue_/i.test(html) },
  { name: "Nuxt.js", categories: ["UI Frameworks", "JavaScript Frameworks"], confidence: 92,
    test: ({ html }) => /__NUXT__|_nuxt\//i.test(html) },
  { name: "Angular", categories: ["UI Frameworks"], confidence: 90,
    test: ({ html, scripts }) =>
      /ng-version|ng-app|ng-controller|ngx-/i.test(html) ||
      /angular(?:\.min)?\.js|@angular\//i.test(scripts.join(" ")) },
  { name: "Svelte", categories: ["UI Frameworks"], confidence: 85,
    test: ({ html, scripts }) =>
      /svelte-/i.test(html) || /svelte(?:\.min)?\.js/i.test(scripts.join(" ")) },
  { name: "jQuery", categories: ["JavaScript Libraries"], confidence: 90,
    test: ({ scripts, html }) =>
      /jquery(?:\.min)?\.js|jquery-[0-9]/i.test(scripts.join(" ")) ||
      /window\.\$\s*=|jQuery/i.test(html) },
  { name: "Gatsby", categories: ["Static Site Generators"], confidence: 92,
    test: ({ html }) => /___gatsby|gatsby-/i.test(html) },

  // ── CSS Frameworks ───────────────────────────────────────────────────────────
  { name: "Tailwind CSS", categories: ["CSS Frameworks"], confidence: 85,
    test: ({ html }) => /class="[^"]*(?:flex|grid|p-\d|m-\d|text-(?:sm|lg|xl)|bg-(?:white|black|gray))/i.test(html) },
  { name: "Bootstrap", categories: ["CSS Frameworks"], confidence: 88,
    test: ({ html, scripts }) =>
      /bootstrap(?:\.min)?\.css|bootstrap(?:\.min)?\.js/i.test(scripts.join(" ")) ||
      /class="[^"]*(?:container|row|col-|btn btn-|navbar)/i.test(html) },

  // ── CMS ──────────────────────────────────────────────────────────────────────
  { name: "WordPress", categories: ["CMS"], confidence: 95,
    test: ({ html, metaGenerator }) =>
      /wordpress/i.test(metaGenerator) ||
      /wp-content|wp-includes|wp-json/i.test(html) },
  { name: "Shopify", categories: ["Ecommerce"], confidence: 95,
    test: ({ html, headers }) =>
      /cdn\.shopify\.com|shopify\.com\/s\/files/i.test(html) ||
      /shopify/i.test(headers["x-shopify-stage"] ?? "") },
  { name: "Drupal", categories: ["CMS"], confidence: 90,
    test: ({ html, metaGenerator }) =>
      /drupal/i.test(metaGenerator) || /drupal\.js|sites\/default\/files/i.test(html) },
  { name: "Joomla", categories: ["CMS"], confidence: 90,
    test: ({ html, metaGenerator }) =>
      /joomla/i.test(metaGenerator) || /\/media\/jui\//i.test(html) },
  { name: "Ghost", categories: ["CMS"], confidence: 88,
    test: ({ html }) => /ghost\.io|ghost\/content/i.test(html) },
  { name: "Webflow", categories: ["Website Builders"], confidence: 90,
    test: ({ html, headers }) =>
      /webflow\.com|data-wf-/i.test(html) ||
      /webflow/i.test(headers["x-powered-by"] ?? "") },
  { name: "Wix", categories: ["Website Builders"], confidence: 90,
    test: ({ html }) => /wixstatic\.com|wix\.com/i.test(html) },
  { name: "Squarespace", categories: ["Website Builders"], confidence: 90,
    test: ({ html }) => /squarespace\.com|static\.squarespace/i.test(html) },

  // ── Analytics ────────────────────────────────────────────────────────────────
  { name: "Google Analytics", categories: ["Analytics"], confidence: 95,
    test: ({ html, scripts }) =>
      /google-analytics\.com|googletagmanager\.com\/gtag|gtag\(/i.test(html) ||
      /gtag\.js|analytics\.js/i.test(scripts.join(" ")) },
  { name: "Google Tag Manager", categories: ["Analytics", "Tag Managers"], confidence: 92,
    test: ({ html }) => /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]+/i.test(html) },
  { name: "Hotjar", categories: ["Analytics"], confidence: 90,
    test: ({ html }) => /hotjar\.com|hjSetting/i.test(html) },
  { name: "Segment", categories: ["Analytics"], confidence: 88,
    test: ({ html }) => /cdn\.segment\.com|analytics\.js/i.test(html) },
  { name: "Mixpanel", categories: ["Analytics"], confidence: 88,
    test: ({ html }) => /cdn\.mxpnl\.com|mixpanel\.com/i.test(html) },
  { name: "Plausible", categories: ["Analytics"], confidence: 90,
    test: ({ html }) => /plausible\.io/i.test(html) },

  // ── CDN / Hosting ────────────────────────────────────────────────────────────
  { name: "Cloudflare", categories: ["CDN"], confidence: 90,
    test: ({ headers }) =>
      !!headers["cf-ray"] || /cloudflare/i.test(headers["server"] ?? "") },
  { name: "AWS CloudFront", categories: ["CDN"], confidence: 88,
    test: ({ headers }) => /cloudfront/i.test(headers["via"] ?? headers["server"] ?? "") },
  { name: "Fastly", categories: ["CDN"], confidence: 88,
    test: ({ headers }) => /fastly/i.test(headers["via"] ?? headers["server"] ?? "") },
  { name: "Vercel", categories: ["PaaS"], confidence: 90,
    test: ({ headers }) =>
      !!headers["x-vercel-id"] || /vercel/i.test(headers["server"] ?? "") },
  { name: "Netlify", categories: ["PaaS"], confidence: 90,
    test: ({ headers, html }) =>
      !!headers["x-nf-request-id"] || /netlify/i.test(html) },

  // ── Server / Language ────────────────────────────────────────────────────────
  { name: "Node.js", categories: ["Programming Languages", "Web Servers"], confidence: 80,
    test: ({ headers }) => /node|express/i.test(headers["x-powered-by"] ?? "") },
  { name: "PHP", categories: ["Programming Languages"], confidence: 85,
    test: ({ headers }) => /php/i.test(headers["x-powered-by"] ?? headers["server"] ?? "") },
  { name: "nginx", categories: ["Web Servers"], confidence: 88,
    test: ({ headers }) => /nginx/i.test(headers["server"] ?? "") },
  { name: "Apache", categories: ["Web Servers"], confidence: 88,
    test: ({ headers }) => /apache/i.test(headers["server"] ?? "") },

  // ── Payments ─────────────────────────────────────────────────────────────────
  { name: "Stripe", categories: ["Payment Processors"], confidence: 88,
    test: ({ html, scripts }) =>
      /js\.stripe\.com|stripe\.com\/v[0-9]/i.test(html) || /stripe/i.test(scripts.join(" ")) },
  { name: "PayPal", categories: ["Payment Processors"], confidence: 88,
    test: ({ html }) => /paypal\.com\/sdk|paypalobjects\.com/i.test(html) },

  // ── Fonts ────────────────────────────────────────────────────────────────────
  { name: "Google Fonts", categories: ["Web Fonts"], confidence: 92,
    test: ({ html }) => /fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(html) },
  { name: "Typekit / Adobe Fonts", categories: ["Web Fonts"], confidence: 88,
    test: ({ html }) => /use\.typekit\.net|use\.typekit\.com/i.test(html) },

  // ── Security ─────────────────────────────────────────────────────────────────
  { name: "reCAPTCHA", categories: ["Security"], confidence: 90,
    test: ({ html }) => /google\.com\/recaptcha|recaptcha\.net/i.test(html) },
  { name: "hCaptcha", categories: ["Security"], confidence: 90,
    test: ({ html }) => /hcaptcha\.com/i.test(html) },

  // ── Intercom / Chat ──────────────────────────────────────────────────────────
  { name: "Intercom", categories: ["Live Chat"], confidence: 88,
    test: ({ html }) => /intercomcdn\.com|intercom\.io/i.test(html) },
  { name: "Zendesk", categories: ["Live Chat"], confidence: 88,
    test: ({ html }) => /zopim\.com|zendesk\.com\/embeddable/i.test(html) },
];

// ─── Real adapter ──────────────────────────────────────────────────────────────

const realTechAdapter: TechDetectionAdapter = {
  async detect(url) {
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
      const $ = cheerio.load(html);

      // Collect all script src values for matching
      const scripts: string[] = [];
      $("script[src]").each((_, el) => {
        const src = $(el).attr("src");
        if (src) scripts.push(src);
      });
      $('link[rel="stylesheet"]').each((_, el) => {
        const href = $(el).attr("href");
        if (href) scripts.push(href);
      });

      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });

      const metaGenerator = $('meta[name="generator"]').attr("content") ?? "";
      const cookies = headers["set-cookie"] ?? "";

      const ctx = { html, $, headers, scripts, metaGenerator, cookies };

      const technologies = SIGNATURES
        .filter(sig => sig.test(ctx))
        .map(sig => ({
          name: sig.name,
          version: sig.version,
          categories: sig.categories,
          confidence: sig.confidence,
        }));

      return { technologies };
    } finally {
      clearTimeout(timer);
    }
  },
};

class TechnologyDetector implements AuditScanner<TechnologyProfile> {
  readonly name = "technology" as const;
  readonly description = "Identifies frameworks, libraries, CDN, CMS, analytics, and hosting from HTTP response";
  readonly version = "2.0.0";
  readonly adapter = "real-signature-detection";

  private techAdapter: TechDetectionAdapter;

  constructor(adapter: TechDetectionAdapter = realTechAdapter) {
    this.techAdapter = adapter;
  }

  async run(context: AuditContext): Promise<TechnologyProfile> {
    const startedAt = new Date();

    try {
      const { technologies } = await this.techAdapter.detect(context.url);

      const byCategory = (cat: string) =>
        technologies.filter(t => t.categories.includes(cat)).map(t => t.name);

      const frameworks = technologies
        .filter(t =>
          t.categories.some(c =>
            ["UI Frameworks", "JavaScript Frameworks", "Static Site Generators"].includes(c)
          )
        )
        .map(t => t.name);

      const libraries = technologies
        .filter(t =>
          t.categories.some(c =>
            ["JavaScript Libraries", "CSS Frameworks", "Module Bundlers"].includes(c)
          ) && !frameworks.includes(t.name)
        )
        .map(t => ({
          name: t.name,
          version: t.version,
          category: t.categories.includes("CSS Frameworks") ? "css-framework" : "js-library",
        } as TechnologyProfile["libraries"][number]));

      // Detect server / CDN / hosting from response headers (already in technologies)
      const cdnTech = technologies.find(t => t.categories.includes("CDN"));
      const hostingTech = technologies.find(t => t.categories.includes("PaaS"));
      const serverTech = technologies.find(t => t.categories.includes("Web Servers"));
      const cmsTech = technologies.find(t => t.categories.includes("CMS") || t.categories.includes("Ecommerce"));

      // Infer JS runtime from server-side tech
      let jsRuntime: string | undefined;
      if (technologies.some(t => t.name === "Node.js")) jsRuntime = "Node.js";

      const languages = ["HTML5", "CSS3", "JavaScript"];
      if (technologies.some(t => t.name === "PHP")) languages.push("PHP");
      if (technologies.some(t => t.name === "Node.js")) languages.push("TypeScript / Node.js");

      const completedAt = new Date();
      return {
        scannerName: "technology",
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        success: true,
        cms: cmsTech?.name,
        frameworks,
        libraries,
        cdn: cdnTech?.name,
        hosting: hostingTech?.name,
        analytics: byCategory("Analytics"),
        advertising: byCategory("Advertising Networks"),
        security: byCategory("Security"),
        fonts: technologies.filter(t => t.categories.includes("Web Fonts")).map(t => t.name),
        languages,
        server: hostingTech?.name ?? serverTech?.name,
        webServer: serverTech?.name,
        jsRuntime,
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
