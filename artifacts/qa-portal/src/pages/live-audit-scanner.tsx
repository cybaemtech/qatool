import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetAudit,
  useGetProject,
  useCancelAudit,
  getGetAuditQueryKey,
  getGetProjectQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { saveExecutionLog, type ExecutionLogLine } from "@/lib/execution-log";
import {
  Rocket, Globe, FileText, Search, ShieldCheck, Zap, Gauge, Eye,
  TrendingUp, Activity, Camera, Terminal, Code2, Sparkles, BarChart3,
  CheckCircle2, XCircle, Loader2, Clock, ArrowLeft, Ban,
} from "lucide-react";

// ─── Phase Definitions ───────────────────────────────────────────────────────

interface PhaseDef {
  label: string;
  icon: typeof Rocket;
  category: string;
  logs: string[];
  issueIncrement: number;
  revealScore?: "performance" | "accessibility" | "seo" | "bestPractices";
}

const PHASES: PhaseDef[] = [
  {
    label: "Initializing Scanner",
    icon: Rocket,
    category: "Setup",
    issueIncrement: 0,
    logs: [
      "Spawning headless Chromium pool (4 workers)...",
      "Loading audit configuration profiles...",
      "Injecting performance instrumentation hooks...",
    ],
  },
  {
    label: "Connecting to Website",
    icon: Globe,
    category: "Network",
    issueIncrement: 0,
    logs: [
      "Resolving DNS for target domain...",
      "TCP connection established. Initiating TLS handshake...",
      "TLS 1.3 secure channel active. Server responded HTTP 200.",
    ],
  },
  {
    label: "Checking robots.txt",
    icon: FileText,
    category: "Crawl",
    issueIncrement: 1,
    logs: [
      "Fetching /robots.txt from origin server...",
      "Parsing crawl directives and disallow rules...",
      "WARNING: Googlebot crawl-delay not explicitly configured.",
    ],
  },
  {
    label: "Checking sitemap.xml",
    icon: Search,
    category: "Crawl",
    issueIncrement: 2,
    logs: [
      "Fetching /sitemap.xml — parsing URL tree...",
      "Found 47 indexed URLs across 3 nested sitemaps.",
      "WARNING: 3 sitemap URLs return 404 — SEO indexability at risk.",
    ],
  },
  {
    label: "Checking SSL",
    icon: ShieldCheck,
    category: "Security",
    issueIncrement: 1,
    logs: [
      "Validating X.509 certificate chain depth...",
      "HSTS header present. Preload list status: ✓",
      "Certificate expires in 312 days. OCSP stapling active.",
    ],
  },
  {
    label: "Checking Core Web Vitals",
    icon: Zap,
    category: "Performance",
    issueIncrement: 3,
    logs: [
      "Measuring Largest Contentful Paint (LCP)...",
      "LCP: 2.4s ⚠ — marginally above 2.5s threshold.",
      "Measuring Cumulative Layout Shift (CLS): 0.08 ✓",
      "Measuring Interaction to Next Paint (INP): 94ms ✓",
    ],
  },
  {
    label: "Checking Performance",
    icon: Gauge,
    category: "Performance",
    issueIncrement: 4,
    revealScore: "performance",
    logs: [
      "Running Lighthouse performance audit (desktop + mobile)...",
      "Analyzing JavaScript bundle sizes and parse time...",
      "Render-blocking resources detected: 6 scripts, 2 stylesheets.",
      "First Contentful Paint: 1.3s. Time to Interactive: 4.1s.",
    ],
  },
  {
    label: "Checking Accessibility",
    icon: Eye,
    category: "A11y",
    issueIncrement: 5,
    revealScore: "accessibility",
    logs: [
      "Scanning DOM tree for WCAG 2.1 AA violations...",
      "Running axe-core ruleset against 12 page regions...",
      "Found 8 elements with insufficient color contrast ratio.",
      "3 form inputs missing associated <label> elements.",
    ],
  },
  {
    label: "Checking SEO",
    icon: TrendingUp,
    category: "SEO",
    issueIncrement: 3,
    revealScore: "seo",
    logs: [
      "Analyzing meta tags: title, description, OG, Twitter cards...",
      "Checking heading hierarchy and keyword density...",
      "WARNING: Duplicate meta descriptions found on 4 pages.",
      "Structured data (JSON-LD): Schema.org validation passed. ✓",
    ],
  },
  {
    label: "Checking Best Practices",
    icon: Activity,
    category: "Quality",
    issueIncrement: 3,
    revealScore: "bestPractices",
    logs: [
      "Auditing Content Security Policy headers...",
      "Scanning for deprecated browser APIs (document.write etc.)...",
      "Cross-Origin-Opener-Policy: missing — COOP header recommended.",
      "2 third-party scripts lack Subresource Integrity (SRI) hashes.",
    ],
  },
  {
    label: "Capturing Screenshots",
    icon: Camera,
    category: "Visual",
    issueIncrement: 0,
    logs: [
      "Rendering viewport at 1920×1080 (desktop)...",
      "Rendering viewport at 1280×800 (laptop)...",
      "Rendering viewport at 375×812 (mobile)...",
      "Screenshots captured and compressed to WebP. ✓",
    ],
  },
  {
    label: "Collecting Console Errors",
    icon: Terminal,
    category: "Debug",
    issueIncrement: 4,
    logs: [
      "Intercepting browser console output across 3 sessions...",
      "ERROR: Uncaught TypeError — Cannot read properties of undefined.",
      "WARN: Failed to load resource /api/v1/features (403 Forbidden).",
      "Found 4 uncaught exceptions and 7 failed network requests.",
    ],
  },
  {
    label: "Running JavaScript Analysis",
    icon: Code2,
    category: "Code",
    issueIncrement: 2,
    logs: [
      "Parsing dependency graph and bundle composition...",
      "Detected 3 duplicate npm packages totalling 142 KB.",
      "Long tasks > 50ms: 11 tasks blocking the main thread.",
      "Dead code analysis: ~18 KB of unused JavaScript detected.",
    ],
  },
  {
    label: "Generating AI Insights",
    icon: Sparkles,
    category: "AI",
    issueIncrement: 0,
    logs: [
      "Aggregating findings across all audit categories...",
      "Running GPT-4o root cause analysis on detected issues...",
      "Generating prioritized remediation recommendations...",
      "AI confidence score: 94% — high confidence analysis complete. ✓",
    ],
  },
  {
    label: "Preparing Executive Summary",
    icon: BarChart3,
    category: "Report",
    issueIncrement: 0,
    logs: [
      "Compiling executive summary and scoring matrix...",
      "Generating trend analysis vs. baseline audit data...",
      "Formatting report with severity-ranked findings...",
      "Audit report ready. All data persisted to database. ✓",
    ],
  },
];

