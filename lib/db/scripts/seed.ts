/**
 * Seeds the database with a realistic, fully-interconnected demo dataset for the
 * QA Automation Portal, so every page (Dashboard, Projects, Audit Detail, Bug
 * Tracker, Reports, AI Analysis) has believable data to demo without running a
 * real audit.
 *
 * Usage: pnpm --filter @workspace/db run seed
 */
import { db, pool } from "../src/index";
import {
  usersTable,
  projectsTable,
  auditRunsTable,
  bugsTable,
  bugCommentsTable,
  screenshotsTable,
  reportsTable,
  notificationsTable,
  scheduledAuditsTable,
} from "../src/schema";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PLACEHOLDER_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function daysAgo(n: number, hour = 9, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function assertSafeToSeed() {
  const url = process.env.DATABASE_URL ?? "";
  const isProd = process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1";
  const looksProdHost = /\bprod(uction)?\b/i.test(url);
  if (isProd || looksProdHost) {
    if (process.env.ALLOW_DB_SEED !== "true") {
      throw new Error(
        "Refusing to run the destructive demo seed against what looks like a production database " +
        "(NODE_ENV=production, REPLIT_DEPLOYMENT=1, or a 'prod' hostname in DATABASE_URL). " +
        "If you are certain this is a disposable/dev database, re-run with ALLOW_DB_SEED=true."
      );
    }
  }
}

async function main() {
  assertSafeToSeed();
  console.log("Seeding QA Automation Portal demo data...");

  // Reset everything so re-running the script produces a consistent dataset.
  await db.execute(sql`TRUNCATE TABLE
    bug_comments, screenshots, reports, notifications, scheduled_audits,
    bugs, audit_runs, projects, users
    RESTART IDENTITY CASCADE`);

  // ── Users ────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("password", 10);
  const [admin, sarah, marcus, priya] = await db
    .insert(usersTable)
    .values([
      { email: "admin@qa.dev", name: "Alex Rivera", passwordHash, role: "admin" },
      { email: "sarah.chen@qa.dev", name: "Sarah Chen", passwordHash, role: "tester" },
      { email: "marcus.johnson@qa.dev", name: "Marcus Johnson", passwordHash, role: "tester" },
      { email: "priya.patel@qa.dev", name: "Priya Patel", passwordHash, role: "tester" },
    ])
    .returning();
  const testers = [sarah, marcus, priya];
  console.log(`Created ${4} users`);

  // ── Projects ─────────────────────────────────────────────────────────────
  const projectSeeds = [
    {
      name: "Horizon Retail Storefront",
      url: "https://horizon-retail-demo.myshopify.com",
      environment: "production" as const,
      description: "Flagship e-commerce storefront handling checkout, promotions, and product discovery for Horizon Retail.",
      auditTemplate: "shopify" as const,
      techProfile: { framework: "Shopify Liquid", frontendStack: "Liquid, Tailwind CSS, Alpine.js", backendStack: "Shopify managed", cms: "Shopify", database: "Shopify managed", notes: "PCI-DSS scope; checkout flow is out of bounds for automated form submission." },
      createdById: admin.id,
    },
    {
      name: "Northwind Admin Console",
      url: "https://admin.northwind.io",
      environment: "production" as const,
      description: "Internal operations dashboard used by fulfillment and support teams to manage orders and inventory.",
      auditTemplate: "react" as const,
      techProfile: { framework: "React 18", frontendStack: "React, Vite, TanStack Query", backendStack: "Node.js, Express, PostgreSQL", cms: null, database: "PostgreSQL 15", notes: "SSO-gated behind Okta; audits run against a seeded staging tenant." },
      createdById: admin.id,
    },
    {
      name: "Vertex API Gateway",
      url: "https://api-staging.vertexcloud.io",
      environment: "staging" as const,
      description: "Public-facing API gateway and developer docs portal for the Vertex Cloud platform.",
      auditTemplate: "nodejs_api" as const,
      techProfile: { framework: "Express", frontendStack: "Docusaurus (docs portal)", backendStack: "Node.js, Express, Redis, Kong", cms: null, database: "Redis + PostgreSQL", notes: "Rate-limited; audits should throttle requests to avoid tripping WAF rules." },
      createdById: sarah.id,
    },
    {
      name: "Lumen Marketing Site",
      url: "https://www.lumenlabs.io",
      environment: "production" as const,
      description: "Public marketing site and blog driving inbound leads for Lumen Labs' SaaS product.",
      auditTemplate: "nextjs" as const,
      techProfile: { framework: "Next.js 14", frontendStack: "Next.js, Tailwind CSS, Framer Motion", backendStack: "Vercel Edge Functions", cms: "Sanity", database: "Sanity Content Lake", notes: "Heavy use of client-side animation; watch for CLS regressions." },
      createdById: marcus.id,
    },
    {
      name: "Internal Knowledge Base",
      url: "https://wiki-dev.internal.acmecorp.com",
      environment: "development" as const,
      description: "Employee-facing knowledge base and onboarding documentation, still under active migration.",
      auditTemplate: "wordpress" as const,
      techProfile: { framework: "WordPress 6", frontendStack: "WordPress theme (custom child theme)", backendStack: "PHP 8.2, WordPress core", cms: "WordPress", database: "MySQL 8", notes: "Migrating from Confluence; several legacy pages still contain broken internal links." },
      createdById: priya.id,
    },
  ];

  const projects = await db.insert(projectsTable).values(projectSeeds).returning();
  console.log(`Created ${projects.length} projects`);

  // ── Audit runs, bugs, screenshots ───────────────────────────────────────
  const bugCatalog: Record<string, Array<{ title: string; description: string; severity: "critical" | "high" | "medium" | "low" }>> = {
    performance: [
      { title: "Largest Contentful Paint exceeds 4s on homepage", description: "Hero image is served unoptimized (2.4MB JPEG) and blocks LCP. Recommend WebP conversion and lazy-loading below-the-fold assets.", severity: "high" },
      { title: "Render-blocking JavaScript delays first paint", description: "Three third-party analytics scripts are loaded synchronously in <head>, delaying first contentful paint by ~800ms.", severity: "medium" },
      { title: "Unminified bundle shipped to production", description: "Main JS bundle (1.8MB) is not minified or tree-shaken, inflating time-to-interactive on mobile connections.", severity: "medium" },
    ],
    accessibility: [
      { title: "Insufficient color contrast on primary CTA buttons", description: "Primary button text (#FFFFFF on #6C7CFF) has a contrast ratio of 3.1:1, below the WCAG AA 4.5:1 requirement.", severity: "medium" },
      { title: "Missing alt text on product imagery", description: "14 of 22 scanned images lack descriptive alt attributes, blocking screen reader users from understanding content.", severity: "low" },
      { title: "Form inputs missing associated labels", description: "Newsletter signup and search inputs rely on placeholder text only; no <label> or aria-label is present.", severity: "high" },
    ],
    seo: [
      { title: "Missing meta description on key landing pages", description: "Pricing and Features pages have no meta description, reducing click-through rate from search results.", severity: "low" },
      { title: "Duplicate H1 tags on category pages", description: "Category listing template renders two <h1> elements per page, diluting keyword relevance signals.", severity: "medium" },
      { title: "Canonical URLs missing on paginated listings", description: "Paginated product listing pages (?page=2, ?page=3) lack rel=canonical, risking duplicate content penalties.", severity: "low" },
    ],
    functional: [
      { title: "JavaScript runtime error on checkout step 2", description: "Uncaught TypeError: Cannot read properties of null (reading 'value') thrown when the shipping form mounts without a pre-selected country.", severity: "critical" },
      { title: "Broken internal link in footer navigation", description: "Footer 'Careers' link points to /careers-old, which returns a 404 Not Found.", severity: "medium" },
      { title: "API request failure on dashboard load", description: "GET /api/v1/summary intermittently returns 500 Internal Server Error under concurrent load, leaving widgets stuck in a loading state.", severity: "critical" },
      { title: "Search autocomplete fails to debounce", description: "Search-as-you-type fires a network request on every keystroke instead of debouncing, causing visible request storms in the network tab.", severity: "low" },
      { title: "Session expires without warning during checkout", description: "Users are silently logged out mid-checkout after 15 minutes of inactivity, losing cart contents with no warning modal.", severity: "high" },
    ],
    security: [
      { title: "Missing Content-Security-Policy header", description: "Response headers do not include a CSP, leaving the site more exposed to reflected XSS via third-party scripts.", severity: "medium" },
      { title: "Outdated jQuery dependency with known CVEs", description: "jQuery 1.11.3 is still bundled and referenced; multiple public CVEs exist for prototype pollution and XSS.", severity: "high" },
    ],
  };

  const auditStatusPlan: Array<{ offsetDays: number; status: "completed" | "completed" | "completed" | "failed" | "cancelled"; trendBias: number }> = [];
  // We'll generate a schedule per project below with a slight upward score trend over time.

  const AI_SUMMARY_TEMPLATES = (score: number, bugCount: number, projectName: string) => {
    if (score >= 88) {
      return `${projectName} is in excellent health with an overall score of ${score}/100. ${bugCount} minor issue${bugCount === 1 ? "" : "s"} detected, none blocking release. Continue current monitoring cadence.`;
    }
    if (score >= 72) {
      return `${projectName} scored ${score}/100 overall. ${bugCount} issue${bugCount === 1 ? "" : "s"} identified, primarily around performance and accessibility. Recommend addressing high-priority items before the next release.`;
    }
    return `${projectName} scored ${score}/100, below the acceptable quality threshold. ${bugCount} issue${bugCount === 1 ? "" : "s"} found, including critical functional defects. Immediate remediation recommended before this build ships to production.`;
  };

  let totalAudits = 0;
  let totalBugs = 0;
  let totalReports = 0;
  const notificationRows: Array<typeof notificationsTable.$inferInsert> = [];

  for (const project of projects) {
    const runCount = 5 + Math.floor(Math.random() * 3); // 5-7 audits per project
    // Spread runs across the last 28 days, most recent last.
    const offsets = Array.from({ length: runCount }, (_, i) => Math.round((runCount - 1 - i) * (28 / (runCount - 1 || 1))));

    for (let i = 0; i < offsets.length; i++) {
      const offsetDays = offsets[i];
      const isLatest = i === offsets.length - 1;
      const progress = i / Math.max(1, offsets.length - 1); // 0 -> 1, older -> newer
      const base = 58 + progress * 22; // trend upward over time

      // Occasionally seed a failed or cancelled run for realism (not the very first or very last).
      let status: "completed" | "failed" | "cancelled" = "completed";
      if (i > 0 && i < offsets.length - 1 && Math.random() < 0.15) {
        status = Math.random() < 0.6 ? "failed" : "cancelled";
      }

      const startedAt = daysAgo(offsetDays, 8 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60));
      const durationMs = 3200 + Math.floor(Math.random() * 5200);
      const completedAt = status === "cancelled"
        ? new Date(startedAt.getTime() + 1200 + Math.floor(Math.random() * 800))
        : new Date(startedAt.getTime() + durationMs);

      let performanceScore: number | null = null;
      let accessibilityScore: number | null = null;
      let seoScore: number | null = null;
      let bestPracticesScore: number | null = null;
      let overallScore: number | null = null;
      let findings: Record<string, unknown> | null = null;
      let aiSummary: string | null = null;
      let bugsToCreate: Array<{ title: string; description: string; severity: "critical" | "high" | "medium" | "low" }> = [];

      if (status === "completed") {
        performanceScore = round1(Math.min(98, Math.max(35, base + (Math.random() * 14 - 7))));
        accessibilityScore = round1(Math.min(98, Math.max(40, base + 6 + (Math.random() * 12 - 6))));
        seoScore = round1(Math.min(99, Math.max(45, base + 4 + (Math.random() * 12 - 6))));
        bestPracticesScore = round1(Math.min(97, Math.max(42, base + 2 + (Math.random() * 12 - 6))));
        overallScore = round1((performanceScore + accessibilityScore + seoScore + bestPracticesScore) / 4);

        const pool: Array<{ title: string; description: string; severity: "critical" | "high" | "medium" | "low" }> = [];
        if (performanceScore < 78) pool.push(...bugCatalog.performance);
        if (accessibilityScore < 82) pool.push(...bugCatalog.accessibility);
        if (seoScore < 80) pool.push(...bugCatalog.seo);
        if (bestPracticesScore < 78) pool.push(...bugCatalog.security);
        if (overallScore < 75 || Math.random() < 0.4) pool.push(...bugCatalog.functional);

        const bugCount = Math.min(pool.length, Math.max(0, Math.round((100 - overallScore) / 12) + (Math.random() < 0.3 ? 1 : 0)));
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        bugsToCreate = shuffled.slice(0, bugCount);

        findings = {
          homepageLoaded: true,
          consoleErrors: bugsToCreate.some(b => b.title.includes("runtime error")) ? ["Uncaught TypeError: Cannot read properties of null (reading 'value')"] : [],
          failedRequests: bugsToCreate.some(b => b.title.includes("API request failure")) ? ["/api/v1/summary"] : [],
          brokenLinks: bugsToCreate.some(b => b.title.includes("Broken internal link")) ? [`${project.url}/careers-old`] : [],
          formIssues: bugsToCreate.some(b => b.title.includes("Session expires")) ? ["Checkout session timeout without warning"] : [],
          networkErrors: [],
          navigationChecked: true,
          responsiveness: { desktop: true, tablet: true, mobile: performanceScore > 55 },
        };
        aiSummary = AI_SUMMARY_TEMPLATES(overallScore, bugsToCreate.length, project.name);
      } else if (status === "failed") {
        findings = {
          homepageLoaded: false,
          consoleErrors: ["Navigation timeout of 30000 ms exceeded"],
          failedRequests: [project.url],
          brokenLinks: [],
          formIssues: [],
          networkErrors: ["ERR_CONNECTION_TIMED_OUT"],
          navigationChecked: false,
          responsiveness: { desktop: false, tablet: false, mobile: false },
        };
        aiSummary = `Audit could not complete: the target environment did not respond within the navigation timeout. Verify ${project.url} is reachable and not blocked by authentication or a maintenance page.`;
      }

      const [run] = await db.insert(auditRunsTable).values({
        projectId: project.id,
        createdById: pick([admin, ...testers]).id,
        status,
        startedAt,
        completedAt,
        durationMs: status === "cancelled" ? Math.round((completedAt.getTime() - startedAt.getTime())) : durationMs,
        overallScore,
        bugsFound: bugsToCreate.length,
        performanceScore,
        accessibilityScore,
        seoScore,
        bestPracticesScore,
        findings,
        aiSummary,
        createdAt: startedAt,
      }).returning();
      totalAudits++;


      // Bugs tied to this run.
      const createdBugs = [];
      for (const b of bugsToCreate) {
        const resolved = !isLatest && Math.random() < 0.45;
        const inProgress = !resolved && Math.random() < 0.3;
        const bugStatus: "open" | "in_progress" | "resolved" | "ignored" = resolved ? "resolved" : inProgress ? "in_progress" : Math.random() < 0.08 ? "ignored" : "open";
        const priority = b.severity === "critical" ? "critical" : b.severity === "high" ? "high" : b.severity === "medium" ? "medium" : "low";
        const assignedTo = pick(testers);
        const dueDate = bugStatus === "resolved" ? null : new Date(completedAt.getTime() + (2 + Math.floor(Math.random() * 10)) * 24 * 60 * 60 * 1000);

        const [bug] = await db.insert(bugsTable).values({
          projectId: project.id,
          auditRunId: run.id,
          title: b.title,
          description: b.description,
          severity: b.severity,
          status: bugStatus,
          priority,
          assignedToId: assignedTo.id,
          dueDate,
          resolutionNotes: bugStatus === "resolved" ? pick([
            "Fixed and verified in the next deploy; regression test added to the CI suite.",
            "Patched via hotfix; confirmed resolved on re-audit.",
            "Root cause addressed upstream; monitoring for recurrence.",
          ]) : null,
          screenshotUrl: PLACEHOLDER_PNG,
          createdAt: completedAt,
        }).returning();
        createdBugs.push({ bug, assignedTo });
        totalBugs++;
      }

      // A couple of bug comments on a subset of bugs, for a lived-in feel.
      for (const { bug, assignedTo } of createdBugs) {
        if (Math.random() < 0.5) {
          const commenters = [admin, assignedTo].filter((u, idx, arr) => arr.findIndex(x => x.id === u.id) === idx);
          const thread = [
            { user: commenters[0], content: pick([
              "Can you confirm this is reproducible on the latest deploy, or is it environment-specific?",
              "Flagging this as blocking for the release checklist — please prioritize.",
              "Nice catch. Let's get this into the current sprint.",
            ]) },
          ];
          if (bug.status === "resolved" || bug.status === "in_progress") {
            thread.push({ user: assignedTo, content: pick([
              "Confirmed and reproduced locally. Working on a fix now.",
              "Root-caused this to a missing null check — patch is up for review.",
              "Verified the fix against staging; closing this out.",
            ]) });
          }
          let ts = new Date(bug.createdAt.getTime() + 60 * 60 * 1000);
          for (const t of thread) {
            await db.insert(bugCommentsTable).values({ bugId: bug.id, userId: t.user.id, content: t.content, createdAt: ts });
            ts = new Date(ts.getTime() + 3 * 60 * 60 * 1000);
          }
        }
      }

      // Reports for most completed audits.
      if (status === "completed" && Math.random() < 0.7) {
        const [report] = await db.insert(reportsTable).values({
          projectId: project.id,
          auditRunId: run.id,
          status: "generating",
          createdAt: completedAt,
        }).returning();

        const reportsDir = path.resolve(__dirname, "../../../artifacts/api-server/reports");
        if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
        const fileName = `report-${report.id}-${completedAt.getTime()}.txt`;
        const filePath = path.join(reportsDir, fileName);
        const content = `
QA AUTOMATION PORTAL - AUDIT REPORT
====================================

Report ID: ${report.id}
Project: ${project.name}
Audit Run ID: ${run.id}
Generated: ${completedAt.toISOString()}

LIGHTHOUSE SCORES
-----------------
Performance:     ${performanceScore ?? "N/A"}/100
Accessibility:   ${accessibilityScore ?? "N/A"}/100
SEO:             ${seoScore ?? "N/A"}/100
Best Practices:  ${bestPracticesScore ?? "N/A"}/100
Overall Score:   ${overallScore ?? "N/A"}/100

SUMMARY
-------
Total Bugs Found: ${bugsToCreate.length}
Duration: ${durationMs ? `${Math.round(durationMs / 1000)}s` : "N/A"}
Completed: ${completedAt.toISOString()}

BUGS FOUND
----------
${bugsToCreate.length === 0 ? "No bugs found." : bugsToCreate.map((b, idx) => `
${idx + 1}. [${b.severity.toUpperCase()}] ${b.title}
   ${b.description}
`).join("\n")}

SEVERITY BREAKDOWN
------------------
Critical: ${bugsToCreate.filter(b => b.severity === "critical").length}
High:     ${bugsToCreate.filter(b => b.severity === "high").length}
Medium:   ${bugsToCreate.filter(b => b.severity === "medium").length}
Low:      ${bugsToCreate.filter(b => b.severity === "low").length}

Report generated by QA Automation Portal
`;
        fs.writeFileSync(filePath, content, "utf-8");
        await db.update(reportsTable).set({ status: "ready", fileUrl: `/api/reports/download/${fileName}` }).where(sql`${reportsTable.id} = ${report.id}`);
        totalReports++;
      }

      // Notifications for completed/failed runs, and for any critical bugs.
      if (status === "completed") {
        notificationRows.push({
          userId: pick([admin, ...testers]).id,
          type: "audit_completed",
          title: `Audit completed for ${project.name}`,
          message: `Overall score: ${overallScore}/100 with ${bugsToCreate.length} issue${bugsToCreate.length === 1 ? "" : "s"} found.`,
          read: !isLatest,
          relatedId: run.id,
          relatedType: "audit_run",
          createdAt: completedAt,
        });
        const criticalBug = createdBugs.find(c => c.bug.severity === "critical");
        if (criticalBug) {
          notificationRows.push({
            userId: admin.id,
            type: "critical_issue",
            title: `Critical issue found in ${project.name}`,
            message: criticalBug.bug.title,
            read: !isLatest,
            relatedId: criticalBug.bug.id,
            relatedType: "bug",
            createdAt: new Date(completedAt.getTime() + 5 * 60 * 1000),
          });
          notificationRows.push({
            userId: criticalBug.assignedTo.id,
            type: "bug_assigned",
            title: `Bug assigned to you`,
            message: `${criticalBug.bug.title} (${project.name}) has been assigned to you.`,
            read: !isLatest,
            relatedId: criticalBug.bug.id,
            relatedType: "bug",
            createdAt: new Date(completedAt.getTime() + 10 * 60 * 1000),
          });
        }
      } else if (status === "failed") {
        notificationRows.push({
          userId: admin.id,
          type: "audit_failed",
          title: `Audit failed for ${project.name}`,
          message: `The audit run could not complete — ${project.url} did not respond in time.`,
          read: !isLatest,
          relatedId: run.id,
          relatedType: "audit_run",
          createdAt: completedAt,
        });
      }
    }

    // A "project added" notification, dated before its first audit.
    notificationRows.push({
      userId: project.createdById,
      type: "project_added",
      title: `Project created: ${project.name}`,
      message: `${project.name} was added to the QA Automation Portal.`,
      read: true,
      relatedId: project.id,
      relatedType: "project",
      createdAt: daysAgo(29),
    });
  }

  if (notificationRows.length > 0) {
    await db.insert(notificationsTable).values(notificationRows);
  }
  console.log(`Created ${totalAudits} audit runs, ${totalBugs} bugs, ${totalReports} reports, ${notificationRows.length} notifications`);

  // ── Scheduled audits ────────────────────────────────────────────────────
  await db.insert(scheduledAuditsTable).values([
    {
      name: "Nightly Storefront Health Check",
      projectId: projects[0].id,
      createdById: admin.id,
      frequency: "daily",
      hour: 3,
      status: "active",
      nextRunAt: (() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(3, 0, 0, 0); return d; })(),
      lastRunAt: daysAgo(1, 3),
    },
    {
      name: "Weekly Admin Console Regression",
      projectId: projects[1].id,
      createdById: sarah.id,
      frequency: "weekly",
      hour: 6,
      status: "active",
      nextRunAt: (() => { const d = new Date(); d.setDate(d.getDate() + 4); d.setHours(6, 0, 0, 0); return d; })(),
      lastRunAt: daysAgo(3, 6),
    },
    {
      name: "Monthly Marketing Site Audit",
      projectId: projects[3].id,
      createdById: marcus.id,
      frequency: "monthly",
      hour: 9,
      status: "paused",
      nextRunAt: null,
      lastRunAt: daysAgo(14, 9),
    },
  ]);
  console.log("Created 3 scheduled audits");

  console.log("\nSeed complete. Demo login: admin@qa.dev / password (also sarah.chen@qa.dev, marcus.johnson@qa.dev, priya.patel@qa.dev / password)");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
