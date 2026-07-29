// ─── Core Audit Engine Types ───────────────────────────────────────────────────
// All TypeScript interfaces for the modular audit engine.
// Each scanner returns a ScannerResponse subtype.
// Real integrations (Lighthouse, Playwright, axe-core, OWASP, etc.)
// can be dropped in by implementing AuditScanner<T> with no other changes.

// ─── Execution Context ────────────────────────────────────────────────────────

export interface AuditContext {
  url: string;
  auditRunId: number;
  projectId: number;
  environment?: string;
  options?: AuditOptions;
}

export interface AuditOptions {
  /** Run scanners in parallel instead of sequentially */
  parallelExecution?: boolean;
  /** Which scanners to enable (undefined = all) */
  enabledScanners?: ScannerName[];
  /** Timeout per scanner in ms */
  scannerTimeoutMs?: number;
  /** Devices to capture screenshots for */
  screenshotDevices?: Array<"desktop" | "tablet" | "mobile">;
  /** Max links to check in broken-link scan */
  maxLinksToCheck?: number;
}

export type ScannerName =
  | "performance"
  | "accessibility"
  | "seo"
  | "security"
  | "broken-links"
  | "console-errors"
  | "network"
  | "screenshot"
  | "technology"
  | "ai-summary";

// ─── Scanner Base ─────────────────────────────────────────────────────────────

export interface AuditScanner<TResult extends ScannerResponse> {
  readonly name: ScannerName;
  readonly description: string;
  readonly version: string;
  /** Future: integration adapter key (e.g. "lighthouse", "playwright", "axe-core") */
  readonly adapter?: string;
  run(context: AuditContext): Promise<TResult>;
}

export interface ScannerResponse {
  scannerName: ScannerName;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  success: boolean;
  error?: string;
}

// ─── Performance ──────────────────────────────────────────────────────────────
// Future: replace mock with Lighthouse CLI / PageSpeed Insights API

export interface PerformanceMetrics extends ScannerResponse {
  scores: {
    performance: number;           // 0–100
    lcp: number;                   // Largest Contentful Paint (ms)
    fid: number;                   // First Input Delay (ms)
    cls: number;                   // Cumulative Layout Shift score
    inp: number;                   // Interaction to Next Paint (ms)
    ttfb: number;                  // Time to First Byte (ms)
    tbt: number;                   // Total Blocking Time (ms)
    fcp: number;                   // First Contentful Paint (ms)
    tti: number;                   // Time to Interactive (ms)
    speedIndex: number;
  };
  opportunities: Array<{
    id: string;
    title: string;
    description: string;
    potentialSavingsMs?: number;
    potentialSavingsBytes?: number;
  }>;
  resourceSummary: {
    totalBytes: number;
    jsBytes: number;
    cssBytes: number;
    imageBytes: number;
    fontBytes: number;
    requestCount: number;
    unusedJsBytes?: number;
    unusedCssBytes?: number;
  };
  renderBlockingResources: Array<{
    url: string;
    totalBytes: number;
    wastedMs: number;
  }>;
}

// ─── Accessibility ────────────────────────────────────────────────────────────
// Future: replace mock with axe-core / IBM Equal Access Checker

export interface AccessibilityMetrics extends ScannerResponse {
  score: number;   // 0–100
  violations: Array<{
    id: string;
    impact: "critical" | "serious" | "moderate" | "minor";
    description: string;
    help: string;
    helpUrl?: string;
    affectedElements: number;
    wcagCriteria: string[];
    tags: string[];
  }>;
  passes: number;
  incomplete: number;
  inapplicable: number;
  wcagLevel: "A" | "AA" | "AAA" | "non-compliant";
}

// ─── SEO ──────────────────────────────────────────────────────────────────────
// Future: replace mock with Google Search Console API / Screaming Frog SDK

export interface SEOAnalysis extends ScannerResponse {
  score: number;   // 0–100
  metaTags: {
    title: string | null;
    titleLength: number;
    description: string | null;
    descriptionLength: number;
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: string | null;
    twitterCard: string | null;
    canonical: string | null;
    robots: string | null;
    viewport: string | null;
  };
  headingStructure: {
    h1Count: number;
    h2Count: number;
    h3Count: number;
    issues: string[];
  };
  sitemapFound: boolean;
  robotsTxtFound: boolean;
  structuredData: {
    found: boolean;
    types: string[];
    valid: boolean;
    errors: string[];
  };
  issues: Array<{
    id: string;
    severity: "critical" | "high" | "medium" | "low";
    description: string;
    recommendation: string;
  }>;
}

// ─── Security ─────────────────────────────────────────────────────────────────
// Future: replace mock with OWASP ZAP / Security Headers API / Mozilla Observatory

