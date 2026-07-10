import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  useListProjects,
  useListAudits,
  useListBugs,
  useGetDashboardSummary,
  useGetAuditTrends,
  useGetPerformanceHistory,
  getGetDashboardSummaryQueryKey,
  getGetAuditTrendsQueryKey,
  getGetPerformanceHistoryQueryKey,
  type Project,
  type AuditRun,
  type Bug,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { SeverityBadge } from "@/components/severity-badge";
import { StatusBadge } from "@/components/status-badge";
import { AnimatedCounter } from "@/components/animated-counter";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, BarChart, Bar,
} from "recharts";
import {
  FileText, Download, Printer, Share2, Gauge, Folder, Activity,
  AlertTriangle, TrendingUp, Bug as BugIcon, Sparkles, CheckCircle2, ShieldAlert,
  Bot, Clock, CalendarCheck, Zap, Accessibility, Search, Star,
  ArrowUp, ArrowDown, Minus, FileBarChart2, BookOpen,
} from "lucide-react";

// ─── Colour maps (match executive-dashboard.tsx) ────────────────────────────
const RISK_COLORS: Record<string, string> = { Low: "#10b981", Medium: "#f59e0b", High: "#ef4444" };
const ENV_COLORS: Record<string, string> = { production: "#6366f1", staging: "#f59e0b", development: "#64748b" };
const HEALTH_COLORS = ["#10b981", "#6366f1", "#f59e0b", "#ef4444"];

// ─── Derived helpers ─────────────────────────────────────────────────────────
function latestAuditMap(audits: AuditRun[]) {
  const map = new Map<number, AuditRun>();
  for (const a of audits) {
    if (a.status !== "completed") continue;
    const ex = map.get(a.projectId);
    if (!ex || new Date(a.createdAt) > new Date(ex.createdAt)) map.set(a.projectId, a);
  }
  return map;
}

function scoreColor(score: number | null): string {
  if (score === null) return "text-slate-400";
  if (score >= 90) return "text-emerald-600";
  if (score >= 75) return "text-indigo-600";
  if (score >= 55) return "text-amber-600";
  return "text-red-600";
}

function riskOf(score: number | null): "Low" | "Medium" | "High" {
  if (score === null) return "Medium";
  if (score >= 85) return "Low";
  if (score >= 65) return "Medium";
  return "High";
}

function fixTime(severity: string): string {
  switch (severity) {
    case "critical": return "2–4 hrs";
    case "high": return "4–8 hrs";
    case "medium": return "1–2 days";
    default: return "2–3 days";
  }
}

function impactOf(severity: string): string {
  switch (severity) {
    case "critical": return "Business Critical";
    case "high": return "High";
    case "medium": return "Moderate";
    default: return "Low";
  }
}

