import { pgTable, serial, integer, text, timestamp, pgEnum, jsonb, real, boolean } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";
import { auditRunsTable } from "./audits";

export const crawlJobStatusEnum = pgEnum("crawl_job_status", ["pending", "running", "completed", "failed", "cancelled"]);
export const crawlPageStatusEnum = pgEnum("crawl_page_status", ["pending", "running", "completed", "failed", "skipped"]);

// ─── Crawl Job ────────────────────────────────────────────────────────────────
// One crawl job = crawl session for an entire site or portion of a site.

export const crawlJobsTable = pgTable("crawl_jobs", {
  id:                serial("id").primaryKey(),
  projectId:         integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  createdById:       integer("created_by_id").references(() => usersTable.id),
  // Target
  startUrl:          text("start_url").notNull(),
  // Crawl settings
  maxPages:          integer("max_pages").notNull().default(50),
  maxDepth:          integer("max_depth").notNull().default(3),
  ignorePatterns:    jsonb("ignore_patterns").$type<string[]>().default([]),
  includePatterns:   jsonb("include_patterns").$type<string[]>().default([]),
  respectRobotsTxt:  boolean("respect_robots_txt").notNull().default(true),
  discoverSitemap:   boolean("discover_sitemap").notNull().default(true),
  // Status
  status:            crawlJobStatusEnum("status").notNull().default("pending"),
  startedAt:         timestamp("started_at"),
  completedAt:       timestamp("completed_at"),
  errorMessage:      text("error_message"),
  // Aggregates (computed after completion)
  pagesDiscovered:   integer("pages_discovered").notNull().default(0),
  pagesAudited:      integer("pages_audited").notNull().default(0),
  pagesFailed:       integer("pages_failed").notNull().default(0),
  overallScore:      real("overall_score"),
  avgPerformance:    real("avg_performance"),
  avgAccessibility:  real("avg_accessibility"),
  avgSeo:            real("avg_seo"),
  avgSecurity:       real("avg_security"),
  createdAt:         timestamp("created_at").notNull().defaultNow(),
});

// ─── Crawl Page ───────────────────────────────────────────────────────────────
// One row per page discovered and audited during a crawl job.

export const crawlPagesTable = pgTable("crawl_pages", {
  id:              serial("id").primaryKey(),
  crawlJobId:      integer("crawl_job_id").notNull().references(() => crawlJobsTable.id, { onDelete: "cascade" }),
  url:             text("url").notNull(),
  depth:           integer("depth").notNull().default(0),
  // The audit run that scored this page (null if audit failed or page was skipped)
  auditRunId:      integer("audit_run_id").references(() => auditRunsTable.id, { onDelete: "set null" }),
  status:          crawlPageStatusEnum("status").notNull().default("pending"),
  errorMessage:    text("error_message"),
  // SEO metadata extracted
  pageTitle:       text("page_title"),
  metaDescription: text("meta_description"),
  h1Count:         integer("h1_count"),
  // Scores (copied from audit run for quick queries)
  overallScore:    real("overall_score"),
  performanceScore: real("performance_score"),
  accessibilityScore: real("accessibility_score"),
  seoScore:        real("seo_score"),
  securityScore:   real("security_score"),
  // Size
  pageSizeBytes:   integer("page_size_bytes"),
  // Timing
  startedAt:       timestamp("started_at"),
  completedAt:     timestamp("completed_at"),
  createdAt:       timestamp("created_at").notNull().defaultNow(),
});

export type CrawlJob  = typeof crawlJobsTable.$inferSelect;
export type CrawlPage = typeof crawlPagesTable.$inferSelect;