export interface SecurityAnalysis extends ScannerResponse {
  score: number;  // 0–100
  ssl: {
    valid: boolean;
    expiresInDays: number;
    grade: string;         // A+, A, B, C, D, F
    protocol: string;      // TLS 1.3, TLS 1.2, etc.
    cipherStrength: "strong" | "acceptable" | "weak";
    hsts: boolean;
    hstsPreload: boolean;
  };
  headers: {
    contentSecurityPolicy: boolean;
    strictTransportSecurity: boolean;
    xFrameOptions: boolean;
    xContentTypeOptions: boolean;
    referrerPolicy: boolean;
    permissionsPolicy: boolean;
    crossOriginEmbedderPolicy: boolean;
    crossOriginOpenerPolicy: boolean;
  };
  vulnerabilities: Array<{
    id: string;
    severity: "critical" | "high" | "medium" | "low" | "info";
    title: string;
    description: string;
    cve?: string;
    cvssScore?: number;
    recommendation: string;
    references?: string[];
  }>;
  mixedContent: boolean;
  cookieSecurity: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: boolean;
    issues: string[];
  };
  openPorts?: Array<{ port: number; service: string; risk: "high" | "medium" | "low" }>;
}

// ─── Broken Links ─────────────────────────────────────────────────────────────
// Future: replace mock with Broken Link Checker / Sitebulb / Ahrefs API

export interface BrokenLinkResult extends ScannerResponse {
  totalLinksChecked: number;
  brokenLinks: Array<{
    url: string;
    statusCode: number;
    foundOn: string;
    linkText?: string;
    errorType?: "404" | "500" | "timeout" | "ssl-error" | "dns-error";
  }>;
  redirectChains: Array<{
    from: string;
    to: string;
    hops: number;
    finalStatusCode: number;
  }>;
  externalLinks: number;
  internalLinks: number;
  brokenImages: number;
}

// ─── Console Errors ───────────────────────────────────────────────────────────
// Future: replace mock with Playwright / CDP (Chrome DevTools Protocol)

export interface ConsoleErrors extends ScannerResponse {
  errors: Array<{
    level: "error" | "warning" | "info" | "verbose";
    message: string;
    source?: string;
    url?: string;
    lineNumber?: number;
    columnNumber?: number;
    stackTrace?: string;
    timestamp?: number;
  }>;
  totalErrors: number;
  totalWarnings: number;
  uncaughtExceptions: number;
  failedRequests: Array<{
    url: string;
    method: string;
    statusCode: number;
    errorMessage?: string;
    requestHeaders?: Record<string, string>;
  }>;
}

// ─── Network Requests ─────────────────────────────────────────────────────────
// Future: replace mock with Playwright HAR / WebPageTest API

export interface NetworkRequests extends ScannerResponse {
  summary: {
    totalRequests: number;
    failedRequests: number;
    totalTransferSizeBytes: number;
    totalDurationMs: number;
    cachingOpportunities: number;
    compressionOpportunities: number;
  };
  slowRequests: Array<{
    url: string;
    method: string;
    durationMs: number;
    sizeBytes: number;
    type: "document" | "script" | "stylesheet" | "image" | "font" | "xhr" | "fetch" | "other";
    cached: boolean;
    statusCode: number;
  }>;
  thirdPartyRequests: Array<{
    domain: string;
    requestCount: number;
    totalSizeBytes: number;
    impact: "blocking" | "deferred" | "async";
    category?: "analytics" | "advertising" | "social" | "cdn" | "other";
  }>;
  failedRequests: Array<{
    url: string;
    statusCode: number;
    errorType: string;
    method: string;
  }>;
}

// ─── Screenshots ──────────────────────────────────────────────────────────────
// Future: replace mock with Playwright / Puppeteer

export interface ScreenshotResult extends ScannerResponse {
  screenshots: Array<{
    deviceType: "desktop" | "tablet" | "mobile";
    viewport: { width: number; height: number };
    dataUrl: string;
    fileSizeBytes: number;
    format: "webp" | "png" | "jpeg";
    capturedAt: Date;
  }>;
  fullPageScreenshot?: {
    dataUrl: string;
    dimensions: { width: number; height: number };
  };
}

// ─── Technology Detection ─────────────────────────────────────────────────────
// Future: replace mock with Wappalyzer / BuiltWith API

export interface TechnologyProfile extends ScannerResponse {
  cms?: string;
  frameworks: string[];
  libraries: Array<{
    name: string;
    version?: string;
    category: "ui-framework" | "js-library" | "css-framework" | "build-tool" | "other";
  }>;
  cdn?: string;
  hosting?: string;
  analytics: string[];
  advertising: string[];
  security: string[];
  fonts: string[];
  languages: string[];
  server?: string;
  ecommerce?: string;
  webServer?: string;
  jsRuntime?: string;
}

// ─── AI Summary ───────────────────────────────────────────────────────────────
// Future: replace mock with GPT-4o / Claude / Gemini via real API calls

