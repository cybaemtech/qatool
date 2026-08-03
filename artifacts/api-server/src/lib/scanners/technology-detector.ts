// ─── Technology Detector ──────────────────────────────────────────────────────
// Two-pass detection:
//   Pass 1 (HTTP + cheerio)  — headers, static HTML, script src attributes
//   Pass 2 (Playwright)      — window globals, dynamically loaded scripts,
//                              runtime framework signatures
// Falls back to fetch-only if Playwright is unavailable.

import * as cheerio from "cheerio";
import type { AuditScanner, AuditContext, TechnologyProfile } from "../audit-types";
import { withPage } from "./playwright-browser";

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
  /** HTTP-only checks: html, scripts (srcs+hrefs), headers, metaGenerator, cookies */
  httpTest?: (ctx: {
    html: string;
    scripts: string[];
    headers: Record<string, string>;
    metaGenerator: string;
    cookies: string;
  }) => boolean;
  /** Browser-only checks: window globals etc. */
  browserTest?: (ctx: {
    globals: Record<string, boolean>;
    bodyClasses: string;
    html: string;
    scripts: string[];
  }) => boolean;
}

const SIGNATURES: Signature[] = [
  // ── JS Frameworks ──────────────────────────────────────────────────────────
  { name: "Next.js", categories: ["UI Frameworks", "JavaScript Frameworks"], confidence: 97,
    httpTest: ({ html }) => /__NEXT_DATA__|_next\/static/i.test(html),
    browserTest: ({ globals }) => globals["__NEXT_DATA__"] || globals["next"] },
  { name: "Nuxt.js", categories: ["UI Frameworks", "JavaScript Frameworks"], confidence: 95,
    httpTest: ({ html }) => /__NUXT__|_nuxt\//i.test(html),
    browserTest: ({ globals }) => globals["__NUXT__"] || globals["$nuxt"] },
  { name: "React", categories: ["UI Frameworks"], confidence: 90,
    httpTest: ({ html, scripts }) =>
      /react(?:\.min)?\.js|react-dom/i.test(scripts.join(" ")) ||
      /__REACT_|data-reactroot|data-reactid/i.test(html),
    browserTest: ({ globals }) => globals["React"] || globals["__REACT_DEVTOOLS_GLOBAL_HOOK__"] },
  { name: "Vue.js", categories: ["UI Frameworks"], confidence: 90,
    httpTest: ({ html, scripts }) =>
      /vue(?:\.min)?\.js|vue@/i.test(scripts.join(" ")) ||
      /data-v-[a-f0-9]+|__vue_/i.test(html),
    browserTest: ({ globals }) => globals["Vue"] || globals["__VUE__"] },
  { name: "Angular", categories: ["UI Frameworks"], confidence: 92,
    httpTest: ({ html, scripts }) =>
      /ng-version|ng-app|ng-controller/i.test(html) ||
      /angular(?:\.min)?\.js|@angular\//i.test(scripts.join(" ")),
    browserTest: ({ globals, html }) => globals["ng"] || /ng-version/i.test(html) },
  { name: "Svelte", categories: ["UI Frameworks"], confidence: 87,
    httpTest: ({ html, scripts }) =>
      /svelte-/i.test(html) || /svelte(?:\.min)?\.js/i.test(scripts.join(" ")),
    browserTest: ({ globals }) => globals["__svelte"] },
  { name: "Gatsby", categories: ["Static Site Generators"], confidence: 93,
    httpTest: ({ html }) => /___gatsby|gatsby-/i.test(html),
    browserTest: ({ globals }) => globals["___gatsby"] },
  { name: "Astro", categories: ["Static Site Generators"], confidence: 88,
    httpTest: ({ html }) => /astro-island|data-astro-/i.test(html),
    browserTest: ({ globals }) => globals["Astro"] },
  { name: "jQuery", categories: ["JavaScript Libraries"], confidence: 92,
    httpTest: ({ scripts, html }) =>
      /jquery(?:\.min)?\.js|jquery-[0-9]/i.test(scripts.join(" ")) ||
      /window\.\$\s*=|jQuery/i.test(html),
    browserTest: ({ globals }) => globals["jQuery"] || globals["$_jQuery"] },

  // ── CSS Frameworks ────────────────────────────────────────────────────────
  { name: "Tailwind CSS", categories: ["CSS Frameworks"], confidence: 87,
    httpTest: ({ html }) =>
      /class="[^"]*(?:flex|grid|p-\d|m-\d|text-(?:sm|lg|xl)|bg-(?:white|black|gray|red|blue)|border-|rounded-)/i.test(html) ||
      /tailwind/i.test(html) },
  { name: "Bootstrap", categories: ["CSS Frameworks"], confidence: 90,
    httpTest: ({ html, scripts }) =>
      /bootstrap(?:\.min)?\.(?:css|js)/i.test(scripts.join(" ")) ||
      /class="[^"]*(?:container-fluid|col-(?:sm|md|lg|xl)-\d|btn btn-|navbar-|modal fade)/i.test(html) },

  // ── Build tools ───────────────────────────────────────────────────────────
  { name: "Vite", categories: ["Build Tools"], confidence: 88,
    httpTest: ({ html, scripts }) =>
      /type="module"[^>]*src="[^"]*\.js"/i.test(html) ||
      /vite\/client|@vite\//i.test(scripts.join(" ")) ||
      /__vite_/i.test(html),
    browserTest: ({ globals }) => globals["__vite__"] || globals["__VITE_IS_MODERN__"] },
  { name: "Webpack", categories: ["Build Tools"], confidence: 85,
    httpTest: ({ html }) => /__webpack_require__|webpackJsonp/i.test(html),
    browserTest: ({ globals }) => globals["webpackChunk"] || globals["__webpack_require__"] },

  // ── CMS ───────────────────────────────────────────────────────────────────
  { name: "WordPress", categories: ["CMS"], confidence: 97,
    httpTest: ({ html, metaGenerator }) =>
      /wordpress/i.test(metaGenerator) ||
      /wp-content|wp-includes|wp-json/i.test(html) },
  { name: "Shopify", categories: ["Ecommerce"], confidence: 97,
    httpTest: ({ html, headers }) =>
      /cdn\.shopify\.com|shopify\.com\/s\/files/i.test(html) ||
      /shopify/i.test(headers["x-shopify-stage"] ?? "") },
  { name: "Drupal", categories: ["CMS"], confidence: 92,
    httpTest: ({ html, metaGenerator }) =>
      /drupal/i.test(metaGenerator) || /drupal\.js|sites\/default\/files/i.test(html) },
  { name: "Joomla", categories: ["CMS"], confidence: 92,
    httpTest: ({ html, metaGenerator }) =>
      /joomla/i.test(metaGenerator) || /\/media\/jui\//i.test(html) },
  { name: "Ghost", categories: ["CMS"], confidence: 90,
    httpTest: ({ html }) => /ghost\.io|ghost\/content/i.test(html) },
  { name: "Webflow", categories: ["Website Builders"], confidence: 92,
    httpTest: ({ html, headers }) =>
      /webflow\.com|data-wf-/i.test(html) ||
      /webflow/i.test(headers["x-powered-by"] ?? "") },
  { name: "Wix", categories: ["Website Builders"], confidence: 92,
    httpTest: ({ html }) => /wixstatic\.com|wix\.com/i.test(html) },
  { name: "Squarespace", categories: ["Website Builders"], confidence: 92,
    httpTest: ({ html }) => /squarespace\.com|static\.squarespace/i.test(html) },

  // ── Analytics ─────────────────────────────────────────────────────────────
  { name: "Google Analytics", categories: ["Analytics"], confidence: 95,
    httpTest: ({ html, scripts }) =>
      /google-analytics\.com|googletagmanager\.com\/gtag|gtag\(/i.test(html) ||
      /gtag\.js|analytics\.js/i.test(scripts.join(" ")),
    browserTest: ({ globals }) => globals["gtag"] || globals["ga"] },
  { name: "Google Tag Manager", categories: ["Analytics", "Tag Managers"], confidence: 93,
    httpTest: ({ html }) => /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]+/i.test(html),
    browserTest: ({ globals }) => globals["google_tag_manager"] },
  { name: "Meta Pixel", categories: ["Analytics", "Advertising Networks"], confidence: 95,
    httpTest: ({ html }) => /connect\.facebook\.net|fbq\(|facebook\.com\/tr/i.test(html),
    browserTest: ({ globals }) => globals["fbq"] || globals["_fbq"] },
  { name: "LinkedIn Insight", categories: ["Analytics", "Advertising Networks"], confidence: 93,
    httpTest: ({ html }) => /snap\.licdn\.com|linkedin\.com\/px|_linkedin_/i.test(html),
    browserTest: ({ globals }) => globals["_linkedin_data_partner_ids"] },
  { name: "Microsoft Clarity", categories: ["Analytics"], confidence: 93,
    httpTest: ({ html }) => /clarity\.ms|microsoft clarity/i.test(html),
    browserTest: ({ globals }) => globals["clarity"] },
  { name: "Hotjar", categories: ["Analytics"], confidence: 92,
    httpTest: ({ html }) => /hotjar\.com|hjSetting/i.test(html),
    browserTest: ({ globals }) => globals["hj"] || globals["hjSiteSettings"] },
  { name: "Segment", categories: ["Analytics"], confidence: 90,
    httpTest: ({ html }) => /cdn\.segment\.com|analytics\.js/i.test(html),
    browserTest: ({ globals }) => globals["analytics"] && globals["analytics.identify"] },
  { name: "Mixpanel", categories: ["Analytics"], confidence: 90,
    httpTest: ({ html }) => /cdn\.mxpnl\.com|mixpanel\.com/i.test(html),
    browserTest: ({ globals }) => globals["mixpanel"] },
  { name: "Plausible", categories: ["Analytics"], confidence: 92,
    httpTest: ({ html }) => /plausible\.io/i.test(html) },
  { name: "PostHog", categories: ["Analytics"], confidence: 90,
    httpTest: ({ html }) => /posthog\.com|us\.i\.posthog\.com/i.test(html),
    browserTest: ({ globals }) => globals["posthog"] },

  // ── CDN / Hosting ─────────────────────────────────────────────────────────
  { name: "Cloudflare", categories: ["CDN"], confidence: 92,
    httpTest: ({ headers }) =>
      !!headers["cf-ray"] || /cloudflare/i.test(headers["server"] ?? "") },
  { name: "AWS CloudFront", categories: ["CDN"], confidence: 90,
    httpTest: ({ headers }) => /cloudfront/i.test(headers["via"] ?? headers["server"] ?? "") },
  { name: "Fastly", categories: ["CDN"], confidence: 90,
    httpTest: ({ headers }) => /fastly/i.test(headers["via"] ?? headers["server"] ?? "") },
  { name: "Vercel", categories: ["PaaS"], confidence: 92,
    httpTest: ({ headers }) =>
      !!headers["x-vercel-id"] || /vercel/i.test(headers["server"] ?? "") },
  { name: "Netlify", categories: ["PaaS"], confidence: 92,
    httpTest: ({ headers, html }) =>
      !!headers["x-nf-request-id"] || /netlify/i.test(html) },

  // ── Server / Runtime ──────────────────────────────────────────────────────
  { name: "Node.js", categories: ["Programming Languages", "Web Servers"], confidence: 82,
    httpTest: ({ headers }) => /node|express/i.test(headers["x-powered-by"] ?? "") },
  { name: "PHP", categories: ["Programming Languages"], confidence: 87,
    httpTest: ({ headers }) => /php/i.test(headers["x-powered-by"] ?? headers["server"] ?? "") },
  { name: "nginx", categories: ["Web Servers"], confidence: 90,
    httpTest: ({ headers }) => /nginx/i.test(headers["server"] ?? "") },
  { name: "Apache", categories: ["Web Servers"], confidence: 90,
    httpTest: ({ headers }) => /apache/i.test(headers["server"] ?? "") },

  // ── Payments ──────────────────────────────────────────────────────────────
  { name: "Stripe", categories: ["Payment Processors"], confidence: 90,
    httpTest: ({ html, scripts }) =>
      /js\.stripe\.com|stripe\.com\/v[0-9]/i.test(html) ||
      /stripe/i.test(scripts.join(" ")),
    browserTest: ({ globals }) => globals["Stripe"] },
  { name: "PayPal", categories: ["Payment Processors"], confidence: 90,
    httpTest: ({ html }) => /paypal\.com\/sdk|paypalobjects\.com/i.test(html) },

  // ── Fonts ─────────────────────────────────────────────────────────────────
  { name: "Google Fonts", categories: ["Web Fonts"], confidence: 95,
    httpTest: ({ html }) => /fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(html) },
  { name: "Typekit / Adobe Fonts", categories: ["Web Fonts"], confidence: 90,
    httpTest: ({ html }) => /use\.typekit\.net|use\.typekit\.com/i.test(html) },

  // ── Security / Captcha ────────────────────────────────────────────────────
  { name: "reCAPTCHA", categories: ["Security"], confidence: 92,
    httpTest: ({ html }) => /google\.com\/recaptcha|recaptcha\.net/i.test(html),
    browserTest: ({ globals }) => globals["grecaptcha"] },
  { name: "hCaptcha", categories: ["Security"], confidence: 92,
    httpTest: ({ html }) => /hcaptcha\.com/i.test(html),
    browserTest: ({ globals }) => globals["hcaptcha"] },

  // ── Live Chat ─────────────────────────────────────────────────────────────
  { name: "Intercom", categories: ["Live Chat"], confidence: 90,
    httpTest: ({ html }) => /intercomcdn\.com|intercom\.io/i.test(html),
    browserTest: ({ globals }) => globals["Intercom"] },
  { name: "Zendesk", categories: ["Live Chat"], confidence: 90,
    httpTest: ({ html }) => /zopim\.com|zendesk\.com\/embeddable/i.test(html) },
];

// ─── Real adapter: HTTP pass + optional Playwright pass ──────────────────────

const realTechAdapter: TechDetectionAdapter = {
  async detect(url) {
    const detected = new Map<string, { name: string; version?: string; categories: string[]; confidence: number }>();

    // ── Pass 1: HTTP fetch + cheerio (fast, no browser) ─────────────────────
    let html = "";
    let scripts: string[] = [];
    let headers: Record<string, string> = {};
    let metaGenerator = "";
    let cookies = "";

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
        },
        redirect: "follow",
      });
      clearTimeout(timer);

      html = await res.text();
      const $ = cheerio.load(html);

      $("script[src]").each((_, el) => { const s = $(el).attr("src"); if (s) scripts.push(s); });
      $('link[rel="stylesheet"]').each((_, el) => { const h = $(el).attr("href"); if (h) scripts.push(h); });

      res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
      metaGenerator = $('meta[name="generator"]').attr("content") ?? "";
      cookies = headers["set-cookie"] ?? "";

      const httpCtx = { html, scripts, headers, metaGenerator, cookies };
      for (const sig of SIGNATURES) {
        if (sig.httpTest && sig.httpTest(httpCtx)) {
          detected.set(sig.name, { name: sig.name, version: sig.version, categories: sig.categories, confidence: sig.confidence });
        }
      }
    } catch {
      // If HTTP fetch fails entirely, proceed to Playwright-only pass
    }

    // ── Pass 2: Playwright browser inspection (window globals, dynamic content) ──
    try {
      const browserFindings = await withPage(async (page) => {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
        await page.waitForTimeout(2000); // Let analytics/frameworks initialize

        return page.evaluate(() => {
          // Probe for well-known window globals
          const globalNames = [
            "React", "__REACT_DEVTOOLS_GLOBAL_HOOK__", "Vue", "__VUE__",
            "angular", "ng", "Nuxt", "__NUXT__", "$nuxt", "___gatsby",
            "next", "__NEXT_DATA__", "Astro", "jQuery", "$",
            "gtag", "ga", "google_tag_manager", "fbq", "_fbq",
            "_linkedin_data_partner_ids", "clarity", "hj", "hjSiteSettings",
            "mixpanel", "analytics", "posthog", "Stripe", "grecaptcha",
            "hcaptcha", "Intercom",
            "webpackChunk", "__webpack_require__", "__vite__", "__VITE_IS_MODERN__",
            "__svelte",
          ];

          const globals: Record<string, boolean> = {};
          for (const name of globalNames) {
            try {
              globals[name] = (window as unknown as Record<string, unknown>)[name] !== undefined;
            } catch {
              globals[name] = false;
            }
          }

          // Also check for webpackChunk_* patterns (any key starting with webpackChunk)
          if (!globals["webpackChunk"]) {
            globals["webpackChunk"] = Object.keys(window).some(k => k.startsWith("webpackChunk"));
          }

          const bodyClasses = document.body?.className ?? "";
          const renderedHtml = document.documentElement.outerHTML.slice(0, 50000);

          return { globals, bodyClasses, renderedHtml };
        });
      }, { timeoutMs: 35000 });

      const browserCtx = {
        globals: browserFindings.globals,
        bodyClasses: browserFindings.bodyClasses,
        html: browserFindings.renderedHtml,
        scripts,
      };

      for (const sig of SIGNATURES) {
        if (sig.browserTest && sig.browserTest(browserCtx)) {
          if (!detected.has(sig.name)) {
            detected.set(sig.name, { name: sig.name, version: sig.version, categories: sig.categories, confidence: sig.confidence });
          } else {
            // Boost confidence if confirmed by browser
            const existing = detected.get(sig.name)!;
            detected.set(sig.name, { ...existing, confidence: Math.min(99, existing.confidence + 3) });
          }
        }
      }
    } catch {
      // Browser pass failed — rely on HTTP pass results only
    }

    return { technologies: Array.from(detected.values()) };
  },
};

