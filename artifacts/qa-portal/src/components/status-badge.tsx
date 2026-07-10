import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string }) {
  let colorClass = "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200";

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
      colorClass = "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200";
      break;
    case 'ignored':
    case 'cancelled':
      colorClass = "bg-slate-200 text-slate-600 border-slate-300 hover:bg-slate-300";
      break;
  }

  return (
    <motion.div
      key={status}
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="inline-block"
    >
      <Badge variant="outline" className={`rounded-full font-semibold capitalize ${colorClass}`}>
        {status.replace('_', ' ')}
      </Badge>
    </motion.div>
  );
}