export interface AISummary extends ScannerResponse {
  executiveSummary: string;
  overallScore: number;
  overallGrade: "A" | "B" | "C" | "D" | "F";
  criticalIssues: Array<{
    title: string;
    severity: "critical" | "high" | "medium" | "low";
    category: string;
    description: string;
    recommendation: string;
    estimatedImpact: string;
  }>;
  strengths: string[];
  recommendations: Array<{
    priority: "immediate" | "short-term" | "long-term";
    action: string;
    expectedOutcome: string;
    effort: "low" | "medium" | "high";
  }>;
  historicalComparison?: {
    previousScore: number;
    trend: "improving" | "stable" | "declining";
    delta: number;
  };
  suggestedSprint?: string;
  suggestedTeam?: string;
  estimatedRemediationDays?: number;
  confidenceScore: number;  // 0–100
}

// ─── Findings & Bugs ──────────────────────────────────────────────────────────

export interface AuditFinding {
  id: string;
  category: "performance" | "accessibility" | "seo" | "security" | "reliability" | "best-practices";
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  recommendation: string;
  affectedUrl?: string;
  estimatedImpact?: string;
  effort?: "low" | "medium" | "high";
  scanner: ScannerName;
  references?: string[];
  autoCreateBug?: boolean;
}

// ─── Full Audit Result ────────────────────────────────────────────────────────

export interface AuditResult {
  auditRunId: number;
  projectId: number;
  url: string;
  environment: string;

  // Execution metadata
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  queuedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;

  // Aggregate scores (0–100)
  overallScore: number;
  performanceScore: number;
  accessibilityScore: number;
  seoScore: number;
  securityScore: number;
  bestPracticesScore: number;

  // Per-scanner outputs
  performance?: PerformanceMetrics;
  accessibility?: AccessibilityMetrics;
  seo?: SEOAnalysis;
  security?: SecurityAnalysis;
  brokenLinks?: BrokenLinkResult;
  consoleErrors?: ConsoleErrors;
  networkRequests?: NetworkRequests;
  screenshots?: ScreenshotResult;
  technologies?: TechnologyProfile;
  aiSummary?: AISummary;

  // Aggregated findings converted to bugs
  findings: AuditFinding[];
  bugsGenerated: number;

  // Stored as JSONB in DB
  rawFindings: Record<string, unknown>;
}

// ─── Execution Tracking ───────────────────────────────────────────────────────

export type AuditStage =
  | "queued"
  | "initializing-engine"
  | "preparing-scanners"
  | "running-performance"
  | "running-accessibility"
  | "running-seo"
  | "running-security"
  | "running-broken-links"
  | "collecting-console-logs"
  | "analyzing-network"
  | "capturing-screenshots"
  | "detecting-technologies"
  | "generating-ai-summary"
  | "creating-report"
  | "completed"
  | "failed"
  | "cancelled";

export interface AuditExecution {
  auditRunId: number;
  stage: AuditStage;
  progress: number;           // 0–100
  currentScanner?: ScannerName;
  completedScanners: ScannerName[];
  logs: string[];
  startedAt: Date;
  estimatedCompletionAt?: Date;
}

// ─── Storage Layer ────────────────────────────────────────────────────────────
// Interface for audit persistence — swap with any storage backend

export interface AuditStorage {
  updateStatus(auditRunId: number, status: AuditResult["status"], extras?: Partial<AuditResult>): Promise<void>;
  saveScannerResult(auditRunId: number, scannerName: ScannerName, result: ScannerResponse): Promise<void>;
  saveFinalResult(result: AuditResult): Promise<void>;
  createBug(projectId: number, auditRunId: number, finding: AuditFinding): Promise<void>;
  saveScreenshot(auditRunId: number, deviceType: string, dataUrl: string): Promise<void>;
  sendNotification(type: string, title: string, message: string, relatedId: number): Promise<void>;
}

// ─── Analysis Layer ───────────────────────────────────────────────────────────

export interface AuditAnalyzer {
  computeOverallScore(result: Partial<AuditResult>): number;
  extractFindings(result: Partial<AuditResult>): AuditFinding[];
  generateHistoricalComparison(auditRunId: number, currentScore: number): Promise<AISummary["historicalComparison"]>;
}

// ─── Notification Layer ───────────────────────────────────────────────────────

export interface NotificationEvent {
  type: "audit_completed" | "audit_failed" | "critical_issue" | "audit_started";
  title: string;
  message: string;
  relatedId: number;
  relatedType: string;
}

// ─── CI/CD Integration ────────────────────────────────────────────────────────
// Future: connect GitHub Actions / Jenkins / Azure DevOps / GitLab CI

export interface CIGate {
  name: string;
  threshold: number;
  metric: keyof Pick<AuditResult, "overallScore" | "performanceScore" | "accessibilityScore" | "seoScore" | "securityScore">;
  failOnBreach: boolean;
}

export interface AuditSummary {
  auditRunId: number;
  projectId: number;
  url: string;
  overallScore: number;
  grade: "A" | "B" | "C" | "D" | "F";
  status: AuditResult["status"];
  bugsFound: number;
  criticalBugs: number;
  duration: string;
  gates: Array<{ gate: CIGate; passed: boolean; actual: number }>;
  reportUrl?: string;
}
