/**
 * Code Analysis routes.
 * POST /code-analysis          — create job (ZIP upload or GitHub URL)
 * GET  /code-analysis          — list jobs
 * GET  /code-analysis/:id      — get job detail
 * POST /code-analysis/:id/pdf  — generate PDF for a job
 * GET  /code-analysis/:id/export/json — export results as JSON
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { codeAnalysisJobsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";
import {
  analyzeDirectory,
  extractZip,
  downloadGitHubArchive,
  makeTempDir,
} from "../lib/code-analyzer";
import { generateCodeAnalysisPdf } from "../lib/code-analysis-pdf";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import fss from "fs";
import os from "os";

const router = Router();

// ─── Multer — store upload in OS temp dir ─────────────────────────────────────
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
  fileFilter(_req, file, cb) {
    if (file.mimetype === "application/zip" ||
        file.originalname.endsWith(".zip")) {
      cb(null, true);
    } else {
      cb(new Error("Only .zip files are accepted"));
    }
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatJob(j: Record<string, unknown>) {
  return {
    ...j,
    createdAt:   j.createdAt   instanceof Date ? j.createdAt.toISOString()   : j.createdAt,
    completedAt: j.completedAt instanceof Date ? j.completedAt.toISOString() : j.completedAt,
  };
}

async function cleanupDir(dir: string) {
  try { await fs.rm(dir, { recursive: true, force: true }); } catch {}
}

async function runAnalysis(jobId: number, dir: string, tempZip?: string) {
  try {
    await db.update(codeAnalysisJobsTable)
      .set({ status: "running" })
      .where(eq(codeAnalysisJobsTable.id, jobId));

    const result = await analyzeDirectory(dir);

    await db.update(codeAnalysisJobsTable)
      .set({
        status: "completed",
        overallScore:    result.overallScore,
        errorCount:      result.errorCount,
        warningCount:    result.warningCount,
        suggestionCount: result.suggestionCount,
        filesAnalyzed:   result.filesAnalyzed,
        issues:          result.issues as unknown as typeof codeAnalysisJobsTable.$inferInsert["issues"],
        completedAt:     new Date(),
      })
      .where(eq(codeAnalysisJobsTable.id, jobId));

    logger.info({ jobId, filesAnalyzed: result.filesAnalyzed, issues: result.issues.length }, "Code analysis complete");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, jobId }, "Code analysis failed");
    await db.update(codeAnalysisJobsTable)
      .set({ status: "failed", errorMessage: msg })
      .where(eq(codeAnalysisJobsTable.id, jobId));
  } finally {
    await cleanupDir(dir);
    if (tempZip) {
      try { await fs.unlink(tempZip); } catch {}
    }
  }
}

// ─── POST /code-analysis ──────────────────────────────────────────────────────
// Accepts either multipart/form-data (ZIP) or application/json (GitHub URL).

router.post(
  "/code-analysis",
  requireAuth,
  (req, res, next) => {
    const ct = req.headers["content-type"] ?? "";
    if (ct.includes("multipart")) {
      upload.single("file")(req, res, next);
    } else {
      next();
    }
  },
  async (req, res) => {
    let sourceType: "zip" | "github";
    let name: string;
    let sourceUrl: string | undefined;
    let uploadedFilePath: string | undefined;

    const ct = req.headers["content-type"] ?? "";
    if (ct.includes("multipart")) {
      // ZIP upload
      if (!req.file) {
        res.status(400).json({ error: "No ZIP file provided" });
        return;
      }
      uploadedFilePath = req.file.path;
      sourceType = "zip";
      name = (req.body?.name as string) || req.file.originalname || "zip-upload";
    } else {
      // GitHub URL
      const { githubUrl, name: reqName } = req.body ?? {};
      if (!githubUrl) {
        res.status(400).json({ error: "Provide a ZIP file (multipart) or a githubUrl in the JSON body" });
        return;
      }
      sourceType = "github";
      sourceUrl = githubUrl;
      name = reqName || githubUrl;
    }

    const [job] = await db.insert(codeAnalysisJobsTable).values({
      createdById: req.user!.userId,
      name,
      sourceType,
      sourceUrl: sourceUrl ?? null,
      status: "pending",
    }).returning();

    res.status(201).json(formatJob(job as unknown as Record<string, unknown>));

    // Run in background
    (async () => {
      const extractDir = makeTempDir("qa-code-");
      let tempZip: string | undefined;

      try {
        if (sourceType === "zip" && uploadedFilePath) {
          await extractZip(uploadedFilePath, extractDir);
          tempZip = uploadedFilePath;
        } else if (sourceType === "github" && sourceUrl) {
          const zipPath = path.join(os.tmpdir(), `qa-gh-${job.id}-${Date.now()}.zip`);
          const repoName = await downloadGitHubArchive(sourceUrl, zipPath);
          await extractZip(zipPath, extractDir);
          tempZip = zipPath;
          // Update name if still a raw URL
          if (name === sourceUrl) {
            await db.update(codeAnalysisJobsTable)
              .set({ name: repoName })
              .where(eq(codeAnalysisJobsTable.id, job.id));
          }
        }
        await runAnalysis(job.id, extractDir, tempZip);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error({ err, jobId: job.id }, "Code analysis setup failed");
        await db.update(codeAnalysisJobsTable)
          .set({ status: "failed", errorMessage: msg })
          .where(eq(codeAnalysisJobsTable.id, job.id));
        await cleanupDir(extractDir);
        if (tempZip && fss.existsSync(tempZip)) {
          try { await fs.unlink(tempZip); } catch {}
        }
      }
    })().catch(() => {});
  }
);

// ─── GET /code-analysis ───────────────────────────────────────────────────────

router.get("/code-analysis", requireAuth, async (_req, res) => {
  const jobs = await db
    .select({
      id:              codeAnalysisJobsTable.id,
      name:            codeAnalysisJobsTable.name,
      sourceType:      codeAnalysisJobsTable.sourceType,
      sourceUrl:       codeAnalysisJobsTable.sourceUrl,
      status:          codeAnalysisJobsTable.status,
      overallScore:    codeAnalysisJobsTable.overallScore,
      errorCount:      codeAnalysisJobsTable.errorCount,
      warningCount:    codeAnalysisJobsTable.warningCount,
      suggestionCount: codeAnalysisJobsTable.suggestionCount,
      filesAnalyzed:   codeAnalysisJobsTable.filesAnalyzed,
      pdfUrl:          codeAnalysisJobsTable.pdfUrl,
      createdAt:       codeAnalysisJobsTable.createdAt,
      completedAt:     codeAnalysisJobsTable.completedAt,
      errorMessage:    codeAnalysisJobsTable.errorMessage,
    })
    .from(codeAnalysisJobsTable)
    .orderBy(desc(codeAnalysisJobsTable.createdAt))
    .limit(50);

  res.json(jobs.map(j => formatJob(j as unknown as Record<string, unknown>)));
});

// ─── GET /code-analysis/:id ───────────────────────────────────────────────────

router.get("/code-analysis/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [job] = await db.select().from(codeAnalysisJobsTable)
    .where(eq(codeAnalysisJobsTable.id, id)).limit(1);

  if (!job) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatJob(job as unknown as Record<string, unknown>));
});

// ─── GET /code-analysis/:id/export/json ──────────────────────────────────────

router.get("/code-analysis/:id/export/json", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [job] = await db.select().from(codeAnalysisJobsTable)
    .where(eq(codeAnalysisJobsTable.id, id)).limit(1);

  if (!job) { res.status(404).json({ error: "Not found" }); return; }

  res.setHeader("Content-Disposition", `attachment; filename="code-analysis-${id}.json"`);
  res.setHeader("Content-Type", "application/json");
  res.json({
    id: job.id,
    name: job.name,
    sourceType: job.sourceType,
    sourceUrl: job.sourceUrl,
    status: job.status,
    overallScore: job.overallScore,
    errorCount: job.errorCount,
    warningCount: job.warningCount,
    suggestionCount: job.suggestionCount,
    filesAnalyzed: job.filesAnalyzed,
    completedAt: job.completedAt?.toISOString(),
    issues: job.issues ?? [],
  });
});

// ─── POST /code-analysis/:id/pdf ─────────────────────────────────────────────

router.post("/code-analysis/:id/pdf", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [job] = await db.select({ id: codeAnalysisJobsTable.id, status: codeAnalysisJobsTable.status })
    .from(codeAnalysisJobsTable)
    .where(eq(codeAnalysisJobsTable.id, id)).limit(1);

  if (!job) { res.status(404).json({ error: "Not found" }); return; }
  if (job.status !== "completed") {
    res.status(400).json({ error: "Analysis is not completed yet" });
    return;
  }

  res.json({ message: "PDF generation started" });

  generateCodeAnalysisPdf(id).catch((err: unknown) => {
    logger.error({ err, jobId: id }, "Code analysis PDF generation failed");
  });
});

export default router;
