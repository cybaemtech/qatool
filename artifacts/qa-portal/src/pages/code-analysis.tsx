import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  Upload, Github, FileCode2, AlertCircle, AlertTriangle, Lightbulb,
  CheckCircle2, Loader2, ChevronDown, ChevronRight, Download, FileJson,
  BarChart3, X, RefreshCw, Code2, Gauge,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CodeIssue {
  file: string;
  line: number;
  column: number;
  rule: string | null;
  severity: "error" | "warning" | "suggestion";
  message: string;
  aiExplanation: string;
  aiFixSuggestion: string;
  codeContext: string;
  contextStartLine: number;
}

interface CodeAnalysisJob {
  id: number;
  name: string;
  sourceType: "zip" | "github";
  sourceUrl: string | null;
  status: "pending" | "running" | "completed" | "failed";
  overallScore: number | null;
  errorCount: number;
  warningCount: number;
  suggestionCount: number;
  filesAnalyzed: number;
  pdfUrl: string | null;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  issues?: CodeIssue[];
}

// ─── API helpers ──────────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem("qa-portal-token") ?? "";
}

const API = "/api";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function useJobs() {
  return useQuery<CodeAnalysisJob[]>({
    queryKey: ["code-analysis-jobs"],
    queryFn: () => apiFetch<CodeAnalysisJob[]>("/code-analysis"),
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasActive = Array.isArray(data) && data.some(j => j.status === "pending" || j.status === "running");
      return hasActive ? 3000 : false;
    },
  });
}

function useJob(id: number | null) {
  return useQuery<CodeAnalysisJob>({
    queryKey: ["code-analysis-job", id],
    queryFn: () => apiFetch<CodeAnalysisJob>(`/code-analysis/${id}`),
    enabled: id !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "running" ? 2000 : false;
    },
  });
}

// ─── Score Gauge ──────────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number | null }) {
  const val = score ?? 0;
  const color = val >= 90 ? "#16a34a" : val >= 75 ? "#d97706" : val >= 50 ? "#ea580c" : "#dc2626";
  const label = val >= 90 ? "Excellent" : val >= 75 ? "Good" : val >= 50 ? "Fair" : "Poor";

  // SVG arc gauge
  const radius = 54;
  const cx = 70;
  const cy = 70;
  const circumference = Math.PI * radius; // half circle
  const offset = circumference - (val / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="140" height="80" viewBox="0 0 140 85">
        {/* Background track */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none" stroke="#e5e7eb" strokeWidth="12" strokeLinecap="round"
        />
        {/* Score arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={`${offset}`}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <text x={cx} y={cy - 4} textAnchor="middle" fill={color} fontSize="22" fontWeight="bold">
          {Math.round(val)}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#6b7280" fontSize="10">
          {label}
        </text>
      </svg>
      <span className="text-xs text-muted-foreground font-medium">Code Quality Score</span>
    </div>
  );
}

// ─── Severity badge ───────────────────────────────────────────────────────────

function SeverityBadge({ sev }: { sev: CodeIssue["severity"] }) {
  return (
    <Badge className={cn(
      "text-[10px] font-bold uppercase tracking-wide shrink-0",
      sev === "error"      && "bg-red-100 text-red-700 border-red-200",
      sev === "warning"    && "bg-yellow-100 text-yellow-700 border-yellow-200",
      sev === "suggestion" && "bg-blue-100 text-blue-700 border-blue-200",
    )} variant="outline">
      {sev === "error" ? "Error" : sev === "warning" ? "Warning" : "Suggestion"}
    </Badge>
  );
}

// ─── Issue row ────────────────────────────────────────────────────────────────

function IssueRow({
  issue,
  selected,
  onClick,
}: {
  issue: CodeIssue;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-border hover:bg-muted/50 transition-colors",
        selected && "bg-primary/5 border-l-2 border-l-primary",
      )}
    >
      <div className="flex items-start gap-2">
        <SeverityBadge sev={issue.severity} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Code2 className="h-3 w-3 shrink-0" />
            <span className="font-mono truncate">{issue.file}:{issue.line}</span>
            {issue.rule && (
              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono shrink-0">
                {issue.rule}
              </span>
            )}
          </div>
          <p className="text-sm text-foreground mt-0.5 line-clamp-2">{issue.message}</p>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
      </div>
    </button>
  );
}

// ─── Code viewer ──────────────────────────────────────────────────────────────

function CodeViewer({ issue }: { issue: CodeIssue }) {
  const ext = issue.file.split(".").pop() ?? "js";
  const langMap: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
    mjs: "javascript", cjs: "javascript",
  };
  const lang = langMap[ext] ?? "javascript";
  const startLine = issue.contextStartLine;

  return (
    <div className="rounded-lg overflow-hidden border border-border text-xs">
      <div className="bg-zinc-900 px-4 py-2 flex items-center gap-2 text-zinc-400 text-[11px] font-mono border-b border-zinc-700">
        <FileCode2 className="h-3.5 w-3.5" />
        <span className="flex-1 truncate">{issue.file}</span>
        <span>Line {issue.line}, Col {issue.column}</span>
      </div>
      <div className="relative">
        <SyntaxHighlighter
          language={lang}
          style={oneDark}
          startingLineNumber={startLine}
          showLineNumbers
          wrapLines
          lineProps={(lineNumber) => ({
            style: lineNumber === issue.line
              ? { background: "rgba(239,68,68,0.15)", display: "block" }
              : { display: "block" },
          })}
          customStyle={{ margin: 0, borderRadius: 0, fontSize: "12px" }}
        >
          {issue.codeContext || "// no context available"}
        </SyntaxHighlighter>
        {/* Error indicator arrow */}
        <div
          className="absolute left-0 flex items-center pointer-events-none"
          style={{ top: `${(issue.line - startLine) * 20 + 2}px` }}
        >
          <div className="w-1 h-5 bg-red-500 rounded-r-sm ml-0" />
        </div>
      </div>
    </div>
  );
}

