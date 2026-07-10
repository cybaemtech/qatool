import { Badge } from "@/components/ui/badge";
import { BugSeverity } from "@workspace/api-client-react";

export function SeverityBadge({ severity }: { severity: string }) {
  let colorClass = "bg-slate-100 text-slate-800 hover:bg-slate-200 border-slate-200";
  
  switch (severity) {
    case 'critical':
      colorClass = "bg-red-100 text-red-800 hover:bg-red-200 border-red-200";
      break;
    case 'high':
      colorClass = "bg-orange-100 text-orange-800 hover:bg-orange-200 border-orange-200";
      break;
    case 'medium':
      colorClass = "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200";
      break;
    case 'low':
      colorClass = "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200";
      break;
  }

  return (
    <Badge variant="outline" className={`font-semibold capitalize ${colorClass}`}>
      {severity}
    </Badge>
  );
}
