import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useGetAudit, useCancelAudit, getGetAuditQueryKey } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { saveExecutionLog, type ExecutionLogLine } from "@/lib/execution-log";
import {
  Loader2, CheckCircle2, XCircle, Globe, Search, Gauge, Eye, Terminal,
  Wifi, Sparkles, FileCheck2, Rocket, Clock, Hourglass, Ban,
} from "lucide-react";

interface LiveAuditModalProps {
  open: boolean;
  auditId: number | null;
  projectUrl?: string;
  onOpenChange: (open: boolean) => void;
}

const STEPS: Array<{ label: string; icon: typeof Rocket; log: (url: string) => string }> = [
  { label: "Initializing", icon: Rocket, log: (url) => `Initializing audit session for ${url}` },
  { label: "Crawling Website", icon: Search, log: (url) => `Discovering and crawling pages on ${url}` },
  { label: "Lighthouse Analysis", icon: Gauge, log: () => "Running Lighthouse performance audit..." },
  { label: "Accessibility Scan", icon: Eye, log: () => "Scanning DOM for WCAG 2.1 accessibility violations..." },
  { label: "SEO Analysis", icon: Globe, log: () => "Checking meta tags, headings, and search engine crawlability..." },
  { label: "Performance Analysis", icon: Gauge, log: () => "Measuring load times and core web vitals..." },
  { label: "Console Analysis", icon: Terminal, log: () => "Capturing browser console errors and warnings..." },
  { label: "Network Analysis", icon: Wifi, log: () => "Analyzing network waterfall and failed requests..." },
  { label: "AI Root Cause Analysis", icon: Sparkles, log: () => "Generating AI-powered summary and root cause recommendations..." },
  { label: "Generating Report", icon: FileCheck2, log: () => "Compiling findings and finalizing audit report..." },
];

const STEP_INTERVAL_MS = 850;
const SIMULATED_TOTAL_MS = STEP_INTERVAL_MS * STEPS.length;
const MAX_SIMULATED_PROGRESS = 96; // hold shy of 100% until the backend confirms completion

