import { useListReports } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { FileText, Download, Activity, FileCheck } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

export default function Reports() {
  const { data: reports, isLoading } = useListReports();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Reports</h1>
        <p className="text-muted-foreground mt-1">Generated compliance and quality reports.</p>
      </div>

      <Card className="shadow-sm border-border overflow-x-auto">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
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
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full max-w-[120px]" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : reports?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <FileCheck className="h-10 w-10 text-muted-foreground/30" />
                      <p className="font-medium text-foreground">No reports generated yet</p>
                      <p className="text-sm">Reports appear here once an audit completes.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                reports?.map((report) => (
                  <TableRow key={report.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        Report #{report.id}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link href={`/audits/${report.auditRunId}`} className="text-primary hover:underline flex items-center gap-1 font-medium">
                        <Activity className="h-3 w-3" /> Audit #{report.auditRunId}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={report.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(report.createdAt), 'MMM d, yyyy HH:mm')}
                    </TableCell>
                    <TableCell className="text-right">
                      {report.status === 'ready' && report.fileUrl ? (
                        <Button variant="outline" size="sm" asChild>
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
