import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
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
  ClipboardList, CheckCircle2, XCircle, AlertTriangle,
  Clock, Play, Download, FileText, Share2, RefreshCw,
  Upload, Plus, Search, Filter, Bot, Sparkles, ChevronRight,
  ChevronDown, Bug as BugIcon, Zap, Activity, Users,
  Shield, Layers, Globe, TrendingUp, Database, Server,
  BarChart2, BookOpen, Link2,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

type ExecStatus = "Passed" | "Failed" | "Blocked" | "Not Run" | "Skipped" | "In Progress";
type Priority = "Critical" | "High" | "Medium" | "Low";
type PlanStatus = "Active" | "In Progress" | "Completed" | "Planned" | "On Hold";
type SuiteStatus = "Passing" | "Failing" | "Scheduled" | "Running" | "Paused";
type EnvHealth = "Healthy" | "Degraded" | "Down";

const execColors: Record<ExecStatus, string> = {
  Passed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Failed: "bg-red-50 text-red-700 border-red-200",
  Blocked: "bg-orange-50 text-orange-700 border-orange-200",
  "Not Run": "bg-slate-50 text-slate-600 border-slate-200",
  Skipped: "bg-slate-50 text-slate-500 border-slate-200",
  "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
};
const priorityColors: Record<Priority, string> = {
  Critical: "bg-red-50 text-red-700 border-red-200",
  High: "bg-orange-50 text-orange-700 border-orange-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  Low: "bg-emerald-50 text-emerald-600 border-emerald-200",
};
const planStatusColors: Record<PlanStatus, string> = {
  Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
  Completed: "bg-slate-50 text-slate-600 border-slate-200",
  Planned: "bg-indigo-50 text-indigo-700 border-indigo-200",
  "On Hold": "bg-amber-50 text-amber-700 border-amber-200",
};
const suiteStatusColors: Record<SuiteStatus, string> = {
  Passing: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Failing: "bg-red-50 text-red-700 border-red-200",
  Scheduled: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Running: "bg-blue-50 text-blue-700 border-blue-200",
  Paused: "bg-amber-50 text-amber-700 border-amber-200",
};
const envHealthColors: Record<EnvHealth, string> = {
  Healthy: "text-emerald-600",
  Degraded: "text-amber-600",
  Down: "text-red-600",
};
const envBorderColors: Record<EnvHealth, string> = {
  Healthy: "border-emerald-200 bg-emerald-50/20",
  Degraded: "border-amber-200 bg-amber-50/20",
  Down: "border-red-200 bg-red-50/20",
};

function StatusBadge({ s }: { s: string }) {
  const base = "text-xs font-semibold px-2 py-0.5 rounded-full border";
  const map: Record<string, string> = {
    ...execColors,
    ...planStatusColors,
    ...suiteStatusColors,
  };
  return <span className={cn(base, map[s] ?? "bg-slate-50 text-slate-600 border-slate-200")}>{s}</span>;
}

function PriorityBadge({ p }: { p: Priority }) {
  return <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", priorityColors[p])}>{p}</span>;
}

// ─── Mock data ─────────────────────────────────────────────────────────────────
const TEST_PLANS = [
  { name: "Sprint 42 Test Plan", owner: "alice.dev", status: "In Progress" as PlanStatus, progress: 68, total: 124, pass: 82, eta: "Dec 20, 2024" },
  { name: "Release 4.2 Plan", owner: "carol.ops", status: "Active" as PlanStatus, progress: 45, total: 312, pass: 76, eta: "Jan 10, 2025" },
  { name: "Regression Plan Q4", owner: "dave.eng", status: "In Progress" as PlanStatus, progress: 91, total: 520, pass: 94, eta: "Dec 18, 2024" },
  { name: "Smoke Suite v4.1", owner: "bob.qe", status: "Active" as PlanStatus, progress: 100, total: 48, pass: 100, eta: "Continuous" },
  { name: "Sanity Suite", owner: "alice.dev", status: "Active" as PlanStatus, progress: 100, total: 32, pass: 97, eta: "Continuous" },
  { name: "Performance Suite", owner: "dave.eng", status: "Planned" as PlanStatus, progress: 0, total: 86, pass: 0, eta: "Jan 5, 2025" },
  { name: "Security Test Suite", owner: "carol.ops", status: "Planned" as PlanStatus, progress: 0, total: 62, pass: 0, eta: "Jan 8, 2025" },
];

