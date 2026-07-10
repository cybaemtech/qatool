import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { auditRunsTable } from "./audits";
import { usersTable } from "./users";

export const bugSeverityEnum = pgEnum("bug_severity", ["critical", "high", "medium", "low"]);
export const bugStatusEnum = pgEnum("bug_status", ["open", "in_progress", "resolved", "ignored"]);
export const bugPriorityEnum = pgEnum("bug_priority", ["critical", "high", "medium", "low"]);

export const bugsTable = pgTable("bugs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  auditRunId: integer("audit_run_id").notNull().references(() => auditRunsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  severity: bugSeverityEnum("severity").notNull().default("medium"),
  status: bugStatusEnum("status").notNull().default("open"),
  priority: bugPriorityEnum("priority").notNull().default("medium"),
  assignedToId: integer("assigned_to_id").references(() => usersTable.id),
  dueDate: timestamp("due_date"),
  resolutionNotes: text("resolution_notes"),
  screenshotUrl: text("screenshot_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBugSchema = createInsertSchema(bugsTable).omit({ id: true, createdAt: true });
export type InsertBug = z.infer<typeof insertBugSchema>;
export type Bug = typeof bugsTable.$inferSelect;
