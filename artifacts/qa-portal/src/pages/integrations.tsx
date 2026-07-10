import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plug,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Search,
  Settings2,
  Clock,
  Activity,
  Gauge,
  Github,
  Slack,
  Trello,
  Waypoints,
  GitBranch,
  MessageSquare,
  KanbanSquare,
  ListChecks,
  Workflow,
  Bug as BugIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Mock / demo data only. No backend, no OAuth, no real API calls, no env vars.
// ---------------------------------------------------------------------------

type IntegrationStatus = "connected" | "disconnected";
type HealthStatus = "healthy" | "warning" | "failed";

interface IntegrationDef {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  brandColor: string;
  status: IntegrationStatus;
  version: string;
  lastSync: string; // ISO
  health: HealthStatus;
  syncFrequency: string;
  owner: string;
  apiEndpoint: string;
  workspaceName: string;
  projectMapping: string;
  webhookStatus: "active" | "inactive";
  autoSync: boolean;
  notifications: boolean;
  environment: "Production" | "Staging" | "Development";
}

const now = new Date("2026-07-10T06:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600 * 1000).toISOString();

const initialIntegrations: IntegrationDef[] = [
  {
    id: "github", name: "GitHub", description: "Sync repositories, pull requests, and CI status.",
    icon: Github, brandColor: "text-foreground", status: "connected", version: "v3.2.1",
    lastSync: hoursAgo(0.3), health: "healthy", syncFrequency: "Every 15 min", owner: "Priya Nair",
    apiEndpoint: "https://api.github.com/orgs/qa-portal (mock)", workspaceName: "qa-portal-org",
    projectMapping: "QA Portal → github.com/qa-portal/webapp", webhookStatus: "active", autoSync: true, notifications: true,
    environment: "Production",
  },
  {
    id: "gitlab", name: "GitLab", description: "Track merge requests, pipelines, and issue sync.",
    icon: GitBranch, brandColor: "text-orange-600", status: "disconnected", version: "v2.0.4",
    lastSync: hoursAgo(96), health: "failed", syncFrequency: "Every 30 min", owner: "Marcus Chen",
    apiEndpoint: "https://gitlab.com/api/v4 (mock)", workspaceName: "qa-portal-gitlab",
    projectMapping: "Not mapped", webhookStatus: "inactive", autoSync: false, notifications: false,
    environment: "Staging",
  },
  {
    id: "jira", name: "Jira", description: "Two-way sync of bugs and tickets with Jira issues.",
    icon: KanbanSquare, brandColor: "text-blue-600", status: "connected", version: "v4.1.0",
    lastSync: hoursAgo(1.1), health: "healthy", syncFrequency: "Every 10 min", owner: "Elena Rodriguez",
    apiEndpoint: "https://qa-portal.atlassian.net/rest/api/3 (mock)", workspaceName: "QA-PORTAL",
    projectMapping: "Bugs → QAP project", webhookStatus: "active", autoSync: true, notifications: true,
    environment: "Production",
  },
  {
    id: "azure-devops", name: "Azure DevOps", description: "Connect boards, repos, and release pipelines.",
    icon: Workflow, brandColor: "text-sky-600", status: "connected", version: "v1.8.2",
    lastSync: hoursAgo(3.4), health: "warning", syncFrequency: "Hourly", owner: "Sam Whitfield",
    apiEndpoint: "https://dev.azure.com/qa-portal (mock)", workspaceName: "qa-portal-ado",
    projectMapping: "Audits → QA Pipelines board", webhookStatus: "active", autoSync: true, notifications: false,
    environment: "Production",
  },
  {
    id: "bitbucket", name: "Bitbucket", description: "Mirror repositories and pull request activity.",
    icon: Waypoints, brandColor: "text-indigo-600", status: "disconnected", version: "v1.3.0",
    lastSync: hoursAgo(240), health: "failed", syncFrequency: "Every 30 min", owner: "Marcus Chen",
    apiEndpoint: "https://api.bitbucket.org/2.0 (mock)", workspaceName: "qa-portal-bb",
    projectMapping: "Not mapped", webhookStatus: "inactive", autoSync: false, notifications: false,
    environment: "Development",
  },
  {
    id: "slack", name: "Slack", description: "Send audit alerts and bug notifications to channels.",
    icon: Slack, brandColor: "text-fuchsia-600", status: "connected", version: "v5.0.1",
    lastSync: hoursAgo(0.1), health: "healthy", syncFrequency: "Real-time", owner: "Priya Nair",
    apiEndpoint: "https://slack.com/api (mock)", workspaceName: "qa-portal.slack.com",
    projectMapping: "#qa-alerts channel", webhookStatus: "active", autoSync: true, notifications: true,
    environment: "Production",
  },
  {
    id: "teams", name: "Microsoft Teams", description: "Post pipeline and audit updates to Teams channels.",
    icon: MessageSquare, brandColor: "text-violet-600", status: "connected", version: "v2.2.0",
    lastSync: hoursAgo(2.0), health: "warning", syncFrequency: "Real-time", owner: "Sam Whitfield",
    apiEndpoint: "https://graph.microsoft.com/v1.0 (mock)", workspaceName: "qa-portal.onmicrosoft.com",
    projectMapping: "QA Automation team", webhookStatus: "active", autoSync: true, notifications: true,
    environment: "Production",
  },
  {
    id: "trello", name: "Trello", description: "Create cards from bugs and track board progress.",
    icon: Trello, brandColor: "text-blue-500", status: "disconnected", version: "v1.1.5",
    lastSync: hoursAgo(400), health: "failed", syncFrequency: "Every 30 min", owner: "Elena Rodriguez",
    apiEndpoint: "https://api.trello.com/1 (mock)", workspaceName: "Not connected",
    projectMapping: "Not mapped", webhookStatus: "inactive", autoSync: false, notifications: false,
    environment: "Development",
  },
  {
    id: "clickup", name: "ClickUp", description: "Sync tasks and sprints with ClickUp spaces.",
    icon: ListChecks, brandColor: "text-pink-600", status: "disconnected", version: "v1.0.2",
    lastSync: hoursAgo(600), health: "failed", syncFrequency: "Hourly", owner: "Unassigned",
    apiEndpoint: "https://api.clickup.com/api/v2 (mock)", workspaceName: "Not connected",
    projectMapping: "Not mapped", webhookStatus: "inactive", autoSync: false, notifications: false,
    environment: "Development",
  },
  {
    id: "asana", name: "Asana", description: "Turn audit findings into trackable Asana tasks.",
    icon: Waypoints, brandColor: "text-rose-500", status: "connected", version: "v2.4.3",
    lastSync: hoursAgo(5.5), health: "warning", syncFrequency: "Every 2 hours", owner: "Elena Rodriguez",
    apiEndpoint: "https://app.asana.com/api/1.0 (mock)", workspaceName: "QA Portal Workspace",
    projectMapping: "Bugs → QA Remediation project", webhookStatus: "active", autoSync: true, notifications: false,
    environment: "Staging",
  },
  {
    id: "linear", name: "Linear", description: "Sync engineering issues with Linear cycles.",
    icon: Activity, brandColor: "text-purple-600", status: "connected", version: "v3.0.0",
    lastSync: hoursAgo(0.6), health: "healthy", syncFrequency: "Every 10 min", owner: "Marcus Chen",
    apiEndpoint: "https://api.linear.app/graphql (mock)", workspaceName: "qa-portal",
    projectMapping: "Bugs → QAP team cycle", webhookStatus: "active", autoSync: true, notifications: true,
    environment: "Production",
  },
  {
    id: "sentry", name: "Sentry", description: "Correlate runtime errors with audits and bugs.",
    icon: BugIcon, brandColor: "text-red-600", status: "connected", version: "v2.9.1",
    lastSync: hoursAgo(0.9), health: "healthy", syncFrequency: "Real-time", owner: "Sam Whitfield",
    apiEndpoint: "https://sentry.io/api/0 (mock)", workspaceName: "qa-portal-sentry",
    projectMapping: "Audits → qa-portal-webapp project", webhookStatus: "active", autoSync: true, notifications: true,
    environment: "Production",
  },
];

interface SyncHistoryRow {
  id: number;
  integration: string;
  action: "Successful Sync" | "Manual Sync" | "Auto Sync" | "Configuration Updated" | "Authentication Refreshed";
  startedAt: string;
  completedAt: string;
  status: "success" | "failed" | "warning";
  triggeredBy: string;
}

const syncHistory: SyncHistoryRow[] = [
  { id: 1, integration: "GitHub", action: "Auto Sync", startedAt: hoursAgo(0.3), completedAt: hoursAgo(0.28), status: "success", triggeredBy: "System" },
  { id: 2, integration: "Slack", action: "Successful Sync", startedAt: hoursAgo(0.1), completedAt: hoursAgo(0.09), status: "success", triggeredBy: "System" },
  { id: 3, integration: "Jira", action: "Manual Sync", startedAt: hoursAgo(1.1), completedAt: hoursAgo(1.05), status: "success", triggeredBy: "Elena Rodriguez" },
  { id: 4, integration: "Azure DevOps", action: "Auto Sync", startedAt: hoursAgo(3.4), completedAt: hoursAgo(3.35), status: "warning", triggeredBy: "System" },
  { id: 5, integration: "Microsoft Teams", action: "Configuration Updated", startedAt: hoursAgo(2.0), completedAt: hoursAgo(1.98), status: "warning", triggeredBy: "Sam Whitfield" },
  { id: 6, integration: "Linear", action: "Authentication Refreshed", startedAt: hoursAgo(6), completedAt: hoursAgo(5.99), status: "success", triggeredBy: "System" },
  { id: 7, integration: "GitLab", action: "Auto Sync", startedAt: hoursAgo(96), completedAt: hoursAgo(95.9), status: "failed", triggeredBy: "System" },
  { id: 8, integration: "Bitbucket", action: "Manual Sync", startedAt: hoursAgo(240), completedAt: hoursAgo(239.95), status: "failed", triggeredBy: "Marcus Chen" },
  { id: 9, integration: "Sentry", action: "Successful Sync", startedAt: hoursAgo(0.9), completedAt: hoursAgo(0.88), status: "success", triggeredBy: "System" },
  { id: 10, integration: "Asana", action: "Auto Sync", startedAt: hoursAgo(5.5), completedAt: hoursAgo(5.4), status: "warning", triggeredBy: "System" },
];

interface ActivityRow {
  id: number;
  text: string;
  integration: string;
  time: string;
  icon: React.ComponentType<{ className?: string }>;
}

const recentActivity: ActivityRow[] = [
  { id: 1, text: "GitHub synced repository qa-portal/webapp", integration: "GitHub", time: hoursAgo(0.3), icon: Github },
  { id: 2, text: "Jira issue QAP-482 imported as new bug", integration: "Jira", time: hoursAgo(1.1), icon: KanbanSquare },
  { id: 3, text: "Slack notification sent to #qa-alerts", integration: "Slack", time: hoursAgo(0.1), icon: Slack },
  { id: 4, text: "Azure DevOps pipeline \"release-4.2\" connected", integration: "Azure DevOps", time: hoursAgo(3.4), icon: Workflow },
  { id: 5, text: "Bitbucket webhook updated for qa-portal-bb", integration: "Bitbucket", time: hoursAgo(240), icon: Waypoints },
  { id: 6, text: "Teams message delivered to QA Automation team", integration: "Microsoft Teams", time: hoursAgo(2.0), icon: MessageSquare },
];

const HEALTH_STYLES: Record<HealthStatus, string> = {
  healthy: "bg-green-100 text-green-800 border-green-200",
  warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
  failed: "bg-red-100 text-red-800 border-red-200",
};

const SYNC_STATUS_STYLES: Record<SyncHistoryRow["status"], string> = {
  success: "bg-green-100 text-green-800 border-green-200",
  warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
  failed: "bg-red-100 text-red-800 border-red-200",
};

type FilterKey = "all" | "connected" | "disconnected" | "healthy" | "needs-attention";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "connected", label: "Connected" },
  { key: "disconnected", label: "Disconnected" },
  { key: "healthy", label: "Healthy" },
  { key: "needs-attention", label: "Needs Attention" },
];