const TEST_CASES = [
  { id: "TC-001", module: "Authentication", feature: "Login Flow", priority: "Critical" as Priority, severity: "Critical", automation: "Automated", owner: "alice.dev", updated: "Dec 14", status: "Passed" as ExecStatus },
  { id: "TC-002", module: "Authentication", feature: "MFA Verification", priority: "Critical" as Priority, severity: "High", automation: "Automated", owner: "alice.dev", updated: "Dec 14", status: "Passed" as ExecStatus },
  { id: "TC-003", module: "Projects", feature: "Create Project", priority: "High" as Priority, severity: "High", automation: "Automated", owner: "carol.ops", updated: "Dec 13", status: "Failed" as ExecStatus },
  { id: "TC-004", module: "Projects", feature: "Project Permissions", priority: "High" as Priority, severity: "Medium", automation: "Manual", owner: "bob.qe", updated: "Dec 12", status: "Blocked" as ExecStatus },
  { id: "TC-005", module: "Audits", feature: "Create Audit", priority: "High" as Priority, severity: "High", automation: "Automated", owner: "dave.eng", updated: "Dec 14", status: "Passed" as ExecStatus },
  { id: "TC-006", module: "Audits", feature: "Audit Report Export", priority: "Medium" as Priority, severity: "Medium", automation: "Manual", owner: "bob.qe", updated: "Dec 11", status: "Not Run" as ExecStatus },
  { id: "TC-007", module: "Bugs", feature: "Bug Creation", priority: "High" as Priority, severity: "High", automation: "Automated", owner: "alice.dev", updated: "Dec 14", status: "Passed" as ExecStatus },
  { id: "TC-008", module: "Bugs", feature: "Bug Triage Workflow", priority: "Medium" as Priority, severity: "Medium", automation: "Manual", owner: "carol.ops", updated: "Dec 13", status: "In Progress" as ExecStatus },
  { id: "TC-009", module: "Reports", feature: "PDF Export", priority: "High" as Priority, severity: "High", automation: "Manual", owner: "bob.qe", updated: "Dec 14", status: "Failed" as ExecStatus },
  { id: "TC-010", module: "Reports", feature: "Scheduled Reports", priority: "Medium" as Priority, severity: "Low", automation: "Automated", owner: "dave.eng", updated: "Dec 12", status: "Passed" as ExecStatus },
  { id: "TC-011", module: "Dashboard", feature: "Executive Summary", priority: "Medium" as Priority, severity: "Medium", automation: "Automated", owner: "alice.dev", updated: "Dec 13", status: "Passed" as ExecStatus },
  { id: "TC-012", module: "Notifications", feature: "Email Alerts", priority: "Low" as Priority, severity: "Low", automation: "Automated", owner: "carol.ops", updated: "Dec 10", status: "Passed" as ExecStatus },
  { id: "TC-013", module: "API Gateway", feature: "Rate Limiting", priority: "High" as Priority, severity: "High", automation: "Automated", owner: "dave.eng", updated: "Dec 14", status: "Failed" as ExecStatus },
  { id: "TC-014", module: "Security", feature: "SQL Injection Prevention", priority: "Critical" as Priority, severity: "Critical", automation: "Automated", owner: "alice.dev", updated: "Dec 14", status: "Passed" as ExecStatus },
  { id: "TC-015", module: "Security", feature: "XSS Protection", priority: "Critical" as Priority, severity: "Critical", automation: "Automated", owner: "dave.eng", updated: "Dec 14", status: "Passed" as ExecStatus },
];

const TEST_SUITES_DATA = [
  { name: "Smoke", icon: Zap, status: "Passing" as SuiteStatus, pass: 100, time: "0m 48s", owner: "CI/CD Auto", schedule: "Every deploy", color: "emerald" },
  { name: "Regression", icon: RefreshCw, status: "Passing" as SuiteStatus, pass: 94, time: "52m 12s", owner: "Scheduled", schedule: "Daily 6 AM", color: "blue" },
  { name: "Sanity", icon: CheckCircle2, status: "Passing" as SuiteStatus, pass: 97, time: "8m 30s", owner: "CI/CD Auto", schedule: "Every deploy", color: "emerald" },
  { name: "Functional", icon: Layers, status: "Failing" as SuiteStatus, pass: 78, time: "34m 55s", owner: "bob.qe", schedule: "Sprint cycle", color: "red" },
  { name: "Integration", icon: Link2, status: "Failing" as SuiteStatus, pass: 84, time: "21m 40s", owner: "dave.eng", schedule: "Nightly", color: "red" },
  { name: "API", icon: Globe, status: "Passing" as SuiteStatus, pass: 96, time: "12m 18s", owner: "CI/CD Auto", schedule: "Every deploy", color: "indigo" },
  { name: "Performance", icon: TrendingUp, status: "Scheduled" as SuiteStatus, pass: 0, time: "—", owner: "dave.eng", schedule: "Weekly", color: "amber" },
  { name: "Security", icon: Shield, status: "Scheduled" as SuiteStatus, pass: 0, time: "—", owner: "carol.ops", schedule: "Weekly", color: "amber" },
];

