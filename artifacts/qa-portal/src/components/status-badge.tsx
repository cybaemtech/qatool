import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string }) {
  let colorClass = "bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200";
  
  switch (status) {
    case 'completed':
    case 'resolved':
      colorClass = "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200";
      break;
    case 'failed':
      colorClass = "bg-red-100 text-red-800 border-red-200 hover:bg-red-200";
      break;
    case 'running':
    case 'in_progress':
      colorClass = "bg-indigo-100 text-indigo-800 border-indigo-200 hover:bg-indigo-200 animate-pulse";
      break;
    case 'pending':
    case 'open':
      colorClass = "bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200";
      break;
    case 'ignored':
    case 'cancelled':
      colorClass = "bg-slate-200 text-slate-600 border-slate-300 hover:bg-slate-300";
      break;
  }

  return (
    <Badge variant="outline" className={`font-semibold capitalize ${colorClass}`}>
      {status.replace('_', ' ')}
    </Badge>
  );
}
