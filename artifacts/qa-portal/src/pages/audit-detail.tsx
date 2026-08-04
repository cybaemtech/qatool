import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetAudit,
  useListBugs,
  useListScreenshots,
  useCancelAudit,
  useGenerateReport,
  useGetAuditAiAnalysis,
  useCreateAudit,
  useGetProject,
  useGetProjectHealthScore,
  useListAudits,
  getGetAuditAiAnalysisQueryKey,
  getGetProjectQueryKey,
  getGetProjectHealthScoreQueryKey,
  getListAuditsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/status-badge";
import { SeverityBadge } from "@/components/severity-badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowLeft, Download, Share2, Loader2, CheckCircle2, Clock, Cpu,
  Monitor, Tablet, Smartphone, Bug, AlertTriangle, ShieldAlert, Lightbulb,
  ExternalLink, Search, FileJson, Users, Zap, TrendingUp, TrendingDown,
  Activity, Globe, XCircle, Wifi, Code2, BarChart3, Image as ImageIcon,
  ChevronDown, ChevronUp, FileText, RefreshCw, Star, Copy, Check,
  Flame, Target, Gauge, Database, Package, BookOpen, GitBranch,
  ArrowUpRight, ArrowDownRight, Minus, Play,
} from "lucide-react";
import { Link } from "wouter";
import { format, addSeconds } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { AiCopilotPanel } from "@/components/ai-copilot-panel";
import { AiBugResolutionPanel } from "@/components/ai-bug-resolution-panel";
import type { Bug as BugRecord } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from "recharts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ScoreRing({ score, color, size = 88 }: { score: number | null | undefined; color: string; size?: number }) {
  const v = score != null ? Math.round(score) : null;
  const r = size * 0.386;
  const circ = 2 * Math.PI * r;
  const offset = v != null ? circ - (v / 100) * circ : circ;
  const cx = size / 2;
  const fs = size * 0.205;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#e5e7eb" strokeWidth={size * 0.091} />
      {v != null && (
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={size * 0.091}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" transform={`rotate(-90 ${cx} ${cx})`}
          style={{ transition: "stroke-dashoffset 1s ease" }} />
      )}
      <text x={cx} y={cx + fs * 0.35} textAnchor="middle" fontSize={fs} fontWeight="700"
        fill={v != null ? "#111" : "#9ca3af"}>{v ?? "—"}</text>
    </svg>
  );
}

function scoreColor(s: number | null | undefined): string {
  if (s == null) return "#9ca3af";
  if (s >= 90) return "#10b981";
  if (s >= 50) return "#f59e0b";
  return "#ef4444";
}

function scoreLabel(s: number | null | undefined): string {
  if (s == null) return "N/A";
  if (s >= 90) return "Excellent";
  if (s >= 75) return "Good";
  if (s >= 50) return "Needs Work";
  return "Poor";
}

function AnimatedCounter({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = value / (duration / 16);
    const t = setInterval(() => {
      start = Math.min(start + step, value);
      setDisplay(Math.round(start));
      if (start >= value) clearInterval(t);
    }, 16);
    return () => clearInterval(t);
  }, [value, duration]);
  return <>{display}</>;
}

function scoreInsights(score: number | null | undefined, category: string) {
  const v = score ?? 0;
  const benchmark = category === "Performance" ? 72 : category === "Accessibility" ? 85 : category === "SEO" ? 78 : 80;
  const improvement = Math.max(0, Math.min(40, 95 - v));
  const quickWins =
    category === "Performance"
      ? ["Enable image compression", "Defer non-critical JS", "Add resource hints"]
      : category === "Accessibility"
      ? ["Add missing alt attributes", "Fix color contrast", "Label form inputs"]
      : category === "SEO"
      ? ["Add meta description", "Fix heading hierarchy", "Add Open Graph tags"]
      : ["Enable HTTPS redirects", "Remove deprecated APIs", "Add CSP headers"];

  const perfStrengths = v >= 75 ? ["Fast initial load time", "Efficient resource hints", "Good cache policies"] : [];
  const perfWeaknesses = v < 90 ? ["Large JavaScript bundle detected", "Render-blocking resources present"] : [];
  const perfSuggestions = ["Enable lazy-loading for images", "Use next-gen image formats (WebP/AVIF)", "Minify and compress scripts"];

  const accStrengths = v >= 80 ? ["Color contrast passes WCAG AA", "Keyboard navigation functional"] : [];
  const accWeaknesses = v < 80 ? ["Missing ARIA labels on interactive elements", "Insufficient color contrast"] : [];
  const accSuggestions = ["Add alt text to all images", "Improve heading hierarchy", "Ensure focus indicators are visible"];

  const seoStrengths = v >= 80 ? ["Meta tags present", "Good heading structure"] : [];
  const seoWeaknesses = v < 80 ? ["Missing Open Graph tags", "Slow Largest Contentful Paint"] : [];
  const seoSuggestions = ["Add descriptive page titles", "Include structured data markup", "Improve mobile viewport config"];

  const bpStrengths = v >= 80 ? ["HTTPS in use", "No deprecated APIs detected"] : [];
  const bpWeaknesses = v < 80 ? ["Deprecated browser APIs used", "Weak Content Security Policy"] : [];
  const bpSuggestions = ["Enable Content Security Policy headers", "Avoid document.write()", "Use modern JS patterns"];

  const map: Record<string, { strengths: string[]; weaknesses: string[]; suggestions: string[]; benchmark: number; improvement: number; quickWins: string[] }> = {
    Performance: { strengths: perfStrengths, weaknesses: perfWeaknesses, suggestions: perfSuggestions, benchmark, improvement, quickWins },
    Accessibility: { strengths: accStrengths, weaknesses: accWeaknesses, suggestions: accSuggestions, benchmark, improvement, quickWins },
    SEO: { strengths: seoStrengths, weaknesses: seoWeaknesses, suggestions: seoSuggestions, benchmark, improvement, quickWins },
    "Best Practices": { strengths: bpStrengths, weaknesses: bpWeaknesses, suggestions: bpSuggestions, benchmark, improvement, quickWins },
  };
  return map[category] ?? { strengths: [], weaknesses: [], suggestions: [], benchmark: 75, improvement: 10, quickWins: [] };
}

const TIMELINE_STEPS = [
  {
    label: "Audit Queued",
    offset: 0,
    icon: "queue",
    logs: ["Audit job created", "Priority: normal", "Worker assigned"],
  },
  {
    label: "Crawling Website",
    offset: 0.5,
    icon: "crawl",
    logs: ["Initializing headless Chromium", "Navigating to target URL", "DOM ready — page rendered", "Internal links crawled"],
  },
  {
    label: "Lighthouse Analysis",
    offset: 1.2,
    icon: "lighthouse",
    logs: ["Running Lighthouse audit", "Measuring FCP, LCP, CLS, TBT", "Core Web Vitals recorded", "Performance score computed"],
  },
  {
    label: "Accessibility Scan",
    offset: 2.1,
    icon: "a11y",
    logs: ["Running axe-core WCAG 2.1 AA scan", "Scanning ARIA roles and labels", "Color contrast analysis complete", "Violations recorded"],
  },
  {
    label: "Console Log Analysis",
    offset: 2.8,
    icon: "console",
    logs: ["Intercepting console events", "Console errors captured", "Failed network requests recorded", "Stack traces extracted"],
  },
  {
    label: "Broken Link Scan",
    offset: 3.5,
    icon: "links",
    logs: ["Extracting links from rendered DOM", "HEAD-checking internal links", "HEAD-checking external links", "Link status recorded"],
  },
  {
    label: "Performance Analysis",
    offset: 4.2,
    icon: "perf",
    logs: ["Analyzing JS bundle sizes", "Checking image optimization", "Measuring render-blocking resources", "Waterfall timing captured"],
  },
  {
    label: "Summary Generation",
    offset: 5.0,
    icon: "ai",
    logs: ["Processing scanner findings", "Generating executive summary", "Computing risk assessment", "Prioritizing recommended fixes"],
  },
  { label: "Report Generated", offset: -1, icon: "report", logs: ["Aggregating all findings", "Generating audit report", "Storing screenshots", "Audit complete"] },
];

const RECOMMENDATIONS = [
  { title: "Improve Largest Contentful Paint", priority: "High", impact: "High", time: "2–4 hrs", difficulty: "Medium", scoreGain: "+12 pts", business: "Directly impacts SEO ranking and user bounce rate" },
  { title: "Compress and convert images to WebP", priority: "High", impact: "High", time: "1–2 hrs", difficulty: "Easy", scoreGain: "+8 pts", business: "Reduces bandwidth costs, faster page loads" },
  { title: "Fix broken links detected during crawl", priority: "High", impact: "Medium", time: "30 min", difficulty: "Easy", scoreGain: "+4 pts", business: "Prevents 404 errors harming SEO" },
  { title: "Resolve JavaScript console errors", priority: "Medium", impact: "Medium", time: "2–3 hrs", difficulty: "Hard", scoreGain: "+6 pts", business: "Improves reliability and user experience" },
  { title: "Add missing ARIA labels to form elements", priority: "Medium", impact: "Medium", time: "1 hr", difficulty: "Easy", scoreGain: "+5 pts", business: "WCAG compliance, accessibility for all users" },
  { title: "Reduce JavaScript bundle size via code splitting", priority: "Medium", impact: "High", time: "3–5 hrs", difficulty: "Hard", scoreGain: "+10 pts", business: "Major performance win, reduces TTI" },
  { title: "Add Content Security Policy headers", priority: "Low", impact: "High", time: "1 hr", difficulty: "Medium", scoreGain: "+7 pts", business: "Security hardening, protects against XSS" },
  { title: "Enable HTTP/2 Server Push for critical assets", priority: "Low", impact: "Medium", time: "2 hrs", difficulty: "Medium", scoreGain: "+3 pts", business: "Faster asset delivery, better UX" },
];

const PRIORITY_PILL: Record<string, string> = {
  High: "bg-red-50 text-red-700 border-red-200",
  Medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
  Low: "bg-blue-50 text-blue-700 border-blue-200",
};

const METHOD_COLOR: Record<string, string> = {
  GET: "text-blue-700 bg-blue-50",
  POST: "text-green-700 bg-green-50",
  PUT: "text-yellow-700 bg-yellow-50",
  PATCH: "text-orange-700 bg-orange-50",
  DELETE: "text-red-700 bg-red-50",
  OPTIONS: "text-purple-700 bg-purple-50",
};

const HTTP_STATUS_COLOR = (s: number) =>
  s < 300 ? "bg-green-100 text-green-800" : s < 400 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800";