const EXEC_DETAILS = {
  id: "TC-003",
  title: "Create Project — Invalid Permissions",
  description: "Verify that a standard user cannot create a project without admin role. The system must return a 403 Forbidden response and surface an error notification.",
  preconditions: "User is logged in as a non-admin account (e.g., bob.qe). Application is accessible and the Projects module is loaded.",
  steps: [
    "Log in as bob.qe (standard user)",
    "Navigate to Projects > New Project",
    "Fill in project name 'Test Project Alpha' and click Create",
    "Observe the API response and UI notification",
  ],
  expected: "System returns HTTP 403 Forbidden. UI displays 'You do not have permission to create projects.'",
  actual: "Project is created successfully without permission check. No error displayed.",
  bugs: ["BUG-0041 — Missing RBAC guard on POST /api/projects"],
  requirements: ["REQ-AUTH-07 — Role-based access control on project creation"],
  env: "Staging",
  browser: "Chrome 120.0",
  device: "Desktop (1440 × 900)",
  script: "tests/projects/create-project.spec.ts → L48",
};

const RTM = [
  { req: "REQ-AUTH-01", story: "US-101", feature: "Login", cases: 4, executed: 4, coverage: 100, bugs: 0 },
  { req: "REQ-AUTH-07", story: "US-108", feature: "RBAC", cases: 6, executed: 5, coverage: 83, bugs: 1 },
  { req: "REQ-PROJ-02", story: "US-202", feature: "Create Project", cases: 8, executed: 8, coverage: 100, bugs: 1 },
  { req: "REQ-PROJ-05", story: "US-207", feature: "Project Permissions", cases: 5, executed: 3, coverage: 60, bugs: 2 },
  { req: "REQ-AUDIT-03", story: "US-312", feature: "Audit Trail", cases: 7, executed: 7, coverage: 100, bugs: 0 },
  { req: "REQ-RPT-01", story: "US-401", feature: "PDF Export", cases: 4, executed: 4, coverage: 100, bugs: 1 },
  { req: "REQ-SEC-08", story: "US-503", feature: "XSS Protection", cases: 6, executed: 6, coverage: 100, bugs: 0 },
  { req: "REQ-PERF-02", story: "US-612", feature: "Response Time SLA", cases: 9, executed: 0, coverage: 0, bugs: 0 },
];

const FAILED_TESTS = [
  { tc: "TC-003", module: "Projects", reason: "POST /api/projects returns 201 for non-admin user — RBAC guard missing", env: "Staging", assignee: "carol.ops", bug: "BUG-0041", priority: "Critical" as Priority, eta: "Dec 16", status: "Open" as ExecStatus },
  { tc: "TC-009", module: "Reports", reason: "PDF renderer throws OOM error for reports > 200 rows", env: "Production", assignee: "bob.qe", bug: "BUG-0038", priority: "High" as Priority, eta: "Dec 17", status: "In Progress" as ExecStatus },
  { tc: "TC-013", module: "API Gateway", reason: "Rate limiter not enforced on /api/auth/login — 10k req/min allowed", env: "Staging", assignee: "dave.eng", bug: "BUG-0039", priority: "High" as Priority, eta: "Dec 18", status: "Open" as ExecStatus },
  { tc: "TC-018", module: "Audits", reason: "GET /api/audits?page=2 returns 504 Gateway Timeout on large datasets", env: "Production", assignee: "dave.eng", bug: "BUG-0040", priority: "Critical" as Priority, eta: "Dec 15", status: "In Progress" as ExecStatus },
  { tc: "TC-024", module: "Notifications", reason: "Email delivery delayed > 5 min when queue backlog exceeds 500 messages", env: "Staging", assignee: "carol.ops", bug: "BUG-0042", priority: "Medium" as Priority, eta: "Dec 20", status: "Open" as ExecStatus },
];

const ENVIRONMENTS = [
  { name: "Development", health: "Degraded" as EnvHealth, avail: 94.1, version: "v4.2.0-dev", execCount: 1240, pass: 72 },
  { name: "QA", health: "Healthy" as EnvHealth, avail: 99.2, version: "v4.2.0-beta", execCount: 4820, pass: 88 },
  { name: "UAT", health: "Healthy" as EnvHealth, avail: 99.6, version: "v4.1.9", execCount: 2140, pass: 91 },
  { name: "Staging", health: "Healthy" as EnvHealth, avail: 99.3, version: "v4.2.0-rc1", execCount: 3680, pass: 85 },
  { name: "Production", health: "Healthy" as EnvHealth, avail: 99.9, version: "v4.1.2", execCount: 980, pass: 98 },
];

