import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  Lightbulb, ThumbsUp, Eye, MessageCircle, Plus, Search, Filter,
  Sparkles, TrendingUp, Clock, CheckCircle, XCircle, AlertCircle,
  ChevronUp, ChevronDown, Loader2, Star, ArrowUpRight,
  BarChart3, Users, Zap, Shield,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Suggestion {
  id: number;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  affectedModule?: string;
  businessImpact?: string;
  expectedBenefit?: string;
  votes: number;
  watchers: number;
  anonymous: boolean;
  submittedByName: string;
  assignedToId?: number;
  aiAnalysisScore?: number;
  aiComplexity?: string;
  aiRiskLevel?: string;
  aiEstimatedEffort?: string;
  aiSuggestedSprint?: string;
  aiSuggestedTeam?: string;
  aiSummary?: string;
  aiConfidenceScore?: number;
  createdAt: string;
  updatedAt: string;
  currentUserVoted?: boolean;
  currentUserWatching?: boolean;
  comments?: Comment[];
}

interface Comment {
  id: number;
  content: string;
  role: string;
  parentId?: number;
  authorName: string;
  authorId: number;
  createdAt: string;
}

interface Stats {
  total: number;
  pendingReview: number;
  accepted: number;
  inProgress: number;
  implemented: number;
  rejected: number;
  mostRequested?: { title: string; votes: number };
  averageResponseTimeHours: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "ui_ux", label: "UI / UX" },
  { value: "projects", label: "Projects" },
  { value: "audits", label: "Audits" },
  { value: "bug_tracker", label: "Bug Tracker" },
  { value: "reports", label: "Reports" },
  { value: "ai_copilot", label: "AI Copilot" },
  { value: "security", label: "Security" },
  { value: "performance", label: "Performance" },
  { value: "api_monitoring", label: "API Monitoring" },
  { value: "automation", label: "Automation" },
  { value: "accessibility", label: "Accessibility" },
  { value: "integrations", label: "Integrations" },
  { value: "test_management", label: "Test Management" },
  { value: "release_readiness", label: "Release Readiness" },
  { value: "other", label: "Other" },
];

const STATUSES = [
  { value: "new", label: "New", color: "bg-slate-100 text-slate-700" },
  { value: "under_review", label: "Under Review", color: "bg-blue-100 text-blue-700" },
  { value: "accepted", label: "Accepted", color: "bg-indigo-100 text-indigo-700" },
  { value: "planned", label: "Planned", color: "bg-violet-100 text-violet-700" },
  { value: "in_progress", label: "In Progress", color: "bg-amber-100 text-amber-700" },
  { value: "testing", label: "Testing", color: "bg-orange-100 text-orange-700" },
  { value: "implemented", label: "Implemented", color: "bg-emerald-100 text-emerald-700" },
  { value: "released", label: "Released", color: "bg-green-100 text-green-700" },
  { value: "rejected", label: "Rejected", color: "bg-red-100 text-red-700" },
];

const PRIORITIES = [
  { value: "critical", label: "Critical", color: "text-red-600 border-red-200 bg-red-50" },
  { value: "high", label: "High", color: "text-orange-600 border-orange-200 bg-orange-50" },
  { value: "medium", label: "Medium", color: "text-amber-600 border-amber-200 bg-amber-50" },
  { value: "low", label: "Low", color: "text-slate-600 border-slate-200 bg-slate-50" },
];

function statusBadge(status: string) {
  const s = STATUSES.find(s => s.value === status);
  return s ? (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", s.color)}>
      {s.label}
    </span>
  ) : <span className="text-xs text-muted-foreground">{status}</span>;
}

function priorityBadge(priority: string) {
  const p = PRIORITIES.find(p => p.value === priority);
  return p ? (
    <Badge variant="outline" className={cn("text-xs font-medium", p.color)}>{p.label}</Badge>
  ) : null;
}

