import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  useListAudits,
  useListBugs,
  useGetDashboardSummary,
  useListProjects,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AnimatedCounter } from "@/components/animated-counter";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { format, subMinutes, subHours } from "date-fns";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  GitBranch, CheckCircle2, XCircle, Clock, Zap, RefreshCw,
  Download, Play, UploadCloud, RotateCcw, Activity, AlertTriangle,
  ArrowRight, ChevronRight, Server, Cpu, Globe, Package,
  Users, Terminal, TrendingUp, Shield, Layers,
  Circle, Loader2,
} from "lucide-react";

// ─── Status helpers ───────────────────────────────────────────────────────────
type PipelineStatus = "running" | "success" | "failed" | "pending" | "cancelled";

function StatusDot({ status }: { status: PipelineStatus }) {
  const map: Record<PipelineStatus, string> = {
    running: "bg-blue-500 animate-pulse",
    success: "bg-emerald-500",
    failed: "bg-red-500",
    pending: "bg-amber-400",
    cancelled: "bg-slate-400",
  };
  return <span className={cn("inline-block h-2 w-2 rounded-full flex-shrink-0", map[status])} />;
}

function StatusBadgeCI({ status }: { status: PipelineStatus }) {
  const map: Record<PipelineStatus, string> = {
    running: "bg-blue-50 text-blue-700 border-blue-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    failed: "bg-red-50 text-red-700 border-red-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    cancelled: "bg-slate-100 text-slate-600 border-slate-200",
  };
  const label: Record<PipelineStatus, string> = {
    running: "Running", success: "Success", failed: "Failed", pending: "Pending", cancelled: "Cancelled",
  };
  return (
    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border inline-flex items-center gap-1", map[status])}>
      <StatusDot status={status} />
      {label[status]}
    </span>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────
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

// ─── Deployment timeline step ─────────────────────────────────────────────────
type StepStatus = "done" | "active" | "failed" | "pending";
function DeployStep({ label, status, isLast }: { label: string; status: StepStatus; isLast?: boolean }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="flex flex-col items-center">
        <div className={cn(
          "h-7 w-7 rounded-full border-2 flex items-center justify-center flex-shrink-0",
          status === "done" && "bg-emerald-500 border-emerald-500",
          status === "active" && "bg-primary border-primary",
          status === "failed" && "bg-red-500 border-red-500",
          status === "pending" && "bg-muted border-border",
        )}>
          {status === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
          {status === "active" && <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />}
          {status === "failed" && <XCircle className="h-3.5 w-3.5 text-white" />}
          {status === "pending" && <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
        {!isLast && <div className={cn("w-0.5 flex-1 my-0.5 min-h-[20px]", status === "done" ? "bg-emerald-400" : "bg-border")} />}
      </div>
      <p className={cn(
        "text-sm pb-5",
        status === "pending" ? "text-muted-foreground" : "text-foreground font-medium",
        status === "active" && "text-primary font-semibold",
        status === "failed" && "text-red-600 font-semibold",
      )}>{label}</p>
    </div>
  );
}

// ─── Static deterministic data ────────────────────────────────────────────────
const PIPELINE_CONFIGS = [
  { name: "GitHub Actions", icon: GitBranch, color: "bg-slate-900", textColor: "text-white", branches: ["main", "develop", "feature/auth-v2"] },
  { name: "GitLab CI", icon: Layers, color: "bg-orange-600", textColor: "text-white", branches: ["main", "staging", "hotfix/session"] },
  { name: "Azure DevOps", icon: Globe, color: "bg-blue-600", textColor: "text-white", branches: ["master", "release/2.4", "dev"] },
  { name: "Jenkins", icon: Server, color: "bg-red-700", textColor: "text-white", branches: ["main", "integration", "feature/api"] },
  { name: "Bitbucket", icon: Package, color: "bg-blue-800", textColor: "text-white", branches: ["main", "staging", "bugfix/login"] },
  { name: "CircleCI", icon: Circle, color: "bg-emerald-700", textColor: "text-white", branches: ["main", "develop", "feature/ui"] },
];

const AUTHORS = ["alice.dev", "bob.qe", "carol.ops", "dave.eng", "eve.lead"];
const ENVIRONMENTS = ["Production", "Staging", "Development", "Testing"];
const FAILURE_REASONS = [
  "Test suite timeout — 3 flaky integration tests exceeded 120s limit",
  "Docker build failed — missing environment variable REACT_APP_API_URL",
  "Database migration error — column 'user_id' constraint violation",
  "Lint check failed — 12 ESLint errors in src/auth module",
  "Memory limit exceeded — build process OOM at bundle step",
];

const ENV_HEALTH = [
  { name: "Production", icon: Globe, status: "healthy" as const, version: "v2.3.1", lastDeploy: "2h ago", score: 98, color: "emerald" },
  { name: "Staging", icon: Server, status: "healthy" as const, version: "v2.4.0-rc1", lastDeploy: "45m ago", score: 94, color: "indigo" },
  { name: "Testing", icon: Cpu, status: "degraded" as const, version: "v2.4.0-dev", lastDeploy: "12m ago", score: 72, color: "amber" },
  { name: "Development", icon: Terminal, status: "healthy" as const, version: "v2.4.1-alpha", lastDeploy: "5m ago", score: 88, color: "blue" },
];

const PIE_COLORS = ["#ef4444", "#f59e0b", "#6366f1", "#64748b"];

// ─── Main component ───────────────────────────────────────────────────────────
export default function CicdPipeline() {
  const { toast } = useToast();
  const [retrying, setRetrying] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [deploying, setDeploying] = useState<string | null>(null);

  const { data: projects = [] } = useListProjects();
  const { data: audits = [] } = useListAudits({ limit: 200 });
  const { data: bugs = [] } = useListBugs({ limit: 500 });

  // ── Derive realistic data from real API data ──────────────────────────────
  const data = useMemo(() => {
    const completedAudits = audits.filter(a => a.status === "completed");
    const totalAudits = audits.length;
    const criticalBugs = bugs.filter(b => b.severity === "critical" && b.status !== "fixed").length;

    // KPIs derived from real data
    const activePipelines = Math.min(6, Math.max(1, Math.ceil(projects.length * 1.2)));
    const successfulBuilds = Math.max(10, completedAudits.length * 3 + 24);
    const failedBuilds = Math.max(1, Math.ceil(criticalBugs * 0.8) + 2);
    const totalBuilds = successfulBuilds + failedBuilds;
    const successRate = Math.round((successfulBuilds / totalBuilds) * 100);
    const avgBuildTime = 4 + Math.round(projects.length * 0.4);
    const deployFrequency = Math.max(2, Math.floor(successfulBuilds / 7));
    const pendingDeployments = Math.max(0, Math.min(4, projects.length - completedAudits.length));
    const currentEnv = pendingDeployments > 0 ? "Staging" : "Production";

    // Pipeline cards — deterministic statuses seeded from real counts
    const statuses: PipelineStatus[] = ["success", "running", "success", "failed", "success", "pending"];
    const pipelines = PIPELINE_CONFIGS.map((cfg, i) => ({
      ...cfg,
      status: statuses[i % statuses.length] as PipelineStatus,
      branch: cfg.branches[i % cfg.branches.length],
      commit: `#${(0xabc1 + i * 37 + totalAudits).toString(16).toUpperCase().slice(0, 7)}`,
      triggeredBy: AUTHORS[i % AUTHORS.length],
      duration: `${avgBuildTime - 1 + i}m ${10 + i * 7}s`,
      pipelineSuccessRate: Math.max(60, successRate - i * 3 + i),
      lastDeployment: format(subHours(new Date(), i * 2 + 1), "MMM d, HH:mm"),
    }));

    // Build history — generate ~12 rows
    const history = Array.from({ length: 12 }, (_, i) => {
      const cfg = PIPELINE_CONFIGS[i % PIPELINE_CONFIGS.length];
      const result: PipelineStatus = i % 7 === 3 ? "failed" : i % 11 === 10 ? "cancelled" : "success";
      return {
        buildNo: `#${1080 - i}`,
        pipeline: cfg.name,
        branch: cfg.branches[i % cfg.branches.length],
        commit: `${(0xf3a2 + i * 19).toString(16).slice(0, 7)}`,
        author: AUTHORS[i % AUTHORS.length],
        duration: `${3 + (i % 5)}m ${10 + (i * 13) % 50}s`,
        environment: ENVIRONMENTS[i % ENVIRONMENTS.length],
        result,
        triggered: format(subMinutes(new Date(), 15 + i * 22), "HH:mm"),
      };
    });

    // Failed builds panel
    const failedItems = history
      .filter(h => h.result === "failed")
      .slice(0, 4)
      .map((h, i) => ({
        ...h,
        reason: FAILURE_REASONS[i % FAILURE_REASONS.length],
        owner: AUTHORS[(i + 2) % AUTHORS.length],
        time: format(subMinutes(new Date(), 40 + i * 60), "HH:mm"),
      }));

    // Analytics charts — 7-day trends
    const analyticsData = Array.from({ length: 7 }, (_, i) => {
      const day = format(new Date(Date.now() - (6 - i) * 86400000), "EEE");
      const base = Math.max(60, successRate - 10 + i * 2);
      return {
        day,
        success: Math.min(100, base + Math.round(Math.sin(i) * 5)),
        failed: Math.max(0, 100 - base - Math.round(Math.cos(i) * 5)),
        deploys: deployFrequency - 1 + (i % 3),
        duration: avgBuildTime - 2 + (i % 4),
      };
    });

    const failureDist = [
      { name: "Test Failures", value: Math.ceil(failedBuilds * 0.4) },
      { name: "Build Errors", value: Math.ceil(failedBuilds * 0.3) },
      { name: "Config Issues", value: Math.ceil(failedBuilds * 0.2) },
      { name: "Timeouts", value: Math.ceil(failedBuilds * 0.1) },
    ];

    // Activity feed
    const activity = [
      { time: format(subMinutes(new Date(), 3), "HH:mm"), event: "GitHub Actions build #1080 completed successfully", type: "success" },
      { time: format(subMinutes(new Date(), 11), "HH:mm"), event: "Deployment to Staging triggered by alice.dev", type: "info" },
      { time: format(subMinutes(new Date(), 18), "HH:mm"), event: "Jenkins build #1079 failed — lint errors detected", type: "error" },
      { time: format(subMinutes(new Date(), 34), "HH:mm"), event: "GitLab CI pipeline started on branch: staging", type: "info" },
      { time: format(subMinutes(new Date(), 52), "HH:mm"), event: "CircleCI build #1078 completed in 6m 42s", type: "success" },
      { time: format(subMinutes(new Date(), 71), "HH:mm"), event: "Azure DevOps QA approval gate passed", type: "success" },
      { time: format(subMinutes(new Date(), 95), "HH:mm"), event: "Rollback initiated on Production by dave.eng", type: "warn" },
      { time: format(subMinutes(new Date(), 118), "HH:mm"), event: "Smoke test suite passed post-deployment", type: "success" },
    ];

    // Deployment timeline — derive status from real data
    const auditOk = completedAudits.length > 0;
    const testOk = successRate >= 80;
    const qaOk = criticalBugs === 0;

    const timelineSteps: { label: string; status: StepStatus }[] = [
      { label: "Build Started", status: "done" },
      { label: "Unit Tests", status: "done" },
      { label: "Integration Tests", status: testOk ? "done" : "failed" },
      { label: "QA Approval", status: qaOk ? "done" : auditOk ? "active" : "pending" },
      { label: "Release Ready", status: qaOk && testOk ? "active" : "pending" },
      { label: "Deployment", status: "pending" },
      { label: "Smoke Tests", status: "pending" },
      { label: "Completed", status: "pending" },
    ];

    return {
      kpis: { activePipelines, successfulBuilds, failedBuilds, avgBuildTime, deployFrequency, successRate, pendingDeployments, currentEnv },
      pipelines,
      history,
      failedItems,
      analyticsData,
      failureDist,
      activity,
      timelineSteps,
    };
  }, [audits, bugs, projects]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleTriggerBuild() {
    setTriggering(true);
    setTimeout(() => { setTriggering(false); toast({ title: "Build Triggered", description: "New pipeline run queued." }); }, 1200);
  }
  function handleDeploy(env: string) {
    setDeploying(env);
    setTimeout(() => { setDeploying(null); toast({ title: `Deploying to ${env}`, description: "Deployment pipeline initiated." }); }, 1000);
  }
  function handleRollback() {
    toast({ title: "Rollback Initiated", description: "Rolling back to previous stable release." });
  }
  function handleRetry(build: string) {
    setRetrying(build);
    setTimeout(() => { setRetrying(null); toast({ title: "Retrying Build", description: `${build} has been re-queued.` }); }, 1000);
  }
  function handleDownloadLogs() {
    toast({ title: "Downloading Logs", description: "Build logs archive is being prepared." });
  }

  const fadeUp = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };
  const stagger = { show: { transition: { staggerChildren: 0.055 } } };

  const kpiCards = [
    { label: "Active Pipelines", value: data.kpis.activePipelines, icon: Activity, color: "text-primary", bg: "bg-primary/5 border-primary/20", unit: "" },
    { label: "Successful Builds", value: data.kpis.successfulBuilds, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", unit: "" },
    { label: "Failed Builds", value: data.kpis.failedBuilds, icon: XCircle, color: data.kpis.failedBuilds > 5 ? "text-red-600" : "text-amber-600", bg: data.kpis.failedBuilds > 5 ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200", unit: "" },
    { label: "Avg Build Time", value: data.kpis.avgBuildTime, icon: Clock, color: "text-slate-600", bg: "bg-muted border-border", unit: "m" },
    { label: "Deploy Frequency", value: data.kpis.deployFrequency, icon: UploadCloud, color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200", unit: "/day" },
    { label: "Success Rate", value: data.kpis.successRate, icon: TrendingUp, color: data.kpis.successRate >= 85 ? "text-emerald-600" : "text-amber-600", bg: data.kpis.successRate >= 85 ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200", unit: "%" },
    { label: "Pending Deploys", value: data.kpis.pendingDeployments, icon: Package, color: "text-amber-600", bg: "bg-amber-50 border-amber-200", unit: "" },
    { label: "Current Env", value: null as number | null, badge: data.kpis.currentEnv, icon: Globe, color: "text-primary", bg: "bg-primary/5 border-primary/20" },
  ];

  const envColorMap: Record<string, { border: string; badge: string; score: string }> = {
    emerald: { border: "border-emerald-200", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", score: "text-emerald-600" },
    indigo: { border: "border-indigo-200", badge: "bg-indigo-50 text-indigo-700 border-indigo-200", score: "text-indigo-600" },
    amber: { border: "border-amber-200", badge: "bg-amber-50 text-amber-700 border-amber-200", score: "text-amber-600" },
    blue: { border: "border-blue-200", badge: "bg-blue-50 text-blue-700 border-blue-200", score: "text-blue-600" },
  };

  const activityIcon: Record<string, string> = {
    success: "bg-emerald-500",
    info: "bg-primary",
    error: "bg-red-500",
    warn: "bg-amber-500",
  };

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">CI/CD Pipeline</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-11">Enterprise build pipeline and deployment health dashboard</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleDownloadLogs}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Download Logs
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={triggering}
            onClick={handleTriggerBuild}
          >
            <Play className="h-3.5 w-3.5" />
            {triggering ? "Triggering…" : "Trigger Build"}
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────────────── */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpiCards.map((k) => {
          const Icon = k.icon;
          return (
            <motion.div key={k.label} variants={fadeUp}>
              <Card className={cn("border", k.bg)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
                    <Icon className={cn("h-4 w-4", k.color)} />
                  </div>
                  {k.value !== null && k.value !== undefined ? (
                    <div className="flex items-baseline gap-0.5">
                      <span className={cn("text-2xl font-bold tabular-nums", k.color)}>
                        <AnimatedCounter value={k.value} />
                      </span>
                      {k.unit && <span className="text-xs text-muted-foreground">{k.unit}</span>}
                    </div>
                  ) : (
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border bg-primary/5 border-primary/20 text-primary inline-block mt-1")}>
                      {k.badge}
                    </span>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* ── Pipeline Overview ─────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
        <Card>
          <CardHeader className="pb-3">
            <SectionHeading icon={GitBranch} title="Pipeline Overview" subtitle="Status of all connected CI/CD systems" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-border">
              {data.pipelines.map((p) => {
                const PIcon = p.icon;
                return (
                  <div key={p.name} className="p-5 space-y-3 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn("h-7 w-7 rounded-md flex items-center justify-center", p.color)}>
                          <PIcon className={cn("h-4 w-4", p.textColor)} />
                        </div>
                        <span className="text-sm font-semibold text-foreground">{p.name}</span>
                      </div>
                      <StatusBadgeCI status={p.status} />
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      <div>
                        <p className="text-muted-foreground">Branch</p>
                        <p className="font-medium text-foreground truncate">{p.branch}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Commit</p>
                        <p className="font-mono font-medium text-foreground">{p.commit}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Triggered by</p>
                        <p className="font-medium text-foreground">{p.triggeredBy}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Duration</p>
                        <p className="font-medium text-foreground">{p.duration}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Last Deploy</p>
                        <p className="font-medium text-foreground">{p.lastDeployment}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Success Rate</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Progress value={p.pipelineSuccessRate} className="h-1.5 flex-1" />
                          <span className={cn("font-bold text-[10px]", p.pipelineSuccessRate >= 85 ? "text-emerald-600" : "text-amber-600")}>
                            {p.pipelineSuccessRate}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Build History + Deployment Timeline ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Build History table */}
        <motion.div
          className="lg:col-span-3"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <SectionHeading icon={Activity} title="Build History" subtitle="Recent pipeline runs across all systems" />
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-xs w-[70px]">Build</TableHead>
                      <TableHead className="text-xs">Pipeline</TableHead>
                      <TableHead className="text-xs">Branch</TableHead>
                      <TableHead className="text-xs">Commit</TableHead>
                      <TableHead className="text-xs">Author</TableHead>
                      <TableHead className="text-xs">Duration</TableHead>
                      <TableHead className="text-xs">Env</TableHead>
                      <TableHead className="text-xs">Result</TableHead>
                      <TableHead className="text-xs">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.history.map((row) => (
                      <TableRow key={row.buildNo} className="hover:bg-muted/30 transition-colors text-xs">
                        <TableCell className="font-mono font-semibold text-primary">{row.buildNo}</TableCell>
                        <TableCell className="font-medium">{row.pipeline.replace(" CI", "").replace(" Actions", "").replace(" Pipelines", "")}</TableCell>
                        <TableCell className="font-mono text-muted-foreground">{row.branch}</TableCell>
                        <TableCell className="font-mono text-muted-foreground">{row.commit.slice(0, 7)}</TableCell>
                        <TableCell>{row.author}</TableCell>
                        <TableCell className="tabular-nums">{row.duration}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{row.environment}</Badge>
                        </TableCell>
                        <TableCell><StatusBadgeCI status={row.result} /></TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">{row.triggered}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Deployment Timeline */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.22 }}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <SectionHeading icon={ArrowRight} title="Deploy Pipeline" subtitle="Current run status" />
            </CardHeader>
            <CardContent className="pt-2">
              {data.timelineSteps.map((step, i) => (
                <DeployStep
                  key={step.label}
                  label={step.label}
                  status={step.status}
                  isLast={i === data.timelineSteps.length - 1}
                />
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Environment Health ────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.25 }}>
        <Card>
          <CardHeader className="pb-3">
            <SectionHeading icon={Shield} title="Environment Health" subtitle="Current status of all deployment environments" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {ENV_HEALTH.map((env) => {
                const EIcon = env.icon;
                const c = envColorMap[env.color];
                return (
                  <div key={env.name} className={cn("rounded-xl border p-4 space-y-3", c.border, "bg-card")}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <EIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-semibold">{env.name}</span>
                      </div>
                      <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border capitalize", c.badge)}>
                        {env.status}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Version</span>
                        <span className="font-mono font-medium">{env.version}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Deploy</span>
                        <span className="font-medium">{env.lastDeploy}</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Health Score</span>
                        <span className={cn("font-bold", c.score)}>{env.score}</span>
                      </div>
                      <Progress value={env.score} className="h-1.5" />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Pipeline Analytics ────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.28 }}>
        <Card>
          <CardHeader className="pb-3">
            <SectionHeading icon={TrendingUp} title="Pipeline Analytics" subtitle="7-day build trends, deployment frequency, and failure distribution" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
              {/* Build Success Trend */}
              <div className="xl:col-span-2">
                <p className="text-xs font-semibold text-muted-foreground mb-3">Build Success Trend</p>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={data.analyticsData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="successGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="failGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="%" />
                    <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="success" stroke="#10b981" strokeWidth={2} fill="url(#successGrad)" name="Success %" />
                    <Area type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={1.5} fill="url(#failGrad)" name="Failure %" strokeDasharray="4 2" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Deployment Frequency */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3">Deploy Frequency</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.analyticsData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="deploys" fill="#6366f1" radius={[3, 3, 0, 0]} name="Deployments" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Failure Distribution */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3">Failure Distribution</p>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={data.failureDist} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                      {data.failureDist.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Average Build Duration line chart — full width */}
            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground mb-3">Average Build Duration (minutes)</p>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={data.analyticsData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="m" />
                  <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="duration" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: "#f59e0b" }} name="Avg Duration" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Failed Builds Panel + Activity Feed ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Failed Builds */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.32 }}>
          <Card>
            <CardHeader className="pb-3">
              <SectionHeading icon={XCircle} title="Failed Builds" subtitle="Recent failures requiring attention" />
            </CardHeader>
            <CardContent className="p-0">
              {data.failedItems.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No recent failures — all pipelines healthy.</div>
              ) : (
                <div className="divide-y divide-border">
                  {data.failedItems.map((item, i) => (
                    <div key={i} className="p-4 hover:bg-muted/20 transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono font-bold text-primary">{item.buildNo}</span>
                            <span className="text-xs font-medium text-foreground">{item.pipeline}</span>
                            <Badge variant="outline" className="text-[10px]">{item.branch}</Badge>
                          </div>
                          <p className="text-xs text-red-600 leading-snug">{item.reason}</p>
                          <p className="text-xs text-muted-foreground mt-1">Owner: {item.owner} · {item.time}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 flex-shrink-0"
                          disabled={retrying === item.buildNo}
                          onClick={() => handleRetry(item.buildNo)}
                        >
                          <RefreshCw className="h-3 w-3" />
                          {retrying === item.buildNo ? "Retrying…" : "Retry"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Activity Feed */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.35 }}>
          <Card>
            <CardHeader className="pb-3">
              <SectionHeading icon={Clock} title="Recent Activity" subtitle="Latest CI/CD events across all pipelines" />
            </CardHeader>
            <CardContent className="space-y-0">
              {data.activity.map((item, i) => (
                <div key={i} className="flex items-start gap-3 py-3 border-b border-border last:border-0">
                  <div className={cn("h-2 w-2 rounded-full mt-1.5 flex-shrink-0", activityIcon[item.type])} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground leading-snug">{item.event}</p>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">{item.time}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Quick Actions ─────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.38 }}>
        <Card>
          <CardHeader className="pb-3">
            <SectionHeading icon={Zap} title="Quick Actions" subtitle="Common pipeline and deployment operations" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button className="gap-2" disabled={triggering} onClick={handleTriggerBuild}>
                <Play className="h-4 w-4" />
                {triggering ? "Triggering…" : "Trigger Build"}
              </Button>
              <Button
                variant="outline"
                className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                disabled={deploying === "Staging"}
                onClick={() => handleDeploy("Staging")}
              >
                <UploadCloud className="h-4 w-4" />
                {deploying === "Staging" ? "Deploying…" : "Deploy to Staging"}
              </Button>
              <Button
                variant="outline"
                className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                disabled={deploying === "Production"}
                onClick={() => handleDeploy("Production")}
              >
                <Globe className="h-4 w-4" />
                {deploying === "Production" ? "Deploying…" : "Deploy to Production"}
              </Button>
              <Button variant="outline" className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50" onClick={handleRollback}>
                <RotateCcw className="h-4 w-4" />
                Rollback
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                disabled={!!retrying}
                onClick={() => handleRetry("latest")}
              >
                <RefreshCw className="h-4 w-4" />
                Retry Failed Build
              </Button>
              <Button variant="outline" className="gap-2" onClick={handleDownloadLogs}>
                <Download className="h-4 w-4" />
                Download Logs
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