class TechnologyDetector implements AuditScanner<TechnologyProfile> {
  readonly name = "technology" as const;
  readonly description =
    "Two-pass detection: HTTP headers + static HTML (pass 1), Playwright window globals + rendered DOM (pass 2)";
  readonly version = "3.0.0";
  readonly adapter = "http+playwright-dual-pass";

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
        .filter(t => t.categories.some(c =>
          ["UI Frameworks", "JavaScript Frameworks", "Static Site Generators"].includes(c)
        ))
        .map(t => t.name);

      const libraries = technologies
        .filter(t =>
          t.categories.some(c =>
            ["JavaScript Libraries", "CSS Frameworks", "Build Tools"].includes(c)
          ) && !frameworks.includes(t.name)
        )
        .map(t => ({
          name: t.name,
          version: t.version,
          category: (
            t.categories.includes("CSS Frameworks") ? "css-framework" :
            t.categories.includes("Build Tools")    ? "build-tool" :
            "js-library"
          ) as TechnologyProfile["libraries"][number]["category"],
        }));

      const cdnTech     = technologies.find(t => t.categories.includes("CDN"));
      const hostingTech = technologies.find(t => t.categories.includes("PaaS"));
      const serverTech  = technologies.find(t => t.categories.includes("Web Servers"));
      const cmsTech     = technologies.find(t => t.categories.includes("CMS") || t.categories.includes("Ecommerce"));

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
        cms:      cmsTech?.name,
        frameworks,
        libraries,
        cdn:      cdnTech?.name,
        hosting:  hostingTech?.name,
        analytics:   byCategory("Analytics"),
        advertising: byCategory("Advertising Networks"),
        security:    byCategory("Security"),
        fonts:       technologies.filter(t => t.categories.includes("Web Fonts")).map(t => t.name),
        languages,
        server:    hostingTech?.name ?? serverTech?.name,
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
        frameworks: [], libraries: [], analytics: [], advertising: [],
        security: [], fonts: [], languages: [],
      };
    }
  }
}

export default new TechnologyDetector();
export { TechnologyDetector };