// ─── Section header ──────────────────────────────────────────────────────────
function SectionHeading({ icon: Icon, title, subtitle }: {
  icon: React.ElementType; title: string; subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Trend arrow ─────────────────────────────────────────────────────────────
function TrendArrow({ value }: { value: number | null }) {
  if (value === null) return <Minus className="h-4 w-4 text-slate-400" />;
  if (value > 0) return <ArrowUp className="h-4 w-4 text-emerald-500" />;
  if (value < 0) return <ArrowDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-slate-400" />;
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function ExecutiveReportCenter() {
  const { toast } = useToast();

  const { data: projects = [] } = useListProjects();
  const { data: audits = [] } = useListAudits({ limit: 500 });
  const { data: bugs = [] } = useListBugs();
  const { data: summary } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const { data: trends = [] } = useGetAuditTrends({ query: { queryKey: getGetAuditTrendsQueryKey() } });
  const { data: performance = [] } = useGetPerformanceHistory(undefined, {
    query: { queryKey: getGetPerformanceHistoryQueryKey() },
  });

  const now = useMemo(() => new Date(), []);

  // ── derived data ─────────────────────────────────────────────────────────
  const latestByProject = useMemo(() => latestAuditMap(audits), [audits]);
  const completedAudits = useMemo(() => audits.filter((a) => a.status === "completed"), [audits]);

  const criticalBugsByProject = useMemo(() => {
    const map = new Map<number, number>();
    for (const b of bugs) {
      if (b.severity !== "critical" || b.status === "resolved" || b.status === "ignored") continue;
      map.set(b.projectId, (map.get(b.projectId) ?? 0) + 1);
    }
    return map;
  }, [bugs]);

  const projectHealth = useMemo(() => {
    return projects.map((p) => {
      const latest = latestByProject.get(p.id);
      const score = latest?.overallScore ?? null;
      return {
        project: p,
        score,
        risk: riskOf(score),
        openBugs: p.openBugCount ?? 0,
        criticalBugs: criticalBugsByProject.get(p.id) ?? 0,
        lastAuditAt: p.lastAuditAt,
        latest,
      };
    });
  }, [projects, latestByProject, criticalBugsByProject]);

  const portfolioHealth = useMemo(() => {
    const scored = projectHealth.filter((p) => p.score !== null);
    if (!scored.length) return null;
    return Math.round(scored.reduce((s, p) => s + (p.score ?? 0), 0) / scored.length);
  }, [projectHealth]);

  const openBugsTotal = useMemo(
    () => bugs.filter((b) => b.status !== "resolved" && b.status !== "ignored").length,
    [bugs],
  );
  const criticalIssuesTotal =
    summary?.criticalIssues ?? bugs.filter((b) => b.severity === "critical" && b.status !== "resolved" && b.status !== "ignored").length;

  const avgAuditDurationSec = useMemo(() => {
    const d = completedAudits.filter((a) => a.durationMs);
    if (!d.length) return null;
    return Math.round(d.reduce((s, a) => s + (a.durationMs ?? 0), 0) / d.length / 1000);
  }, [completedAudits]);

  const lastScan = useMemo(() => {
    const sorted = completedAudits.filter((a) => a.completedAt).sort(
      (a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime(),
    );
    return sorted[0]?.completedAt ?? null;
  }, [completedAudits]);

  const aiConfidence = useMemo(() => {
    if (!completedAudits.length) return null;
    const base = 70;
    const bonus = Math.min(20, Math.round((completedAudits.length / Math.max(1, audits.length)) * 20));
    const penalty = Math.min(25, criticalIssuesTotal * 2);
    return Math.max(40, Math.min(99, base + bonus - penalty));
  }, [completedAudits.length, audits.length, criticalIssuesTotal]);

  // Average lighthouse scores from latest audits
  const avgScores = useMemo(() => {
    const vals = Array.from(latestByProject.values());
    const avg = (fn: (a: AuditRun) => number | null | undefined) => {
      const v = vals.map(fn).filter((x): x is number => x !== null && x !== undefined);
      return v.length ? Math.round(v.reduce((s, n) => s + n, 0) / v.length) : null;
    };
    return {
      performance: avg((a) => a.performanceScore),
      accessibility: avg((a) => a.accessibilityScore),
      seo: avg((a) => a.seoScore),
      bestPractices: avg((a) => a.bestPracticesScore),
    };
  }, [latestByProject]);

  const readiness: "Ready" | "Caution" | "Not Ready" | "Unknown" =
    portfolioHealth === null ? "Unknown" :
    portfolioHealth >= 85 ? "Ready" :
    portfolioHealth >= 65 ? "Caution" : "Not Ready";

  // AI executive summary text
  const summaryText = useMemo(() => {
    // Only consider scored projects so a null-score project isn't reported as highest-risk
    const scoredHealth = projectHealth.filter((p) => p.score !== null);
    const topRisk = [...scoredHealth].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
    const best = [...scoredHealth].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
    const health = portfolioHealth ?? "N/A";
    const healthLabel = portfolioHealth === null ? "Unknown" : portfolioHealth >= 85 ? "Good" : portfolioHealth >= 65 ? "Fair" : "At Risk";
    return (
      `Overall application portfolio health is ${healthLabel} (${health}/100). ` +
      `${criticalIssuesTotal} critical issue${criticalIssuesTotal === 1 ? "" : "s"} require immediate attention ` +
      `across ${projects.length} monitored project${projects.length === 1 ? "" : "s"}. ` +
      (avgScores.seo !== null ? `SEO score stands at ${avgScores.seo}/100. ` : "") +
      (avgScores.accessibility !== null ? `Accessibility is at ${avgScores.accessibility}/100. ` : "") +
      (topRisk ? `${topRisk.project.name} carries the highest current risk (score ${topRisk.score ?? "N/A"}). ` : "") +
      (best && best.project.id !== topRisk?.project.id ? `${best.project.name} is the best-performing project at ${best.score}/100. ` : "") +
      `Based on current trends, release readiness is assessed as ${readiness.toLowerCase()}. ` +
      `Addressing the highlighted recommendations is expected to improve the overall health score above ${Math.min(99, (portfolioHealth ?? 70) + 8)}.`
    );
  }, [portfolioHealth, criticalIssuesTotal, projects.length, avgScores, projectHealth, readiness]);

  // Recommendations grouped by priority
  const recommendations = useMemo(() => {
    const immediate: string[] = [];
    const high: string[] = [];
    const medium: string[] = [];
    const low: string[] = [];

    for (const { project, criticalBugs, openBugs, score } of projectHealth) {
      if (criticalBugs > 0) {
        immediate.push(`Resolve ${criticalBugs} critical bug${criticalBugs > 1 ? "s" : ""} in ${project.name} immediately.`);
      }
      if (openBugs > 5 && criticalBugs === 0) {
        high.push(`Address ${openBugs} open bugs in ${project.name} to prevent escalation.`);
      } else if (openBugs > 2 && criticalBugs === 0) {
        medium.push(`Review ${openBugs} open bugs in ${project.name} this sprint.`);
      }
      if (score !== null && score < 65) {
        immediate.push(`Run a full audit on ${project.name} — health score is critically low (${score}).`);
      } else if (score !== null && score < 80) {
        high.push(`Investigate quality degradation in ${project.name} (score ${score}).`);
      }
    }
    if (avgScores.accessibility !== null && avgScores.accessibility < 80) {
      medium.push("Improve accessibility compliance across the portfolio to meet WCAG 2.1 AA standards.");
    }
    if (avgScores.seo !== null && avgScores.seo < 80) {
      medium.push("Strengthen SEO scores through structured-data audits and meta tag reviews.");
    }
    if (avgScores.performance !== null && avgScores.performance < 75) {
      high.push("Optimize Largest Contentful Paint and Total Blocking Time metrics across production environments.");
    }
    low.push("Schedule a quarterly dependency review to identify outdated packages and security advisories.");
    low.push("Configure automated regression audits on all staging environments before each release.");
    if (completedAudits.length < 10) {
      low.push("Increase audit cadence — more data points will improve AI confidence scores.");
    }

    return { immediate, high, medium, low };
  }, [projectHealth, avgScores, completedAudits.length]);

  // Top issues — highest-severity open bugs, max 10
  const topIssues = useMemo<Bug[]>(() => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return bugs
      .filter((b) => b.status !== "resolved" && b.status !== "ignored")
      .sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))
      .slice(0, 10);
  }, [bugs]);

  const projectNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of projects) map.set(p.id, p.name);
    return map;
  }, [projects]);

  // Ranked projects
  const rankedProjects = useMemo(
    () => [...projectHealth].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    [projectHealth],
  );

  // Distribution data
  const riskDistribution = useMemo(() => {
    const b = { Low: 0, Medium: 0, High: 0 };
    for (const { risk } of projectHealth) b[risk]++;
    return Object.entries(b).map(([name, value]) => ({ name, value }));
  }, [projectHealth]);

  const envDistribution = useMemo(() => {
    const b: Record<string, number> = { production: 0, staging: 0, development: 0 };
    for (const p of projects) b[p.environment] = (b[p.environment] ?? 0) + 1;
    return Object.entries(b).map(([name, value]) => ({ name, value }));
  }, [projects]);

  const healthDistribution = useMemo(() => {
    const b = { Excellent: 0, Good: 0, Warning: 0, Critical: 0 };
    for (const { score } of projectHealth) {
      if (score === null) continue;
      if (score >= 90) b.Excellent++;
      else if (score >= 75) b.Good++;
      else if (score >= 55) b.Warning++;
      else b.Critical++;
    }
    return Object.entries(b).map(([name, value]) => ({ name, value }));
  }, [projectHealth]);

  const exportToast = (label: string) =>
    toast({ title: `${label}`, description: `${label.split(" ").slice(1).join(" ")} will be available in the next release.` });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">

      {/* ── Page header ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileBarChart2 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Executive Report Center</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Comprehensive quality report · Generated {format(now, "MMMM d, yyyy 'at' h:mm a")}
          </p>
        </div>

        {/* Export actions */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Export PDF", icon: Download },
            { label: "Export Excel", icon: FileText },
            { label: "Print Report", icon: Printer },
            { label: "Share Report", icon: Share2 },
          ].map(({ label, icon: Icon }) => (
            <Button
              key={label}
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={() => exportToast(label)}
            >
              <Icon className="h-3 w-3 mr-1.5" />
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* ── 1. Executive Summary cards ──────────────────────────────────── */}
      <section>
        <SectionHeading icon={Gauge} title="Executive Summary" subtitle="High-level health indicators across all projects" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: "Overall Health", value: portfolioHealth, suffix: "/100", icon: Gauge, color: scoreColor(portfolioHealth) },
            { label: "Performance", value: avgScores.performance, suffix: "/100", icon: Zap, color: scoreColor(avgScores.performance) },
            { label: "Accessibility", value: avgScores.accessibility, suffix: "/100", icon: Accessibility, color: scoreColor(avgScores.accessibility) },
            { label: "SEO", value: avgScores.seo, suffix: "/100", icon: Search, color: scoreColor(avgScores.seo) },
            { label: "Best Practices", value: avgScores.bestPractices, suffix: "/100", icon: Star, color: scoreColor(avgScores.bestPractices) },
            { label: "Total Bugs", value: openBugsTotal, suffix: "", icon: BugIcon, color: openBugsTotal > 10 ? "text-orange-600" : "text-slate-900" },
            { label: "Critical Issues", value: criticalIssuesTotal, suffix: "", icon: AlertTriangle, color: criticalIssuesTotal > 0 ? "text-red-600" : "text-emerald-600" },
            { label: "Audit Duration", value: avgAuditDurationSec !== null ? `${avgAuditDurationSec}s` : "—", suffix: "", icon: Clock, color: "text-slate-700" },
            { label: "Last Scan", value: lastScan ? format(new Date(lastScan), "MMM d") : "—", suffix: "", icon: CalendarCheck, color: "text-slate-700" },
            { label: "AI Confidence", value: aiConfidence, suffix: "%", icon: Sparkles, color: "text-violet-600" },
          ].map(({ label, value, suffix, icon: Icon, color }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04, ease: "easeOut" }}
            >
              <Card className="shadow-sm border-border h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground leading-tight">{label}</CardTitle>
                  <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", color)} />
                </CardHeader>
                <CardContent className="pb-4 px-4">
                  <div className={cn("text-xl font-bold", color)}>
                    <AnimatedCounter value={value ?? "—"} suffix={typeof value === "number" ? suffix : ""} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── 2. AI Executive Summary ─────────────────────────────────────── */}
      <section>
        <SectionHeading icon={Bot} title="AI Executive Summary" subtitle="Generated from live portfolio data" />
        <Card className="border-violet-200 bg-gradient-to-br from-violet-50/80 to-purple-50/30 shadow-sm dark:from-violet-950/30 dark:to-purple-950/10 dark:border-violet-800">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-violet-600 flex items-center justify-center shadow-md flex-shrink-0">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm text-violet-900 dark:text-violet-200">Management Summary</CardTitle>
                  <Badge className="bg-violet-600 text-white text-[10px] px-1.5 py-0">AI</Badge>
                </div>
                <CardDescription className="text-violet-600/70 text-xs">Confidence: {aiConfidence ?? "—"}%</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-white/80 dark:bg-white/5 border border-violet-100 dark:border-violet-700 p-4">
              <p className="text-sm text-foreground leading-relaxed">{summaryText}</p>
            </div>
            <div className={cn(
              "rounded-xl border p-3 flex items-center gap-2 text-sm font-semibold",
              readiness === "Ready" && "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400",
              readiness === "Caution" && "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400",
              readiness === "Not Ready" && "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400",
              readiness === "Unknown" && "bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700",
            )}>
              <ShieldAlert className="h-4 w-4" /> Release Readiness: <span>{readiness}</span>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── 3. KPI Cards ────────────────────────────────────────────────── */}
      <section>
        <SectionHeading icon={Activity} title="KPI Overview" subtitle="Key performance indicators at a glance" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Projects", value: projects.length, icon: Folder, color: "text-slate-900 dark:text-slate-100" },
            { label: "Audits", value: summary?.totalAudits ?? audits.length, icon: Activity, color: "text-slate-900 dark:text-slate-100" },
            { label: "Open Bugs", value: openBugsTotal, icon: BugIcon, color: openBugsTotal > 10 ? "text-orange-600" : "text-slate-900" },
            { label: "Critical Issues", value: criticalIssuesTotal, icon: AlertTriangle, color: criticalIssuesTotal > 0 ? "text-red-600" : "text-emerald-600" },
            { label: "Avg Health", value: portfolioHealth, suffix: "/100", icon: TrendingUp, color: scoreColor(portfolioHealth) },
            {
              label: "Release Readiness",
              value: readiness,
              icon: CheckCircle2,
              color: readiness === "Ready" ? "text-emerald-600" : readiness === "Caution" ? "text-amber-600" : "text-red-600",
            },
          ].map(({ label, value, suffix, icon: Icon, color }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04, ease: "easeOut" }}
            >
              <Card className="shadow-sm border-border h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground leading-tight">{label}</CardTitle>
                  <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", color)} />
                </CardHeader>
                <CardContent className="pb-4 px-4">
                  <div className={cn("text-xl font-bold truncate", color)}>
                    <AnimatedCounter value={value ?? "—"} suffix={typeof value === "number" && suffix ? suffix : ""} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── 4. Charts ───────────────────────────────────────────────────── */}
      <section>
        <SectionHeading icon={TrendingUp} title="Trend Analysis" subtitle="Historical performance across the reporting period" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Audit Trend */}
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Audit Trend (30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <motion.div className="h-[220px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
                {trends.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="rcGradAudit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tickFormatter={(v) => format(new Date(v), "MMM d")} tick={{ fontSize: 11, fill: "#64748b" }} dy={8} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} dx={-6} />
                      <RechartsTooltip contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", fontSize: 12 }} labelFormatter={(v) => format(new Date(v), "MMM d, yyyy")} />
                      <Area type="monotone" dataKey="count" name="Audits" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#rcGradAudit)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </motion.div>
            </CardContent>
          </Card>

          {/* Health Trend (overall score over time, from audit trends) */}
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Health Trend (30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <motion.div className="h-[220px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.05 }}>
                {trends.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="rcGradHealth" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tickFormatter={(v) => format(new Date(v), "MMM d")} tick={{ fontSize: 11, fill: "#64748b" }} dy={8} />
                      <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} dx={-6} />
                      <RechartsTooltip contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", fontSize: 12 }} labelFormatter={(v) => format(new Date(v), "MMM d, yyyy")} />
                      <Area type="monotone" dataKey="avgScore" name="Avg Health" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#rcGradHealth)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </motion.div>
            </CardContent>
          </Card>

          {/* Performance Trend */}
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Score Trends (Performance / Accessibility / SEO)</CardTitle>
            </CardHeader>
            <CardContent>
              <motion.div className="h-[220px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.08 }}>
                {performance.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={performance} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tickFormatter={(v) => format(new Date(v), "MMM d")} tick={{ fontSize: 11, fill: "#64748b" }} dy={8} />
                      <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} dx={-6} />
                      <RechartsTooltip contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", fontSize: 12 }} labelFormatter={(v) => format(new Date(v), "MMM d, yyyy")} />
                      <Legend verticalAlign="bottom" height={28} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="performance" name="Performance" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="accessibility" name="Accessibility" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="seo" name="SEO" stroke="#10b981" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="bestPractices" name="Best Practices" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </motion.div>
            </CardContent>
          </Card>

          {/* Risk Distribution */}
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Risk Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <motion.div className="h-[220px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.1 }}>
                {riskDistribution.some((d) => d.value > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={riskDistribution} cx="50%" cy="45%" innerRadius={45} outerRadius={80} paddingAngle={2} dataKey="value" nameKey="name">
                        {riskDistribution.map((entry, i) => (
                          <Cell key={i} fill={RISK_COLORS[entry.name] ?? "#cbd5e1"} />
                        ))}
                      </Pie>
                      <RechartsTooltip contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", fontSize: 12 }} />
                      <Legend verticalAlign="bottom" height={28} formatter={(v) => <span style={{ fontSize: 11, color: "#64748b" }}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </motion.div>
            </CardContent>
          </Card>

          {/* Environment Distribution */}
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Environment Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <motion.div className="h-[220px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.15 }}>
                {envDistribution.some((d) => d.value > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={envDistribution} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} dy={8} tickFormatter={(v) => v.charAt(0).toUpperCase() + v.slice(1)} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                      <RechartsTooltip contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", fontSize: 12 }} />
                      <Bar dataKey="value" name="Projects" radius={[4, 4, 0, 0]}>
                        {envDistribution.map((entry, i) => (
                          <Cell key={i} fill={ENV_COLORS[entry.name] ?? "#cbd5e1"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </motion.div>
            </CardContent>
          </Card>

          {/* Health Distribution */}
          <Card className="shadow-sm border-border lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Portfolio Health Distribution</CardTitle>
              <CardDescription className="text-xs">Project count across Excellent / Good / Warning / Critical bands</CardDescription>
            </CardHeader>
            <CardContent>
              <motion.div className="h-[180px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.2 }}>
                {healthDistribution.some((d) => d.value > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={healthDistribution} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} dy={8} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                      <RechartsTooltip contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", fontSize: 12 }} />
                      <Bar dataKey="value" name="Projects" radius={[4, 4, 0, 0]}>
                        {healthDistribution.map((_, i) => (
                          <Cell key={i} fill={HEALTH_COLORS[i % HEALTH_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </motion.div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── 5. Top Issues ───────────────────────────────────────────────── */}
      <section>
        <SectionHeading icon={AlertTriangle} title="Top Issues" subtitle="Highest-priority open findings requiring attention" />
        <Card className="shadow-sm border-border overflow-x-auto">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-xs">Severity</TableHead>
                  <TableHead className="text-xs">Issue</TableHead>
                  <TableHead className="text-xs">Affected Project</TableHead>
                  <TableHead className="text-xs">Impact</TableHead>
                  <TableHead className="text-xs">Est. Fix Time</TableHead>
                  <TableHead className="text-xs">Owner</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topIssues.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground text-sm">
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                        <p className="font-medium text-foreground">No open issues</p>
                        <p className="text-xs">All bugs are resolved or ignored.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : topIssues.map((bug, i) => (
                  <motion.tr
                    key={bug.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.03 }}
                    className="border-b border-border hover:bg-muted/40 transition-colors"
                  >
                    <TableCell className="py-3"><SeverityBadge severity={bug.severity} /></TableCell>
                    <TableCell className="py-3 max-w-[240px]">
                      <p className="font-medium text-sm text-foreground truncate">{bug.title}</p>
                    </TableCell>
                    <TableCell className="py-3 text-sm text-muted-foreground">
                      {projectNameById.get(bug.projectId) ?? `Project #${bug.projectId}`}
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge variant="outline" className={cn("text-[10px] font-semibold", {
                        "border-red-200 text-red-700 bg-red-50": bug.severity === "critical",
                        "border-orange-200 text-orange-700 bg-orange-50": bug.severity === "high",
                        "border-amber-200 text-amber-700 bg-amber-50": bug.severity === "medium",
                        "border-blue-200 text-blue-700 bg-blue-50": bug.severity === "low",
                      })}>
                        {impactOf(bug.severity)}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {fixTime(bug.severity)}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-muted-foreground">
                      {bug.assignedToId ? `User #${bug.assignedToId}` : "QA Team"}
                    </TableCell>
                    <TableCell className="py-3">
                      <StatusBadge status={bug.status} />
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* ── 6. AI Recommendations ───────────────────────────────────────── */}
      <section>
        <SectionHeading icon={Sparkles} title="AI Recommendations" subtitle="Grouped by priority — derived from live audit and bug data" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[
            { label: "Immediate", items: recommendations.immediate, border: "border-red-200 dark:border-red-800", bg: "bg-red-50 dark:bg-red-950/30", badge: "bg-red-600", dot: "bg-red-500" },
            { label: "High Priority", items: recommendations.high, border: "border-orange-200 dark:border-orange-800", bg: "bg-orange-50 dark:bg-orange-950/30", badge: "bg-orange-500", dot: "bg-orange-500" },
            { label: "Medium Priority", items: recommendations.medium, border: "border-amber-200 dark:border-amber-800", bg: "bg-amber-50 dark:bg-amber-950/20", badge: "bg-amber-500", dot: "bg-amber-500" },
            { label: "Low Priority", items: recommendations.low, border: "border-blue-200 dark:border-blue-800", bg: "bg-blue-50 dark:bg-blue-950/20", badge: "bg-blue-500", dot: "bg-blue-500" },
          ].map(({ label, items, border, bg, badge, dot }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
            >
              <Card className={cn("shadow-sm border", border, bg)}>
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-center gap-2">
                    <Badge className={cn("text-white text-[10px] px-1.5 py-0", badge)}>{label}</Badge>
                    <span className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 ? "s" : ""}</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No items in this priority tier.</p>
                  ) : (
                    <ul className="space-y-2">
                      {items.map((item, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm text-foreground">
                          <span className={cn("mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0", dot)} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── 7. Project Health Ranking ────────────────────────────────────── */}
      <section>
        <SectionHeading icon={Star} title="Project Health Ranking" subtitle="All projects ranked by current health score" />
        <Card className="shadow-sm border-border overflow-x-auto">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-xs w-8">#</TableHead>
                  <TableHead className="text-xs">Project</TableHead>
                  <TableHead className="text-xs">Health</TableHead>
                  <TableHead className="text-xs text-center">Open Bugs</TableHead>
                  <TableHead className="text-xs text-center">Critical</TableHead>
                  <TableHead className="text-xs">Last Audit</TableHead>
                  <TableHead className="text-xs">Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankedProjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">No project data available.</TableCell>
                  </TableRow>
                ) : rankedProjects.map(({ project, score, openBugs, criticalBugs, lastAuditAt, risk }, i) => (
                  <TableRow key={project.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="text-sm text-muted-foreground font-mono">{i + 1}</TableCell>
                    <TableCell className="py-3">
                      <div>
                        <p className="font-medium text-sm text-foreground">{project.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">{project.url}</p>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <span className={cn("text-sm font-bold", scoreColor(score))}>{score ?? "—"}</span>
                        {score !== null && (
                          <Progress
                            value={score}
                            className="h-1.5 w-16"
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      <span className={openBugs > 5 ? "text-orange-600 font-semibold" : "text-foreground"}>{openBugs}</span>
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      <span className={criticalBugs > 0 ? "text-red-600 font-bold" : "text-muted-foreground"}>{criticalBugs}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {lastAuditAt ? format(new Date(lastAuditAt), "MMM d, yyyy") : "Never"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <TrendArrow value={score !== null ? (score >= 85 ? 1 : score >= 65 ? 0 : -1) : null} />
                        <Badge variant="outline" className={cn("text-[10px]", {
                          "border-emerald-200 text-emerald-700 bg-emerald-50": risk === "Low",
                          "border-amber-200 text-amber-700 bg-amber-50": risk === "Medium",
                          "border-red-200 text-red-700 bg-red-50": risk === "High",
                        })}>{risk}</Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* ── 8. Executive Notes ──────────────────────────────────────────── */}
      <section>
        <SectionHeading icon={BookOpen} title="Executive Notes" subtitle="Management observations for this reporting period" />
        <Card className="shadow-sm border-border bg-slate-50/60 dark:bg-muted/20">
          <CardContent className="pt-5">
            <ul className="space-y-3">
              {[
                criticalIssuesTotal > 0
                  ? `Release can proceed after resolving ${criticalIssuesTotal} critical issue${criticalIssuesTotal > 1 ? "s" : ""}.`
                  : "All critical issues resolved — portfolio is clear for release.",
                avgScores.seo !== null
                  ? `SEO score stands at ${avgScores.seo}/100 across monitored projects.`
                  : "SEO data will be available once audits complete.",
                avgScores.accessibility !== null
                  ? `Accessibility score is ${avgScores.accessibility}/100 — ${avgScores.accessibility >= 80 ? "remains stable and healthy." : "requires improvement to meet WCAG standards."}`
                  : "Accessibility audits pending.",
                `AI confidence is ${aiConfidence !== null ? (aiConfidence >= 80 ? "High" : aiConfidence >= 60 ? "Moderate" : "Low") : "Pending"} (${aiConfidence ?? "—"}%) — based on audit completeness and data consistency.`,
                `Report generated on ${format(now, "MMMM d, yyyy")} covering ${projects.length} project${projects.length !== 1 ? "s" : ""} and ${audits.length} audit run${audits.length !== 1 ? "s" : ""}.`,
              ].map((note, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.05 }}
                  className="flex items-start gap-2.5 text-sm text-foreground"
                >
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                  {note}
                </motion.li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* ── 9. Export footer ────────────────────────────────────────────── */}
      <section>
        <Separator className="mb-6" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">
              This report is auto-generated from live QA portal data. For questions, contact your QA team lead.
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Period: {format(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), "MMM d")} – {format(now, "MMM d, yyyy")} · Ref: QA-RPT-{format(now, "yyyyMMdd")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Export PDF", icon: Download },
              { label: "Export Excel", icon: FileText },
              { label: "Print Report", icon: Printer },
              { label: "Share Report", icon: Share2 },
            ].map(({ label, icon: Icon }) => (
              <Button key={label} variant="outline" size="sm" className="text-xs h-8" onClick={() => exportToast(label)}>
                <Icon className="h-3 w-3 mr-1.5" />
                {label}
              </Button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
      No data available
    </div>
  );
}
