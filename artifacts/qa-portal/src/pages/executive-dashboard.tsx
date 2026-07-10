import { useMemo, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  useListProjects,
  useListAudits,
  useListBugs,
  useListReports,
  useListScheduledAudits,
  useGetDashboardSummary,
  useGetAuditTrends,
  useGetPerformanceHistory,
  useGetRecentActivity,
  getGetDashboardSummaryQueryKey,
  getGetAuditTrendsQueryKey,
  getGetPerformanceHistoryQueryKey,
  getGetRecentActivityQueryKey,
  type Project,
  type AuditRun,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";
import { SeverityBadge } from "@/components/severity-badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import {
  Gauge, Folder, Activity, AlertTriangle, TrendingUp, Bug, Sparkles,
  Target, Users, Clock, FileText, CalendarClock, Bot, Play, Eye,
  ArrowUpRight, CheckCircle2, ShieldAlert, Zap, BarChart3,
} from "lucide-react";

const RISK_COLORS: Record<string, string> = {
  Low: "#10b981",
  Medium: "#f59e0b",
  High: "#ef4444",
};

const ENV_COLORS: Record<string, string> = {
  production: "#6366f1",
  staging: "#f59e0b",
  development: "#64748b",
};

function healthScoreOf(project: Project, latestByProject: Map<number, AuditRun>) {
  const latest = latestByProject.get(project.id);
  return latest?.overallScore ?? null;
}

function riskLevelOf(score: number | null): "Low" | "Medium" | "High" {
  if (score === null) return "Medium";
  if (score >= 85) return "Low";
  if (score >= 65) return "Medium";
  return "High";
}

