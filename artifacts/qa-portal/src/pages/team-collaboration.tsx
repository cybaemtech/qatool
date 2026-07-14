import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AnimatedCounter } from "@/components/animated-counter";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, LineChart, Line, Legend,
} from "recharts";
import {
  Users, MessageSquare, Video, Plus, Share2, Download,
  CheckCircle2, Clock, AlertTriangle, Zap, Bot, Sparkles,
  ChevronRight, Search, FileText, Send, Paperclip,
  Calendar, Filter, Phone, Mail, MapPin, Star,
  TrendingUp, Activity, Layers, RefreshCw, BarChart2,
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

type OnlineStatus = "Online" | "Away" | "Busy" | "Offline" | "In Meeting";
type TaskPriority = "Critical" | "High" | "Medium" | "Low";
type KanbanCol = "Backlog" | "In Progress" | "QA Review" | "Completed";
type ApprovalStatus = "Pending" | "Approved" | "Rejected" | "In Review";

const statusDot: Record<OnlineStatus, string> = {
  Online: "bg-emerald-500",
  Away: "bg-amber-400",
  Busy: "bg-red-500",
  Offline: "bg-slate-300",
  "In Meeting": "bg-blue-500",
};
const statusLabel: Record<OnlineStatus, string> = {
  Online: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Away: "bg-amber-50 text-amber-700 border-amber-200",
  Busy: "bg-red-50 text-red-700 border-red-200",
  Offline: "bg-slate-50 text-slate-500 border-slate-200",
  "In Meeting": "bg-blue-50 text-blue-700 border-blue-200",
};
const priorityColors: Record<TaskPriority, string> = {
  Critical: "bg-red-50 text-red-700 border-red-200",
  High: "bg-orange-50 text-orange-700 border-orange-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  Low: "bg-emerald-50 text-emerald-600 border-emerald-200",
};
const approvalBadge: Record<ApprovalStatus, string> = {
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Rejected: "bg-red-50 text-red-700 border-red-200",
  "In Review": "bg-blue-50 text-blue-700 border-blue-200",
};

function PBadge({ p }: { p: TaskPriority }) {
  return <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full border", priorityColors[p])}>{p}</span>;
}
function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}
const avatarColors = [
  "bg-indigo-100 text-indigo-700", "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700", "bg-amber-100 text-amber-700",
  "bg-blue-100 text-blue-700", "bg-rose-100 text-rose-700",
  "bg-teal-100 text-teal-700", "bg-orange-100 text-orange-700",
  "bg-fuchsia-100 text-fuchsia-700", "bg-cyan-100 text-cyan-700",
  "bg-lime-100 text-lime-700", "bg-pink-100 text-pink-700",
];

// ─── Mock data ─────────────────────────────────────────────────────────────────
const TEAM_MEMBERS = [
  { name: "Alice Chen", role: "Senior QA Engineer", dept: "QA", sprint: "Sprint 43", task: "Auth Regression Suite", status: "Online" as OnlineStatus, workload: 82, avail: 18, bugs: 4, tests: 28, done: 12, response: "< 2 min" },
  { name: "Bob Kumar", role: "QA Lead", dept: "QA", sprint: "Sprint 43", task: "Release 4.3 Sign-off", status: "In Meeting" as OnlineStatus, workload: 95, avail: 5, bugs: 2, tests: 15, done: 8, response: "~5 min" },
  { name: "Carol Singh", role: "DevOps Engineer", dept: "Platform", sprint: "Sprint 43", task: "CI/CD Pipeline Config", status: "Busy" as OnlineStatus, workload: 78, avail: 22, bugs: 1, tests: 0, done: 6, response: "~10 min" },
  { name: "Dave Park", role: "Backend Engineer", dept: "Engineering", sprint: "Sprint 43", task: "API Rate Limiter Fix", status: "Online" as OnlineStatus, workload: 65, avail: 35, bugs: 3, tests: 8, done: 10, response: "< 1 min" },
  { name: "Emma Walsh", role: "Security Analyst", dept: "Security", sprint: "Sprint 43", task: "OWASP Audit Review", status: "Online" as OnlineStatus, workload: 88, avail: 12, bugs: 6, tests: 22, done: 9, response: "~3 min" },
  { name: "Frank Liu", role: "QA Engineer", dept: "QA", sprint: "Sprint 43", task: "Regression Test Cases", status: "Away" as OnlineStatus, workload: 55, avail: 45, bugs: 2, tests: 31, done: 15, response: "~8 min" },
  { name: "Grace Obi", role: "Product Manager", dept: "Product", sprint: "Sprint 43", task: "Sprint 43 Planning", status: "In Meeting" as OnlineStatus, workload: 70, avail: 30, bugs: 0, tests: 0, done: 7, response: "~15 min" },
  { name: "Hiro Tanaka", role: "Frontend Engineer", dept: "Engineering", sprint: "Sprint 43", task: "Dashboard Bug Fixes", status: "Online" as OnlineStatus, workload: 60, avail: 40, bugs: 5, tests: 4, done: 11, response: "< 2 min" },
  { name: "Iris Patel", role: "Automation Engineer", dept: "QA", sprint: "Sprint 43", task: "Selenium Framework", status: "Busy" as OnlineStatus, workload: 92, avail: 8, bugs: 1, tests: 42, done: 18, response: "~5 min" },
  { name: "Jake Morris", role: "Scrum Master", dept: "Delivery", sprint: "Sprint 43", task: "Impediment Resolution", status: "Online" as OnlineStatus, workload: 45, avail: 55, bugs: 0, tests: 0, done: 14, response: "< 1 min" },
  { name: "Kate Nguyen", role: "Data Analyst", dept: "Analytics", sprint: "Sprint 43", task: "Test Metrics Dashboard", status: "Offline" as OnlineStatus, workload: 50, avail: 50, bugs: 0, tests: 6, done: 5, response: "N/A" },
  { name: "Liam Okafor", role: "QA Engineer", dept: "QA", sprint: "Sprint 43", task: "API Contract Tests", status: "Online" as OnlineStatus, workload: 72, avail: 28, bugs: 3, tests: 19, done: 13, response: "~3 min" },
];

