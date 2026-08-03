import { useState } from "react";
import {
  useListScheduledAudits,
  useCreateScheduledAudit,
  useUpdateScheduledAudit,
  useDeleteScheduledAudit,
  useRunScheduledAuditNow,
  useGetScheduledAuditHistory,
  useListProjects,
  getListScheduledAuditsQueryKey,
  getGetScheduledAuditHistoryQueryKey,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CalendarClock,
  Plus,
  MoreHorizontal,
  Trash2,
  Play,
  Pause,
  History,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const FREQ_LABELS: Record<string, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
const STATUS_COLORS: Record<string, string> = {
  active:   "bg-green-100 text-green-800 border-green-200",
  paused:   "bg-yellow-100 text-yellow-800 border-yellow-200",
  disabled: "bg-gray-100 text-gray-600 border-gray-200",
};
const AUDIT_STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-100 text-green-700 border-green-200",
  running:   "bg-blue-100 text-blue-700 border-blue-200",
  pending:   "bg-gray-100 text-gray-600 border-gray-200",
  failed:    "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-yellow-100 text-yellow-700 border-yellow-200",
};

function AuditStatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
  if (status === "failed")    return <XCircle      className="h-3.5 w-3.5 text-red-500" />;
  if (status === "running")   return <Loader2      className="h-3.5 w-3.5 text-blue-500 animate-spin" />;
  return <Clock className="h-3.5 w-3.5 text-gray-400" />;
}

