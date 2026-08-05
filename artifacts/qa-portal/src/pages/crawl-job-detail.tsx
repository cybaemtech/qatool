import { useState, useEffect, type JSX } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetCrawlJob,
  useListCrawlPages,
  useListCrawlJobScreenshots,
  useGetCrawlJobProgress,
  getGetCrawlJobQueryKey,
  getListCrawlPagesQueryKey,
  getGetCrawlJobProgressQueryKey,
  type CrawlPage,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Globe, Monitor, Tablet, Smartphone, CheckCircle2,
  XCircle, Clock, Loader2, ChevronLeft, ChevronRight, Maximize2,
  FileJson, ExternalLink,
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-gray-100 text-gray-700 border-gray-200",
  running:   "bg-blue-100 text-blue-700 border-blue-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  failed:    "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-yellow-100 text-yellow-700 border-yellow-200",
  skipped:   "bg-gray-100 text-gray-500 border-gray-200",
};

const PAGE_STATUS_ICON: Record<string, JSX.Element> = {
  pending:   <Clock className="h-3.5 w-3.5 text-gray-400" />,
  running:   <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />,
  completed: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  failed:    <XCircle className="h-3.5 w-3.5 text-red-500" />,
  skipped:   <Clock className="h-3.5 w-3.5 text-gray-300" />,
};

// ─── Score pill ───────────────────────────────────────────────────────────────

