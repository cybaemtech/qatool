import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Bot, Sparkles, ChevronDown, ChevronUp, Copy, Check,
  AlertTriangle, Zap, Shield, Eye, Search, Code2,
  TrendingUp, BookOpen, ExternalLink,
  Clock, Target, Gauge, FileCode2, ArrowRight,
  CheckCircle2, XCircle, Minus, CheckSquare, Square,
  GitBranch, History, BarChart3, Lightbulb,
  TriangleAlert, Cpu, Link2, Image, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Bug } from "@workspace/api-client-react";

// ─── Bug category detection ──────────────────────────────────────────────────

type BugCategory =
  | "missing-alt"
  | "duplicate-h1"
  | "missing-meta"
  | "large-images"
  | "javascript-error"
  | "accessibility-label"
  | "broken-link"
  | "color-contrast"
  | "bundle"
  | "security"
  | "session"
  | "performance"
  | "generic";

function detectCategory(bug: Bug): BugCategory {
  const text = `${bug.title} ${bug.description ?? ""}`.toLowerCase();
  if (/alt text|alt attribute|missing alt|without alt/.test(text)) return "missing-alt";
  if (/duplicate h1|multiple h1|two h1|h1 tag/.test(text)) return "duplicate-h1";
  if (/meta description|missing meta/.test(text)) return "missing-meta";
  if (/large image|unoptimized|lcp|largest contentful|2\.4mb|jpeg.*hero/.test(text)) return "large-images";
  if (/javascript|runtime error|typeerror|uncaught|null.*reading|cannot read/.test(text)) return "javascript-error";
  if (/label|aria|form input|unlabeled|placeholder/.test(text)) return "accessibility-label";
  if (/broken link|broken internal|404|careers-old/.test(text)) return "broken-link";
  if (/contrast|color contrast|4\.5/.test(text)) return "color-contrast";
  if (/bundle|minif|render-blocking|unminified|tree-shak/.test(text)) return "bundle";
  if (/csp|content-security|security|jquery|cve|xss|prototype/.test(text)) return "security";
  if (/session|logout|expire|inactivity/.test(text)) return "session";
  if (/speed|load|perf|slow|blocking|cls|tti|render/.test(text)) return "performance";
  return "generic";
}

// ─── Analysis generation ─────────────────────────────────────────────────────

interface BugAnalysis {
  rootCause: string;
  businessImpact: string;
  technicalImpact: string;
  confidence: number;
  regressionRisk: "Low" | "Medium" | "High";
  fixTime: string;
  qaTime: string;
  affectedComponents: string[];
  affectedFiles: string[];
  immediateFix: string;
  longTermFix: string;
  performanceImpact: string;
  accessibilityImpact: string;
  seoImpact: string;
  securityImpact: string;
  difficulty: "Easy" | "Medium" | "Hard";
  codeExample: CodeExample;
  scoreDeltas: ScoreDeltas;
  checklist: string[];
  learning: LearningContent;
  relatedIssues: RelatedIssues;
  confidenceReasoning: string;
}

interface CodeExample {
  label: string;
  current: string;
  suggested: string;
  why: string;
  improvement: string;
}

interface ScoreDeltas {
  performance: [number, number];
  accessibility: [number, number];
  seo: [number, number];
  health: [number, number];
}

interface LearningContent {
  why: string;
  matters: string;
  browserBehavior: string;
  userImpact: string;
  bestPractices: string[];
  references: { label: string; url: string }[];
}

interface RelatedIssues {
  similar: string[];
  sameComponent: string[];
  trend: string;
}

