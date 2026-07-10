import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { bugsTable } from "./bugs";
import { usersTable } from "./users";

export const bugCommentsTable = pgTable("bug_comments", {
  id: serial("id").primaryKey(),
  bugId: integer("bug_id").notNull().references(() => bugsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBugCommentSchema = createInsertSchema(bugCommentsTable).omit({ id: true, createdAt: true });
export type InsertBugComment = z.infer<typeof insertBugCommentSchema>;
export type BugComment = typeof bugCommentsTable.$inferSelect;