type Phase = "running" | "cancelling" | "success" | "failed" | "cancelled";

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function LiveAuditModal({ open, auditId, projectUrl, onOpenChange }: LiveAuditModalProps) {
  const [, setLocation] = useLocation();
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [logs, setLogs] = useState<ExecutionLogLine[]>([]);
  const [phase, setPhase] = useState<Phase>("running");

  const startRef = useRef(0);
  const seenSteps = useRef<Set<number>>(new Set());
  const logsRef = useRef<ExecutionLogLine[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const finishedRef = useRef(false);

  const cancelMutation = useCancelAudit();
  const { data: audit } = useGetAudit(auditId ?? 0, {
    query: {
      queryKey: getGetAuditQueryKey(auditId ?? 0),
      enabled: open && !!auditId,
      refetchInterval: open && (phase === "running" || phase === "cancelling") ? 1000 : false,
    },
  });

  const url = projectUrl || "the target site";

  const appendLog = (text: string) => {
    const line: ExecutionLogLine = { time: new Date().toLocaleTimeString(), text };
    logsRef.current = [...logsRef.current, line];
    setLogs(logsRef.current);
  };

  // Reset all local state whenever a new audit run starts.
  useEffect(() => {
    if (!open || !auditId) return;
    setStepIndex(0);
    setProgress(0);
    setElapsedMs(0);
    logsRef.current = [];
    setLogs([]);
    setPhase("running");
    finishedRef.current = false;
    seenSteps.current = new Set();
    startRef.current = Date.now();
  }, [open, auditId]);

  // Elapsed timer + simulated step walk.
  useEffect(() => {
    if (!open || phase !== "running") return;
    const tick = setInterval(() => {
      setElapsedMs(Date.now() - startRef.current);
      setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
    }, STEP_INTERVAL_MS);
    return () => clearInterval(tick);
  }, [open, phase]);

  // Smooth progress bar animation, capped until the real audit confirms completion.
  useEffect(() => {
    if (!open || phase !== "running") return;
    const tick = setInterval(() => {
      setProgress((p) => {
        const ceiling = Math.min(MAX_SIMULATED_PROGRESS, ((stepIndex + 1) / STEPS.length) * 100);
        return p < ceiling ? Math.min(ceiling, p + 1.2) : p;
      });
    }, 60);
    return () => clearInterval(tick);
  }, [open, phase, stepIndex]);

  // Emit a log line the first time we enter each step.
  useEffect(() => {
    if (!open || phase !== "running") return;
    if (seenSteps.current.has(stepIndex)) return;
    seenSteps.current.add(stepIndex);
    appendLog(`[${STEPS[stepIndex].label}] ${STEPS[stepIndex].log(url)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, open, phase]);

  // Auto-scroll the terminal log.
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [logs]);

  // React to the real backend audit status (drives the terminal phases).
  useEffect(() => {
    if (!audit || !open || finishedRef.current) return;
    if (phase !== "running" && phase !== "cancelling") return;

    if (audit.status === "completed") {
      finishedRef.current = true;
      appendLog(`Audit completed successfully — overall score ${audit.overallScore != null ? Math.round(audit.overallScore) : "—"}/100.`);
      setProgress(100);
      setStepIndex(STEPS.length - 1);
      setPhase("success");
      if (auditId) saveExecutionLog(auditId, logsRef.current);
    } else if (audit.status === "failed") {
      finishedRef.current = true;
      appendLog("Audit failed unexpectedly. See audit history for details.");
      setPhase("failed");
      if (auditId) saveExecutionLog(auditId, logsRef.current);
    } else if (audit.status === "cancelled") {
      finishedRef.current = true;
      appendLog("Audit was cancelled.");
      setPhase("cancelled");
      if (auditId) saveExecutionLog(auditId, logsRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audit?.status, open, phase, auditId]);

  // Auto-redirect to the report shortly after a successful completion. Kept in its
  // own effect (keyed only on `phase`/`auditId`) so it isn't cancelled by re-renders
  // of the status-watching effect above.
  useEffect(() => {
    if (phase !== "success") return;
    const t = setTimeout(() => {
      onOpenChange(false);
      setLocation(`/audits/${auditId}`);
    }, 1600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, auditId]);

  const handleCancel = () => {
    if (!auditId || phase !== "running") return;
    setPhase("cancelling");
    appendLog("Cancellation requested by user — waiting for confirmation...");
    cancelMutation.mutate(
      { id: auditId },
      {
        onError: () => {
          // Roll back — the audit is still running on the backend.
          appendLog("Cancellation failed. The audit is still running.");
          setPhase("running");
        },
        // onSuccess intentionally left to the status-polling effect above, which
        // will observe the backend's authoritative "cancelled" status.
      }
    );
  };

  const handleViewReport = () => {
    onOpenChange(false);
    if (auditId) setLocation(`/audits/${auditId}`);
  };

  const remainingMs = Math.max(0, SIMULATED_TOTAL_MS - elapsedMs);
  const currentStep = STEPS[stepIndex];
  const CurrentIcon = currentStep.icon;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Prevent dismissing (Esc / outside click) while an audit is actively running or being cancelled.
        if (!next && (phase === "running" || phase === "cancelling")) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {(phase === "running" || phase === "cancelling") && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            {phase === "success" && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
            {phase === "failed" && <XCircle className="h-5 w-5 text-destructive" />}
            {phase === "cancelled" && <Ban className="h-5 w-5 text-muted-foreground" />}
            {phase === "running" && "Running Live Audit"}
            {phase === "cancelling" && "Cancelling Audit…"}
            {phase === "success" && "Audit Completed"}
            {phase === "failed" && "Audit Failed"}
            {phase === "cancelled" && "Audit Cancelled"}
          </DialogTitle>
          <DialogDescription>
            {phase === "running" && `Executing automated checks against ${url}.`}
            {phase === "cancelling" && "Waiting for the server to confirm cancellation…"}
            {phase === "success" && "Redirecting you to the full report…"}
            {phase === "failed" && "The audit could not complete. It has been recorded in the audit history."}
            {phase === "cancelled" && "The audit run was stopped before completion."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Progress bar + percentage */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium flex items-center gap-1.5">
                <CurrentIcon className={cn("h-3.5 w-3.5", phase === "running" ? "text-primary" : "text-muted-foreground")} />
                {phase === "success" ? "Completed" : phase === "cancelling" ? "Cancelling…" : currentStep.label}
              </span>
              <span className="tabular-nums text-muted-foreground">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className={cn(phase === "failed" && "bg-destructive/20", (phase === "cancelled" || phase === "cancelling") && "bg-muted")} />
          </div>

          {/* Elapsed / ETA */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Elapsed {formatElapsed(elapsedMs)}</span>
            {phase === "running" && (
              <span className="flex items-center gap-1"><Hourglass className="h-3.5 w-3.5" /> ~{formatElapsed(remainingMs)} remaining</span>
            )}
          </div>

          {/* Step indicator strip */}
          <div className="grid grid-cols-5 gap-1.5">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const done = phase === "success" || (phase === "running" && i < stepIndex) || ((phase === "failed" || phase === "cancelled") && i < stepIndex);
              const active = phase === "running" && i === stepIndex;
              return (
                <div
                  key={step.label}
                  title={step.label}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-md py-1.5 border text-center transition-colors",
                    done ? "border-primary/30 bg-primary/5" : active ? "border-amber-400/50 bg-amber-50" : "border-border/60 bg-muted/30"
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5", done ? "text-primary" : active ? "text-amber-500" : "text-muted-foreground/50")} />
                  <span className={cn("text-[9px] leading-tight px-0.5", done ? "text-foreground" : active ? "text-amber-700" : "text-muted-foreground/60")}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Terminal log viewer */}
          <div className="rounded-md border border-border bg-zinc-950 font-mono text-[11px] leading-relaxed p-3 h-40 overflow-y-auto">
            {logs.map((line, i) => (
              <div key={i} className="text-zinc-300">
                <span className="text-zinc-500">[{line.time}]</span>{" "}
                <span className={cn(line.text.startsWith("Audit completed") && "text-emerald-400", line.text.startsWith("Audit failed") && "text-red-400", line.text.startsWith("Audit was cancelled") && "text-yellow-400")}>
                  {line.text}
                </span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>

          {/* Success animation */}
          {phase === "success" && (
            <div className="flex flex-col items-center justify-center gap-2 py-2 animate-in fade-in zoom-in-95 duration-300">
              <div className="h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center animate-in zoom-in duration-500">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-emerald-700">Report ready — opening now…</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            {phase === "running" && (
              <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={handleCancel}>
                <XCircle className="h-4 w-4 mr-2" />
                Cancel Audit
              </Button>
            )}
            {phase === "cancelling" && (
              <Button variant="outline" className="text-destructive border-destructive/30" disabled>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Cancelling…
              </Button>
            )}
            {(phase === "failed" || phase === "cancelled") && (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                <Button onClick={handleViewReport}>View Audit History</Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
