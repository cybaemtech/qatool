import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import projectsRouter from "./projects";
import auditsRouter from "./audits";
import bugsRouter from "./bugs";
import screenshotsRouter from "./screenshots";
import reportsRouter from "./reports";
import dashboardRouter from "./dashboard";
import scheduledAuditsRouter from "./scheduled-audits";
import notificationsRouter from "./notifications";
import feedbackRouter from "./feedback";
import crawlJobsRouter from "./crawl-jobs";
import analyticsRouter from "./analytics";
import codeAnalysisRouter from "./code-analysis";
import path from "path";
import fs from "fs";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(projectsRouter);
router.use(auditsRouter);
router.use(bugsRouter);
router.use(screenshotsRouter);
router.use(reportsRouter);
router.use(dashboardRouter);
router.use(scheduledAuditsRouter);
router.use(notificationsRouter);
router.use(feedbackRouter);
router.use(crawlJobsRouter);
router.use(analyticsRouter);
router.use(codeAnalysisRouter);

// Serve generated report files
const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();
const reportsDir = path.resolve(workspaceRoot, "artifacts/api-server/reports");

router.get("/reports/download/:filename", (req, res) => {
  const filename = req.params.filename;
  if (!filename || filename.includes("..")) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }
  const filePath = path.join(reportsDir, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Report file not found" });
    return;
  }
  res.download(filePath);
});

export default router;
