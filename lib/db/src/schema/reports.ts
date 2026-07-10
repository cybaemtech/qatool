import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { auditRunsTable } from "./audits";

export const reportStatusEnum = pgEnum("report_status", ["generating", "ready", "failed"]);

export const reportsTable = pgTable("reports", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  auditRunId: integer("audit_run_id").notNull().references(() => auditRunsTable.id, { onDelete: "cascade" }),
  status: reportStatusEnum("status").notNull().default("generating"),
  fileUrl: text("file_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertReportSchema = createInsertSchema(reportsTable).omit({ id: true, createdAt: true });
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reportsTable.$inferSelect;