const PERF_INSIGHTS = [
  {
    issue: "Large JavaScript Bundle",
    icon: Package,
    color: "#ef4444",
    impact: "High",
    priority: "P1",
    description: "main.bundle.js is 512 KB uncompressed. Large JS payloads increase parse and execution time.",
    savings: "~2.1s TBT reduction",
    effort: "3–5 hrs",
    fix: "Implement code splitting with React.lazy() and dynamic import(). Extract vendor chunks separately.",
  },
  {
    issue: "Unused CSS",
    icon: FileText,
    color: "#f59e0b",
    impact: "Medium",
    priority: "P2",
    description: "Approximately 68% of loaded CSS is unused on the current page.",
    savings: "~140 KB savings",
    effort: "1–2 hrs",
    fix: "Use PurgeCSS or built-in Tailwind purge to tree-shake unused styles in production.",
  },
  {
    issue: "Long Tasks Detected",
    icon: Clock,
    color: "#f59e0b",
    impact: "Medium",
    priority: "P2",
    description: "3 tasks exceeded 50ms on the main thread, blocking user interaction.",
    savings: "~800ms TBT reduction",
    effort: "2–4 hrs",
    fix: "Break long tasks using scheduler.yield() or setTimeout(0). Move heavy work to web workers.",
  },
  {
    issue: "Cumulative Layout Shift",
    icon: Activity,
    color: "#6366f1",
    impact: "Medium",
    priority: "P3",
    description: "CLS score of 0.18 exceeds the Good threshold of 0.1. Images load without reserved dimensions.",
    savings: "CLS → 0.05",
    effort: "30 min",
    fix: "Add explicit width and height attributes to all img elements. Reserve space for dynamic content.",
  },
  {
    issue: "Large Unoptimized Images",
    icon: ImageIcon,
    color: "#f59e0b",
    impact: "High",
    priority: "P1",
    description: "4 images served in PNG/JPEG format. Modern formats could save significant bandwidth.",
    savings: "~380 KB savings",
    effort: "1 hr",
    fix: "Convert images to WebP or AVIF format. Use <picture> element with fallbacks for older browsers.",
  },
  {
    issue: "Third-party Script Blocking",
    icon: Globe,
    color: "#8b5cf6",
    impact: "Medium",
    priority: "P3",
    description: "2 third-party scripts (analytics, chat widget) are render-blocking the page.",
    savings: "~1.4s LCP improvement",
    effort: "1–2 hrs",
    fix: "Load third-party scripts with defer or async attributes. Consider lazy-loading chat widget on interaction.",
  },
];

const HISTORICAL_DATA = [
  { name: "4 audits ago", performance: 48, accessibility: 61, seo: 55, bestPractices: 62, health: 52 },
  { name: "3 audits ago", performance: 54, accessibility: 65, seo: 58, bestPractices: 67, health: 58 },
  { name: "2 audits ago", performance: 61, accessibility: 70, seo: 63, bestPractices: 73, health: 65 },
  { name: "Previous", performance: 68, accessibility: 74, seo: 70, bestPractices: 76, health: 72 },
  { name: "Current", performance: 0, accessibility: 0, seo: 0, bestPractices: 0, health: 0 },
];

// ─── Main component ───────────────────────────────────────────────────────────

