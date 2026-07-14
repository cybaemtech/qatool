import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AnimatedCounter } from "@/components/animated-counter";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import {
  Network, Activity, Play, Download, FileText, Share2,
  CheckCircle2, XCircle, AlertTriangle, Clock, RefreshCw,
  Globe, Lock, Users, Folder, Bug as BugIcon, Bell,
  BarChart2, Sparkles, Bot, ChevronRight, Zap, ArrowDown,
  Database, Smartphone, Server, CreditCard, Layers,
  TrendingUp, ShieldCheck,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
type ApiStatus = "healthy" | "degraded" | "failed";
type EnvType = "production" | "staging" | "testing" | "development";

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

function MethodBadge({ method }: { method: HttpMethod }) {
  const styles: Record<HttpMethod, string> = {
    GET: "bg-emerald-50 text-emerald-700 border-emerald-200",
    POST: "bg-blue-50 text-blue-700 border-blue-200",
    PUT: "bg-amber-50 text-amber-700 border-amber-200",
    DELETE: "bg-red-50 text-red-700 border-red-200",
    PATCH: "bg-violet-50 text-violet-700 border-violet-200",
  };
  return (
    <span className={cn("text-[11px] font-bold px-1.5 py-0.5 rounded border font-mono", styles[method])}>
      {method}
    </span>
  );
}

function StatusBadge({ status }: { status: ApiStatus | string }) {
  const styles: Record<string, string> = {
    healthy: "bg-emerald-50 text-emerald-700 border-emerald-200",
    degraded: "bg-amber-50 text-amber-700 border-amber-200",
    failed: "bg-red-50 text-red-700 border-red-200",
    Passing: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Failed: "bg-red-50 text-red-700 border-red-200",
    Skipped: "bg-slate-50 text-slate-600 border-slate-200",
    Open: "bg-red-50 text-red-700 border-red-200",
    Resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Retrying: "bg-amber-50 text-amber-700 border-amber-200",
  };
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", styles[status] ?? "bg-slate-50 text-slate-600 border-slate-200")}>
      {label}
    </span>
  );
}

function statusDot(s: ApiStatus): string {
  return s === "healthy" ? "bg-emerald-500" : s === "degraded" ? "bg-amber-500" : "bg-red-500";
}

// ─── Mock data ─────────────────────────────────────────────────────────────────
const API_SERVICES = [
  { name: "Authentication API", icon: Lock, status: "healthy" as ApiStatus, latency: 42, availability: 99.98, requests: 12840, errorRate: 0.02, lastCheck: "1 min ago", env: "Production", version: "v2.4.1" },
  { name: "User API", icon: Users, status: "healthy" as ApiStatus, latency: 58, availability: 99.95, requests: 8420, errorRate: 0.05, lastCheck: "1 min ago", env: "Production", version: "v3.1.0" },
  { name: "Project API", icon: Folder, status: "healthy" as ApiStatus, latency: 73, availability: 99.91, requests: 5640, errorRate: 0.09, lastCheck: "2 min ago", env: "Production", version: "v2.0.3" },
  { name: "Audit API", icon: ShieldCheck, status: "degraded" as ApiStatus, latency: 312, availability: 98.40, requests: 3210, errorRate: 1.60, lastCheck: "3 min ago", env: "Production", version: "v1.8.2" },
  { name: "Bug API", icon: BugIcon, status: "healthy" as ApiStatus, latency: 65, availability: 99.88, requests: 4920, errorRate: 0.12, lastCheck: "1 min ago", env: "Production", version: "v2.2.0" },
  { name: "Report API", icon: BarChart2, status: "degraded" as ApiStatus, latency: 489, availability: 97.80, requests: 1840, errorRate: 2.20, lastCheck: "5 min ago", env: "Production", version: "v1.6.4" },
  { name: "Notification API", icon: Bell, status: "healthy" as ApiStatus, latency: 28, availability: 99.99, requests: 21300, errorRate: 0.01, lastCheck: "1 min ago", env: "Production", version: "v3.0.1" },
  { name: "Analytics API", icon: TrendingUp, status: "failed" as ApiStatus, latency: 0, availability: 94.20, requests: 960, errorRate: 5.80, lastCheck: "10 min ago", env: "Production", version: "v1.4.0" },
  { name: "Payment API", icon: CreditCard, status: "healthy" as ApiStatus, latency: 95, availability: 99.97, requests: 2180, errorRate: 0.03, lastCheck: "2 min ago", env: "Production", version: "v4.1.2" },
];