function HistoryDialog({ scheduleId, open, onClose }: { scheduleId: number | null; open: boolean; onClose: () => void }) {
  const { data: runs = [], isLoading } = useGetScheduledAuditHistory(scheduleId ?? 0, { query: { queryKey: getGetScheduledAuditHistoryQueryKey(scheduleId ?? 0), enabled: open && scheduleId != null } });

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Audit Run History
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading history…</div>
        ) : runs.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No audit runs yet for this project.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Perf</TableHead>
                <TableHead>A11y</TableHead>
                <TableHead>SEO</TableHead>
                <TableHead>Bugs</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map(run => (
                <TableRow key={run.id}>
                  <TableCell><AuditStatusIcon status={run.status} /></TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${AUDIT_STATUS_COLORS[run.status] ?? ""}`}>
                      {run.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold">{run.overallScore != null ? Math.round(run.overallScore) : "—"}</TableCell>
                  <TableCell className="text-sm">{run.performanceScore  != null ? Math.round(run.performanceScore)  : "—"}</TableCell>
                  <TableCell className="text-sm">{run.accessibilityScore != null ? Math.round(run.accessibilityScore) : "—"}</TableCell>
                  <TableCell className="text-sm">{run.seoScore           != null ? Math.round(run.seoScore)           : "—"}</TableCell>
                  <TableCell className="text-sm">{run.bugsFound}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {run.createdAt ? format(new Date(run.createdAt), "MMM d, yyyy HH:mm") : "—"}
                  </TableCell>
                  <TableCell>
                    <Link href={`/audits/${run.id}`}>
                      <Button variant="ghost" size="sm" className="h-7 text-xs px-2">View</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Schedules() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [historyScheduleId, setHistoryScheduleId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", projectId: "", frequency: "weekly", hour: "9", status: "active" });
  const [runningIds, setRunningIds] = useState<Set<number>>(new Set());

  const { data: schedules = [], isLoading } = useListScheduledAudits();
  const { data: projects = [] } = useListProjects();
  const createMutation = useCreateScheduledAudit();
  const updateMutation = useUpdateScheduledAudit();
  const deleteMutation = useDeleteScheduledAudit();
  const runNowMutation = useRunScheduledAuditNow();

  const resetForm = () => setForm({ name: "", projectId: "", frequency: "weekly", hour: "9", status: "active" });

  const handleCreate = () => {
    if (!form.name || !form.projectId) {
      toast({ title: "Name and project are required", variant: "destructive" });
      return;
    }
    createMutation.mutate(
      {
        data: {
          name:      form.name,
          projectId: Number(form.projectId),
          frequency: form.frequency as "daily" | "weekly" | "monthly",
          hour:      Number(form.hour),
          status:    form.status as "active" | "paused" | "disabled",
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListScheduledAuditsQueryKey() });
          setShowCreate(false);
          resetForm();
          toast({ title: "Schedule created" });
        },
      }
    );
  };

  const handleStatusToggle = (id: number, current: string) => {
    const next = current === "active" ? "paused" : "active";
    updateMutation.mutate(
      { id, data: { status: next as "active" | "paused" | "disabled" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListScheduledAuditsQueryKey() });
          toast({ title: `Schedule ${next}` });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListScheduledAuditsQueryKey() });
          toast({ title: "Schedule deleted" });
        },
      }
    );
  };

  const handleRunNow = (id: number) => {
    setRunningIds(s => new Set(s).add(id));
    runNowMutation.mutate(
      { id },
      {
        onSuccess: data => {
          toast({ title: "Audit started", description: `Audit run #${data.auditRunId} created` });
          queryClient.invalidateQueries({ queryKey: getListScheduledAuditsQueryKey() });
        },
        onError: () => toast({ title: "Failed to start audit", variant: "destructive" }),
        onSettled: () => setRunningIds(s => { const n = new Set(s); n.delete(id); return n; }),
      }
    );
  };

  const hourLabel = (h: number) => {
    const ampm   = h < 12 ? "AM" : "PM";
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${display}:00 ${ampm} UTC`;
  };

  const active  = schedules.filter(s => s.status === "active");
  const paused  = schedules.filter(s => s.status === "paused");
  const disabled = schedules.filter(s => s.status === "disabled");

  const ScheduleTable = ({ rows }: { rows: typeof schedules }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Project</TableHead>
          <TableHead>Frequency</TableHead>
          <TableHead>Time (UTC)</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Next Run</TableHead>
          <TableHead>Last Run</TableHead>
          <TableHead>Runs</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(s => (
          <TableRow key={s.id}>
            <TableCell className="font-medium">{s.name}</TableCell>
            <TableCell className="text-muted-foreground">{s.projectName ?? `Project #${s.projectId}`}</TableCell>
            <TableCell>{FREQ_LABELS[s.frequency]}</TableCell>
            <TableCell className="text-sm">{hourLabel(s.hour)}</TableCell>
            <TableCell>
              <Badge variant="outline" className={STATUS_COLORS[s.status]}>
                {s.status}
              </Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {s.nextRunAt ? format(new Date(s.nextRunAt), "MMM d, yyyy h:mm a") : "—"}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {s.lastRunAt ? format(new Date(s.lastRunAt), "MMM d") : "Never"}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {(s as unknown as Record<string, unknown>).runCount != null ? String((s as unknown as Record<string, unknown>).runCount) : "—"}
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => handleRunNow(s.id)}
                    disabled={runningIds.has(s.id)}
                  >
                    {runningIds.has(s.id)
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running…</>
                      : <><Zap className="h-4 w-4 mr-2" />Run Now</>
                    }
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setHistoryScheduleId(s.id)}>
                    <History className="h-4 w-4 mr-2" />View History
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleStatusToggle(s.id, s.status)}>
                    {s.status === "active"
                      ? <><Pause className="h-4 w-4 mr-2" />Pause</>
                      : <><Play  className="h-4 w-4 mr-2" />Activate</>
                    }
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(s.id)}>
                    <Trash2 className="h-4 w-4 mr-2" />Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarClock className="h-6 w-6 text-primary" />
            Scheduled Audits
          </h1>
          <p className="text-muted-foreground mt-1">Automate audit runs on a recurring schedule</p>
        </div>
        <Button onClick={() => { resetForm(); setShowCreate(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Schedule
        </Button>
      </div>

      {/* Summary stats */}
      {schedules.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Active</p>
              <p className="text-2xl font-bold text-green-600">{active.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Paused</p>
              <p className="text-2xl font-bold text-yellow-600">{paused.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Disabled</p>
              <p className="text-2xl font-bold text-gray-500">{disabled.length}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab view */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading schedules…</div>
          ) : schedules.length === 0 ? (
            <div className="p-12 text-center">
              <CalendarClock className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground font-medium">No schedules yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create a schedule to run audits automatically</p>
              <Button className="mt-4" onClick={() => { resetForm(); setShowCreate(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Create First Schedule
              </Button>
            </div>
          ) : (
            <Tabs defaultValue="all" className="w-full">
              <div className="px-4 pt-3 border-b">
                <TabsList className="h-9">
                  <TabsTrigger value="all" className="text-xs">All ({schedules.length})</TabsTrigger>
                  <TabsTrigger value="active" className="text-xs">Active ({active.length})</TabsTrigger>
                  <TabsTrigger value="paused" className="text-xs">Paused ({paused.length})</TabsTrigger>
                  <TabsTrigger value="disabled" className="text-xs">Disabled ({disabled.length})</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="all"      className="mt-0"><ScheduleTable rows={schedules} /></TabsContent>
              <TabsContent value="active"   className="mt-0"><ScheduleTable rows={active} /></TabsContent>
              <TabsContent value="paused"   className="mt-0"><ScheduleTable rows={paused} /></TabsContent>
              <TabsContent value="disabled" className="mt-0"><ScheduleTable rows={disabled} /></TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* History dialog */}
      <HistoryDialog
        scheduleId={historyScheduleId}
        open={historyScheduleId != null}
        onClose={() => setHistoryScheduleId(null)}
      />

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Scheduled Audit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Schedule Name</Label>
              <Input
                placeholder="e.g. Weekly Marketing Site"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Select value={form.projectId} onValueChange={v => setForm(f => ({ ...f, projectId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Frequency</Label>
                <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Time (UTC hour)</Label>
                <Select value={form.hour} onValueChange={v => setForm(f => ({ ...f, hour: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>{hourLabel(i)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
