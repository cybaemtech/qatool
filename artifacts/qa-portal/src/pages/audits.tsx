import { useState } from "react";
import { useLocation } from "wouter";
import { useListAudits } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Activity, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Audits() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<string>("all");

  const { data: audits, isLoading } = useListAudits(
    status !== "all" ? { status } : {}
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Audit Runs</h1>
          <p className="text-muted-foreground mt-1">History of all automated testing runs.</p>
        </div>
        <div className="w-full sm:w-48">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="shadow-sm border-border overflow-x-auto">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Run ID</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Bugs Found</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full max-w-[120px]" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : audits?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Activity className="h-10 w-10 text-muted-foreground/30" />
                      <p className="font-medium text-foreground">No audits found</p>
                      <p className="text-sm">Run an audit from a project to see results here.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                audits?.map((audit) => (
                  <TableRow 
                    key={audit.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setLocation(`/audits/${audit.id}`)}
                  >
                    <TableCell className="font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" />
                        #{audit.id}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-primary">
                      {audit.projectName || `Project ${audit.projectId}`}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={audit.status} />
                    </TableCell>
                    <TableCell>
                      {audit.overallScore != null ? (
                        <div className={`font-semibold ${(audit.overallScore ?? 0) >= 90 ? 'text-emerald-600' : (audit.overallScore ?? 0) >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                          {Math.round(audit.overallScore ?? 0)}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={audit.bugsFound && audit.bugsFound > 0 ? "font-medium text-red-600" : "text-muted-foreground"}>
                        {audit.bugsFound}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {audit.durationMs ? `${(audit.durationMs / 1000).toFixed(1)}s` : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {audit.startedAt ? format(new Date(audit.startedAt), 'MMM d, HH:mm') : '-'}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
