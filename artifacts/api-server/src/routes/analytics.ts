import { Router } from "express";
import { db } from "@workspace/db";
import { auditRunsTable } from "@workspace/db";
import { eq, gte, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

const REGRESSION_THRESHOLD_WARNING  = 5;  // ≥5 point drop = warning
const REGRESSION_THRESHOLD_CRITICAL = 15; // ≥15 point drop = critical

// GET /analytics/trends
router.get("/analytics/trends", requireAuth, async (req, res) => {
  const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
  const days      = req.query.days      ? Math.min(Number(req.query.days), 365) : 60;

  const since = new Date();
  since.setDate(since.getDate() - days);

  const conditions = [
    gte(auditRunsTable.createdAt, since),
    eq(auditRunsTable.status, "completed"),
  ];
  if (projectId) conditions.push(eq(auditRunsTable.projectId, projectId));

  const rows = await db
    .select({
      date:          sql<string>`to_char(date_trunc('day', ${auditRunsTable.createdAt}), 'YYYY-MM-DD')`,
      performance:   sql<number | null>`avg(${auditRunsTable.performanceScore})`,
      accessibility: sql<number | null>`avg(${auditRunsTable.accessibilityScore})`,
      seo:           sql<number | null>`avg(${auditRunsTable.seoScore})`,
      bestPractices: sql<number | null>`avg(${auditRunsTable.bestPracticesScore})`,
      // security: best practices proxy (no dedicated column yet)
    })
    .from(auditRunsTable)
    .where(and(...conditions))
    .groupBy(sql`date_trunc('day', ${auditRunsTable.createdAt})`)
    .orderBy(sql`date_trunc('day', ${auditRunsTable.createdAt})`);

  const points = rows.map(r => {
    const perf  = r.performance   != null ? Math.round(Number(r.performance))   : null;
    const a11y  = r.accessibility != null ? Math.round(Number(r.accessibility)) : null;
    const seo   = r.seo           != null ? Math.round(Number(r.seo))           : null;
    const sec   = r.bestPractices != null ? Math.round(Number(r.bestPractices)) : null;
    const scores = [perf, a11y, seo, sec].filter((v): v is number => v !== null);
    const health = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    return { date: r.date, performance: perf, accessibility: a11y, seo, security: sec, health };
  });

  // Regression detection — compare each day to the prior day per metric
  type RegressionEvent = {
    metric: string;
    date: string;
    previousScore: number;
    currentScore: number;
    drop: number;
    severity: "warning" | "critical";
  };
  const regressions: RegressionEvent[] = [];
  const metrics: Array<keyof typeof points[0]> = ["performance", "accessibility", "seo", "security", "health"];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    for (const metric of metrics) {
      const prevScore = prev[metric] as number | null;
      const currScore = curr[metric] as number | null;
      if (prevScore == null || currScore == null) continue;
      const drop = prevScore - currScore;
      if (drop >= REGRESSION_THRESHOLD_WARNING) {
        regressions.push({
          metric,
          date: curr.date,
          previousScore: prevScore,
          currentScore: currScore,
          drop,
          severity: drop >= REGRESSION_THRESHOLD_CRITICAL ? "critical" : "warning",
        });
      }
    }
  }

  res.json({ points, regressions });
});

export default router;
