import { useState } from "react";
import type { JSX } from "react";
import {
  useListCrawlJobs,
  useCreateCrawlJob,
  useDeleteCrawlJob,
  useListCrawlPages,
  useListProjects,
  getListCrawlJobsQueryKey,
  type CrawlJob,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Globe, Plus, Trash2, ChevronDown, RefreshCw, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-gray-100 text-gray-700 border-gray-200",
  running:   "bg-blue-100 text-blue-700 border-blue-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  failed:    "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-yellow-100 text-yellow-700 border-yellow-200",
};

const PAGE_STATUS_ICON: Record<string, JSX.Element | undefined> = {
  pending:   <Clock className="h-3.5 w-3.5 text-gray-400" />,
  running:   <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />,
  completed: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  failed:    <XCircle className="h-3.5 w-3.5 text-red-500" />,
  skipped:   <Clock className="h-3.5 w-3.5 text-gray-300" />,
};

function ScoreBar({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-muted-foreground text-xs">—</span>;
  const color = score >= 90 ? "bg-green-500" : score >= 75 ? "bg-yellow-500" : score >= 50 ? "bg-orange-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-medium w-6 text-right">{Math.round(score)}</span>
    </div>
  );
}

function CrawlJobDetail({ jobId }: { jobId: number }) {
  const { data: pages = [], isLoading } = useListCrawlPages(jobId);

  if (isLoading) return <div className="py-4 text-center text-sm text-muted-foreground">Loading pages…</div>;
  if (!pages.length) return <div className="py-4 text-center text-sm text-muted-foreground">No pages discovered yet.</div>;

  return (
    <div className="mt-3 border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="w-8 py-2"></TableHead>
            <TableHead className="py-2">URL</TableHead>
            <TableHead className="py-2 w-16 text-right">Depth</TableHead>
            <TableHead className="py-2 w-24">Perf</TableHead>
            <TableHead className="py-2 w-24">A11y</TableHead>
            <TableHead className="py-2 w-24">SEO</TableHead>
            <TableHead className="py-2 w-20 text-right">Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pages.map(page => (
            <TableRow key={page.id} className="text-xs">
              <TableCell className="py-1.5 pl-3">{PAGE_STATUS_ICON[page.status] ?? null}</TableCell>
              <TableCell className="py-1.5 max-w-xs truncate">
                <a href={page.url} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600 truncate block">
                  {page.url}
                </a>
                {page.pageTitle && <span className="text-muted-foreground block truncate">{page.pageTitle}</span>}
              </TableCell>
              <TableCell className="py-1.5 text-right text-muted-foreground">{page.depth}</TableCell>
              <TableCell className="py-1.5"><ScoreBar score={page.performanceScore} /></TableCell>
              <TableCell className="py-1.5"><ScoreBar score={page.accessibilityScore} /></TableCell>
              <TableCell className="py-1.5"><ScoreBar score={page.seoScore} /></TableCell>
              <TableCell className="py-1.5 text-right font-semibold">
                {page.overallScore != null ? Math.round(page.overallScore) : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CrawlJobRow({ job, onDelete }: { job: CrawlJob; onDelete: (id: number) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border rounded-lg overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors">
            <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{job.startUrl}</p>
              <p className="text-xs text-muted-foreground">{job.projectName ?? `Project #${job.projectId}`}</p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="outline" className={`text-xs ${STATUS_COLORS[job.status] ?? ""}`}>{job.status}</Badge>
              <span className="text-muted-foreground text-xs">{job.pagesAudited}/{job.pagesDiscovered} pages</span>
              {job.overallScore != null && (
                <span className="font-semibold text-sm w-8 text-right">{Math.round(job.overallScore)}</span>
              )}
              <span className="text-xs text-muted-foreground">{format(new Date(job.createdAt), "MMM d, HH:mm")}</span>
              <Button
                variant="ghost" size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                onClick={e => { e.stopPropagation(); onDelete(job.id); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 border-t bg-muted/10">
            {/* Summary row */}
            <div className="flex gap-6 py-3 text-sm">
              <div>
                <span className="text-muted-foreground">Max pages: </span>
                <span className="font-medium">{job.maxPages}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Max depth: </span>
                <span className="font-medium">{job.maxDepth}</span>
              </div>
              {job.avgPerformance != null && (
                <div><span className="text-muted-foreground">Avg perf: </span><span className="font-medium">{Math.round(job.avgPerformance)}</span></div>
              )}
              {job.avgAccessibility != null && (
                <div><span className="text-muted-foreground">Avg a11y: </span><span className="font-medium">{Math.round(job.avgAccessibility)}</span></div>
              )}
              {job.avgSeo != null && (
                <div><span className="text-muted-foreground">Avg SEO: </span><span className="font-medium">{Math.round(job.avgSeo)}</span></div>
              )}
              {job.errorMessage && (
                <div className="text-red-600"><span className="font-medium">Error: </span>{job.errorMessage}</div>
              )}
            </div>
            {(job.status === "completed" || job.status === "running") && (
              <CrawlJobDetail jobId={job.id} />
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default function Crawler() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [filterProjectId, setFilterProjectId] = useState<string>("all");
  const [form, setForm] = useState({
    projectId: "",
    startUrl: "",
    maxPages: "50",
    maxDepth: "3",
    respectRobotsTxt: true,
    discoverSitemap: true,
  });

  const { data: projects = [] } = useListProjects();
  const { data: jobs = [], isLoading } = useListCrawlJobs({
    projectId: filterProjectId !== "all" ? Number(filterProjectId) : undefined,
  });

  const createMutation = useCreateCrawlJob();
  const deleteMutation = useDeleteCrawlJob();

  const resetForm = () => setForm({ projectId: "", startUrl: "", maxPages: "50", maxDepth: "3", respectRobotsTxt: true, discoverSitemap: true });

  const handleCreate = () => {
    if (!form.projectId || !form.startUrl) {
      toast({ title: "Project and start URL are required", variant: "destructive" });
      return;
    }
    createMutation.mutate(
      {
        data: {
          projectId:        Number(form.projectId),
          startUrl:         form.startUrl,
          maxPages:         Number(form.maxPages),
          maxDepth:         Number(form.maxDepth),
          respectRobotsTxt: form.respectRobotsTxt,
          discoverSitemap:  form.discoverSitemap,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCrawlJobsQueryKey() });
          setShowCreate(false);
          resetForm();
          toast({ title: "Crawl job started" });
        },
        onError: () => toast({ title: "Failed to start crawl", variant: "destructive" }),
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCrawlJobsQueryKey() });
          toast({ title: "Crawl job deleted" });
        },
      }
    );
  };

  // Pre-fill URL from selected project
  const handleProjectChange = (pid: string) => {
    const project = projects.find(p => String(p.id) === pid);
    setForm(f => ({ ...f, projectId: pid, startUrl: project?.url ?? f.startUrl }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Website Crawler</h1>
          <p className="text-muted-foreground">
            BFS crawl your entire site — discovers pages via links, robots.txt and sitemap.xml, then audits each page.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Crawl
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex gap-3 items-center">
        <Select value={filterProjectId} onValueChange={setFilterProjectId}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: getListCrawlJobsQueryKey() })}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">{jobs.length} crawl job{jobs.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Job list */}
      {isLoading ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">Loading crawl jobs…</CardContent></Card>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-30" />
            <p className="text-muted-foreground text-sm">No crawl jobs yet.</p>
            <Button className="mt-4" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Start your first crawl
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => (
            <CrawlJobRow key={job.id} job={job} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={open => { setShowCreate(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start New Crawl</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Select value={form.projectId} onValueChange={handleProjectChange}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Start URL</Label>
              <Input
                placeholder="https://example.com"
                value={form.startUrl}
                onChange={e => setForm(f => ({ ...f, startUrl: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Crawler will only follow links on the same origin.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Max pages</Label>
                <Select value={form.maxPages} onValueChange={v => setForm(f => ({ ...f, maxPages: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["10", "25", "50", "100", "200"].map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Max depth</Label>
                <Select value={form.maxDepth} onValueChange={v => setForm(f => ({ ...f, maxDepth: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["1", "2", "3", "5", "10"].map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Respect robots.txt</Label>
                <p className="text-xs text-muted-foreground">Skip disallowed paths</p>
              </div>
              <Switch checked={form.respectRobotsTxt} onCheckedChange={v => setForm(f => ({ ...f, respectRobotsTxt: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Discover sitemap.xml</Label>
                <p className="text-xs text-muted-foreground">Seed queue from sitemap</p>
              </div>
              <Switch checked={form.discoverSitemap} onCheckedChange={v => setForm(f => ({ ...f, discoverSitemap: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Starting…</> : "Start Crawl"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
