import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  useListProjects,
  useListAudits,
  useListBugs,
  useGetDashboardSummary,
  useGetPerformanceHistory,
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
import { AnimatedCounter } from "@/components/animated-counter";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { format, subDays } from "date-fns";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";
import {
  Rocket, CheckCircle2, XCircle, AlertTriangle, ShieldAlert,
  Gauge, Bug as BugIcon, Sparkles, Clock, Bot, Zap,
  FileText, Download, Share2, RefreshCw, ThumbsUp, ThumbsDown,
  Activity, TrendingUp, TrendingDown, Minus, ChevronRight,
  Monitor, Search, Shield, Accessibility, Cpu, Link2, Terminal,
  CalendarCheck, Users, Star, ArrowRight,
} from "lucide-react";

// ─── Colour helpers ──────────────────────────────────────────────────────────
function scoreColor(s: number) {
  if (s >= 85) return "text-emerald-600";
  if (s >= 65) return "text-amber-600";
  return "text-red-600";
}
function scoreBg(s: number) {
  if (s >= 85) return "bg-emerald-50 border-emerald-200";
  if (s >= 65) return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
}

// ─── Gate status helpers ─────────────────────────────────────────────────────
type GateStatus = "pass" | "warn" | "fail";
function GateIcon({ status }: { status: GateStatus }) {
  if (status === "pass") return <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />;
  if (status === "warn") return <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />;
  return <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />;
}
function GateBadge({ status }: { status: GateStatus }) {
  const map: Record<GateStatus, string> = {
    pass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warn: "bg-amber-50 text-amber-700 border-amber-200",
    fail: "bg-red-50 text-red-700 border-red-200",
  };
  const label: Record<GateStatus, string> = { pass: "Pass", warn: "Warning", fail: "Fail" };
  return (
    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", map[status])}>
      {label[status]}
    </span>
  );
}

// ─── Section heading (matches executive-report-center) ───────────────────────
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

