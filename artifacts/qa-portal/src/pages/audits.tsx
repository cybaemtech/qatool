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

export default function Audits() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<string>("all");

  const { data: audits, isLoading } = useListAudits(
    status !== "all" ? { status } : {}
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Audit Runs</h1>
          <p className="text-slate-500 mt-1">History of all automated testing runs.</p>
        </div>
        <div className="w-48">
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

      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
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
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                    Loading audits...
                  </TableCell>
                </TableRow>
              ) : audits?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                    No audits found.
                  </TableCell>
                </TableRow>
              ) : (
                audits?.map((audit) => (
                  <TableRow 
                    key={audit.id}
                    className="cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setLocation(`/audits/${audit.id}`)}
                  >
                    <TableCell className="font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-indigo-500" />
                        #{audit.id}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-indigo-600">
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
                      <span className={audit.bugsFound && audit.bugsFound > 0 ? "font-medium text-red-600" : "text-slate-500"}>
                        {audit.bugsFound}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {audit.durationMs ? `${(audit.durationMs / 1000).toFixed(1)}s` : '-'}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {audit.startedAt ? format(new Date(audit.startedAt), 'MMM d, HH:mm') : '-'}
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