const TOTAL_PHASES = PHASES.length;
const PHASE_DURATION_MS = 1800;
const MAX_PROGRESS = 97;

type RunPhase = "running" | "cancelling" | "success" | "failed" | "cancelled";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
}

function formatEta(ms: number, pct: number): string {
  if (pct <= 0) return "calculating...";
  const remaining = (ms / pct) * (100 - pct);
  const s = Math.ceil(remaining / 1000);
  if (s <= 0) return "almost done";
  return s >= 60 ? `~${Math.floor(s / 60)}m ${s % 60}s` : `~${s}s`;
}

function scoreColor(s: number | null): string {
  if (s == null) return "#9ca3af";
  if (s >= 90) return "#10b981";
  if (s >= 50) return "#f59e0b";
  return "#ef4444";
}

function scoreLabel(s: number | null): string {
  if (s == null) return "Scanning…";
  if (s >= 90) return "Excellent";
  if (s >= 75) return "Good";
  if (s >= 50) return "Needs Work";
  return "Poor";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ScoreCardProps {
  label: string;
  score: number | null;
  revealed: boolean;
  icon: typeof Rocket;
}

function LiveScoreCard({ label, score, revealed, icon: Icon }: ScoreCardProps) {
  const color = revealed ? scoreColor(score) : "#9ca3af";
  const size = 68;
  const r = size * 0.38;
  const circ = 2 * Math.PI * r;
  const pct = revealed && score != null ? score : 0;
  const offset = circ - (pct / 100) * circ;
  const cx = size / 2;

  return (
    <Card className={cn(
      "transition-all duration-700",
      revealed
        ? "ring-1 ring-border shadow-sm"
        : "opacity-50"
    )}>
      <CardContent className="p-3.5 flex items-center gap-3">
        {/* SVG ring */}
        <div className="relative flex-shrink-0">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={cx} cy={cx} r={r} fill="none" stroke="#e5e7eb" strokeWidth={size * 0.092} />
            <circle
              cx={cx} cy={cx} r={r} fill="none"
              stroke={color}
              strokeWidth={size * 0.092}
              strokeDasharray={circ}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cx})`}
              style={{ transition: "stroke-dashoffset 1.4s ease, stroke 0.6s ease" }}
            />
            <text x={cx} y={cx + 5} textAnchor="middle" fontSize={13} fontWeight="700"
              fill={revealed ? "#111827" : "#9ca3af"}>
              {revealed && score != null ? Math.round(score) : "—"}
            </text>
          </svg>
          {!revealed && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-2 h-2 rounded-full bg-primary/40 animate-pulse" />
            </div>
          )}
        </div>

        {/* Label & status */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
          </div>
          <p className="text-sm font-semibold transition-colors duration-500" style={{ color: revealed ? color : "#9ca3af" }}>
            {scoreLabel(revealed ? score : null)}
          </p>
          {!revealed && (
            <div className="flex gap-0.5 mt-1.5">
              {[8, 6, 4, 3, 2].map((w, i) => (
                <div key={i}
                  className="h-1 rounded-full bg-muted-foreground/20 animate-pulse"
                  style={{ width: `${w * 4}px`, animationDelay: `${i * 120}ms` }}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function WebsitePreview({ url, phaseIndex, runPhase }: { url: string; phaseIndex: number; runPhase: RunPhase }) {
  const scanPct = Math.min(100, (phaseIndex / TOTAL_PHASES) * 100);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-2.5 px-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 flex-shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
          </div>
          <div className="flex-1 bg-background rounded border border-border text-[11px] text-muted-foreground px-2.5 py-1 font-mono truncate">
            {url || "https://target-site.com"}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 relative bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden" style={{ height: 130 }}>
        {/* Skeleton content */}
        <div className="absolute inset-0 p-3 space-y-2 opacity-50">
          <div className="h-3 bg-slate-200 rounded w-3/4 animate-pulse" />
          <div className="h-2 bg-slate-200 rounded w-full animate-pulse" style={{ animationDelay: "80ms" }} />
          <div className="h-2 bg-slate-200 rounded w-5/6 animate-pulse" style={{ animationDelay: "160ms" }} />
          <div className="h-6 bg-slate-200 rounded w-full animate-pulse mt-1" style={{ animationDelay: "240ms" }} />
          <div className="grid grid-cols-3 gap-2 mt-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-6 bg-slate-200 rounded animate-pulse" style={{ animationDelay: `${320 + i * 80}ms` }} />
            ))}
          </div>
        </div>

        {/* Scan line */}
        {runPhase === "running" && (
          <div
            className="absolute left-0 right-0 h-0.5 pointer-events-none z-10"
            style={{
              top: `${scanPct}%`,
              transition: "top 1.8s ease",
              background: "linear-gradient(to right, transparent, hsl(var(--primary)), transparent)",
              boxShadow: "0 0 10px 3px hsl(var(--primary) / 0.35)",
            }}
          />
        )}

        {/* Glow band */}
        {runPhase === "running" && (
          <div
            className="absolute left-0 right-0 pointer-events-none z-10"
            style={{
              top: `${Math.max(0, scanPct - 20)}%`,
              height: "40%",
              background: "linear-gradient(to bottom, transparent, hsl(var(--primary) / 0.06), transparent)",
            }}
          />
        )}

        {/* Status badge */}
        <div className="absolute top-2 right-2 z-20">
          {runPhase === "running" ? (
            <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 text-primary text-[11px] px-2 py-0.5 rounded-full font-medium backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Scanning
            </div>
          ) : runPhase === "success" ? (
            <div className="flex items-center gap-1.5 bg-emerald-100 border border-emerald-200 text-emerald-700 text-[11px] px-2 py-0.5 rounded-full font-medium">
              <CheckCircle2 className="w-3 h-3" />
              Done
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function PhaseRow({ phase, state }: { phase: PhaseDef; state: "done" | "active" | "pending" }) {
  const Icon = phase.icon;
  return (
    <div className={cn(
      "flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-all duration-400",
      state === "active" && "bg-primary/8 ring-1 ring-primary/20",
      state === "done" && "opacity-55",
      state === "pending" && "opacity-25",
    )}>
      <div className={cn(
        "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-400",
        state === "done" ? "bg-emerald-100 text-emerald-600" :
        state === "active" ? "bg-primary/15 text-primary" :
        "bg-muted text-muted-foreground"
      )}>
        {state === "done"
          ? <CheckCircle2 className="h-3.5 w-3.5" />
          : state === "active"
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />}
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-xs font-medium truncate",
          state === "active" ? "text-primary" : "text-foreground"
        )}>
          {phase.label}
        </p>
      </div>

      <Badge
        variant="outline"
        className={cn(
          "text-[10px] px-1.5 py-0 hidden sm:flex flex-shrink-0 font-normal",
          state === "active" ? "border-primary/30 text-primary bg-primary/5" :
          state === "done" ? "border-emerald-200 text-emerald-600 bg-emerald-50" :
          "text-muted-foreground/60 border-border"
        )}
      >
        {phase.category}
      </Badge>
    </div>
  );
}

function ConsoleLogLine({ line, index }: { line: ExecutionLogLine; index: number }) {
  const isError = line.text.startsWith("ERROR:");
  const isWarn = line.text.startsWith("WARN");
  const isGood = line.text.includes("✓") || line.text.startsWith("TLS") || line.text.startsWith("AI confidence");

  return (
    <div className="flex gap-2 animate-in fade-in slide-in-from-bottom-1 duration-200"
      style={{ animationDelay: `${Math.min(index % 5, 4) * 40}ms` }}>
      <span className="text-zinc-500 flex-shrink-0 select-none">[{line.time}]</span>
      <span className={cn(
        isError ? "text-red-400" :
        isWarn ? "text-yellow-400" :
        isGood ? "text-emerald-400" :
        "text-zinc-300"
      )}>
        {line.text}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LiveAuditScanner() {
  const params = useParams<{ auditId: string }>();
  const auditId = Number(params.auditId);
  const [, setLocation] = useLocation();

  // Simulation state
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [logs, setLogs] = useState<ExecutionLogLine[]>([]);
  const [issueCount, setIssueCount] = useState(0);
  const [runPhase, setRunPhase] = useState<RunPhase>("running");
  const [revealedScores, setRevealedScores] = useState<Set<string>>(new Set());
  const [displayedScores, setDisplayedScores] = useState<{
    performance: number | null;
    accessibility: number | null;
    seo: number | null;
    bestPractices: number | null;
  }>({ performance: null, accessibility: null, seo: null, bestPractices: null });

  // Pre-generate placeholder scores seeded from auditId so they feel consistent
  const fakeScores = useRef({
    performance: 54 + (auditId * 17) % 36,
    accessibility: 63 + (auditId * 13) % 27,
    seo: 71 + (auditId * 7) % 24,
    bestPractices: 61 + (auditId * 11) % 29,
  });

  const startRef = useRef(Date.now());
  const logEndRef = useRef<HTMLDivElement>(null);
  const logsRef = useRef<ExecutionLogLine[]>([]);
  const finishedRef = useRef(false);
  const seenPhasesRef = useRef<Set<number>>(new Set());
  const issueRef = useRef(0);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Global unmount cleanup for redirect timer
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  const cancelMutation = useCancelAudit();

  // API polling
  const { data: audit } = useGetAudit(auditId, {
    query: {
      queryKey: getGetAuditQueryKey(auditId),
      enabled: !!auditId,
      refetchInterval: (runPhase === "running" || runPhase === "cancelling") ? 1500 : false,
    },
  });

  // Fetch project for URL display
  const { data: project } = useGetProject(audit?.projectId ?? 0, {
    query: {
      enabled: !!audit?.projectId,
      queryKey: getGetProjectQueryKey(audit?.projectId ?? 0),
    },
  });

  const appendLog = useCallback((text: string) => {
    const line: ExecutionLogLine = { time: new Date().toLocaleTimeString(), text };
    logsRef.current = [...logsRef.current, line];
    setLogs(prev => [...prev, line]);
  }, []);

  // ── Master simulation loop ──────────────────────────────────────────────────
  useEffect(() => {
    if (runPhase !== "running") return;
    startRef.current = Date.now();

    const elapsedTimer = setInterval(() => {
      setElapsedMs(Date.now() - startRef.current);
    }, 200);

    const progressTimer = setInterval(() => {
      setPhaseIndex(prev => {
        const targetProgress = Math.min(MAX_PROGRESS, ((prev + 0.5) / TOTAL_PHASES) * MAX_PROGRESS);
        setProgress(p => p < targetProgress ? Math.min(p + 0.6, targetProgress) : p);
        return prev;
      });
    }, 70);

    const phaseTimer = setInterval(() => {
      setPhaseIndex(prev => {
        const next = prev + 1;
        return next >= TOTAL_PHASES ? prev : next;
      });
    }, PHASE_DURATION_MS);

    return () => {
      clearInterval(elapsedTimer);
      clearInterval(progressTimer);
      clearInterval(phaseTimer);
    };
  }, [runPhase]);

  // ── Per-phase side effects ──────────────────────────────────────────────────
  useEffect(() => {
    if (seenPhasesRef.current.has(phaseIndex)) return;
    seenPhasesRef.current.add(phaseIndex);

    const phase = PHASES[phaseIndex];
    if (!phase) return;

    // Collect all handles so we can cancel on unmount / phase change
    const timers: ReturnType<typeof setTimeout>[] = [];
    const intervals: ReturnType<typeof setInterval>[] = [];

    // Staggered log lines
    phase.logs.forEach((text, i) => {
      timers.push(setTimeout(() => appendLog(text), i * 300));
    });

    // Issue counter tick-up
    if (phase.issueIncrement > 0) {
      const inc = phase.issueIncrement + Math.floor(((auditId + phaseIndex) * 3) % 3);
      let added = 0;
      const iv = setInterval(() => {
        added++;
        issueRef.current++;
        setIssueCount(issueRef.current);
        if (added >= inc) clearInterval(iv);
      }, 180);
      intervals.push(iv);
    }

    // Reveal score card
    if (phase.revealScore) {
      const key = phase.revealScore;
      timers.push(setTimeout(() => {
        setRevealedScores(prev => new Set([...prev, key]));
        setDisplayedScores(prev => ({
          ...prev,
          [key]: fakeScores.current[key as keyof typeof fakeScores.current],
        }));
      }, PHASE_DURATION_MS * 0.45));
    }

    return () => {
      timers.forEach(clearTimeout);
      intervals.forEach(clearInterval);
    };
  }, [phaseIndex, appendLog, auditId]);

  // ── Auto-scroll console ─────────────────────────────────────────────────────
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // ── Watch backend status ────────────────────────────────────────────────────
  useEffect(() => {
    if (!audit || finishedRef.current) return;

    if (audit.status === "completed") {
      finishedRef.current = true;
      setRunPhase("success");
      setProgress(100);
      setRevealedScores(new Set(["performance", "accessibility", "seo", "bestPractices"]));
      setDisplayedScores({
        performance: audit.performanceScore ?? null,
        accessibility: audit.accessibilityScore ?? null,
        seo: audit.seoScore ?? null,
        bestPractices: audit.bestPracticesScore ?? null,
      });
      appendLog("✓ Audit completed successfully. All results persisted to database.");
      saveExecutionLog(auditId, logsRef.current);
      redirectTimerRef.current = setTimeout(() => setLocation(`/audits/${auditId}`), 2800);
    } else if (audit.status === "failed") {
      finishedRef.current = true;
      setRunPhase("failed");
      appendLog("Audit failed. Please check logs or try again.");
    } else if (audit.status === "cancelled") {
      finishedRef.current = true;
      setRunPhase("cancelled");
      appendLog("Audit was cancelled by user.");
    }
  }, [audit, auditId, appendLog, setLocation]);

  const handleCancel = () => {
    if (runPhase !== "running") return;
    setRunPhase("cancelling");
    cancelMutation.mutate({ id: auditId });
  };

  const currentPhase = PHASES[Math.min(phaseIndex, TOTAL_PHASES - 1)];
  const eta = formatEta(elapsedMs, progress);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">

      {/* ── Sticky top bar ── */}
      <div className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="px-6 py-3 flex items-center gap-3">
          <Button
            variant="ghost" size="sm"
            className="text-muted-foreground hover:text-foreground h-8 px-2"
            onClick={() => setLocation("/audits")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Audits
          </Button>
          <div className="h-4 w-px bg-border" />

          {/* Live indicator */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className={cn(
              "w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-300",
              runPhase === "running" && "bg-emerald-500 animate-pulse",
              runPhase === "cancelling" && "bg-yellow-500 animate-pulse",
              runPhase === "success" && "bg-emerald-500",
              runPhase === "failed" && "bg-red-500",
              runPhase === "cancelled" && "bg-zinc-400",
            )} />
            <span className="text-sm font-semibold truncate">
              {runPhase === "running"
                ? "Live Audit Scanner"
                : runPhase === "cancelling"
                ? "Cancelling audit…"
                : runPhase === "success"
                ? "Audit Complete — opening results…"
                : runPhase === "failed"
                ? "Audit Failed"
                : "Audit Cancelled"}
            </span>
            <Badge variant="outline" className="font-mono text-[11px] hidden sm:flex flex-shrink-0">
              #{auditId}
            </Badge>
          </div>

          {/* Timer */}
          <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground font-mono">
            <Clock className="h-3.5 w-3.5" />
            {formatElapsed(elapsedMs)}
          </div>

          {/* Actions */}
          {runPhase === "running" && (
            <Button
              variant="outline" size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/5 h-8"
              onClick={handleCancel}
            >
              <Ban className="h-3.5 w-3.5 mr-1.5" />
              Cancel
            </Button>
          )}
          {runPhase === "cancelling" && (
            <Button variant="outline" size="sm" disabled className="h-8">
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Cancelling…
            </Button>
          )}
          {(runPhase === "failed" || runPhase === "cancelled") && (
            <Button variant="outline" size="sm" className="h-8" onClick={() => setLocation("/audits")}>
              Back to Audits
            </Button>
          )}
        </div>

        {/* Overall progress bar */}
        <div className="px-6 pb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-foreground">
              {runPhase === "success" ? "All phases complete" : currentPhase?.label ?? "Preparing…"}
            </span>
            <span className="text-xs font-mono font-bold text-foreground tabular-nums">
              {Math.round(progress)}%
            </span>
          </div>
          <Progress
            value={progress}
            className={cn(
              "h-2",
              runPhase === "success" && "[&>div]:bg-emerald-500 [&>div]:transition-all [&>div]:duration-700",
            )}
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] text-muted-foreground">
              Phase {Math.min(phaseIndex + 1, TOTAL_PHASES)} of {TOTAL_PHASES}
            </span>
            <span className="text-[11px] text-muted-foreground">
              ETA: {runPhase === "success" ? "Complete ✓" : eta}
            </span>
          </div>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="p-6 max-w-screen-xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: phases + preview + console ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Phase checklist */}
            <Card>
              <CardHeader className="py-3 px-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Scan Phases</CardTitle>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      runPhase === "running" ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
                    )} />
                    {runPhase === "running" ? "Active" : runPhase === "success" ? "Complete" : "Stopped"}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5">
                  {PHASES.map((p, i) => (
                    <PhaseRow
                      key={p.label}
                      phase={p}
                      state={
                        runPhase === "success"
                          ? "done"
                          : i < phaseIndex
                          ? "done"
                          : i === phaseIndex
                          ? "active"
                          : "pending"
                      }
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Website preview */}
            <WebsitePreview
              url={project?.url ?? ""}
              phaseIndex={phaseIndex}
              runPhase={runPhase}
            />

            {/* Console log */}
            <Card>
              <CardHeader className="py-3 px-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-semibold">Live Audit Log</CardTitle>
                  <div className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="font-mono">{logs.length} entries</span>
                    {runPhase === "running" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="bg-zinc-950 rounded-b-lg font-mono text-[11px] leading-relaxed p-4 h-56 overflow-y-auto scroll-smooth">
                  {logs.map((line, i) => (
                    <ConsoleLogLine key={i} line={line} index={i} />
                  ))}
                  {runPhase === "running" && (
                    <div className="flex items-center gap-1 text-zinc-600 mt-0.5">
                      <span className="inline-block w-[7px] h-3.5 bg-zinc-500 animate-pulse rounded-sm" />
                    </div>
                  )}
                  <div ref={logEndRef} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: counter + scores + stats ── */}
          <div className="space-y-5">

            {/* Issue counter */}
            <Card className={cn(
              "transition-all duration-600 border-2",
              issueCount > 15 ? "border-red-200 bg-red-50/20" :
              issueCount > 8 ? "border-yellow-200 bg-yellow-50/20" :
              "border-border bg-card"
            )}>
              <CardContent className="p-5 text-center">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                  Issues Detected
                </p>
                <div className={cn(
                  "text-6xl font-black tabular-nums transition-all duration-200 leading-none",
                  issueCount > 15 ? "text-red-600" :
                  issueCount > 8 ? "text-yellow-600" :
                  "text-foreground"
                )}>
                  {issueCount}
                </div>
                <p className="text-xs text-muted-foreground mt-2.5">
                  {issueCount === 0
                    ? "Scanning for issues…"
                    : issueCount > 15
                    ? "Multiple critical issues found"
                    : issueCount > 8
                    ? "Several issues detected"
                    : "Minor issues detected"}
                </p>
                {issueCount > 0 && (
                  <div className="mt-3.5 flex justify-center gap-2.5 flex-wrap">
                    <div className="flex items-center gap-1 text-[11px] text-red-600 font-medium">
                      <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                      {Math.max(1, Math.floor(issueCount * 0.22))} critical
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-yellow-600 font-medium">
                      <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />
                      {Math.floor(issueCount * 0.42)} high
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-blue-600 font-medium">
                      <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                      {issueCount - Math.max(1, Math.floor(issueCount * 0.22)) - Math.floor(issueCount * 0.42)} other
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Score cards */}
            <div className="space-y-2.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-0.5">
                Live Scores
              </p>
              <LiveScoreCard
                label="Performance"
                score={displayedScores.performance}
                revealed={revealedScores.has("performance")}
                icon={Gauge}
              />
              <LiveScoreCard
                label="Accessibility"
                score={displayedScores.accessibility}
                revealed={revealedScores.has("accessibility")}
                icon={Eye}
              />
              <LiveScoreCard
                label="SEO"
                score={displayedScores.seo}
                revealed={revealedScores.has("seo")}
                icon={TrendingUp}
              />
              <LiveScoreCard
                label="Best Practices"
                score={displayedScores.bestPractices}
                revealed={revealedScores.has("bestPractices")}
                icon={Activity}
              />
            </div>

            {/* Timing stats */}
            <Card>
              <CardContent className="p-4 space-y-3">
                {[
                  {
                    label: "Elapsed",
                    icon: Clock,
                    value: formatElapsed(elapsedMs),
                  },
                  {
                    label: "Est. Remaining",
                    icon: undefined,
                    value: runPhase === "success" ? "—" : eta,
                  },
                  {
                    label: "Progress",
                    icon: undefined,
                    value: `${Math.round(progress)}%`,
                  },
                  {
                    label: "Phase",
                    icon: undefined,
                    value: `${Math.min(phaseIndex + 1, TOTAL_PHASES)} / ${TOTAL_PHASES}`,
                  },
                ].map(({ label, icon: Icon, value }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      {Icon && <Icon className="h-3.5 w-3.5" />}
                      {label}
                    </span>
                    <span className="font-mono font-semibold text-foreground tabular-nums">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Pulse indicators */}
            <Card>
              <CardContent className="p-4">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                  Scanner Activity
                </p>
                <div className="space-y-2.5">
                  {[
                    { label: "Network I/O", pct: Math.min(100, 30 + phaseIndex * 5) },
                    { label: "CPU Usage", pct: Math.min(100, 20 + phaseIndex * 6) },
                    { label: "DOM Analysis", pct: Math.min(100, phaseIndex > 7 ? 90 : phaseIndex * 10) },
                  ].map(({ label, pct }) => (
                    <div key={label}>
                      <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                        <span>{label}</span>
                        <span className="font-mono">{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-1000"
                          style={{ width: `${runPhase === "running" ? pct : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ── Success overlay ── */}
      {runPhase === "success" && (
        <div className="fixed inset-0 bg-background/85 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-600">
          <div className="bg-card border border-border rounded-2xl p-10 max-w-md w-full mx-6 shadow-2xl text-center animate-in zoom-in-95 duration-500">
            {/* Checkmark */}
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5 animate-in zoom-in duration-700">
              <CheckCircle2 className="h-11 w-11 text-emerald-600" />
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-2">Audit Complete</h2>
            <p className="text-muted-foreground text-sm mb-1">
              {issueCount} {issueCount === 1 ? "issue" : "issues"} detected across {TOTAL_PHASES} scan phases.
            </p>
            <p className="text-muted-foreground text-sm mb-7">Opening your full results now…</p>

            {/* Bouncing dots */}
            <div className="flex gap-2 justify-center">
              {[0, 150, 300].map(delay => (
                <div
                  key={delay}
                  className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Failed / Cancelled state ── */}
      {(runPhase === "failed" || runPhase === "cancelled") && (
        <div className="fixed inset-0 bg-background/85 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-400">
          <div className="bg-card border border-border rounded-2xl p-10 max-w-sm w-full mx-6 shadow-2xl text-center animate-in zoom-in-95 duration-400">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-9 w-9 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              {runPhase === "cancelled" ? "Audit Cancelled" : "Audit Failed"}
            </h2>
            <p className="text-muted-foreground text-sm mb-6">
              {runPhase === "cancelled"
                ? "The audit was cancelled before completion."
                : "Something went wrong. Please try again."}
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => setLocation("/audits")}>
                Back to Audits
              </Button>
              <Button onClick={() => setLocation(`/projects/${audit?.projectId}`)}>
                Run New Audit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