export default function ExecutiveDashboard() {
  const [quickViewProject, setQuickViewProject] = useState<Project | null>(null);

  const { data: projects = [] } = useListProjects();
  const { data: audits = [] } = useListAudits({ limit: 500 });
  const { data: bugs = [] } = useListBugs();
  const { data: reports = [] } = useListReports();
  const { data: scheduledAudits = [] } = useListScheduledAudits();
  const { data: summary } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const { data: trends = [] } = useGetAuditTrends({ query: { queryKey: getGetAuditTrendsQueryKey() } });
  const { data: performance = [] } = useGetPerformanceHistory(undefined, { query: { queryKey: getGetPerformanceHistoryQueryKey() } });
  const { data: activity = [] } = useGetRecentActivity({ query: { queryKey: getGetRecentActivityQueryKey() } });

  // Latest audit per project, derived from the existing audits list (no new endpoints).
  const latestAuditByProject = useMemo(() => {
    const map = new Map<number, AuditRun>();
    for (const audit of audits) {
      if (audit.status !== "completed") continue;
      const existing = map.get(audit.projectId);
      if (!existing || new Date(audit.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
        map.set(audit.projectId, audit);
      }
    }
    return map;
  }, [audits]);

  const criticalBugsByProject = useMemo(() => {
    const map = new Map<number, number>();
    for (const bug of bugs) {
      if (bug.severity !== "critical" || bug.status === "resolved" || bug.status === "ignored") continue;
      map.set(bug.projectId, (map.get(bug.projectId) ?? 0) + 1);
    }
    return map;
  }, [bugs]);

  const projectHealth = useMemo(() => {
    return projects.map((project) => {
      const score = healthScoreOf(project, latestAuditByProject);
      return {
        project,
        score,
        risk: riskLevelOf(score),
        openBugs: project.openBugCount ?? 0,
        criticalBugs: criticalBugsByProject.get(project.id) ?? 0,
        lastAuditAt: project.lastAuditAt,
      };
    });
  }, [projects, latestAuditByProject, criticalBugsByProject]);

  const portfolioHealth = useMemo(() => {
    const scored = projectHealth.filter((p) => p.score !== null);
    if (scored.length === 0) return null;
    return Math.round(scored.reduce((sum, p) => sum + (p.score ?? 0), 0) / scored.length);
  }, [projectHealth]);

  const healthDistribution = useMemo(() => {
    const buckets = { Excellent: 0, Good: 0, Warning: 0, Critical: 0 };
    for (const { score } of projectHealth) {
      if (score === null) continue;
      if (score >= 90) buckets.Excellent++;
      else if (score >= 75) buckets.Good++;
      else if (score >= 55) buckets.Warning++;
      else buckets.Critical++;
    }
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [projectHealth]);

  const riskDistribution = useMemo(() => {
    const buckets = { Low: 0, Medium: 0, High: 0 };
    for (const { risk } of projectHealth) buckets[risk]++;
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [projectHealth]);

  const environmentDistribution = useMemo(() => {
    const buckets: Record<string, number> = { production: 0, staging: 0, development: 0 };
    for (const project of projects) buckets[project.environment] = (buckets[project.environment] ?? 0) + 1;
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [projects]);

  const completedAudits = useMemo(() => audits.filter((a) => a.status === "completed"), [audits]);
  const auditSuccessRate = audits.length > 0 ? Math.round((completedAudits.length / audits.length) * 100) : null;

  const openBugsTotal = useMemo(() => bugs.filter((b) => b.status !== "resolved" && b.status !== "ignored").length, [bugs]);
  const criticalIssuesTotal = summary?.criticalIssues ?? bugs.filter((b) => b.severity === "critical" && b.status !== "resolved" && b.status !== "ignored").length;

  // AI confidence: heuristic derived from data completeness/consistency (more completed audits + fewer criticals = higher confidence).
  const aiConfidenceScore = useMemo(() => {
    if (completedAudits.length === 0) return null;
    const base = 70;
    const completionBonus = Math.min(20, Math.round((completedAudits.length / Math.max(1, audits.length)) * 20));
    const criticalPenalty = Math.min(25, criticalIssuesTotal * 2);
    return Math.max(40, Math.min(99, base + completionBonus - criticalPenalty));
  }, [completedAudits.length, audits.length, criticalIssuesTotal]);

  const now = useMemo(() => new Date(), []);
  const sevenDaysAgo = useMemo(() => new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), [now]);

  const auditsThisWeek = useMemo(
    () => completedAudits.filter((a) => a.completedAt && new Date(a.completedAt) >= sevenDaysAgo).length,
    [completedAudits, sevenDaysAgo]
  );
  const reportsThisWeek = useMemo(
    () => reports.filter((r) => new Date(r.createdAt) >= sevenDaysAgo).length,
    [reports, sevenDaysAgo]
  );
  // Derived from the recent-activity feed (which records bug_resolved events) rather than Bug.createdAt,
  // since bugs have no dedicated "resolvedAt" timestamp.
  const bugsResolvedThisWeek = useMemo(
    () => activity.filter((a) => a.type === "bug_resolved" && new Date(a.createdAt) >= sevenDaysAgo).length,
    [activity, sevenDaysAgo]
  );
  const avgAuditDurationSec = useMemo(() => {
    const withDuration = completedAudits.filter((a) => a.durationMs);
    if (withDuration.length === 0) return null;
    return Math.round(withDuration.reduce((sum, a) => sum + (a.durationMs ?? 0), 0) / withDuration.length / 1000);
  }, [completedAudits]);
  // Estimated developer hours saved: heuristic based on resolved bugs and automated audits vs. manual QA effort.
  const hoursSaved = Math.round(bugsResolvedThisWeek * 0.75 + auditsThisWeek * 1.5);

  const topRiskyProjects = useMemo(() => {
    return [...projectHealth]
      .sort((a, b) => {
        const scoreA = a.score ?? 0;
        const scoreB = b.score ?? 0;
        if (a.criticalBugs !== b.criticalBugs) return b.criticalBugs - a.criticalBugs;
        return scoreA - scoreB;
      })
      .slice(0, 5);
  }, [projectHealth]);

  const priorityActions = useMemo(() => {
    return topRiskyProjects.slice(0, 4).map(({ project, score, criticalBugs, openBugs }) => {
      const impact = criticalBugs > 2 ? "High" : criticalBugs > 0 ? "Medium" : "Low";
      const effort = openBugs > 8 ? "High" : openBugs > 3 ? "Medium" : "Low";
      const expectedImprovement = Math.min(25, criticalBugs * 4 + Math.round(openBugs * 1.2));
      return {
        project,
        action: criticalBugs > 0
          ? `Resolve ${criticalBugs} critical issue${criticalBugs === 1 ? "" : "s"} in ${project.name}`
          : `Review ${openBugs} open bug${openBugs === 1 ? "" : "s"} in ${project.name}`,
        impact,
        effort,
        expectedImprovement,
        score,
      };
    });
  }, [topRiskyProjects]);

  const aiExecutiveSummary = useMemo(() => {
    const highestRisk = topRiskyProjects[0];
    const bestProject = [...projectHealth].filter(p => p.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
    const readiness = portfolioHealth === null ? "Unknown" : portfolioHealth >= 85 ? "Ready" : portfolioHealth >= 65 ? "Caution" : "Not Ready";
    return {
      overallHealth: portfolioHealth,
      readiness,
      highestRiskProject: highestRisk?.project.name ?? "None",
      bestProject: bestProject?.project.name ?? "None",
      summaryText:
        `Across ${projects.length} project${projects.length === 1 ? "" : "s"}, the portfolio is averaging a health score of ` +
        `${portfolioHealth ?? "N/A"}, with ${criticalIssuesTotal} critical issue${criticalIssuesTotal === 1 ? "" : "s"} open and ` +
        `${openBugsTotal} bug${openBugsTotal === 1 ? "" : "s"} awaiting resolution. ` +
        (highestRisk ? `${highestRisk.project.name} carries the most risk right now (score ${highestRisk.score ?? "N/A"}, ${highestRisk.criticalBugs} critical bugs) and should be prioritized. ` : "") +
        (bestProject ? `${bestProject.project.name} is performing best at a ${bestProject.score} health score. ` : "") +
        `Based on current trends, release readiness across the portfolio is assessed as ${readiness.toLowerCase()}.`,
      priorities: priorityActions.slice(0, 3).map((a) => a.action),
    };
  }, [portfolioHealth, topRiskyProjects, projectHealth, projects.length, criticalIssuesTotal, openBugsTotal, priorityActions]);

  const timelineItems = useMemo(() => {
    const items: { id: string; date: string; title: string; description: string; icon: "audit" | "report" | "bug" | "schedule"; severity?: string | null }[] = [];
    for (const item of activity) {
      items.push({
        id: `activity-${item.id}`,
        date: item.createdAt,
        title: item.title,
        description: item.description,
        icon: item.type.startsWith("bug") ? "bug" : "audit",
        severity: item.severity,
      });
    }
    for (const report of reports.slice(0, 5)) {
      items.push({
        id: `report-${report.id}`,
        date: report.createdAt,
        title: `Report generated`,
        description: `Report #${report.id} for audit #${report.auditRunId} (${report.status})`,
        icon: "report",
      });
    }
    for (const scheduled of scheduledAudits.slice(0, 5)) {
      if (!scheduled.nextRunAt) continue;
      items.push({
        id: `schedule-${scheduled.id}`,
        date: scheduled.nextRunAt,
        title: `Scheduled audit upcoming`,
        description: `${scheduled.name} — ${scheduled.projectName ?? "Project"} (${scheduled.frequency})`,
        icon: "schedule",
      });
    }
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
  }, [activity, reports, scheduledAudits]);

  const kpis = [
    { label: "Portfolio Health", value: portfolioHealth !== null ? `${portfolioHealth}` : "-", icon: Gauge, color: "text-indigo-600" },
    { label: "Total Projects", value: projects.length, icon: Folder, color: "text-slate-900" },
    { label: "Total Audits", value: summary?.totalAudits ?? audits.length, icon: Activity, color: "text-slate-900" },
    { label: "Critical Issues", value: criticalIssuesTotal, icon: AlertTriangle, color: "text-red-600" },
    { label: "Avg Health Score", value: portfolioHealth !== null ? `${portfolioHealth}` : "-", icon: TrendingUp, color: "text-emerald-600" },
    { label: "Audit Success Rate", value: auditSuccessRate !== null ? `${auditSuccessRate}%` : "-", icon: CheckCircle2, color: "text-emerald-600" },
    { label: "Total Open Bugs", value: openBugsTotal, icon: Bug, color: "text-orange-600" },
    { label: "AI Confidence Score", value: aiConfidenceScore !== null ? `${aiConfidenceScore}%` : "-", icon: Sparkles, color: "text-violet-600" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Executive Dashboard</h1>
          <p className="text-slate-500 mt-1">Portfolio-wide health, risk, and productivity overview.</p>
        </div>
        <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-700 bg-indigo-50">
          Updated {format(now, "MMM d, h:mm a")}
        </Badge>
      </div>

      {/* 1. Executive KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.03, ease: "easeOut" }}
          >
            <Card className="shadow-sm border-slate-200 h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-slate-600">{kpi.label}</CardTitle>
                <kpi.icon className={cn("h-4 w-4", kpi.color)} />
              </CardHeader>
              <CardContent>
                <div className={cn("text-2xl font-bold", kpi.color)}>{kpi.value}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* 2. Portfolio Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="shadow-sm border-slate-200">
          <CardHeader><CardTitle className="text-base">Health Distribution</CardTitle></CardHeader>
          <CardContent>
            <motion.div className="h-[220px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
              {healthDistribution.some((d) => d.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={healthDistribution} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2} dataKey="value" nameKey="name">
                      {healthDistribution.map((entry, index) => (
                        <Cell key={index} fill={["#10b981", "#6366f1", "#f59e0b", "#ef4444"][index % 4]} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                    <Legend verticalAlign="bottom" height={30} formatter={(v) => <span className="text-xs text-slate-600">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="h-full flex items-center justify-center text-slate-400 text-sm">No data available</div>}
            </motion.div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader><CardTitle className="text-base">Risk Distribution</CardTitle></CardHeader>
          <CardContent>
            <motion.div className="h-[220px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.05 }}>
              {riskDistribution.some((d) => d.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={riskDistribution} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2} dataKey="value" nameKey="name">
                      {riskDistribution.map((entry, index) => (
                        <Cell key={index} fill={RISK_COLORS[entry.name] ?? "#cbd5e1"} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                    <Legend verticalAlign="bottom" height={30} formatter={(v) => <span className="text-xs text-slate-600">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="h-full flex items-center justify-center text-slate-400 text-sm">No data available</div>}
            </motion.div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader><CardTitle className="text-base">Environment Distribution</CardTitle></CardHeader>
          <CardContent>
            <motion.div className="h-[220px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.1 }}>
              {environmentDistribution.some((d) => d.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={environmentDistribution} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2} dataKey="value" nameKey="name">
                      {environmentDistribution.map((entry, index) => (
                        <Cell key={index} fill={ENV_COLORS[entry.name] ?? "#cbd5e1"} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                    <Legend verticalAlign="bottom" height={30} formatter={(v) => <span className="text-xs text-slate-600 capitalize">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="h-full flex items-center justify-center text-slate-400 text-sm">No data available</div>}
            </motion.div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-slate-200">
          <CardHeader><CardTitle className="text-base">Audit Trend (30 Days)</CardTitle></CardHeader>
          <CardContent>
            <motion.div className="h-[260px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
              {trends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="execColorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tickFormatter={(v) => format(new Date(v), "MMM d")} tick={{ fontSize: 12, fill: "#64748b" }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748b" }} dx={-10} />
                    <RechartsTooltip contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} labelFormatter={(v) => format(new Date(v), "MMM d, yyyy")} />
                    <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#execColorCount)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <div className="h-full flex items-center justify-center text-slate-400 text-sm">No data available</div>}
            </motion.div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader><CardTitle className="text-base">Performance / Accessibility / SEO / Best Practices</CardTitle></CardHeader>
          <CardContent>
            <motion.div className="h-[260px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.05 }}>
              {performance.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performance} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tickFormatter={(v) => format(new Date(v), "MMM d")} tick={{ fontSize: 12, fill: "#64748b" }} dy={10} />
                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748b" }} dx={-10} />
                    <RechartsTooltip contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} labelFormatter={(v) => format(new Date(v), "MMM d, yyyy")} />
                    <Legend verticalAlign="bottom" height={30} iconType="circle" />
                    <Line type="monotone" dataKey="performance" name="Performance" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="accessibility" name="Accessibility" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="seo" name="SEO" stroke="#10b981" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="bestPractices" name="Best Practices" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <div className="h-full flex items-center justify-center text-slate-400 text-sm">No data available</div>}
            </motion.div>
          </CardContent>
        </Card>
      </div>

      {/* 4. AI Executive Summary */}
      <Card className="border-violet-200 bg-gradient-to-br from-violet-50/80 to-purple-50/30 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-violet-600 flex items-center justify-center shadow-md">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base text-violet-900">AI Executive Summary</CardTitle>
                <Badge className="bg-violet-600 text-white text-[10px]">AI</Badge>
              </div>
              <CardDescription className="text-violet-600/70">Generated from current portfolio data</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl bg-white/80 border border-violet-100 p-4">
            <p className="text-sm text-foreground leading-relaxed">{aiExecutiveSummary.summaryText}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/80 border border-violet-100 p-3">
              <p className="text-[10px] font-semibold text-violet-700 uppercase tracking-wide mb-1">Highest-Risk Project</p>
              <p className="text-sm font-medium">{aiExecutiveSummary.highestRiskProject}</p>
            </div>
            <div className="rounded-xl bg-white/80 border border-violet-100 p-3">
              <p className="text-[10px] font-semibold text-violet-700 uppercase tracking-wide mb-1">Biggest Improvement</p>
              <p className="text-sm font-medium">{aiExecutiveSummary.bestProject}</p>
            </div>
          </div>
          {aiExecutiveSummary.priorities.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-violet-700 uppercase tracking-wider mb-2">Recommended Priorities</p>
              <ul className="space-y-1.5">
                {aiExecutiveSummary.priorities.map((p, i) => (
                  <li key={i} className="text-xs flex items-start gap-1.5 text-foreground/80">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-violet-500 flex-shrink-0" />{p}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className={cn("rounded-xl border p-3 flex items-center gap-2 text-sm font-semibold", {
            "bg-emerald-50 border-emerald-200 text-emerald-700": aiExecutiveSummary.readiness === "Ready",
            "bg-amber-50 border-amber-200 text-amber-700": aiExecutiveSummary.readiness === "Caution",
            "bg-red-50 border-red-200 text-red-700": aiExecutiveSummary.readiness === "Not Ready",
            "bg-slate-50 border-slate-200 text-slate-600": aiExecutiveSummary.readiness === "Unknown",
          })}>
            <ShieldAlert className="h-4 w-4" /> Release Readiness: {aiExecutiveSummary.readiness}
          </div>
        </CardContent>
      </Card>

      {/* 5. Top Risky Projects */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" /> Top Risky Projects</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {topRiskyProjects.length === 0 && <div className="text-sm text-slate-400 py-4 text-center">No projects available</div>}
          {topRiskyProjects.map(({ project, score, openBugs, criticalBugs, lastAuditAt, risk }, i) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
              className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-3 flex-wrap"
            >
              <div className="min-w-[140px]">
                <p className="font-medium text-slate-900">{project.name}</p>
                <Badge variant="outline" className={cn("text-[10px] mt-1", {
                  "text-emerald-700 border-emerald-200 bg-emerald-50": risk === "Low",
                  "text-amber-700 border-amber-200 bg-amber-50": risk === "Medium",
                  "text-red-700 border-red-200 bg-red-50": risk === "High",
                })}>{risk} Risk</Badge>
              </div>
              <div className="flex items-center gap-6 text-sm text-slate-600 flex-wrap">
                <div className="text-center w-20">
                  <div className="font-bold text-slate-900">{score ?? "—"}</div>
                  <div className="text-[10px] text-slate-400">Health</div>
                </div>
                <div className="text-center w-20">
                  <div className="font-bold text-orange-600">{openBugs}</div>
                  <div className="text-[10px] text-slate-400">Open Bugs</div>
                </div>
                <div className="text-center w-20">
                  <div className="font-bold text-red-600">{criticalBugs}</div>
                  <div className="text-[10px] text-slate-400">Critical</div>
                </div>
                <div className="text-center w-28">
                  <div className="font-medium text-slate-700 text-xs">{lastAuditAt ? format(new Date(lastAuditAt), "MMM d, yyyy") : "Never"}</div>
                  <div className="text-[10px] text-slate-400">Last Audit</div>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setQuickViewProject(project)}>
                <Eye className="mr-1.5 h-3.5 w-3.5" /> Quick View
              </Button>
            </motion.div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 6. Team Productivity */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-indigo-500" /> Team Productivity</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-100 p-3">
              <div className="text-xl font-bold text-slate-900">{auditsThisWeek}</div>
              <p className="text-[11px] text-slate-500">Audits Completed This Week</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <div className="text-xl font-bold text-slate-900">{reportsThisWeek}</div>
              <p className="text-[11px] text-slate-500">Reports Generated</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <div className="text-xl font-bold text-slate-900">{bugsResolvedThisWeek}</div>
              <p className="text-[11px] text-slate-500">Bugs Resolved</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <div className="text-xl font-bold text-slate-900">{avgAuditDurationSec !== null ? `${avgAuditDurationSec}s` : "—"}</div>
              <p className="text-[11px] text-slate-500">Avg Audit Duration</p>
            </div>
            <div className="col-span-2 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 flex items-center justify-between">
              <div>
                <div className="text-xl font-bold text-indigo-700">{hoursSaved} hrs</div>
                <p className="text-[11px] text-indigo-600/70">Estimated developer hours saved this week</p>
              </div>
              <Zap className="h-6 w-6 text-indigo-400" />
            </div>
          </CardContent>
        </Card>

        {/* 7. Priority Actions */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-emerald-500" /> Priority Actions</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {priorityActions.length === 0 && <div className="text-sm text-slate-400 py-4 text-center">No priority actions right now</div>}
            {priorityActions.map((action, i) => (
              <div key={i} className="rounded-lg border border-slate-100 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">{action.action}</p>
                  <Badge variant="outline" className={cn("text-[10px] flex-shrink-0", {
                    "text-red-700 border-red-200 bg-red-50": action.impact === "High",
                    "text-amber-700 border-amber-200 bg-amber-50": action.impact === "Medium",
                    "text-emerald-700 border-emerald-200 bg-emerald-50": action.impact === "Low",
                  })}>{action.impact} Impact</Badge>
                </div>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500">
                  <span>Effort: <span className="font-medium text-slate-700">{action.effort}</span></span>
                  <span className="flex items-center gap-1"><ArrowUpRight className="h-3 w-3 text-emerald-500" /> +{action.expectedImprovement} pts expected</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 8. Recent Activity Timeline */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4 text-slate-500" /> Recent Activity Timeline</CardTitle></CardHeader>
        <CardContent>
          {timelineItems.length === 0 ? (
            <div className="text-sm text-slate-400 py-4 text-center">No recent activity</div>
          ) : (
            <div className="space-y-5">
              {timelineItems.map((item, i) => (
                <div key={item.id} className="flex gap-4 relative">
                  {i !== timelineItems.length - 1 && (
                    <div className="absolute left-[11px] top-8 bottom-[-20px] w-[2px] bg-slate-100" />
                  )}
                  <div className="flex-shrink-0 mt-1">
                    {item.icon === "bug" && <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center"><Bug className="w-3 h-3 text-red-600" /></div>}
                    {item.icon === "audit" && <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center"><Activity className="w-3 h-3 text-indigo-600" /></div>}
                    {item.icon === "report" && <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center"><FileText className="w-3 h-3 text-blue-600" /></div>}
                    {item.icon === "schedule" && <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center"><CalendarClock className="w-3 h-3 text-purple-600" /></div>}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{item.title}</p>
                    <p className="text-sm text-slate-500 mt-0.5">{item.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-400">{format(new Date(item.date), "MMM d, h:mm a")}</span>
                      {item.severity && <SeverityBadge severity={item.severity} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 9. Quick Actions */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-slate-500" /> Quick Actions</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href="/projects"><Button><Play className="mr-2 h-4 w-4" /> Run New Audit</Button></Link>
          <Link href="/projects"><Button variant="outline"><Folder className="mr-2 h-4 w-4" /> View Projects</Button></Link>
          <Link href="/reports"><Button variant="outline"><FileText className="mr-2 h-4 w-4" /> View Reports</Button></Link>
          <Link href="/bugs"><Button variant="outline"><Bug className="mr-2 h-4 w-4" /> Open Bug Tracker</Button></Link>
          <Link href="/audits"><Button variant="outline"><Bot className="mr-2 h-4 w-4" /> Open AI Copilot</Button></Link>
        </CardContent>
      </Card>

      {/* Quick View Dialog */}
      <Dialog open={!!quickViewProject} onOpenChange={(open) => !open && setQuickViewProject(null)}>
        <DialogContent className="sm:max-w-md">
          {quickViewProject && (() => {
            const health = projectHealth.find((p) => p.project.id === quickViewProject.id);
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{quickViewProject.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Environment</span>
                    <Badge variant="outline" className="capitalize">{quickViewProject.environment}</Badge>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-500">Health Score</span>
                      <span className="font-semibold">{health?.score ?? "—"}</span>
                    </div>
                    <Progress value={health?.score ?? 0} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg border border-slate-100 p-2.5">
                      <div className="font-bold text-orange-600">{health?.openBugs ?? 0}</div>
                      <div className="text-[11px] text-slate-400">Open Bugs</div>
                    </div>
                    <div className="rounded-lg border border-slate-100 p-2.5">
                      <div className="font-bold text-red-600">{health?.criticalBugs ?? 0}</div>
                      <div className="text-[11px] text-slate-400">Critical Issues</div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">
                    Last audit: {quickViewProject.lastAuditAt ? format(new Date(quickViewProject.lastAuditAt), "MMM d, yyyy") : "Never"}
                  </p>
                  <Link href={`/projects/${quickViewProject.id}`}>
                    <Button className="w-full" onClick={() => setQuickViewProject(null)}>View Full Project</Button>
                  </Link>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
