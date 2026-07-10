import { useState } from "react";
import {
  useListScheduledAudits,
  useCreateScheduledAudit,
  useUpdateScheduledAudit,
  useDeleteScheduledAudit,
  useListProjects,
  getListScheduledAuditsQueryKey,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CalendarClock, Plus, MoreHorizontal, Pencil, Trash2, Play, Pause } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const FREQ_LABELS: Record<string, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 border-green-200",
  paused: "bg-yellow-100 text-yellow-800 border-yellow-200",
  disabled: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function Schedules() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", projectId: "", frequency: "weekly", hour: "9", status: "active" });

  const { data: schedules = [], isLoading } = useListScheduledAudits();
  const { data: projects = [] } = useListProjects();
  const createMutation = useCreateScheduledAudit();
  const updateMutation = useUpdateScheduledAudit();
  const deleteMutation = useDeleteScheduledAudit();

  const resetForm = () => setForm({ name: "", projectId: "", frequency: "weekly", hour: "9", status: "active" });

  const handleCreate = () => {
    if (!form.name || !form.projectId) { toast({ title: "Name and project are required", variant: "destructive" }); return; }
    createMutation.mutate(
      { data: { name: form.name, projectId: Number(form.projectId), frequency: form.frequency as "daily" | "weekly" | "monthly", hour: Number(form.hour), status: form.status as "active" | "paused" | "disabled" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListScheduledAuditsQueryKey() });
          setShowCreate(false); resetForm();
          toast({ title: "Schedule created" });
        },
      }
    );
  };

  const handleStatusToggle = (id: number, current: string) => {
    const next = current === "active" ? "paused" : "active";
    updateMutation.mutate(
      { id, data: { status: next as "active" | "paused" | "disabled" } },
      { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListScheduledAuditsQueryKey() }); toast({ title: `Schedule ${next}` }); } }
    );
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(
      { id },
      { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListScheduledAuditsQueryKey() }); toast({ title: "Schedule deleted" }); } }
    );
  };

  const hourLabel = (h: number) => {
    const ampm = h < 12 ? "AM" : "PM";
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${display}:00 ${ampm} UTC`;
  };

  return (
    <div className="space-y-6">
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
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">{s.projectName ?? `Project #${s.projectId}`}</TableCell>
                    <TableCell>{FREQ_LABELS[s.frequency]}</TableCell>
                    <TableCell>{hourLabel(s.hour)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[s.status]}>
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.nextRunAt ? format(new Date(s.nextRunAt), "MMM d, yyyy h:mm a") : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.lastRunAt ? format(new Date(s.lastRunAt), "MMM d, yyyy") : "Never"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleStatusToggle(s.id, s.status)}>
                            {s.status === "active" ? <><Pause className="h-4 w-4 mr-2" />Pause</> : <><Play className="h-4 w-4 mr-2" />Activate</>}
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
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Scheduled Audit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Schedule Name</Label>
              <Input placeholder="e.g. Weekly Marketing Site" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
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