function ScorePill({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-muted-foreground text-xs">—</span>;
  const val = Math.round(score);
  const cls =
    val >= 90 ? "bg-green-100 text-green-800" :
    val >= 75 ? "bg-yellow-100 text-yellow-800" :
    val >= 50 ? "bg-orange-100 text-orange-800" :
               "bg-red-100 text-red-800";
  return <span className={cn("inline-block px-1.5 py-0.5 rounded text-xs font-semibold", cls)}>{val}</span>;
}

// ─── Screenshot Gallery ────────────────────────────────────────────────────────

function ScreenshotGallery({ crawlJobId }: { crawlJobId: number }) {
  const [filterPageId, setFilterPageId] = useState<string>("all");
  const [filterDevice, setFilterDevice] = useState<string>("all");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const { data: pages = [] } = useListCrawlPages(crawlJobId);
  const { data: rawShots = [] } = useListCrawlJobScreenshots(crawlJobId, {
    pageId:     filterPageId !== "all" ? Number(filterPageId) : undefined,
    deviceType: filterDevice !== "all" ? (filterDevice as "desktop" | "tablet" | "mobile") : undefined,
  });

  // Reset index when filter changes
  useEffect(() => { setCurrentIdx(0); }, [filterPageId, filterDevice, rawShots.length]);

  const current = rawShots[currentIdx] ?? null;
  const deviceIcon = (d: string) => d === "desktop" ? <Monitor className="h-4 w-4" /> : d === "tablet" ? <Tablet className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />;

  // Build page label map: crawlPageId → url label
  const pageLabels = new Map(pages.map(p => [p.id, new URL(p.url).pathname || "/"]));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterPageId} onValueChange={setFilterPageId}>
          <SelectTrigger className="w-[260px] h-8 text-xs">
            <SelectValue placeholder="All pages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All pages</SelectItem>
            {pages.filter(p => p.auditRunId != null).map(p => (
              <SelectItem key={p.id} value={String(p.id)}>
                {new URL(p.url).pathname || "/"} {p.pageTitle ? `— ${p.pageTitle.slice(0, 30)}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterDevice} onValueChange={setFilterDevice}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="All devices" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All devices</SelectItem>
            <SelectItem value="desktop">Desktop</SelectItem>
            <SelectItem value="tablet">Tablet</SelectItem>
            <SelectItem value="mobile">Mobile</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground self-center">{rawShots.length} screenshot{rawShots.length !== 1 ? "s" : ""}</span>
      </div>

      {rawShots.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground bg-muted/30 rounded-xl border border-dashed">
          No screenshots match the current filter.
        </div>
      ) : (
        <>
          {/* Main preview */}
          <div
            className="rounded-xl border overflow-hidden cursor-zoom-in hover:shadow-md transition-shadow"
            onClick={() => setFullscreen(true)}
          >
            <div className="bg-muted/50 px-3 py-2 border-b flex items-center gap-2 text-xs font-medium text-muted-foreground">
              {current && deviceIcon(current.deviceType)}
              <span className="capitalize">{current?.deviceType}</span>
              {current?.crawlPageId && <span className="text-muted-foreground/60">· {pageLabels.get(current.crawlPageId) ?? "page"}</span>}
              <span className="ml-auto text-muted-foreground/60">{currentIdx + 1}/{rawShots.length}</span>
              <Maximize2 className="h-3.5 w-3.5 ml-1" />
            </div>
            <div className="bg-white p-3">
              <div className={cn("w-full rounded-lg overflow-hidden bg-slate-100",
                current?.deviceType === "mobile" ? "aspect-[9/16] max-w-[180px] mx-auto" :
                current?.deviceType === "tablet" ? "aspect-[4/3]" : "aspect-[16/9]")}>
                {current?.dataUrl
                  ? <img src={current.dataUrl} alt="screenshot" className="w-full h-full object-cover" />
                  : <div className="flex items-center justify-center h-full text-xs text-muted-foreground">No image</div>}
              </div>
            </div>
          </div>

          {/* Prev/Next controls */}
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} disabled={currentIdx === 0}>
              <ChevronLeft className="h-4 w-4 mr-1" />Prev
            </Button>
            <span className="text-xs text-muted-foreground w-20 text-center">{currentIdx + 1} of {rawShots.length}</span>
            <Button variant="outline" size="sm" onClick={() => setCurrentIdx(i => Math.min(rawShots.length - 1, i + 1))} disabled={currentIdx >= rawShots.length - 1}>
              Next<ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {/* Thumbnail strip — real images */}
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {rawShots.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setCurrentIdx(idx)}
                className={cn("rounded-lg border-2 overflow-hidden transition-all duration-150 focus:outline-none",
                  idx === currentIdx ? "border-primary shadow-sm" : "border-border hover:border-muted-foreground")}
              >
                <div className={cn("w-full bg-slate-100 overflow-hidden",
                  s.deviceType === "mobile" ? "aspect-[9/16]" : s.deviceType === "tablet" ? "aspect-[4/3]" : "aspect-video")}>
                  {s.dataUrl
                    ? <img src={s.dataUrl} alt={`${s.deviceType} screenshot ${idx + 1}`} className="w-full h-full object-cover" />
                    : <div className="flex items-center justify-center h-full">{deviceIcon(s.deviceType)}</div>}
                </div>
                <div className="py-0.5 px-1 text-center">
                  <span className="text-[9px] text-muted-foreground capitalize">{s.deviceType}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Fullscreen dialog */}
      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-5xl w-full p-0">
          <DialogHeader className="px-4 py-3 border-b">
            <DialogTitle className="text-sm flex items-center gap-2">
              {current && deviceIcon(current.deviceType)}
              <span className="capitalize">{current?.deviceType}</span>
              {current?.crawlPageId && <span className="text-muted-foreground">· {pageLabels.get(current.crawlPageId) ?? "page"}</span>}
              <span className="ml-auto text-muted-foreground font-normal">{currentIdx + 1}/{rawShots.length}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-4 bg-slate-50 min-h-[60vh]">
            {current?.dataUrl
              ? <img src={current.dataUrl} alt="fullscreen screenshot" className="max-w-full max-h-[70vh] object-contain rounded shadow-lg" />
              : <p className="text-muted-foreground text-sm">No image data</p>}
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <Button variant="outline" size="sm" onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} disabled={currentIdx === 0}>
              <ChevronLeft className="h-4 w-4 mr-1" />Prev
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentIdx(i => Math.min(rawShots.length - 1, i + 1))} disabled={currentIdx >= rawShots.length - 1}>
              Next<ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Pages table ──────────────────────────────────────────────────────────────

function PagesTable({ pages }: { pages: CrawlPage[] }) {
  if (!pages.length) return (
    <div className="py-10 text-center text-sm text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
      No pages discovered yet.
    </div>
  );
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="py-2 w-8" />
            <TableHead className="py-2">URL / Title</TableHead>
            <TableHead className="py-2 w-12 text-center">Depth</TableHead>
            <TableHead className="py-2 w-20 text-center">Overall</TableHead>
            <TableHead className="py-2 w-20 text-center">Perf</TableHead>
            <TableHead className="py-2 w-20 text-center">A11y</TableHead>
            <TableHead className="py-2 w-20 text-center">SEO</TableHead>
            <TableHead className="py-2 w-20 text-center">BP</TableHead>
            <TableHead className="py-2 w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {pages.map(page => (
            <TableRow key={page.id} className="text-xs hover:bg-muted/20">
              <TableCell className="py-2 pl-3">{PAGE_STATUS_ICON[page.status] ?? null}</TableCell>
              <TableCell className="py-2 max-w-xs">
                <a
                  href={page.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline block truncate"
                >
                  {page.url}
                </a>
                {page.pageTitle && <span className="text-muted-foreground block truncate">{page.pageTitle}</span>}
              </TableCell>
              <TableCell className="py-2 text-center text-muted-foreground">{page.depth}</TableCell>
              <TableCell className="py-2 text-center"><ScorePill score={page.overallScore} /></TableCell>
              <TableCell className="py-2 text-center"><ScorePill score={page.performanceScore} /></TableCell>
              <TableCell className="py-2 text-center"><ScorePill score={page.accessibilityScore} /></TableCell>
              <TableCell className="py-2 text-center"><ScorePill score={page.seoScore} /></TableCell>
              <TableCell className="py-2 text-center"><ScorePill score={page.bestPracticesScore} /></TableCell>
              <TableCell className="py-2 pr-3">
                {page.auditRunId && (
                  <Link href={`/audits/${page.auditRunId}`}>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-primary cursor-pointer" />
                  </Link>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Progress bar (live polling) ──────────────────────────────────────────────

function LiveProgress({ crawlJobId }: { crawlJobId: number }) {
  const queryClient = useQueryClient();

  const { data: progress } = useGetCrawlJobProgress(crawlJobId, {
    query: {
      refetchInterval: (q) => {
        const s = q.state.data?.status;
        return s === "running" || s === "pending" ? 2000 : false;
      },
      queryKey: getGetCrawlJobProgressQueryKey(crawlJobId),
    },
  });

  useEffect(() => {
    if (progress?.status === "completed" || progress?.status === "failed") {
      queryClient.invalidateQueries({ queryKey: getGetCrawlJobQueryKey(crawlJobId) });
      queryClient.invalidateQueries({ queryKey: getListCrawlPagesQueryKey(crawlJobId) });
    }
  }, [progress?.status, crawlJobId, queryClient]);

  if (!progress || (progress.status !== "running" && progress.status !== "pending")) return null;

  return (
    <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm text-blue-700 font-medium">
        <Loader2 className="h-4 w-4 animate-spin" />
        Crawl in progress — {progress.pagesAudited} of {progress.pagesDiscovered} pages audited
        {progress.pagesFailed > 0 && <span className="text-orange-600">· {progress.pagesFailed} failed</span>}
      </div>
      <Progress value={progress.percentComplete} className="h-1.5" />
      <p className="text-xs text-blue-600/70">Up to {progress.maxPages} pages maximum</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CrawlJobDetail() {
  const { id } = useParams<{ id: string }>();
  const crawlJobId = Number(id);
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"pages" | "screenshots">("pages");
  const { toast } = useToast();

  const { data: job, isLoading } = useGetCrawlJob(crawlJobId, {
    query: { queryKey: getGetCrawlJobQueryKey(crawlJobId) },
  });
  const { data: pages = [] } = useListCrawlPages(crawlJobId);

  const handleExportJson = () => {
    try {
      const blob = new Blob([JSON.stringify({ job, pages }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `crawl-job-${crawlJobId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Exported", description: `crawl-job-${crawlJobId}.json downloaded.` });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />Loading crawl job…
      </div>
    );
  }
  if (!job) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        Crawl job not found.{" "}
        <button className="underline" onClick={() => setLocation("/crawler")}>Back to crawler</button>
      </div>
    );
  }

  const completedPages = pages.filter(p => p.status === "completed");
  const failedPages    = pages.filter(p => p.status === "failed");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/crawler">
          <Button variant="ghost" size="icon" className="mt-0.5"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold truncate">{job.startUrl}</h1>
            <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[job.status])}>
              {job.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {job.projectName ?? `Project #${job.projectId}`} · Started {format(new Date(job.createdAt), "MMM d, yyyy HH:mm")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportJson} className="flex-shrink-0">
          <FileJson className="h-4 w-4 mr-2" />Export JSON
        </Button>
      </div>

      {/* Live progress */}
      <LiveProgress crawlJobId={crawlJobId} />

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: "Pages found", value: job.pagesDiscovered },
          { label: "Audited",     value: job.pagesAudited },
          { label: "Failed",      value: job.pagesFailed,    cls: job.pagesFailed > 0 ? "text-red-600" : "" },
          { label: "Overall",     value: job.overallScore    != null ? Math.round(job.overallScore)    : "—" },
          { label: "Avg perf",    value: job.avgPerformance  != null ? Math.round(job.avgPerformance)  : "—" },
          { label: "Avg a11y",    value: job.avgAccessibility != null ? Math.round(job.avgAccessibility) : "—" },
        ].map(({ label, value, cls }) => (
          <Card key={label} className="py-0">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={cn("text-2xl font-bold mt-0.5", cls)}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {(["pages", "screenshots"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize",
              activeTab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {t}
            {t === "pages" && <span className="ml-1.5 text-xs text-muted-foreground">({pages.length})</span>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "pages" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" /> Discovered Pages
            </CardTitle>
            <CardDescription>
              {completedPages.length} audited · {failedPages.length} failed
              {pages.length > 0 && ` · Click ${<ExternalLink className="inline h-3 w-3" />} to open full audit detail`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PagesTable pages={pages} />
          </CardContent>
        </Card>
      )}

      {activeTab === "screenshots" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Monitor className="h-4 w-4 text-primary" /> Screenshot Gallery
            </CardTitle>
            <CardDescription>Filter by page or device type — real thumbnails, prev/next navigation, fullscreen preview</CardDescription>
          </CardHeader>
          <CardContent>
            <ScreenshotGallery crawlJobId={crawlJobId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
