import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AnimatedCounter } from "@/components/animated-counter";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import {
  Shield, ShieldAlert, ShieldCheck, AlertTriangle, XCircle, CheckCircle2,
  Download, Share2, FileText, Play, Scan, Lock, Key, Eye, Package,
  Globe, Code2, Server, Zap, Bot, Sparkles, ChevronRight, Clock,
  RefreshCw, FileSearch, ClipboardList, UserCheck, Bug as BugIcon,
  TrendingUp, TrendingDown, Minus, Activity,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Severity = "critical" | "high" | "medium" | "low" | "info";
type ComplianceStatus = "compliant" | "partial" | "non-compliant";

// ─── Colour helpers ───────────────────────────────────────────────────────────
function sevColor(s: Severity): string {
  return s === "critical" ? "text-red-600"
    : s === "high" ? "text-orange-600"
    : s === "medium" ? "text-amber-600"
    : s === "low" ? "text-emerald-600"
    : "text-slate-500";
}
function sevBg(s: Severity): string {
  return s === "critical" ? "bg-red-50 border-red-200"
    : s === "high" ? "bg-orange-50 border-orange-200"
    : s === "medium" ? "bg-amber-50 border-amber-200"
    : s === "low" ? "bg-emerald-50 border-emerald-200"
    : "bg-slate-50 border-slate-200";
}
function SevBadge({ s }: { s: Severity }) {
  const label = s.charAt(0).toUpperCase() + s.slice(1);
  return <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border capitalize", sevBg(s), sevColor(s))}>{label}</span>;
}

function compColor(s: ComplianceStatus): string {
  return s === "compliant" ? "text-emerald-700" : s === "partial" ? "text-amber-700" : "text-red-700";
}
function compBg(s: ComplianceStatus): string {
  return s === "compliant" ? "bg-emerald-50 border-emerald-200" : s === "partial" ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
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

// ─── Static mock data ─────────────────────────────────────────────────────────
const OWASP = [
  { rank: "A01", risk: "Broken Access Control", severity: "critical" as Severity, affected: 3, status: "Open", action: "Implement RBAC and enforce least-privilege across all API endpoints" },
  { rank: "A02", risk: "Cryptographic Failures", severity: "high" as Severity, affected: 2, status: "In Progress", action: "Upgrade to AES-256-GCM, rotate secrets, enforce HTTPS everywhere" },
  { rank: "A03", risk: "Injection (SQL/XSS)", severity: "high" as Severity, affected: 2, status: "In Progress", action: "Use parameterised queries, sanitise all user inputs, add CSP headers" },
  { rank: "A04", risk: "Insecure Design", severity: "medium" as Severity, affected: 1, status: "Open", action: "Conduct threat modelling, add abuse-case testing to SDLC pipeline" },
  { rank: "A05", risk: "Security Misconfiguration", severity: "medium" as Severity, affected: 4, status: "Open", action: "Harden server configs, disable default accounts, automate config audits" },
  { rank: "A06", risk: "Vulnerable Components", severity: "high" as Severity, affected: 5, status: "Open", action: "Upgrade dependencies, integrate SCA in CI/CD, subscribe to CVE feeds" },
  { rank: "A07", risk: "ID & Authentication Failures", severity: "high" as Severity, affected: 2, status: "Resolved", action: "Enforce MFA, implement account-lockout, use secure session management" },
  { rank: "A08", risk: "Software Integrity Failures", severity: "medium" as Severity, affected: 1, status: "Open", action: "Verify package signatures, implement SLSA supply-chain integrity checks" },
  { rank: "A09", risk: "Logging & Monitoring Failures", severity: "low" as Severity, affected: 3, status: "In Progress", action: "Deploy SIEM, centralise logs, configure alerting thresholds" },
  { rank: "A10", risk: "Server-Side Request Forgery", severity: "medium" as Severity, affected: 1, status: "Open", action: "Validate and sanitise all server-side URL inputs, block internal ranges" },
];

const VULNS = [
  { cve: "CVE-2024-45321", title: "Prototype Pollution in lodash <4.17.22", severity: "critical" as Severity, cvss: 9.8, project: "QA Portal Frontend", detected: "2024-12-01", owner: "alice.dev", eta: "2 days", status: "Open" },
  { cve: "CVE-2024-38809", title: "RCE via deserialization in log4j-core", severity: "critical" as Severity, cvss: 9.3, project: "API Server", detected: "2024-12-03", owner: "dave.eng", eta: "1 day", status: "In Progress" },
  { cve: "CVE-2024-41110", title: "Path Traversal in multer <1.4.5", severity: "high" as Severity, cvss: 7.5, project: "File Upload Service", detected: "2024-12-05", owner: "bob.qe", eta: "3 days", status: "Open" },
  { cve: "CVE-2024-37890", title: "ReDoS in ws WebSocket library", severity: "high" as Severity, cvss: 7.2, project: "Realtime Engine", detected: "2024-12-06", owner: "carol.ops", eta: "4 days", status: "Open" },
  { cve: "CVE-2024-43799", title: "XSS in serve-static <1.15.0", severity: "medium" as Severity, cvss: 5.4, project: "QA Portal Frontend", detected: "2024-12-07", owner: "alice.dev", eta: "1 week", status: "Open" },
  { cve: "CVE-2024-32002", title: "Git clone arbitrary code execution", severity: "medium" as Severity, cvss: 5.1, project: "CI/CD Pipeline", detected: "2024-12-08", owner: "dave.eng", eta: "5 days", status: "Patched" },
  { cve: "CVE-2024-29041", title: "Open redirect in express <4.19.2", severity: "medium" as Severity, cvss: 4.8, project: "API Server", detected: "2024-12-09", owner: "bob.qe", eta: "1 week", status: "In Progress" },
  { cve: "CVE-2024-48949", title: "Improper curve validation in elliptic", severity: "low" as Severity, cvss: 3.7, project: "Auth Service", detected: "2024-12-10", owner: "carol.ops", eta: "2 weeks", status: "Open" },
  { cve: "CVE-2024-45296", title: "Backtracking ReDoS in path-to-regexp", severity: "low" as Severity, cvss: 3.1, project: "Router Layer", detected: "2024-12-11", owner: "alice.dev", eta: "2 weeks", status: "Open" },
];

const COMPLIANCE = [
  { name: "ISO 27001", icon: Shield, score: 87, status: "partial" as ComplianceStatus, lastAudit: "Nov 15, 2024", nextReview: "Feb 15, 2025", color: "indigo" },
  { name: "SOC 2 Type II", icon: ShieldCheck, score: 92, status: "compliant" as ComplianceStatus, lastAudit: "Oct 30, 2024", nextReview: "Jan 30, 2025", color: "emerald" },
  { name: "GDPR", icon: Lock, score: 78, status: "partial" as ComplianceStatus, lastAudit: "Dec 01, 2024", nextReview: "Mar 01, 2025", color: "amber" },
  { name: "PCI-DSS v4", icon: Key, score: 95, status: "compliant" as ComplianceStatus, lastAudit: "Nov 20, 2024", nextReview: "Feb 20, 2025", color: "emerald" },
  { name: "OWASP ASVS", icon: Eye, score: 64, status: "non-compliant" as ComplianceStatus, lastAudit: "Nov 28, 2024", nextReview: "Jan 28, 2025", color: "red" },
];

const TIMELINE = [
  { time: "10:42", event: "Re-scan completed — 0 new critical findings", type: "success" },
  { time: "09:18", event: "Patch deployed: CVE-2024-32002 resolved in CI/CD Pipeline", type: "success" },
  { time: "08:55", event: "Critical CVE-2024-38809 detected in API Server (log4j-core)", type: "error" },
  { time: "08:30", event: "Secret removed: AWS_SECRET_KEY rotated and vault updated", type: "warn" },
  { time: "07:15", event: "Dependency scan completed — 9 vulnerabilities found across 247 packages", type: "info" },
  { time: "06:00", event: "Scheduled security scan started across all 5 projects", type: "info" },
  { time: "Yesterday 18:40", event: "SOC 2 compliance audit completed — score 92%", type: "success" },
  { time: "Yesterday 16:20", event: "Container scan: 2 critical findings in api-server:latest", type: "error" },
  { time: "Yesterday 14:10", event: "OWASP ASVS review completed — 7 new action items raised", type: "warn" },
];

const CHART_COLORS_SEV = ["#ef4444", "#f97316", "#f59e0b", "#10b981", "#94a3b8"];

const MONTHLY_TREND = [
  { month: "Jul", critical: 8, high: 14, medium: 22, low: 31, score: 61 },
  { month: "Aug", critical: 7, high: 12, medium: 20, low: 28, score: 65 },
  { month: "Sep", critical: 6, high: 11, medium: 18, low: 25, score: 68 },
  { month: "Oct", critical: 5, high: 9, medium: 15, low: 22, score: 72 },
  { month: "Nov", critical: 4, high: 8, medium: 13, low: 19, score: 76 },
  { month: "Dec", critical: 2, high: 4, medium: 7, low: 11, score: 82 },
];

const COMP_TREND = [
  { month: "Jul", iso: 72, soc2: 80, gdpr: 60, pci: 85 },
  { month: "Aug", iso: 75, soc2: 83, gdpr: 63, pci: 88 },
  { month: "Sep", iso: 78, soc2: 86, gdpr: 67, pci: 90 },
  { month: "Oct", iso: 81, soc2: 88, gdpr: 70, pci: 92 },
  { month: "Nov", iso: 84, soc2: 90, gdpr: 74, pci: 94 },
  { month: "Dec", iso: 87, soc2: 92, gdpr: 78, pci: 95 },
];

const OPEN_CLOSED = [
  { month: "Jul", open: 45, closed: 12 },
  { month: "Aug", open: 40, closed: 18 },
  { month: "Sep", open: 36, closed: 22 },
  { month: "Oct", open: 30, closed: 28 },
  { month: "Nov", open: 24, closed: 33 },
  { month: "Dec", open: 18, closed: 38 },
];

const RISK_DIST = [
  { name: "Critical", value: 2 },
  { name: "High", value: 4 },
  { name: "Medium", value: 7 },
  { name: "Low", value: 11 },
  { name: "Info", value: 5 },
];

const SEV_BAR = [
  { name: "Critical", value: 2, fill: "#ef4444" },
  { name: "High", value: 4, fill: "#f97316" },
  { name: "Medium", value: 7, fill: "#f59e0b" },
  { name: "Low", value: 11, fill: "#10b981" },
  { name: "Info", value: 5, fill: "#94a3b8" },
];

const colorMap: Record<string, { border: string; scoreText: string; badge: string }> = {
  indigo: { border: "border-indigo-200", scoreText: "text-indigo-600", badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  emerald: { border: "border-emerald-200", scoreText: "text-emerald-600", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  amber: { border: "border-amber-200", scoreText: "text-amber-600", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  red: { border: "border-red-200", scoreText: "text-red-600", badge: "bg-red-50 text-red-700 border-red-200" },
};

const actDot: Record<string, string> = {
  success: "bg-emerald-500",
  error: "bg-red-500",
  warn: "bg-amber-500",
  info: "bg-primary",
};

const owaspStatus: Record<string, string> = {
  Open: "bg-red-50 text-red-700 border-red-200",
  "In Progress": "bg-amber-50 text-amber-700 border-amber-200",
  Resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const vulnStatus: Record<string, string> = {
  Open: "bg-red-50 text-red-700 border-red-200",
  "In Progress": "bg-amber-50 text-amber-700 border-amber-200",
  Patched: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function SecurityCompliance() {
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);

  function handleScan() {
    setScanning(true);
    setTimeout(() => { setScanning(false); toast({ title: "Security Scan Complete", description: "Scan finished. 2 new findings detected." }); }, 2000);
  }
  function handleExport() { toast({ title: "Exporting Security Report…", description: "PDF will download shortly." }); }
  function handleSBOM() { toast({ title: "Generating SBOM…", description: "Software Bill of Materials is being prepared." }); }
  function handleShare() { toast({ title: "Share link copied", description: "Stakeholders can now view the security summary." }); }

  const fadeUp = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };
  const stagger = { show: { transition: { staggerChildren: 0.055 } } };

  const kpis = [
    { label: "Security Score", value: 82, unit: "/100", icon: Shield, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
    { label: "Critical Vulns", value: 2, unit: "", icon: XCircle, color: "text-red-600", bg: "bg-red-50 border-red-200" },
    { label: "High Vulns", value: 4, unit: "", icon: ShieldAlert, color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
    { label: "Medium Vulns", value: 7, unit: "", icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
    { label: "Low Vulns", value: 11, unit: "", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
    { label: "Compliance Score", value: 83, unit: "%", icon: ShieldCheck, color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
    { label: "Last Scan", value: null as number | null, badge: "Today 10:42", icon: Clock, color: "text-primary", bg: "bg-primary/5 border-primary/20" },
    { label: "AI Confidence", value: 94, unit: "%", icon: Sparkles, color: "text-violet-600", bg: "bg-violet-50 border-violet-200" },
  ];

  const overviewCards = [
    {
      title: "Dependency Scan", icon: Package,
      items: [
        { label: "Packages scanned", value: "247", ok: true },
        { label: "Issues found", value: "24", ok: false },
        { label: "Status", value: "Completed", ok: true },
      ],
    },
    {
      title: "Secret Detection", icon: Key,
      items: [
        { label: "Secrets exposed", value: "0", ok: true },
        { label: "Rotated this week", value: "1", ok: true },
        { label: "Status", value: "Clean", ok: true },
      ],
    },
    {
      title: "Container Security", icon: Server,
      items: [
        { label: "Images scanned", value: "8", ok: true },
        { label: "Critical findings", value: "2", ok: false },
        { label: "Base image age", value: "14 days", ok: true },
      ],
    },
    {
      title: "SSL / TLS", icon: Globe,
      items: [
        { label: "Certificate valid", value: "Yes", ok: true },
        { label: "Expiry", value: "89 days", ok: true },
        { label: "Protocol", value: "TLS 1.3", ok: true },
      ],
    },
    {
      title: "Authentication", icon: Lock,
      items: [
        { label: "MFA enabled", value: "Yes", ok: true },
        { label: "Password policy", value: "Strong", ok: true },
        { label: "Session security", value: "Secure", ok: true },
      ],
    },
    {
      title: "Code Security", icon: Code2,
      items: [
        { label: "Static analysis", value: "7 issues", ok: false },
        { label: "Dynamic analysis", value: "3 issues", ok: false },
        { label: "Coverage", value: "82%", ok: true },
      ],
    },
  ];

  const aiRisks = [
    "2 unpatched critical CVEs (log4j RCE, lodash prototype pollution) expose the API Server and Portal to remote code execution.",
    "OWASP A01 Broken Access Control detected across 3 projects — unauthorized data access is possible without RBAC enforcement.",
    "Container image api-server:latest carries 2 critical OS-level vulnerabilities — base image must be updated immediately.",
  ];
  const aiActions = [
    { action: "Upgrade lodash to ≥4.17.22 and log4j-core to ≥2.17.1 immediately.", eta: "2–4 hrs", priority: "P0" },
    { action: "Implement RBAC across all API endpoints using middleware guards.", eta: "1–2 days", priority: "P1" },
    { action: "Rebuild Docker base image from node:20-alpine LTS and re-deploy.", eta: "4–6 hrs", priority: "P1" },
    { action: "Enable SIEM log aggregation and set up alerting for anomalous auth patterns.", eta: "2–3 days", priority: "P2" },
    { action: "Complete OWASP ASVS Level 2 checklist and close 7 outstanding action items.", eta: "1 week", priority: "P2" },
  ];

  const priorityBadge: Record<string, string> = {
    P0: "bg-red-50 text-red-700 border-red-200",
    P1: "bg-orange-50 text-orange-700 border-orange-200",
    P2: "bg-amber-50 text-amber-700 border-amber-200",
  };

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Security & Compliance Center</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-11">Enterprise security posture, vulnerability management and compliance monitoring</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleShare}><Share2 className="h-3.5 w-3.5 mr-1.5" />Share</Button>
          <Button variant="outline" size="sm" onClick={handleSBOM}><Download className="h-3.5 w-3.5 mr-1.5" />Download SBOM</Button>
          <Button variant="outline" size="sm" onClick={handleExport}><FileText className="h-3.5 w-3.5 mr-1.5" />Export Report</Button>
          <Button size="sm" className="gap-1.5" disabled={scanning} onClick={handleScan}>
            {scanning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {scanning ? "Scanning…" : "Run Security Scan"}
          </Button>
        </div>
      </div>

      {/* ── Summary KPI Cards ────────────────────────────────────────────────── */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                  {k.value !== null && k.value !== undefined ? (
                    <div className="flex items-baseline gap-0.5">
                      <span className={cn("text-2xl font-bold tabular-nums", k.color)}>
                        <AnimatedCounter value={k.value} />
                      </span>
                      {k.unit && <span className="text-xs text-muted-foreground">{k.unit}</span>}
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-primary mt-1 block">{k.badge}</span>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* ── Security Overview ────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.12 }}>
        <Card>
          <CardHeader className="pb-3">
            <SectionHeading icon={ShieldCheck} title="Security Overview" subtitle="Automated checks across all security domains" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {overviewCards.map((card) => {
                const CIcon = card.icon;
                return (
                  <div key={card.title} className="rounded-xl border border-border p-4 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
                        <CIcon className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">{card.title}</p>
                    </div>
                    <div className="space-y-1.5">
                      {card.items.map((item) => (
                        <div key={item.label} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className={cn("font-semibold", item.ok ? "text-emerald-600" : "text-red-600")}>{item.value}</span>
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

      {/* ── OWASP Top 10 ─────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.18 }}>
        <Card>
          <CardHeader className="pb-3">
            <SectionHeading icon={Eye} title="OWASP Top 10" subtitle="Risk assessment against the OWASP Top 10 application security risks (2021)" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs w-[60px]">Rank</TableHead>
                    <TableHead className="text-xs">Risk</TableHead>
                    <TableHead className="text-xs">Severity</TableHead>
                    <TableHead className="text-xs text-center">Affected</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Recommended Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {OWASP.map((row) => (
                    <TableRow key={row.rank} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-mono text-xs font-bold text-muted-foreground">{row.rank}</TableCell>
                      <TableCell className="text-sm font-medium">{row.risk}</TableCell>
                      <TableCell><SevBadge s={row.severity} /></TableCell>
                      <TableCell className="text-center text-sm">{row.affected}</TableCell>
                      <TableCell>
                        <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", owaspStatus[row.status])}>
                          {row.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[320px]">{row.action}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Vulnerability Table ───────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.22 }}>
        <Card>
          <CardHeader className="pb-3">
            <SectionHeading icon={BugIcon} title="Vulnerability Register" subtitle="CVE-tracked vulnerabilities across all projects" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs">CVE ID</TableHead>
                    <TableHead className="text-xs">Title</TableHead>
                    <TableHead className="text-xs">Severity</TableHead>
                    <TableHead className="text-xs">CVSS</TableHead>
                    <TableHead className="text-xs">Project</TableHead>
                    <TableHead className="text-xs">Detected</TableHead>
                    <TableHead className="text-xs">Owner</TableHead>
                    <TableHead className="text-xs">ETA</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {VULNS.map((v) => (
                    <TableRow key={v.cve} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-mono text-xs text-primary font-semibold">{v.cve}</TableCell>
                      <TableCell className="text-xs font-medium max-w-[200px] truncate">{v.title}</TableCell>
                      <TableCell><SevBadge s={v.severity} /></TableCell>
                      <TableCell>
                        <span className={cn("text-xs font-bold tabular-nums", v.cvss >= 9 ? "text-red-600" : v.cvss >= 7 ? "text-orange-600" : v.cvss >= 4 ? "text-amber-600" : "text-emerald-600")}>
                          {v.cvss.toFixed(1)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">{v.project}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{v.detected}</TableCell>
                      <TableCell className="text-xs">{v.owner}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{v.eta}</TableCell>
                      <TableCell>
                        <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", vulnStatus[v.status])}>
                          {v.status}
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

      {/* ── Compliance Dashboard ──────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.26 }}>
        <Card>
          <CardHeader className="pb-3">
            <SectionHeading icon={ShieldCheck} title="Compliance Dashboard" subtitle="Certification and regulatory compliance status" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
              {COMPLIANCE.map((c) => {
                const CIcon = c.icon;
                const cm = colorMap[c.color] ?? colorMap.indigo;
                return (
                  <div key={c.name} className={cn("rounded-xl border p-4 space-y-3", cm.border)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-semibold text-foreground">{c.name}</span>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-0.5">
                      <span className={cn("text-3xl font-bold tabular-nums", cm.scoreText)}>{c.score}</span>
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                    <Progress value={c.score} className="h-1.5" />
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border inline-block capitalize", compBg(c.status), compColor(c.status))}>
                      {c.status === "non-compliant" ? "Non-Compliant" : c.status === "partial" ? "Partial" : "Compliant"}
                    </span>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Audit</span>
                        <span className="font-medium">{c.lastAudit}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Next Review</span>
                        <span className="font-medium">{c.nextReview}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── AI Security Recommendations ───────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.3 }}>
        <Card className="border border-violet-200 bg-gradient-to-br from-violet-50/80 to-indigo-50/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <SectionHeading icon={Bot} title="AI Security Recommendations" subtitle="Enterprise AI threat analysis and remediation guidance" />
              <Badge variant="outline" className="text-xs bg-violet-100 border-violet-300 text-violet-700 gap-1">
                <Sparkles className="h-3 w-3" /> AI · 94% confidence
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top Risks */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-red-500" /> Top Risks
                </p>
                <ul className="space-y-2">
                  {aiRisks.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-400 flex-shrink-0" />{r}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommended Actions */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-violet-500" /> Recommended Actions
                </p>
                <div className="space-y-2">
                  {aiActions.map((a, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <ChevronRight className="mt-0.5 h-3.5 w-3.5 text-violet-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">{a.action}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full border", priorityBadge[a.priority])}>{a.priority}</span>
                          <span className="text-xs text-muted-foreground">ETA: {a.eta}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Business & Security Impact */}
              <div className="md:col-span-2 border-t border-violet-200 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Business Impact</p>
                    <p className="text-sm text-foreground">Critical CVEs in production expose customer data and risk regulatory fines up to €20M under GDPR. Immediate patching required.</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Root Cause Summary</p>
                    <p className="text-sm text-foreground">Outdated dependencies and missing RBAC controls account for 68% of all findings. Automated SCA in CI/CD would prevent recurrence.</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Expected Risk Reduction</p>
                    <div className="flex items-center gap-2">
                      <Progress value={76} className="h-2 flex-1" />
                      <span className="text-xs font-bold text-violet-700">76%</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">After completing all P0/P1 actions</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Security Analytics ────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.34 }}>
        <Card>
          <CardHeader className="pb-3">
            <SectionHeading icon={TrendingUp} title="Security Analytics" subtitle="6-month vulnerability trends, compliance progress and risk distribution" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {/* Vulnerabilities by Severity */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3">Vulnerabilities by Severity</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={SEV_BAR} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="value" name="Count" radius={[3, 3, 0, 0]}>
                      {SEV_BAR.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Risk Distribution Pie */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3">Risk Distribution</p>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={RISK_DIST} cx="50%" cy="50%" innerRadius={42} outerRadius={68} paddingAngle={3} dataKey="value">
                      {RISK_DIST.map((_, i) => <Cell key={i} fill={CHART_COLORS_SEV[i]} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Open vs Closed */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3">Open vs Closed Vulnerabilities</p>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={OPEN_CLOSED} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="openGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="closedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="open" stroke="#ef4444" strokeWidth={2} fill="url(#openGrad)" name="Open" />
                    <Area type="monotone" dataKey="closed" stroke="#10b981" strokeWidth={2} fill="url(#closedGrad)" name="Closed" />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Second row */}
            <div className="mt-6 pt-6 border-t border-border grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly Security Score Trend */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3">Monthly Security Score Trend</p>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={MONTHLY_TREND} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="scoreSecGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis domain={[50, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} fill="url(#scoreSecGrad)" name="Security Score" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Compliance Trend */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3">Compliance Trend</p>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={COMP_TREND} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis domain={[55, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="iso" stroke="#6366f1" strokeWidth={2} dot={false} name="ISO 27001" />
                    <Line type="monotone" dataKey="soc2" stroke="#10b981" strokeWidth={2} dot={false} name="SOC 2" />
                    <Line type="monotone" dataKey="gdpr" stroke="#f59e0b" strokeWidth={2} dot={false} name="GDPR" />
                    <Line type="monotone" dataKey="pci" stroke="#3b82f6" strokeWidth={2} dot={false} name="PCI-DSS" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Security Timeline + Quick Actions ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline */}
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.38 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <SectionHeading icon={Activity} title="Security Timeline" subtitle="Recent security events and scan activity" />
            </CardHeader>
            <CardContent className="space-y-0">
              {TIMELINE.map((item, i) => (
                <div key={i} className="flex items-start gap-3 py-3 border-b border-border last:border-0">
                  <div className={cn("h-2 w-2 rounded-full mt-1.5 flex-shrink-0", actDot[item.type])} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground leading-snug">{item.event}</p>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">{item.time}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.4 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-3">
              <SectionHeading icon={Zap} title="Quick Actions" subtitle="Common security operations" />
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: "Run Full Scan", icon: Play, handler: handleScan, disabled: scanning, variant: "default" as const },
                { label: "View Vulnerabilities", icon: BugIcon, handler: () => toast({ title: "Vulnerability viewer opened" }), disabled: false, variant: "outline" as const },
                { label: "Patch Recommendations", icon: ShieldAlert, handler: () => toast({ title: "Generating patch plan…" }), disabled: false, variant: "outline" as const },
                { label: "Generate Compliance Report", icon: ClipboardList, handler: () => toast({ title: "Compliance report queued" }), disabled: false, variant: "outline" as const },
                { label: "Assign Security Review", icon: UserCheck, handler: () => toast({ title: "Security review assigned to team" }), disabled: false, variant: "outline" as const },
                { label: "Export Findings", icon: FileSearch, handler: handleExport, disabled: false, variant: "outline" as const },
              ].map(({ label, icon: Icon, handler, disabled, variant }) => (
                <Button
                  key={label}
                  variant={variant}
                  className="w-full justify-start gap-2"
                  disabled={disabled}
                  onClick={handler}
                >
                  <Icon className="h-4 w-4" />
                  {label === "Run Full Scan" && scanning ? "Scanning…" : label}
                </Button>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