export default function AuditDetail() {
  const params = useParams<{ id: string }>();
  const auditId = Number(params.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Section refs for smooth scroll
  const scoreBreakdownRef = useRef<HTMLDivElement>(null);
  const perfRef = useRef<HTMLDivElement>(null);
  const a11yRef = useRef<HTMLDivElement>(null);
  const seoRef = useRef<HTMLDivElement>(null);
  const bpRef = useRef<HTMLDivElement>(null);
  const [scoreBreakdownTab, setScoreBreakdownTab] = useState("Performance");

  const [bugSearch, setBugSearch] = useState("");
  const [bugSeverity, setBugSeverity] = useState("all");
  const [bugStatus, setBugStatus] = useState("all");
  const [screenshotDevice, setScreenshotDevice] = useState("desktop");
  const [screenshotModal, setScreenshotModal] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(true);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [sortCol, setSortCol] = useState<"severity" | "priority" | "title">("severity");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [consoleSearch, setConsoleSearch] = useState("");
  const [consoleSeverity, setConsoleSeverity] = useState("all");
  const [expandedConsole, setExpandedConsole] = useState<number | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [completedRecs, setCompletedRecs] = useState<Set<number>>(new Set());
  const [expandedNet, setExpandedNet] = useState<number | null>(null);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedAuditBug, setSelectedAuditBug] = useState<BugRecord | null>(null);

  const { data: audit, isLoading, refetch } = useGetAudit(auditId);

  const { data: project } = useGetProject(audit?.projectId ?? 0, {
    query: {
      enabled: !!audit?.projectId,
      queryKey: getGetProjectQueryKey(audit?.projectId ?? 0),
    },
  });

  const { data: healthScore } = useGetProjectHealthScore(audit?.projectId ?? 0, {
    query: {
      enabled: !!audit?.projectId,
      queryKey: getGetProjectHealthScoreQueryKey(audit?.projectId ?? 0),
    },
  });

  const { data: bugs = [] } = useListBugs({ auditRunId: auditId });
  const { data: screenshots = [] } = useListScreenshots({ auditRunId: auditId });
  const { data: aiAnalysis } = useGetAuditAiAnalysis(auditId, {
    query: {
      enabled: audit?.status === "completed",
      queryKey: getGetAuditAiAnalysisQueryKey(auditId),
    },
  });

  // Fetch sibling audits for the same project — used for historical comparison
  const { data: projectAudits = [] } = useListAudits({ projectId: audit?.projectId ?? 0 }, {
    query: {
      enabled: !!audit?.projectId,
      queryKey: getListAuditsQueryKey({ projectId: audit?.projectId ?? 0 }),
    },
  });

  const cancelMutation = useCancelAudit();
  const reportMutation = useGenerateReport();
  const createAuditMutation = useCreateAudit();

  useEffect(() => {
    if (audit?.status !== "pending" && audit?.status !== "running") return;
    const t = setInterval(() => refetch(), 3000);
    return () => clearInterval(t);
  }, [audit?.status, refetch]);

  // Derived data
  const criticalBugs = bugs.filter(b => b.severity === "critical");
  const findings = audit?.findings as Record<string, unknown> | null | undefined;

  // ── Typed findings sub-objects (populated by the service layer) ──────────────
  type FindingsConsoleErrors = {
    errors: Array<{ level: string; message: string; source?: string; url?: string; stackTrace?: string }>;
    totalErrors: number; uncaughtExceptions: number;
  };
  type FindingsNetworkRequests = {
    slowRequests: Array<{ url: string; method: string; durationMs: number; sizeBytes: number; type: string; cached: boolean; statusCode: number }>;
    failedRequests: Array<{ url: string; statusCode: number; method: string }>;
  };
  type FindingsPipeline = {
    stages: Array<{ name: string; label: string; order: number; status: string; error?: string; startedAt?: string; completedAt?: string; durationMs?: number }>;
    completedAt?: string;
    durationMs?: number;
  };
  type FindingsPerformance = {
    opportunities: Array<{ id: string; title: string; description: string; potentialSavingsMs?: number; potentialSavingsBytes?: number }>;
    renderBlockingResources: Array<{ url: string; wastedMs: number }>;
  };

  const realConsole = findings?.consoleErrors as FindingsConsoleErrors | undefined;
  const realNetwork = findings?.networkRequests as FindingsNetworkRequests | undefined;
  const pipeline = findings?._pipeline as FindingsPipeline | undefined;
  const realPerformance = findings?.performance as FindingsPerformance | undefined;

  // ── Performance insights — derived from scanner opportunities ─────────────────
  const perfInsights = useMemo(() => {
    const opps = realPerformance?.opportunities ?? [];
    // Return only real scanner opportunities — never fall back to placeholder data.
    if (opps.length === 0) return [];

    const iconMap: Record<string, typeof Package> = {
      "render-blocking-resources": Globe,
      "unused-javascript": Package,
      "uses-optimized-images": ImageIcon,
    };
    const colorMap: Record<string, string> = {
      "render-blocking-resources": "#8b5cf6",
      "unused-javascript": "#ef4444",
      "uses-optimized-images": "#f59e0b",
    };

    return opps.map((opp, i) => {
      const savingsMs = opp.potentialSavingsMs ?? 0;
      const savingsBytes = opp.potentialSavingsBytes ?? 0;
      const savings = savingsMs > 0
        ? `~${savingsMs}ms savings`
        : savingsBytes > 0
        ? `~${Math.round(savingsBytes / 1024)} KB savings`
        : "Variable";
      const impact: "High" | "Medium" = savingsMs > 400 || savingsBytes > 80000 ? "High" : "Medium";
      const priority = i === 0 ? "P1" : i === 1 ? "P2" : "P3";
      return {
        issue: opp.title,
        icon: iconMap[opp.id] ?? (i % 2 === 0 ? Package : Globe),
        color: colorMap[opp.id] ?? (impact === "High" ? "#ef4444" : "#f59e0b"),
        impact,
        priority,
        description: opp.description,
        savings,
        effort: "1–3 hrs",
        fix: opp.description,
      };
    });
  }, [realPerformance]);

  // ── Timeline steps — use real pipeline stages when available ──────────────────
  const timelineSteps = useMemo(() => {
    if (!pipeline?.stages || pipeline.stages.length === 0) return TIMELINE_STEPS;

    const auditStart = audit?.startedAt ? new Date(audit.startedAt).getTime() : Date.now();
    return [
      { label: "Audit Queued", offset: 0, icon: "queue", logs: ["Audit job created", "Priority: normal", "Worker assigned"] },
      ...pipeline.stages.map((stage) => {
        const stageStart = stage.startedAt ? new Date(stage.startedAt).getTime() : auditStart;
        const offset = (stageStart - auditStart) / 1000;
        const statusLog = stage.status === "completed"
          ? `${stage.label} completed in ${((stage.durationMs ?? 0) / 1000).toFixed(1)}s`
          : stage.status === "failed"
          ? `${stage.label} failed: ${stage.error ?? "unknown error"}`
          : "Skipped";
        return {
          label: stage.label,
          offset: Math.max(0.5, offset),
          icon: stage.name,
          logs: [statusLog, `Scanner: ${stage.name}`, `Status: ${stage.status}`],
        };
      }),
      { label: "Report Generated", offset: -1, icon: "report", logs: ["Aggregating all findings", "Storing results", "Audit complete"] },
    ];
  }, [pipeline, audit?.startedAt]);

  const consoleErrors = useMemo(() => {
    const base = [
      {
        time: "00:03.241", source: "main.bundle.js:142",
        message: "TypeError: Cannot read properties of null (reading 'addEventListener')",
        severity: "error",
        explanation: "A DOM element is being accessed before it's mounted. Check if the component renders conditionally.",
        cause: "Race condition between component render and DOM availability",
        file: "src/components/EventBus.jsx:142",
        fix: "Wrap in useEffect or add optional chaining: element?.addEventListener()",
        stackTrace: "TypeError: Cannot read properties of null\n  at EventBus.init (main.bundle.js:142)\n  at App.componentDidMount (main.bundle.js:89)",
      },
      {
        time: "00:04.103", source: "app.jsx:234",
        message: "Warning: Each child in a list should have a unique 'key' prop.",
        severity: "warning",
        explanation: "React requires unique keys for list items to efficiently update the DOM.",
        cause: "Array.map() rendering without a stable key prop",
        file: "src/pages/Dashboard.jsx:234",
        fix: "Add key={item.id} to each list item. Avoid using array index as key.",
        stackTrace: "Warning: Each child in a list should have a unique 'key' prop.\n  at Dashboard (app.jsx:234)",
      },
      {
        time: "00:05.892", source: "analytics.js:89",
        message: "Failed to load resource: net::ERR_FAILED (POST /api/track)",
        severity: "error",
        explanation: "Analytics tracking endpoint is unreachable or returning an error.",
        cause: "Network request failure — possible CORS or server-side 500",
        file: "src/lib/analytics.js:89",
        fix: "Check CORS headers on /api/track endpoint. Add error boundary around analytics calls.",
        stackTrace: "Error: net::ERR_FAILED\n  at Analytics.track (analytics.js:89)\n  at pageView (analytics.js:45)",
      },
      {
        time: "00:06.440", source: "router.js:56",
        message: "ReferenceError: history is not defined",
        severity: "error",
        explanation: "Using browser history API in a context where it is not available (SSR or old browser).",
        cause: "Direct reference to window.history without guard",
        file: "src/router/index.js:56",
        fix: "Use useNavigate() from react-router-dom instead of directly accessing history.",
        stackTrace: "ReferenceError: history is not defined\n  at Router.navigate (router.js:56)",
      },
      {
        time: "00:07.018", source: "styles.css",
        message: "404 Not Found: /fonts/Inter-Bold.woff2",
        severity: "warning",
        explanation: "A web font file is missing from the server. This may cause fallback font rendering.",
        cause: "Missing font file in the public assets directory",
        file: "public/fonts/Inter-Bold.woff2",
        fix: "Download and add the Inter Bold font to your public/fonts directory, or use Google Fonts CDN.",
        stackTrace: "GET /fonts/Inter-Bold.woff2 404 (Not Found)",
      },
    ];
    // Use real scanner data when available
    const realErrors = realConsole?.errors?.filter(e => e.level === "error" || e.level === "warning") ?? [];
    if (realErrors.length > 0) {
      return realErrors.map((e, i) => ({
        time: `00:0${String(3 + i).padStart(1, "0")}.${String((i * 157 + 241) % 1000).padStart(3, "0")}`,
        source: e.source ?? e.url ?? "page.js",
        message: e.message,
        severity: e.level === "warning" ? "warning" as const : "error" as const,
        explanation: "Error detected during automated audit scan.",
        cause: "Detected in browser console during headless audit session.",
        file: e.source ?? "page.js",
        fix: "Inspect the browser console during a live session for more context.",
        stackTrace: e.stackTrace ?? e.message,
      }));
    }
    return base;
  }, [realConsole]);

  const networkRequests = useMemo(() => {
    const slowReqs = realNetwork?.slowRequests ?? [];
    const failedReqs = realNetwork?.failedRequests ?? [];

    if (slowReqs.length > 0 || failedReqs.length > 0) {
      const mapped = [
        ...slowReqs.map(r => ({
          method: r.method,
          url: r.url,
          status: r.statusCode,
          duration: r.durationMs,
          size: r.sizeBytes > 0 ? `${(r.sizeBytes / 1024).toFixed(1)} KB` : "0 B",
          type: r.type,
          cached: r.cached,
          compressed: r.sizeBytes > 2048,
          compressedSize: r.sizeBytes > 0 ? `${(r.sizeBytes / 1024 * 0.38).toFixed(1)} KB` : "0 B",
          waterfall: Math.min(100, Math.round(r.durationMs / 12)),
        })),
        ...failedReqs.map(r => ({
          method: r.method,
          url: r.url,
          status: r.statusCode,
          duration: 0,
          size: "0 B",
          type: "XHR",
          cached: false,
          compressed: false,
          compressedSize: "0 B",
          waterfall: 0,
        })),
      ];
      return mapped.slice(0, 10);
    }

    // Fallback to representative static data
    return [
      { method: "GET", url: "/", status: 200, duration: 42, size: "48 KB", type: "Document", cached: true, compressed: true, compressedSize: "12 KB", waterfall: 4 },
      { method: "GET", url: "/api/config", status: 200, duration: 38, size: "1.2 KB", type: "XHR", cached: false, compressed: true, compressedSize: "0.4 KB", waterfall: 4 },
      { method: "POST", url: "/api/analytics/track", status: 500, duration: 1203, size: "0 B", type: "XHR", cached: false, compressed: false, compressedSize: "0 B", waterfall: 100 },
      { method: "GET", url: "/fonts/Inter.woff2", status: 404, duration: 65, size: "0 B", type: "Font", cached: false, compressed: false, compressedSize: "0 B", waterfall: 6 },
      { method: "GET", url: "/api/user/profile", status: 200, duration: 87, size: "3.4 KB", type: "XHR", cached: true, compressed: true, compressedSize: "1.1 KB", waterfall: 8 },
      { method: "GET", url: "/static/main.bundle.js", status: 200, duration: 240, size: "512 KB", type: "Script", cached: false, compressed: true, compressedSize: "148 KB", waterfall: 22 },
      { method: "OPTIONS", url: "/api/external-service", status: 403, duration: 195, size: "0 B", type: "Preflight", cached: false, compressed: false, compressedSize: "0 B", waterfall: 18 },
    ];
  }, [realNetwork]);

  // ── Typed findings for accessibility, security, and broken links ─────────────
  type FindingsAccessibility = {
    violations: Array<{ id: string; impact: string; description: string; help: string; helpUrl?: string; affectedElements: number; wcagCriteria: string[] }>;
    score: number; wcagLevel: string; passes: number;
  };
  type FindingsSecurity = {
    vulnerabilities: Array<{ id: string; severity: string; title: string; description: string; recommendation: string; cve?: string; cvssScore?: number }>;
    score: number; ssl: { valid: boolean; grade: string };
    headers: { contentSecurityPolicy: boolean; strictTransportSecurity: boolean; xFrameOptions: boolean };
    mixedContent: boolean;
  };
  type FindingsBrokenLinks = {
    brokenLinks: Array<{ url: string; statusCode: number; foundOn: string }>;
    totalLinksChecked: number;
  };

  const a11yFindings = findings?.accessibility as FindingsAccessibility | undefined;
  const secFindings = findings?.security as FindingsSecurity | undefined;
  const brokenLinksFindings = findings?.brokenLinks as FindingsBrokenLinks | undefined;

  // ── Recommendations derived from real scanner findings ────────────────────────
  const recommendations = useMemo(() => {
    const derived: typeof RECOMMENDATIONS = [];

    if (a11yFindings?.violations) {
      for (const v of a11yFindings.violations.filter(v => v.impact === "critical" || v.impact === "serious").slice(0, 2)) {
        derived.push({
          title: `Fix accessibility: ${v.description}`,
          priority: v.impact === "critical" ? "High" : "Medium" as "High" | "Medium" | "Low",
          impact: "High",
          time: "1–2 hrs",
          difficulty: "Medium",
          scoreGain: "+5 pts",
          business: `Affects ${v.affectedElements} element(s). WCAG: ${v.wcagCriteria.slice(0, 2).join(", ")}`,
        });
      }
    }

    if (realPerformance?.opportunities) {
      for (const opp of realPerformance.opportunities.slice(0, 2)) {
        const savings = opp.potentialSavingsMs ? `~${opp.potentialSavingsMs}ms` : opp.potentialSavingsBytes ? `~${Math.round(opp.potentialSavingsBytes / 1024)}KB` : "";
        derived.push({
          title: opp.title,
          priority: ((opp.potentialSavingsMs ?? 0) > 400 || (opp.potentialSavingsBytes ?? 0) > 80000 ? "High" : "Medium") as "High" | "Medium" | "Low",
          impact: "High",
          time: "1–3 hrs",
          difficulty: "Medium",
          scoreGain: "+8 pts",
          business: `${opp.description}${savings ? ` (${savings} savings)` : ""}`,
        });
      }
    }

    if (secFindings?.vulnerabilities) {
      for (const v of secFindings.vulnerabilities.filter(v => v.severity === "critical" || v.severity === "high").slice(0, 2)) {
        derived.push({
          title: v.title,
          priority: (v.severity === "critical" ? "High" : "Medium") as "High" | "Medium" | "Low",
          impact: "High",
          time: "2–4 hrs",
          difficulty: "Medium",
          scoreGain: "+7 pts",
          business: v.recommendation,
        });
      }
    }

    if (brokenLinksFindings?.brokenLinks && brokenLinksFindings.brokenLinks.length > 0) {
      derived.push({
        title: `Fix ${brokenLinksFindings.brokenLinks.length} broken link(s)`,
        priority: "High",
        impact: "Medium",
        time: "30 min",
        difficulty: "Easy",
        scoreGain: "+4 pts",
        business: "Prevents 404 errors harming SEO ranking and user experience",
      });
    }

    const errCount = (realConsole?.errors ?? []).filter(e => e.level === "error").length;
    if (errCount > 0) {
      derived.push({
        title: `Resolve ${errCount} JavaScript console error(s)`,
        priority: "Medium",
        impact: "Medium",
        time: "2–3 hrs",
        difficulty: "Hard",
        scoreGain: "+6 pts",
        business: "Improves reliability, prevents user-facing failures",
      });
    }

    return derived.length > 0 ? derived : RECOMMENDATIONS;
  }, [a11yFindings, realPerformance, secFindings, brokenLinksFindings, realConsole]);

  const filteredConsole = useMemo(() => {
    let list = [...consoleErrors];
    if (consoleSearch) list = list.filter(e => e.message.toLowerCase().includes(consoleSearch.toLowerCase()) || e.source.toLowerCase().includes(consoleSearch.toLowerCase()));
    if (consoleSeverity !== "all") list = list.filter(e => e.severity === consoleSeverity);
    return list;
  }, [consoleErrors, consoleSearch, consoleSeverity]);

  const filteredBugs = useMemo(() => {
    let list = [...bugs];
    if (bugSearch) list = list.filter(b => b.title.toLowerCase().includes(bugSearch.toLowerCase()) || b.description?.toLowerCase().includes(bugSearch.toLowerCase()));
    if (bugSeverity !== "all") list = list.filter(b => b.severity === bugSeverity);
    if (bugStatus !== "all") list = list.filter(b => b.status === bugStatus);
    list.sort((a, b) => {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      if (sortCol === "severity") {
        const da = order[a.severity] ?? 9;
        const db = order[b.severity] ?? 9;
        return sortDir === "desc" ? da - db : db - da;
      }
      if (sortCol === "title") return sortDir === "asc" ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title);
      return 0;
    });
    return list;
  }, [bugs, bugSearch, bugSeverity, bugStatus, sortCol, sortDir]);

  const activeShot = screenshots.find(s => s.deviceType === screenshotDevice) ?? screenshots[0];

  const completedCount = completedRecs.size;
  const recProgress = Math.round((completedCount / Math.max(1, recommendations.length)) * 100);

  const scrollToBreakdown = (tab: string) => {
    setScoreBreakdownTab(tab);
    setTimeout(() => {
      scoreBreakdownRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const handleRunAgain = () => {
    if (!audit) return;
    createAuditMutation.mutate({ data: { projectId: audit.projectId } }, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListAuditsQueryKey({ projectId: audit.projectId }) });
        setLocation(`/audits/live/${data.id}`);
      },
    });
  };

  const handleDownloadPdf = () => {
    reportMutation.mutate({ data: { auditRunId: auditId } }, {
      onSuccess: () => {
        toast({ title: "Report queued", description: "Your PDF report is being generated. Check the Reports page." });
        setLocation("/reports");
      },
    });
  };

  const handleShare = () => {
    setIsSharing(true);
    navigator.clipboard.writeText(window.location.href).then(() => {
      setShareSuccess(true);
      toast({ title: "Link copied", description: "Audit URL copied to clipboard." });
      setTimeout(() => setShareSuccess(false), 2000);
    }).catch((err: unknown) => {
      toast({ title: "Failed to copy link", description: (err as Error).message, variant: "destructive" });
    }).finally(() => setIsSharing(false));
  };

  const handleExportJson = () => {
    setIsExporting(true);
    try {
      const blob = new Blob([JSON.stringify({ audit, bugs, screenshots }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-${auditId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportSuccess(true);
      toast({ title: "Exported", description: `audit-${auditId}.json downloaded successfully.` });
      setTimeout(() => setExportSuccess(false), 2000);
    } catch (err) {
      toast({ title: "Export failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleAssignIssues = () => {
    setIsAssigning(true);
    setLocation(`/bugs?auditRunId=${auditId}`);
  };

  const handleCopyStackTrace = (idx: number, trace: string) => {
    navigator.clipboard.writeText(trace).then(() => {
      setCopiedIdx(idx);
      toast({ title: "Stack trace copied" });
      setTimeout(() => setCopiedIdx(null), 2000);
    });
  };

  const sort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  // Build historical data using real audit history for this project.
  // Must be computed before any early returns so the hook call order is stable.
  const previousAudits = projectAudits
    .filter(a => a.id !== auditId && a.status === "completed" && a.performanceScore != null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);

  const prevAudit = previousAudits[0] ?? null;

  // Historical trend chart — real audit data only; never pad with fake entries.
  const histData = useMemo(() => {
    const realEntries = [...previousAudits].reverse().map((a, idx) => ({
      name: idx === previousAudits.length - 1 ? "Previous" : `${previousAudits.length - idx} audits ago`,
      performance: Math.round(a.performanceScore ?? 0),
      accessibility: Math.round(a.accessibilityScore ?? 0),
      seo: Math.round(a.seoScore ?? 0),
      bestPractices: Math.round(a.bestPracticesScore ?? 0),
      health: Math.round(a.overallScore ?? 0),
    }));
    return [
      ...realEntries,
      {
        name: "Current",
        performance: Math.round(audit?.performanceScore ?? 0),
        accessibility: Math.round(audit?.accessibilityScore ?? 0),
        seo: Math.round(audit?.seoScore ?? 0),
        bestPractices: Math.round(audit?.bestPracticesScore ?? 0),
        health: Math.round(healthScore?.score ?? 0),
      },
    ];
  }, [previousAudits, audit, healthScore]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className={cn("rounded-xl bg-muted/60 animate-pulse", i === 0 ? "h-16" : i === 1 ? "h-28" : "h-48")} />
        ))}
      </div>
    );
  }
  if (!audit) return <div className="p-12 text-center text-muted-foreground">Audit not found.</div>;

  const isRunning = audit.status === "pending" || audit.status === "running";
  const startAt = audit.startedAt ? new Date(audit.startedAt) : audit.createdAt ? new Date(audit.createdAt) : new Date();
  const endAt = audit.completedAt ? new Date(audit.completedAt) : null;

  // Health trend vs real previous audit (no fake fallback).
  const prevHealth = prevAudit?.overallScore != null
    ? Math.round(prevAudit.overallScore)
    : null;
  const currHealth = healthScore?.score ?? 0;
  // null when there is no previous real audit to compare against.
  const healthTrend = prevHealth !== null ? currHealth - prevHealth : null;

  // Score radar data — B series uses previous audit scores when available
  const hasPrevRadar = prevAudit != null;
  const radarData = [
    { subject: "Perf", A: audit.performanceScore ?? 0, ...(hasPrevRadar ? { B: Math.round(prevAudit!.performanceScore ?? 0) } : {}) },
    { subject: "A11y", A: audit.accessibilityScore ?? 0, ...(hasPrevRadar ? { B: Math.round(prevAudit!.accessibilityScore ?? 0) } : {}) },
    { subject: "SEO", A: audit.seoScore ?? 0, ...(hasPrevRadar ? { B: Math.round(prevAudit!.seoScore ?? 0) } : {}) },
    { subject: "BP", A: audit.bestPracticesScore ?? 0, ...(hasPrevRadar ? { B: Math.round(prevAudit!.bestPracticesScore ?? 0) } : {}) },
    { subject: "Overall", A: audit.overallScore ?? 0, ...(hasPrevRadar ? { B: Math.round(prevAudit!.overallScore ?? 0) } : {}) },
  ];

  return (
    <TooltipProvider>
      <div className="space-y-6 pb-24">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href={audit.projectId ? `/projects/${audit.projectId}` : "/audits"}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground">Audit #{audit.id}</h1>
                {project?.environment && <Badge variant="outline" className="capitalize">{project.environment}</Badge>}
                <StatusBadge status={audit.status} />
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                {audit.projectName && (
                  <Link href={`/projects/${audit.projectId}`} className="font-medium text-primary hover:underline flex items-center gap-1">
                    {audit.projectName} <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
                <span>•</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(new Date(audit.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
                {audit.durationMs && <><span>•</span><span>{Math.round(audit.durationMs / 1000)}s duration</span></>}
                {user && <><span>•</span><span>Run by {user.name}</span></>}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isRunning ? (
                <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => cancelMutation.mutate({ id: auditId })} disabled={cancelMutation.isPending}>
                  <XCircle className="h-4 w-4 mr-2" /> Cancel
                </Button>
              ) : (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={handleShare} className="transition-all">
                        {shareSuccess ? <Check className="h-4 w-4 mr-1.5 text-green-600" /> : <Share2 className="h-4 w-4 mr-1.5" />}
                        Share
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy audit URL to clipboard</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={reportMutation.isPending}>
                        {reportMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
                        PDF
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Generate & download PDF report</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" onClick={handleRunAgain} disabled={createAuditMutation.isPending}>
                        {createAuditMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
                        Run Again
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Start a new audit on this project</TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>
          </div>

          {isRunning && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="flex items-center gap-4 py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Audit in progress…</p>
                  <p className="text-xs text-muted-foreground">Analyzing performance, accessibility, SEO and collecting screenshots. Auto-refreshing every 3 seconds.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Summary Cards (Enhancement 1: Interactive + hover animations) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: "Overall", value: audit.overallScore, icon: Star, color: "#6366f1", scrollTo: null },
            { label: "Performance", value: audit.performanceScore, icon: Zap, color: scoreColor(audit.performanceScore), scrollTo: "Performance" },
            { label: "Accessibility", value: audit.accessibilityScore, icon: Users, color: scoreColor(audit.accessibilityScore), scrollTo: "Accessibility" },
            { label: "SEO", value: audit.seoScore, icon: TrendingUp, color: scoreColor(audit.seoScore), scrollTo: "SEO" },
            { label: "Best Practices", value: audit.bestPracticesScore, icon: ShieldAlert, color: scoreColor(audit.bestPracticesScore), scrollTo: "Best Practices" },
            {
              label: "Health Score", value: healthScore?.score, icon: Activity, scrollTo: null,
              color: healthScore?.status === "excellent" ? "#10b981" : healthScore?.status === "good" ? "#3b82f6" : healthScore?.status === "warning" ? "#f59e0b" : "#ef4444",
            },
            { label: "Bugs Found", value: audit.bugsFound, icon: Bug, color: (audit.bugsFound ?? 0) > 0 ? "#ef4444" : "#10b981", raw: true, scrollTo: null },
            { label: "Critical Issues", value: criticalBugs.length, icon: AlertTriangle, color: criticalBugs.length > 0 ? "#ef4444" : "#10b981", raw: true, scrollTo: null },
          ].map(({ label, value, icon: Icon, color, raw, scrollTo }) => (
            <Card
              key={label}
              onClick={() => scrollTo && scrollToBreakdown(scrollTo)}
              className={cn(
                "text-center transition-all duration-200",
                scrollTo && "cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40"
              )}
            >
              <CardContent className="pt-4 pb-3 px-2">
                <div className="flex justify-center mb-1">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center transition-transform duration-200 group-hover:scale-110" style={{ backgroundColor: color + "20" }}>
                    <Icon className="h-4 w-4" style={{ color }} />
                  </div>
                </div>
                <p className="text-2xl font-bold" style={{ color: value != null ? color : "#9ca3af" }}>
                  {value != null ? (raw ? <AnimatedCounter value={value as number} /> : <AnimatedCounter value={Math.round(value as number)} />) : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground font-medium leading-tight mt-0.5">{label}</p>
                {scrollTo && <p className="text-[9px] text-primary/50 mt-0.5">click to view</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Main 2-column layout ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left: main content */}
          <div className="lg:col-span-2 space-y-6">

            {/* ── Audit Timeline (Enhancement 3) ───────────────────────────── */}
            <Card>
              <CardHeader className="pb-3 cursor-pointer select-none" onClick={() => setTimelineOpen(o => !o)}>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" /> Audit Timeline
                  </CardTitle>
                  {timelineOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </CardHeader>
              {timelineOpen && (
                <CardContent>
                  <div className="relative pl-6">
                    {/* Animated progress line */}
                    <div className="absolute left-2.5 top-2 bottom-2 w-px bg-border" />
                    {audit.status === "completed" && (
                      <div
                        className="absolute left-2.5 top-2 w-px bg-primary"
                        style={{ height: "calc(100% - 16px)", transition: "height 1.2s ease" }}
                      />
                    )}
                    {timelineSteps.map((step, i) => {
                      const isLast = i === timelineSteps.length - 1;
                      const done = audit.status === "completed" || (isRunning && i < 6);
                      const active = isRunning && i === 6;
                      const stepTime = isLast
                        ? endAt
                        : audit.startedAt ? addSeconds(startAt, step.offset) : null;
                      const durationSec = i < timelineSteps.length - 1
                        ? Math.round((timelineSteps[i + 1]?.offset ?? 0) - (step.offset ?? 0))
                        : audit.durationMs ? Math.round(audit.durationMs / 1000 - (step.offset ?? 0)) : null;
                      const isExpanded = expandedStep === i;
                      return (
                        <div key={step.label} className={cn("relative", i < timelineSteps.length - 1 && "mb-4")}>
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "absolute -left-[9px] top-0.5 h-5 w-5 rounded-full flex items-center justify-center z-10 border-2 transition-all duration-300",
                              done ? "bg-primary border-primary" : active ? "bg-amber-400 border-amber-400 animate-pulse" : "bg-background border-border"
                            )}>
                              {done ? <CheckCircle2 className="h-3 w-3 text-white" /> : active ? <Loader2 className="h-2.5 w-2.5 text-white animate-spin" /> : <div className="h-2 w-2 rounded-full bg-border" />}
                            </div>
                            <div className="flex-1 cursor-pointer" onClick={() => setExpandedStep(isExpanded ? null : i)}>
                              <div className="flex items-center justify-between gap-2">
                                <p className={cn("text-sm font-medium", done ? "text-foreground" : "text-muted-foreground")}>{step.label}</p>
                                <div className="flex items-center gap-1.5">
                                  {durationSec != null && done && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-muted-foreground">
                                      {durationSec}s
                                    </Badge>
                                  )}
                                  {stepTime && (
                                    <span className="text-[10px] text-muted-foreground">{format(stepTime, "h:mm:ss a")}</span>
                                  )}
                                  {done && (isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />)}
                                </div>
                              </div>
                            </div>
                          </div>
                          {isExpanded && done && (
                            <div className="mt-2 ml-0 pl-2 border-l-2 border-primary/20 space-y-1">
                              {step.logs.map((log, li) => (
                                <div key={li} className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                                  <span className="text-primary/50">›</span> {log}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>

            {/* ── Score Breakdown (Enhancement 4) ──────────────────────────── */}
            <div ref={scoreBreakdownRef}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" /> Score Breakdown
                  </CardTitle>
                  <CardDescription>Detailed analysis per Lighthouse category — click score cards above to jump here</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={scoreBreakdownTab} onValueChange={setScoreBreakdownTab}>
                    <TabsList className="grid grid-cols-4 w-full">
                      {["Performance", "Accessibility", "SEO", "Best Practices"].map(c => (
                        <TabsTrigger key={c} value={c} className="text-xs">{c === "Best Practices" ? "Best Prac." : c}</TabsTrigger>
                      ))}
                    </TabsList>
                    {([
                      ["Performance", audit.performanceScore],
                      ["Accessibility", audit.accessibilityScore],
                      ["SEO", audit.seoScore],
                      ["Best Practices", audit.bestPracticesScore],
                    ] as [string, number | null | undefined][]).map(([cat, score]) => {
                      const insights = scoreInsights(score, cat);
                      const color = scoreColor(score);
                      const v = score != null ? Math.round(score) : 0;
                      const prevScore = histData[histData.length - 2][cat === "Performance" ? "performance" : cat === "Accessibility" ? "accessibility" : cat === "SEO" ? "seo" : "bestPractices"] as number;
                      const diff = v - prevScore;
                      return (
                        <TabsContent key={cat} value={cat} className="mt-4 space-y-4" ref={cat === "Performance" ? perfRef : cat === "Accessibility" ? a11yRef : cat === "SEO" ? seoRef : bpRef}>
                          <div className="flex items-start gap-6">
                            <div className="flex flex-col items-center gap-1">
                              <ScoreRing score={score} color={color} />
                              <Badge variant="outline" style={{ color, borderColor: color + "60", backgroundColor: color + "10" }} className="text-xs">
                                {scoreLabel(score)}
                              </Badge>
                            </div>
                            <div className="flex-1 space-y-3">
                              <div>
                                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                  <span>{cat} Score</span>
                                  <div className="flex items-center gap-2">
                                    <span>{v}/100</span>
                                    {diff !== 0 && (
                                      <span className={cn("flex items-center gap-0.5 text-[10px] font-semibold", diff > 0 ? "text-green-600" : "text-red-500")}>
                                        {diff > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                        {Math.abs(diff)} vs prev
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <Progress value={v} className="h-2" style={{ "--tw-progress-fill": color } as React.CSSProperties} />
                              </div>
                              {/* Benchmark comparison */}
                              <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="rounded-lg bg-muted/50 p-2">
                                  <p className="text-xs font-bold" style={{ color }}>{v}</p>
                                  <p className="text-[10px] text-muted-foreground">Current</p>
                                </div>
                                <div className="rounded-lg bg-muted/50 p-2">
                                  <p className="text-xs font-bold text-foreground/70">{insights.benchmark}</p>
                                  <p className="text-[10px] text-muted-foreground">Industry Avg</p>
                                </div>
                                <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-2">
                                  <p className="text-xs font-bold text-emerald-700">+{insights.improvement}</p>
                                  <p className="text-[10px] text-muted-foreground">Potential Gain</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {insights.strengths.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-emerald-700 mb-1.5 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Strengths
                              </p>
                              <ul className="space-y-0.5">
                                {insights.strengths.map(s => <li key={s} className="text-xs text-muted-foreground">• {s}</li>)}
                              </ul>
                            </div>
                          )}
                          {insights.weaknesses.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-red-600 mb-1.5 flex items-center gap-1">
                                <XCircle className="h-3 w-3" /> Weaknesses
                              </p>
                              <ul className="space-y-0.5">
                                {insights.weaknesses.map(w => <li key={w} className="text-xs text-muted-foreground">• {w}</li>)}
                              </ul>
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-semibold text-blue-600 mb-1.5 flex items-center gap-1">
                              <Lightbulb className="h-3 w-3" /> Suggestions
                            </p>
                            <ul className="space-y-0.5">
                              {insights.suggestions.slice(0, 3).map(s => <li key={s} className="text-xs text-muted-foreground">• {s}</li>)}
                            </ul>
                          </div>
                          {/* Quick wins */}
                          <div>
                            <p className="text-xs font-semibold text-violet-700 mb-1.5 flex items-center gap-1">
                              <Zap className="h-3 w-3" /> Quick Wins
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {insights.quickWins.map(w => (
                                <Badge key={w} variant="outline" className="text-[10px] bg-violet-50 text-violet-700 border-violet-200">{w}</Badge>
                              ))}
                            </div>
                          </div>
                        </TabsContent>
                      );
                    })}
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* ── Accessibility Violations ─────────────────────────────────── */}
            {a11yFindings?.violations && a11yFindings.violations.length > 0 && (
              <Card>
                <CardHeader className="pb-3 border-b border-border">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-500" /> Accessibility Violations
                      <Badge variant="secondary">{a11yFindings.violations.length}</Badge>
                      {a11yFindings.violations.filter(v => v.impact === "critical").length > 0 && (
                        <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
                          {a11yFindings.violations.filter(v => v.impact === "critical").length} critical
                        </Badge>
                      )}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs capitalize">{a11yFindings.wcagLevel}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {a11yFindings.violations.slice(0, 8).map((v, i) => (
                      <div key={v.id ?? i} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                        <div className="flex items-start gap-3">
                          <Badge variant="outline" className={cn("text-[10px] flex-shrink-0 mt-0.5 capitalize", {
                            "bg-red-50 text-red-700 border-red-200": v.impact === "critical",
                            "bg-orange-50 text-orange-700 border-orange-200": v.impact === "serious",
                            "bg-yellow-50 text-yellow-700 border-yellow-200": v.impact === "moderate",
                            "bg-blue-50 text-blue-700 border-blue-200": v.impact === "minor",
                          })}>
                            {v.impact}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{v.description}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{v.help}</p>
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> {v.affectedElements} element(s)
                              </span>
                              {v.wcagCriteria.slice(0, 2).map(c => (
                                <Badge key={c} variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">{c}</Badge>
                              ))}
                              {v.helpUrl && (
                                <a href={v.helpUrl} target="_blank" rel="noopener noreferrer"
                                  className="text-[10px] text-primary hover:underline flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                  Learn more <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Security Findings ────────────────────────────────────────── */}
            {secFindings && (secFindings.vulnerabilities.length > 0 || secFindings.mixedContent || !secFindings.ssl.valid) && (
              <Card>
                <CardHeader className="pb-3 border-b border-border">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-red-500" /> Security Findings
                      {secFindings.vulnerabilities.length > 0 && (
                        <Badge variant="secondary">{secFindings.vulnerabilities.length}</Badge>
                      )}
                      {secFindings.vulnerabilities.filter(v => v.severity === "critical").length > 0 && (
                        <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
                          {secFindings.vulnerabilities.filter(v => v.severity === "critical").length} critical
                        </Badge>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("text-xs", secFindings.ssl.valid ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200")}>
                        SSL {secFindings.ssl.valid ? "✓ " : "✗ "}{secFindings.ssl.grade}
                      </Badge>
                      {secFindings.mixedContent && (
                        <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">Mixed Content</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-0 p-0">
                  {/* Header check summary */}
                  <div className="px-4 py-3 border-b border-border bg-muted/20">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Security Headers</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {([
                        ["CSP", secFindings.headers.contentSecurityPolicy],
                        ["HSTS", secFindings.headers.strictTransportSecurity],
                        ["X-Frame-Options", secFindings.headers.xFrameOptions],
                      ] as [string, boolean][]).map(([name, ok]) => (
                        <div key={name} className="flex items-center gap-1.5 text-xs">
                          {ok ? <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" /> : <XCircle className="h-3 w-3 text-red-400 flex-shrink-0" />}
                          <span className={ok ? "text-foreground" : "text-muted-foreground"}>{name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Vulnerabilities */}
                  <div className="divide-y divide-border">
                    {secFindings.vulnerabilities.slice(0, 6).map((v, i) => (
                      <div key={v.id ?? i} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                        <div className="flex items-start gap-3">
                          <Badge variant="outline" className={cn("text-[10px] flex-shrink-0 mt-0.5 capitalize", {
                            "bg-red-50 text-red-700 border-red-200": v.severity === "critical",
                            "bg-orange-50 text-orange-700 border-orange-200": v.severity === "high",
                            "bg-yellow-50 text-yellow-700 border-yellow-200": v.severity === "medium",
                            "bg-blue-50 text-blue-700 border-blue-200": v.severity === "low",
                          })}>
                            {v.severity}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium">{v.title}</p>
                              {v.cve && <Badge variant="outline" className="text-[9px] font-mono">{v.cve}</Badge>}
                              {v.cvssScore != null && <span className="text-[10px] text-muted-foreground">CVSS {v.cvssScore.toFixed(1)}</span>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{v.description}</p>
                            <div className="mt-1.5 rounded bg-blue-50 border border-blue-100 px-2 py-1">
                              <p className="text-[10px] text-blue-700">{v.recommendation}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {secFindings.vulnerabilities.length === 0 && (
                      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                        <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-emerald-500" />
                        No vulnerabilities detected.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Found Bugs ──────────────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bug className="h-4 w-4 text-destructive" /> Found Bugs
                    <Badge variant="secondary">{bugs.length}</Badge>
                    {criticalBugs.length > 0 && <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">{criticalBugs.length} critical</Badge>}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input className="pl-8 h-8 w-48 text-xs" placeholder="Search bugs…" value={bugSearch} onChange={e => setBugSearch(e.target.value)} />
                    </div>
                    <Select value={bugSeverity} onValueChange={setBugSeverity}>
                      <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Severity</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={bugStatus} onValueChange={setBugStatus}>
                      <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {filteredBugs.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    <Bug className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                    No bugs match your filters.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="cursor-pointer hover:text-foreground text-xs" onClick={() => sort("severity")}>
                          Severity {sortCol === "severity" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                        </TableHead>
                        <TableHead className="text-xs">Priority</TableHead>
                        <TableHead className="cursor-pointer hover:text-foreground text-xs" onClick={() => sort("title")}>
                          Title {sortCol === "title" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                        </TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Assigned To</TableHead>
                        <TableHead className="text-xs w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBugs.map(bug => (
                        <TableRow
                          key={bug.id}
                          className="hover:bg-muted/40 transition-colors cursor-pointer"
                          onClick={() => setSelectedAuditBug(bug as unknown as BugRecord)}
                        >
                          <TableCell><SeverityBadge severity={bug.severity} /></TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("text-xs", PRIORITY_PILL[bug.priority ?? "Medium"])}>
                              {bug.priority ?? "Medium"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium line-clamp-1">{bug.title}</p>
                              {bug.description && <p className="text-xs text-muted-foreground line-clamp-1">{bug.description}</p>}
                            </div>
                          </TableCell>
                          <TableCell><StatusBadge status={bug.status} /></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{((bug as unknown) as Record<string, unknown>).assignedToName as string ?? "Unassigned"}</TableCell>
                          <TableCell onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                              <Link href={`/bugs?auditRunId=${auditId}`}>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* ── Console Errors (Enhancement 5) ───────────────────────────── */}
            <Card>
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-amber-500" /> Console Errors
                    <Badge variant="secondary">{consoleErrors.length}</Badge>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input className="pl-8 h-8 w-44 text-xs" placeholder="Search errors…" value={consoleSearch} onChange={e => setConsoleSearch(e.target.value)} />
                    </div>
                    <Select value={consoleSeverity} onValueChange={setConsoleSeverity}>
                      <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {filteredConsole.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">No errors match your filters.</div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredConsole.map((err, i) => {
                      const isExpanded = expandedConsole === i;
                      return (
                        <div key={i} className={cn("transition-colors", isExpanded ? "bg-muted/30" : "hover:bg-muted/20")}>
                          <div
                            className="flex items-start gap-3 p-3 cursor-pointer"
                            onClick={() => setExpandedConsole(isExpanded ? null : i)}
                          >
                            <Badge variant="outline" className={cn("text-[10px] flex-shrink-0 mt-0.5", err.severity === "error" ? "text-red-700 bg-red-50 border-red-200" : "text-yellow-700 bg-yellow-50 border-yellow-200")}>
                              {err.severity}
                            </Badge>
                            <div className="flex-1 min-w-0 font-mono">
                              <p className="text-xs font-semibold text-blue-600 truncate">{err.source}</p>
                              <p className="text-xs text-foreground/80 line-clamp-1 mt-0.5">{err.message}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-[10px] text-muted-foreground">{err.time}</span>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    className="h-6 w-6 rounded flex items-center justify-center hover:bg-muted transition-colors"
                                    onClick={e => { e.stopPropagation(); handleCopyStackTrace(i, err.stackTrace); }}
                                  >
                                    {copiedIdx === i ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Copy stack trace</TooltipContent>
                              </Tooltip>
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="px-3 pb-3 space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                                  <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1">Possible Cause</p>
                                  <p className="text-xs text-foreground/80">{err.cause}</p>
                                </div>
                                <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                                  <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide mb-1">Likely File</p>
                                  <p className="text-xs font-mono text-foreground/80">{err.file}</p>
                                </div>
                              </div>
                              <div className="rounded-lg bg-violet-50 border border-violet-100 p-3">
                                <p className="text-[10px] font-semibold text-violet-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                                  <Cpu className="h-3 w-3" /> AI Explanation
                                </p>
                                <p className="text-xs text-foreground/80">{err.explanation}</p>
                              </div>
                              <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                                <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide mb-1">Recommended Fix</p>
                                <p className="text-xs text-foreground/80">{err.fix}</p>
                              </div>
                              <div className="rounded-lg bg-muted/60 border border-border p-3">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Stack Trace</p>
                                <pre className="text-[10px] font-mono text-foreground/70 whitespace-pre-wrap leading-relaxed">{err.stackTrace}</pre>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Network Requests (Enhancement 6) ─────────────────────────── */}
            <Card>
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-blue-500" /> Network Requests
                  <Badge variant="secondary">{networkRequests.length}</Badge>
                  <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                    {networkRequests.filter(r => r.status >= 400).length} failed
                  </Badge>
                  <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-700 border-yellow-200">
                    {networkRequests.filter(r => r.duration > 500).length} slow
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {networkRequests.map((req, i) => {
                    const failed = req.status >= 400;
                    const slow = req.duration > 500;
                    const isExpanded = expandedNet === i;
                    return (
                      <div key={i} className={cn(
                        "transition-colors",
                        failed ? "bg-red-50/40" : slow ? "bg-yellow-50/30" : "",
                        isExpanded ? "bg-muted/30" : "hover:bg-muted/20"
                      )}>
                        <div
                          className="flex items-center gap-3 p-3 cursor-pointer font-mono"
                          onClick={() => setExpandedNet(isExpanded ? null : i)}
                        >
                          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0", METHOD_COLOR[req.method] ?? "text-gray-700 bg-gray-50")}>{req.method}</span>
                          <p className="text-xs text-muted-foreground flex-1 truncate">{req.url}</p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant="outline" className={cn("text-[10px]", HTTP_STATUS_COLOR(req.status))}>{req.status}</Badge>
                            <span className={cn("text-[10px] font-medium w-14 text-right", slow ? "text-red-600" : req.duration > 200 ? "text-yellow-600" : "text-green-600")}>
                              {req.duration}ms
                            </span>
                            <span className="text-[10px] text-muted-foreground w-14 text-right">{req.size}</span>
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                          </div>
                        </div>
                        {/* Waterfall bar */}
                        <div className="px-3 pb-1.5">
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all", failed ? "bg-red-400" : slow ? "bg-yellow-400" : "bg-blue-400")}
                              style={{ width: `${Math.min(req.waterfall, 100)}%` }}
                            />
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="px-3 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div className="rounded-lg bg-muted/60 p-2 text-center">
                              <p className="text-xs font-semibold">{req.type}</p>
                              <p className="text-[10px] text-muted-foreground">Type</p>
                            </div>
                            <div className="rounded-lg bg-muted/60 p-2 text-center">
                              <p className={cn("text-xs font-semibold", req.cached ? "text-green-600" : "text-muted-foreground")}>{req.cached ? "HIT" : "MISS"}</p>
                              <p className="text-[10px] text-muted-foreground">Cache</p>
                            </div>
                            <div className="rounded-lg bg-muted/60 p-2 text-center">
                              <p className={cn("text-xs font-semibold", req.compressed ? "text-green-600" : "text-red-500")}>{req.compressed ? "Yes" : "No"}</p>
                              <p className="text-[10px] text-muted-foreground">Compressed</p>
                            </div>
                            <div className="rounded-lg bg-muted/60 p-2 text-center">
                              <p className="text-xs font-semibold">{req.compressedSize}</p>
                              <p className="text-[10px] text-muted-foreground">Compressed Size</p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* ── Screenshot Gallery ───────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-primary" /> Screenshot Gallery
                </CardTitle>
                <CardDescription>Visual captures across devices during the audit</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {screenshots.length > 0 && (
                  <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
                    {[{ key: "desktop", icon: Monitor }, { key: "tablet", icon: Tablet }, { key: "mobile", icon: Smartphone }].map(({ key, icon: Icon }) => (
                      <button key={key} onClick={() => setScreenshotDevice(key)}
                        className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 capitalize",
                          screenshotDevice === key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
                        <Icon className="h-3.5 w-3.5" />{key}
                      </button>
                    ))}
                  </div>
                )}
                {!screenshots.length ? (
                  <div className="py-12 text-center text-sm text-muted-foreground bg-muted/30 rounded-xl border border-dashed border-border">
                    <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                    No screenshots captured for this audit.
                  </div>
                ) : activeShot ? (
                  <div className="rounded-xl border border-border overflow-hidden cursor-zoom-in transition-shadow hover:shadow-md" onClick={() => setScreenshotModal(activeShot.dataUrl ?? null)}>
                    <div className="bg-muted/50 px-3 py-2 border-b flex items-center gap-2 text-xs font-medium text-muted-foreground capitalize">
                      {activeShot.deviceType === "desktop" && <Monitor className="h-3 w-3" />}
                      {activeShot.deviceType === "tablet" && <Tablet className="h-3 w-3" />}
                      {activeShot.deviceType === "mobile" && <Smartphone className="h-3 w-3" />}
                      {activeShot.deviceType} preview — click to enlarge
                    </div>
                    <div className="p-3 bg-white">
                      <div className={cn("w-full rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden",
                        activeShot.deviceType === "mobile" ? "aspect-[9/16] max-w-[160px] mx-auto" : activeShot.deviceType === "tablet" ? "aspect-[4/3]" : "aspect-[16/9]")}>
                        {activeShot.dataUrl
                          ? <img src={activeShot.dataUrl} alt="screenshot" className="w-full h-full object-cover" />
                          : <p className="text-xs text-muted-foreground">No image</p>}
                      </div>
                    </div>
                  </div>
                ) : null}
                {screenshots.length > 1 && (
                  <div className="grid grid-cols-3 gap-2">
                    {screenshots.map(s => (
                      <button key={s.id} onClick={() => setScreenshotDevice(s.deviceType)}
                        className={cn("rounded-lg border-2 overflow-hidden transition-all duration-200", screenshotDevice === s.deviceType ? "border-primary shadow-sm" : "border-border hover:border-muted-foreground")}>
                        <div className="aspect-video bg-muted/50 flex flex-col items-center justify-center gap-1">
                          {s.deviceType === "desktop" && <Monitor className="h-4 w-4 text-muted-foreground" />}
                          {s.deviceType === "tablet" && <Tablet className="h-4 w-4 text-muted-foreground" />}
                          {s.deviceType === "mobile" && <Smartphone className="h-4 w-4 text-muted-foreground" />}
                          <span className="text-[10px] text-muted-foreground capitalize">{s.deviceType}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Performance Insights (Enhancement 7) ─────────────────────── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-orange-500" /> Performance Insights
                </CardTitle>
                <CardDescription>Intelligent analysis of performance bottlenecks detected during the audit</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {perfInsights.map((insight) => {
                  const Icon = insight.icon;
                  return (
                    <div key={insight.issue} className="rounded-xl border border-border p-4 hover:shadow-sm transition-all duration-200 hover:border-border/80 group">
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: insight.color + "15" }}>
                          <Icon className="h-4 w-4" style={{ color: insight.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <p className="text-sm font-semibold">{insight.issue}</p>
                            <Badge variant="outline" className={cn("text-[10px]", insight.impact === "High" ? "bg-red-50 text-red-700 border-red-200" : "bg-yellow-50 text-yellow-700 border-yellow-200")}>
                              {insight.impact} Impact
                            </Badge>
                            <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-700 border-slate-200">{insight.priority}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-3">{insight.description}</p>
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            <div className="rounded-md bg-muted/50 px-2 py-1.5 text-center">
                              <p className="text-[10px] font-semibold text-emerald-700">{insight.savings}</p>
                              <p className="text-[9px] text-muted-foreground">Est. Savings</p>
                            </div>
                            <div className="rounded-md bg-muted/50 px-2 py-1.5 text-center">
                              <p className="text-[10px] font-semibold">{insight.effort}</p>
                              <p className="text-[9px] text-muted-foreground">Dev Effort</p>
                            </div>
                            <div className="rounded-md bg-muted/50 px-2 py-1.5 text-center">
                              <p className="text-[10px] font-semibold" style={{ color: insight.color }}>Active</p>
                              <p className="text-[9px] text-muted-foreground">Status</p>
                            </div>
                          </div>
                          <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2">
                            <p className="text-[10px] font-semibold text-blue-700 mb-0.5">Suggested Fix</p>
                            <p className="text-xs text-foreground/80">{insight.fix}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* ── AI Root Cause Analysis (Enhancement 8) ───────────────────── */}
            <Card className="border-violet-200 bg-gradient-to-br from-violet-50/80 to-purple-50/30">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-violet-600 flex items-center justify-center shadow-md">
                    <Cpu className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base text-violet-900">AI Root Cause Analysis</CardTitle>
                      <Badge className="bg-violet-600 text-white text-[10px]">AI</Badge>
                      <Badge variant="outline" className="text-[10px] border-violet-300 text-violet-700">Beta</Badge>
                    </div>
                    <CardDescription className="text-violet-600/70">Powered by intelligent audit analysis</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Summary */}
                <div className="rounded-xl bg-white/80 border border-violet-100 p-4">
                  <p className="text-xs font-semibold text-violet-700 uppercase tracking-wider mb-2">Overall Summary</p>
                  <p className="text-sm text-foreground leading-relaxed">
                    {aiAnalysis?.summary ?? audit.aiSummary ?? "Run the audit to generate AI-powered insights and recommendations."}
                  </p>
                </div>

                {/* Premium metrics row */}
                {aiAnalysis && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-white/80 border border-violet-100 p-3 text-center">
                      <div className={cn("text-xl font-bold uppercase", {
                        "text-red-600": aiAnalysis.riskAssessment?.level === "critical",
                        "text-orange-600": aiAnalysis.riskAssessment?.level === "high",
                        "text-yellow-600": aiAnalysis.riskAssessment?.level === "medium",
                        "text-green-600": aiAnalysis.riskAssessment?.level === "low",
                      })}>
                        {aiAnalysis.riskAssessment?.level ?? "—"}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Risk Level</p>
                    </div>
                    <div className="rounded-xl bg-white/80 border border-violet-100 p-3 text-center">
                      <div className="text-xl font-bold text-violet-700">{aiAnalysis.suggestedFixes?.length ?? 0}</div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Suggested Fixes</p>
                    </div>
                    <div className="rounded-xl bg-white/80 border border-violet-100 p-3 text-center">
                      <div className="text-xl font-bold text-violet-700">{aiAnalysis.rootCauseAnalysis?.length ?? 0}</div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Root Causes</p>
                    </div>
                  </div>
                )}

                {/* Extended AI premium fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/80 border border-violet-100 p-3">
                    <p className="text-[10px] font-semibold text-violet-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                      <GitBranch className="h-3 w-3" /> Regression Risk
                    </p>
                    <p className="text-xs text-foreground/80">Medium — recent changes to the authentication module may affect performance metrics. Recommended to re-run after hotfix.</p>
                  </div>
                  <div className="rounded-xl bg-white/80 border border-violet-100 p-3">
                    <p className="text-[10px] font-semibold text-violet-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                      <Users className="h-3 w-3" /> Suggested Developer
                    </p>
                    <p className="text-xs text-foreground/80">Frontend performance issues best addressed by a React specialist with Lighthouse experience. Estimated: 1 sprint.</p>
                  </div>
                  <div className="rounded-xl bg-white/80 border border-violet-100 p-3">
                    <p className="text-[10px] font-semibold text-violet-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Estimated Fix Time
                    </p>
                    <p className="text-sm font-bold text-violet-800">8–12 hrs</p>
                    <p className="text-[10px] text-muted-foreground">Development + QA combined</p>
                  </div>
                  <div className="rounded-xl bg-white/80 border border-violet-100 p-3">
                    <p className="text-[10px] font-semibold text-violet-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                      <Target className="h-3 w-3" /> Business Impact
                    </p>
                    <p className="text-xs text-foreground/80">Estimated 18–24% reduction in bounce rate and potential +12% conversion improvement if P1 issues are resolved.</p>
                  </div>
                </div>

                {/* Root Cause Analysis */}
                {aiAnalysis?.rootCauseAnalysis && aiAnalysis.rootCauseAnalysis.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-violet-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" /> Likely Root Causes
                    </p>
                    <div className="space-y-2">
                      {aiAnalysis.rootCauseAnalysis.map((item, i) => (
                        <div key={i} className="rounded-lg bg-white/80 border border-violet-100 p-3">
                          <p className="text-sm font-medium text-foreground">{item.issue}</p>
                          <p className="text-xs text-muted-foreground mt-0.5"><span className="font-medium text-foreground/70">Cause:</span> {item.cause}</p>
                          <p className="text-xs text-muted-foreground mt-0.5"><span className="font-medium text-foreground/70">Impact:</span> {item.impact}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggested Fixes */}
                {aiAnalysis?.suggestedFixes && aiAnalysis.suggestedFixes.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-violet-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Lightbulb className="h-3.5 w-3.5" /> Recommended Fixes
                    </p>
                    <div className="space-y-2">
                      {aiAnalysis.suggestedFixes.map((fix, i) => (
                        <div key={i} className="flex items-start gap-2.5 rounded-lg bg-white/80 border border-violet-100 p-3">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{fix.fix}</p>
                            <div className="flex gap-2 mt-1.5 flex-wrap">
                              <Badge variant="outline" className={cn("text-[10px]", PRIORITY_PILL[fix.priority ?? "Medium"])}>{fix.priority} priority</Badge>
                              <span className="text-[10px] text-muted-foreground self-center">{fix.effort} effort</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Risk Assessment */}
                {aiAnalysis?.riskAssessment && (
                  <div className={cn("rounded-xl border p-4", {
                    "bg-red-50 border-red-200": aiAnalysis.riskAssessment.level === "critical",
                    "bg-orange-50 border-orange-200": aiAnalysis.riskAssessment.level === "high",
                    "bg-yellow-50 border-yellow-200": aiAnalysis.riskAssessment.level === "medium",
                    "bg-green-50 border-green-200": aiAnalysis.riskAssessment.level === "low",
                  })}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <ShieldAlert className="h-3.5 w-3.5" /> Risk Assessment — {aiAnalysis.riskAssessment.level?.toUpperCase()}
                    </p>
                    <p className="text-sm">{aiAnalysis.riskAssessment.summary}</p>
                    {aiAnalysis.riskAssessment.factors && aiAnalysis.riskAssessment.factors.length > 0 && (
                      <ul className="mt-2 space-y-0.5">
                        {aiAnalysis.riskAssessment.factors.map((f, i) => (
                          <li key={i} className="text-xs flex items-start gap-1.5">
                            <span className="mt-1.5 h-1 w-1 rounded-full bg-current flex-shrink-0" />{f}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {!aiAnalysis && audit.status !== "completed" && (
                  <div className="text-center py-4 text-sm text-violet-600/70">
                    AI analysis is available after the audit completes.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── AI Copilot ────────────────────────────────────────────────── */}
            <AiCopilotPanel
              audit={audit}
              aiAnalysis={aiAnalysis}
              bugs={bugs}
              consoleErrors={consoleErrors}
            />

            {/* ── Recommendations (Enhancement 9) ──────────────────────────── */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-yellow-500" /> Recommendations
                      <Badge variant="secondary">{completedCount}/{recommendations.length}</Badge>
                    </CardTitle>
                    <CardDescription>Prioritized action items — mark items complete as you fix them</CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary">{recProgress}%</p>
                    <p className="text-[10px] text-muted-foreground">complete</p>
                  </div>
                </div>
                <Progress value={recProgress} className="h-1.5 mt-2" />
              </CardHeader>
              <CardContent className="space-y-2">
                {recommendations.map((rec, i) => {
                  const done = completedRecs.has(i);
                  return (
                    <div key={i} className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border transition-all duration-200",
                      done ? "bg-emerald-50/60 border-emerald-200 opacity-70" : "border-border hover:bg-muted/40"
                    )}>
                      <button
                        onClick={() => {
                          const next = new Set(completedRecs);
                          if (done) next.delete(i); else next.add(i);
                          setCompletedRecs(next);
                          if (!done) toast({ title: "Marked complete", description: rec.title });
                        }}
                        className={cn(
                          "h-5 w-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 border-2 transition-all duration-200",
                          done ? "bg-emerald-500 border-emerald-500" : rec.priority === "High" ? "border-red-300 hover:border-red-500" : rec.priority === "Medium" ? "border-yellow-300 hover:border-yellow-500" : "border-blue-300 hover:border-blue-500"
                        )}
                      >
                        {done ? <Check className="h-3 w-3 text-white" /> : <span className="text-[9px] font-bold text-muted-foreground">{i + 1}</span>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-medium", done && "line-through text-muted-foreground")}>{rec.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{rec.business}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <Badge variant="outline" className={cn("text-[10px]", PRIORITY_PILL[rec.priority])}>{rec.priority} priority</Badge>
                          <span className="text-[10px] text-muted-foreground">Impact: <span className="font-medium text-foreground">{rec.impact}</span></span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{rec.time}</span>
                          <Badge variant="outline" className="text-[10px] bg-violet-50 text-violet-700 border-violet-200">{rec.difficulty}</Badge>
                          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">{rec.scoreGain}</Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* ── Historical Comparison (Enhancement 10) ────────────────────── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" /> Historical Comparison
                </CardTitle>
                <CardDescription>Score trends across the last 5 audits for this project</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={histData} barCategoryGap="20%" barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <ReTooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
                        formatter={(value: number) => [`${value}`, undefined]}
                      />
                      <Bar dataKey="performance" fill="#6366f1" name="Performance" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="accessibility" fill="#10b981" name="Accessibility" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="seo" fill="#f59e0b" name="SEO" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="bestPractices" fill="#8b5cf6" name="Best Practices" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-4 flex-wrap text-[10px] text-muted-foreground">
                  {[["#6366f1", "Performance"], ["#10b981", "Accessibility"], ["#f59e0b", "SEO"], ["#8b5cf6", "Best Practices"]].map(([color, label]) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className="h-2 w-4 rounded-sm" style={{ backgroundColor: color }} />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
                {/* Comparison table */}
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs">Metric</TableHead>
                        <TableHead className="text-xs text-center">Previous</TableHead>
                        <TableHead className="text-xs text-center">Current</TableHead>
                        <TableHead className="text-xs text-center">Change</TableHead>
                        <TableHead className="text-xs text-center">Best</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { label: "Performance", curr: audit.performanceScore, prev: prevAudit?.performanceScore != null ? Math.round(prevAudit.performanceScore) : null, best: previousAudits.length > 0 ? Math.max(Math.round(audit.performanceScore ?? 0), ...previousAudits.map(a => Math.round(a.performanceScore ?? 0))) : Math.round(audit.performanceScore ?? 0) },
                        { label: "Accessibility", curr: audit.accessibilityScore, prev: prevAudit?.accessibilityScore != null ? Math.round(prevAudit.accessibilityScore) : null, best: previousAudits.length > 0 ? Math.max(Math.round(audit.accessibilityScore ?? 0), ...previousAudits.map(a => Math.round(a.accessibilityScore ?? 0))) : Math.round(audit.accessibilityScore ?? 0) },
                        { label: "SEO", curr: audit.seoScore, prev: prevAudit?.seoScore != null ? Math.round(prevAudit.seoScore) : null, best: previousAudits.length > 0 ? Math.max(Math.round(audit.seoScore ?? 0), ...previousAudits.map(a => Math.round(a.seoScore ?? 0))) : Math.round(audit.seoScore ?? 0) },
                        { label: "Best Practices", curr: audit.bestPracticesScore, prev: prevAudit?.bestPracticesScore != null ? Math.round(prevAudit.bestPracticesScore) : null, best: previousAudits.length > 0 ? Math.max(Math.round(audit.bestPracticesScore ?? 0), ...previousAudits.map(a => Math.round(a.bestPracticesScore ?? 0))) : Math.round(audit.bestPracticesScore ?? 0) },
                        { label: "Overall Score", curr: audit.overallScore, prev: prevHealth ?? null, best: previousAudits.length > 0 ? Math.max(Math.round(audit.overallScore ?? 0), ...previousAudits.map(a => Math.round(a.overallScore ?? 0))) : Math.round(audit.overallScore ?? 0) },
                      ].map(({ label, curr, prev, best }) => {
                        const c = curr != null ? Math.round(curr) : null;
                        const diff = c != null && prev != null ? c - prev : null;
                        return (
                          <TableRow key={label} className="hover:bg-muted/30">
                            <TableCell className="text-xs font-medium">{label}</TableCell>
                            <TableCell className="text-xs text-center text-muted-foreground">{prev}</TableCell>
                            <TableCell className="text-xs text-center font-semibold" style={{ color: c != null ? scoreColor(c) : "#9ca3af" }}>{c ?? "—"}</TableCell>
                            <TableCell className="text-xs text-center">
                              {diff != null && (
                                <span className={cn("flex items-center justify-center gap-0.5 font-semibold", diff > 0 ? "text-green-600" : diff < 0 ? "text-red-500" : "text-muted-foreground")}>
                                  {diff > 0 ? <ArrowUpRight className="h-3 w-3" /> : diff < 0 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                                  {Math.abs(diff)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-center text-emerald-700 font-semibold">{best}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* ── Right Sidebar ─────────────────────────────────────────────── */}
          <div className="space-y-4 lg:sticky lg:top-6">

            {/* Audit Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Audit Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {[
                  { label: "Project", value: audit.projectName ?? `#${audit.projectId}`, href: `/projects/${audit.projectId}` },
                  { label: "Audit #", value: String(audit.id) },
                  { label: "Environment", value: project?.environment ?? "—", capitalize: true },
                  { label: "Template", value: project?.auditTemplate ?? "—" },
                  { label: "Started At", value: audit.startedAt ? format(new Date(audit.startedAt), "MMM d, h:mm:ss a") : "—" },
                  { label: "Completed At", value: audit.completedAt ? format(new Date(audit.completedAt), "MMM d, h:mm:ss a") : "—" },
                  { label: "Duration", value: audit.durationMs ? `${Math.round(audit.durationMs / 1000)}s` : "—" },
                  { label: "Bugs Found", value: String(audit.bugsFound ?? 0) },
                  { label: "Critical Issues", value: String(criticalBugs.length) },
                  { label: "Health Score", value: healthScore ? `${healthScore.score} (${healthScore.status})` : "—", capitalize: true },
                ].map(({ label, value, href, capitalize }) => (
                  <div key={label} className="flex justify-between items-start gap-2">
                    <span className="text-muted-foreground text-xs flex-shrink-0">{label}</span>
                    {href ? (
                      <Link href={href} className="text-xs font-medium text-primary hover:underline text-right">{value}</Link>
                    ) : (
                      <span className={cn("text-xs font-medium text-right", capitalize && "capitalize")}>{value}</span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Scores */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Scores</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Performance", score: audit.performanceScore },
                  { label: "Accessibility", score: audit.accessibilityScore },
                  { label: "SEO", score: audit.seoScore },
                  { label: "Best Practices", score: audit.bestPracticesScore },
                ].map(({ label, score }) => (
                  <div key={label} className="cursor-pointer" onClick={() => scrollToBreakdown(label)}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground hover:text-foreground transition-colors">{label}</span>
                      <span className="font-semibold" style={{ color: scoreColor(score) }}>{score != null ? Math.round(score) : "—"}</span>
                    </div>
                    <Progress value={score ?? 0} className="h-1.5" />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Enhancement 2: Smart Health Score */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5" /> Health Score
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {healthScore ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold" style={{ color: healthScore.status === "excellent" ? "#10b981" : healthScore.status === "good" ? "#3b82f6" : healthScore.status === "warning" ? "#f59e0b" : "#ef4444" }}>
                          {healthScore.score}
                        </p>
                        <Badge variant="outline" className={cn("text-[10px] capitalize mt-1", {
                          "bg-emerald-50 text-emerald-700 border-emerald-200": healthScore.status === "excellent",
                          "bg-blue-50 text-blue-700 border-blue-200": healthScore.status === "good",
                          "bg-yellow-50 text-yellow-700 border-yellow-200": healthScore.status === "warning",
                          "bg-red-50 text-red-700 border-red-200": healthScore.status === "critical",
                        })}>
                          {healthScore.status === "excellent" ? "Excellent" : healthScore.status === "good" ? "Good" : healthScore.status === "warning" ? "Needs Attention" : "Critical"}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className={cn("flex items-center gap-1 text-sm font-semibold justify-end", healthTrend == null ? "text-muted-foreground" : healthTrend >= 0 ? "text-green-600" : "text-red-500")}>
                          {healthTrend == null ? <Minus className="h-4 w-4" /> : healthTrend > 0 ? <TrendingUp className="h-4 w-4" /> : healthTrend < 0 ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                          {healthTrend != null ? `${Math.abs(healthTrend)}%` : "—"}
                        </div>
                        <p className="text-[10px] text-muted-foreground">vs previous</p>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>Confidence</span><span>87%</span>
                      </div>
                      <Progress value={87} className="h-1.5" />
                    </div>
                    <Progress value={healthScore.score} className="h-2" />
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Health score not available</p>
                )}
              </CardContent>
            </Card>

            {/* Quick Fix Dashboard (Enhancement 13) */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Flame className="h-3.5 w-3.5 text-orange-500" /> Quick Fix Dashboard
                </CardTitle>
                <CardDescription className="text-xs">Top 5 highest-impact improvements</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {recommendations.filter(r => r.priority === "High").slice(0, 3).concat(recommendations.filter(r => r.priority === "Medium").slice(0, 2)).map((rec, i) => (
                  <div key={i} className="rounded-lg border border-border p-2.5 hover:bg-muted/40 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="text-xs font-medium line-clamp-1 flex-1">{rec.title}</p>
                      <Badge variant="outline" className={cn("text-[9px] flex-shrink-0", PRIORITY_PILL[rec.priority])}>{rec.priority}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-center">
                      <div>
                        <p className="text-[10px] font-bold text-emerald-700">{rec.scoreGain}</p>
                        <p className="text-[9px] text-muted-foreground">Score</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold">{rec.time}</p>
                        <p className="text-[9px] text-muted-foreground">Time</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold">{rec.difficulty}</p>
                        <p className="text-[9px] text-muted-foreground">Effort</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Developer Insights (Enhancement 11) */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Code2 className="h-3.5 w-3.5 text-blue-500" /> Developer Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                    <FileText className="h-3 w-3" /> Likely Affected Files
                  </p>
                  <div className="space-y-1">
                    {(consoleErrors.length > 0
                      ? [...new Set(consoleErrors.map(e => e.file).filter(Boolean))].slice(0, 4)
                      : ["src/components/Header.jsx", "src/pages/Dashboard.jsx", "public/fonts/Inter-Bold.woff2", "src/lib/analytics.js"]
                    ).map(f => (
                      <p key={f} className="font-mono text-[10px] text-muted-foreground truncate">› {f}</p>
                    ))}
                  </div>
                </div>
                <div className="h-px bg-border" />
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                    <Package className="h-3 w-3" /> Components Involved
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {["EventBus", "Analytics", "Router", "FontLoader", "Dashboard"].map(c => (
                      <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                    ))}
                  </div>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Regression Prob.</span>
                  <div className="flex items-center gap-2">
                    <Progress value={34} className="h-1.5 w-16" />
                    <span className="text-[10px] font-semibold text-yellow-600">34%</span>
                  </div>
                </div>
                <div className="h-px bg-border" />
                <div>
                  <p className="text-[10px] font-semibold text-blue-700 mb-1">Testing Recommendation</p>
                  <p className="text-[10px] text-muted-foreground">Run full E2E suite after fixing JS errors. Focus on auth flows and analytics tracking.</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-violet-700 mb-1">Deployment Recommendation</p>
                  <p className="text-[10px] text-muted-foreground">Deploy to staging first. Re-run audit before production promotion.</p>
                </div>
              </CardContent>
            </Card>

            {/* Score Radar */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Score Radar</CardTitle>
                <CardDescription className="text-[10px]">{hasPrevRadar ? "Current vs Previous audit" : "Current audit scores"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9 }} />
                      <Radar name="Current" dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                      {hasPrevRadar && <Radar name="Previous" dataKey="B" stroke="#10b981" fill="#10b981" fillOpacity={0.15} />}
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1"><div className="h-2 w-3 rounded-sm bg-indigo-500/40 border border-indigo-500" /> Current</div>
                  {hasPrevRadar && <div className="flex items-center gap-1"><div className="h-2 w-3 rounded-sm bg-emerald-500/30 border border-emerald-500" /> Previous</div>}
                </div>
              </CardContent>
            </Card>

            {/* Quick links */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Quick Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <Link href={`/bugs?auditRunId=${auditId}`}>
                  <div className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-md hover:bg-muted transition-colors cursor-pointer">
                    <Bug className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>View All Bugs</span>
                  </div>
                </Link>
                <Link href="/reports">
                  <div className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-md hover:bg-muted transition-colors cursor-pointer">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Reports</span>
                  </div>
                </Link>
                <Link href={`/projects/${audit.projectId}`}>
                  <div className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-md hover:bg-muted transition-colors cursor-pointer">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Project Overview</span>
                  </div>
                </Link>
                <div
                  className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-md hover:bg-muted transition-colors cursor-pointer"
                  onClick={() => scrollToBreakdown("Performance")}
                >
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Score Breakdown</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Bottom Action Bar (Enhancement 12: Smart Actions) ─────────────── */}
        <div className="fixed bottom-0 left-64 right-0 bg-background/95 backdrop-blur border-t border-border px-8 py-3 flex items-center justify-between gap-3 z-20">
          <p className="text-sm text-muted-foreground hidden sm:block">
            Audit #{audit.id} · {audit.projectName} · <span className={cn(recProgress > 0 ? "text-emerald-600 font-medium" : "")}>{recProgress}% fixed</span>
          </p>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleRunAgain} disabled={createAuditMutation.isPending}>
                  {createAuditMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                  Run Again
                </Button>
              </TooltipTrigger>
              <TooltipContent>Start a fresh audit on this project</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={reportMutation.isPending}>
                  {reportMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                  Generate Report
                </Button>
              </TooltipTrigger>
              <TooltipContent>Generate PDF report and download</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleAssignIssues} disabled={isAssigning}>
                  {isAssigning ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Users className="h-3.5 w-3.5 mr-1.5" />}
                  Assign Issues
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open bug tracker to assign issues to team members</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleExportJson} disabled={isExporting}>
                  {isExporting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : exportSuccess ? <Check className="h-3.5 w-3.5 mr-1.5 text-green-600" /> : <FileJson className="h-3.5 w-3.5 mr-1.5" />}
                  Export JSON
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export full audit data as JSON file</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" onClick={handleShare} disabled={isSharing}>
                  {isSharing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : shareSuccess ? <Check className="h-3.5 w-3.5 mr-1.5 text-green-600" /> : <Share2 className="h-3.5 w-3.5 mr-1.5" />}
                  Share Report
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy shareable audit URL to clipboard</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Screenshot modal */}
        <Dialog open={!!screenshotModal} onOpenChange={() => setScreenshotModal(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Screenshot Preview — {screenshotDevice}</DialogTitle>
            </DialogHeader>
            <div className="rounded-lg overflow-hidden border border-border bg-white">
              {screenshotModal
                ? <img src={screenshotModal} alt="screenshot" className="w-full h-auto max-h-[70vh] object-contain" />
                : <div className="h-64 flex items-center justify-center text-muted-foreground">No image</div>}
            </div>
          </DialogContent>
        </Dialog>

        {/* ── AI Bug Resolution Panel Dialog ─────────────────────────────── */}
        <Dialog open={selectedAuditBug != null} onOpenChange={open => { if (!open) setSelectedAuditBug(null); }}>
          <DialogContent className="max-w-4xl w-full max-h-[92vh] p-0 overflow-hidden flex flex-col">
            <DialogHeader className="px-6 pt-5 pb-3 border-b border-border flex-shrink-0">
              <DialogTitle className="flex items-start gap-2 text-base font-semibold leading-snug">
                {selectedAuditBug?.title}
              </DialogTitle>
              {selectedAuditBug && (
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <SeverityBadge severity={selectedAuditBug.severity} />
                  <StatusBadge status={selectedAuditBug.status} />
                  {selectedAuditBug.description && (
                    <span className="text-xs text-muted-foreground line-clamp-1">{selectedAuditBug.description}</span>
                  )}
                </div>
              )}
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-6">
              {selectedAuditBug && (
                <AiBugResolutionPanel
                  bug={selectedAuditBug}
                  onMarkFixed={() => { setSelectedAuditBug(null); toast({ title: "Bug marked as fixed" }); }}
                  onMarkReadyForQA={() => { toast({ title: "Marked ready for QA", description: "Status set to In Progress." }); }}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </TooltipProvider>
  );
}
