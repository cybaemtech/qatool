import { useState } from "react";
import {
  useListBugs, useUpdateBug, useListUsers, useListBugComments, useCreateBugComment,
  getListBugsQueryKey, getListBugCommentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { SeverityBadge } from "@/components/severity-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { Bug, MessageSquare, Send, User, Calendar } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-blue-100 text-blue-800 border-blue-200",
};

export default function Bugs() {
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [selectedBugId, setSelectedBugId] = useState<number | null>(null);
  const [commentText, setCommentText] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const queryParams = {
    ...(severity !== "all" && { severity }),
    ...(status !== "all" && { status }),
    ...(priority !== "all" && { priority }),
  };

  const { data: bugs, isLoading } = useListBugs(queryParams, {
    query: { queryKey: getListBugsQueryKey(queryParams) },
  });
  const { data: users = [] } = useListUsers();
  const { data: comments = [] } = useListBugComments(selectedBugId!, {
    query: { enabled: selectedBugId != null, queryKey: getListBugCommentsQueryKey(selectedBugId!) },
  });

  const updateBug = useUpdateBug();
  const createComment = useCreateBugComment();

  const handleStatusChange = (id: number, newStatus: string) => {
    updateBug.mutate(
      { id, data: { status: newStatus as "open" | "in_progress" | "resolved" | "ignored" } },
      { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListBugsQueryKey(queryParams) }); toast({ title: "Status updated" }); } }
    );
  };

  const handleAssign = (id: number, assignedToId: string) => {
    updateBug.mutate(
      { id, data: { assignedToId: assignedToId === "unassigned" ? null : Number(assignedToId) } },
      { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListBugsQueryKey(queryParams) }); toast({ title: "Bug assigned" }); } }
    );
  };

  const handleSendComment = () => {
    if (!commentText.trim() || !selectedBugId) return;
    createComment.mutate(
      { id: selectedBugId, data: { content: commentText.trim() } },
      {
        onSuccess: () => {
          setCommentText("");
          queryClient.invalidateQueries({ queryKey: getListBugCommentsQueryKey(selectedBugId!) });
          toast({ title: "Comment added" });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bug className="h-6 w-6 text-primary" /> Bug Tracker
          </h1>
          <p className="text-muted-foreground mt-1">Manage and track issues discovered during audits.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Severity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="ignored">Ignored</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading bugs…</div>
          ) : !bugs?.length ? (
            <div className="p-12 text-center">
              <Bug className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">No bugs match your filters.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bug</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Reported</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {bugs.map((bug) => (
                  <TableRow key={bug.id}>
                    <TableCell className="max-w-[240px]">
                      <div>
                        <Link href={`/audits/${bug.auditRunId}`} className="text-sm font-medium text-foreground hover:text-primary line-clamp-1">
                          {bug.title}
                        </Link>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{bug.description}</p>
                      </div>
                    </TableCell>
                    <TableCell><SeverityBadge severity={bug.severity} /></TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs", PRIORITY_COLORS[bug.priority])}>
                        {bug.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select value={bug.status} onValueChange={v => handleStatusChange(bug.id, v)}>
                        <SelectTrigger className="h-7 text-xs w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="ignored">Ignored</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={bug.assignedToId ? String(bug.assignedToId) : "unassigned"} onValueChange={v => handleAssign(bug.id, v)}>
                        <SelectTrigger className="h-7 text-xs w-[130px]"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {users.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {bug.dueDate ? format(new Date(bug.dueDate), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(bug.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedBugId(bug.id)} title="Comments">
                        <MessageSquare className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Comments Dialog */}
      <Dialog open={selectedBugId != null} onOpenChange={(open) => { if (!open) { setSelectedBugId(null); setCommentText(""); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Bug Comments
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
              {comments.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">No comments yet. Be the first to add one.</div>
              ) : comments.map(c => (
                <div key={c.id} className="flex gap-3">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{c.userName ?? "Unknown"}</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(c.createdAt), "MMM d, h:mm a")}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2 border-t border-border">
              <Textarea
                placeholder="Add a comment…"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                className="min-h-[60px] text-sm resize-none"
                onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSendComment(); }}
              />
              <Button onClick={handleSendComment} disabled={!commentText.trim() || createComment.isPending} size="icon" className="self-end">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
