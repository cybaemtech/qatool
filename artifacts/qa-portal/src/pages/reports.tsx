import { useListReports } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { FileText, Download, Activity, FileCheck } from "lucide-react";
import { Link } from "wouter";

export default function Reports() {
  const { data: reports, isLoading } = useListReports();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Reports</h1>
        <p className="text-slate-500 mt-1">Generated compliance and quality reports.</p>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Report ID</TableHead>
                <TableHead>Audit Run</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Generated At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                    Loading reports...
                  </TableCell>
                </TableRow>
              ) : reports?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <FileCheck className="h-8 w-8 text-slate-300" />
                      <span>No reports generated yet.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                reports?.map((report) => (
                  <TableRow key={report.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-indigo-500" />
                        Report #{report.id}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link href={`/audits/${report.auditRunId}`} className="text-indigo-600 hover:underline flex items-center gap-1 font-medium">
                        <Activity className="h-3 w-3" /> Audit #{report.auditRunId}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={report.status} />
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {format(new Date(report.createdAt), 'MMM d, yyyy HH:mm')}
                    </TableCell>
                    <TableCell className="text-right">
                      {report.status === 'ready' && report.fileUrl ? (
                        <Button variant="outline" size="sm" asChild className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                          <a href={report.fileUrl} download>
                            <Download className="h-3 w-3 mr-2" /> Download PDF
                          </a>
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" disabled>
                          <Download className="h-3 w-3 mr-2" /> Unavailable
                        </Button>
                      )}
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