const CATALOG: Record<BugCategory, BugAnalysis> = {
  "missing-alt": {
    rootCause: "Images rendered without descriptive alt attributes. The HTML img elements rely on visual context only, making them invisible to non-visual agents.",
    businessImpact: "Violates WCAG 2.1 AA compliance (§1.1.1). Exposes company to accessibility litigation and reduces SEO crawlability of image-heavy pages.",
    technicalImpact: "Screen readers announce images as 'image' with no description. Search crawlers cannot index image content, reducing image-search visibility.",
    confidence: 94,
    regressionRisk: "Low",
    fixTime: "1–2 hours",
    qaTime: "30 minutes",
    affectedComponents: ["ImageGallery", "ProductCard", "HeroBanner"],
    affectedFiles: ["components/ImageGallery.tsx", "components/ProductCard.tsx", "pages/Home.tsx"],
    immediateFix: "Add descriptive alt attributes to all img elements. Use empty alt='' for purely decorative images to tell screen readers to skip them.",
    longTermFix: "Integrate an accessibility linter (eslint-plugin-jsx-a11y) into CI/CD to prevent missing alt regressions. Add image-upload validation that requires alt text in the CMS.",
    performanceImpact: "None",
    accessibilityImpact: "+8–12 points — directly resolves a Level A criterion",
    seoImpact: "+3–5 points — images become crawlable and indexable",
    securityImpact: "None",
    difficulty: "Easy",
    codeExample: {
      label: "Missing alt text on images",
      current: `<img src="/products/hero.jpg" />
<img src="/icons/arrow.svg" />`,
      suggested: `<img src="/products/hero.jpg"
     alt="Blue running shoes on a white background" />
<img src="/icons/arrow.svg" alt="" aria-hidden="true" />`,
      why: "The first alt provides meaningful context for screen readers and search engines. The empty alt on the decorative icon tells assistive tech to ignore it — preventing redundant announcements.",
      improvement: "Accessibility score +10, SEO score +4 (estimated)",
    },
    scoreDeltas: { performance: [82, 82], accessibility: [74, 84], seo: [79, 83], health: [79, 85] },
    checklist: ["Audit all img elements with DevTools", "Add descriptive alt to content images", "Add alt='' to decorative images", "Run axe-core or Lighthouse accessibility pass", "Verify with screen reader (NVDA / VoiceOver)"],
    learning: {
      why: "The img element requires an alt attribute because HTML has no way to infer what an image contains from its filename or URL alone.",
      matters: "Approximately 2.2 billion people have a vision impairment. Screen readers are their primary browser. Without alt text, they receive zero information about the image.",
      browserBehavior: "Screen readers (NVDA, JAWS, VoiceOver) read alt text aloud when they encounter an img. If alt is missing, they fall back to the filename, which is usually meaningless.",
      userImpact: "Blind users hear 'image' with no context. Low-vision users who zoom in get no text fallback if the image fails to load.",
      bestPractices: ["Be specific and concise (under 125 chars)", "Describe the image's function, not just appearance", "Use alt='' for purely decorative images", "Never use 'image of' or 'picture of' — screen readers already announce it's an image"],
      references: [
        { label: "WCAG 1.1.1 Non-text Content", url: "https://www.w3.org/WAI/WCAG21/Understanding/non-text-content" },
        { label: "MDN: alt attribute", url: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#alt" },
      ],
    },
    relatedIssues: {
      similar: ["Form inputs missing associated labels", "Missing ARIA roles on custom widgets"],
      sameComponent: ["Color contrast on image overlay text", "Keyboard trap in image lightbox"],
      trend: "Accessibility issues have appeared in 4 of the last 5 audits — recommend a dedicated a11y sprint.",
    },
    confidenceReasoning: "Pattern directly matches WCAG 1.1.1 failure criteria. Confidence is high because the audit explicitly identified specific images lacking alt attributes.",
  },

  "duplicate-h1": {
    rootCause: "The page template renders two H1 elements — typically one in a site-wide header component and a second in the page-specific content block.",
    businessImpact: "Dilutes the primary keyword signal sent to search crawlers. Google uses the H1 as a strong ranking signal; multiple H1s send conflicting intent.",
    technicalImpact: "Both elements compete for semantic heading hierarchy. Screen readers navigate by heading level — duplicate H1s break the logical document outline.",
    confidence: 91,
    regressionRisk: "Low",
    fixTime: "30–60 minutes",
    qaTime: "20 minutes",
    affectedComponents: ["Layout", "PageHeader", "CategoryPage"],
    affectedFiles: ["components/Layout.tsx", "pages/Category.tsx", "components/PageHeader.tsx"],
    immediateFix: "Demote the secondary H1 to H2. Ensure each page has exactly one H1 that describes the primary topic of that specific page.",
    longTermFix: "Add a heading-hierarchy lint rule (eslint-plugin-jsx-a11y/heading-has-content) and write a Playwright test that asserts a single H1 per route.",
    performanceImpact: "None",
    accessibilityImpact: "+4–6 points — restores correct document outline for screen readers",
    seoImpact: "+6–10 points — removes conflicting keyword signals",
    securityImpact: "None",
    difficulty: "Easy",
    codeExample: {
      label: "Duplicate H1 tags on category pages",
      current: `<!-- Layout.tsx (site header) -->
<h1>Horizon Retail</h1>

<!-- Category.tsx (page content) -->
<h1>Running Shoes</h1>`,
      suggested: `<!-- Layout.tsx — use a span or p for brand name -->
<span class="site-brand">Horizon Retail</span>

<!-- Category.tsx — the ONE H1 per page -->
<h1>Running Shoes</h1>`,
      why: "Each page must have exactly one H1 that describes its unique topic. Brand names in site headers should use semantic-neutral elements.",
      improvement: "SEO score +8, Accessibility score +5 (estimated)",
    },
    scoreDeltas: { performance: [80, 80], accessibility: [78, 83], seo: [72, 80], health: [77, 83] },
    checklist: ["Audit H1 count per route with document.querySelectorAll('h1')", "Refactor site-header brand to span or aria-label on nav", "Confirm each page has exactly one H1", "Review heading hierarchy (H1→H2→H3) per page", "Re-run SEO audit to validate"],
    learning: {
      why: "Search engines and assistive technologies treat the H1 as the primary title of a page. HTML allows multiple H1s syntactically, but semantically it creates an ambiguous document outline.",
      matters: "A confused heading hierarchy makes it harder for Google to understand page topic and harder for screen reader users to navigate by heading.",
      browserBehavior: "Modern browsers render all H1 elements identically, so users don't see a visual problem — the damage is invisible and only affects SEO and a11y agents.",
      userImpact: "Screen reader users pressing H to jump between headings hit two H1s and lose their mental model of the page structure.",
      bestPractices: ["One H1 per page, describing the unique content of that specific page", "Use H2–H6 for sub-sections in strict hierarchical order", "Never skip heading levels (H1 → H3 is invalid)", "Site names belong in the <title>, <nav>, or as styled text — not H1"],
      references: [
        { label: "Google SEO Starter Guide: Use heading tags", url: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide" },
        { label: "WCAG 2.4.6: Headings and Labels", url: "https://www.w3.org/WAI/WCAG21/Understanding/headings-and-labels" },
      ],
    },
    relatedIssues: {
      similar: ["Missing meta description on key landing pages", "Canonical URLs missing on paginated listings"],
      sameComponent: ["Missing structured data on category pages", "Title tag duplication"],
      trend: "SEO issues have been present in all 5 recent audits. A systematic SEO audit is recommended.",
    },
    confidenceReasoning: "Exact pattern match to a known structural HTML/SEO anti-pattern. Template-level H1 in site header is a recurring issue in component-based frameworks.",
  },

  "missing-meta": {
    rootCause: "Page templates do not populate the <meta name='description'> tag with page-specific content. The tag is either absent or uses a generic site-wide fallback.",
    businessImpact: "Google auto-generates snippets for pages without meta descriptions, often choosing irrelevant body text. CTR from search results drops 5–10% on average.",
    technicalImpact: "Each missing meta description is a missed opportunity to control the 160-char search snippet shown to potential visitors.",
    confidence: 89,
    regressionRisk: "Low",
    fixTime: "2–4 hours",
    qaTime: "45 minutes",
    affectedComponents: ["SEOHead", "MetaManager", "PricingPage", "FeaturesPage"],
    affectedFiles: ["components/SEOHead.tsx", "pages/Pricing.tsx", "pages/Features.tsx"],
    immediateFix: "Add a unique, keyword-rich meta description (120–155 chars) to every page, especially high-value landing pages like Pricing, Features, and About.",
    longTermFix: "Integrate a CMS or config-driven SEO metadata system so content authors can set meta descriptions without code changes. Add a CI check that warns on missing meta tags.",
    performanceImpact: "None",
    accessibilityImpact: "None",
    seoImpact: "+5–8 points — directly resolves a missing signal for search snippet generation",
    securityImpact: "None",
    difficulty: "Easy",
    codeExample: {
      label: "Missing meta description",
      current: `<head>
  <title>Pricing – Lumen Labs</title>
  <!-- no meta description -->
</head>`,
      suggested: `<head>
  <title>Pricing – Lumen Labs</title>
  <meta
    name="description"
    content="Explore Lumen Labs pricing plans.
    Start free, upgrade as you grow.
    Transparent pricing with no hidden fees."
  />
  <meta property="og:description"
    content="Flexible pricing for every team size." />
</head>`,
      why: "A unique meta description gives Google a controlled 155-char snippet and improves click-through rates from search results pages. The og:description covers social sharing.",
      improvement: "SEO score +6, estimated CTR +7% for affected pages",
    },
    scoreDeltas: { performance: [81, 81], accessibility: [80, 80], seo: [74, 80], health: [78, 82] },
    checklist: ["List all pages missing meta description", "Write unique descriptions (120–155 chars) per page", "Add og:description for social sharing", "Test snippets in Google's Rich Results Test", "Monitor CTR change in Search Console after deploy"],
    learning: {
      why: "HTML pages don't automatically generate search snippets. Google reads the meta description tag as a hint for what to show in search results.",
      matters: "Meta descriptions are direct real estate in search results. A compelling description can double CTR over a generic auto-generated snippet.",
      browserBehavior: "Browsers don't display meta descriptions to users. They're purely for crawlers and social platforms. Chrome DevTools → Elements → head is the best way to inspect them.",
      userImpact: "Users see an unhelpful or irrelevant snippet in search results and may choose a competitor's result instead.",
      bestPractices: ["Keep under 155 characters to avoid truncation", "Include the primary keyword naturally", "Write for the user, not for bots — describe what the page delivers", "Each page should have a unique description"],
      references: [
        { label: "Google: Meta description best practices", url: "https://developers.google.com/search/docs/appearance/snippet" },
        { label: "Moz: Meta description guide", url: "https://moz.com/learn/seo/meta-description" },
      ],
    },
    relatedIssues: {
      similar: ["Duplicate H1 tags on category pages", "Canonical URLs missing on paginated listings"],
      sameComponent: ["Missing Open Graph tags", "Missing structured data"],
      trend: "SEO issues consistent across 4 recent audits — meta tag hygiene is a recurring gap.",
    },
    confidenceReasoning: "Meta description absence is directly detectable by HTML parsing. High confidence because this is a binary check with no ambiguity.",
  },

  "large-images": {
    rootCause: "Hero and product images are served as unoptimized original files (JPEG/PNG) without WebP conversion, responsive srcset, or lazy loading. The browser downloads the full-resolution asset even on mobile.",
    businessImpact: "Every 1-second delay in page load reduces conversions by ~7% (Cloudflare data). A 2.4MB hero image on mobile 3G takes 8+ seconds to load, directly harming sales.",
    technicalImpact: "Large images are the #1 cause of poor LCP (Largest Contentful Paint). They consume bandwidth, delay Time to Interactive, and inflate Core Web Vitals scores.",
    confidence: 96,
    regressionRisk: "Medium",
    fixTime: "4–8 hours",
    qaTime: "2 hours",
    affectedComponents: ["HeroBanner", "ProductCard", "ImageGallery"],
    affectedFiles: ["components/HeroBanner.tsx", "public/images/hero.jpg", "components/ProductCard.tsx"],
    immediateFix: "Convert the hero image to WebP (80% quality) and serve via <picture> element with srcset for responsive sizes. Add loading='lazy' to below-the-fold images.",
    longTermFix: "Integrate an image CDN (Cloudinary, Imgix, or Next.js Image component) that auto-converts to WebP and generates responsive sizes at build time.",
    performanceImpact: "+12–18 points — LCP is the most impactful Core Web Vital for performance scores",
    accessibilityImpact: "None",
    seoImpact: "+3–5 points — Core Web Vitals are a Google ranking signal",
    securityImpact: "None",
    difficulty: "Medium",
    codeExample: {
      label: "Unoptimized hero image",
      current: `<img
  src="/images/hero.jpg"
  class="hero-image"
/>`,
      suggested: `<picture>
  <source
    type="image/webp"
    srcset="
      /images/hero-400.webp 400w,
      /images/hero-800.webp 800w,
      /images/hero-1200.webp 1200w"
    sizes="(max-width: 768px) 100vw, 50vw"
  />
  <img
    src="/images/hero-800.jpg"
    alt="Blue running shoes hero"
    width="1200"
    height="600"
    loading="eager"
    fetchpriority="high"
  />
</picture>
<!-- Below-the-fold images: use loading="lazy" -->`,
      why: "The <picture> element serves WebP to modern browsers (80% smaller) with JPEG fallback. Width/height attributes prevent layout shift (CLS). fetchpriority='high' hints the browser to preload the LCP element.",
      improvement: "Performance score +15, LCP reduced from ~4s to ~1.2s (estimated on mobile)",
    },
    scoreDeltas: { performance: [68, 83], accessibility: [80, 80], seo: [79, 82], health: [75, 84] },
    checklist: ["Identify all images >200KB with Chrome Network tab", "Convert to WebP using cwebp or Squoosh", "Implement srcset with 400/800/1200w breakpoints", "Add width/height attributes to prevent CLS", "Add loading='lazy' to below-the-fold images", "Test LCP with Lighthouse after deploy"],
    learning: {
      why: "Web browsers download images at the size they're served, regardless of the CSS size they're displayed at. A 2.4MB image displayed at 400px wide still costs 2.4MB of bandwidth.",
      matters: "Images account for 50–70% of page weight on most sites. Unoptimized images are the single biggest contributor to slow page loads.",
      browserBehavior: "The browser's preload scanner fetches images early in the parse — before JavaScript runs. This means image size directly affects how quickly the page first renders.",
      userImpact: "On a 3G mobile connection (still common globally), a 2.4MB image takes 6–8 seconds to load. Most users abandon pages that take >3 seconds.",
      bestPractices: ["Always serve WebP with JPEG/PNG fallback via <picture>", "Use srcset and sizes for responsive images", "Set explicit width/height to prevent layout shift", "Lazy-load anything below the fold", "Use a CDN with on-the-fly image optimization"],
      references: [
        { label: "web.dev: Optimize images", url: "https://web.dev/fast/#optimize-your-images" },
        { label: "Google: LCP optimization guide", url: "https://web.dev/lcp/" },
      ],
    },
    relatedIssues: {
      similar: ["Render-blocking JavaScript delays first paint", "Unminified bundle shipped to production"],
      sameComponent: ["Missing width/height on images causing CLS", "No lazy loading on product grid"],
      trend: "Performance scores have trended upward recently (+8 pts over 5 audits) but image optimization remains the primary blocker for reaching 90+.",
    },
    confidenceReasoning: "Image file size is directly measurable. The audit captured the exact file size and LCP impact. Very high confidence in both diagnosis and projected improvement.",
  },

  "javascript-error": {
    rootCause: "A null/undefined value is accessed without a guard check. The error typically occurs in an async data-fetch callback where the DOM element or API response is referenced before it is available.",
    businessImpact: "If this occurs on a checkout or conversion-critical page, it directly blocks revenue. JavaScript errors that surface to users destroy trust and cause immediate abandonment.",
    technicalImpact: "Uncaught exceptions halt JavaScript execution on the affected stack. Dependent UI components may fail to mount, leaving users with a broken or empty page state.",
    confidence: 97,
    regressionRisk: "High",
    fixTime: "2–4 hours",
    qaTime: "1 hour",
    affectedComponents: ["CheckoutForm", "ShippingStep", "CountrySelector"],
    affectedFiles: ["components/CheckoutForm.tsx", "hooks/useShipping.ts", "pages/Checkout.tsx"],
    immediateFix: "Add optional chaining (?.) or an explicit null check before accessing the property. Add a try/catch with a user-visible fallback state around the affected block.",
    longTermFix: "Add a React Error Boundary wrapping checkout steps so a single component failure degrades gracefully. Integrate Sentry for real-user error monitoring.",
    performanceImpact: "None",
    accessibilityImpact: "None",
    seoImpact: "+2 points — reduces crawl errors if the error prevents content from rendering",
    securityImpact: "+2 points — prevents error stack traces from leaking to console",
    difficulty: "Medium",
    codeExample: {
      label: "Null dereference in form handler",
      current: `// Crashes when country is not pre-selected
function onShippingMount() {
  const value = document
    .getElementById('country-select')
    .value; // TypeError: Cannot read properties of null
  setCountry(value);
}`,
      suggested: `function onShippingMount() {
  const el = document.getElementById('country-select');
  if (!el) {
    console.warn('[Shipping] country-select not found');
    setCountry('');
    return;
  }
  setCountry(el.value);
}

// Even better — use a React ref instead of getElementById
const countryRef = useRef<HTMLSelectElement>(null);
// <select ref={countryRef} ...>`,
      why: "getElementById returns null when the element doesn't exist. Without the null guard, accessing .value throws immediately. Using a React ref is safer because TypeScript enforces the null check at compile time.",
      improvement: "Eliminates the runtime error. Checkout completion rate expected to recover by 5–15% on affected user segments.",
    },
    scoreDeltas: { performance: [79, 79], accessibility: [80, 82], seo: [80, 82], health: [80, 88] },
    checklist: ["Reproduce error locally with empty country state", "Add null guard or optional chaining", "Wrap checkout steps in React Error Boundary", "Add Sentry (or equivalent) for production monitoring", "Write unit test for the null-country case", "QA the full checkout flow end-to-end"],
    learning: {
      why: "JavaScript is dynamically typed — accessing a property on null throws a TypeError at runtime, not compile time. This is one of the most common JavaScript bugs.",
      matters: "Runtime errors on critical user flows (checkout, login, signup) directly cost revenue. A single null-dereference crashing the checkout can block 100% of users in that state.",
      browserBehavior: "When an uncaught exception is thrown, JavaScript halts execution for that event handler. React doesn't catch errors thrown outside component render — they escape to the browser and may leave the UI in a broken half-rendered state.",
      userImpact: "Users see a frozen or blank UI with no error message. They have no way to recover without refreshing, and they lose their cart or form progress.",
      bestPractices: ["Use TypeScript to catch null access at compile time", "Use optional chaining (?.) for uncertain values", "Wrap async operations in try/catch with user-facing fallbacks", "Use React Error Boundaries around critical sections", "Monitor production errors with Sentry or Datadog RUM"],
      references: [
        { label: "MDN: Optional chaining (?.)", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining" },
        { label: "React: Error Boundaries", url: "https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary" },
      ],
    },
    relatedIssues: {
      similar: ["API request failure on dashboard load", "Session expires without warning during checkout"],
      sameComponent: ["Missing loading state on checkout form", "Race condition in payment handler"],
      trend: "JavaScript errors have appeared in 3 of the last 5 audits. Recommend adding an error monitoring service and increasing unit test coverage on data-fetch paths.",
    },
    confidenceReasoning: "JavaScript runtime errors are captured verbatim during audit execution. The exact error message and stack trace are available, making this a very high-confidence diagnosis.",
  },

  "accessibility-label": {
    rootCause: "Interactive form elements rely solely on placeholder text for labeling. When a user begins typing, the placeholder disappears — leaving no persistent label for the input.",
    businessImpact: "Non-compliance with WCAG 2.1 AA (§1.3.1 and §4.1.2). Forms without labels convert at lower rates — users forget what field they're filling in after clicking.",
    technicalImpact: "Screen readers cannot associate the placeholder with the input programmatically. Autocomplete features are also less reliable without proper labels.",
    confidence: 93,
    regressionRisk: "Low",
    fixTime: "1–2 hours",
    qaTime: "30 minutes",
    affectedComponents: ["SearchBar", "NewsletterSignup", "LoginForm"],
    affectedFiles: ["components/SearchBar.tsx", "components/Newsletter.tsx", "pages/Login.tsx"],
    immediateFix: "Add a <label> element associated with each input via htmlFor/id pair. If visual labels are not desired, use aria-label or aria-labelledby.",
    longTermFix: "Adopt a form component library that enforces accessible labeling by default (e.g. Radix UI FormField, React Hook Form with Zod). Add eslint-plugin-jsx-a11y to CI.",
    performanceImpact: "None",
    accessibilityImpact: "+6–9 points — resolves Level A WCAG criteria",
    seoImpact: "+2 points — better semantic structure improves crawlability",
    securityImpact: "None",
    difficulty: "Easy",
    codeExample: {
      label: "Form input missing label",
      current: `<input
  type="email"
  placeholder="Enter your email"
  className="newsletter-input"
/>`,
      suggested: `{/* Option 1: Visible label (preferred) */}
<div className="form-group">
  <label htmlFor="newsletter-email">
    Email address
  </label>
  <input
    id="newsletter-email"
    type="email"
    placeholder="you@example.com"
    autoComplete="email"
  />
</div>

{/* Option 2: Visually hidden label */}
<input
  type="email"
  aria-label="Email address for newsletter"
  placeholder="Enter your email"
  autoComplete="email"
/>`,
      why: "The htmlFor/id association lets screen readers announce the label when the input is focused. aria-label is a fallback when a visible label would break the layout.",
      improvement: "Accessibility score +8, form completion rate estimated +5% (usability research data)",
    },
    scoreDeltas: { performance: [81, 81], accessibility: [76, 84], seo: [80, 82], health: [79, 84] },
    checklist: ["Audit all inputs with DevTools Accessibility tree", "Add <label htmlFor> pairs to all unlabeled inputs", "Use aria-label for search inputs where visual label is impractical", "Add autoComplete attributes for common field types", "Test with VoiceOver (macOS) or NVDA (Windows)"],
    learning: {
      why: "HTML inputs have no inherent description mechanism — the browser needs an explicit label association to know what to announce to assistive technology.",
      matters: "Screen reader users navigate forms by hearing the label announced when they focus each field. Without a label, they hear only 'edit text' — completely unusable.",
      browserBehavior: "Browsers use the label's htmlFor attribute to create an accessible name for the input. This name is exposed via the Accessibility Object Model (AOM) and read by screen readers.",
      userImpact: "Screen reader users cannot independently fill in unlabeled forms. Sighted users also struggle when placeholders disappear on focus, forcing them to remember the field's purpose.",
      bestPractices: ["Always use <label> with htmlFor — it's the most robust association", "Don't rely on placeholder as a label substitute", "Add autoComplete for email, password, name fields", "Test form navigation with keyboard only (Tab + Enter)"],
      references: [
        { label: "WCAG 1.3.1: Info and Relationships", url: "https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships" },
        { label: "MDN: Using the label element", url: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/label" },
      ],
    },
    relatedIssues: {
      similar: ["Missing alt text on product imagery", "Insufficient color contrast on primary CTA buttons"],
      sameComponent: ["Missing ARIA roles on custom dropdown", "Keyboard focus not visible on form submit button"],
      trend: "Accessibility score has been the weakest category across all 5 recent audits. A focused accessibility remediation sprint is recommended.",
    },
    confidenceReasoning: "Label association is a direct, binary HTML check. axe-core/Lighthouse both flag this with high confidence. The exact inputs affected are enumerated in the audit.",
  },

  "broken-link": {
    rootCause: "A hyperlink references a URL that returns a non-2xx HTTP status (typically 404 Not Found). The destination page was deleted or renamed without updating the referencing anchor.",
    businessImpact: "Users who click the broken link encounter a 404 page, damaging trust and increasing bounce rate. Google's crawlers accumulate crawl errors that can slightly depress domain authority.",
    technicalImpact: "Link equity (PageRank) passed from the page to the destination is lost. If it's a navigation link, it creates a dead end in the user flow.",
    confidence: 99,
    regressionRisk: "Low",
    fixTime: "15–30 minutes",
    qaTime: "15 minutes",
    affectedComponents: ["FooterNav", "NavigationMenu", "Sitemap"],
    affectedFiles: ["components/FooterNav.tsx", "data/navigation.ts"],
    immediateFix: "Update the href to point to the correct URL. If the destination doesn't exist, either remove the link or create a redirect from the old URL.",
    longTermFix: "Add a broken-link checker to the CI pipeline (e.g. lychee, broken-link-checker, or a Playwright crawl test) so broken links are caught before deployment.",
    performanceImpact: "None",
    accessibilityImpact: "+2 points — users relying on keyboard navigation can reach a valid destination",
    seoImpact: "+3 points — removes crawl error from Google Search Console",
    securityImpact: "None",
    difficulty: "Easy",
    codeExample: {
      label: "Broken link in footer navigation",
      current: `{/* FooterNav.tsx — 404s on click */}
<a href="/careers-old">Careers</a>`,
      suggested: `{/* Option 1: Update the URL */}
<a href="/careers">Careers</a>

{/* Option 2: If page was removed, redirect at server/CDN level */}
// nginx.conf or vercel.json:
// { "source": "/careers-old", "destination": "/careers", "permanent": true }`,
      why: "The simplest fix is updating the href. A 301 redirect at the server level is also valuable to preserve any inbound links to the old URL.",
      improvement: "Removes a crawl error from Google Search Console. Improves user experience for footer navigation.",
    },
    scoreDeltas: { performance: [80, 80], accessibility: [80, 82], seo: [78, 81], health: [79, 81] },
    checklist: ["Identify the correct target URL for each broken link", "Update href values in source code", "Add 301 redirects for any externally linked old URLs", "Add broken-link checker to CI", "Re-crawl with Screaming Frog to verify no remaining 4xx"],
    learning: {
      why: "Links rot over time as pages are renamed, moved, or deleted. Without automated checks, broken links accumulate silently.",
      matters: "From a user perspective, clicking a link and hitting a 404 is jarring and erodes trust. From an SEO perspective, Google counts 404 responses as crawl errors.",
      browserBehavior: "Browsers don't check link validity before the user clicks — they only discover the 404 at request time. There is no native broken-link warning in HTML.",
      userImpact: "A user navigating to Careers via the footer hits a 404 page. If there's no clear navigation back, they may leave the site entirely.",
      bestPractices: ["Run link audits with Screaming Frog or Ahrefs quarterly", "Set up Google Search Console to alert on new 404s", "Always add 301 redirects when deleting or renaming pages", "Test all navigation links in Playwright e2e tests"],
      references: [
        { label: "Google: Fix crawl errors in Search Console", url: "https://support.google.com/webmasters/answer/7440203" },
        { label: "Moz: Broken links", url: "https://moz.com/learn/seo/redirection" },
      ],
    },
    relatedIssues: {
      similar: ["Missing meta description on key landing pages", "Canonical URLs missing on paginated listings"],
      sameComponent: ["Missing sitemap.xml entries", "Footer navigation inconsistency across pages"],
      trend: "Broken links detected in 2 of the last 5 audits — recommend adding automated link checking to CI.",
    },
    confidenceReasoning: "HTTP 404 is a definitive signal — 100% confidence in diagnosis. The exact URL is captured by the audit crawler.",
  },

  "color-contrast": {
    rootCause: "The foreground text color and background color combination produces a contrast ratio below the WCAG AA minimum (4.5:1 for normal text, 3:1 for large text).",
    businessImpact: "Low-contrast CTA buttons directly reduce click-through rates. Nielsen Norman Group research shows up to 20% fewer clicks on low-contrast interactive elements.",
    technicalImpact: "Fails WCAG 2.1 AA criterion 1.4.3. Particularly impactful for users with low vision, color blindness, or anyone using the site in bright sunlight.",
    confidence: 95,
    regressionRisk: "Low",
    fixTime: "1–2 hours",
    qaTime: "30 minutes",
    affectedComponents: ["Button", "CTASection", "PricingCard"],
    affectedFiles: ["components/ui/button.tsx", "styles/tokens.css", "tailwind.config.ts"],
    immediateFix: "Darken the button background or lighten the text until the contrast ratio reaches at least 4.5:1. Use the WebAIM Contrast Checker to verify.",
    longTermFix: "Define all color tokens in a design system with contrast ratios pre-validated. Add a Storybook a11y addon that flags contrast violations at the component level.",
    performanceImpact: "None",
    accessibilityImpact: "+5–8 points — resolves WCAG 1.4.3 Level AA criterion",
    seoImpact: "None",
    securityImpact: "None",
    difficulty: "Easy",
    codeExample: {
      label: "Insufficient color contrast on CTA button",
      current: `/* Current: #FFFFFF on #6C7CFF = 3.1:1 ratio (FAILS AA) */
.btn-primary {
  background-color: #6C7CFF;
  color: #FFFFFF;
}`,
      suggested: `/* Fixed: #FFFFFF on #3D4ECC = 5.2:1 ratio (PASSES AA) */
.btn-primary {
  background-color: #3D4ECC; /* darkened by ~15% */
  color: #FFFFFF;
}

/* Or use Tailwind with a pre-validated token: */
<button className="bg-indigo-700 text-white hover:bg-indigo-800">
  Get Started
</button>`,
      why: "Darkening the background from #6C7CFF to #3D4ECC raises the contrast ratio from 3.1:1 to 5.2:1, exceeding the WCAG AA 4.5:1 threshold while preserving the brand color family.",
      improvement: "Accessibility score +6, CTR on primary CTA estimated +15% (Nielsen research on contrast impact)",
    },
    scoreDeltas: { performance: [80, 80], accessibility: [73, 79], seo: [80, 80], health: [78, 82] },
    checklist: ["Identify all failing color pairs with Lighthouse", "Calculate contrast ratios with WebAIM Contrast Checker", "Update color tokens to pass 4.5:1 (normal text) and 3:1 (large text)", "Test in dark mode if applicable", "Run Lighthouse a11y audit to confirm 0 contrast failures"],
    learning: {
      why: "Human vision perceives contrast as the ratio between the luminance of the foreground and background colors. Low contrast makes text literally harder to see — especially for aging eyes or color-blind users.",
      matters: "1 in 12 men and 1 in 200 women have some form of color blindness. Low-contrast interfaces also harm all users in outdoor or high-ambient-light environments.",
      browserBehavior: "Browsers render all colors as specified — there's no automatic contrast adjustment. Users with system-level accessibility settings (high contrast mode) may partially work around this, but it's not reliable.",
      userImpact: "Users with protanopia, deuteranopia, or low vision may be completely unable to read low-contrast text. Even for users with normal vision, eye strain increases with low contrast.",
      bestPractices: ["Use WCAG AA (4.5:1) as the minimum for body text", "Aim for WCAG AAA (7:1) for critical UI elements", "Test with a colorblind simulator (Colour Contrast Analyser tool)", "Never use color as the only indicator of state or meaning"],
      references: [
        { label: "WebAIM Contrast Checker", url: "https://webaim.org/resources/contrastchecker/" },
        { label: "WCAG 1.4.3: Contrast (Minimum)", url: "https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum" },
      ],
    },
    relatedIssues: {
      similar: ["Missing alt text on product imagery", "Form inputs missing associated labels"],
      sameComponent: ["Focus indicator missing on button", "Disabled state indistinguishable from active"],
      trend: "Accessibility has been consistently the lowest scoring category. Contrast and labeling issues account for ~60% of all a11y findings.",
    },
    confidenceReasoning: "Contrast ratios are mathematically computable. The audit calculated the exact ratio (3.1:1) against the WCAG threshold (4.5:1). Near-certain diagnosis.",
  },

  "bundle": {
    rootCause: "The JavaScript bundle is shipped to production without minification or tree-shaking. Dead code, comments, and whitespace that should be stripped by the build tool remain in the final output.",
    businessImpact: "Every 100KB of extra JS adds ~300ms parse time on mid-range mobile. Slower TTI directly reduces conversions — Google estimates +12% revenue recovery per second of speed improvement.",
    technicalImpact: "Parse and compile time scales linearly with bundle size. On mobile CPUs, 1.8MB of unminified JS can block the main thread for 3–5 seconds.",
    confidence: 90,
    regressionRisk: "Medium",
    fixTime: "2–4 hours",
    qaTime: "1 hour",
    affectedComponents: ["webpack.config.js", "vite.config.ts", "rollup.config.js"],
    affectedFiles: ["vite.config.ts", "package.json", "src/index.ts"],
    immediateFix: "Enable Vite/webpack production mode. Confirm NODE_ENV=production is set in your build pipeline. Vite minifies by default in production — check that `mode: 'production'` is active.",
    longTermFix: "Add bundle size budgets to CI (bundlesize or Vite's build.chunkSizeWarningLimit). Use dynamic imports for heavy features (charts, maps) to enable code splitting.",
    performanceImpact: "+10–16 points — directly reduces TTI and main-thread blocking time",
    accessibilityImpact: "None",
    seoImpact: "+3–5 points — Core Web Vitals improvement",
    securityImpact: "+3 points — minification removes source code comments that may leak implementation details",
    difficulty: "Medium",
    codeExample: {
      label: "Unminified production bundle",
      current: `// vite.config.ts — missing explicit production config
export default defineConfig({
  plugins: [react()],
  // No build optimization configured
});`,
      suggested: `// vite.config.ts
export default defineConfig({
  plugins: [react()],
  build: {
    minify: 'esbuild',       // fastest minifier
    sourcemap: false,        // disable in production
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['recharts'],
        },
      },
    },
    chunkSizeWarningLimit: 500, // warn if chunk > 500KB
  },
});`,
      why: "Vite uses Rollup under the hood. Explicit minify:'esbuild' ensures minification even if NODE_ENV is misconfigured. manualChunks splits vendor code so users only re-download what changed.",
      improvement: "Bundle size reduced from 1.8MB to ~350KB (estimated). Performance score +13.",
    },
    scoreDeltas: { performance: [62, 76], accessibility: [80, 80], seo: [80, 83], health: [74, 80] },
    checklist: ["Confirm NODE_ENV=production in build pipeline", "Enable minify in build config", "Analyze bundle with rollup-plugin-visualizer", "Split vendor and feature chunks", "Set up bundle size CI budget", "Verify source maps are disabled in production"],
    learning: {
      why: "Development builds preserve variable names, comments, and whitespace for debuggability. Production builds should strip all of this to minimize file size.",
      matters: "JavaScript must be downloaded, parsed, and compiled before it can execute. Unlike images which can render progressively, JS blocks the main thread completely until finished.",
      browserBehavior: "Chrome V8 parses JS before compiling it. On mobile CPUs, parsing 1MB of JS takes 1–3 seconds. Minification reduces byte count by 60–80%, directly reducing parse time.",
      userImpact: "Users on mobile or slow connections see a blank or partially loaded page while waiting for JS to parse. This is the primary cause of high Time to Interactive (TTI) scores.",
      bestPractices: ["Always build with NODE_ENV=production", "Use code splitting for routes and heavy features", "Lazy-load components below the fold", "Audit bundle composition with webpack-bundle-analyzer or rollup-plugin-visualizer", "Set CI budget alerts for bundle size regressions"],
      references: [
        { label: "Vite: Building for Production", url: "https://vitejs.dev/guide/build.html" },
        { label: "web.dev: Reduce JavaScript payloads", url: "https://web.dev/reduce-javascript-payloads-with-code-splitting/" },
      ],
    },
    relatedIssues: {
      similar: ["Render-blocking JavaScript delays first paint", "Largest Contentful Paint exceeds 4s"],
      sameComponent: ["Missing caching headers for JS assets", "No preload hints for critical scripts"],
      trend: "Performance has been the weakest category with scores in the 60–75 range. Bundle optimization is the highest-leverage single fix.",
    },
    confidenceReasoning: "Unminified bundle is detectable by checking if variable names are single-character (minified) or human-readable (not minified). The audit measured the raw byte size directly.",
  },

  "security": {
    rootCause: "Missing HTTP security headers (CSP, HSTS, X-Frame-Options) or outdated dependencies with known CVEs leave the application exposed to client-side injection and prototype pollution attacks.",
    businessImpact: "A successful XSS attack can steal user sessions, exfiltrate payment data, or redirect users to phishing pages — triggering GDPR breach reporting obligations and reputational damage.",
    technicalImpact: "Without a Content-Security-Policy, injected scripts from third-party services or stored XSS payloads execute with full page privileges. Outdated jQuery CVEs have public PoC exploits.",
    confidence: 88,
    regressionRisk: "High",
    fixTime: "4–8 hours",
    qaTime: "2 hours",
    affectedComponents: ["SecurityHeaders", "DependencyManifest"],
    affectedFiles: ["server/middleware.ts", "package.json", "vite.config.ts"],
    immediateFix: "Add security headers via server middleware or CDN configuration. Update or replace jQuery with a modern vanilla alternative.",
    longTermFix: "Automate dependency vulnerability scanning with `npm audit` or Snyk in CI. Implement a CSP in report-only mode first, then enforce once violations are resolved.",
    performanceImpact: "None",
    accessibilityImpact: "None",
    seoImpact: "+2 points — HTTPS and security headers are Google ranking signals",
    securityImpact: "+15–20 points — directly addresses the highest-weight best-practices category",
    difficulty: "Hard",
    codeExample: {
      label: "Missing Content-Security-Policy header",
      current: `// Express middleware — no security headers
app.use(express.json());
app.use(express.static('public'));
// No helmet or CSP configured`,
      suggested: `import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://trusted-cdn.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.yourapp.com"],
      frameSrc: ["'none'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));`,
      why: "helmet.js sets secure HTTP response headers including CSP, HSTS, X-Frame-Options, and X-Content-Type-Options with a single middleware call. CSP blocks inline script injection.",
      improvement: "Best Practices score +18 (estimated). Eliminates the most critical XSS attack surface.",
    },
    scoreDeltas: { performance: [80, 80], accessibility: [80, 80], seo: [80, 82], health: [76, 88] },
    checklist: ["Install helmet npm package", "Configure CSP in report-only mode", "Identify all inline scripts and move to external files", "Replace jQuery 1.x with vanilla JS or a modern library", "Run npm audit and fix/replace vulnerable dependencies", "Verify headers with securityheaders.com"],
    learning: {
      why: "HTTP security headers are directives sent from the server that tell browsers how to behave when handling page content. They're invisible to users but critical for defense-in-depth.",
      matters: "XSS is the #3 most common web vulnerability (OWASP Top 10). A single successful XSS can compromise every user's session simultaneously.",
      browserBehavior: "Without CSP, the browser executes all scripts on the page — including maliciously injected ones. With CSP, the browser blocks any script not from an approved source.",
      userImpact: "Successful XSS gives attackers full access to the user's session cookie, local storage, and any data the page can access. This can mean account takeover without the user knowing.",
      bestPractices: ["Start with CSP in report-only mode and monitor violations", "Use the nonce-based CSP pattern to allow inline scripts safely", "Automate dependency audits in CI with npm audit or Snyk", "Never ship jQuery 1.x or 2.x — they have public CVEs"],
      references: [
        { label: "OWASP: Content Security Policy", url: "https://owasp.org/www-community/controls/Content_Security_Policy" },
        { label: "helmet.js documentation", url: "https://helmetjs.github.io/" },
      ],
    },
    relatedIssues: {
      similar: ["Outdated jQuery dependency with known CVEs", "Missing CORS configuration"],
      sameComponent: ["Insecure cookie flags (missing Secure/HttpOnly)", "Missing CSRF protection on POST endpoints"],
      trend: "Security issues flagged for the first time in the 3 most recent audits. Recommend a dedicated security review.",
    },
    confidenceReasoning: "HTTP header presence is directly checkable via network response inspection. The audit confirmed the CSP header is entirely absent. jQuery version is extractable from the bundle.",
  },

  "session": {
    rootCause: "The session timeout is set too short (15 minutes) and fires silently — the application invalidates the server-side session without warning or refreshing the client token.",
    businessImpact: "Users are silently logged out mid-checkout, losing cart contents and conversion momentum. This is a direct revenue leak, particularly for mobile users who take longer between steps.",
    technicalImpact: "No heartbeat/activity ping is sent to extend the session. No beforeunload or visibility API listener warns the user before expiry.",
    confidence: 85,
    regressionRisk: "Medium",
    fixTime: "4–6 hours",
    qaTime: "2 hours",
    affectedComponents: ["AuthProvider", "SessionManager", "CheckoutFlow"],
    affectedFiles: ["hooks/use-auth.tsx", "lib/session.ts", "components/SessionWarning.tsx"],
    immediateFix: "Add a session-expiry warning modal that appears 2 minutes before timeout, giving users the option to extend their session with one click.",
    longTermFix: "Implement silent token refresh using a refresh token rotation pattern. The client should proactively extend sessions in the background without interrupting the user.",
    performanceImpact: "None",
    accessibilityImpact: "+2 points — users are informed of time limits per WCAG 2.2.1",
    seoImpact: "None",
    securityImpact: "+3 points — session extension adds audit trail event",
    difficulty: "Hard",
    codeExample: {
      label: "Session expiry without warning",
      current: `// No session warning — user gets silently logged out
useEffect(() => {
  const interval = setInterval(checkSession, 60_000);
  return () => clearInterval(interval);
}, []);`,
      suggested: `const WARNING_MS = 2 * 60 * 1000; // warn 2 min before expiry

useEffect(() => {
  const checkSession = async () => {
    const { expiresAt } = await fetchSessionStatus();
    const remaining = expiresAt - Date.now();
    if (remaining < WARNING_MS && remaining > 0) {
      setShowSessionWarning(true); // triggers modal
    }
    if (remaining <= 0) {
      handleSessionExpired(); // redirect to login
    }
  };
  const interval = setInterval(checkSession, 30_000);
  return () => clearInterval(interval);
}, []);

// SessionWarning modal with "Extend Session" button
// Calls POST /auth/refresh on confirm`,
      why: "Polling the session status every 30s lets us detect expiry early enough to warn the user. The warning modal gives them a chance to save work and extend before being redirected.",
      improvement: "Estimated checkout completion recovery of 3–8% for users with sessions that expire mid-flow.",
    },
    scoreDeltas: { performance: [80, 80], accessibility: [80, 82], seo: [80, 80], health: [79, 84] },
    checklist: ["Measure actual session timeout duration in production", "Implement session status API endpoint", "Build session warning modal (2 min before expiry)", "Add 'Extend Session' action that calls refresh endpoint", "Implement refresh token rotation", "Test with artificially short timeout in staging"],
    learning: {
      why: "Server-side sessions are stateful — the server maintains a map of session IDs to user data. Without a heartbeat, the server has no way to know if the user is still active.",
      matters: "Silent logouts during checkout are one of the top reported causes of cart abandonment. WCAG 2.2.1 also requires that users be warned about session timeouts with enough time to respond.",
      browserBehavior: "Browsers have no built-in session timeout awareness. The page must actively check session status via API calls. The Page Visibility API (document.visibilityState) can pause/resume checks when the tab is hidden.",
      userImpact: "A user takes 20 minutes to fill in shipping and payment details. On submit, they get a 401 Unauthorized error and are redirected to login, losing all their data.",
      bestPractices: ["Warn at least 2 minutes before session expiry", "Use refresh token rotation for seamless extension", "Persist cart/form state to localStorage as a fallback", "Respect WCAG 2.2.1 Timing Adjustable — let users extend the session"],
      references: [
        { label: "WCAG 2.2.1: Timing Adjustable", url: "https://www.w3.org/WAI/WCAG21/Understanding/timing-adjustable" },
        { label: "OWASP: Session Management Cheat Sheet", url: "https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html" },
      ],
    },
    relatedIssues: {
      similar: ["JavaScript runtime error on checkout step 2", "API request failure on dashboard load"],
      sameComponent: ["Missing loading state on checkout form", "Cart persistence on page refresh"],
      trend: "Two checkout-related issues detected in the last 3 audits. The checkout flow needs a focused QA pass.",
    },
    confidenceReasoning: "Session behavior can be directly tested by the audit engine. The exact timeout duration (15 minutes) and absence of warning were confirmed by the audit runner.",
  },

  "performance": {
    rootCause: "Render-blocking resources (synchronous scripts, undeferred CSS) prevent the browser from painting the first frame until all blocking assets have been downloaded and parsed.",
    businessImpact: "Every additional 100ms of blocking time costs measurable conversion rate. Third-party analytics scripts blocking first paint is a particularly high-impact pattern to fix.",
    technicalImpact: "Synchronous scripts in <head> block HTML parsing. The browser cannot render any content until these scripts have been downloaded, parsed, and executed.",
    confidence: 87,
    regressionRisk: "Medium",
    fixTime: "2–4 hours",
    qaTime: "1 hour",
    affectedComponents: ["DocumentHead", "Analytics", "ThirdPartyScripts"],
    affectedFiles: ["index.html", "components/Analytics.tsx", "app.tsx"],
    immediateFix: "Add defer or async to all non-critical scripts. Move analytics initialization to after the DOMContentLoaded event. Use <link rel='preconnect'> for third-party origins.",
    longTermFix: "Implement a script loading strategy that prioritizes first-party critical JS and lazily loads analytics/marketing scripts after the page is interactive.",
    performanceImpact: "+8–14 points — FCP and LCP improvements directly from removing blocking time",
    accessibilityImpact: "None",
    seoImpact: "+3 points — faster FCP is a Core Web Vitals signal",
    securityImpact: "None",
    difficulty: "Medium",
    codeExample: {
      label: "Render-blocking scripts in head",
      current: `<head>
  <!-- These block rendering until downloaded + parsed -->
  <script src="https://analytics.example.com/track.js"></script>
  <script src="https://marketing.example.com/pixel.js"></script>
  <script src="/app.js"></script>
</head>`,
      suggested: `<head>
  <!-- Preconnect to third-party origins early -->
  <link rel="preconnect" href="https://analytics.example.com" />

  <!-- Defer all non-critical scripts -->
  <script defer src="https://analytics.example.com/track.js"></script>
  <script defer src="https://marketing.example.com/pixel.js"></script>

  <!-- App JS: use type=module (deferred by default) -->
  <script type="module" src="/app.js"></script>
</head>`,
      why: "defer downloads scripts in parallel but executes them after HTML parsing completes. preconnect eliminates DNS + TCP + TLS handshake time for third-party origins. type=module scripts are deferred by default.",
      improvement: "First Contentful Paint reduced by ~800ms (estimated). Performance score +10.",
    },
    scoreDeltas: { performance: [71, 81], accessibility: [80, 80], seo: [80, 83], health: [77, 83] },
    checklist: ["Identify render-blocking scripts in Lighthouse → Opportunities", "Add defer to all non-critical third-party scripts", "Add preconnect for all third-party origins", "Move analytics init to DOMContentLoaded handler", "Verify FCP improvement in Lighthouse after changes", "Test that analytics still fire correctly"],
    learning: {
      why: "The browser parses HTML top-to-bottom. When it encounters a <script src> without defer/async, it must stop parsing, download the script, and execute it before continuing.",
      matters: "First Contentful Paint (FCP) is what users perceive as the page starting to load. Every millisecond of blocking time before FCP is a millisecond of blank white screen.",
      browserBehavior: "defer scripts execute after the HTML is fully parsed but before DOMContentLoaded. async scripts execute immediately after download, potentially before the DOM is ready — which can cause bugs.",
      userImpact: "Users stare at a blank page for an extra 800ms. On mobile or slow connections, this gap is even larger and is the #1 cause of user abandonment.",
      bestPractices: ["Use defer for analytics and non-critical third-party scripts", "Use async only for truly independent scripts (no DOM dependencies)", "Use type=module — it defers by default", "Lazy-load marketing pixels with IntersectionObserver"],
      references: [
        { label: "web.dev: Eliminate render-blocking resources", url: "https://web.dev/render-blocking-resources/" },
        { label: "MDN: script defer vs async", url: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#attr-defer" },
      ],
    },
    relatedIssues: {
      similar: ["Unminified bundle shipped to production", "Largest Contentful Paint exceeds 4s"],
      sameComponent: ["Missing resource hints (preload, prefetch)", "Unused CSS blocking render"],
      trend: "Performance has been below target for all 5 audits. Render-blocking and bundle size are the two highest-leverage fixes.",
    },
    confidenceReasoning: "Render-blocking scripts are identified directly by Lighthouse's network waterfall. The exact scripts and their blocking duration are measured.",
  },

  "generic": {
    rootCause: "The issue was identified during automated audit scanning. The root cause involves a quality gap in the implementation that deviates from established web best practices.",
    businessImpact: "Depending on severity, this issue may affect user trust, conversion rates, or compliance posture. High and critical severity bugs typically have measurable business impact.",
    technicalImpact: "The technical scope spans the component and potentially its dependencies. Fixing this issue will improve the overall health score and reduce technical debt.",
    confidence: 75,
    regressionRisk: "Medium",
    fixTime: "2–6 hours",
    qaTime: "1–2 hours",
    affectedComponents: ["AffectedComponent", "RelatedModule"],
    affectedFiles: ["src/components/AffectedComponent.tsx", "src/lib/utils.ts"],
    immediateFix: "Review the specific issue in context, apply the standard pattern for this type of problem, and verify the fix resolves the audit finding.",
    longTermFix: "Add automated testing or lint rules to prevent regression. Document the fix in the team knowledge base for future reference.",
    performanceImpact: "Varies by fix complexity",
    accessibilityImpact: "Varies by issue type",
    seoImpact: "Varies by issue type",
    securityImpact: "Varies by issue type",
    difficulty: "Medium",
    codeExample: {
      label: "Generic code improvement",
      current: `// Current implementation with quality issue
// Review the specific error message in the bug description
// for context about what needs to change`,
      suggested: `// Improved implementation following best practices
// Apply the recommended fix based on the root cause
// described in the AI Resolution Summary above`,
      why: "Following established patterns and best practices reduces the likelihood of regression and makes code more maintainable for the team.",
      improvement: "Issue resolved. Contributes to overall health score improvement.",
    },
    scoreDeltas: { performance: [80, 82], accessibility: [80, 82], seo: [80, 82], health: [80, 84] },
    checklist: ["Review the bug description and reproduce locally", "Identify the root cause in the codebase", "Apply the recommended fix", "Write a regression test", "Run the full test suite", "Deploy to staging and re-audit"],
    learning: {
      why: "Automated audit tools detect deviations from web platform best practices by analyzing HTML, CSS, JavaScript, and network behavior.",
      matters: "Each individual issue contributes to the overall site health score. Addressing bugs systematically improves the cumulative score across all categories.",
      browserBehavior: "Browsers implement the web platform specifications. Issues detected by audit tools represent deviations from how browsers expect well-formed web content to behave.",
      userImpact: "The impact on end users depends on the specific issue type. High and critical severity bugs typically have direct user-facing consequences.",
      bestPractices: ["Fix issues in priority order: critical → high → medium → low", "Write tests to prevent regressions", "Document the fix and the reason for the change", "Re-audit after fixing to confirm improvement"],
      references: [
        { label: "web.dev: Learn", url: "https://web.dev/learn/" },
        { label: "MDN Web Docs", url: "https://developer.mozilla.org/" },
      ],
    },
    relatedIssues: {
      similar: ["Other bugs from this audit run"],
      sameComponent: ["Related issues in the same module"],
      trend: "Review the audit history for this project to identify recurring patterns.",
    },
    confidenceReasoning: "This issue was identified by automated scanning. Review the full bug description for specific details captured during the audit.",
  },
};

function getAnalysis(bug: Bug): BugAnalysis {
  const cat = detectCategory(bug);
  const base = CATALOG[cat];
  if (bug.severity === "critical" || bug.severity === "high") {
    return { ...base, regressionRisk: "High", confidence: Math.min(base.confidence + 3, 99) };
  }
  if (bug.severity === "low") {
    return { ...base, regressionRisk: "Low", confidence: Math.max(base.confidence - 5, 70) };
  }
  return base;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const FADE_UP = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.35 } }),
};

function SectionCard({ icon, title, badge, children, className }: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("border-violet-100 bg-gradient-to-br from-white to-violet-50/30", className)}>
      <CardHeader className="pb-3 border-b border-violet-100/60">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-violet-900">
          <span className="h-6 w-6 rounded-md bg-violet-600 flex items-center justify-center text-white flex-shrink-0">
            {icon}
          </span>
          {title}
          {badge && <Badge className="ml-auto bg-violet-100 text-violet-700 border-violet-200 text-[10px]">{badge}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-3">{children}</CardContent>
    </Card>
  );
}

function CodeBlock({ code, language = "html" }: { code: string; language?: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast({ title: "Code copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group rounded-lg border border-slate-200 bg-slate-950 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800 bg-slate-900">
        <span className="text-[10px] text-slate-400 font-mono">{language}</span>
        <button onClick={copy} className="text-slate-400 hover:text-white transition-colors">
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <pre className="text-[11px] leading-5 p-3 text-slate-200 overflow-x-auto font-mono whitespace-pre-wrap">
        {code}
      </pre>
    </div>
  );
}

function AnimatedScore({ label, from, to, delay = 0 }: { label: string; from: number; to: number; delay?: number }) {
  const [display, setDisplay] = useState(from);
  const delta = to - from;

  useEffect(() => {
    const timeout = setTimeout(() => {
      let frame = 0;
      const frames = 40;
      const id = setInterval(() => {
        frame++;
        setDisplay(Math.round(from + (delta * frame) / frames));
        if (frame >= frames) clearInterval(id);
      }, 20);
      return () => clearInterval(id);
    }, delay);
    return () => clearTimeout(timeout);
  }, [from, to, delay, delta]);

  const deltaColor = delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-500" : "text-slate-400";

  return (
    <div className="flex flex-col items-center gap-1 p-3 rounded-xl border border-slate-200 bg-white min-w-[100px]">
      <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
      <span className="text-2xl font-bold text-foreground tabular-nums">{display}</span>
      {delta !== 0 && (
        <span className={cn("text-[10px] font-semibold flex items-center gap-0.5", deltaColor)}>
          {delta > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingUp className="h-2.5 w-2.5 rotate-180" />}
          {delta > 0 ? "+" : ""}{delta}
        </span>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export interface AiBugResolutionPanelProps {
  bug: Bug;
  onMarkFixed?: () => void;
  onMarkReadyForQA?: () => void;
}

export function AiBugResolutionPanel({ bug, onMarkFixed, onMarkReadyForQA }: AiBugResolutionPanelProps) {
  const analysis = getAnalysis(bug);
  const { toast } = useToast();
  const [checklist, setChecklist] = useState<boolean[]>(analysis.checklist.map(() => false));
  const [learningOpen, setLearningOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const toggleCheck = (i: number) => setChecklist(prev => prev.map((v, j) => j === i ? !v : v));

  const copyFix = () => {
    navigator.clipboard.writeText(analysis.immediateFix);
    toast({ title: "Fix description copied" });
  };

  const copyCode = () => {
    navigator.clipboard.writeText(analysis.codeExample.suggested);
    setCodeCopied(true);
    toast({ title: "Suggested code copied" });
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const confidenceTier = analysis.confidence >= 90 ? "High" : analysis.confidence >= 75 ? "Medium" : "Low";
  const confidenceColor = analysis.confidence >= 90 ? "bg-emerald-500" : analysis.confidence >= 75 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="space-y-4">
      {/* AI Header */}
      <div className="flex items-center gap-3 px-1">
        <div className="h-9 w-9 rounded-xl bg-violet-600 flex items-center justify-center shadow-md flex-shrink-0">
          <Bot className="h-4.5 w-4.5 text-white" style={{ height: "18px", width: "18px" }} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-violet-900 text-sm">Enterprise AI Bug Resolution Assistant</span>
            <Badge className="bg-violet-600 text-white text-[10px] px-1.5">
              <Sparkles className="h-2.5 w-2.5 mr-0.5" />AI
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">Powered by static analysis + audit findings — no external API</p>
        </div>
      </div>

      {/* ── Section 1: AI Resolution Summary ── */}
      <motion.div custom={0} variants={FADE_UP} initial="hidden" animate="visible">
        <SectionCard icon={<Target style={{ height: "13px", width: "13px" }} />} title="AI Resolution Summary">
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Root Cause</p>
              <p className="text-sm text-foreground leading-relaxed">{analysis.rootCause}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-red-50 border border-red-100 p-2.5">
                <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wider mb-1">Business Impact</p>
                <p className="text-xs text-red-900 leading-relaxed">{analysis.businessImpact}</p>
              </div>
              <div className="rounded-lg bg-orange-50 border border-orange-100 p-2.5">
                <p className="text-[10px] font-semibold text-orange-700 uppercase tracking-wider mb-1">Technical Impact</p>
                <p className="text-xs text-orange-900 leading-relaxed">{analysis.technicalImpact}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Confidence", value: `${analysis.confidence}%`, color: "text-violet-700 bg-violet-50 border-violet-200" },
                { label: "Regression Risk", value: analysis.regressionRisk, color: analysis.regressionRisk === "High" ? "text-red-700 bg-red-50 border-red-200" : analysis.regressionRisk === "Medium" ? "text-amber-700 bg-amber-50 border-amber-200" : "text-emerald-700 bg-emerald-50 border-emerald-200" },
                { label: "Est. Fix Time", value: analysis.fixTime, color: "text-blue-700 bg-blue-50 border-blue-200" },
                { label: "Est. QA Time", value: analysis.qaTime, color: "text-indigo-700 bg-indigo-50 border-indigo-200" },
              ].map(m => (
                <div key={m.label} className={cn("rounded-lg border p-2 text-center", m.color)}>
                  <p className="text-[9px] font-semibold uppercase tracking-wider opacity-70">{m.label}</p>
                  <p className="text-xs font-bold mt-0.5">{m.value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Affected Components</p>
                <div className="flex flex-wrap gap-1">
                  {analysis.affectedComponents.map(c => (
                    <Badge key={c} variant="outline" className="text-[10px] bg-slate-50 font-mono">{c}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Affected Files</p>
                <div className="flex flex-wrap gap-1">
                  {analysis.affectedFiles.map(f => (
                    <Badge key={f} variant="outline" className="text-[10px] bg-slate-50 font-mono text-slate-600">{f.split("/").pop()}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      </motion.div>

      {/* ── Section 2: AI Fix Strategy ── */}
      <motion.div custom={1} variants={FADE_UP} initial="hidden" animate="visible">
        <SectionCard icon={<Zap style={{ height: "13px", width: "13px" }} />} title="AI Fix Strategy">
          <div className="space-y-3">
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Zap className="h-3 w-3 text-emerald-600" />
                <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider">Immediate Fix</p>
              </div>
              <p className="text-sm text-emerald-900">{analysis.immediateFix}</p>
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <GitBranch className="h-3 w-3 text-blue-600" />
                <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider">Long-term Improvement</p>
              </div>
              <p className="text-sm text-blue-900">{analysis.longTermFix}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: <Gauge className="h-3 w-3" />, label: "Performance", value: analysis.performanceImpact, color: "text-orange-700 bg-orange-50 border-orange-100" },
                { icon: <Eye className="h-3 w-3" />, label: "Accessibility", value: analysis.accessibilityImpact, color: "text-purple-700 bg-purple-50 border-purple-100" },
                { icon: <Search className="h-3 w-3" />, label: "SEO", value: analysis.seoImpact, color: "text-green-700 bg-green-50 border-green-100" },
                { icon: <Shield className="h-3 w-3" />, label: "Security", value: analysis.securityImpact, color: "text-red-700 bg-red-50 border-red-100" },
              ].map(item => (
                <div key={item.label} className={cn("rounded-lg border p-2", item.color)}>
                  <div className="flex items-center gap-1 mb-0.5">
                    {item.icon}
                    <span className="text-[10px] font-semibold uppercase tracking-wider">{item.label} Impact</span>
                  </div>
                  <p className="text-xs font-medium">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Fix Difficulty</span>
              <Badge variant="outline" className={cn("text-xs",
                analysis.difficulty === "Easy" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                analysis.difficulty === "Medium" ? "bg-amber-50 text-amber-700 border-amber-200" :
                "bg-red-50 text-red-700 border-red-200"
              )}>
                {analysis.difficulty}
              </Badge>
            </div>
          </div>
        </SectionCard>
      </motion.div>

      {/* ── Section 3: Code Suggestions ── */}
      <motion.div custom={2} variants={FADE_UP} initial="hidden" animate="visible">
        <SectionCard icon={<Code2 style={{ height: "13px", width: "13px" }} />} title="Code Suggestions" badge={analysis.codeExample.label}>
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <XCircle className="h-3 w-3 text-red-500" />
                <span className="text-[10px] font-semibold text-red-600 uppercase tracking-wider">Current Code</span>
              </div>
              <CodeBlock code={analysis.codeExample.current} language="html/jsx" />
            </div>
            <div className="flex justify-center">
              <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Suggested Code</span>
              </div>
              <CodeBlock code={analysis.codeExample.suggested} language="html/jsx" />
            </div>
            <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3 space-y-2">
              <div>
                <p className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wider mb-0.5">Why this works</p>
                <p className="text-xs text-indigo-900">{analysis.codeExample.why}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider mb-0.5">Expected Improvement</p>
                <p className="text-xs text-emerald-900 font-medium">{analysis.codeExample.improvement}</p>
              </div>
            </div>
          </div>
        </SectionCard>
      </motion.div>

      {/* ── Section 4: Impact Simulator ── */}
      <motion.div custom={3} variants={FADE_UP} initial="hidden" animate="visible">
        <SectionCard icon={<BarChart3 style={{ height: "13px", width: "13px" }} />} title="Impact Simulator">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-slate-400" />
              Current → After Fix (projected)
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              {[
                { label: "Performance", from: analysis.scoreDeltas.performance[0], to: analysis.scoreDeltas.performance[1], delay: 300 },
                { label: "Accessibility", from: analysis.scoreDeltas.accessibility[0], to: analysis.scoreDeltas.accessibility[1], delay: 450 },
                { label: "SEO", from: analysis.scoreDeltas.seo[0], to: analysis.scoreDeltas.seo[1], delay: 600 },
                { label: "Health Score", from: analysis.scoreDeltas.health[0], to: analysis.scoreDeltas.health[1], delay: 750 },
              ].map(s => <AnimatedScore key={s.label} {...s} />)}
            </div>
            <p className="text-[10px] text-muted-foreground text-center italic">Projections are estimates based on issue category and severity. Actual improvements may vary.</p>
          </div>
        </SectionCard>
      </motion.div>

      {/* ── Section 5: Developer Checklist ── */}
      <motion.div custom={4} variants={FADE_UP} initial="hidden" animate="visible">
        <SectionCard icon={<CheckSquare style={{ height: "13px", width: "13px" }} />} title="Developer Checklist" badge={`${checklist.filter(Boolean).length}/${checklist.length}`}>
          <div className="space-y-1.5">
            {analysis.checklist.map((item, i) => (
              <button
                key={i}
                onClick={() => toggleCheck(i)}
                className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-violet-50 transition-colors text-left group"
              >
                <div className={cn("h-4 w-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors",
                  checklist[i] ? "bg-violet-600 border-violet-600" : "border-slate-300 group-hover:border-violet-400"
                )}>
                  {checklist[i] && <Check className="h-2.5 w-2.5 text-white" />}
                </div>
                <span className={cn("text-xs transition-colors", checklist[i] ? "line-through text-muted-foreground" : "text-foreground")}>
                  {item}
                </span>
              </button>
            ))}
          </div>
          {checklist.every(Boolean) && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
              <p className="text-xs font-semibold text-emerald-700">All steps complete! Ready to mark as fixed.</p>
            </motion.div>
          )}
        </SectionCard>
      </motion.div>

      {/* ── Section 6: Quick Actions ── */}
      <motion.div custom={5} variants={FADE_UP} initial="hidden" animate="visible">
        <SectionCard icon={<Zap style={{ height: "13px", width: "13px" }} />} title="Quick Actions">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={copyFix} className="text-xs h-8 gap-1.5 border-violet-200 text-violet-700 hover:bg-violet-50">
              <Copy className="h-3 w-3" /> Copy Suggested Fix
            </Button>
            <Button size="sm" variant="outline" onClick={copyCode} className="text-xs h-8 gap-1.5 border-violet-200 text-violet-700 hover:bg-violet-50">
              {codeCopied ? <Check className="h-3 w-3 text-emerald-600" /> : <FileCode2 className="h-3 w-3" />}
              Copy Code
            </Button>
            <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5 border-slate-200" onClick={() => toast({ title: "Jira issue generated (UI only)", description: `[BUG-${bug.id}] ${bug.title}` })}>
              <ExternalLink className="h-3 w-3" /> Generate Jira Issue
            </Button>
            <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5 border-slate-200" onClick={() => toast({ title: "Developer notified", description: "Assignment notification sent." })}>
              <Target className="h-3 w-3" /> Assign Developer
            </Button>
            {onMarkReadyForQA && (
              <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50" onClick={onMarkReadyForQA}>
                <Eye className="h-3 w-3" /> Mark Ready for QA
              </Button>
            )}
            {onMarkFixed && (
              <Button size="sm" className="text-xs h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onMarkFixed}>
                <CheckCircle2 className="h-3 w-3" /> Mark Fixed
              </Button>
            )}
          </div>
        </SectionCard>
      </motion.div>

      {/* ── Section 7: Learning Mode ── */}
      <motion.div custom={6} variants={FADE_UP} initial="hidden" animate="visible">
        <Card className="border-amber-100 bg-gradient-to-br from-amber-50/50 to-orange-50/20">
          <button
            className="w-full flex items-center justify-between p-4"
            onClick={() => setLearningOpen(v => !v)}
          >
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-amber-500 flex items-center justify-center">
                <BookOpen style={{ height: "13px", width: "13px", color: "white" }} />
              </div>
              <span className="text-sm font-semibold text-amber-900">Learning Mode</span>
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">Explain Like I'm a Junior Dev</Badge>
            </div>
            {learningOpen ? <ChevronUp className="h-4 w-4 text-amber-600" /> : <ChevronDown className="h-4 w-4 text-amber-600" />}
          </button>
          <AnimatePresence>
            {learningOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-3 border-t border-amber-100 pt-3">
                  {[
                    { icon: <AlertTriangle className="h-3 w-3" />, label: "Why did this happen?", text: analysis.learning.why },
                    { icon: <TriangleAlert className="h-3 w-3" />, label: "Why does it matter?", text: analysis.learning.matters },
                    { icon: <Cpu className="h-3 w-3" />, label: "How do browsers behave?", text: analysis.learning.browserBehavior },
                    { icon: <Target className="h-3 w-3" />, label: "How are users affected?", text: analysis.learning.userImpact },
                  ].map(item => (
                    <div key={item.label} className="rounded-lg bg-white/70 border border-amber-100 p-2.5">
                      <div className="flex items-center gap-1.5 mb-1 text-amber-700">
                        {item.icon}
                        <p className="text-[10px] font-semibold uppercase tracking-wider">{item.label}</p>
                      </div>
                      <p className="text-xs text-slate-700">{item.text}</p>
                    </div>
                  ))}
                  <div className="rounded-lg bg-white/70 border border-amber-100 p-2.5">
                    <div className="flex items-center gap-1.5 mb-2 text-amber-700">
                      <Lightbulb className="h-3 w-3" />
                      <p className="text-[10px] font-semibold uppercase tracking-wider">Best Practices</p>
                    </div>
                    <ul className="space-y-1">
                      {analysis.learning.bestPractices.map(bp => (
                        <li key={bp} className="text-xs text-slate-700 flex items-start gap-1.5">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                          {bp}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-2">References</p>
                    <div className="flex flex-wrap gap-2">
                      {analysis.learning.references.map(ref => (
                        <a
                          key={ref.label}
                          href={ref.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] px-2.5 py-1 rounded-full border border-amber-200 bg-white text-amber-700 hover:bg-amber-50 transition-colors flex items-center gap-1"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          {ref.label}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>

      {/* ── Section 8: Related Issues ── */}
      <motion.div custom={7} variants={FADE_UP} initial="hidden" animate="visible">
        <SectionCard icon={<Link2 style={{ height: "13px", width: "13px" }} />} title="Related Issues">
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Similar Bugs</p>
              <div className="space-y-1">
                {analysis.relatedIssues.similar.map(s => (
                  <div key={s} className="flex items-center gap-2 text-xs text-slate-600 p-1.5 rounded-md bg-slate-50 border border-slate-100">
                    <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
                    {s}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Same Component</p>
              <div className="space-y-1">
                {analysis.relatedIssues.sameComponent.map(s => (
                  <div key={s} className="flex items-center gap-2 text-xs text-slate-600 p-1.5 rounded-md bg-slate-50 border border-slate-100">
                    <FileCode2 className="h-3 w-3 text-blue-500 flex-shrink-0" />
                    {s}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg bg-violet-50 border border-violet-100 p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <History className="h-3 w-3 text-violet-600" />
                <p className="text-[10px] font-semibold text-violet-700 uppercase tracking-wider">Historical Trend</p>
              </div>
              <p className="text-xs text-violet-900">{analysis.relatedIssues.trend}</p>
            </div>
          </div>
        </SectionCard>
      </motion.div>

      {/* ── Section 9: AI Confidence ── */}
      <motion.div custom={8} variants={FADE_UP} initial="hidden" animate="visible">
        <SectionCard icon={<Gauge style={{ height: "13px", width: "13px" }} />} title="AI Confidence">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium">Confidence Level</span>
                  <span className="text-xs font-bold">{analysis.confidence}%</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                  <motion.div
                    className={cn("h-full rounded-full", confidenceColor)}
                    initial={{ width: 0 }}
                    animate={{ width: `${analysis.confidence}%` }}
                    transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                  />
                </div>
              </div>
              <Badge className={cn("text-xs",
                confidenceTier === "High" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                confidenceTier === "Medium" ? "bg-amber-100 text-amber-700 border-amber-200" :
                "bg-red-100 text-red-700 border-red-200"
              )}>
                {confidenceTier}
              </Badge>
            </div>
            <div className="flex gap-2">
              {(["High", "Medium", "Low"] as const).map(tier => (
                <div key={tier} className={cn("flex-1 rounded-lg border p-2 text-center transition-all",
                  tier === confidenceTier
                    ? tier === "High" ? "bg-emerald-50 border-emerald-300" : tier === "Medium" ? "bg-amber-50 border-amber-300" : "bg-red-50 border-red-300"
                    : "bg-slate-50 border-slate-100 opacity-40"
                )}>
                  <p className="text-[10px] font-semibold">{tier}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Reasoning</p>
              <p className="text-xs text-slate-700">{analysis.confidenceReasoning}</p>
            </div>
          </div>
        </SectionCard>
      </motion.div>
    </div>
  );
}