const ACTIVITY_FEED = [
  { user: "Bob Kumar", action: "approved Release 4.3 go/no-go decision", time: "2 min ago", type: "success", module: "Release" },
  { user: "Iris Patel", action: "triggered API regression suite — 96% pass rate (284/296 tests)", time: "8 min ago", type: "success", module: "Testing" },
  { user: "Alice Chen", action: "assigned BUG-0041 (RBAC guard missing) to dave.eng — priority P0", time: "14 min ago", type: "error", module: "Bugs" },
  { user: "Emma Walsh", action: "completed OWASP security review — 3 new findings added to backlog", time: "22 min ago", type: "warn", module: "Security" },
  { user: "Grace Obi", action: "started Sprint 43 planning meeting with 8 attendees", time: "35 min ago", type: "info", module: "Sprint" },
  { user: "Frank Liu", action: "imported 12 new test cases from Excel for Notifications module", time: "48 min ago", type: "info", module: "Testing" },
  { user: "Carol Singh", action: "deployed Release 4.2-rc2 to Staging — deployment took 4m 12s", time: "1 hr ago", type: "success", module: "Deployment" },
  { user: "Dave Park", action: "updated requirement REQ-AUTH-07 — added acceptance criteria", time: "1 hr 20 min ago", type: "info", module: "Requirements" },
  { user: "Jake Morris", action: "resolved impediment: staging environment downtime — env restored", time: "2 hrs ago", type: "success", module: "Delivery" },
];

const CHAT_CHANNELS = [
  { name: "#general", unread: 3, lastMsg: "Jake Morris: Sprint planning is set for 10 AM tomorrow", online: 24, pinned: "All hands retro Friday 3 PM" },
  { name: "#regression-testing", unread: 12, lastMsg: "Iris Patel: Regression suite completed — 96% pass rate ✅", online: 8, pinned: "Run regression after every deployment" },
  { name: "#api-team", unread: 0, lastMsg: "Dave Park: Rate limiter fix is in review — ETA 4 hrs", online: 5, pinned: null },
  { name: "#security", unread: 5, lastMsg: "Emma Walsh: OWASP findings shared in Security_Audit.pdf", online: 3, pinned: "Security review every Friday" },
  { name: "#release-planning", unread: 1, lastMsg: "Bob Kumar: Release 4.3 approved — deploying Monday 6 AM", online: 7, pinned: "Release window: Mon 06:00–08:00 UTC" },
];

const CHAT_MESSAGES = [
  { user: "Alice Chen", msg: "Auth regression is running — smoke tests at 100% so far 🚀", time: "10:38", color: avatarColors[0] },
  { user: "Bob Kumar", msg: "Great! Let's aim to close all P0 bugs before end of day", time: "10:40", color: avatarColors[1] },
  { user: "Iris Patel", msg: "API suite triggered — will share results in ~12 minutes", time: "10:42", color: avatarColors[8] },
  { user: "Frank Liu", msg: "Just imported the 12 new Notifications test cases from the Excel sheet", time: "10:48", color: avatarColors[5] },
  { user: "Alice Chen", msg: "Regression complete — 96% pass rate, 14 failures logged in the tracker", time: "10:51", color: avatarColors[0] },
];
const TYPING_USER = "Dave Park";

const KANBAN: { id: string; title: string; priority: TaskPriority; owner: string; sprint: string; due: string; labels: string[]; progress: number; hours: number; col: KanbanCol }[] = [
  { id: "TASK-118", title: "RBAC Guard — POST /api/projects", priority: "Critical", owner: "Dave Park", sprint: "S43", due: "Dec 16", labels: ["Security", "Backend"], progress: 40, hours: 8, col: "In Progress" },
  { id: "TASK-119", title: "PDF Renderer OOM Fix", priority: "High", owner: "Bob Kumar", sprint: "S43", due: "Dec 17", labels: ["Reports", "Backend"], progress: 20, hours: 12, col: "In Progress" },
  { id: "TASK-120", title: "Rate Limiter — Auth API", priority: "High", owner: "Dave Park", sprint: "S43", due: "Dec 18", labels: ["API", "Security"], progress: 60, hours: 6, col: "QA Review" },
  { id: "TASK-121", title: "Notifications Module Test Cases", priority: "Medium", owner: "Frank Liu", sprint: "S43", due: "Dec 19", labels: ["Testing"], progress: 0, hours: 4, col: "Backlog" },
  { id: "TASK-122", title: "OWASP Top 10 Checklist", priority: "High", owner: "Emma Walsh", sprint: "S43", due: "Dec 20", labels: ["Security", "Compliance"], progress: 75, hours: 10, col: "QA Review" },
  { id: "TASK-123", title: "Sprint 43 Retrospective Prep", priority: "Low", owner: "Jake Morris", sprint: "S43", due: "Dec 21", labels: ["Process"], progress: 90, hours: 2, col: "QA Review" },
  { id: "TASK-124", title: "API Contract Test Suite", priority: "Medium", owner: "Liam Okafor", sprint: "S43", due: "Dec 18", labels: ["API", "Testing"], progress: 50, hours: 8, col: "In Progress" },
  { id: "TASK-115", title: "Smoke Suite Automation", priority: "Medium", owner: "Iris Patel", sprint: "S43", due: "Dec 14", labels: ["Automation"], progress: 100, hours: 6, col: "Completed" },
  { id: "TASK-116", title: "Docker Base Image Upgrade", priority: "High", owner: "Carol Singh", sprint: "S43", due: "Dec 15", labels: ["DevOps"], progress: 100, hours: 3, col: "Completed" },
  { id: "TASK-117", title: "Executive Report Metrics", priority: "Low", owner: "Kate Nguyen", sprint: "S43", due: "Dec 13", labels: ["Analytics"], progress: 100, hours: 4, col: "Completed" },
  { id: "TASK-125", title: "Performance Baseline Testing", priority: "Medium", owner: "Alice Chen", sprint: "S44", due: "Jan 5", labels: ["Performance"], progress: 0, hours: 20, col: "Backlog" },
  { id: "TASK-126", title: "Webhook Integration Tests", priority: "Low", owner: "Liam Okafor", sprint: "S44", due: "Jan 8", labels: ["Integration", "API"], progress: 0, hours: 6, col: "Backlog" },
];