// ─── Issue detail panel ───────────────────────────────────────────────────────

function IssueDetail({ issue }: { issue: CodeIssue }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        {issue.severity === "error" ? (
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
        ) : issue.severity === "warning" ? (
          <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
        ) : (
          <Lightbulb className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
        )}
        <div>
          <p className="font-medium text-foreground">{issue.message}</p>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
            {issue.file}:{issue.line}:{issue.column}
            {issue.rule && ` · rule: ${issue.rule}`}
          </p>
        </div>
      </div>

      <CodeViewer issue={issue} />

      <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 p-4 space-y-2">
        <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 text-xs font-semibold uppercase tracking-wide">
          <BarChart3 className="h-3.5 w-3.5" />
          AI Explanation
        </div>
        <p className="text-sm text-foreground/80">{issue.aiExplanation}</p>
      </div>

      <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-4 space-y-2">
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-semibold uppercase tracking-wide">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Suggested Fix
        </div>
        <p className="text-sm text-foreground/80">{issue.aiFixSuggestion}</p>
      </div>
    </div>
  );
}

// ─── Issue group ──────────────────────────────────────────────────────────────

function IssueGroup({
  title,
  icon,
  issues,
  selectedIssue,
  onSelect,
  defaultOpen,
}: {
  title: string;
  icon: React.ReactNode;
  issues: CodeIssue[];
  selectedIssue: CodeIssue | null;
  onSelect: (i: CodeIssue) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? issues.length > 0);
  if (issues.length === 0) return null;
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-muted/50 hover:bg-muted text-sm font-semibold border-b border-border transition-colors sticky top-0 z-10"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {icon}
        {title}
        <Badge variant="secondary" className="ml-auto text-[10px]">{issues.length}</Badge>
      </button>
      {open && issues.map((issue, i) => (
        <IssueRow
          key={`${issue.file}-${issue.line}-${i}`}
          issue={issue}
          selected={selectedIssue === issue}
          onClick={() => onSelect(issue)}
        />
      ))}
    </div>
  );
}

// ─── Job status badge ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CodeAnalysisJob["status"] }) {
  return (
    <Badge variant="outline" className={cn(
      "text-[10px] font-semibold uppercase",
      status === "completed" && "bg-green-50 text-green-700 border-green-200",
      status === "running"   && "bg-blue-50 text-blue-700 border-blue-200",
      status === "pending"   && "bg-yellow-50 text-yellow-700 border-yellow-200",
      status === "failed"    && "bg-red-50 text-red-700 border-red-200",
    )}>
      {status === "running" || status === "pending" ? (
        <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" />
      ) : null}
      {status}
    </Badge>
  );
}

// ─── Results view ─────────────────────────────────────────────────────────────

