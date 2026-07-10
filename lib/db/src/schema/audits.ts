import { pgTable, serial, integer, timestamp, text, real, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const auditStatusEnum = pgEnum("audit_status", ["pending", "running", "completed", "failed", "cancelled"]);

export const auditRunsTable = pgTable("audit_runs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  createdById: integer("created_by_id").references(() => usersTable.id),
  status: auditStatusEnum("status").notNull().default("pending"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),
  overallScore: real("overall_score"),
  bugsFound: integer("bugs_found").notNull().default(0),
  performanceScore: real("performance_score"),
  accessibilityScore: real("accessibility_score"),
  seoScore: real("seo_score"),
  bestPracticesScore: real("best_practices_score"),
  findings: jsonb("findings"),
  aiSummary: text("ai_summary"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAuditRunSchema = createInsertSchema(auditRunsTable).omit({ id: true, createdAt: true });
export type InsertAuditRun = z.infer<typeof insertAuditRunSchema>;
export type AuditRun = typeof auditRunsTable.$inferSelect;
