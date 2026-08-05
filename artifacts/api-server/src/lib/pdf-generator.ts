import { db } from "@workspace/db";
import { reportsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import path from "path";
import fs from "fs/promises";
import PDFDocument from "pdfkit";
import { createWriteStream } from "fs";

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const reportsDir = path.resolve(workspaceRoot, "artifacts/api-server/reports");

interface CrawlPageSummary {
  url: string;
  pageTitle?: string | null;
  status: string;
  overallScore?: number | null;
  performanceScore?: number | null;
  accessibilityScore?: number | null;
  seoScore?: number | null;
  bestPracticesScore?: number | null;
}

interface Bug {
  id: number;
  title: string;
  description: string | null;
  severity: string;
  status: string;
}

interface AuditData {
  id: number;
  projectId: number;
  projectName: string | null;
  performanceScore: number | null;
  accessibilityScore: number | null;
  seoScore: number | null;
  bestPracticesScore: number | null;
  bugsFound: number;
  overallScore: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  findings: Record<string, unknown> | null;
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

function scoreColor(score: number | null): string {
  if (score == null) return "#6b7280";
  if (score >= 90) return "#16a34a";
  if (score >= 75) return "#d97706";
  if (score >= 50) return "#ea580c";
  return "#dc2626";
}

function severityColor(sev: string): string {
  switch (sev.toLowerCase()) {
    case "critical": return "#dc2626";
    case "high":     return "#ea580c";
    case "medium":   return "#d97706";
    case "low":      return "#16a34a";
    default:         return "#6b7280";
  }
}

// ─── PDF generation ───────────────────────────────────────────────────────────

async function writePdf(filePath: string, auditData: AuditData, bugs: Bug[], crawlPages?: CrawlPageSummary[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const stream = createWriteStream(filePath);

    doc.pipe(stream);
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.on("error", reject);

    const W = doc.page.width - 100; // usable width
    const GRAY = "#6b7280";
    const DARK = "#111827";
    const PRIMARY = "#6366f1";

    // ── Cover / header ─────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 140).fill(PRIMARY);
    doc
      .fillColor("#ffffff")
      .fontSize(22)
      .font("Helvetica-Bold")
      .text("QA Automation Portal", 50, 40);
    doc
      .fontSize(14)
      .font("Helvetica")
      .text("Audit Report", 50, 68);
    doc
      .fontSize(10)
      .text(`Generated: ${new Date().toUTCString()}`, 50, 90);
    doc
      .text(`Report ID: ${auditData.id}  ·  Project: ${auditData.projectName ?? "Unknown"}`, 50, 108);

    doc.moveDown(3);

    // ── Section helper ──────────────────────────────────────────────────────
    const section = (title: string) => {
      doc.moveDown(0.8);
      doc
        .fillColor(PRIMARY)
        .fontSize(13)
        .font("Helvetica-Bold")
        .text(title, 50, doc.y);
      doc
        .moveTo(50, doc.y + 2)
        .lineTo(50 + W, doc.y + 2)
        .strokeColor(PRIMARY)
        .lineWidth(0.5)
        .stroke();
      doc.moveDown(0.5);
      doc.fillColor(DARK).fontSize(10).font("Helvetica");
    };

    // ── Scores grid ─────────────────────────────────────────────────────────
    section("Lighthouse Scores");

    const scores = [
      ["Overall",       auditData.overallScore],
      ["Performance",   auditData.performanceScore],
      ["Accessibility", auditData.accessibilityScore],
      ["SEO",           auditData.seoScore],
      ["Best Practices",auditData.bestPracticesScore],
    ] as Array<[string, number | null]>;

    const colW = W / scores.length;
    const scoreY = doc.y;
    scores.forEach(([label, val], i) => {
      const x = 50 + i * colW;
      const color = scoreColor(val);
      doc.rect(x, scoreY, colW - 4, 60).fillAndStroke("#f9fafb", "#e5e7eb");
      doc
        .fillColor(color)
        .fontSize(20)
        .font("Helvetica-Bold")
        .text(val != null ? String(Math.round(val)) : "—", x, scoreY + 8, { width: colW - 4, align: "center" });
      doc
        .fillColor(GRAY)
        .fontSize(8)
        .font("Helvetica")
        .text(label, x, scoreY + 34, { width: colW - 4, align: "center" });
    });
    doc.y = scoreY + 72;

    // ── Summary ─────────────────────────────────────────────────────────────
    section("Summary");
    const rows: Array<[string, string]> = [
      ["Audit Run ID", String(auditData.id)],
      ["Project",      auditData.projectName ?? "Unknown"],
      ["Bugs Found",   String(auditData.bugsFound)],
      ["Duration",     auditData.durationMs ? `${Math.round(auditData.durationMs / 1000)}s` : "N/A"],
      ["Completed",    auditData.completedAt ? new Date(auditData.completedAt).toUTCString() : "N/A"],
    ];
    rows.forEach(([k, v]) => {
      doc
        .fillColor(GRAY).font("Helvetica-Bold").fontSize(9)
        .text(k, 50, doc.y, { continued: true, width: 140 });
      doc
        .fillColor(DARK).font("Helvetica").fontSize(9)
        .text(v);
    });

    // ── Bugs ────────────────────────────────────────────────────────────────
    section(`Bugs (${bugs.length})`);
    if (bugs.length === 0) {
      doc.fillColor(GRAY).text("No bugs found.");
    } else {
      // Severity breakdown
      const sev = (s: string) => bugs.filter(b => b.severity === s).length;
      doc.fillColor(DARK).text(`Critical: ${sev("critical")}  High: ${sev("high")}  Medium: ${sev("medium")}  Low: ${sev("low")}`);
      doc.moveDown(0.4);

      bugs.slice(0, 50).forEach((bug, i) => {
        if (doc.y > doc.page.height - 120) doc.addPage();
        const color = severityColor(bug.severity);
        doc
          .fillColor(color).font("Helvetica-Bold").fontSize(9)
          .text(`[${bug.severity.toUpperCase()}] `, 50, doc.y, { continued: true });
        doc
          .fillColor(DARK).font("Helvetica-Bold").fontSize(9)
          .text(`#${bug.id}: ${bug.title}`, { width: W });
        if (bug.description) {
          doc
            .fillColor(GRAY).font("Helvetica").fontSize(8)
            .text(bug.description.slice(0, 200), 60, doc.y, { width: W - 10 });
        }
        if (i < bugs.length - 1) doc.moveDown(0.3);
      });
      if (bugs.length > 50) {
        doc.moveDown(0.4).fillColor(GRAY).fontSize(8)
          .text(`… and ${bugs.length - 50} more bugs (see the portal for the full list).`);
      }
    }

    // ── Recommendations ──────────────────────────────────────────────────────
    const recs: string[] = [];
    if (auditData.performanceScore   != null && auditData.performanceScore   < 70) recs.push("Optimize performance: compress images, enable caching, minify JS/CSS.");
    if (auditData.accessibilityScore != null && auditData.accessibilityScore < 80) recs.push("Improve accessibility: add ARIA labels, improve color contrast.");
    if (auditData.seoScore           != null && auditData.seoScore           < 75) recs.push("Enhance SEO: improve meta tags, heading structure, page speed.");
    if (bugs.some(b => b.severity === "critical")) recs.push("Address all Critical-severity bugs before the next release.");

    if (recs.length > 0) {
      section("Recommendations");
      recs.forEach(r => {
        doc.fillColor(DARK).font("Helvetica").fontSize(9).text(`• ${r}`, 50, doc.y, { width: W });
      });
    }

    // ── Crawl page summaries ─────────────────────────────────────────────────
    if (crawlPages && crawlPages.length > 0) {
      if (doc.y > doc.page.height - 160) doc.addPage();
      section(`Crawl Page Summaries (${crawlPages.length} pages)`);

      // Table header
      const cols = [W * 0.42, W * 0.12, W * 0.09, W * 0.09, W * 0.09, W * 0.09, W * 0.10];
      const headers = ["URL", "Status", "Overall", "Perf", "A11y", "SEO", "BP"];
      let hx = 50;
      doc.fillColor(PRIMARY).font("Helvetica-Bold").fontSize(8);
      headers.forEach((h, i) => { doc.text(h, hx, doc.y, { width: cols[i], align: i === 0 ? "left" : "center" }); hx += cols[i]; });
      doc.moveDown(0.2);
      doc.moveTo(50, doc.y).lineTo(50 + W, doc.y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
      doc.moveDown(0.2);

      crawlPages.slice(0, 80).forEach((page) => {
        if (doc.y > doc.page.height - 60) { doc.addPage(); }
        doc.fillColor(DARK).font("Helvetica").fontSize(7.5);
        const rowY = doc.y;
        let cx = 50;
        const vals = [
          page.url.replace(/^https?:\/\//, "").slice(0, 55),
          page.status.toUpperCase(),
          page.overallScore      != null ? String(Math.round(page.overallScore))      : "—",
          page.performanceScore  != null ? String(Math.round(page.performanceScore))  : "—",
          page.accessibilityScore!= null ? String(Math.round(page.accessibilityScore)): "—",
          page.seoScore          != null ? String(Math.round(page.seoScore))          : "—",
          page.bestPracticesScore!= null ? String(Math.round(page.bestPracticesScore)): "—",
        ];
        vals.forEach((v, i) => {
          const color = i >= 2 ? scoreColor(Number(v) || null) : (i === 1 && v === "FAILED" ? "#dc2626" : DARK);
          doc.fillColor(color).text(v, cx, rowY, { width: cols[i], align: i === 0 ? "left" : "center" });
          cx += cols[i];
        });
        doc.y = rowY + 13;
      });

      if (crawlPages.length > 80) {
        doc.moveDown(0.4).fillColor(GRAY).fontSize(8)
          .text(`… and ${crawlPages.length - 80} more pages. See the portal for the full list.`);
      }
    }

    // ── Footer ───────────────────────────────────────────────────────────────
    doc.moveDown(1.5);
    doc.fillColor(GRAY).fontSize(8).font("Helvetica")
      .text("Generated by QA Automation Portal · Powered by Lighthouse, Playwright & axe-core", 50, doc.y, {
        width: W, align: "center",
      });

    doc.end();
  });
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function generatePdfReport(
  reportId: number,
  audit: Record<string, unknown>,
  bugs: Bug[],
  crawlPages?: CrawlPageSummary[]
): Promise<void> {
  try {
    await fs.mkdir(reportsDir, { recursive: true });

    const fileName = `report-${reportId}-${Date.now()}.pdf`;
    const filePath = path.join(reportsDir, fileName);

    const auditData = audit as unknown as AuditData;
    await writePdf(filePath, auditData, bugs, crawlPages);

    const fileUrl = `/api/reports/download/${fileName}`;

    await db.update(reportsTable).set({
      status: "ready",
      fileUrl,
    }).where(eq(reportsTable.id, reportId));

    logger.info({ reportId, filePath }, "PDF report generated");
  } catch (error) {
    logger.error({ reportId, error }, "PDF report generation failed");
    await db.update(reportsTable).set({ status: "failed" }).where(eq(reportsTable.id, reportId));
  }
}
