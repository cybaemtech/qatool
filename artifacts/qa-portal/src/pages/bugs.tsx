import { useState } from "react";
import {
  useListBugs, useUpdateBug, useListUsers, useListBugComments, useCreateBugComment,
  getListBugsQueryKey, getListBugCommentsQueryKey,
} from "@workspace/api-client-react";
import type { Bug } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { SeverityBadge } from "@/components/severity-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { Bug as BugIcon, MessageSquare, Send, User, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { AiBugResolutionPanel } from "@/components/ai-bug-resolution-panel";

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
  const [selectedBug, setSelectedBug] = useState<Bug | null>(null);
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
  const { data: comments = [] } = useListBugComments(selectedBug?.id ?? 0, {
    query: { enabled: selectedBug != null, queryKey: getListBugCommentsQueryKey(selectedBug?.id ?? 0) },
  });

  const updateBug = useUpdateBug();
  const createComment = useCreateBugComment();

  const handleStatusChange = (id: number, newStatus: string) => {
    updateBug.mutate(
      { id, data: { status: newStatus as "open" | "in_progress" | "resolved" | "ignored" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBugsQueryKey(queryParams) });
          toast({ title: "Status updated" });
          if (selectedBug?.id === id) setSelectedBug(prev => prev ? { ...prev, status: newStatus as Bug["status"] } : prev);
        },
      }
    );
  };

  const handleAssign = (id: number, assignedToId: string) => {
    updateBug.mutate(
      { id, data: { assignedToId: assignedToId === "unassigned" ? null : Number(assignedToId) } },
      { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListBugsQueryKey(queryParams) }); toast({ title: "Bug assigned" }); } }
    );
  };

  const handleSendComment = () => {
    if (!commentText.trim() || !selectedBug) return;
    createComment.mutate(
      { id: selectedBug.id, data: { content: commentText.trim() } },
      {
        onSuccess: () => {
          setCommentText("");
          queryClient.invalidateQueries({ queryKey: getListBugCommentsQueryKey(selectedBug.id) });
          toast({ title: "Comment added" });
        },
      }
    );
  };

  const handleMarkFixed = () => {
    if (!selectedBug) return;
    handleStatusChange(selectedBug.id, "resolved");
    toast({ title: "Bug marked as fixed", description: selectedBug.title });
  };

  const handleMarkReadyForQA = () => {
    if (!selectedBug) return;
    handleStatusChange(selectedBug.id, "in_progress");
    toast({ title: "Marked ready for QA", description: "Status set to In Progress." });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BugIcon className="h-6 w-6 text-primary" /> Bug Tracker
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
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !bugs?.length ? (
            <div className="p-12 text-center">
              <BugIcon className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-medium text-foreground">No bugs match your filters</p>
              <p className="text-sm text-muted-foreground mt-1">Try adjusting the severity, priority, or status filters above.</p>
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
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {bugs.map((bug) => (
                  <TableRow key={bug.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="max-w-[240px]">
                      <div>
                        <button
                          className="text-sm font-medium text-foreground hover:text-primary line-clamp-1 text-left"
                          onClick={() => setSelectedBug(bug)}
                        >
                          {bug.title}
                        </button>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{bug.description}</p>
                      </div>
                    </TableCell>
                    <TableCell><SeverityBadge severity={bug.severity} /></TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("rounded-full text-xs", PRIORITY_COLORS[bug.priority])}>
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
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                          onClick={() => setSelectedBug(bug)}
                          title="AI Analysis"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setSelectedBug(bug)}
                          title="Comments"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Bug Detail Dialog — AI Panel + Comments */}
      <Dialog
        open={selectedBug != null}
        onOpenChange={(open) => { if (!open) { setSelectedBug(null); setCommentText(""); } }}
      >
        <DialogContent className="max-w-6xl w-full max-h-[92vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border flex-shrink-0">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-semibold leading-snug line-clamp-2">
                  {selectedBug?.title}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {selectedBug && <SeverityBadge severity={selectedBug.severity} />}
                  {selectedBug && <StatusBadge status={selectedBug.status} />}
                  {selectedBug && (
                    <Badge variant="outline" className={cn("rounded-full text-xs", PRIORITY_COLORS[selectedBug.priority])}>
                      {selectedBug.priority}
                    </Badge>
                  )}
                  {selectedBug?.description && (
                    <span className="text-xs text-muted-foreground line-clamp-1 max-w-[340px]">{selectedBug.description}</span>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex">
            <Tabs defaultValue="ai" className="flex-1 flex flex-col overflow-hidden">
              <div className="px-6 pt-2 pb-0 border-b border-border flex-shrink-0">
                <TabsList className="h-8">
                  <TabsTrigger value="ai" className="text-xs gap-1.5 h-7">
                    <Sparkles className="h-3 w-3 text-violet-600" />
                    AI Analysis
                  </TabsTrigger>
                  <TabsTrigger value="comments" className="text-xs gap-1.5 h-7">
                    <MessageSquare className="h-3 w-3" />
                    Comments
                    {comments.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-0.5">{comments.length}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="ai" className="flex-1 overflow-y-auto m-0 p-6">
                {selectedBug && (
                  <AiBugResolutionPanel
                    bug={selectedBug}
                    onMarkFixed={handleMarkFixed}
                    onMarkReadyForQA={handleMarkReadyForQA}
                  />
                )}
              </TabsContent>

              <TabsContent value="comments" className="flex-1 overflow-y-auto m-0 p-6 flex flex-col">
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
                  {comments.length === 0 ? (
                    <div className="text-center py-10 text-sm text-muted-foreground">
                      <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                      No comments yet. Be the first to add one.
                    </div>
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
                <div className="flex gap-2 pt-3 border-t border-border mt-4 flex-shrink-0">
                  <Textarea
                    placeholder="Add a comment… (Ctrl+Enter to send)"
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    className="min-h-[60px] text-sm resize-none"
                    onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSendComment(); }}
                  />
                  <Button onClick={handleSendComment} disabled={!commentText.trim() || createComment.isPending} size="icon" className="self-end">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
