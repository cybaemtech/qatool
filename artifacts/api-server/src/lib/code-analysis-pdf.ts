/**
 * PDF generator for code analysis results.
 */
import path from "path";
import fs from "fs/promises";
import { createWriteStream, existsSync } from "fs";
import PDFDocument from "pdfkit";
import { db } from "@workspace/db";
import { codeAnalysisJobsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import type { CodeIssue } from "@workspace/db";

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const reportsDir = path.resolve(workspaceRoot, "artifacts/api-server/reports");

function scoreColor(score: number | null): string {
  if (score == null) return "#6b7280";
  if (score >= 90) return "#16a34a";
  if (score >= 75) return "#d97706";
  if (score >= 50) return "#ea580c";
  return "#dc2626";
}

function severityColor(sev: string): string {
  switch (sev) {
    case "error":      return "#dc2626";
    case "warning":    return "#d97706";
    case "suggestion": return "#2563eb";
    default:           return "#6b7280";
  }
}

async function writePdf(
  filePath: string,
  job: {
    id: number;
    name: string;
    overallScore: number | null;
    errorCount: number;
    warningCount: number;
    suggestionCount: number;
    filesAnalyzed: number;
    sourceType: string;
    sourceUrl: string | null;
    completedAt: Date | null;
    issues: CodeIssue[] | null;
  }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const stream = createWriteStream(filePath);
    doc.pipe(stream);
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.on("error", reject);

    const W = doc.page.width - 100;
    const GRAY = "#6b7280";
    const DARK = "#111827";
    const PRIMARY = "#6366f1";

    // Cover
    doc.rect(0, 0, doc.page.width, 140).fill(PRIMARY);
    doc.fillColor("#ffffff").fontSize(22).font("Helvetica-Bold").text("QA Automation Portal", 50, 40);
    doc.fontSize(14).font("Helvetica").text("Code Analysis Report", 50, 68);
    doc.fontSize(10).text(`Generated: ${new Date().toUTCString()}`, 50, 90);
    doc.text(`Job: ${job.name}`, 50, 108);
    doc.moveDown(3);

    const section = (title: string) => {
      doc.moveDown(0.8);
      doc.fillColor(PRIMARY).fontSize(13).font("Helvetica-Bold").text(title, 50, doc.y);
      doc.moveTo(50, doc.y + 2).lineTo(50 + W, doc.y + 2).strokeColor(PRIMARY).lineWidth(0.5).stroke();
      doc.moveDown(0.5);
      doc.fillColor(DARK).fontSize(10).font("Helvetica");
    };

    // Score
    section("Code Quality Score");
    const scoreY = doc.y;
    const scoreColW = W / 4;
    const cols: Array<[string, string | number]> = [
      ["Quality Score", job.overallScore != null ? Math.round(job.overallScore) : "—"],
      ["Errors",        job.errorCount],
      ["Warnings",      job.warningCount],
      ["Suggestions",   job.suggestionCount],
    ];
    cols.forEach(([label, val], i) => {
      const x = 50 + i * scoreColW;
      const color = i === 0 ? scoreColor(job.overallScore) : (i === 1 ? "#dc2626" : i === 2 ? "#d97706" : "#2563eb");
      doc.rect(x, scoreY, scoreColW - 4, 60).fillAndStroke("#f9fafb", "#e5e7eb");
      doc.fillColor(color).fontSize(20).font("Helvetica-Bold")
        .text(String(val), x, scoreY + 8, { width: scoreColW - 4, align: "center" });
      doc.fillColor(GRAY).fontSize(8).font("Helvetica")
        .text(String(label), x, scoreY + 34, { width: scoreColW - 4, align: "center" });
    });
    doc.y = scoreY + 72;

    // Summary
    section("Summary");
    const rows: Array<[string, string]> = [
      ["Job ID",           String(job.id)],
      ["Name",             job.name],
      ["Source",           job.sourceType === "github" ? `GitHub: ${job.sourceUrl ?? ""}` : "ZIP upload"],
      ["Files Analyzed",   String(job.filesAnalyzed)],
      ["Total Issues",     String(job.errorCount + job.warningCount + job.suggestionCount)],
      ["Completed",        job.completedAt ? new Date(job.completedAt).toUTCString() : "N/A"],
    ];
    rows.forEach(([k, v]) => {
      doc.fillColor(GRAY).font("Helvetica-Bold").fontSize(9)
        .text(k, 50, doc.y, { continued: true, width: 140 });
      doc.fillColor(DARK).font("Helvetica").fontSize(9).text(v);
    });

    // Issues
    const issues = job.issues ?? [];
    if (issues.length > 0) {
      const groups: Array<["error" | "warning" | "suggestion", string]> = [
        ["error",      "Errors"],
        ["warning",    "Warnings"],
        ["suggestion", "Suggestions"],
      ];
      for (const [sev, label] of groups) {
        const subset = issues.filter(i => i.severity === sev);
        if (subset.length === 0) continue;
        section(`${label} (${subset.length})`);
        subset.slice(0, 80).forEach((issue, idx) => {
          if (doc.y > doc.page.height - 130) doc.addPage();
          const color = severityColor(issue.severity);
          doc.fillColor(color).font("Helvetica-Bold").fontSize(9)
            .text(`[${issue.severity.toUpperCase()}] `, 50, doc.y, { continued: true });
          doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9)
            .text(`${issue.file}:${issue.line} — ${issue.rule ?? "parse-error"}`, { width: W });
          doc.fillColor(GRAY).font("Helvetica").fontSize(8)
            .text(issue.message, 60, doc.y, { width: W - 10 });
          if (issue.aiFixSuggestion) {
            doc.fillColor("#374151").font("Helvetica").fontSize(8)
              .text(`Fix: ${issue.aiFixSuggestion.slice(0, 200)}`, 60, doc.y, { width: W - 10 });
          }
          if (idx < subset.length - 1) doc.moveDown(0.3);
        });
        if (subset.length > 80) {
          doc.moveDown(0.4).fillColor(GRAY).fontSize(8)
            .text(`… and ${subset.length - 80} more (see the portal for the full list).`);
        }
      }
    }

    doc.end();
  });
}

export async function generateCodeAnalysisPdf(jobId: number): Promise<void> {
  const [job] = await db.select().from(codeAnalysisJobsTable).where(eq(codeAnalysisJobsTable.id, jobId)).limit(1);
  if (!job) throw new Error("Code analysis job not found");

  await fs.mkdir(reportsDir, { recursive: true });
  const filename = `code-analysis-${jobId}-${Date.now()}.pdf`;
  const filePath = path.join(reportsDir, filename);

  try {
    await writePdf(filePath, job as Parameters<typeof writePdf>[1]);
    await db.update(codeAnalysisJobsTable)
      .set({ pdfUrl: `/api/reports/download/${filename}` })
      .where(eq(codeAnalysisJobsTable.id, jobId));
    logger.info({ jobId, filename }, "Code analysis PDF generated");
  } catch (err) {
    logger.error({ err, jobId }, "Code analysis PDF generation failed");
    if (existsSync(filePath)) await fs.unlink(filePath).catch(() => {});
    throw err;
  }
}
