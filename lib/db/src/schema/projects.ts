import { pgTable, serial, text, timestamp, integer, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const environmentEnum = pgEnum("environment", ["development", "staging", "production"]);

export const auditTemplateEnum = pgEnum("audit_template", [
  "react", "vite", "nextjs", "wordpress", "shopify", "laravel", "nodejs_api", "static", "custom"
]);

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  environment: environmentEnum("environment").notNull().default("development"),
  description: text("description"),
  auditTemplate: auditTemplateEnum("audit_template").notNull().default("custom"),
  techProfile: jsonb("tech_profile"),
  createdById: integer("created_by_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
