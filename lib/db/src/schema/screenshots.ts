import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { auditRunsTable } from "./audits";

export const deviceTypeEnum = pgEnum("device_type", ["desktop", "tablet", "mobile"]);

export const screenshotsTable = pgTable("screenshots", {
  id: serial("id").primaryKey(),
  auditRunId: integer("audit_run_id").notNull().references(() => auditRunsTable.id, { onDelete: "cascade" }),
  deviceType: deviceTypeEnum("device_type").notNull(),
  dataUrl: text("data_url").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertScreenshotSchema = createInsertSchema(screenshotsTable).omit({ id: true, createdAt: true });
export type InsertScreenshot = z.infer<typeof insertScreenshotSchema>;
export type Screenshot = typeof screenshotsTable.$inferSelect;