const ENDPOINTS = [
  { method: "GET" as HttpMethod, path: "/api/auth/me", service: "Auth API", latency: 42, code: 200, availability: 99.98, requests: 12840, errors: 3, owner: "alice.dev", env: "Production", last: "1m ago", status: "healthy" as ApiStatus },
  { method: "POST" as HttpMethod, path: "/api/auth/login", service: "Auth API", latency: 88, code: 200, availability: 99.95, requests: 4320, errors: 9, owner: "alice.dev", env: "Production", last: "1m ago", status: "healthy" as ApiStatus },
  { method: "GET" as HttpMethod, path: "/api/users", service: "User API", latency: 67, code: 200, availability: 99.90, requests: 5840, errors: 6, owner: "bob.qe", env: "Production", last: "2m ago", status: "healthy" as ApiStatus },
  { method: "POST" as HttpMethod, path: "/api/projects", service: "Project API", latency: 121, code: 201, availability: 99.85, requests: 830, errors: 2, owner: "carol.ops", env: "Production", last: "2m ago", status: "healthy" as ApiStatus },
  { method: "GET" as HttpMethod, path: "/api/audits", service: "Audit API", latency: 312, code: 200, availability: 98.40, requests: 3210, errors: 51, owner: "dave.eng", env: "Production", last: "3m ago", status: "degraded" as ApiStatus },
  { method: "POST" as HttpMethod, path: "/api/bugs", service: "Bug API", latency: 78, code: 201, availability: 99.88, requests: 2180, errors: 3, owner: "alice.dev", env: "Production", last: "1m ago", status: "healthy" as ApiStatus },
  { method: "GET" as HttpMethod, path: "/api/dashboard/summary", service: "Analytics API", latency: 0, code: 503, availability: 94.20, requests: 960, errors: 56, owner: "dave.eng", env: "Production", last: "10m ago", status: "failed" as ApiStatus },
  { method: "GET" as HttpMethod, path: "/api/reports", service: "Report API", latency: 489, code: 200, availability: 97.80, requests: 1840, errors: 40, owner: "bob.qe", env: "Production", last: "5m ago", status: "degraded" as ApiStatus },
  { method: "DELETE" as HttpMethod, path: "/api/bugs/:id", service: "Bug API", latency: 54, code: 200, availability: 99.92, requests: 410, errors: 0, owner: "alice.dev", env: "Production", last: "4m ago", status: "healthy" as ApiStatus },
  { method: "PUT" as HttpMethod, path: "/api/audits/:id", service: "Audit API", latency: 288, code: 200, availability: 98.60, requests: 320, errors: 5, owner: "dave.eng", env: "Staging", last: "6m ago", status: "degraded" as ApiStatus },
  { method: "POST" as HttpMethod, path: "/api/notifications/send", service: "Notification API", latency: 28, code: 200, availability: 99.99, requests: 21300, errors: 2, owner: "carol.ops", env: "Production", last: "1m ago", status: "healthy" as ApiStatus },
  { method: "GET" as HttpMethod, path: "/api/dashboard/performance-history", service: "Analytics API", latency: 0, code: 503, availability: 94.20, requests: 580, errors: 34, owner: "dave.eng", env: "Production", last: "10m ago", status: "failed" as ApiStatus },
];

const TEST_SUITES = [
  { name: "Smoke Tests", icon: Zap, status: "Passing", duration: "0m 48s", pass: 100, by: "CI/CD Pipeline", lastRun: "10:42 AM today" },
  { name: "Regression Tests", icon: RefreshCw, status: "Passing", duration: "12m 34s", pass: 96, by: "Scheduled (6 AM)", lastRun: "06:00 AM today" },
  { name: "Security Tests", icon: ShieldCheck, status: "Failed", duration: "5m 12s", pass: 78, by: "Manual – dave.eng", lastRun: "09:18 AM today" },
  { name: "Performance Tests", icon: TrendingUp, status: "Passing", duration: "8m 55s", pass: 89, by: "CI/CD Pipeline", lastRun: "08:30 AM today" },
  { name: "Contract Tests", icon: Layers, status: "Passing", duration: "3m 22s", pass: 100, by: "Scheduled (8 AM)", lastRun: "08:00 AM today" },
  { name: "Integration Tests", icon: Network, status: "Failed", duration: "14m 07s", pass: 84, by: "Scheduled (6 AM)", lastRun: "06:00 AM today" },
];

