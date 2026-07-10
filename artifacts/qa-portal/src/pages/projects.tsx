import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListProjects, 
  getListProjectsQueryKey,
  useDeleteProject,
  Project
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Folder,
  ExternalLink,
  Trash,
  Activity
} from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export default function Projects() {
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: projects, isLoading } = useListProjects(
    { search },
    { query: { queryKey: getListProjectsQueryKey({ search }) } }
  );

  const deleteMutation = useDeleteProject();

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this project?")) {
      deleteMutation.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey({ search }) });
          }
        }
      );
    }
  };

  const getEnvBadgeColor = (env: string) => {
    switch (env) {
      case 'production': return 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200';
      case 'staging': return 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200';
      case 'development': return 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Projects</h1>
          <p className="text-muted-foreground mt-1">Manage and monitor your target applications.</p>
        </div>
        <Button onClick={() => setLocation("/projects/new")} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      <Card className="shadow-sm border-border">
        <div className="p-4 border-b border-border flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search projects..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-muted/40"
            />
          </div>
        </div>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[300px]">Name</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead className="text-right">Audits</TableHead>
                <TableHead className="text-right">Open Bugs</TableHead>
                <TableHead>Last Audit</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full max-w-[140px]" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : projects?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Folder className="h-10 w-10 text-muted-foreground/30" />
                      <p className="font-medium text-foreground">No projects found</p>
                      <p className="text-sm">Create one to get started.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                projects?.map((project: Project) => (
                  <TableRow 
                    key={project.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setLocation(`/projects/${project.id}`)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                          <Folder className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="text-foreground font-semibold">{project.name}</div>
                          <a 
                            href={project.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {project.url} <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`rounded-full capitalize font-medium ${getEnvBadgeColor(project.environment)}`}>
                        {project.environment}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium text-muted-foreground">
                      {project.auditCount || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      {project.openBugCount ? (
                        <Badge variant="secondary" className="rounded-full bg-red-50 text-red-700 border-red-100">
                          {project.openBugCount}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/60">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {project.lastAuditAt ? format(new Date(project.lastAuditAt), 'MMM d, yyyy') : 'Never'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setLocation(`/projects/${project.id}`); }}>
                            <Activity className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-red-600 focus:text-red-600"
                            onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }}
                          >
                            <Trash className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