const TIMELINE_EVENTS = [
  { time: "11:30", event: "Sprint 42 regression suite completed — 94% pass rate (520/552 tests)", type: "success" },
  { time: "10:42", event: "Bug BUG-0041 created and linked to TC-003 (RBAC guard missing on projects)", type: "error" },
  { time: "09:58", event: "TC-018 retest executed after partial fix — still failing, escalated to P0", type: "error" },
  { time: "09:15", event: "Smoke suite executed on Release 4.2-rc1 — 100% pass (48/48 tests)", type: "success" },
  { time: "08:00", event: "Nightly regression started across QA and Staging environments", type: "info" },
  { time: "Yesterday 18:40", event: "Sprint 41 closed — 97% test coverage achieved, 3 open defects carried over", type: "success" },
  { time: "Yesterday 15:20", event: "Performance suite scheduled for Jan 5, 2025 — plan reviewed by dave.eng", type: "info" },
  { time: "Yesterday 13:00", event: "12 new test cases imported from Excel for Security module", type: "info" },
];

// ─── Chart data ───────────────────────────────────────────────────────────────
const EXEC_TREND = [
  { week: "Wk 45", passed: 380, failed: 42, blocked: 18 },
  { week: "Wk 46", passed: 410, failed: 36, blocked: 14 },
  { week: "Wk 47", passed: 450, failed: 28, blocked: 12 },
  { week: "Wk 48", passed: 488, failed: 22, blocked: 9 },
  { week: "Wk 49", passed: 510, failed: 18, blocked: 7 },
  { week: "Wk 50", passed: 536, failed: 14, blocked: 5 },
];

const COVERAGE_TREND = [
  { sprint: "S38", coverage: 61, automation: 42 },
  { sprint: "S39", coverage: 67, automation: 48 },
  { sprint: "S40", coverage: 72, automation: 54 },
  { sprint: "S41", coverage: 78, automation: 61 },
  { sprint: "S42", coverage: 84, automation: 68 },
];

const MODULE_COV = [
  { module: "Auth", coverage: 100 },
  { module: "Projects", coverage: 83 },
  { module: "Audits", coverage: 91 },
  { module: "Bugs", coverage: 88 },
  { module: "Reports", coverage: 74 },
  { module: "API GW", coverage: 79 },
  { module: "Security", coverage: 96 },
  { module: "Notifs", coverage: 65 },
];

const PASS_FAIL_DIST = [
  { name: "Passed", value: 536, fill: "#10b981" },
  { name: "Failed", value: 14, fill: "#ef4444" },
  { name: "Blocked", value: 5, fill: "#f97316" },
  { name: "Skipped", value: 8, fill: "#94a3b8" },
  { name: "Not Run", value: 68, fill: "#e2e8f0" },
];

const DEFECT_LEAKAGE = [
  { sprint: "S38", leakage: 12 },
  { sprint: "S39", leakage: 9 },
  { sprint: "S40", leakage: 7 },
  { sprint: "S41", leakage: 5 },
  { sprint: "S42", leakage: 3 },
];

const actDot: Record<string, string> = {
  success: "bg-emerald-500", error: "bg-red-500", warn: "bg-amber-500", info: "bg-primary",
};

const fadeUp = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