const KANBAN_COLS: KanbanCol[] = ["Backlog", "In Progress", "QA Review", "Completed"];
const colColors: Record<KanbanCol, string> = {
  Backlog: "bg-slate-50 border-slate-200",
  "In Progress": "bg-blue-50 border-blue-200",
  "QA Review": "bg-amber-50 border-amber-200",
  Completed: "bg-emerald-50 border-emerald-200",
};
const colHeaderColors: Record<KanbanCol, string> = {
  Backlog: "text-slate-600",
  "In Progress": "text-blue-600",
  "QA Review": "text-amber-700",
  Completed: "text-emerald-700",
};

const APPROVALS = [
  { name: "Release 4.3 Go/No-Go", approver: "Bob Kumar", status: "Approved" as ApprovalStatus, eta: "—", priority: "Critical" as TaskPriority },
  { name: "Regression Sign-off S43", approver: "Alice Chen", status: "In Review" as ApprovalStatus, eta: "2 hrs", priority: "High" as TaskPriority },
  { name: "Security Audit Closure", approver: "Emma Walsh", status: "Pending" as ApprovalStatus, eta: "Dec 18", priority: "High" as TaskPriority },
  { name: "Performance Baseline", approver: "Dave Park", status: "Pending" as ApprovalStatus, eta: "Jan 5", priority: "Medium" as TaskPriority },
  { name: "API Contract Freeze", approver: "Liam Okafor", status: "In Review" as ApprovalStatus, eta: "Dec 19", priority: "Medium" as TaskPriority },
  { name: "Sprint 43 Retrospective", approver: "Jake Morris", status: "Approved" as ApprovalStatus, eta: "—", priority: "Low" as TaskPriority },
];

const CALENDAR_EVENTS = [
  { title: "Daily Standup", time: "Today 9:00 AM", type: "success", attendees: 12 },
  { title: "Sprint 43 Planning", time: "Tomorrow 10:00 AM", type: "info", attendees: 15 },
  { title: "Regression Run", time: "Dec 16 — Automated", type: "warn", attendees: 0 },
  { title: "Client Demo v4.3", time: "Dec 18 2:00 PM", type: "success", attendees: 8 },
  { title: "Release Window 4.3", time: "Dec 23 6:00 AM UTC", type: "error", attendees: 6 },
  { title: "Security Review", time: "Dec 20 11:00 AM", type: "warn", attendees: 5 },
  { title: "Sprint 43 Retrospective", time: "Dec 21 3:00 PM", type: "info", attendees: 14 },
];

const SHARED_FILES = [
  { name: "Regression_Report_S43.pdf", uploader: "Alice Chen", date: "Dec 14", size: "2.4 MB", version: "v3" },
  { name: "Sprint42_Metrics.xlsx", uploader: "Kate Nguyen", date: "Dec 13", size: "840 KB", version: "v1" },
  { name: "API_TestCollection.postman.json", uploader: "Liam Okafor", date: "Dec 12", size: "312 KB", version: "v8" },
  { name: "Security_Audit_Dec2024.pdf", uploader: "Emma Walsh", date: "Dec 14", size: "1.8 MB", version: "v2" },
  { name: "Release_Checklist_4.3.docx", uploader: "Bob Kumar", date: "Dec 13", size: "156 KB", version: "v4" },
  { name: "Performance_Baseline.xlsx", uploader: "Dave Park", date: "Dec 11", size: "620 KB", version: "v1" },
];

const DISCUSSIONS = [
  { topic: "Regression Failure Investigation — TC-018 Audit API Timeout", owner: "Alice Chen", replies: 14, views: 82, priority: "Critical" as TaskPriority, updated: "10 min ago" },
  { topic: "API Timeout Issue — Analytics Worker OOMKill Root Cause", owner: "Dave Park", replies: 9, views: 54, priority: "High" as TaskPriority, updated: "1 hr ago" },
  { topic: "Release 4.3 Go/No-Go Decision Thread", owner: "Bob Kumar", replies: 22, views: 131, priority: "Critical" as TaskPriority, updated: "2 hrs ago" },
  { topic: "Test Automation Improvements — Framework Evaluation", owner: "Iris Patel", replies: 7, views: 45, priority: "Medium" as TaskPriority, updated: "Yesterday" },
  { topic: "Performance Bottleneck — DB N+1 Queries in Audit Module", owner: "Dave Park", replies: 11, views: 63, priority: "High" as TaskPriority, updated: "Yesterday" },
  { topic: "Security Review Notes — OWASP Top 10 Findings Summary", owner: "Emma Walsh", replies: 5, views: 38, priority: "High" as TaskPriority, updated: "Dec 12" },
];

