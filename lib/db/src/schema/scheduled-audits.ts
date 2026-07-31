import { pgTable, serial, integer, text, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const scheduleFrequencyEnum = pgEnum("schedule_frequency", ["daily", "weekly", "monthly", "custom"]);
export const scheduleStatusEnum   = pgEnum("schedule_status",    ["active", "paused", "disabled"]);
export const repeatModeEnum       = pgEnum("repeat_mode",        ["forever", "once", "until"]);

export const scheduledAuditsTable = pgTable("scheduled_audits", {
  id:             serial("id").primaryKey(),
  name:           text("name").notNull(),
  projectId:      integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  createdById:    integer("created_by_id").references(() => usersTable.id),
  frequency:      scheduleFrequencyEnum("frequency").notNull().default("weekly"),
  // Hour (0-23) for simple daily/weekly/monthly schedules
  hour:           integer("hour").notNull().default(9),
  // Optional day-of-week (0=Sun, 6=Sat) for weekly; day-of-month (1-31) for monthly
  dayOfWeek:      integer("day_of_week"),
  dayOfMonth:     integer("day_of_month"),
  // Custom cron expression (overrides frequency/hour/day fields when set)
  cronExpression: text("cron_expression"),
  // Timezone in IANA format (e.g. "America/New_York", "UTC")
  timezone:       text("timezone").notNull().default("UTC"),
  // Repeat behaviour
  repeatMode:     repeatModeEnum("repeat_mode").notNull().default("forever"),
  endDate:        timestamp("end_date"),
  maxRuns:        integer("max_runs"),   // for repeat-count mode (not in spec but useful)
  // Execution tracking
  status:         scheduleStatusEnum("status").notNull().default("active"),
  nextRunAt:      timestamp("next_run_at"),
  lastRunAt:      timestamp("last_run_at"),
  runCount:       integer("run_count").notNull().default(0),
  enabled:        boolean("enabled").notNull().default(true),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
});

export const insertScheduledAuditSchema = createInsertSchema(scheduledAuditsTable).omit({ id: true, createdAt: true, runCount: true });
export type InsertScheduledAudit = z.infer<typeof insertScheduledAuditSchema>;
export type ScheduledAudit = typeof scheduledAuditsTable.$inferSelect;