const FAILED_REQUESTS = [
  { time: "10:44:12", endpoint: "/api/dashboard/summary", method: "GET" as HttpMethod, code: 503, error: "Service Unavailable – Analytics worker crashed", retries: 3, owner: "dave.eng", env: "Production", resolution: "Open", eta: "2 hrs" },
  { time: "10:42:58", endpoint: "/api/audits?page=2", method: "GET" as HttpMethod, code: 504, error: "Gateway Timeout – DB query exceeded 30s threshold", retries: 2, owner: "dave.eng", env: "Production", resolution: "Retrying", eta: "30 min" },
  { time: "10:38:03", endpoint: "/api/reports/export", method: "POST" as HttpMethod, code: 500, error: "Internal Server Error – PDF renderer OOM", retries: 1, owner: "bob.qe", env: "Production", resolution: "Open", eta: "1 hr" },
  { time: "10:35:40", endpoint: "/api/auth/refresh", method: "POST" as HttpMethod, code: 401, error: "Unauthorized – Token refresh failed (expired secret)", retries: 0, owner: "alice.dev", env: "Staging", resolution: "Resolved", eta: "—" },
  { time: "10:20:17", endpoint: "/api/dashboard/performance-history", method: "GET" as HttpMethod, code: 503, error: "Service Unavailable – Analytics worker crashed", retries: 3, owner: "dave.eng", env: "Production", resolution: "Open", eta: "2 hrs" },
  { time: "09:58:31", endpoint: "/api/users/bulk-import", method: "POST" as HttpMethod, code: 422, error: "Unprocessable Entity – CSV row 48 has invalid email format", retries: 0, owner: "carol.ops", env: "Testing", resolution: "Resolved", eta: "—" },
];

const API_LOGS = [
  { time: "10:42", event: "Health check completed — 7/9 APIs healthy, 2 degraded, 1 failed", type: "success" },
  { time: "10:38", event: "Performance alert — Report API latency spike: 489ms (threshold: 300ms)", type: "warn" },
  { time: "10:20", event: "503 error detected — Analytics API worker crashed (pod OOMKilled)", type: "error" },
  { time: "10:15", event: "Rate limit warning — Notification API approaching 80% quota (21k/25k)", type: "warn" },
  { time: "09:55", event: "API recovery — Audit API latency recovered from 890ms to 312ms", type: "success" },
  { time: "09:18", event: "Authentication failure — 9 consecutive 401s from 192.168.1.42", type: "error" },
  { time: "08:45", event: "Deployment completed — Payment API v4.1.2 released to Production", type: "success" },
  { time: "08:00", event: "New version released — Notification API v3.0.1 deployed to Staging", type: "info" },
  { time: "Yesterday 23:40", event: "Scheduled regression suite completed — 96% pass rate", type: "success" },
];

const ENVIRONMENTS: { name: string; env: EnvType; score: number; latency: number; avail: number; errors: number; version: string; deployed: string }[] = [
  { name: "Production", env: "production", score: 94, latency: 89, avail: 99.80, errors: 0.20, version: "v4.1.2", deployed: "Dec 12, 2024" },
  { name: "Staging", env: "staging", score: 88, latency: 124, avail: 99.20, errors: 0.80, version: "v4.2.0-rc1", deployed: "Dec 13, 2024" },
  { name: "Testing", env: "testing", score: 76, latency: 201, avail: 97.40, errors: 2.60, version: "v4.2.0-beta", deployed: "Dec 13, 2024" },
  { name: "Development", env: "development", score: 62, latency: 340, avail: 94.10, errors: 5.90, version: "v4.2.0-dev", deployed: "Dec 14, 2024" },
];

const envColors: Record<EnvType, string> = {
  production: "border-emerald-200 bg-emerald-50/30",
  staging: "border-blue-200 bg-blue-50/30",
  testing: "border-amber-200 bg-amber-50/30",
  development: "border-slate-200 bg-slate-50/30",
};
const envScore: Record<EnvType, string> = {
  production: "text-emerald-600",
  staging: "text-blue-600",
  testing: "text-amber-600",
  development: "text-slate-600",
};

// ─── Chart data ───────────────────────────────────────────────────────────────
const VOL_TREND = [
  { time: "00:00", requests: 2100, errors: 12 }, { time: "02:00", requests: 1400, errors: 8 },
  { time: "04:00", requests: 900, errors: 4 }, { time: "06:00", requests: 2800, errors: 15 },
  { time: "08:00", requests: 6200, errors: 38 }, { time: "10:00", requests: 8400, errors: 62 },
  { time: "12:00", requests: 9100, errors: 54 }, { time: "14:00", requests: 8700, errors: 48 },
  { time: "16:00", requests: 7900, errors: 43 }, { time: "18:00", requests: 6300, errors: 31 },
  { time: "20:00", requests: 4800, errors: 24 }, { time: "22:00", requests: 3200, errors: 17 },
];

const LATENCY_TREND = [
  { time: "06:00", p50: 48, p95: 210, p99: 380 },
  { time: "08:00", p50: 62, p95: 280, p99: 520 },
  { time: "09:00", p50: 74, p95: 340, p99: 680 },
  { time: "10:00", p50: 89, p95: 420, p99: 890 },
  { time: "10:30", p50: 95, p95: 489, p99: 1020 },
  { time: "11:00", p50: 78, p95: 350, p99: 720 },
  { time: "12:00", p50: 65, p95: 290, p99: 580 },
];

const STATUS_CODE_DIST = [
  { name: "2xx Success", value: 92.4, fill: "#10b981" },
  { name: "4xx Client", value: 4.8, fill: "#f59e0b" },
  { name: "5xx Server", value: 2.0, fill: "#ef4444" },
  { name: "3xx Redirect", value: 0.8, fill: "#6366f1" },
];