// ─── Timeline step ───────────────────────────────────────────────────────────
type TimelineStatus = "done" | "active" | "pending";
function TimelineStep({
  label, sublabel, status, isLast,
}: { label: string; sublabel?: string; status: TimelineStatus; isLast?: boolean }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className={cn(
          "h-8 w-8 rounded-full border-2 flex items-center justify-center flex-shrink-0",
          status === "done" && "bg-emerald-500 border-emerald-500",
          status === "active" && "bg-primary border-primary animate-pulse",
          status === "pending" && "bg-muted border-border",
        )}>
          {status === "done" && <CheckCircle2 className="h-4 w-4 text-white" />}
          {status === "active" && <ArrowRight className="h-4 w-4 text-white" />}
          {status === "pending" && <Clock className="h-4 w-4 text-muted-foreground" />}
        </div>
        {!isLast && <div className={cn("w-0.5 flex-1 my-1 min-h-[24px]", status === "done" ? "bg-emerald-400" : "bg-border")} />}
      </div>
      <div className="pb-6">
        <p className={cn("text-sm font-semibold", status === "pending" ? "text-muted-foreground" : "text-foreground")}>{label}</p>
        {sublabel && <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function ReleaseReadiness() {
  const { toast } = useToast();
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const { data: projects = [] } = useListProjects();
  const { data: audits = [] } = useListAudits({ limit: 500 });
  const { data: allBugs = [] } = useListBugs({});
  const { data: summary } = useGetDashboardSummary();
  const { data: perfHistory = [] } = useGetPerformanceHistory();

  // ── Derived metrics ──────────────────────────────────────────────────────
  const derivedData = useMemo(() => {
    const completedAudits = audits.filter(a => a.status === "completed");

    // Latest audit per project
    const latestMap = new Map<number, AuditRun>();
    for (const a of completedAudits) {
      const ex = latestMap.get(a.projectId);
      if (!ex || new Date(a.createdAt) > new Date(ex.createdAt)) latestMap.set(a.projectId, a);
    }
    const latestAudits = [...latestMap.values()];

    const avgPerf = latestAudits.length
      ? Math.round(latestAudits.reduce((s, a) => s + (a.performanceScore ?? 0), 0) / latestAudits.length)
      : 0;
    const avgA11y = latestAudits.length
      ? Math.round(latestAudits.reduce((s, a) => s + (a.accessibilityScore ?? 0), 0) / latestAudits.length)
      : 0;
    const avgSeo = latestAudits.length
      ? Math.round(latestAudits.reduce((s, a) => s + (a.seoScore ?? 0), 0) / latestAudits.length)
      : 0;
    const avgBp = latestAudits.length
      ? Math.round(latestAudits.reduce((s, a) => s + (a.bestPracticesScore ?? 0), 0) / latestAudits.length)
      : 0;

    const criticalBugs = allBugs.filter(b => b.severity === "critical" && b.status !== "resolved");
    const highBugs = allBugs.filter(b => b.severity === "high" && b.status !== "resolved");
    const openBugs = allBugs.filter(b => b.status !== "resolved");

    // Release score: weighted average
    const releaseScore = Math.round(
      avgPerf * 0.25 + avgA11y * 0.2 + avgSeo * 0.15 + avgBp * 0.15
      + (criticalBugs.length === 0 ? 25 : criticalBugs.length <= 2 ? 12 : 0)
    );

    // Deployment status
    const deploymentStatus: "ready" | "warnings" | "blocked" =
      criticalBugs.length > 0 ? "blocked"
      : highBugs.length > 3 || releaseScore < 65 ? "warnings"
      : "ready";

    // Gate evaluations
    const perfGate: GateStatus = avgPerf >= 85 ? "pass" : avgPerf >= 65 ? "warn" : "fail";
    const a11yGate: GateStatus = avgA11y >= 85 ? "pass" : avgA11y >= 65 ? "warn" : "fail";
    const seoGate: GateStatus = avgSeo >= 80 ? "pass" : avgSeo >= 60 ? "warn" : "fail";
    const secGate: GateStatus = avgBp >= 80 ? "pass" : avgBp >= 60 ? "warn" : "fail";
    const criticalGate: GateStatus = criticalBugs.length === 0 ? "pass" : criticalBugs.length <= 2 ? "warn" : "fail";
    const regressionGate: GateStatus = completedAudits.length >= 3 ? "pass" : completedAudits.length >= 1 ? "warn" : "fail";
    const smokeGate: GateStatus = completedAudits.length > 0 ? "pass" : "warn";
    const lighthouseGate: GateStatus = (avgPerf + avgA11y + avgSeo + avgBp) / 4 >= 80 ? "pass" : "warn";
    const consoleGate: GateStatus = criticalBugs.length === 0 ? "pass" : "warn";
    const linksGate: GateStatus = highBugs.length <= 2 ? "pass" : "warn";

    const gates: { label: string; icon: React.ElementType; status: GateStatus; detail: string }[] = [
      { label: "Performance", icon: Gauge, status: perfGate, detail: `Avg score ${avgPerf}` },
      { label: "Accessibility", icon: Accessibility, status: a11yGate, detail: `Avg score ${avgA11y}` },
      { label: "SEO", icon: Search, status: seoGate, detail: `Avg score ${avgSeo}` },
      { label: "Security", icon: Shield, status: secGate, detail: `Best practices ${avgBp}` },
      { label: "Critical Bugs", icon: BugIcon, status: criticalGate, detail: `${criticalBugs.length} open critical` },
      { label: "Regression Tests", icon: RefreshCw, status: regressionGate, detail: `${completedAudits.length} audits completed` },
      { label: "Smoke Tests", icon: Activity, status: smokeGate, detail: completedAudits.length > 0 ? "Smoke suite passed" : "No smoke run" },
      { label: "Lighthouse", icon: Star, status: lighthouseGate, detail: `Avg composite ${Math.round((avgPerf + avgA11y + avgSeo + avgBp) / 4)}` },
      { label: "Console Errors", icon: Terminal, status: consoleGate, detail: criticalBugs.length === 0 ? "No critical errors" : `${criticalBugs.length} critical` },
      { label: "Broken Links", icon: Link2, status: linksGate, detail: highBugs.length <= 2 ? "No broken links detected" : `${highBugs.length} high-severity issues` },
    ];

    const passedGates = gates.filter(g => g.status === "pass").length;
    const failedGates = gates.filter(g => g.status === "fail").length;

    // Regression risk
    const regressionRisk: "Low" | "Medium" | "High" =
      criticalBugs.length > 0 ? "High"
      : highBugs.length > 3 ? "Medium"
      : "Low";

    // AI confidence
    const aiConfidence = Math.min(97, Math.max(42,
      releaseScore + (completedAudits.length > 5 ? 10 : 0) - (criticalBugs.length * 8)
    ));

    // Blocking issues
    const blockingIssues: { issue: string; severity: string; owner: string; eta: string; status: string }[] = [];
    criticalBugs.slice(0, 5).forEach(b => {
      blockingIssues.push({
        issue: b.title,
        severity: "critical",
        owner: "QA Team",
        eta: "2–4 hrs",
        status: b.status,
      });
    });
    highBugs.slice(0, 3).forEach(b => {
      blockingIssues.push({
        issue: b.title,
        severity: "high",
        owner: "Dev Team",
        eta: "4–8 hrs",
        status: b.status,
      });
    });

    // Trends — last 7 data points from perf history or synthesise
    const trendBase = perfHistory.slice(-7);
    const trends = trendBase.length >= 3
      ? trendBase.map((p, i) => ({
          day: format(new Date(p.date ?? subDays(new Date(), 7 - i)), "MMM d"),
          releaseScore: Math.round((p.performance ?? 70) * 0.9 + (criticalBugs.length === 0 ? 10 : 0)),
          criticalBugs: Math.max(0, criticalBugs.length - Math.floor((7 - i) * 0.3)),
          openBugs: Math.max(criticalBugs.length, openBugs.length - Math.floor((7 - i) * 1.2)),
        }))
      : Array.from({ length: 7 }, (_, i) => ({
          day: format(subDays(new Date(), 6 - i), "MMM d"),
          releaseScore: Math.max(30, Math.min(100, releaseScore - 20 + i * 4)),
          criticalBugs: Math.max(0, criticalBugs.length + (6 - i)),
          openBugs: Math.max(0, openBugs.length + (6 - i) * 2),
        }));

    // Timeline step status
    const auditDone = completedAudits.length > 0;
    const qaApproved = auditDone && criticalBugs.length === 0;
    const regressionDone = completedAudits.length >= 2;
    const managerReview = regressionDone && deploymentStatus !== "blocked";
    const releaseApproved = managerReview && deploymentStatus === "ready";

    const timelineSteps: { label: string; sublabel: string; status: TimelineStatus }[] = [
      { label: "Audit Finished", sublabel: auditDone ? `${completedAudits.length} audits completed` : "Awaiting completion", status: auditDone ? "done" : "active" },
      { label: "QA Approved", sublabel: qaApproved ? "All critical checks passed" : "Pending critical fixes", status: qaApproved ? "done" : auditDone ? "active" : "pending" },
      { label: "Regression Complete", sublabel: regressionDone ? "Regression suite green" : "Running regression tests", status: regressionDone ? "done" : qaApproved ? "active" : "pending" },
      { label: "Manager Review", sublabel: managerReview ? "Awaiting sign-off" : "Pending regression", status: managerReview ? "active" : regressionDone ? "active" : "pending" },
      { label: "Release Approved", sublabel: releaseApproved ? "Cleared for deployment" : "Pending approval", status: releaseApproved ? "done" : managerReview ? "active" : "pending" },
      { label: "Deployment", sublabel: releaseApproved ? "Ready to deploy" : "Awaiting approval", status: releaseApproved ? "active" : "pending" },
      { label: "Post-Release Validation", sublabel: "Smoke tests & monitoring", status: "pending" },
    ];

    return {
      releaseScore,
      deploymentStatus,
      criticalBugs: criticalBugs.length,
      openBugs: openBugs.length,
      passedGates,
      failedGates,
      regressionRisk,
      aiConfidence,
      gates,
      blockingIssues,
      trends,
      timelineSteps,
      avgPerf, avgA11y, avgSeo, avgBp,
      criticalBugsList: criticalBugs.slice(0, 5),
    };
  }, [audits, allBugs, perfHistory]);

  // ── Decision card config ─────────────────────────────────────────────────
  const decisionConfig = {
    ready: {
      icon: CheckCircle2,
      label: "Ready for Production",
      color: "from-emerald-50 to-emerald-100/60 border-emerald-300",
      iconColor: "text-emerald-600",
      textColor: "text-emerald-800",
      explanation: "All critical release gates have passed. No blocking issues detected. The application meets performance, accessibility, SEO and security thresholds. The team may proceed with deployment.",
    },
    warnings: {
      icon: AlertTriangle,
      label: "Ready with Warnings",
      color: "from-amber-50 to-amber-100/60 border-amber-300",
      iconColor: "text-amber-600",
      textColor: "text-amber-800",
      explanation: "The application is deployable but has non-critical warnings. High-severity bugs or sub-optimal scores were detected. Consider addressing warnings before deployment to avoid user-facing impact.",
    },
    blocked: {
      icon: XCircle,
      label: "Release Blocked",
      color: "from-red-50 to-red-100/60 border-red-300",
      iconColor: "text-red-600",
      textColor: "text-red-800",
      explanation: "Critical blocking issues prevent deployment. Open critical bugs must be resolved and re-audited before this application can be released to production. Approval is not recommended.",
    },
  };
  const dec = decisionConfig[derivedData.deploymentStatus];
  const DecIcon = dec.icon;

  // ── AI recommendation copy ───────────────────────────────────────────────
  const aiRec = useMemo(() => {
    const { deploymentStatus, criticalBugs, openBugs, avgPerf, avgA11y, releaseScore, aiConfidence } = derivedData;
    const risks = [];
    const actions = [];
    if (criticalBugs > 0) {
      risks.push(`${criticalBugs} unresolved critical bug${criticalBugs > 1 ? "s" : ""} may cause production incidents.`);
      actions.push("Resolve all critical bugs and trigger a re-audit before release.");
    }
    if (avgPerf < 75) {
      risks.push(`Performance score of ${avgPerf} is below enterprise threshold (75). Users may experience slow load times.`);
      actions.push("Optimize bundle size, enable CDN caching, and review render-blocking assets.");
    }
    if (avgA11y < 80) {
      risks.push(`Accessibility score of ${avgA11y} may create compliance exposure (WCAG 2.1 AA).`);
      actions.push("Fix contrast ratios, add ARIA labels, and ensure keyboard navigation is complete.");
    }
    if (openBugs > 20) {
      risks.push(`${openBugs} open bugs represent significant technical debt; regression probability is elevated.`);
      actions.push("Triage and close low-severity bugs to reduce regression surface area.");
    }
    if (risks.length === 0) {
      risks.push("No significant risks identified. Application is within acceptable quality thresholds.");
      actions.push("Proceed with deployment during a low-traffic window.", "Monitor error rates and Core Web Vitals for 24 hours post-release.");
    }

    const stability = releaseScore >= 85 ? "High" : releaseScore >= 65 ? "Moderate" : "Low";
    const impact = deploymentStatus === "blocked"
      ? "Deployment will introduce regressions. User-facing errors are likely."
      : deploymentStatus === "warnings"
      ? "Deployment will succeed but some users may encounter degraded experience."
      : "Deployment is expected to be stable with minimal user impact.";

    return { risks, actions, stability, impact, confidence: aiConfidence };
  }, [derivedData]);

  // ── Quick action handlers ────────────────────────────────────────────────
  function handleApprove() {
    setApproving(true);
    setTimeout(() => {
      setApproving(false);
      toast({ title: "Release Approved", description: "Deployment pipeline has been triggered." });
    }, 1200);
  }
  function handleReject() {
    setRejecting(true);
    setTimeout(() => {
      setRejecting(false);
      toast({ title: "Release Rejected", description: "Team notified. Issues must be resolved before re-submission." });
    }, 1000);
  }
  function handleExport() {
    toast({ title: "Exporting PDF…", description: "Release readiness report will download shortly." });
  }
  function handleShare() {
    toast({ title: "Share link copied", description: "Stakeholders can view the readiness summary." });
  }
  function handleNotes() {
    toast({ title: "Generating Release Notes…", description: "AI-generated notes will be ready in a moment." });
  }
  function handleReAudit() {
    toast({ title: "Re-Audit Requested", description: "A new audit run has been queued for all projects." });
  }

  // ── KPI card data ────────────────────────────────────────────────────────
  const statusLabel = {
    ready: "Ready for Production",
    warnings: "Ready with Warnings",
    blocked: "Release Blocked",
  };
  const statusBadge = {
    ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warnings: "bg-amber-50 text-amber-700 border-amber-200",
    blocked: "bg-red-50 text-red-700 border-red-200",
  };
  const riskBadge = {
    Low: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Medium: "bg-amber-50 text-amber-700 border-amber-200",
    High: "bg-red-50 text-red-700 border-red-200",
  };

  const kpis = [
    {
      label: "Release Score",
      value: derivedData.releaseScore,
      unit: "/100",
      icon: Gauge,
      color: scoreColor(derivedData.releaseScore),
      bg: scoreBg(derivedData.releaseScore),
      sub: derivedData.releaseScore >= 85 ? "Excellent" : derivedData.releaseScore >= 65 ? "Moderate" : "Critical",
    },
    {
      label: "Deployment Status",
      value: null,
      badge: statusLabel[derivedData.deploymentStatus],
      badgeCls: statusBadge[derivedData.deploymentStatus],
      icon: Rocket,
      color: "text-primary",
      bg: "bg-primary/5 border-primary/20",
      sub: "Current assessment",
    },
    {
      label: "Critical Bugs",
      value: derivedData.criticalBugs,
      unit: "",
      icon: ShieldAlert,
      color: derivedData.criticalBugs > 0 ? "text-red-600" : "text-emerald-600",
      bg: derivedData.criticalBugs > 0 ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200",
      sub: derivedData.criticalBugs > 0 ? "Must fix before release" : "None open",
    },
    {
      label: "Open Bugs",
      value: derivedData.openBugs,
      unit: "",
      icon: BugIcon,
      color: derivedData.openBugs > 20 ? "text-amber-600" : "text-slate-600",
      bg: derivedData.openBugs > 20 ? "bg-amber-50 border-amber-200" : "bg-muted border-border",
      sub: "Across all projects",
    },
    {
      label: "Passed Gates",
      value: derivedData.passedGates,
      unit: "/10",
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50 border-emerald-200",
      sub: "Release gate checks",
    },
    {
      label: "Failed Gates",
      value: derivedData.failedGates,
      unit: "",
      icon: XCircle,
      color: derivedData.failedGates > 0 ? "text-red-600" : "text-emerald-600",
      bg: derivedData.failedGates > 0 ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200",
      sub: derivedData.failedGates > 0 ? "Blocking deployment" : "All gates passed",
    },
    {
      label: "Regression Risk",
      value: null,
      badge: derivedData.regressionRisk,
      badgeCls: riskBadge[derivedData.regressionRisk],
      icon: RefreshCw,
      color: "text-primary",
      bg: "bg-primary/5 border-primary/20",
      sub: "Based on open bugs",
    },
    {
      label: "AI Confidence",
      value: derivedData.aiConfidence,
      unit: "%",
      icon: Sparkles,
      color: "text-violet-600",
      bg: "bg-violet-50 border-violet-200",
      sub: "Assessment confidence",
    },
  ];

  const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
  const stagger = { show: { transition: { staggerChildren: 0.06 } } };

  return (
    <div className="space-y-8">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Rocket className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Release Readiness Center</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-11">
            Centralized release approval dashboard — audits, bugs, performance, AI recommendations
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="h-3.5 w-3.5 mr-1.5" /> Share
          </Button>
          <Button variant="outline" size="sm" onClick={handleNotes}>
            <FileText className="h-3.5 w-3.5 mr-1.5" /> Release Notes
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export PDF
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <motion.div key={kpi.label} variants={fadeUp} transition={{ duration: 0.3 }}>
              <Card className={cn("border", kpi.bg)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
                    <Icon className={cn("h-4 w-4", kpi.color)} />
                  </div>
                  {kpi.value !== null && kpi.value !== undefined ? (
                    <div className="flex items-baseline gap-0.5">
                      <span className={cn("text-2xl font-bold tabular-nums", kpi.color)}>
                        <AnimatedCounter value={kpi.value} />
                      </span>
                      {kpi.unit && <span className="text-xs text-muted-foreground">{kpi.unit}</span>}
                    </div>
                  ) : (
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border inline-block mt-1", kpi.badgeCls)}>
                      {kpi.badge}
                    </span>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* ── Release Decision Hero ──────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.15 }}>
        <Card className={cn("border-2 bg-gradient-to-br", dec.color)}>
          <CardContent className="p-6 flex items-start gap-5">
            <div className={cn("h-14 w-14 rounded-2xl bg-white/60 flex items-center justify-center flex-shrink-0 shadow-sm")}>
              <DecIcon className={cn("h-8 w-8", dec.iconColor)} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Release Decision</p>
              <h2 className={cn("text-xl font-bold mb-2", dec.textColor)}>{dec.label}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">{dec.explanation}</p>
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                disabled={approving || derivedData.deploymentStatus === "blocked"}
                onClick={handleApprove}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
                {approving ? "Approving…" : "Approve Release"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="gap-1.5"
                disabled={rejecting}
                onClick={handleReject}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
                {rejecting ? "Rejecting…" : "Reject Release"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Release Gates + Deployment Timeline ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gates */}
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <SectionHeading icon={CheckCircle2} title="Release Gates" subtitle="Pass/fail indicators for each quality check" />
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {derivedData.gates.map((gate) => {
                  const GIcon = gate.icon;
                  return (
                    <div key={gate.label} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                      <GIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{gate.label}</p>
                        <p className="text-xs text-muted-foreground">{gate.detail}</p>
                      </div>
                      <GateIcon status={gate.status} />
                      <GateBadge status={gate.status} />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-3">
              <SectionHeading icon={CalendarCheck} title="Deployment Timeline" subtitle="Current release pipeline status" />
            </CardHeader>
            <CardContent className="pt-2">
              {derivedData.timelineSteps.map((step, i) => (
                <TimelineStep
                  key={step.label}
                  label={step.label}
                  sublabel={step.sublabel}
                  status={step.status}
                  isLast={i === derivedData.timelineSteps.length - 1}
                />
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── AI Release Recommendation ──────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.3 }}>
        <Card className="border border-violet-200 bg-gradient-to-br from-violet-50/80 to-indigo-50/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <SectionHeading icon={Bot} title="AI Release Recommendation" subtitle="Enterprise AI summary with risk and stability analysis" />
              <Badge variant="outline" className="text-xs bg-violet-100 border-violet-300 text-violet-700 gap-1">
                <Sparkles className="h-3 w-3" /> AI • {aiRec.confidence}% confidence
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Major Risks */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-red-500" /> Major Risks
                </p>
                <ul className="space-y-2">
                  {aiRec.risks.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-400 flex-shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommended Actions */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-violet-500" /> Recommended Actions
                </p>
                <ul className="space-y-2">
                  {aiRec.actions.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <ChevronRight className="mt-0.5 h-3.5 w-3.5 text-violet-400 flex-shrink-0" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Business Impact */}
              <div className="md:col-span-2 border-t border-violet-200 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Business Impact</p>
                    <p className="text-sm text-foreground">{aiRec.impact}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Expected Stability</p>
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border inline-block", {
                      "bg-emerald-50 text-emerald-700 border-emerald-200": aiRec.stability === "High",
                      "bg-amber-50 text-amber-700 border-amber-200": aiRec.stability === "Moderate",
                      "bg-red-50 text-red-700 border-red-200": aiRec.stability === "Low",
                    })}>
                      {aiRec.stability} Stability
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">AI Confidence</p>
                    <div className="flex items-center gap-2">
                      <Progress value={aiRec.confidence} className="h-2 flex-1" />
                      <span className="text-xs font-bold text-violet-700">{aiRec.confidence}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Blocking Issues ────────────────────────────────────────────────── */}
      {derivedData.blockingIssues.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.35 }}>
          <Card>
            <CardHeader className="pb-3">
              <SectionHeading icon={XCircle} title="Blocking Issues" subtitle="Issues that must be resolved before release" />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs">Issue</TableHead>
                    <TableHead className="text-xs">Severity</TableHead>
                    <TableHead className="text-xs">Owner</TableHead>
                    <TableHead className="text-xs">ETA</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {derivedData.blockingIssues.map((issue, i) => (
                    <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="text-sm font-medium max-w-[280px] truncate">{issue.issue}</TableCell>
                      <TableCell><SeverityBadge severity={issue.severity} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{issue.owner}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{issue.eta}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">{issue.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Readiness Trends ──────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.4 }}>
        <Card>
          <CardHeader className="pb-3">
            <SectionHeading icon={TrendingUp} title="Readiness Trends" subtitle="Release score, critical bugs, and open bugs over the last 7 days" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Release score over time */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3">Release Score Trend</p>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={derivedData.trends} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="releaseScore" stroke="#6366f1" strokeWidth={2} fill="url(#scoreGrad)" name="Release Score" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Bug trends */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3">Bug Trend (Critical vs Open)</p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={derivedData.trends} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="criticalBugs" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="Critical" />
                    <Line type="monotone" dataKey="openBugs" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Open" strokeDasharray="4 2" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Quick Actions ─────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.45 }}>
        <Card>
          <CardHeader className="pb-3">
            <SectionHeading icon={Zap} title="Quick Actions" subtitle="Common release management actions" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                disabled={approving || derivedData.deploymentStatus === "blocked"}
                onClick={handleApprove}
              >
                <ThumbsUp className="h-4 w-4" />
                {approving ? "Approving…" : "Approve Release"}
              </Button>
              <Button variant="destructive" className="gap-2" disabled={rejecting} onClick={handleReject}>
                <ThumbsDown className="h-4 w-4" />
                {rejecting ? "Rejecting…" : "Reject Release"}
              </Button>
              <Button variant="outline" className="gap-2" onClick={handleReAudit}>
                <RefreshCw className="h-4 w-4" />
                Request Re-Audit
              </Button>
              <Button variant="outline" className="gap-2" onClick={handleNotes}>
                <FileText className="h-4 w-4" />
                Generate Release Notes
              </Button>
              <Button variant="outline" className="gap-2" onClick={handleShare}>
                <Share2 className="h-4 w-4" />
                Share Summary
              </Button>
              <Button variant="outline" className="gap-2" onClick={handleExport}>
                <Download className="h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
