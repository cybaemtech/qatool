// Lightweight client-side persistence for simulated live-audit execution logs.
// Keeps the audit history "aware" of what happened during the run without
// requiring any backend/schema changes.

export interface ExecutionLogLine {
  time: string;
  text: string;
}

const keyFor = (auditId: number) => `qa-portal:audit-execution-log:${auditId}`;

export function saveExecutionLog(auditId: number, logs: ExecutionLogLine[]): void {
  try {
    localStorage.setItem(keyFor(auditId), JSON.stringify(logs));
  } catch {
    // best-effort only — storage may be unavailable (private mode, quota, etc.)
  }
}

export function getExecutionLog(auditId: number): ExecutionLogLine[] | null {
  try {
    const raw = localStorage.getItem(keyFor(auditId));
    return raw ? (JSON.parse(raw) as ExecutionLogLine[]) : null;
  } catch {
    return null;
  }
}
