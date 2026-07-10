import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const scheduleFrequencyEnum = pgEnum("schedule_frequency", ["daily", "weekly", "monthly"]);
export const scheduleStatusEnum = pgEnum("schedule_status", ["active", "paused", "disabled"]);

export const scheduledAuditsTable = pgTable("scheduled_audits", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  createdById: integer("created_by_id").references(() => usersTable.id),
  frequency: scheduleFrequencyEnum("frequency").notNull().default("weekly"),
  hour: integer("hour").notNull().default(9),
  status: scheduleStatusEnum("status").notNull().default("active"),
  nextRunAt: timestamp("next_run_at"),
  lastRunAt: timestamp("last_run_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertScheduledAuditSchema = createInsertSchema(scheduledAuditsTable).omit({ id: true, createdAt: true });
export type InsertScheduledAudit = z.infer<typeof insertScheduledAuditSchema>;
export type ScheduledAudit = typeof scheduledAuditsTable.$inferSelect;
