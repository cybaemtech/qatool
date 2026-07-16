import { useState, useRef, useCallback, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Upload, FileText, FileJson, File, Image, Database, Archive,
  X, Sparkles, Loader2, CheckCircle2, AlertTriangle, AlertCircle,
  Clock, Zap, TrendingDown, ShieldAlert, Bug, ClipboardList,
  BarChart3, Eye, Download, Copy, RotateCcw, Share2, Check,
  ChevronDown, ChevronRight, FileSearch, Globe, Activity,
  Cpu, Network, Package, ScanSearch, Layers, Info,
  ArrowUpRight, Timer, TriangleAlert, FileCode2, FileSpreadsheet,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type FileCategory = "log" | "har" | "json" | "xml" | "csv" | "excel" | "pdf" | "docx" | "image" | "zip" | "txt";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  category: FileCategory;
  progress: number;
  status: "uploading" | "analyzing" | "done" | "error";
  uploadedAt: Date;
  url?: string;
  analysis?: FileAnalysis;
}

interface FileAnalysis {
  category: FileCategory;
  data: Record<string, unknown>;
}

// ─── File Category Detection ──────────────────────────────────────────────────

function detectCategory(name: string): FileCategory {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, FileCategory> = {
    log: "log", txt: "txt",
    json: "json", xml: "xml",
    csv: "csv", xlsx: "excel", xls: "excel",
    pdf: "pdf", docx: "docx", doc: "docx",
    png: "image", jpg: "image", jpeg: "image", webp: "image", gif: "image",
    har: "har", zip: "zip",
  };
  return map[ext] ?? "txt";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Mock Analysis Generator ──────────────────────────────────────────────────

function generateMockAnalysis(category: FileCategory, name: string): FileAnalysis {
  switch (category) {
    case "log":
    case "txt":
      return {
        category,
        data: {
          summary: { total: 14872, errors: 312, warnings: 891, info: 13669, critical: 17 },
          topErrors: [
            { message: "NullPointerException in UserService.authenticate()", count: 89, severity: "critical", firstSeen: "04:12:33", lastSeen: "04:58:47" },
            { message: "Connection timeout: MySQL pool exhausted after 30s", count: 67, severity: "critical", firstSeen: "03:41:09", lastSeen: "05:01:22" },
            { message: "JWT verification failed: token expired", count: 134, severity: "high", firstSeen: "02:00:01", lastSeen: "05:02:11" },
            { message: "Redis ECONNREFUSED 127.0.0.1:6379", count: 43, severity: "high", firstSeen: "03:55:14", lastSeen: "04:47:30" },
            { message: "Unhandled rejection: Cannot read properties of undefined ('id')", count: 28, severity: "medium", firstSeen: "04:30:00", lastSeen: "04:59:58" },
          ],
          stackTrace: `java.lang.NullPointerException
  at com.acme.service.UserService.authenticate(UserService.java:147)
  at com.acme.controller.AuthController.login(AuthController.java:82)
  at sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)
  at org.springframework.web.servlet.DispatcherServlet.doDispatch(DispatcherServlet.java:1067)
  Caused by: com.acme.exception.UserNotFoundException: User not found for id=null`,
          suggestedFix: "Add null-check for `userId` before calling `userRepository.findById()`. The `authenticate()` method receives a null session token when the cookie is not sent — likely caused by a CORS misconfiguration on the `/api/auth` preflight response.",
          rootCause: "Cookie `session_token` is stripped by the CDN edge (Cloudflare) for unauthenticated paths due to a stale Cache-Control rule deployed on 2026-07-14 14:30 UTC.",
          timeline: [
            { time: "02:00", event: "First JWT expiry errors — token TTL hit", severity: "medium" },
            { time: "03:41", event: "MySQL pool exhausted — spike in auth retries", severity: "critical" },
            { time: "03:55", event: "Redis failover missed — cache gone cold", severity: "critical" },
            { time: "04:12", event: "NPE cascade begins — 89 occurrences in 46 min", severity: "critical" },
            { time: "04:47", event: "Error rate stabilises — on-call engineer patched route", severity: "info" },
          ],
          severity: { critical: 17, high: 201, medium: 94, low: 0 },
        },
      };

    case "har":
      return {
        category,
        data: {
          summary: { totalRequests: 284, failed: 19, slowRequests: 38, totalTransferKB: 4821, pageLoadMs: 8340 },
          slowApis: [
            { url: "/api/reports/executive/generate", method: "POST", durationMs: 4820, size: "1.2 MB", status: 200 },
            { url: "/api/dashboard/audit-trends", method: "GET", durationMs: 3210, size: "340 KB", status: 200 },
            { url: "/api/users/bulk-export", method: "GET", durationMs: 2980, size: "890 KB", status: 200 },
            { url: "/api/bugs/search?q=critical", method: "GET", durationMs: 1740, size: "210 KB", status: 200 },
            { url: "/api/projects/12/dependencies", method: "GET", durationMs: 1320, size: "98 KB", status: 200 },
          ],
          failedRequests: [
            { url: "/api/integrations/jira/sync", status: 503, method: "POST", error: "Service Unavailable", durationMs: 5001 },
            { url: "/api/notifications/push", status: 429, method: "POST", error: "Too Many Requests", durationMs: 12 },
            { url: "/api/audit-detail/88/screenshot", status: 404, method: "GET", error: "Not Found", durationMs: 45 },
            { url: "/api/reports/pdf/export", status: 500, method: "GET", error: "Internal Server Error", durationMs: 3201 },
          ],
          largestPayloads: [
            { url: "/api/reports/executive/generate", size: "1.2 MB", type: "application/json" },
            { url: "/static/js/chunk.vendor.js", size: "890 KB", type: "text/javascript" },
            { url: "/api/users/bulk-export", size: "890 KB", type: "application/csv" },
          ],
          waterfall: [
            { label: "DNS Lookup", ms: 12 },
            { label: "TCP Connect", ms: 34 },
            { label: "TLS Handshake", ms: 78 },
            { label: "Time to First Byte", ms: 420 },
            { label: "Content Download", ms: 1840 },
            { label: "Resource Parse", ms: 310 },
            { label: "DOM Ready", ms: 2890 },
            { label: "Page Load", ms: 8340 },
          ],
        },
      };

    case "json":
    case "xml":
      return {
        category,
        data: {
          isValid: true,
          totalNodes: 847,
          depth: 9,
          issues: [
            { type: "missing_field", path: "user[3].profile.email", message: "Required field 'email' is missing", severity: "error" },
            { type: "type_mismatch", path: "orders[12].total", message: "Expected number, got string '\"29.99\"'", severity: "error" },
            { type: "deprecated", path: "response.meta.v1_id", message: "Field 'v1_id' is deprecated — use 'uuid' instead", severity: "warning" },
            { type: "empty_array", path: "cart.items", message: "Cart items array is empty but checkout flag is true", severity: "warning" },
            { type: "extra_field", path: "session.__debug_token", message: "Unexpected debug field found in production payload", severity: "info" },
          ],
          schemaCompliance: 94,
          recommendations: [
            "Enforce strict typing on all numeric fields — 3 string-encoded numbers found",
            "Remove deprecated 'v1_id' fields — migration deadline was Q2 2026",
            "Add required field validation for 'email' in user profile schema",
            "Strip debug fields before serializing production payloads",
          ],
          stats: { strings: 312, numbers: 201, booleans: 47, nulls: 23, arrays: 84, objects: 180 },
        },
      };

    case "pdf":
    case "docx":
      return {
        category,
        data: {
          fileName: name,
          pageCount: 24,
          wordCount: 8412,
          summary: "This requirements document outlines the functional and non-functional specifications for the Acme Payment Gateway v3.2. Key changes include PCI-DSS Level 1 compliance upgrades, 3DS2 authentication integration, multi-currency settlement, and real-time fraud detection via the Acme ML Risk Engine. The document covers API contracts, SLA targets (99.99% uptime), and acceptance criteria for 6 epics across Q3–Q4 2026.",
          requirements: [
            "REQ-001: System shall process payments within 2s p99 under 10,000 TPS load",
            "REQ-002: 3D Secure 2.0 challenge flow must complete within 30s before timeout",
            "REQ-003: All card data must be tokenised before reaching application layer (PCI DSS 3.2.1)",
            "REQ-004: Refund API must support partial refunds down to 0.01 currency unit",
            "REQ-005: Multi-currency FX rates must refresh every 60 seconds from primary provider",
            "REQ-006: Fraud ML model must respond within 200ms for real-time decisioning",
          ],
          testCases: [
            { id: "TC-PAY-001", title: "Successful Visa card payment — happy path", priority: "P0" },
            { id: "TC-PAY-002", title: "3DS2 challenge triggers for high-risk transaction", priority: "P0" },
            { id: "TC-PAY-003", title: "Payment declines with insufficient funds code", priority: "P1" },
            { id: "TC-PAY-004", title: "Partial refund reduces balance correctly", priority: "P1" },
            { id: "TC-PAY-005", title: "FX rate refreshes within 60s tolerance window", priority: "P2" },
            { id: "TC-PAY-006", title: "Fraud engine blocks transaction > risk score 0.85", priority: "P0" },
            { id: "TC-PAY-007", title: "System handles 10,000 TPS without p99 breach", priority: "P0" },
          ],
          bugs: [
            { id: "BUG-001", title: "FX rate API fallback not triggered when primary provider times out", severity: "critical" },
            { id: "BUG-002", title: "Partial refund rounds to 2 decimal places inconsistently for JPY", severity: "high" },
            { id: "BUG-003", title: "3DS2 timeout message not localised for non-EN locales", severity: "medium" },
          ],
          acceptanceCriteria: [
            "Given a valid card, when payment is submitted, then funds are captured within 2s and confirmation email sent within 5s",
            "Given a high-risk transaction (score > 0.85), when fraud engine responds, then transaction is declined and logged to SIEM",
            "Given a refund request, when partial amount is specified, then ledger balance is updated atomically within same DB transaction",
          ],
        },
      };

    case "image":
      return {
        category,
        data: {
          dimensions: "1920 × 1080",
          format: name.split(".").pop()?.toUpperCase() ?? "PNG",
          ocrText: "Login  •  Email address  •  Password  •  Remember me  •  Forgot password?  •  Sign In  •  Don't have an account? Sign Up",
          uiIssues: [
            { type: "contrast", element: "Forgot password link", description: "Text contrast ratio is 2.8:1 — WCAG AA requires 4.5:1 for normal text", severity: "error", wcag: "1.4.3" },
            { type: "touch_target", element: "Remember me checkbox", description: "Touch target is 16×16px — minimum recommended is 44×44px (iOS HIG)", severity: "warning", wcag: "2.5.5" },
            { type: "missing_label", element: "Email input", description: "Input has placeholder but no associated <label> element", severity: "error", wcag: "1.3.1" },
            { type: "focus_indicator", element: "Sign In button", description: "Focus ring is not visible in Windows High Contrast mode", severity: "warning", wcag: "2.4.7" },
          ],
          accessibilityScore: 72,
          possibleBugs: [
            "Password field shows plaintext momentarily on mobile iOS 17 (timing issue with toggle-visibility)",
            "Error message banner overlaps the 'Sign Up' link on viewports < 375px wide",
            "Form submission possible with keyboard Enter while loader is active — double-submit risk",
          ],
          recommendations: [
            "Increase 'Forgot password' link color from #8899AA to #1D4ED8 to meet WCAG AA contrast",
            "Wrap checkbox in a larger click target (48px padding) with aria-label",
            "Add explicit <label for='email'> — do not rely solely on placeholder text",
            "Add aria-live='polite' region for error messages to announce to screen readers",
          ],
        },
      };

    case "csv":
    case "excel":
      return {
        category,
        data: {
          rows: 12847,
          columns: 18,
          columnNames: ["test_id", "suite", "environment", "status", "duration_ms", "error_code", "assignee", "created_at", "browser", "os", "build", "branch", "flaky", "retries", "tags", "priority", "run_id", "pass_rate"],
          anomalies: [
            { column: "duration_ms", description: "Outlier detected: 847 rows have duration > 30,000ms (P99 baseline: 4,200ms)", severity: "critical", affectedRows: 847 },
            { column: "flaky", description: "12.4% of tests marked flaky — industry benchmark is < 3%", severity: "high", affectedRows: 1593 },
            { column: "pass_rate", description: "Pass rate dropped from 96.2% to 81.7% between build 2247 and 2248", severity: "critical", affectedRows: null },
            { column: "error_code", description: "Error code E_TIMEOUT appears 3.4× more in Chrome vs Firefox", severity: "medium", affectedRows: 412 },
            { column: "retries", description: "38 test rows have retries=5 (max) — likely stuck tests causing pipeline delay", severity: "high", affectedRows: 38 },
          ],
          chartData: {
            passRateByBuild: [94, 95, 96, 96, 95, 94, 93, 91, 88, 82],
            builds: ["2239", "2240", "2241", "2242", "2243", "2244", "2245", "2246", "2247", "2248"],
            durationP99ByBuild: [3800, 3900, 4100, 4000, 4200, 4300, 5100, 7200, 11400, 28900],
          },
          report: {
            passingTests: 10505,
            failingTests: 2342,
            flakyTests: 1593,
            avgDurationMs: 3420,
            topFailingSuites: ["auth.spec", "checkout.spec", "reports-export.spec"],
          },
        },
      };

    case "zip":
    default:
      return {
        category,
        data: {
          contents: [
            { name: "test-results/", type: "directory", items: 47 },
            { name: "screenshots/", type: "directory", items: 12 },
            { name: "playwright-report.html", type: "html", size: "840 KB" },
            { name: "test-results.json", type: "json", size: "1.2 MB" },
            { name: "coverage-report.lcov", type: "lcov", size: "320 KB" },
          ],
          summary: "ZIP archive contains a full Playwright test run output. 47 test result folders, 12 failure screenshots, and an HTML report. Overall pass rate: 88.3% (212/240 tests).",
        },
      };
  }
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

function categoryMeta(cat: FileCategory) {
  const map: Record<FileCategory, { label: string; color: string; Icon: React.FC<{ className?: string }> }> = {
    log: { label: "LOG", color: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30", Icon: FileText },
    txt: { label: "TXT", color: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30", Icon: FileText },
    json: { label: "JSON", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30", Icon: FileJson },
    xml: { label: "XML", color: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30", Icon: FileCode2 },
    csv: { label: "CSV", color: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30", Icon: FileSpreadsheet },
    excel: { label: "XLSX", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30", Icon: FileSpreadsheet },
    pdf: { label: "PDF", color: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30", Icon: File },
    docx: { label: "DOCX", color: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30", Icon: FileText },
    image: { label: "IMG", color: "bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30", Icon: Image },
    har: { label: "HAR", color: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30", Icon: Globe },
    zip: { label: "ZIP", color: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30", Icon: Archive },
  };
  return map[cat] ?? map.txt;
}

function severityColor(sev: string) {
  switch (sev?.toLowerCase()) {
    case "critical": return "text-red-600 dark:text-red-400";
    case "high": return "text-orange-500 dark:text-orange-400";
    case "error": return "text-red-600 dark:text-red-400";
    case "warning": return "text-yellow-600 dark:text-yellow-400";
    case "medium": return "text-yellow-600 dark:text-yellow-400";
    case "low": return "text-blue-500 dark:text-blue-400";
    case "info": return "text-slate-400";
    default: return "text-muted-foreground";
  }
}

function severityBg(sev: string) {
  switch (sev?.toLowerCase()) {
    case "critical": return "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400";
    case "high": return "bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400";
    case "error": return "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400";
    case "warning": return "bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400";
    case "medium": return "bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400";
    case "p0": return "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400";
    case "p1": return "bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400";
    case "p2": return "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400";
    default: return "bg-muted border-border text-muted-foreground";
  }
}

// ─── Card Shell ───────────────────────────────────────────────────────────────

function AnalysisCard({ title, icon: Icon, color = "text-primary", children, className }: {
  title: string; icon: React.FC<{ className?: string }>; color?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden shadow-sm", className)}>
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border bg-muted/30">
        <Icon className={cn("h-4 w-4", color)} />
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Action Bar ───────────────────────────────────────────────────────────────

function ActionBar({ onRegenerate }: { onRegenerate?: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button onClick={copy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
      <button onClick={onRegenerate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
        <RotateCcw className="h-3 w-3" /> Regenerate
      </button>
      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
        <Download className="h-3 w-3" /> Download PDF
      </button>
      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
        <Share2 className="h-3 w-3" /> Share
      </button>
      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
        <ArrowUpRight className="h-3 w-3" /> Export
      </button>
    </div>
  );
}

// ─── Log Analysis ─────────────────────────────────────────────────────────────

function LogAnalysis({ data, onRegenerate }: { data: Record<string, unknown>; onRegenerate?: () => void }) {
  const d = data as {
    summary: { total: number; errors: number; warnings: number; info: number; critical: number };
    topErrors: Array<{ message: string; count: number; severity: string; firstSeen: string; lastSeen: string }>;
    stackTrace: string;
    suggestedFix: string;
    rootCause: string;
    timeline: Array<{ time: string; event: string; severity: string }>;
    severity: { critical: number; high: number; medium: number; low: number };
  };
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-4">
      <ActionBar onRegenerate={onRegenerate} />

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total Lines", val: d.summary.total.toLocaleString(), color: "text-foreground", bg: "bg-muted/50" },
          { label: "Critical", val: d.summary.critical, color: "text-red-500", bg: "bg-red-500/5 border border-red-500/20" },
          { label: "Errors", val: d.summary.errors, color: "text-orange-500", bg: "bg-orange-500/5 border border-orange-500/20" },
          { label: "Warnings", val: d.summary.warnings, color: "text-yellow-500", bg: "bg-yellow-500/5 border border-yellow-500/20" },
          { label: "Info", val: d.summary.info.toLocaleString(), color: "text-blue-500", bg: "bg-blue-500/5 border border-blue-500/20" },
        ].map(s => (
          <div key={s.label} className={cn("rounded-lg p-3 text-center", s.bg)}>
            <div className={cn("text-xl font-bold tabular-nums", s.color)}>{s.val}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Top errors */}
      <AnalysisCard title="Top Errors — Most Frequent Exceptions" icon={AlertTriangle} color="text-red-500">
        <div className="space-y-2">
          {d.topErrors.map((e, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors">
              <span className={cn("text-xs font-bold mt-0.5 min-w-[24px] text-center", severityColor(e.severity))}>#{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-foreground truncate">{e.message}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", severityBg(e.severity))}>{e.severity.toUpperCase()}</span>
                  <span className="text-[10px] text-muted-foreground">First: {e.firstSeen}</span>
                  <span className="text-[10px] text-muted-foreground">Last: {e.lastSeen}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold text-foreground">{e.count}</div>
                <div className="text-[10px] text-muted-foreground">occurrences</div>
              </div>
            </div>
          ))}
        </div>
      </AnalysisCard>

      {/* Root cause + fix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnalysisCard title="Root Cause Analysis" icon={ScanSearch} color="text-violet-500">
          <p className="text-sm text-foreground leading-relaxed">{d.rootCause}</p>
        </AnalysisCard>
        <AnalysisCard title="Suggested Fix" icon={Zap} color="text-green-500">
          <p className="text-sm text-foreground leading-relaxed">{d.suggestedFix}</p>
        </AnalysisCard>
      </div>

      {/* Stack trace */}
      <AnalysisCard title="Stack Trace" icon={FileCode2} color="text-orange-500">
        <button onClick={() => setExpanded(p => !p)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2 transition-colors">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          {expanded ? "Collapse" : "Expand"} stack trace
        </button>
        {expanded && (
          <pre className="text-[11px] font-mono bg-muted/60 rounded-lg p-4 overflow-x-auto text-foreground leading-relaxed whitespace-pre-wrap">{d.stackTrace}</pre>
        )}
        {!expanded && (
          <div className="text-[11px] font-mono bg-muted/60 rounded-lg p-3 text-muted-foreground truncate">java.lang.NullPointerException at com.acme.service.UserService...</div>
        )}
      </AnalysisCard>

      {/* Timeline */}
      <AnalysisCard title="Event Timeline" icon={Clock} color="text-blue-500">
        <div className="relative pl-4">
          <div className="absolute left-[7px] top-0 bottom-0 w-px bg-border" />
          {d.timeline.map((t, i) => (
            <div key={i} className="relative flex gap-3 pb-4 last:pb-0">
              <div className={cn("absolute -left-[13px] h-3.5 w-3.5 rounded-full border-2 border-background mt-0.5",
                t.severity === "critical" ? "bg-red-500" : t.severity === "info" ? "bg-blue-400" : "bg-orange-400"
              )} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-muted-foreground">{t.time}</span>
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", severityBg(t.severity))}>{t.severity}</span>
                </div>
                <p className="text-xs text-foreground mt-0.5">{t.event}</p>
              </div>
            </div>
          ))}
        </div>
      </AnalysisCard>
    </div>
  );
}

// ─── HAR Analysis ─────────────────────────────────────────────────────────────

function HarAnalysis({ data, onRegenerate }: { data: Record<string, unknown>; onRegenerate?: () => void }) {
  const d = data as {
    summary: { totalRequests: number; failed: number; slowRequests: number; totalTransferKB: number; pageLoadMs: number };
    slowApis: Array<{ url: string; method: string; durationMs: number; size: string; status: number }>;
    failedRequests: Array<{ url: string; status: number; method: string; error: string; durationMs: number }>;
    largestPayloads: Array<{ url: string; size: string; type: string }>;
    waterfall: Array<{ label: string; ms: number }>;
  };

  const maxWf = Math.max(...d.waterfall.map(w => w.ms));

  return (
    <div className="space-y-4">
      <ActionBar onRegenerate={onRegenerate} />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total Requests", val: d.summary.totalRequests, color: "text-foreground", bg: "bg-muted/50" },
          { label: "Failed", val: d.summary.failed, color: "text-red-500", bg: "bg-red-500/5 border border-red-500/20" },
          { label: "Slow (>1s)", val: d.summary.slowRequests, color: "text-orange-500", bg: "bg-orange-500/5 border border-orange-500/20" },
          { label: "Transfer", val: `${(d.summary.totalTransferKB / 1024).toFixed(1)} MB`, color: "text-blue-500", bg: "bg-blue-500/5 border border-blue-500/20" },
          { label: "Page Load", val: `${(d.summary.pageLoadMs / 1000).toFixed(1)}s`, color: "text-purple-500", bg: "bg-purple-500/5 border border-purple-500/20" },
        ].map(s => (
          <div key={s.label} className={cn("rounded-lg p-3 text-center", s.bg)}>
            <div className={cn("text-xl font-bold", s.color)}>{s.val}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <AnalysisCard title="Slow APIs" icon={Timer} color="text-orange-500">
        <div className="space-y-2">
          {d.slowApis.map((a, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{a.method}</span>
                  <span className="font-mono text-foreground truncate">{a.url}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-muted-foreground">{a.size}</span>
                  <span className={cn("font-bold", a.durationMs > 3000 ? "text-red-500" : a.durationMs > 1500 ? "text-orange-500" : "text-yellow-500")}>
                    {(a.durationMs / 1000).toFixed(2)}s
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", a.durationMs > 3000 ? "bg-red-500" : a.durationMs > 1500 ? "bg-orange-500" : "bg-yellow-500")}
                  style={{ width: `${(a.durationMs / d.slowApis[0].durationMs) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </AnalysisCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnalysisCard title="Failed Requests" icon={AlertCircle} color="text-red-500">
          <div className="space-y-2">
            {d.failedRequests.map((r, i) => (
              <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-red-500/5 border border-red-500/20">
                <span className="font-bold text-xs tabular-nums text-red-500 mt-0.5">{r.status}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-mono text-foreground truncate">{r.url}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{r.error} · {r.durationMs}ms</p>
                </div>
              </div>
            ))}
          </div>
        </AnalysisCard>

        <AnalysisCard title="Waterfall Breakdown" icon={Layers} color="text-blue-500">
          <div className="space-y-2">
            {d.waterfall.map((w, i) => (
              <div key={i} className="space-y-0.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">{w.label}</span>
                  <span className="font-mono font-medium text-foreground">{w.ms.toLocaleString()}ms</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full" style={{ width: `${(w.ms / maxWf) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </AnalysisCard>
      </div>
    </div>
  );
}

// ─── JSON / XML Analysis ──────────────────────────────────────────────────────

function JsonXmlAnalysis({ data, onRegenerate }: { data: Record<string, unknown>; onRegenerate?: () => void }) {
  const d = data as {
    isValid: boolean; totalNodes: number; depth: number;
    issues: Array<{ type: string; path: string; message: string; severity: string }>;
    schemaCompliance: number;
    recommendations: string[];
    stats: { strings: number; numbers: number; booleans: number; nulls: number; arrays: number; objects: number };
  };

  return (
    <div className="space-y-4">
      <ActionBar onRegenerate={onRegenerate} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Valid Syntax", val: d.isValid ? "✓ Valid" : "✗ Invalid", color: d.isValid ? "text-green-500" : "text-red-500", bg: d.isValid ? "bg-green-500/5 border border-green-500/20" : "bg-red-500/5 border border-red-500/20" },
          { label: "Schema Compliance", val: `${d.schemaCompliance}%`, color: "text-blue-500", bg: "bg-blue-500/5 border border-blue-500/20" },
          { label: "Total Nodes", val: d.totalNodes, color: "text-foreground", bg: "bg-muted/50" },
          { label: "Max Depth", val: d.depth, color: "text-purple-500", bg: "bg-purple-500/5 border border-purple-500/20" },
        ].map(s => (
          <div key={s.label} className={cn("rounded-lg p-3 text-center", s.bg)}>
            <div className={cn("text-lg font-bold", s.color)}>{s.val}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <AnalysisCard title="Schema Issues" icon={AlertTriangle} color="text-yellow-500">
        <div className="space-y-2">
          {d.issues.map((issue, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors">
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 mt-0.5", severityBg(issue.severity))}>{issue.severity.toUpperCase()}</span>
              <div className="min-w-0">
                <p className="text-xs font-mono text-primary truncate">{issue.path}</p>
                <p className="text-xs text-foreground mt-0.5">{issue.message}</p>
              </div>
            </div>
          ))}
        </div>
      </AnalysisCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnalysisCard title="Type Distribution" icon={Database} color="text-blue-500">
          <div className="space-y-2">
            {Object.entries(d.stats).map(([k, v]) => {
              const total = Object.values(d.stats).reduce((a, b) => a + b, 0);
              const pct = Math.round((v / total) * 100);
              return (
                <div key={k} className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground capitalize">{k}</span>
                    <span className="font-mono font-medium text-foreground">{v} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </AnalysisCard>
        <AnalysisCard title="Recommendations" icon={Zap} color="text-green-500">
          <ul className="space-y-2">
            {d.recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </AnalysisCard>
      </div>
    </div>
  );
}

// ─── PDF / DOCX Analysis ──────────────────────────────────────────────────────

function DocAnalysis({ data, onRegenerate }: { data: Record<string, unknown>; onRegenerate?: () => void }) {
  const d = data as {
    fileName: string; pageCount: number; wordCount: number; summary: string;
    requirements: string[];
    testCases: Array<{ id: string; title: string; priority: string }>;
    bugs: Array<{ id: string; title: string; severity: string }>;
    acceptanceCriteria: string[];
  };

  return (
    <div className="space-y-4">
      <ActionBar onRegenerate={onRegenerate} />

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Pages", val: d.pageCount, color: "text-foreground", bg: "bg-muted/50" },
          { label: "Word Count", val: d.wordCount.toLocaleString(), color: "text-blue-500", bg: "bg-blue-500/5 border border-blue-500/20" },
          { label: "Reqs Found", val: d.requirements.length, color: "text-purple-500", bg: "bg-purple-500/5 border border-purple-500/20" },
        ].map(s => (
          <div key={s.label} className={cn("rounded-lg p-3 text-center", s.bg)}>
            <div className={cn("text-xl font-bold", s.color)}>{s.val}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <AnalysisCard title="AI Summary" icon={Sparkles} color="text-violet-500">
        <p className="text-sm text-foreground leading-relaxed">{d.summary}</p>
      </AnalysisCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnalysisCard title="Extracted Requirements" icon={ClipboardList} color="text-blue-500">
          <ul className="space-y-1.5">
            {d.requirements.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span className="text-primary font-mono shrink-0">{r.split(":")[0]}:</span>
                <span className="text-foreground">{r.split(":").slice(1).join(":")}</span>
              </li>
            ))}
          </ul>
        </AnalysisCard>

        <AnalysisCard title="Generated Test Cases" icon={FileSearch} color="text-green-500">
          <div className="space-y-1.5">
            {d.testCases.map((tc) => (
              <div key={tc.id} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-primary shrink-0">{tc.id}</span>
                <span className="text-foreground flex-1 truncate">{tc.title}</span>
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0", severityBg(tc.priority.toLowerCase()))}>{tc.priority}</span>
              </div>
            ))}
          </div>
        </AnalysisCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnalysisCard title="Potential Bugs" icon={Bug} color="text-red-500">
          <div className="space-y-2">
            {d.bugs.map((b) => (
              <div key={b.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/5 border border-red-500/15">
                <span className="font-mono text-[10px] text-red-500 font-bold shrink-0 mt-0.5">{b.id}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground">{b.title}</p>
                </div>
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0", severityBg(b.severity))}>{b.severity}</span>
              </div>
            ))}
          </div>
        </AnalysisCard>

        <AnalysisCard title="Acceptance Criteria" icon={CheckCircle2} color="text-green-500">
          <ul className="space-y-2">
            {d.acceptanceCriteria.map((ac, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                <span className="text-foreground">{ac}</span>
              </li>
            ))}
          </ul>
        </AnalysisCard>
      </div>
    </div>
  );
}

// ─── Image Analysis ───────────────────────────────────────────────────────────

function ImageAnalysis({ data, onRegenerate }: { data: Record<string, unknown>; onRegenerate?: () => void }) {
  const d = data as {
    dimensions: string; format: string; ocrText: string;
    uiIssues: Array<{ type: string; element: string; description: string; severity: string; wcag: string }>;
    accessibilityScore: number;
    possibleBugs: string[];
    recommendations: string[];
  };

  const scoreColor = d.accessibilityScore >= 90 ? "text-green-500" : d.accessibilityScore >= 70 ? "text-yellow-500" : "text-red-500";
  const scoreBg = d.accessibilityScore >= 90 ? "from-green-500 to-emerald-500" : d.accessibilityScore >= 70 ? "from-yellow-500 to-orange-500" : "from-red-500 to-rose-500";

  return (
    <div className="space-y-4">
      <ActionBar onRegenerate={onRegenerate} />

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Dimensions", val: d.dimensions, color: "text-foreground", bg: "bg-muted/50" },
          { label: "Format", val: d.format, color: "text-blue-500", bg: "bg-blue-500/5 border border-blue-500/20" },
          { label: "A11y Score", val: `${d.accessibilityScore}/100`, color: scoreColor, bg: "bg-muted/50" },
        ].map(s => (
          <div key={s.label} className={cn("rounded-lg p-3 text-center", s.bg)}>
            <div className={cn("text-lg font-bold", s.color)}>{s.val}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Accessibility score bar */}
      <AnalysisCard title="Accessibility Score" icon={ShieldAlert} color="text-yellow-500">
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0">
              <svg className="h-16 w-16 -rotate-90" viewBox="0 0 60 60">
                <circle cx="30" cy="30" r="24" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted" />
                <circle cx="30" cy="30" r="24" fill="none" strokeWidth="6" strokeLinecap="round"
                  className={`text-transparent`}
                  stroke={`url(#score-grad)`}
                  strokeDasharray={`${(d.accessibilityScore / 100) * 150.8} 150.8`} />
                <defs>
                  <linearGradient id="score-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" className={scoreBg.includes("green") ? "stop-green-500" : scoreBg.includes("yellow") ? "stop-yellow-500" : "stop-red-500"} stopColor={d.accessibilityScore >= 90 ? "#22c55e" : d.accessibilityScore >= 70 ? "#eab308" : "#ef4444"} />
                    <stop offset="100%" stopColor={d.accessibilityScore >= 90 ? "#10b981" : d.accessibilityScore >= 70 ? "#f97316" : "#f43f5e"} />
                  </linearGradient>
                </defs>
              </svg>
              <span className={cn("absolute inset-0 flex items-center justify-center text-sm font-bold", scoreColor)}>{d.accessibilityScore}</span>
            </div>
            <div className="flex-1 space-y-1.5">
              {[
                { label: "Contrast Ratio", score: 60, max: 100 },
                { label: "Focus Management", score: 75, max: 100 },
                { label: "ARIA Labels", score: 55, max: 100 },
                { label: "Touch Targets", score: 80, max: 100 },
              ].map(m => (
                <div key={m.label} className="space-y-0.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">{m.label}</span>
                    <span className="font-mono text-foreground">{m.score}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${m.score}%`, background: m.score >= 80 ? "#22c55e" : m.score >= 60 ? "#eab308" : "#ef4444" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AnalysisCard>

      <AnalysisCard title="UI & Accessibility Issues" icon={AlertTriangle} color="text-red-500">
        <div className="space-y-2">
          {d.uiIssues.map((issue, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors">
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 mt-0.5", severityBg(issue.severity))}>{issue.severity.toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">{issue.element}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{issue.description}</p>
              </div>
              <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0">WCAG {issue.wcag}</span>
            </div>
          ))}
        </div>
      </AnalysisCard>

      <AnalysisCard title="OCR — Detected Text" icon={Eye} color="text-blue-500">
        <p className="text-xs font-mono text-foreground bg-muted/50 rounded-lg p-3 leading-relaxed">{d.ocrText}</p>
      </AnalysisCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnalysisCard title="Possible Bugs" icon={Bug} color="text-orange-500">
          <ul className="space-y-2">
            {d.possibleBugs.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <TriangleAlert className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
                <span className="text-foreground">{b}</span>
              </li>
            ))}
          </ul>
        </AnalysisCard>
        <AnalysisCard title="UI Recommendations" icon={Zap} color="text-green-500">
          <ul className="space-y-2">
            {d.recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                <span className="text-foreground">{r}</span>
              </li>
            ))}
          </ul>
        </AnalysisCard>
      </div>
    </div>
  );
}

// ─── CSV / Excel Analysis ─────────────────────────────────────────────────────

function CsvAnalysis({ data, onRegenerate }: { data: Record<string, unknown>; onRegenerate?: () => void }) {
  const d = data as {
    rows: number; columns: number; columnNames: string[];
    anomalies: Array<{ column: string; description: string; severity: string; affectedRows: number | null }>;
    chartData: { passRateByBuild: number[]; builds: string[]; durationP99ByBuild: number[] };
    report: { passingTests: number; failingTests: number; flakyTests: number; avgDurationMs: number; topFailingSuites: string[] };
  };

  const maxPassRate = 100;

  return (
    <div className="space-y-4">
      <ActionBar onRegenerate={onRegenerate} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Rows", val: d.rows.toLocaleString(), color: "text-foreground", bg: "bg-muted/50" },
          { label: "Passing Tests", val: d.report.passingTests.toLocaleString(), color: "text-green-500", bg: "bg-green-500/5 border border-green-500/20" },
          { label: "Failing Tests", val: d.report.failingTests.toLocaleString(), color: "text-red-500", bg: "bg-red-500/5 border border-red-500/20" },
          { label: "Flaky Tests", val: d.report.flakyTests.toLocaleString(), color: "text-yellow-500", bg: "bg-yellow-500/5 border border-yellow-500/20" },
        ].map(s => (
          <div key={s.label} className={cn("rounded-lg p-3 text-center", s.bg)}>
            <div className={cn("text-xl font-bold", s.color)}>{s.val}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Pass rate chart */}
      <AnalysisCard title="Pass Rate Trend — Last 10 Builds" icon={BarChart3} color="text-blue-500">
        <div className="space-y-2">
          <div className="flex items-end gap-1.5 h-24">
            {d.chartData.passRateByBuild.map((rate, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={cn("w-full rounded-t transition-all", rate >= 92 ? "bg-green-500" : rate >= 85 ? "bg-yellow-500" : "bg-red-500")}
                  style={{ height: `${(rate / maxPassRate) * 96}px` }}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {d.chartData.builds.map((b, i) => (
              <div key={i} className="flex-1 text-center text-[9px] text-muted-foreground font-mono">{b}</div>
            ))}
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-sm bg-green-500" /><span className="text-muted-foreground">≥ 92%</span></div>
            <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-sm bg-yellow-500" /><span className="text-muted-foreground">85–92%</span></div>
            <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-sm bg-red-500" /><span className="text-muted-foreground">&lt; 85%</span></div>
          </div>
        </div>
      </AnalysisCard>

      <AnalysisCard title="Anomalies Detected" icon={AlertTriangle} color="text-orange-500">
        <div className="space-y-2">
          {d.anomalies.map((a, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors">
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 mt-0.5", severityBg(a.severity))}>{a.severity.toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-mono font-medium text-primary">{a.column}</p>
                <p className="text-xs text-foreground mt-0.5">{a.description}</p>
              </div>
              {a.affectedRows != null && (
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-foreground">{a.affectedRows.toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground">rows</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </AnalysisCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnalysisCard title="P99 Duration Trend" icon={Activity} color="text-purple-500">
          <div className="flex items-end gap-1.5 h-20">
            {d.chartData.durationP99ByBuild.map((ms, i) => {
              const maxMs = Math.max(...d.chartData.durationP99ByBuild);
              const pct = (ms / maxMs) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                  <div title={`${ms.toLocaleString()}ms`}
                    className={cn("w-full rounded-t transition-all cursor-default", ms > 10000 ? "bg-red-500" : ms > 5000 ? "bg-orange-500" : "bg-violet-500")}
                    style={{ height: `${(pct / 100) * 80}px` }} />
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            {d.chartData.builds.map((b, i) => (
              <div key={i} className="flex-1 text-center text-[9px] text-muted-foreground font-mono">{b}</div>
            ))}
          </div>
        </AnalysisCard>

        <AnalysisCard title="Top Failing Suites" icon={Bug} color="text-red-500">
          <div className="space-y-2">
            {d.report.topFailingSuites.map((s, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-red-500/5 border border-red-500/15">
                <span className="text-red-500 font-bold text-xs shrink-0">#{i + 1}</span>
                <span className="font-mono text-xs text-foreground">{s}</span>
              </div>
            ))}
            <div className="pt-1 text-xs text-muted-foreground">Avg duration: <span className="font-mono text-foreground">{d.report.avgDurationMs.toLocaleString()}ms</span></div>
          </div>
        </AnalysisCard>
      </div>
    </div>
  );
}

// ─── ZIP Analysis ─────────────────────────────────────────────────────────────

function ZipAnalysis({ data, onRegenerate }: { data: Record<string, unknown>; onRegenerate?: () => void }) {
  const d = data as { contents: Array<{ name: string; type: string; items?: number; size?: string }>; summary: string };
  return (
    <div className="space-y-4">
      <ActionBar onRegenerate={onRegenerate} />
      <AnalysisCard title="Archive Summary" icon={Sparkles} color="text-violet-500">
        <p className="text-sm text-foreground leading-relaxed">{d.summary}</p>
      </AnalysisCard>
      <AnalysisCard title="Contents" icon={Package} color="text-blue-500">
        <div className="space-y-1.5">
          {d.contents.map((c, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40 text-xs">
              <Archive className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-mono text-foreground flex-1">{c.name}</span>
              {c.items && <span className="text-muted-foreground">{c.items} items</span>}
              {c.size && <span className="text-muted-foreground font-mono">{c.size}</span>}
            </div>
          ))}
        </div>
      </AnalysisCard>
    </div>
  );
}

// ─── Analysis Dispatcher ──────────────────────────────────────────────────────

function AnalysisView({ file, onRegenerate }: { file: UploadedFile; onRegenerate?: () => void }) {
  if (!file.analysis) return null;
  const { category, data } = file.analysis;
  switch (category) {
    case "log": case "txt": return <LogAnalysis data={data} onRegenerate={onRegenerate} />;
    case "har": return <HarAnalysis data={data} onRegenerate={onRegenerate} />;
    case "json": case "xml": return <JsonXmlAnalysis data={data} onRegenerate={onRegenerate} />;
    case "pdf": case "docx": return <DocAnalysis data={data} onRegenerate={onRegenerate} />;
    case "image": return <ImageAnalysis data={data} onRegenerate={onRegenerate} />;
    case "csv": case "excel": return <CsvAnalysis data={data} onRegenerate={onRegenerate} />;
    case "zip": return <ZipAnalysis data={data} onRegenerate={onRegenerate} />;
    default: return null;
  }
}

// ─── Supported Formats ────────────────────────────────────────────────────────

const SUPPORTED_FORMATS = [
  { ext: ".log", color: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/25" },
  { ext: ".txt", color: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/25" },
  { ext: ".json", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25" },
  { ext: ".xml", color: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/25" },
  { ext: ".csv", color: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/25" },
  { ext: ".xlsx", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25" },
  { ext: ".pdf", color: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25" },
  { ext: ".docx", color: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/25" },
  { ext: ".har", color: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/25" },
  { ext: ".zip", color: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/25" },
  { ext: ".png", color: "bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/25" },
  { ext: ".jpg", color: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25" },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AiFileAnalysis() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const selectedFile = files.find(f => f.id === selectedId) ?? null;

  const simulateUpload = useCallback((rawFile: File) => {
    const id = crypto.randomUUID();
    const category = detectCategory(rawFile.name);
    const newFile: UploadedFile = {
      id, name: rawFile.name, size: rawFile.size,
      category, progress: 0, status: "uploading",
      uploadedAt: new Date(),
    };
    setFiles(prev => [newFile, ...prev]);
    setSelectedId(id);

    // Upload progress simulation
    let progress = 0;
    const uploadInterval = setInterval(() => {
      progress += Math.random() * 18 + 8;
      if (progress >= 100) {
        clearInterval(uploadInterval);
        setFiles(prev => prev.map(f => f.id === id ? { ...f, progress: 100, status: "analyzing" } : f));

        // Analyzing phase
        const analyzeDelay = 1200 + Math.random() * 800;
        setTimeout(() => {
          const analysis = generateMockAnalysis(category, rawFile.name);
          setFiles(prev => prev.map(f => f.id === id ? { ...f, status: "done", analysis } : f));
        }, analyzeDelay);
      } else {
        setFiles(prev => prev.map(f => f.id === id ? { ...f, progress: Math.min(progress, 98) } : f));
      }
    }, 80);
  }, []);

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    Array.from(fileList).forEach(simulateUpload);
  }, [simulateUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!dropRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleRegenerate = useCallback((id: string) => {
    setRegeneratingId(id);
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: "analyzing", analysis: undefined } : f));
    setTimeout(() => {
      const file = files.find(f => f.id === id);
      if (!file) return;
      const analysis = generateMockAnalysis(file.category, file.name);
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: "done", analysis } : f));
      setRegeneratingId(null);
    }, 1600);
  }, [files]);

  const handleRemove = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    setSelectedId(prev => prev === id ? null : prev);
  }, []);

  // Persist files list in sessionStorage (omit analysis data for brevity)
  useEffect(() => {
    if (files.length > 0 && !selectedId) {
      setSelectedId(files[0].id);
    }
  }, [files, selectedId]);

  return (
    <div className="-m-6 md:-m-8 flex overflow-hidden bg-background" style={{ height: "calc(100vh - 4rem)" }}>

      {/* ── Left Panel: Upload + Files ── */}
      <div className="w-72 border-r border-border bg-card flex flex-col shrink-0">

        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
              <ScanSearch className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-foreground">AI File Analysis</span>
            <Badge className="ml-auto bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-[9px] border-0 px-1.5">PRO</Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">Upload files for instant AI-powered insights</p>
        </div>

        {/* Drop zone */}
        <div className="p-3 border-b border-border">
          <div
            ref={dropRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "relative rounded-xl border-2 border-dashed p-5 cursor-pointer transition-all duration-200 text-center",
              isDragging
                ? "border-primary bg-primary/8 scale-[1.01]"
                : "border-border hover:border-primary/50 hover:bg-muted/50"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".log,.txt,.json,.xml,.csv,.xlsx,.xls,.pdf,.docx,.doc,.har,.zip,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={e => handleFiles(e.target.files)}
            />
            <div className={cn("mx-auto mb-2 h-10 w-10 rounded-xl flex items-center justify-center transition-colors",
              isDragging ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
              <Upload className="h-5 w-5" />
            </div>
            <p className="text-xs font-medium text-foreground">
              {isDragging ? "Drop files here" : "Drag & drop files"}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">or click to browse</p>
            <button className="mt-2.5 w-full py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5">
              <FileSearch className="h-3 w-3" />
              Browse Files
            </button>
          </div>

          {/* Supported formats */}
          <div className="mt-2.5">
            <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">Supported formats</p>
            <div className="flex flex-wrap gap-1">
              {SUPPORTED_FORMATS.map(f => (
                <span key={f.ext} className={cn("text-[9px] px-1.5 py-0.5 rounded border font-mono font-medium", f.color)}>{f.ext}</span>
              ))}
            </div>
          </div>
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto">
          {files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center">
              <FileSearch className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">No files yet. Upload a file to get started.</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              <p className="text-[10px] text-muted-foreground font-medium px-2 pb-1">Recent Files ({files.length})</p>
              {files.map(file => {
                const meta = categoryMeta(file.category);
                const Icon = meta.Icon;
                return (
                  <button
                    key={file.id}
                    onClick={() => setSelectedId(file.id)}
                    className={cn(
                      "w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all group",
                      selectedId === file.id ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/60"
                    )}
                  >
                    <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0 border", meta.color)}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-xs font-medium truncate", selectedId === file.id ? "text-primary" : "text-foreground")}>
                        {file.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {file.status === "uploading" && (
                          <div className="flex items-center gap-1 w-full">
                            <div className="h-1 flex-1 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${file.progress}%` }} />
                            </div>
                            <span className="text-[10px] text-muted-foreground">{Math.round(file.progress)}%</span>
                          </div>
                        )}
                        {file.status === "analyzing" && (
                          <div className="flex items-center gap-1 text-[10px] text-violet-500">
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            Analyzing…
                          </div>
                        )}
                        {file.status === "done" && (
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-2.5 w-2.5 text-green-500" />
                            <span className="text-[10px] text-muted-foreground">{formatBytes(file.size)}</span>
                            <span className="text-[10px] text-muted-foreground">· {formatDate(file.uploadedAt)}</span>
                          </div>
                        )}
                        {file.status === "error" && (
                          <span className="text-[10px] text-red-500">Upload failed</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); handleRemove(file.id); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-destructive transition-all"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Right Panel: Analysis ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <div className="h-14 border-b border-border flex items-center justify-between px-5 bg-card/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            {selectedFile ? (
              <>
                {(() => { const meta = categoryMeta(selectedFile.category); const Icon = meta.Icon; return <Icon className="h-4 w-4 text-muted-foreground" />; })()}
                <h1 className="text-sm font-semibold text-foreground truncate max-w-xs">{selectedFile.name}</h1>
                {selectedFile.status === "done" && (
                  <Badge className={cn("text-[10px] border px-1.5", categoryMeta(selectedFile.category).color)}>
                    {categoryMeta(selectedFile.category).label}
                  </Badge>
                )}
                {(selectedFile.status === "uploading" || selectedFile.status === "analyzing") && (
                  <div className="flex items-center gap-1.5 text-xs text-primary">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {selectedFile.status === "uploading" ? `Uploading… ${Math.round(selectedFile.progress)}%` : "Analyzing with AI…"}
                  </div>
                )}
              </>
            ) : (
              <h1 className="text-sm font-semibold text-foreground">AI File Analysis</h1>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-[10px] border-0 shadow-sm">
              <Sparkles className="h-2.5 w-2.5 mr-1" />
              AI Powered
            </Badge>
            {selectedFile?.status === "done" && (
              <button
                onClick={() => handleRegenerate(selectedFile.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <RotateCcw className={cn("h-3.5 w-3.5", regeneratingId === selectedFile.id && "animate-spin")} />
                Regenerate
              </button>
            )}
          </div>
        </div>

        {/* Analysis body */}
        <div className="flex-1 overflow-y-auto">
          {!selectedFile ? (
            // Empty state
            <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-violet-500/15 border border-indigo-500/20 flex items-center justify-center">
                <ScanSearch className="h-10 w-10 text-indigo-500" />
              </div>
              <div className="text-center">
                <h2 className="text-lg font-semibold text-foreground mb-1">Upload a file to begin</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Drop any log, HAR, JSON, PDF, screenshot, CSV, or ZIP file into the left panel. Our AI will instantly analyse it and surface actionable insights.
                </p>
              </div>
              {/* Capability grid */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 max-w-2xl">
                {[
                  { icon: FileText, label: "Log Analysis", color: "text-orange-500", bg: "bg-orange-500/8" },
                  { icon: Globe, label: "HAR Inspection", color: "text-violet-500", bg: "bg-violet-500/8" },
                  { icon: FileJson, label: "JSON / XML", color: "text-blue-500", bg: "bg-blue-500/8" },
                  { icon: File, label: "PDF / DOCX", color: "text-red-500", bg: "bg-red-500/8" },
                  { icon: Image, label: "Screenshots", color: "text-pink-500", bg: "bg-pink-500/8" },
                  { icon: FileSpreadsheet, label: "CSV / Excel", color: "text-green-500", bg: "bg-green-500/8" },
                ].map(cap => (
                  <div key={cap.label} className={cn("rounded-xl p-4 flex flex-col items-center gap-2 text-center border border-border", cap.bg)}>
                    <cap.icon className={cn("h-6 w-6", cap.color)} />
                    <span className="text-[11px] font-medium text-foreground">{cap.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : selectedFile.status === "uploading" ? (
            // Upload in progress
            <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
              <div className="h-20 w-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Upload className="h-10 w-10 text-primary animate-bounce" />
              </div>
              <div className="text-center w-full max-w-xs">
                <h2 className="text-base font-semibold text-foreground mb-1">Uploading {selectedFile.name}</h2>
                <p className="text-sm text-muted-foreground mb-4">{formatBytes(selectedFile.size)}</p>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300"
                    style={{ width: `${selectedFile.progress}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">{Math.round(selectedFile.progress)}% complete</p>
              </div>
            </div>
          ) : selectedFile.status === "analyzing" ? (
            // AI analyzing
            <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
              <div className="relative h-20 w-20">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 flex items-center justify-center">
                  <Sparkles className="h-10 w-10 text-indigo-500" />
                </div>
                <div className="absolute -inset-1 rounded-2xl border-2 border-indigo-500/30 animate-ping opacity-40" />
              </div>
              <div className="text-center">
                <h2 className="text-base font-semibold text-foreground mb-1">AI is analysing your file…</h2>
                <p className="text-sm text-muted-foreground mb-4">Running {categoryMeta(selectedFile.category).label} intelligence pipeline</p>
                <div className="flex flex-col gap-2 w-full max-w-xs mx-auto">
                  {[
                    { label: "Parsing structure", done: true },
                    { label: "Extracting signals", done: true },
                    { label: "Running AI models", done: false },
                    { label: "Generating insights", done: false },
                  ].map((step, i) => (
                    <div key={step.label} className="flex items-center gap-2 text-xs">
                      {step.done ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      ) : (
                        <Loader2 className={cn("h-3.5 w-3.5 shrink-0", i === 2 ? "text-primary animate-spin" : "text-muted-foreground/30")} />
                      )}
                      <span className={step.done ? "text-foreground" : i === 2 ? "text-primary" : "text-muted-foreground/40"}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // Analysis done
            <div className="max-w-4xl mx-auto px-6 py-6">
              {/* File header */}
              <div className="flex items-center gap-4 mb-6 p-4 rounded-xl border border-border bg-card">
                <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center border shrink-0", categoryMeta(selectedFile.category).color)}>
                  {(() => { const meta = categoryMeta(selectedFile.category); const Icon = meta.Icon; return <Icon className="h-6 w-6" />; })()}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-foreground truncate">{selectedFile.name}</h2>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted-foreground">{formatBytes(selectedFile.size)}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">Analysed {formatDate(selectedFile.uploadedAt)}</span>
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">Analysis complete</span>
                  </div>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                >
                  <Upload className="h-3 w-3" />
                  Upload another
                </button>
              </div>

              {/* Analysis cards */}
              <AnalysisView
                file={selectedFile}
                onRegenerate={() => handleRegenerate(selectedFile.id)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