const DIRECTORY = [
  { id: "EMP-001", name: "Alice Chen", role: "Senior QA Engineer", dept: "QA", email: "alice.chen@company.com", phone: "+1 (415) 555-0101", manager: "Bob Kumar", location: "San Francisco, CA", tz: "PST", exp: "6 yrs", skills: "Selenium, Cypress, Jest", status: "Online" as OnlineStatus, avail: 18 },
  { id: "EMP-002", name: "Bob Kumar", role: "QA Lead", dept: "QA", email: "bob.kumar@company.com", phone: "+1 (415) 555-0102", manager: "Grace Obi", location: "New York, NY", tz: "EST", exp: "9 yrs", skills: "Test Strategy, JIRA, Release Mgmt", status: "In Meeting" as OnlineStatus, avail: 5 },
  { id: "EMP-003", name: "Carol Singh", role: "DevOps Engineer", dept: "Platform", email: "carol.singh@company.com", phone: "+1 (206) 555-0103", manager: "Jake Morris", location: "Seattle, WA", tz: "PST", exp: "5 yrs", skills: "Docker, Kubernetes, Terraform", status: "Busy" as OnlineStatus, avail: 22 },
  { id: "EMP-004", name: "Dave Park", role: "Backend Engineer", dept: "Engineering", email: "dave.park@company.com", phone: "+1 (512) 555-0104", manager: "Bob Kumar", location: "Austin, TX", tz: "CST", exp: "7 yrs", skills: "Node.js, PostgreSQL, Redis", status: "Online" as OnlineStatus, avail: 35 },
  { id: "EMP-005", name: "Emma Walsh", role: "Security Analyst", dept: "Security", email: "emma.walsh@company.com", phone: "+44 20 5550105", manager: "Grace Obi", location: "London, UK", tz: "GMT", exp: "8 yrs", skills: "OWASP, Pen Testing, SIEM", status: "Online" as OnlineStatus, avail: 12 },
  { id: "EMP-006", name: "Frank Liu", role: "QA Engineer", dept: "QA", email: "frank.liu@company.com", phone: "+1 (415) 555-0106", manager: "Bob Kumar", location: "San Francisco, CA", tz: "PST", exp: "3 yrs", skills: "Postman, TestRail, Manual QA", status: "Away" as OnlineStatus, avail: 45 },
  { id: "EMP-007", name: "Grace Obi", role: "Product Manager", dept: "Product", email: "grace.obi@company.com", phone: "+1 (646) 555-0107", manager: "—", location: "New York, NY", tz: "EST", exp: "11 yrs", skills: "Roadmapping, Agile, JIRA", status: "In Meeting" as OnlineStatus, avail: 30 },
  { id: "EMP-008", name: "Hiro Tanaka", role: "Frontend Engineer", dept: "Engineering", email: "hiro.tanaka@company.com", phone: "+81 3 5550108", manager: "Grace Obi", location: "Tokyo, JP", tz: "JST", exp: "5 yrs", skills: "React, TypeScript, Vite", status: "Online" as OnlineStatus, avail: 40 },
];

// ─── Chart data ───────────────────────────────────────────────────────────────
const MSG_TREND = [
  { day: "Mon", messages: 148 }, { day: "Tue", messages: 192 }, { day: "Wed", messages: 176 },
  { day: "Thu", messages: 214 }, { day: "Fri", messages: 231 }, { day: "Sat", messages: 64 }, { day: "Sun", messages: 42 },
];
const TASKS_COMPLETED = [
  { week: "Wk 47", completed: 28 }, { week: "Wk 48", completed: 34 }, { week: "Wk 49", completed: 41 },
  { week: "Wk 50", completed: 38 }, { week: "Wk 51", completed: 46 },
];
const VELOCITY = [
  { sprint: "S39", points: 64 }, { sprint: "S40", points: 72 }, { sprint: "S41", points: 68 },
  { sprint: "S42", points: 80 }, { sprint: "S43", points: 74 },
];
const COLLAB_TREND = [
  { month: "Aug", score: 72 }, { month: "Sep", score: 76 }, { month: "Oct", score: 81 },
  { month: "Nov", score: 88 }, { month: "Dec", score: 95 },
];
const WORKLOAD_DIST = [
  { name: "Alice", load: 82 }, { name: "Bob", load: 95 }, { name: "Carol", load: 78 },
  { name: "Dave", load: 65 }, { name: "Emma", load: 88 }, { name: "Frank", load: 55 },
  { name: "Iris", load: 92 }, { name: "Jake", load: 45 },
];

const actDot: Record<string, string> = {
  success: "bg-emerald-500", error: "bg-red-500", warn: "bg-amber-500", info: "bg-primary",
};
const calDot: Record<string, string> = {
  success: "bg-emerald-500", error: "bg-red-500", warn: "bg-amber-500", info: "bg-blue-500",
};

const fadeUp = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };
const stagger = { show: { transition: { staggerChildren: 0.045 } } };

