import { useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetProject,
  useGetProjectStats,
  useListAudits,
  useCreateAudit,
  useGetProjectHealthScore,
  useGetProjectTechProfile,
  useUpdateProjectTechProfile,
  getGetProjectQueryKey,
  getGetProjectStatsQueryKey,
  getListAuditsQueryKey,
  getGetProjectHealthScoreQueryKey,
  getGetProjectTechProfileQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2, ArrowLeft, Play, ExternalLink, Activity, Bug as BugIcon, Clock,
  Heart, Cpu, Wrench, ChevronRight,
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { LiveAuditModal } from "@/components/live-audit-modal";

const TEMPLATE_LABELS: Record<string, string> = {
  react: "React", vite: "Vite", nextjs: "Next.js", wordpress: "WordPress",
  shopify: "Shopify", laravel: "Laravel", nodejs_api: "Node.js API", static: "Static", custom: "Custom",
};

const HEALTH_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  excellent: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  good: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  warning: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  critical: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
};

export default function ProjectDetail() {
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [techForm, setTechForm] = useState<Record<string, string> | null>(null);
  const [liveAuditId, setLiveAuditId] = useState<number | null>(null);
  const [liveModalOpen, setLiveModalOpen] = useState(false);

  const { data: project, isLoading: isProjectLoading } = useGetProject(projectId);
  const { data: stats } = useGetProjectStats(projectId);
  const { data: audits } = useListAudits({ projectId });
  const { data: healthScore } = useGetProjectHealthScore(projectId);
  const { data: techProfile } = useGetProjectTechProfile(projectId);

  const createAuditMutation = useCreateAudit();
  const updateTechProfileMutation = useUpdateProjectTechProfile();

  const handleRunAudit = () => {
    createAuditMutation.mutate(
      { data: { projectId } },
      {
        onSuccess: (data) => {
          toast({ title: "Audit started" });
          queryClient.invalidateQueries({ queryKey: getListAuditsQueryKey({ projectId }) });
          setLiveAuditId(data.id);
          setLiveModalOpen(true);
        },
        onError: (err: unknown) => toast({ title: "Failed to start audit", description: (err as Error).message, variant: "destructive" }),
      }
    );
  };

  const handleSaveTechProfile = () => {
    if (!techForm) return;
    updateTechProfileMutation.mutate(
      { id: projectId, data: techForm },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProjectTechProfileQueryKey(projectId) });
          setTechForm(null);
          toast({ title: "Tech profile updated" });
        },
      }
    );
  };

  if (isProjectLoading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!project) return <div>Project not found</div>;

  const hc = healthScore ? HEALTH_COLORS[healthScore.status] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/projects"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
              <Badge variant="outline" className="capitalize">{project.environment}</Badge>
              {project.auditTemplate && project.auditTemplate !== "custom" && (
                <Badge variant="secondary">{TEMPLATE_LABELS[project.auditTemplate] ?? project.auditTemplate}</Badge>
              )}
            </div>
            <a href={project.url} target="_blank" rel="noreferrer" className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5">
              {project.url} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
        <Button onClick={handleRunAudit} disabled={createAuditMutation.isPending}>
          {createAuditMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          Run Audit
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <Activity className="h-8 w-8 text-primary/70 p-1.5 bg-primary/10 rounded-md" />
              <div>
                <p className="text-2xl font-bold">{stats?.totalAudits ?? 0}</p>
                <p className="text-xs text-muted-foreground">Total Audits</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <BugIcon className="h-8 w-8 text-destructive/70 p-1.5 bg-destructive/10 rounded-md" />
              <div>
                <p className="text-2xl font-bold">{stats?.openBugs ?? 0}</p>
                <p className="text-xs text-muted-foreground">Open Bugs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-muted-foreground/70 p-1.5 bg-muted rounded-md" />
              <div>
                <p className="text-2xl font-bold">{stats?.avgPerformanceScore ? Math.round(stats.avgPerformanceScore) : "—"}</p>
                <p className="text-xs text-muted-foreground">Avg Performance</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Health Score Card */}
        {healthScore && hc && (
          <Card className={cn("border", hc.border, hc.bg)}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <Heart className={cn("h-8 w-8 p-1.5 rounded-md", hc.text, hc.bg)} />
                <div>
                  <p className={cn("text-2xl font-bold", hc.text)}>{healthScore.score}</p>
                  <p className={cn("text-xs capitalize font-medium", hc.text)}>Health: {healthScore.status}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs defaultValue="audits">
        <TabsList>
          <TabsTrigger value="audits">Audit History</TabsTrigger>
          <TabsTrigger value="tech">Tech Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="audits" className="mt-4">
          <Card>
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base">Audit History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!audits?.length ? (
                <div className="p-8 text-center text-muted-foreground">
                  <p>No audits yet.</p>
                  <Button className="mt-4" onClick={handleRunAudit} disabled={createAuditMutation.isPending}>
                    <Play className="mr-2 h-4 w-4" /> Run First Audit
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {audits.map((audit) => (
                    <Link key={audit.id} href={`/audits/${audit.id}`}>
                      <div className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors">
                        <div className="flex items-center gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">Audit #{audit.id}</span>
                              <StatusBadge status={audit.status} />
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {format(new Date(audit.createdAt), "MMM d, yyyy 'at' h:mm a")}
                              {audit.durationMs && ` · ${Math.round(audit.durationMs / 1000)}s`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {audit.overallScore != null && (
                            <div className="text-right">
                              <p className="text-lg font-bold">{Math.round(audit.overallScore)}</p>
                              <p className="text-xs text-muted-foreground">Score</p>
                            </div>
                          )}
                          {audit.bugsFound != null && audit.bugsFound > 0 && (
                            <div className="text-right">
                              <p className="text-lg font-bold text-destructive">{audit.bugsFound}</p>
                              <p className="text-xs text-muted-foreground">Bugs</p>
                            </div>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tech" className="mt-4">
          <Card>
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-primary" /> Technology Profile
                  </CardTitle>
                  <CardDescription>Stack information used to tailor audit checks</CardDescription>
                </div>
                {!techForm ? (
                  <Button variant="outline" size="sm" onClick={() => setTechForm({
                    framework: (techProfile as Record<string, string> | null)?.framework ?? "",
                    frontendStack: (techProfile as Record<string, string> | null)?.frontendStack ?? "",
                    backendStack: (techProfile as Record<string, string> | null)?.backendStack ?? "",
                    cms: (techProfile as Record<string, string> | null)?.cms ?? "",
                    database: (techProfile as Record<string, string> | null)?.database ?? "",
                    notes: (techProfile as Record<string, string> | null)?.notes ?? "",
                  })}>
                    <Wrench className="h-3.5 w-3.5 mr-1.5" /> Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setTechForm(null)}>Cancel</Button>
                    <Button size="sm" onClick={handleSaveTechProfile} disabled={updateTechProfileMutation.isPending}>
                      {updateTechProfileMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                      Save
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              {techForm ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { key: "framework", label: "Framework", placeholder: "e.g. React 18, Next.js 14" },
                    { key: "frontendStack", label: "Frontend Stack", placeholder: "e.g. Tailwind, TypeScript" },
                    { key: "backendStack", label: "Backend Stack", placeholder: "e.g. Node.js, Express" },
                    { key: "cms", label: "CMS", placeholder: "e.g. WordPress, Contentful" },
                    { key: "database", label: "Database", placeholder: "e.g. PostgreSQL, MongoDB" },
                    { key: "notes", label: "Notes", placeholder: "Additional notes" },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key} className="space-y-1.5">
                      <Label className="text-sm">{label}</Label>
                      <Input
                        placeholder={placeholder}
                        value={techForm[key] ?? ""}
                        onChange={e => setTechForm(f => ({ ...f!, [key]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { key: "framework", label: "Framework" },
                    { key: "frontendStack", label: "Frontend Stack" },
                    { key: "backendStack", label: "Backend Stack" },
                    { key: "cms", label: "CMS" },
                    { key: "database", label: "Database" },
                    { key: "notes", label: "Notes" },
                  ].map(({ key, label }) => {
                    const val = (techProfile as Record<string, string> | null)?.[key];
                    return (
                      <div key={key} className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                        <p className={cn("text-sm", val ? "text-foreground" : "text-muted-foreground italic")}>{val || "Not specified"}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <LiveAuditModal
        open={liveModalOpen}
        auditId={liveAuditId}
        projectUrl={project.url}
        onOpenChange={setLiveModalOpen}
      />
    </div>
  );
}