function JobResults({
  job,
  onGeneratePdf,
  pdfGenerating,
}: {
  job: CodeAnalysisJob;
  onGeneratePdf: () => void;
  pdfGenerating: boolean;
}) {
  const [selectedIssue, setSelectedIssue] = useState<CodeIssue | null>(null);
  const issues = job.issues ?? [];
  const errors      = issues.filter(i => i.severity === "error");
  const warnings    = issues.filter(i => i.severity === "warning");
  const suggestions = issues.filter(i => i.severity === "suggestion");

  const handleExportJson = () => {
    const url = `/api/code-analysis/${job.id}/export/json`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `code-analysis-${job.id}.json`;
    // attach bearer token via fetch + blob
    fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.blob())
      .then(blob => {
        a.href = URL.createObjectURL(blob);
        a.click();
      });
  };

  return (
    <div className="space-y-4">
      {/* Score header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <ScoreGauge score={job.overallScore} />
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard value={job.filesAnalyzed} label="Files Analyzed" color="text-foreground" />
              <StatCard value={job.errorCount}      label="Errors"          color="text-red-600"     icon={<AlertCircle className="h-4 w-4" />} />
              <StatCard value={job.warningCount}    label="Warnings"        color="text-yellow-600"  icon={<AlertTriangle className="h-4 w-4" />} />
              <StatCard value={job.suggestionCount} label="Suggestions"     color="text-blue-600"    icon={<Lightbulb className="h-4 w-4" />} />
              <StatCard value={job.errorCount + job.warningCount + job.suggestionCount} label="Total Issues" color="text-foreground" />
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={handleExportJson} className="gap-2">
                <FileJson className="h-4 w-4" /> Export JSON
              </Button>
              {job.pdfUrl ? (
                <Button size="sm" variant="outline" asChild className="gap-2">
                  <a href={job.pdfUrl} download>
                    <Download className="h-4 w-4" /> Download PDF
                  </a>
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={onGeneratePdf} disabled={pdfGenerating} className="gap-2">
                  {pdfGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {pdfGenerating ? "Generating…" : "Export PDF"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Issues split view */}
      {issues.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="font-semibold text-lg">No issues found</p>
            <p className="text-muted-foreground text-sm">All {job.filesAnalyzed} files passed the analysis.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ minHeight: 500 }}>
          {/* Left: issue list */}
          <Card className="overflow-hidden">
            <CardHeader className="py-3 px-4 border-b border-border bg-muted/30">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Issues
                <span className="text-muted-foreground font-normal">— click to inspect</span>
              </CardTitle>
            </CardHeader>
            <div className="overflow-y-auto" style={{ maxHeight: 600 }}>
              <IssueGroup
                title="Errors"
                icon={<AlertCircle className="h-3.5 w-3.5 text-red-500" />}
                issues={errors}
                selectedIssue={selectedIssue}
                onSelect={setSelectedIssue}
                defaultOpen
              />
              <IssueGroup
                title="Warnings"
                icon={<AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />}
                issues={warnings}
                selectedIssue={selectedIssue}
                onSelect={setSelectedIssue}
              />
              <IssueGroup
                title="Suggestions"
                icon={<Lightbulb className="h-3.5 w-3.5 text-blue-500" />}
                issues={suggestions}
                selectedIssue={selectedIssue}
                onSelect={setSelectedIssue}
              />
            </div>
          </Card>

          {/* Right: detail panel */}
          <Card className="overflow-hidden">
            <CardHeader className="py-3 px-4 border-b border-border bg-muted/30">
              <CardTitle className="text-sm flex items-center gap-2">
                <Code2 className="h-4 w-4" />
                {selectedIssue ? "Issue Detail" : "Select an issue"}
              </CardTitle>
            </CardHeader>
            <div className="overflow-y-auto p-4" style={{ maxHeight: 600 }}>
              {selectedIssue ? (
                <IssueDetail issue={selectedIssue} />
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground gap-3">
                  <Code2 className="h-8 w-8 opacity-40" />
                  <p className="text-sm">Click an issue on the left to see the code, AI explanation, and suggested fix.</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function StatCard({ value, label, color, icon }: { value: number; label: string; color: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 flex items-center gap-2">
      {icon && <span className={color}>{icon}</span>}
      <div>
        <p className={cn("text-xl font-bold", color)}>{value}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// ─── Upload / job list section ────────────────────────────────────────────────

export default function CodeAnalysis() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [inputTab, setInputTab] = useState<"zip" | "github">("zip");
  const [githubUrl, setGithubUrl] = useState("");
  const [repoName, setRepoName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: jobs = [], isLoading: jobsLoading } = useJobs();
  const { data: selectedJob, isLoading: jobLoading } = useJob(selectedJobId);

  // Auto-select the first completed job when none is explicitly chosen.
  // By setting selectedJobId, useJob fetches the full detail (including issues).
  useEffect(() => {
    if (selectedJobId === null && !jobsLoading && jobs.length > 0) {
      const first = jobs.find(j => j.status === "completed");
      if (first) setSelectedJobId(first.id);
    }
  }, [jobs, jobsLoading, selectedJobId]);

  const createMutation = useMutation({
    mutationFn: async (payload: FormData | { githubUrl: string; name: string }) => {
      if (payload instanceof FormData) {
        const res = await fetch(`/api/code-analysis`, {
          method: "POST",
          headers: { Authorization: `Bearer ${getToken()}` },
          body: payload,
        });
        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          throw new Error((b as { error?: string }).error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<CodeAnalysisJob>;
      } else {
        return apiFetch<CodeAnalysisJob>("/code-analysis", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
    },
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ["code-analysis-jobs"] });
      setSelectedJobId(job.id);
      toast({ title: "Analysis started", description: `Job "${job.name}" is running.` });
    },
    onError: (err) => {
      toast({ title: "Failed to start analysis", description: err.message, variant: "destructive" });
    },
  });

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.name.endsWith(".zip")) {
      toast({ title: "Invalid file", description: "Please upload a .zip archive of your source code.", variant: "destructive" });
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", file.name);
    createMutation.mutate(fd);
  }, [createMutation, toast]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleGithubSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl.trim()) return;
    createMutation.mutate({ githubUrl: githubUrl.trim(), name: repoName.trim() || githubUrl.trim() });
    setGithubUrl("");
    setRepoName("");
  };

  const handleGeneratePdf = async () => {
    if (!selectedJob) return;
    const jobId = selectedJob.id;
    setPdfGenerating(true);
    try {
      await apiFetch(`/code-analysis/${jobId}/pdf`, { method: "POST" });
      toast({ title: "PDF generation started", description: "Refresh in a moment to download." });
      // Poll until pdfUrl is set on the job record
      const poll = setInterval(async () => {
        const updated = await apiFetch<CodeAnalysisJob>(`/code-analysis/${jobId}`);
        if (updated.pdfUrl) {
          clearInterval(poll);
          setPdfGenerating(false);
          queryClient.invalidateQueries({ queryKey: ["code-analysis-job", jobId] });
          queryClient.invalidateQueries({ queryKey: ["code-analysis-jobs"] });
        }
      }, 2000);
      // Give up after 30 s
      setTimeout(() => { clearInterval(poll); setPdfGenerating(false); }, 30000);
    } catch (err) {
      toast({ title: "PDF generation failed", description: (err as Error).message, variant: "destructive" });
      setPdfGenerating(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <FileCode2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Code Analysis</h1>
          <p className="text-muted-foreground text-sm">Upload a ZIP or provide a GitHub repository for ESLint analysis with AI-powered explanations.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: upload + job list */}
        <div className="xl:col-span-1 space-y-4">
          {/* Upload card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4" /> Analyze Source Code
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={inputTab} onValueChange={(v) => setInputTab(v as "zip" | "github")}>
                <TabsList className="w-full mb-4">
                  <TabsTrigger value="zip" className="flex-1 gap-1.5">
                    <Upload className="h-3.5 w-3.5" /> ZIP Upload
                  </TabsTrigger>
                  <TabsTrigger value="github" className="flex-1 gap-1.5">
                    <Github className="h-3.5 w-3.5" /> GitHub Repo
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="zip">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                      dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30",
                    )}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".zip"
                      className="hidden"
                      onChange={(e) => handleFiles(e.target.files)}
                    />
                    {createMutation.isPending ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                        <p className="text-sm text-muted-foreground">Uploading & starting analysis…</p>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm font-medium">Drop your ZIP here</p>
                        <p className="text-xs text-muted-foreground mt-1">or click to browse · Max 100 MB</p>
                        <p className="text-[10px] text-muted-foreground mt-2">
                          Supports .js · .jsx · .ts · .tsx · .mjs
                        </p>
                      </>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="github">
                  <form onSubmit={handleGithubSubmit} className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">GitHub Repository URL</label>
                      <input
                        type="url"
                        placeholder="https://github.com/owner/repo"
                        value={githubUrl}
                        onChange={e => setGithubUrl(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">Display Name (optional)</label>
                      <input
                        type="text"
                        placeholder="My Project"
                        value={repoName}
                        onChange={e => setRepoName(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <Button type="submit" className="w-full gap-2" disabled={createMutation.isPending}>
                      {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
                      {createMutation.isPending ? "Starting…" : "Analyze Repository"}
                    </Button>
                    <p className="text-[10px] text-muted-foreground text-center">
                      Public repositories only · main / master branch
                    </p>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Job list */}
          <Card>
            <CardHeader className="py-3 px-4 border-b border-border">
              <CardTitle className="text-sm flex items-center gap-2">
                <Gauge className="h-4 w-4" /> Analysis History
                {jobsLoading && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
              </CardTitle>
            </CardHeader>
            <div className="divide-y divide-border max-h-96 overflow-y-auto">
              {jobs.length === 0 && !jobsLoading && (
                <p className="text-xs text-muted-foreground text-center py-6">No analyses yet</p>
              )}
              {jobs.map(job => (
                <button
                  key={job.id}
                  onClick={() => setSelectedJobId(job.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors",
                    selectedJobId === job.id && "bg-primary/5",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{job.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StatusBadge status={job.status} />
                        {job.status === "completed" && (
                          <span className={cn(
                            "text-[10px] font-bold",
                            (job.overallScore ?? 0) >= 90 ? "text-green-600" :
                            (job.overallScore ?? 0) >= 75 ? "text-yellow-600" :
                            (job.overallScore ?? 0) >= 50 ? "text-orange-600" : "text-red-600",
                          )}>
                            {Math.round(job.overallScore ?? 0)}/100
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {job.filesAnalyzed} files
                        </span>
                      </div>
                    </div>
                    {job.sourceType === "github" ? (
                      <Github className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <FileCode2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                  </div>
                  {job.errorMessage && (
                    <p className="text-[10px] text-red-500 mt-1 truncate">{job.errorMessage}</p>
                  )}
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Right: results */}
        <div className="xl:col-span-2">
          {selectedJobId === null ? (
            /* Nothing selected yet (no completed jobs exist, or jobs still loading) */
            <Card className="h-full">
              <CardContent className="flex flex-col items-center justify-center h-80 text-center gap-4 text-muted-foreground">
                <FileCode2 className="h-12 w-12 opacity-30" />
                <div>
                  <p className="font-medium">No analysis selected</p>
                  <p className="text-sm mt-1">Upload a ZIP or provide a GitHub URL to start, then select a job from the history.</p>
                </div>
              </CardContent>
            </Card>
          ) : jobLoading ? (
            /* Fetching the full job detail (includes issues array) */
            <Card className="h-full">
              <CardContent className="flex flex-col items-center justify-center h-80 text-center gap-4">
                <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                <p className="text-sm text-muted-foreground">Loading analysis…</p>
              </CardContent>
            </Card>
          ) : !selectedJob ? (
            /* Should not happen in practice, but guard anyway */
            <Card className="h-full">
              <CardContent className="flex flex-col items-center justify-center h-80 text-center gap-4 text-muted-foreground">
                <FileCode2 className="h-12 w-12 opacity-30" />
                <p className="font-medium">Analysis not found</p>
              </CardContent>
            </Card>
          ) : selectedJob.status === "pending" || selectedJob.status === "running" ? (
            <Card className="h-full">
              <CardContent className="flex flex-col items-center justify-center h-80 text-center gap-4">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <div>
                  <p className="font-semibold text-lg">Analysis in progress</p>
                  <p className="text-muted-foreground text-sm mt-1">Running ESLint on your source files…</p>
                </div>
              </CardContent>
            </Card>
          ) : selectedJob.status === "failed" ? (
            <Card>
              <CardContent className="pt-8 pb-8 flex flex-col items-center gap-3 text-center">
                <X className="h-10 w-10 text-destructive" />
                <p className="font-semibold text-lg">Analysis failed</p>
                <p className="text-muted-foreground text-sm max-w-md">{selectedJob.errorMessage ?? "Unknown error"}</p>
                <Button variant="outline" size="sm" onClick={() => setSelectedJobId(null)} className="gap-2 mt-2">
                  <RefreshCw className="h-4 w-4" /> Try again
                </Button>
              </CardContent>
            </Card>
          ) : (
            /* Completed — selectedJob has the full issues array from the detail endpoint */
            <JobResults
              job={selectedJob}
              onGeneratePdf={handleGeneratePdf}
              pdfGenerating={pdfGenerating}
            />
          )}
        </div>
      </div>
    </div>
  );
}