const TOP_SLOW = [
  { name: "Analytics API", latency: 489 },
  { name: "Report API", latency: 312 },
  { name: "Audit API", latency: 288 },
  { name: "Payment API", latency: 95 },
  { name: "Project API", latency: 73 },
  { name: "Bug API", latency: 65 },
  { name: "User API", latency: 58 },
  { name: "Auth API", latency: 42 },
];

const ENV_PERF = [
  { env: "Prod", latency: 89, avail: 99.8 },
  { env: "Staging", latency: 124, avail: 99.2 },
  { env: "Testing", latency: 201, avail: 97.4 },
  { env: "Dev", latency: 340, avail: 94.1 },
];

const actDot: Record<string, string> = {
  success: "bg-emerald-500",
  error: "bg-red-500",
  warn: "bg-amber-500",
  info: "bg-primary",
};

const DEPENDENCY_NODES = [
  { label: "Frontend (React)", icon: Smartphone, color: "border-blue-200 bg-blue-50" },
  { label: "API Gateway", icon: Network, color: "border-violet-200 bg-violet-50" },
  { label: "Authentication Service", icon: Lock, color: "border-indigo-200 bg-indigo-50" },
  { label: "Business APIs", icon: Layers, color: "border-emerald-200 bg-emerald-50" },
  { label: "Database (PostgreSQL)", icon: Database, color: "border-amber-200 bg-amber-50" },
  { label: "Notification Service", icon: Bell, color: "border-orange-200 bg-orange-50" },
  { label: "Analytics Engine", icon: TrendingUp, color: "border-red-200 bg-red-50" },
];

const fadeUp = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