// ─── Main component ───────────────────────────────────────────────────────────
export default function TeamCollaboration() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [chatMsg, setChatMsg] = useState("");
  const [activeChannel, setActiveChannel] = useState(0);
  const [approvals, setApprovals] = useState(APPROVALS);

  function q(msg: string) { return () => toast({ title: msg }); }
  function handleApprove(i: number) {
    setApprovals((prev) => prev.map((a, idx) => idx === i ? { ...a, status: "Approved" as ApprovalStatus } : a));
    toast({ title: "Approval granted" });
  }
  function handleReject(i: number) {
    setApprovals((prev) => prev.map((a, idx) => idx === i ? { ...a, status: "Rejected" as ApprovalStatus } : a));
    toast({ title: "Approval rejected", description: "Requester will be notified." });
  }

  const filteredDir = DIRECTORY.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.role.toLowerCase().includes(search.toLowerCase()) ||
    m.dept.toLowerCase().includes(search.toLowerCase()),
  );

  const kpis = [
    { label: "Total Members", value: 48, icon: Users, color: "text-primary", bg: "bg-primary/5 border-primary/20" },
    { label: "Online Now", value: 31, icon: Activity, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
    { label: "Active Sprint", badge: "Sprint 43", icon: Zap, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
    { label: "Open Discussions", value: 24, icon: MessageSquare, color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
    { label: "Pending Approvals", value: 9, icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
    { label: "Tasks Due Today", value: 18, icon: Clock, color: "text-red-500", bg: "bg-red-50 border-red-200" },
    { label: "Avg Utilization", value: 87, unit: "%", icon: TrendingUp, color: "text-violet-600", bg: "bg-violet-50 border-violet-200" },
    { label: "AI Collab Score", value: 95, unit: "%", icon: Sparkles, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Team Collaboration Center</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-11">Enterprise collaboration, sprint coordination, communication and workload management for QA teams</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={q("Share link copied")}><Share2 className="h-3.5 w-3.5 mr-1.5" />Share Files</Button>
          <Button variant="outline" size="sm" onClick={q("Exporting team report…")}><Download className="h-3.5 w-3.5 mr-1.5" />Export Report</Button>
          <Button variant="outline" size="sm" onClick={q("Assigning tester…")}><Users className="h-3.5 w-3.5 mr-1.5" />Assign Tester</Button>
          <Button variant="outline" size="sm" onClick={q("Creating task…")}><Plus className="h-3.5 w-3.5 mr-1.5" />Create Task</Button>
          <Button variant="outline" size="sm" onClick={q("Discussion created")}><MessageSquare className="h-3.5 w-3.5 mr-1.5" />Create Discussion</Button>
          <Button size="sm" onClick={q("Meeting started — link sent to team")}><Video className="h-3.5 w-3.5 mr-1.5" />Start Meeting</Button>
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
                  {k.badge ? (
                    <span className={cn("text-sm font-bold", k.color)}>{k.badge}</span>
                  ) : (
                    <div className="flex items-baseline gap-0.5">
                      <span className={cn("text-2xl font-bold tabular-nums", k.color)}>
                        <AnimatedCounter value={k.value as number} />
                      </span>
                      {k.unit && <span className="text-xs text-muted-foreground">{k.unit}</span>}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Team Overview */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
        <Card>
          <CardHeader className="pb-3">
            <SectionHeading icon={Users} title="Team Overview" subtitle="Real-time status, workload and metrics for all team members" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {TEAM_MEMBERS.map((m, i) => (
                <motion.div
                  key={m.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-xl border border-border p-4 hover:bg-muted/10 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className={cn("text-xs font-bold", avatarColors[i % avatarColors.length])}>
                          {initials(m.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background", statusDot[m.status])} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.role}</p>
                    </div>
                    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full border flex-shrink-0", statusLabel[m.status])}>
                      {m.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2 truncate">📋 {m.task}</p>
                  <div className="mb-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Workload</span>
                      <span className={cn("font-bold", m.workload >= 90 ? "text-red-600" : m.workload >= 75 ? "text-amber-600" : "text-emerald-600")}>
                        {m.workload}%
                      </span>
                    </div>
                    <Progress value={m.workload} className={cn("h-1.5", m.workload >= 90 ? "[&>div]:bg-red-500" : m.workload >= 75 ? "[&>div]:bg-amber-500" : "")} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs mb-3">
                    <span className="text-muted-foreground">Availability</span><span className={cn("font-medium", m.avail < 15 ? "text-red-600" : "text-emerald-600")}>{m.avail}%</span>
                    <span className="text-muted-foreground">Bugs Assigned</span><span className="font-medium">{m.bugs}</span>
                    <span className="text-muted-foreground">Test Cases</span><span className="font-medium">{m.tests}</span>
                    <span className="text-muted-foreground">Done Today</span><span className="font-medium text-emerald-600">{m.done}</span>
                    <span className="text-muted-foreground">Response</span><span className="font-medium">{m.response}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="flex-1 text-xs h-7" onClick={q(`Opening chat with ${m.name}…`)}><MessageSquare className="h-3 w-3 mr-1" />Message</Button>
                    <Button variant="outline" size="sm" className="flex-1 text-xs h-7" onClick={q(`Task assigned to ${m.name}`)}><Plus className="h-3 w-3 mr-1" />Assign</Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Live Activity + Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Activity */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.14 }}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <SectionHeading icon={Activity} title="Live Team Activity" subtitle="Real-time team actions and GitHub-style activity feed" />
            </CardHeader>
            <CardContent className="space-y-0">
              {ACTIVITY_FEED.map((item, i) => (
                <div key={i} className="flex items-start gap-3 py-3 border-b border-border last:border-0">
                  <Avatar className="h-7 w-7 flex-shrink-0">
                    <AvatarFallback className={cn("text-[10px] font-bold", avatarColors[i % avatarColors.length])}>
                      {initials(item.user)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-snug">
                      <span className="font-semibold text-foreground">{item.user}</span>
                      <span className="text-muted-foreground"> {item.action}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn("h-1.5 w-1.5 rounded-full", actDot[item.type])} />
                      <span className="text-[10px] text-muted-foreground">{item.module}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">{item.time}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Team Chat */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.16 }}>
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
              <SectionHeading icon={MessageSquare} title="Team Chat" subtitle="Slack-style channel collaboration" />
            </CardHeader>
            <CardContent className="flex-1 flex gap-3 min-h-0 p-4 pt-0">
              {/* Channels */}
              <div className="w-36 flex-shrink-0 space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Channels</p>
                {CHAT_CHANNELS.map((ch, i) => (
                  <button
                    key={ch.name}
                    onClick={() => setActiveChannel(i)}
                    className={cn(
                      "w-full text-left rounded-lg px-2 py-1.5 text-xs transition-colors flex items-center justify-between gap-1",
                      activeChannel === i ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted/50 text-muted-foreground",
                    )}
                  >
                    <span className="truncate">{ch.name}</span>
                    {ch.unread > 0 && (
                      <span className="h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                        {ch.unread}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Messages */}
              <div className="flex-1 flex flex-col min-w-0 border border-border rounded-xl overflow-hidden">
                {CHAT_CHANNELS[activeChannel].pinned && (
                  <div className="bg-amber-50 border-b border-amber-100 px-3 py-1.5 flex items-center gap-1.5">
                    <Star className="h-3 w-3 text-amber-500" />
                    <p className="text-[10px] text-amber-700 font-medium truncate">{CHAT_CHANNELS[activeChannel].pinned}</p>
                  </div>
                )}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px]">
                  {CHAT_MESSAGES.map((msg, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Avatar className="h-6 w-6 flex-shrink-0">
                        <AvatarFallback className={cn("text-[9px] font-bold", msg.color)}>{initials(msg.user)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-baseline gap-1.5 mb-0.5">
                          <p className="text-[11px] font-semibold text-foreground">{msg.user}</p>
                          <p className="text-[9px] text-muted-foreground">{msg.time}</p>
                        </div>
                        <p className="text-xs text-foreground leading-snug">{msg.msg}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground italic">
                    <div className="flex gap-0.5">
                      {[0, 1, 2].map((i) => <div key={i} className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                    </div>
                    {TYPING_USER} is typing…
                  </div>
                </div>
                <div className="border-t border-border p-2 flex gap-2">
                  <Input
                    placeholder="Message #general…"
                    value={chatMsg}
                    onChange={(e) => setChatMsg(e.target.value)}
                    className="h-7 text-xs flex-1"
                    onKeyDown={(e) => { if (e.key === "Enter") { setChatMsg(""); toast({ title: "Message sent" }); } }}
                  />
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={q("File picker opened")}><Paperclip className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" className="h-7 w-7 p-0" onClick={() => { setChatMsg(""); toast({ title: "Message sent" }); }}><Send className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Kanban Board */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.18 }}>
        <Card>
          <CardHeader className="pb-3">
            <SectionHeading icon={Layers} title="Kanban Task Board" subtitle="Sprint 43 task board — drag-and-drop style task tracking" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {KANBAN_COLS.map((col) => {
                const colTasks = KANBAN.filter((t) => t.col === col);
                return (
                  <div key={col} className={cn("rounded-xl border p-3 min-h-[200px]", colColors[col])}>
                    <div className="flex items-center justify-between mb-3">
                      <p className={cn("text-xs font-bold", colHeaderColors[col])}>{col}</p>
                      <span className="text-xs font-semibold bg-white/70 border border-border px-1.5 py-0.5 rounded-full text-muted-foreground">
                        {colTasks.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {colTasks.map((task) => (
                        <div key={task.id} className="bg-white rounded-lg border border-border p-2.5 hover:shadow-sm transition-shadow cursor-pointer">
                          <div className="flex items-start justify-between gap-1 mb-1.5">
                            <p className="text-xs font-semibold text-foreground leading-snug">{task.title}</p>
                            <PBadge p={task.priority} />
                          </div>
                          {task.progress > 0 && task.progress < 100 && (
                            <div className="mb-1.5">
                              <Progress value={task.progress} className="h-1" />
                            </div>
                          )}
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span className="font-mono">{task.id}</span>
                            <span>{task.owner.split(" ")[0]}</span>
                          </div>
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {task.labels.map((l) => (
                              <span key={l} className="text-[9px] bg-primary/8 text-primary border border-primary/20 px-1 py-0.5 rounded">{l}</span>
                            ))}
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                            <span>📅 {task.due}</span>
                            <span>⏱ {task.hours}h</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Sprint Board + Team Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sprint Board */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <SectionHeading icon={Zap} title="Sprint Board" subtitle="Sprint 43 — Dec 9–21, 2024" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Velocity", value: "74 pts", color: "text-primary" },
                  { label: "Story Points", value: "92 pts", color: "text-indigo-600" },
                  { label: "Completed Tasks", value: "34", color: "text-emerald-600" },
                  { label: "Remaining Tasks", value: "28", color: "text-amber-600" },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-border p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                    <p className={cn("text-xl font-bold", item.color)}>{item.value}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Sprint Goal</p>
                <p className="text-sm text-foreground bg-muted/30 rounded-lg p-2">Complete Release 4.3 regression, close all P0/P1 bugs, and achieve ≥95% test coverage across Auth and Projects modules.</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Current Milestone</p>
                <p className="text-sm font-medium text-primary">Release 4.3 — QA Sign-off by Dec 20</p>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Sprint Progress</span>
                  <span className="font-bold text-primary">55%</span>
                </div>
                <Progress value={55} className="h-2" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Velocity Trend</p>
                <ResponsiveContainer width="100%" height={100}>
                  <BarChart data={VELOCITY} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                    <XAxis dataKey="sprint" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                    <Bar dataKey="points" fill="#6366f1" name="Story Points" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Team Workload */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.22 }}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <SectionHeading icon={Activity} title="Team Workload" subtitle="Individual utilisation and capacity — red = overloaded" />
            </CardHeader>
            <CardContent className="space-y-3">
              {TEAM_MEMBERS.slice(0, 8).map((m, i) => (
                <div key={m.name} className="flex items-center gap-3">
                  <Avatar className="h-7 w-7 flex-shrink-0">
                    <AvatarFallback className={cn("text-[10px] font-bold", avatarColors[i % avatarColors.length])}>
                      {initials(m.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="font-medium text-foreground truncate">{m.name.split(" ")[0]}</span>
                      <span className={cn("font-bold flex-shrink-0", m.workload >= 90 ? "text-red-600" : m.workload >= 75 ? "text-amber-600" : "text-emerald-600")}>
                        {m.workload}%
                      </span>
                    </div>
                    <Progress value={m.workload} className={cn("h-2", m.workload >= 90 ? "[&>div]:bg-red-500" : m.workload >= 75 ? "[&>div]:bg-amber-500" : "")} />
                  </div>
                  {m.workload >= 90 && (
                    <span className="text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full flex-shrink-0">Overloaded</span>
                  )}
                </div>
              ))}
              <div className="pt-2">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Workload Distribution</p>
                <ResponsiveContainer width="100%" height={100}>
                  <BarChart data={WORKLOAD_DIST} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                    <Bar dataKey="load" name="Workload %" radius={[3, 3, 0, 0]}>
                      {WORKLOAD_DIST.map((entry, i) => (
                        <Bar key={i} dataKey="load" fill={entry.load >= 90 ? "#ef4444" : entry.load >= 75 ? "#f59e0b" : "#10b981"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* QA Approvals + Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Approvals */}
        <motion.div className="lg:col-span-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.24 }}>
          <Card>
            <CardHeader className="pb-3">
              <SectionHeading icon={CheckCircle2} title="QA Approvals" subtitle="Release, regression and compliance approval queue" />
            </CardHeader>
            <CardContent className="space-y-2">
              {approvals.map((a, i) => (
                <div key={a.name} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/20 transition-colors flex-wrap">
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-sm font-semibold text-foreground">{a.name}</p>
                    <p className="text-xs text-muted-foreground">Approver: {a.approver}</p>
                  </div>
                  <PBadge p={a.priority} />
                  <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", approvalBadge[a.status])}>{a.status}</span>
                  <span className="text-xs text-muted-foreground w-16 text-right">ETA: {a.eta}</span>
                  {a.status !== "Approved" && a.status !== "Rejected" && (
                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-7 text-xs px-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApprove(i)}>Approve</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs px-2 border-red-200 text-red-600 hover:bg-red-50" onClick={() => handleReject(i)}>Reject</Button>
                    </div>
                  )}
                  {(a.status === "Approved" || a.status === "Rejected") && (
                    <CheckCircle2 className={cn("h-4 w-4", a.status === "Approved" ? "text-emerald-500" : "text-red-400")} />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Calendar */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.26 }}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <SectionHeading icon={Calendar} title="Upcoming Events" subtitle="Sprint & team schedule" />
            </CardHeader>
            <CardContent className="space-y-0">
              {CALENDAR_EVENTS.map((ev, i) => (
                <div key={i} className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
                  <div className={cn("h-2 w-2 rounded-full mt-1 flex-shrink-0", calDot[ev.type])} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{ev.title}</p>
                    <p className="text-[10px] text-muted-foreground">{ev.time}</p>
                  </div>
                  {ev.attendees > 0 && (
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">👥 {ev.attendees}</span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Shared Files + Discussions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Shared Files */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.28 }}>
          <Card>
            <CardHeader className="pb-3">
              <SectionHeading icon={Paperclip} title="Shared Files" subtitle="Recent documents shared by the team" />
            </CardHeader>
            <CardContent className="space-y-0">
              {SHARED_FILES.map((f, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                  <div className="h-8 w-8 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{f.name}</p>
                    <p className="text-[10px] text-muted-foreground">{f.uploader} · {f.date} · {f.size} · {f.version}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0" onClick={q(`Downloading ${f.name}…`)}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Discussions */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.3 }}>
          <Card>
            <CardHeader className="pb-3">
              <SectionHeading icon={MessageSquare} title="Discussions" subtitle="Open team discussions and investigation threads" />
            </CardHeader>
            <CardContent className="space-y-0">
              {DISCUSSIONS.map((d, i) => (
                <div key={i} className="py-3 border-b border-border last:border-0 hover:bg-muted/10 transition-colors rounded px-1 cursor-pointer" onClick={q(`Opening discussion: ${d.topic}`)}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-xs font-semibold text-foreground leading-snug">{d.topic}</p>
                    <PBadge p={d.priority} />
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>{d.owner}</span>
                    <span>💬 {d.replies}</span>
                    <span>👁 {d.views}</span>
                    <span className="ml-auto">{d.updated}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* AI Team Insights */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.32 }}>
        <Card className="border border-violet-200 bg-gradient-to-br from-violet-50/80 to-indigo-50/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <SectionHeading icon={Bot} title="AI Team Insights" subtitle="Collaboration intelligence, workload analysis and team productivity recommendations" />
              <Badge variant="outline" className="text-xs bg-violet-100 border-violet-300 text-violet-700 gap-1">
                <Sparkles className="h-3 w-3" /> AI · 95% confidence
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Top Risks & Overload
                </p>
                {[
                  { person: "Bob Kumar", issue: "95% utilisation — at capacity. 3 pending approvals risk sprint delay.", p: "P0" },
                  { person: "Iris Patel", issue: "92% utilisation — reassign 4 API tests to Frank Liu (55% load) to rebalance.", p: "P1" },
                  { person: "Emma Walsh", issue: "88% utilisation — security review bottleneck. Add Carol to security pool.", p: "P1" },
                ].map((r, i) => (
                  <div key={i} className="rounded-lg border border-violet-100 bg-white/60 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold">{r.person}</p>
                      <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full border", r.p === "P0" ? "bg-red-50 text-red-700 border-red-200" : "bg-orange-50 text-orange-700 border-orange-200")}>{r.p}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{r.issue}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-violet-500" /> AI Suggestions
                </p>
                <div className="space-y-2">
                  {[
                    { action: "Reassign 4 API tests from Iris Patel to Frank Liu — reduces Iris load from 92% to 78%.", eta: "Immediate", p: "P0" },
                    { action: "Schedule regression suite to auto-trigger post-deployment to Staging (CI/CD hook).", eta: "2 hrs", p: "P1" },
                    { action: "Increase Security team capacity — add 1 QA Engineer to Emma's security review rotation.", eta: "Next sprint", p: "P1" },
                    { action: "QA Review column bottleneck detected — 3 tasks waiting > 48 hrs. Escalate to Bob.", eta: "Today", p: "P2" },
                    { action: "5 pending approvals may delay Sprint 43 close. Bob Kumar to action before EOD.", eta: "EOD Today", p: "P2" },
                  ].map((a, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <ChevronRight className="mt-0.5 h-3.5 w-3.5 text-violet-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-foreground">{a.action}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full border", a.p === "P0" ? "bg-red-50 text-red-700 border-red-200" : a.p === "P1" ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-amber-50 text-amber-700 border-amber-200")}>{a.p}</span>
                          <span className="text-xs text-muted-foreground">ETA: {a.eta}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2 border-t border-violet-200 pt-4 grid grid-cols-1 sm:grid-cols-4 gap-4">
                {[
                  { label: "Collaboration Score", value: "95%", color: "text-emerald-600" },
                  { label: "Communication Health", value: "Good", color: "text-emerald-600" },
                  { label: "Knowledge Sharing Index", value: "82%", color: "text-indigo-600" },
                  { label: "Expected Productivity Gain", value: "+18%", color: "text-violet-700" },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                    <p className={cn("text-xl font-bold", stat.color)}>{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Collaboration Analytics */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.34 }}>
        <Card>
          <CardHeader className="pb-3">
            <SectionHeading icon={BarChart2} title="Collaboration Analytics" subtitle="Team productivity, velocity, messaging and collaboration trends" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3">Messages per Day (This Week)</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={MSG_TREND} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="messages" fill="#6366f1" name="Messages" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3">Tasks Completed per Week</p>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={TASKS_COMPLETED} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="taskGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} fill="url(#taskGrad)" name="Tasks Completed" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="lg:col-span-2">
                <p className="text-xs font-semibold text-muted-foreground mb-3">Collaboration Score Trend (5 Months)</p>
                <ResponsiveContainer width="100%" height={130}>
                  <LineChart data={COLLAB_TREND} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis domain={[60, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: "#6366f1" }} name="Collab Score" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Member Directory */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.36 }}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <SectionHeading icon={Users} title="Member Directory" subtitle={`${filteredDir.length} members`} />
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search members…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-8 text-xs w-52"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={q("Filters applied")}><Filter className="h-3.5 w-3.5 mr-1.5" />Filter</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs">Member</TableHead>
                    <TableHead className="text-xs">ID</TableHead>
                    <TableHead className="text-xs">Role</TableHead>
                    <TableHead className="text-xs">Dept</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Manager</TableHead>
                    <TableHead className="text-xs">Location</TableHead>
                    <TableHead className="text-xs">TZ</TableHead>
                    <TableHead className="text-xs">Exp</TableHead>
                    <TableHead className="text-xs">Skills</TableHead>
                    <TableHead className="text-xs text-right">Avail</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDir.map((m, i) => (
                    <TableRow key={m.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className={cn("text-[10px] font-bold", avatarColors[i % avatarColors.length])}>
                              {initials(m.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-semibold text-foreground whitespace-nowrap">{m.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{m.id}</TableCell>
                      <TableCell className="text-xs">{m.role}</TableCell>
                      <TableCell className="text-xs">{m.dept}</TableCell>
                      <TableCell className="text-xs text-primary">{m.email}</TableCell>
                      <TableCell className="text-xs">{m.manager}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{m.location}</div>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{m.tz}</TableCell>
                      <TableCell className="text-xs">{m.exp}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[130px] truncate">{m.skills}</TableCell>
                      <TableCell className={cn("text-xs font-bold text-right", m.avail < 15 ? "text-red-600" : "text-emerald-600")}>{m.avail}%</TableCell>
                      <TableCell>
                        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full border", statusLabel[m.status])}>
                          {m.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.38 }}>
        <Card>
          <CardHeader className="pb-3">
            <SectionHeading icon={Zap} title="Quick Actions" subtitle="Common collaboration and sprint management operations" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Create Discussion", icon: MessageSquare, handler: q("Discussion created"), variant: "default" as const },
                { label: "Assign Task", icon: Plus, handler: q("Task assignment dialog opened"), variant: "outline" as const },
                { label: "Start Meeting", icon: Video, handler: q("Meeting started — link sent"), variant: "outline" as const },
                { label: "Generate AI Summary", icon: Bot, handler: q("Generating AI team summary…"), variant: "outline" as const },
                { label: "View Sprint", icon: Zap, handler: q("Opening sprint board…"), variant: "outline" as const },
                { label: "Invite Member", icon: Users, handler: q("Invite link copied"), variant: "outline" as const },
                { label: "Export Report", icon: Download, handler: q("Exporting team report…"), variant: "outline" as const },
                { label: "Share Dashboard", icon: Share2, handler: q("Dashboard share link copied"), variant: "outline" as const },
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