function categoryLabel(cat: string) {
  return CATEGORIES.find(c => c.value === cat)?.label ?? cat;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function riskColor(risk?: string) {
  if (risk === "critical") return "text-red-600";
  if (risk === "high") return "text-orange-500";
  if (risk === "medium") return "text-amber-500";
  return "text-emerald-600";
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: typeof Lightbulb; color: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
          </div>
          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", color)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Submit Form ──────────────────────────────────────────────────────────────

function SubmitForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "other",
    priority: "medium",
    affectedModule: "",
    businessImpact: "",
    expectedBenefit: "",
    browser: "",
    environment: "production",
    email: "",
    anonymous: false,
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      customFetch<Suggestion>("/api/feedback", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feedback"] });
      qc.invalidateQueries({ queryKey: ["feedback-stats"] });
      toast({ title: "Suggestion submitted!", description: "Your feedback is now under review." });
      onSuccess();
      setForm({ title: "", description: "", category: "other", priority: "medium", affectedModule: "", businessImpact: "", expectedBenefit: "", browser: "", environment: "production", email: "", anonymous: false });
    },
    onError: () => toast({ title: "Error", description: "Could not submit suggestion.", variant: "destructive" }),
  });

  return (
    <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
      <div className="space-y-2">
        <Label>Title <span className="text-destructive">*</span></Label>
        <Input
          placeholder="Brief summary of your suggestion"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label>Description <span className="text-destructive">*</span></Label>
        <Textarea
          placeholder="Describe the problem this solves, how it should work, and why it matters..."
          className="min-h-[100px] resize-none"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Affected Module</Label>
          <Input placeholder="e.g. Audit Detail page" value={form.affectedModule} onChange={e => setForm(f => ({ ...f, affectedModule: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Environment</Label>
          <Select value={form.environment} onValueChange={v => setForm(f => ({ ...f, environment: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="production">Production</SelectItem>
              <SelectItem value="staging">Staging</SelectItem>
              <SelectItem value="development">Development</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Business Impact</Label>
        <Textarea
          placeholder="How does this impact business operations or user productivity?"
          className="min-h-[60px] resize-none"
          value={form.businessImpact}
          onChange={e => setForm(f => ({ ...f, businessImpact: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label>Expected Benefit</Label>
        <Textarea
          placeholder="What positive outcome do you expect?"
          className="min-h-[60px] resize-none"
          value={form.expectedBenefit}
          onChange={e => setForm(f => ({ ...f, expectedBenefit: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Browser</Label>
          <Input placeholder="e.g. Chrome 126, Firefox 127" value={form.browser} onChange={e => setForm(f => ({ ...f, browser: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Email (optional)</Label>
          <Input placeholder="For update notifications" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={form.anonymous} />
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
        <Switch checked={form.anonymous} onCheckedChange={v => setForm(f => ({ ...f, anonymous: v, email: v ? "" : f.email }))} />
        <div>
          <p className="text-sm font-medium">Submit anonymously</p>
          <p className="text-xs text-muted-foreground">Your name will not be shown to other users</p>
        </div>
      </div>

      <Button
        className="w-full"
        onClick={() => mutation.mutate(form)}
        disabled={mutation.isPending || !form.title.trim() || !form.description.trim()}
      >
        {mutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Lightbulb className="h-4 w-4 mr-2" />}
        Submit Suggestion
      </Button>
    </div>
  );
}

// ─── Suggestion Detail ────────────────────────────────────────────────────────

function SuggestionDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [sortComments] = useState<"asc" | "desc">("asc");

  const { data, isLoading } = useQuery({
    queryKey: ["feedback", id],
    queryFn: () => customFetch<Suggestion>(`/api/feedback/${id}`),
  });

  const voteMutation = useMutation({
    mutationFn: () => customFetch<{ voted: boolean }>(`/api/feedback/${id}/vote`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feedback", id] });
      qc.invalidateQueries({ queryKey: ["feedback"] });
    },
  });

  const watchMutation = useMutation({
    mutationFn: () => customFetch<{ watching: boolean }>(`/api/feedback/${id}/watch`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feedback", id] }),
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) =>
      customFetch<Comment>(`/api/feedback/${id}/comments`, { method: "POST", body: JSON.stringify({ content }) }),
    onSuccess: () => {
      setComment("");
      qc.invalidateQueries({ queryKey: ["feedback", id] });
      toast({ title: "Comment added" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      customFetch<Suggestion>(`/api/feedback/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feedback", id] });
      qc.invalidateQueries({ queryKey: ["feedback"] });
      qc.invalidateQueries({ queryKey: ["feedback-stats"] });
      toast({ title: "Status updated" });
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const s = data;

  return (
    <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {statusBadge(s.status)}
            {priorityBadge(s.priority)}
            <Badge variant="outline" className="text-xs">{categoryLabel(s.category)}</Badge>
          </div>
          <h2 className="text-lg font-bold text-foreground leading-snug">{s.title}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Submitted by <span className="font-medium">{s.submittedByName}</span> · {formatDate(s.createdAt)}
          </p>
        </div>
        <div className="flex flex-col items-center gap-1 bg-muted rounded-lg p-2.5 min-w-[56px]">
          <button
            onClick={() => voteMutation.mutate()}
            className={cn("transition-colors", s.currentUserVoted ? "text-primary" : "text-muted-foreground hover:text-primary")}
          >
            <ThumbsUp className="h-5 w-5" />
          </button>
          <span className="text-sm font-bold tabular-nums">{s.votes}</span>
          <span className="text-[10px] text-muted-foreground">votes</span>
        </div>
      </div>

      {/* Description */}
      <div>
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{s.description}</p>
      </div>

      {/* Metadata grid */}
      {(s.businessImpact || s.expectedBenefit || s.affectedModule) && (
        <div className="grid grid-cols-2 gap-3">
          {s.affectedModule && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Affected Module</p>
              <p className="text-sm font-medium">{s.affectedModule}</p>
            </div>
          )}
          {s.businessImpact && (
            <div className="bg-muted/50 rounded-lg p-3 col-span-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Business Impact</p>
              <p className="text-sm">{s.businessImpact}</p>
            </div>
          )}
          {s.expectedBenefit && (
            <div className="bg-muted/50 rounded-lg p-3 col-span-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Expected Benefit</p>
              <p className="text-sm">{s.expectedBenefit}</p>
            </div>
          )}
        </div>
      )}

      {/* AI Analysis */}
      {s.aiSummary && (
        <div className="border border-primary/20 bg-primary/5 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-primary">AI Analysis</span>
            {s.aiConfidenceScore && (
              <span className="ml-auto text-xs text-muted-foreground">{s.aiConfidenceScore}% confidence</span>
            )}
          </div>
          <p className="text-sm text-foreground leading-relaxed mb-3">{s.aiSummary}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {s.aiComplexity && (
              <div className="text-center bg-background/70 rounded p-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Complexity</p>
                <p className="text-xs font-bold capitalize mt-0.5">{s.aiComplexity}</p>
              </div>
            )}
            {s.aiRiskLevel && (
              <div className="text-center bg-background/70 rounded p-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Risk</p>
                <p className={cn("text-xs font-bold capitalize mt-0.5", riskColor(s.aiRiskLevel))}>{s.aiRiskLevel}</p>
              </div>
            )}
            {s.aiEstimatedEffort && (
              <div className="text-center bg-background/70 rounded p-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Effort</p>
                <p className="text-xs font-bold mt-0.5">{s.aiEstimatedEffort}</p>
              </div>
            )}
            {s.aiSuggestedTeam && (
              <div className="text-center bg-background/70 rounded p-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Team</p>
                <p className="text-xs font-bold mt-0.5">{s.aiSuggestedTeam}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={s.currentUserVoted ? "default" : "outline"}
          onClick={() => voteMutation.mutate()}
          className="h-8"
          disabled={voteMutation.isPending}
        >
          <ThumbsUp className="h-3.5 w-3.5 mr-1.5" />
          {s.currentUserVoted ? "Voted" : "Upvote"} ({s.votes})
        </Button>
        <Button
          size="sm"
          variant={s.currentUserWatching ? "default" : "outline"}
          onClick={() => watchMutation.mutate()}
          className="h-8"
          disabled={watchMutation.isPending}
        >
          <Eye className="h-3.5 w-3.5 mr-1.5" />
          {s.currentUserWatching ? "Watching" : "Watch"} ({s.watchers})
        </Button>

        {user?.role === "admin" && (
          <Select value={s.status} onValueChange={v => statusMutation.mutate(v)}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="Change status" />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map(st => (
                <SelectItem key={st.value} value={st.value} className="text-xs">{st.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Separator />

      {/* Comments */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          Discussion ({s.comments?.length ?? 0})
        </h3>
        <div className="space-y-3 mb-4">
          {(s.comments ?? []).map(c => (
            <div key={c.id} className={cn(
              "p-3 rounded-lg border",
              c.role === "developer" ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border",
            )}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-semibold text-foreground">{c.authorName}</span>
                {c.role === "developer" && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary bg-primary/5">Dev</Badge>
                )}
                {c.role === "product_owner" && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-violet-300 text-violet-700 bg-violet-50">PM</Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">{formatDate(c.createdAt)}</span>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{c.content}</p>
            </div>
          ))}
          {(s.comments ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground italic">No comments yet. Be the first to respond.</p>
          )}
        </div>

        <div className="flex gap-2">
          <Textarea
            placeholder="Add a comment or reply..."
            className="min-h-[72px] resize-none text-sm"
            value={comment}
            onChange={e => setComment(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          className="mt-2"
          onClick={() => comment.trim() && commentMutation.mutate(comment)}
          disabled={commentMutation.isPending || !comment.trim()}
        >
          {commentMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5 mr-1.5" />}
          Comment
        </Button>
      </div>
    </div>
  );
}

// ─── Suggestion Row ───────────────────────────────────────────────────────────

function SuggestionRow({ s, onClick }: { s: Suggestion; onClick: () => void }) {
  return (
    <tr
      className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <td className="px-4 py-3 text-sm font-mono text-muted-foreground">#{s.id}</td>
      <td className="px-4 py-3 max-w-[260px]">
        <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{s.description}</p>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{categoryLabel(s.category)}</td>
      <td className="px-4 py-3">{priorityBadge(s.priority)}</td>
      <td className="px-4 py-3">{statusBadge(s.status)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
          <ThumbsUp className="h-3.5 w-3.5" />
          {s.votes}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{s.submittedByName}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(s.createdAt)}</td>
      <td className="px-4 py-3">
        {s.aiAnalysisScore != null && (
          <div className="flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5 text-primary/60" />
            <span className="text-xs font-semibold">{s.aiAnalysisScore}</span>
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); onClick(); }}>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FeedbackPage() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [sortBy, setSortBy] = useState<"votes" | "date">("votes");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const pageSize = 10;

  const { data: stats } = useQuery({
    queryKey: ["feedback-stats"],
    queryFn: () => customFetch<Stats>("/api/feedback/stats"),
  });

  const queryParams = new URLSearchParams({
    limit: String(pageSize),
    offset: String(page * pageSize),
    ...(filterStatus !== "all" && { status: filterStatus }),
    ...(filterCategory !== "all" && { category: filterCategory }),
    ...(filterPriority !== "all" && { priority: filterPriority }),
    ...(search && { search }),
  });

  const { data: listData, isLoading } = useQuery({
    queryKey: ["feedback", filterStatus, filterCategory, filterPriority, search, page, sortBy, sortDir],
    queryFn: () => customFetch<{ suggestions: Suggestion[]; total: number }>(`/api/feedback?${queryParams}`),
  });

  const suggestions = useMemo(() => {
    const list = listData?.suggestions ?? [];
    return [...list].sort((a, b) => {
      const v = sortBy === "votes"
        ? b.votes - a.votes
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sortDir === "desc" ? v : -v;
    });
  }, [listData, sortBy, sortDir]);

  const totalPages = Math.ceil((listData?.total ?? 0) / pageSize);

  function toggleSort(col: "votes" | "date") {
    if (sortBy === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortBy(col); setSortDir("desc"); }
  }

  const SortIcon = ({ col }: { col: "votes" | "date" }) =>
    sortBy === col
      ? sortDir === "desc" ? <ChevronDown className="h-3 w-3 inline ml-0.5" /> : <ChevronUp className="h-3 w-3 inline ml-0.5" />
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-primary" />
            Feedback &amp; Ideas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Submit suggestions, upvote ideas, and track feature requests</p>
        </div>
        <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Suggestion
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-primary" />
                Submit a Suggestion
              </DialogTitle>
            </DialogHeader>
            <SubmitForm onSuccess={() => setSubmitOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="col-span-2 sm:col-span-2">
          <KpiCard label="Total Suggestions" value={stats?.total ?? 0} icon={Lightbulb} color="bg-primary/10 text-primary" />
        </div>
        <div className="col-span-2 sm:col-span-2">
          <KpiCard label="Pending Review" value={stats?.pendingReview ?? 0} icon={Clock} color="bg-amber-100 text-amber-600" />
        </div>
        <div className="col-span-2 sm:col-span-2">
          <KpiCard label="Accepted" value={stats?.accepted ?? 0} icon={CheckCircle} color="bg-indigo-100 text-indigo-600" />
        </div>
        <div className="col-span-2 sm:col-span-2">
          <KpiCard label="In Progress" value={stats?.inProgress ?? 0} icon={Zap} color="bg-violet-100 text-violet-600" />
        </div>
        <div className="col-span-2 sm:col-span-2">
          <KpiCard label="Implemented" value={stats?.implemented ?? 0} icon={CheckCircle} color="bg-emerald-100 text-emerald-600" />
        </div>
        <div className="col-span-2 sm:col-span-2">
          <KpiCard label="Rejected" value={stats?.rejected ?? 0} icon={XCircle} color="bg-red-100 text-red-500" />
        </div>
        <div className="col-span-2 sm:col-span-2">
          <KpiCard
            label="Most Requested"
            value={stats?.mostRequested ? `${stats.mostRequested.votes} votes` : "—"}
            icon={TrendingUp}
            color="bg-orange-100 text-orange-600"
          />
        </div>
        <div className="col-span-2 sm:col-span-2">
          <KpiCard label="Avg Response Time" value={stats ? `${stats.averageResponseTimeHours}h` : "—"} icon={AlertCircle} color="bg-sky-100 text-sky-600" />
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 h-9"
                placeholder="Search suggestions..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
              />
            </div>
            <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(0); }}>
              <SelectTrigger className="w-[150px] h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={v => { setFilterCategory(v); setPage(0); }}>
              <SelectTrigger className="w-[150px] h-9 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={v => { setFilterPriority(v); setPage(0); }}>
              <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto">
              {listData?.total ?? 0} result{(listData?.total ?? 0) !== 1 ? "s" : ""}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer select-none" onClick={() => toggleSort("votes")}>
                  Votes <SortIcon col="votes" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Submitted By</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer select-none" onClick={() => toggleSort("date")}>
                  Date <SortIcon col="date" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">AI Score</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Loading suggestions...
                </td></tr>
              ) : suggestions.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                  <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="font-medium">No suggestions found</p>
                  <p className="text-xs mt-1">Be the first to submit an idea!</p>
                </td></tr>
              ) : (
                suggestions.map(s => (
                  <SuggestionRow key={s.id} s={s} onClick={() => setSelectedId(s.id)} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                Previous
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Detail Dialog */}
      <Dialog open={selectedId !== null} onOpenChange={open => !open && setSelectedId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 text-primary" />
              Suggestion Detail
            </DialogTitle>
          </DialogHeader>
          {selectedId && <SuggestionDetail id={selectedId} onClose={() => setSelectedId(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