// ─── Main component ───────────────────────────────────────────────────────────
export default function TestManagement() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [expandedTC, setExpandedTC] = useState(false);
  const [running, setRunning] = useState(false);

  function handleRun() {
    setRunning(true);
    setTimeout(() => { setRunning(false); toast({ title: "Test Suite Execution Started", description: "536 test cases queued across 8 suites." }); }, 2000);
  }
  function qAction(msg: string) { return () => toast({ title: msg }); }

  const kpis = [
    { label: "Total Test Cases", value: 631, icon: ClipboardList, color: "text-primary", bg: "bg-primary/5 border-primary/20" },
    { label: "Passed", value: 536, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
    { label: "Failed", value: 14, icon: XCircle, color: "text-red-600", bg: "bg-red-50 border-red-200" },
    { label: "Blocked", value: 5, icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
    { label: "Not Executed", value: 76, icon: Clock, color: "text-slate-500", bg: "bg-slate-50 border-slate-200" },
    { label: "Automation Coverage", value: 68, unit: "%", icon: Zap, color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
    { label: "Active Test Suites", value: 6, icon: Layers, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
    { label: "AI Confidence", value: 93, unit: "%", icon: Sparkles, color: "text-violet-600", bg: "bg-violet-50 border-violet-200" },
  ];

  const execCards = [
    { label: "Passed", value: 536, color: "text-emerald-600", icon: CheckCircle2 },
    { label: "Failed", value: 14, color: "text-red-600", icon: XCircle },
    { label: "Blocked", value: 5, color: "text-orange-600", icon: AlertTriangle },
    { label: "Skipped", value: 8, color: "text-slate-500", icon: Clock },
    { label: "Not Run", value: 68, color: "text-slate-400", icon: Clock },
    { label: "Avg Exec Time", badge: "2m 14s", color: "text-primary", icon: Clock },
    { label: "Defect Leakage", badge: "3.2%", color: "text-amber-600", icon: BugIcon },
    { label: "Exec Progress", value: 85, unit: "%", color: "text-indigo-600", icon: Activity },
  ];

  const priorityBadge: Record<string, string> = {
    P0: "bg-red-50 text-red-700 border-red-200",
    P1: "bg-orange-50 text-orange-700 border-orange-200",
    P2: "bg-amber-50 text-amber-700 border-amber-200",
  };

  const aiRisks = [
    { module: "Projects", issue: "RBAC guard absent on POST /api/projects — 1 critical failing test case (TC-003)", p: "P0" },
    { module: "Reports", issue: "PDF renderer OOM crash for large datasets — affects 100% of enterprise-sized exports (TC-009)", p: "P1" },
    { module: "API Gateway", issue: "Rate limiter bypass allows unlimited requests to /api/auth/login (TC-013)", p: "P1" },
  ];
  const aiActions = [
    { action: "Add RBAC middleware guard to POST /api/projects and write 4 additional permission boundary tests.", eta: "4 hrs", p: "P0" },
    { action: "Refactor PDF export to use streaming renderer — eliminates OOM for any dataset size.", eta: "1–2 days", p: "P1" },
    { action: "Enable rate limiter on Auth API and add automated rate-limit regression tests to CI/CD.", eta: "6 hrs", p: "P1" },
    { action: "Deduplicate 14 overlapping test cases across Authentication and Security modules.", eta: "2 hrs", p: "P2" },
    { action: "Add 28 missing test cases for Notifications module to raise coverage from 65% to 90%.", eta: "1 day", p: "P2" },
  ];

  const filteredCases = TEST_CASES.filter(
    (tc) =>
      tc.id.toLowerCase().includes(search.toLowerCase()) ||
      tc.module.toLowerCase().includes(search.toLowerCase()) ||
      tc.feature.toLowerCase().includes(search.toLowerCase()) ||
      tc.owner.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Test Management</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-11">Centralized management of manual, automated, regression, smoke and release test cases</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={qAction("Share link copied")}><Share2 className="h-3.5 w-3.5 mr-1.5" />Share</Button>
          <Button variant="outline" size="sm" onClick={qAction("Exporting Test Plan…")}><Download className="h-3.5 w-3.5 mr-1.5" />Export Test Plan</Button>
          <Button variant="outline" size="sm" onClick={qAction("Importing test cases…")}><Upload className="h-3.5 w-3.5 mr-1.5" />Import Test Cases</Button>
          <Button variant="outline" size="sm" disabled={running} onClick={handleRun}>
            {running ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
            {running ? "Running…" : "Execute Test Suite"}
          </Button>
          <Button size="sm" onClick={qAction("Test Case created")}><Plus className="h-3.5 w-3.5 mr-1.5" />Create Test Case</Button>
        </div>
      </div>

      {/* KPI Cards */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <motion.div key={k.label} variants={fadeUp}>
              <Card className={cn("border", k.bg)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground leading-tight">{k.label}</p>
                    <Icon className={cn("h-4 w-4 flex-shrink-0", k.color)} />
                  </div>
                  <div className="flex items-baseline gap-0.5">
                    <span className={cn("text-2xl font-bold tabular-nums", k.color)}>
                      <AnimatedCounter value={k.value} />
                    </span>
                    {k.unit && <span className="text-xs text-muted-foreground">{k.unit}</span>}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Test Plan Overview */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
        <Card>
          <CardHeader className="pb-3">
            <SectionHeading icon={FileText} title="Test Plan Overview" subtitle="Progress and status of all active and upcoming test plans" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {TEST_PLANS.map((plan) => (
                <div key={plan.name} className="rounded-xl border border-border p-4 hover:bg-muted/10 transition-colors">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <p className="text-sm font-semibold text-foreground leading-snug">{plan.name}</p>
                    <StatusBadge s={plan.status} />
                  </div>
                  <div className="mb-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-bold text-primary">{plan.progress}%</span>
                    </div>
                    <Progress value={plan.progress} className="h-1.5" />
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
                    <span className="text-muted-foreground">Owner</span><span className="font-medium truncate">{plan.owner}</span>
                    <span className="text-muted-foreground">Total Cases</span><span className="font-medium">{plan.total}</span>
                    <span className="text-muted-foreground">Pass %</span>
                    <span className={cn("font-bold", plan.pass >= 90 ? "text-emerald-600" : plan.pass >= 70 ? "text-amber-600" : "text-red-600")}>
                      {plan.pass > 0 ? `${plan.pass}%` : "—"}
                    </span>
                    <span className="text-muted-foreground">ETA</span><span className="font-medium">{plan.eta}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Test Case Management Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.14 }}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <SectionHeading icon={ClipboardList} title="Test Case Management" subtitle={`${filteredCases.length} test cases`} />
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search test cases…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-8 text-xs w-52"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={qAction("Filters applied")}>
                  <Filter className="h-3.5 w-3.5 mr-1.5" />Filter
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs">Test ID</TableHead>
                    <TableHead className="text-xs">Module</TableHead>
                    <TableHead className="text-xs">Feature</TableHead>
                    <TableHead className="text-xs">Priority</TableHead>
                    <TableHead className="text-xs">Severity</TableHead>
                    <TableHead className="text-xs">Automation</TableHead>
                    <TableHead className="text-xs">Owner</TableHead>
                    <TableHead className="text-xs">Last Updated</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCases.map((tc) => (
                    <TableRow key={tc.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-mono text-xs font-semibold text-primary">{tc.id}</TableCell>
                      <TableCell className="text-xs">{tc.module}</TableCell>
                      <TableCell className="text-xs">{tc.feature}</TableCell>
                      <TableCell><PriorityBadge p={tc.priority} /></TableCell>
                      <TableCell className="text-xs">{tc.severity}</TableCell>
                      <TableCell>
                        <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", tc.automation === "Automated" ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-slate-50 text-slate-600 border-slate-200")}>
                          {tc.automation}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">{tc.owner}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{tc.updated}</TableCell>
                      <TableCell><StatusBadge s={tc.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Test Execution Dashboard */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.17 }}>
        <Card>
          <CardHeader className="pb-3">
            <SectionHeading icon={Activity} title="Test Execution Dashboard" subtitle="Aggregate execution metrics for the current sprint cycle" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {execCards.map((c) => {
                const CIcon = c.icon;
                return (
                  <div key={c.label} className="rounded-xl border border-border p-3 hover:bg-muted/20 transition-colors">
                    <CIcon className="h-4 w-4 text-primary mx-auto mb-1.5" />
                    <p className="text-[10px] text-muted-foreground text-center mb-1 leading-tight">{c.label}</p>
                    {c.badge ? (
                      <p className={cn("text-sm font-bold text-center", c.color)}>{c.badge}</p>
                    ) : (
                      <p className={cn("text-lg font-bold tabular-nums text-center", c.color)}>
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

      {/* Test Suites */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}>
        <Card>
          <CardHeader className="pb-3">
            <SectionHeading icon={Layers} title="Test Suites" subtitle="Status and pass rates for all active test collections" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {TEST_SUITES_DATA.map((s) => {
                const SIcon = s.icon;
                return (
                  <div key={s.name} className={cn("rounded-xl border p-4", s.status === "Failing" ? "border-red-200 bg-red-50/10" : s.status === "Scheduled" ? "border-amber-200 bg-amber-50/10" : "border-border")}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
                          <SIcon className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <p className="text-sm font-semibold">{s.name}</p>
                      </div>
                      <StatusBadge s={s.status} />
                    </div>
                    {s.pass > 0 && (
                      <div className="mb-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Pass Rate</span>
                          <span className={cn("font-bold", s.pass === 100 ? "text-emerald-600" : s.pass >= 85 ? "text-amber-600" : "text-red-600")}>{s.pass}%</span>
                        </div>
                        <Progress value={s.pass} className="h-1.5" />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-0.5 text-xs">
                      <span className="text-muted-foreground">Duration</span><span className="font-medium text-right">{s.time}</span>
                      <span className="text-muted-foreground">Owner</span><span className="font-medium text-right truncate">{s.owner}</span>
                      <span className="text-muted-foreground">Schedule</span><span className="font-medium text-right">{s.schedule}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Test Case Detail (expandable) */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.22 }}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <SectionHeading icon={BookOpen} title="Test Case Detail" subtitle={`${EXEC_DETAILS.id} — ${EXEC_DETAILS.title}`} />
              <Button variant="ghost" size="sm" onClick={() => setExpandedTC(!expandedTC)}>
                <ChevronDown className={cn("h-4 w-4 transition-transform", expandedTC ? "rotate-180" : "")} />
                {expandedTC ? "Collapse" : "Expand"}
              </Button>
            </div>
          </CardHeader>
          {expandedTC && (
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Description</p>
                    <p className="text-sm text-foreground">{EXEC_DETAILS.description}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Preconditions</p>
                    <p className="text-sm text-foreground">{EXEC_DETAILS.preconditions}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Test Steps</p>
                    <ol className="space-y-1">
                      {EXEC_DETAILS.steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Expected Result</p>
                    <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg p-2 border border-emerald-100">{EXEC_DETAILS.expected}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Actual Result</p>
                    <p className="text-sm text-red-700 bg-red-50 rounded-lg p-2 border border-red-100">{EXEC_DETAILS.actual}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div><p className="text-muted-foreground mb-0.5">Environment</p><p className="font-medium">{EXEC_DETAILS.env}</p></div>
                    <div><p className="text-muted-foreground mb-0.5">Browser</p><p className="font-medium">{EXEC_DETAILS.browser}</p></div>
                    <div><p className="text-muted-foreground mb-0.5">Device</p><p className="font-medium">{EXEC_DETAILS.device}</p></div>
                    <div><p className="text-muted-foreground mb-0.5">Automation Script</p><p className="font-mono text-[11px]">{EXEC_DETAILS.script}</p></div>
                    <div>
                      <p className="text-muted-foreground mb-1">Linked Bugs</p>
                      {EXEC_DETAILS.bugs.map((b) => (
                        <span key={b} className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full block w-fit">{b}</span>
                      ))}
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Linked Requirements</p>
                      {EXEC_DETAILS.requirements.map((r) => (
                        <span key={r} className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full block w-fit">{r}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </motion.div>

      {/* AI Test Analysis */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.24 }}>
        <Card className="border border-violet-200 bg-gradient-to-br from-violet-50/80 to-indigo-50/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <SectionHeading icon={Bot} title="AI Test Analysis" subtitle="Root cause analysis, flaky test detection and coverage recommendations" />
              <Badge variant="outline" className="text-xs bg-violet-100 border-violet-300 text-violet-700 gap-1">
                <Sparkles className="h-3 w-3" /> AI · 93% confidence
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Most Failed Modules & Root Causes
                </p>
                <div className="space-y-2">
                  {aiRisks.map((r, i) => (
                    <div key={i} className="rounded-lg border border-violet-100 bg-white/60 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-foreground">{r.module}</p>
                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full border", priorityBadge[r.p])}>{r.p}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{r.issue}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-violet-500" /> Recommended Improvements
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
              <div className="md:col-span-2 border-t border-violet-200 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Flaky Tests Detected</p>
                  <p className="text-sm text-foreground">6 test cases show intermittent pass/fail behaviour over the last 10 runs — primarily in Integration and Audits modules due to timing issues.</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Missing Coverage</p>
                  <p className="text-sm text-foreground">Notifications module has only 65% coverage. 28 additional test cases recommended to cover edge cases in email delivery and queue management.</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Estimated Coverage Gain</p>
                  <div className="flex items-center gap-2 mb-1">
                    <Progress value={84} className="h-2 flex-1" />
                    <span className="text-xs font-bold text-violet-700">84% → 94%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">After completing all recommended improvements</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Requirement Traceability Matrix */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.26 }}>
        <Card>
          <CardHeader className="pb-3">
            <SectionHeading icon={Link2} title="Requirement Traceability Matrix" subtitle="Mapping from requirements to test cases, execution and coverage" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs">Requirement</TableHead>
                    <TableHead className="text-xs">User Story</TableHead>
                    <TableHead className="text-xs">Feature</TableHead>
                    <TableHead className="text-xs text-center">Test Cases</TableHead>
                    <TableHead className="text-xs text-center">Executed</TableHead>
                    <TableHead className="text-xs">Coverage</TableHead>
                    <TableHead className="text-xs text-center">Bug Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {RTM.map((r) => (
                    <TableRow key={r.req} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-mono text-xs font-semibold text-primary">{r.req}</TableCell>
                      <TableCell className="font-mono text-xs">{r.story}</TableCell>
                      <TableCell className="text-xs">{r.feature}</TableCell>
                      <TableCell className="text-center text-xs font-medium">{r.cases}</TableCell>
                      <TableCell className="text-center text-xs font-medium">{r.executed}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <Progress value={r.coverage} className="h-1.5 flex-1" />
                          <span className={cn("text-xs font-bold w-10 text-right", r.coverage === 100 ? "text-emerald-600" : r.coverage >= 70 ? "text-amber-600" : "text-red-600")}>
                            {r.coverage}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {r.bugs > 0 ? (
                          <span className="text-xs font-bold text-red-600">{r.bugs}</span>
                        ) : (
                          <span className="text-xs text-emerald-600">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Test Coverage Analytics */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.28 }}>
        <Card>
          <CardHeader className="pb-3">
            <SectionHeading icon={BarChart2} title="Test Coverage Analytics" subtitle="Execution trends, pass/fail distribution, module coverage and defect leakage" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Execution Trend */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3">Execution Trend (Last 6 Weeks)</p>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={EXEC_TREND} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="passGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="failGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="passed" stroke="#10b981" strokeWidth={2} fill="url(#passGrad)" name="Passed" />
                    <Area type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} fill="url(#failGrad)" name="Failed" />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Coverage Trend */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3">Coverage & Automation Trend</p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={COVERAGE_TREND} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="sprint" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis domain={[30, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="coverage" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="Coverage %" />
                    <Line type="monotone" dataKey="automation" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Automation %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Pass vs Fail */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3">Pass vs Fail Distribution</p>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={PASS_FAIL_DIST} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                      {PASS_FAIL_DIST.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Module Coverage */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3">Module Coverage %</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={MODULE_COV} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="module" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="coverage" name="Coverage %" radius={[3, 3, 0, 0]}>
                      {MODULE_COV.map((entry, i) => (
                        <Cell key={i} fill={entry.coverage >= 90 ? "#10b981" : entry.coverage >= 75 ? "#f59e0b" : "#ef4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Defect Leakage */}
              <div className="lg:col-span-2">
                <p className="text-xs font-semibold text-muted-foreground mb-3">Defect Leakage Trend (Defects escaped to Production per Sprint)</p>
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={DEFECT_LEAKAGE} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="leakGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="sprint" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="leakage" stroke="#f59e0b" strokeWidth={2} fill="url(#leakGrad)" name="Defect Leakage" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Failed Tests Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.3 }}>
        <Card>
          <CardHeader className="pb-3">
            <SectionHeading icon={XCircle} title="Failed Tests" subtitle="Active test failures with linked bugs, owners and resolution ETA" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs">Test Case</TableHead>
                    <TableHead className="text-xs">Module</TableHead>
                    <TableHead className="text-xs">Failure Reason</TableHead>
                    <TableHead className="text-xs">Environment</TableHead>
                    <TableHead className="text-xs">Assigned To</TableHead>
                    <TableHead className="text-xs">Bug Linked</TableHead>
                    <TableHead className="text-xs">Priority</TableHead>
                    <TableHead className="text-xs">ETA</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {FAILED_TESTS.map((f) => (
                    <TableRow key={f.tc} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-mono text-xs font-semibold text-primary">{f.tc}</TableCell>
                      <TableCell className="text-xs">{f.module}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">{f.reason}</TableCell>
                      <TableCell className="text-xs">{f.env}</TableCell>
                      <TableCell className="text-xs">{f.assignee}</TableCell>
                      <TableCell>
                        <span className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">{f.bug}</span>
                      </TableCell>
                      <TableCell><PriorityBadge p={f.priority} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{f.eta}</TableCell>
                      <TableCell><StatusBadge s={f.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Execution Timeline + Environments */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Timeline */}
        <motion.div
          className="lg:col-span-3"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.32 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-3">
              <SectionHeading icon={Activity} title="Test Execution Timeline" subtitle="Recent test events, suite executions and sprint milestones" />
            </CardHeader>
            <CardContent className="space-y-0">
              {TIMELINE_EVENTS.map((item, i) => (
                <div key={i} className="flex items-start gap-3 py-3 border-b border-border last:border-0">
                  <div className={cn("h-2 w-2 rounded-full mt-1.5 flex-shrink-0", actDot[item.type])} />
                  <p className="flex-1 text-xs text-foreground leading-snug">{item.event}</p>
                  <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">{item.time}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Test Environments */}
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.34 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-3">
              <SectionHeading icon={Server} title="Test Environments" subtitle="Health and execution metrics per environment" />
            </CardHeader>
            <CardContent className="space-y-3">
              {ENVIRONMENTS.map((env) => (
                <div key={env.name} className={cn("rounded-xl border p-3", envBorderColors[env.health])}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-foreground">{env.name}</p>
                    <span className={cn("text-xs font-semibold", envHealthColors[env.health])}>{env.health}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                    <span className="text-muted-foreground">Availability</span>
                    <span className={cn("font-medium", env.avail < 99 ? "text-amber-600" : "text-emerald-600")}>{env.avail}%</span>
                    <span className="text-muted-foreground">Version</span><span className="font-mono text-[11px]">{env.version}</span>
                    <span className="text-muted-foreground">Executions</span><span className="font-medium">{env.execCount.toLocaleString()}</span>
                    <span className="text-muted-foreground">Pass %</span>
                    <span className={cn("font-bold", env.pass >= 90 ? "text-emerald-600" : env.pass >= 80 ? "text-amber-600" : "text-red-600")}>{env.pass}%</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.36 }}>
        <Card>
          <CardHeader className="pb-3">
            <SectionHeading icon={Zap} title="Quick Actions" subtitle="Common test management operations" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Create Test Case", icon: Plus, handler: qAction("Test Case created"), variant: "default" as const },
                { label: "Run Smoke Suite", icon: Zap, handler: qAction("Smoke suite started (48 tests)"), variant: "outline" as const },
                { label: "Run Regression", icon: RefreshCw, handler: handleRun, variant: "outline" as const },
                { label: "Import Excel", icon: Upload, handler: qAction("Import dialog opened"), variant: "outline" as const },
                { label: "Generate Test Report", icon: FileText, handler: qAction("Generating test report…"), variant: "outline" as const },
                { label: "View Failed Tests", icon: XCircle, handler: qAction("Navigating to failed tests"), variant: "outline" as const },
                { label: "Assign Tester", icon: Users, handler: qAction("Tester assignment dialog opened"), variant: "outline" as const },
                { label: "Export Results", icon: Download, handler: qAction("Exporting test results…"), variant: "outline" as const },
              ].map(({ label, icon: Icon, handler, variant }) => (
                <Button key={label} variant={variant} size="sm" className="gap-1.5" onClick={handler}>
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