function relativeTime(iso: string): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function AnimatedCounter({ value, suffix = "" }: { value: number; suffix?: string }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {value}{suffix}
    </motion.span>
  );
}

export default function Integrations() {
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<IntegrationDef[]>(initialIntegrations);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const active = integrations.find((i) => i.id === activeId) ?? null;

  const updateIntegration = (id: string, patch: Partial<IntegrationDef>) => {
    setIntegrations((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const handleConnect = (i: IntegrationDef) => {
    updateIntegration(i.id, { status: "connected", health: "healthy", lastSync: new Date().toISOString(), webhookStatus: "active" });
    toast({ title: `${i.name} connected`, description: "This is a mock connection — no real OAuth or API calls were made." });
  };

  const handleDisconnect = (i: IntegrationDef) => {
    updateIntegration(i.id, { status: "disconnected", health: "failed", autoSync: false, webhookStatus: "inactive" });
    toast({ title: `${i.name} disconnected` });
  };

  const handleSyncNow = (i: IntegrationDef) => {
    if (i.status !== "connected") {
      toast({ title: "Connect the integration before syncing", variant: "destructive" });
      return;
    }
    updateIntegration(i.id, { lastSync: new Date().toISOString(), health: "healthy" });
    toast({ title: `Sync started for ${i.name}`, description: "Mock sync completed successfully." });
  };

  const openConfigure = (i: IntegrationDef) => {
    setActiveId(i.id);
    setDrawerOpen(true);
  };

  const filtered = useMemo(() => {
    return integrations.filter((i) => {
      if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
      switch (filter) {
        case "connected": return i.status === "connected";
        case "disconnected": return i.status === "disconnected";
        case "healthy": return i.health === "healthy";
        case "needs-attention": return i.health === "warning" || i.health === "failed";
        default: return true;
      }
    });
  }, [integrations, filter, search]);

  const connectedCount = integrations.filter((i) => i.status === "connected").length;
  const availableCount = integrations.length;
  const lastSuccessfulSync = integrations
    .filter((i) => i.status === "connected")
    .reduce<string | null>((latest, i) => (!latest || new Date(i.lastSync) > new Date(latest) ? i.lastSync : latest), null);
  const failedConnections = integrations.filter((i) => i.health === "failed").length;
  const syncHealthPct = Math.round((integrations.filter((i) => i.health === "healthy").length / integrations.length) * 100);

  const healthyCount = integrations.filter((i) => i.health === "healthy").length;
  const warningCount = integrations.filter((i) => i.health === "warning").length;
  const disconnectedCount = integrations.filter((i) => i.status === "disconnected").length;
  const failedSyncsCount = syncHistory.filter((s) => s.status === "failed").length;
  const avgResponseMs = 214;
  const weeklySyncCount = 1284;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Plug className="h-6 w-6 text-primary" />
            Enterprise Integrations Hub
          </h1>
          <p className="text-muted-foreground mt-1">
            Connect and manage third-party tools across your QA workflow.
          </p>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Connected Integrations</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground"><AnimatedCounter value={connectedCount} /></div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Available Integrations</CardTitle>
            <Plug className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground"><AnimatedCounter value={availableCount} /></div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Last Successful Sync</CardTitle>
            <Clock className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {lastSuccessfulSync ? relativeTime(lastSuccessfulSync) : "—"}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed Connections</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600"><AnimatedCounter value={failedConnections} /></div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sync Health</CardTitle>
            <Gauge className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600"><AnimatedCounter value={syncHealthPct} suffix="%" /></div>
            <Progress value={syncHealthPct} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium border transition-colors",
                filter === f.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:bg-muted"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by integration…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Integrations grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filtered.map((integration, idx) => {
            const Icon = integration.icon;
            return (
              <motion.div
                key={integration.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, delay: idx * 0.02, ease: "easeOut" }}
                whileHover={{ y: -3 }}
              >
                <Card className="h-full shadow-sm border-border transition-shadow hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                          <Icon className={cn("h-5 w-5", integration.brandColor)} />
                        </div>
                        <div>
                          <CardTitle className="text-base">{integration.name}</CardTitle>
                          <p className="text-xs text-muted-foreground">{integration.version}</p>
                        </div>
                      </div>
                      <motion.div
                        key={integration.status}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Badge
                          variant="outline"
                          className={integration.status === "connected"
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "bg-gray-100 text-gray-600 border-gray-200"}
                        >
                          {integration.status === "connected" ? "Connected" : "Disconnected"}
                        </Badge>
                      </motion.div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{integration.description}</p>

                    <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                      <span className="text-muted-foreground">Health</span>
                      <span className="text-right">
                        <Badge variant="outline" className={cn("capitalize", HEALTH_STYLES[integration.health])}>
                          {integration.health}
                        </Badge>
                      </span>
                      <span className="text-muted-foreground">Last Sync</span>
                      <span className="text-right text-foreground font-medium">{relativeTime(integration.lastSync)}</span>
                      <span className="text-muted-foreground">Sync Frequency</span>
                      <span className="text-right text-foreground font-medium">{integration.syncFrequency}</span>
                      <span className="text-muted-foreground">Owner</span>
                      <span className="text-right text-foreground font-medium truncate">{integration.owner}</span>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      {integration.status === "disconnected" ? (
                        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                          <Button size="sm" onClick={() => handleConnect(integration)}>Connect</Button>
                        </motion.div>
                      ) : (
                        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                          <Button size="sm" variant="outline" onClick={() => handleDisconnect(integration)}>Disconnect</Button>
                        </motion.div>
                      )}
                      <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                        <Button size="sm" variant="outline" onClick={() => openConfigure(integration)}>
                          <Settings2 className="h-3.5 w-3.5 mr-1.5" /> Configure
                        </Button>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={integration.status !== "connected"}
                          onClick={() => handleSyncNow(integration)}
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Sync Now
                        </Button>
                      </motion.div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No integrations match your filters.
          </div>
        )}
      </div>

      {/* Health dashboard */}
      <Card className="shadow-sm border-border">
        <CardHeader>
          <CardTitle>Integration Health Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: "Healthy Integrations", value: healthyCount, color: "text-green-600" },
              { label: "Warning", value: warningCount, color: "text-yellow-600" },
              { label: "Disconnected", value: disconnectedCount, color: "text-gray-500" },
              { label: "Failed Syncs", value: failedSyncsCount, color: "text-red-600" },
              { label: "Avg Response Time", value: avgResponseMs, suffix: "ms", color: "text-indigo-600" },
              { label: "Weekly Sync Count", value: weeklySyncCount, color: "text-primary" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className={cn("text-xl font-bold mt-1", stat.color)}>
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sync history */}
        <Card className="lg:col-span-2 shadow-sm border-border">
          <CardHeader>
            <CardTitle>Sync History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Integration</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Triggered By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncHistory.map((row) => {
                  const durationSec = Math.max(1, Math.round((new Date(row.completedAt).getTime() - new Date(row.startedAt).getTime()) / 1000));
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.integration}</TableCell>
                      <TableCell className="text-muted-foreground">{row.action}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{relativeTime(row.startedAt)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{relativeTime(row.completedAt)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{durationSec}s</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("capitalize", SYNC_STATUS_STYLES[row.status])}>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.triggeredBy}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: idx * 0.04, ease: "easeOut" }}
                    className="flex items-start gap-3"
                  >
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-foreground leading-snug">{item.text}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{relativeTime(item.time)}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configure drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <active.icon className={cn("h-5 w-5", active.brandColor)} />
                  {active.name} Configuration
                </SheetTitle>
                <SheetDescription>Mock connection details — no real credentials or API calls.</SheetDescription>
              </SheetHeader>

              <div className="space-y-5 py-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Connection Details</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">API Endpoint</span>
                      <span className="text-right font-mono text-xs break-all">{active.apiEndpoint}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Workspace Name</span>
                      <span className="text-right font-medium">{active.workspaceName}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Project Mapping</span>
                      <span className="text-right font-medium">{active.projectMapping}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Webhook Status</span>
                      <Badge variant="outline" className={active.webhookStatus === "active" ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"}>
                        {active.webhookStatus}
                      </Badge>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Environment</span>
                      <span className="text-right font-medium">{active.environment}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-md border border-border p-3">
                  <Label htmlFor="auto-sync" className="text-sm">Auto Sync</Label>
                  <Switch
                    id="auto-sync"
                    checked={active.autoSync}
                    onCheckedChange={(v) => updateIntegration(active.id, { autoSync: v })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border p-3">
                  <Label htmlFor="notifications" className="text-sm">Notifications</Label>
                  <Switch
                    id="notifications"
                    checked={active.notifications}
                    onCheckedChange={(v) => updateIntegration(active.id, { notifications: v })}
                  />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Last Sync History</h3>
                  <div className="space-y-2">
                    {syncHistory.filter((s) => s.integration === active.name).slice(0, 3).map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-sm border border-border rounded-md p-2">
                        <span className="text-muted-foreground">{s.action}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{relativeTime(s.startedAt)}</span>
                          <Badge variant="outline" className={cn("capitalize", SYNC_STATUS_STYLES[s.status])}>{s.status}</Badge>
                        </div>
                      </div>
                    ))}
                    {syncHistory.filter((s) => s.integration === active.name).length === 0 && (
                      <p className="text-sm text-muted-foreground">No sync history yet.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Recent Activity Timeline</h3>
                  <div className="space-y-2">
                    {recentActivity.filter((a) => a.integration === active.name).map((a) => (
                      <div key={a.id} className="flex items-start gap-2 text-sm">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        <div>
                          <p className="text-foreground">{a.text}</p>
                          <p className="text-xs text-muted-foreground">{relativeTime(a.time)}</p>
                        </div>
                      </div>
                    ))}
                    {recentActivity.filter((a) => a.integration === active.name).length === 0 && (
                      <p className="text-sm text-muted-foreground">No recent activity for this integration.</p>
                    )}
                  </div>
                </div>
              </div>

              <SheetFooter>
                <Button
                  className="w-full"
                  onClick={() => {
                    toast({ title: "Configuration saved", description: `${active.name} settings updated (mock).` });
                    setDrawerOpen(false);
                  }}
                >
                  Save Configuration
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