// ─── Main component ───────────────────────────────────────────────────────────
export default function ApiMonitoring() {
  const { toast } = useToast();
  const [checking, setChecking] = useState(false);
  const [running, setRunning] = useState(false);

  function handleHealthCheck() {
    setChecking(true);
    setTimeout(() => { setChecking(false); toast({ title: "Health Check Complete", description: "7 healthy · 2 degraded · 1 failed" }); }, 2000);
  }
  function handleRunTests() {
    setRunning(true);
    setTimeout(() => { setRunning(false); toast({ title: "API Tests Completed", description: "284/296 tests passed (95.9%)" }); }, 2500);
  }
  function handleDownloadSpec() { toast({ title: "Downloading OpenAPI Spec…", description: "openapi-spec-v3.1.0.yaml will download shortly." }); }
  function handleExport() { toast({ title: "Exporting Report…", description: "PDF will download shortly." }); }
  function handleShare() { toast({ title: "Share link copied", description: "Stakeholders can now view the monitoring dashboard." }); }

  const kpis = [
    { label: "Total APIs", value: 9, unit: "", icon: Network, color: "text-primary", bg: "bg-primary/5 border-primary/20" },
    { label: "Healthy APIs", value: 7, unit: "", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
    { label: "Degraded APIs", value: 2, unit: "", icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
    { label: "Failed APIs", value: 1, unit: "", icon: XCircle, color: "text-red-600", bg: "bg-red-50 border-red-200" },
    { label: "Avg Response", value: 128, unit: "ms", icon: Clock, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
    { label: "Requests Today", value: 61340, unit: "", icon: Activity, color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
    { label: "Error Rate", value: null as number | null, badge: "0.82%", icon: XCircle, color: "text-red-500", bg: "bg-red-50 border-red-200" },
    { label: "Uptime", value: 99, unit: ".80%", icon: ShieldCheck, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
    { label: "SLA Compliance", value: 98, unit: ".6%", icon: CheckCircle2, color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
    { label: "AI Confidence", value: 96, unit: "%", icon: Sparkles, color: "text-violet-600", bg: "bg-violet-50 border-violet-200" },
  ];

  const testSummaryCards = [
    { label: "Collections Executed", value: 6, icon: Layers },
    { label: "Total Tests", value: 296, icon: Activity },
    { label: "Passed", value: 267, icon: CheckCircle2 },
    { label: "Failed", value: 18, icon: XCircle },
    { label: "Skipped", value: 11, icon: Clock },
    { label: "Automation Coverage", value: 84, unit: "%", icon: TrendingUp },
    { label: "Avg Exec Time", value: null as number | null, badge: "7m 28s", icon: Clock },
    { label: "Last Execution", value: null as number | null, badge: "10:42 AM", icon: Activity },
  ];

  const docCards = [
    { label: "OpenAPI Version", value: "3.1.0" },
    { label: "Endpoints Documented", value: "148 / 152" },
    { label: "Collections", value: "6" },
    { label: "Webhooks", value: "12" },
    { label: "Auth Type", value: "JWT Bearer" },
    { label: "SDK Available", value: "JS, Python, Go" },
  ];

  const aiBottlenecks = [
    { name: "Analytics API", issue: "Worker OOMKilled — increase pod memory limit from 512Mi to 1Gi", p: "P0" },
    { name: "Report API", issue: "PDF renderer blocking event loop — offload to worker thread", p: "P1" },
    { name: "Audit API", issue: "N+1 query on GET /api/audits — add eager-loading for related entities", p: "P1" },
  ];
  const aiActions = [
    { action: "Scale Analytics API pods and set memory limit to 1Gi to prevent OOMKill restarts.", eta: "1–2 hrs", p: "P0" },
    { action: "Offload PDF generation to a dedicated worker queue (Bull/BullMQ) to unblock the event loop.", eta: "1–2 days", p: "P1" },
    { action: "Add eager-loading (JOIN) on Audit API list query to fix N+1 and reduce DB round-trips.", eta: "4–6 hrs", p: "P1" },
    { action: "Introduce Redis caching on GET /api/dashboard/* with 30s TTL to cut DB load by ~60%.", eta: "4–6 hrs", p: "P2" },
    { action: "Enable HTTP/2 on API Gateway to multiplex requests and reduce connection overhead.", eta: "2–3 hrs", p: "P2" },
  ];
  const priorityBadge: Record<string, string> = {
    P0: "bg-red-50 text-red-700 border-red-200",
    P1: "bg-orange-50 text-orange-700 border-orange-200",
    P2: "bg-amber-50 text-amber-700 border-amber-200",
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Network className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">API Monitoring & Testing Center</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-11">Real-time API health monitoring, automated testing, endpoint analytics and performance insights</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleShare}><Share2 className="h-3.5 w-3.5 mr-1.5" />Share</Button>
          <Button variant="outline" size="sm" onClick={handleExport}><FileText className="h-3.5 w-3.5 mr-1.5" />Export Report</Button>
          <Button variant="outline" size="sm" onClick={handleDownloadSpec}><Download className="h-3.5 w-3.5 mr-1.5" />Download OpenAPI Spec</Button>
          <Button variant="outline" size="sm" disabled={running} onClick={handleRunTests}>
            {running ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
            {running ? "Running…" : "Execute API Tests"}
          </Button>
          <Button size="sm" disabled={checking} onClick={handleHealthCheck}>
            {checking ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Activity className="h-3.5 w-3.5 mr-1.5" />}
            {checking ? "Checking…" : "Run Health Check"}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <motion.div key={k.label} variants={fadeUp}>
              <Card className={cn("border", k.bg)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
                    <Icon className={cn("h-4 w-4", k.color)} />
                  </div>
                  {k.badge ? (
                    <span className={cn("text-sm font-bold", k.color)}>{k.badge}</span>
                  ) : k.value !== null && k.value !== undefined ? (
                    <div className="flex items-baseline gap-0.5">
                      <span className={cn("text-2xl font-bold tabular-nums", k.color)}>
                        <AnimatedCounter value={k.value as number} />
                      </span>
                      {k.unit && <span className="text-xs text-muted-foreground">{k.unit}</span>}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* API Health Overview */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
        <Card>
          <CardHeader className="pb-3">
            <SectionHeading icon={Activity} title="API Health Overview" subtitle="Real-time health and performance metrics for all registered API services" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {API_SERVICES.map((svc) => {
                const SvcIcon = svc.icon;
                return (
                  <div key={svc.name} className={cn("rounded-xl border p-4 hover:bg-muted/10 transition-colors", svc.status === "failed" ? "border-red-200" : svc.status === "degraded" ? "border-amber-200" : "border-border")}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
                          <SvcIcon className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <p className="text-sm font-semibold text-foreground">{svc.name}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className={cn("h-2 w-2 rounded-full animate-pulse", statusDot(svc.status))} />
                        <StatusBadge status={svc.status} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      <div className="flex justify-between col-span-2">
                        <span className="text-muted-foreground">Response Time</span>
                        <span className={cn("font-semibold", svc.status === "failed" ? "text-red-600" : svc.latency > 200 ? "text-amber-600" : "text-foreground")}>
                          {svc.status === "failed" ? "—" : `${svc.latency}ms`}
                        </span>
                      </div>
                      <div className="flex justify-between col-span-2">
                        <span className="text-muted-foreground">Availability</span>
                        <span className={cn("font-semibold", svc.availability < 99 ? "text-amber-600" : "text-emerald-600")}>{svc.availability.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between col-span-2">
                        <span className="text-muted-foreground">Requests Today</span>
                        <span className="font-medium">{svc.requests.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between col-span-2">
                        <span className="text-muted-foreground">Error Rate</span>
                        <span className={cn("font-semibold", svc.errorRate > 1 ? "text-red-600" : svc.errorRate > 0.1 ? "text-amber-600" : "text-emerald-600")}>{svc.errorRate.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between col-span-2 pt-1 border-t border-border">
                        <span className="text-muted-foreground">Version</span>
                        <span className="font-mono text-xs">{svc.version}</span>
                      </div>
                      <div className="flex justify-between col-span-2">
                        <span className="text-muted-foreground">Last Check</span>
                        <span>{svc.lastCheck}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Live Endpoint Status */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
        <Card>
          <CardHeader className="pb-3">
            <SectionHeading icon={Globe} title="Live Endpoint Status" subtitle="Real-time status for all monitored API endpoints" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs">Method</TableHead>
                    <TableHead className="text-xs">Endpoint</TableHead>
                    <TableHead className="text-xs">Service</TableHead>
                    <TableHead className="text-xs">Latency</TableHead>
                    <TableHead className="text-xs">Code</TableHead>
                    <TableHead className="text-xs">Availability</TableHead>
                    <TableHead className="text-xs text-right">Requests</TableHead>
                    <TableHead className="text-xs text-right">Errors</TableHead>
                    <TableHead className="text-xs">Owner</TableHead>
                    <TableHead className="text-xs">Env</TableHead>
                    <TableHead className="text-xs">Last Checked</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ENDPOINTS.map((e, i) => (
                    <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                      <TableCell><MethodBadge method={e.method} /></TableCell>
                      <TableCell className="font-mono text-xs text-primary">{e.path}</TableCell>
                      <TableCell className="text-xs">{e.service}</TableCell>
                      <TableCell className={cn("text-xs font-semibold", e.latency === 0 ? "text-red-600" : e.latency > 200 ? "text-amber-600" : "text-foreground")}>
                        {e.latency === 0 ? "—" : `${e.latency}ms`}
                      </TableCell>
                      <TableCell>
                        <span className={cn("text-xs font-mono font-bold", e.code >= 500 ? "text-red-600" : e.code >= 400 ? "text-amber-600" : "text-emerald-600")}>
                          {e.code}
                        </span>
                      </TableCell>
                      <TableCell className={cn("text-xs", e.availability < 99 ? "text-amber-600" : "text-emerald-600")}>{e.availability.toFixed(2)}%</TableCell>
                      <TableCell className="text-xs text-right">{e.requests.toLocaleString()}</TableCell>
                      <TableCell className={cn("text-xs text-right", e.errors > 20 ? "text-red-600" : e.errors > 0 ? "text-amber-600" : "text-emerald-600")}>{e.errors}</TableCell>
                      <TableCell className="text-xs">{e.owner}</TableCell>
                      <TableCell className="text-xs">{e.env}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.last}</TableCell>
                      <TableCell><StatusBadge status={e.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Test Execution Summary */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.18 }}>
        <Card>
          <CardHeader className="pb-3">
            <SectionHeading icon={CheckCircle2} title="API Test Execution Summary" subtitle="Aggregate results from the latest full test run across all collections" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {testSummaryCards.map((c) => {
                const CIcon = c.icon;
                return (
                  <div key={c.label} className="rounded-xl border border-border p-3 text-center hover:bg-muted/20 transition-colors">
                    <CIcon className="h-4 w-4 text-primary mx-auto mb-1.5" />
                    <p className="text-[10px] text-muted-foreground mb-1 leading-tight">{c.label}</p>
                    {c.badge ? (
                      <p className="text-sm font-bold text-foreground">{c.badge}</p>
                    ) : (
                      <p className="text-lg font-bold text-foreground tabular-nums">
                        <AnimatedCounter value={c.value as number} />{c.unit}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Automated Test Suites */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}>
        <Card>
          <CardHeader className="pb-3">
            <SectionHeading icon={Layers} title="Automated Test Suites" subtitle="Status and pass rates for each automated test collection" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {TEST_SUITES.map((s) => {
                const SIcon = s.icon;
                return (
                  <div key={s.name} className={cn("rounded-xl border p-4", s.status === "Failed" ? "border-red-200 bg-red-50/20" : "border-border")}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
                          <SIcon className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <p className="text-sm font-semibold">{s.name}</p>
                      </div>
                      <StatusBadge status={s.status} />
                    </div>
                    <div className="mb-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Pass Rate</span>
                        <span className={cn("font-bold", s.pass === 100 ? "text-emerald-600" : s.pass >= 85 ? "text-amber-600" : "text-red-600")}>{s.pass}%</span>
                      </div>
                      <Progress value={s.pass} className="h-1.5" />
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <span className="text-muted-foreground">Duration</span><span className="font-medium text-right">{s.duration}</span>
                      <span className="text-muted-foreground">Executed By</span><span className="font-medium text-right truncate">{s.by}</span>
                      <span className="text-muted-foreground">Last Run</span><span className="font-medium text-right">{s.lastRun}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* AI Analysis */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.22 }}>
        <Card className="border border-violet-200 bg-gradient-to-br from-violet-50/80 to-indigo-50/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <SectionHeading icon={Bot} title="AI API Analysis" subtitle="Intelligent root cause analysis, bottleneck detection and remediation recommendations" />
              <Badge variant="outline" className="text-xs bg-violet-100 border-violet-300 text-violet-700 gap-1">
                <Sparkles className="h-3 w-3" /> AI · 96% confidence
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Performance Bottlenecks
                </p>
                <div className="space-y-3">
                  {aiBottlenecks.map((b, i) => (
                    <div key={i} className="rounded-lg border border-violet-100 bg-white/60 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-foreground">{b.name}</p>
                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full border", priorityBadge[b.p])}>{b.p}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{b.issue}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-violet-500" /> Recommended Actions
                </p>
                <div className="space-y-2">
                  {aiActions.map((a, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <ChevronRight className="mt-0.5 h-3.5 w-3.5 text-violet-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-foreground">{a.action}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full border", priorityBadge[a.p])}>{a.p}</span>
                          <span className="text-xs text-muted-foreground">ETA: {a.eta}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2 border-t border-violet-200 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Business Impact</p>
                    <p className="text-sm text-foreground">Analytics API outage affects real-time dashboards for all 5 active projects. Estimated revenue impact of $1.2k/hr while unresolved.</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Database Query Analysis</p>
                    <p className="text-sm text-foreground">Audit API issues 18–24 queries per request due to N+1 loading. Single eager-load JOIN would reduce DB load by 82%.</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Expected Response Time Improvement</p>
                    <div className="flex items-center gap-2">
                      <Progress value={68} className="h-2 flex-1" />
                      <span className="text-xs font-bold text-violet-700">68%</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">After completing all P0/P1 actions</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* API Analytics */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.25 }}>
        <Card>
          <CardHeader className="pb-3">
            <SectionHeading icon={BarChart2} title="API Analytics" subtitle="Request volume, latency trends, status code distribution and environment performance" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Request Volume */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3">Request Volume Trend (Today)</p>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={VOL_TREND} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="requests" stroke="#6366f1" strokeWidth={2} fill="url(#volGrad)" name="Requests" />
                    <Area type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={2} fill="url(#errGrad)" name="Errors" />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Latency Trend */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3">Response Time Trend (Percentiles)</p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={LATENCY_TREND} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="p50" stroke="#10b981" strokeWidth={2} dot={false} name="p50 (ms)" />
                    <Line type="monotone" dataKey="p95" stroke="#f59e0b" strokeWidth={2} dot={false} name="p95 (ms)" />
                    <Line type="monotone" dataKey="p99" stroke="#ef4444" strokeWidth={2} dot={false} name="p99 (ms)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Status Code Distribution */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3">Status Code Distribution</p>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={STATUS_CODE_DIST} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                      {STATUS_CODE_DIST.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                      formatter={(v: number) => `${v}%`}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Top Slow APIs */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3">Top Slow APIs (Avg Latency ms)</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={TOP_SLOW} layout="vertical" margin={{ top: 4, right: 16, left: 60, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={60} />
                    <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="latency" name="Latency (ms)" radius={[0, 3, 3, 0]}>
                      {TOP_SLOW.map((entry, i) => (
                        <Cell key={i} fill={entry.latency > 300 ? "#ef4444" : entry.latency > 100 ? "#f59e0b" : "#10b981"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Environment Performance */}
              <div className="lg:col-span-2">
                <p className="text-xs font-semibold text-muted-foreground mb-3">Environment Performance Comparison</p>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={ENV_PERF} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="env" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="latency" name="Avg Latency (ms)" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Failed Requests + API Logs */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.28 }}>
        <Card>
          <CardHeader className="pb-3">
            <SectionHeading icon={XCircle} title="Failed Requests" subtitle="Recent request failures across all environments with resolution tracking" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs">Timestamp</TableHead>
                    <TableHead className="text-xs">Endpoint</TableHead>
                    <TableHead className="text-xs">Method</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Error</TableHead>
                    <TableHead className="text-xs text-center">Retries</TableHead>
                    <TableHead className="text-xs">Owner</TableHead>
                    <TableHead className="text-xs">Env</TableHead>
                    <TableHead className="text-xs">Resolution</TableHead>
                    <TableHead className="text-xs">ETA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {FAILED_REQUESTS.map((r, i) => (
                    <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-mono text-xs text-muted-foreground">{r.time}</TableCell>
                      <TableCell className="font-mono text-xs text-primary">{r.endpoint}</TableCell>
                      <TableCell><MethodBadge method={r.method} /></TableCell>
                      <TableCell>
                        <span className={cn("font-mono text-xs font-bold", r.code >= 500 ? "text-red-600" : "text-amber-600")}>{r.code}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">{r.error}</TableCell>
                      <TableCell className="text-xs text-center">{r.retries}</TableCell>
                      <TableCell className="text-xs">{r.owner}</TableCell>
                      <TableCell className="text-xs">{r.env}</TableCell>
                      <TableCell><StatusBadge status={r.resolution} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.eta}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* API Logs + Environment Health */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Logs timeline */}
        <motion.div
          className="lg:col-span-3"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-3">
              <SectionHeading icon={Activity} title="API Logs" subtitle="Recent API events, alerts and deployment activity" />
            </CardHeader>
            <CardContent className="space-y-0">
              {API_LOGS.map((item, i) => (
                <div key={i} className="flex items-start gap-3 py-3 border-b border-border last:border-0">
                  <div className={cn("h-2 w-2 rounded-full mt-1.5 flex-shrink-0", actDot[item.type])} />
                  <p className="flex-1 text-xs text-foreground leading-snug">{item.event}</p>
                  <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">{item.time}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Environment Health */}
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.32 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-3">
              <SectionHeading icon={Server} title="Environment Health" subtitle="Per-environment health scores" />
            </CardHeader>
            <CardContent className="space-y-3">
              {ENVIRONMENTS.map((env) => (
                <div key={env.name} className={cn("rounded-xl border p-3", envColors[env.env])}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-foreground">{env.name}</p>
                    <span className={cn("text-base font-bold", envScore[env.env])}>{env.score}<span className="text-xs">/100</span></span>
                  </div>
                  <Progress value={env.score} className="h-1.5 mb-2" />
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                    <span className="text-muted-foreground">Avg Latency</span><span className="font-medium">{env.latency}ms</span>
                    <span className="text-muted-foreground">Availability</span><span className="font-medium">{env.avail}%</span>
                    <span className="text-muted-foreground">Error %</span>
                    <span className={cn("font-medium", env.errors > 2 ? "text-red-600" : env.errors > 0.5 ? "text-amber-600" : "text-emerald-600")}>
                      {env.errors}%
                    </span>
                    <span className="text-muted-foreground">Version</span><span className="font-mono text-[11px]">{env.version}</span>
                    <span className="text-muted-foreground">Deployed</span><span>{env.deployed}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* API Documentation Summary + Service Dependency Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Docs */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.33 }}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <SectionHeading icon={FileText} title="API Documentation Summary" subtitle="OpenAPI specification and SDK status" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {docCards.map((d) => (
                  <div key={d.label} className="rounded-xl border border-border p-3 hover:bg-muted/20 transition-colors">
                    <p className="text-xs text-muted-foreground mb-1">{d.label}</p>
                    <p className="text-sm font-semibold text-foreground">{d.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Service Dependency Map */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.35 }}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <SectionHeading icon={Network} title="Service Dependency Map" subtitle="Request flow from frontend through to downstream services" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-0">
                {DEPENDENCY_NODES.map((node, i) => {
                  const NIcon = node.icon;
                  return (
                    <div key={node.label} className="flex flex-col items-center w-full">
                      <div className={cn("flex items-center gap-2 rounded-xl border px-4 py-2 w-full max-w-xs justify-center", node.color)}>
                        <NIcon className="h-4 w-4 text-foreground/70 flex-shrink-0" />
                        <span className="text-xs font-semibold text-foreground">{node.label}</span>
                      </div>
                      {i < DEPENDENCY_NODES.length - 1 && (
                        <div className="flex flex-col items-center my-1">
                          <div className="h-3 w-px bg-border" />
                          <ArrowDown className="h-3 w-3 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.38 }}>
        <Card>
          <CardHeader className="pb-3">
            <SectionHeading icon={Zap} title="Quick Actions" subtitle="Common API monitoring and testing operations" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Run Full Health Check", icon: Activity, handler: handleHealthCheck, disabled: checking, variant: "default" as const },
                { label: "Execute Regression Suite", icon: RefreshCw, handler: handleRunTests, disabled: running, variant: "outline" as const },
                { label: "View Failed Requests", icon: XCircle, handler: () => toast({ title: "Failed Requests" }), disabled: false, variant: "outline" as const },
                { label: "Generate Performance Report", icon: BarChart2, handler: () => toast({ title: "Generating Performance Report…" }), disabled: false, variant: "outline" as const },
                { label: "Download Postman Collection", icon: Download, handler: () => toast({ title: "Downloading Postman collection…" }), disabled: false, variant: "outline" as const },
                { label: "Download OpenAPI Spec", icon: FileText, handler: handleDownloadSpec, disabled: false, variant: "outline" as const },
                { label: "Export Analytics", icon: Download, handler: handleExport, disabled: false, variant: "outline" as const },
                { label: "View API Logs", icon: Activity, handler: () => toast({ title: "Opening API Logs…" }), disabled: false, variant: "outline" as const },
              ].map(({ label, icon: Icon, handler, disabled, variant }) => (
                <Button key={label} variant={variant} size="sm" className="gap-1.5" disabled={disabled} onClick={handler}>
                  <Icon className="h-3.5 w-3.5" />{label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
