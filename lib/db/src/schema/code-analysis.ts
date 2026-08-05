import { pgTable, serial, integer, text, timestamp, pgEnum, jsonb, real } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const codeAnalysisStatusEnum = pgEnum("code_analysis_status", ["pending", "running", "completed", "failed"]);
export const codeAnalysisSourceTypeEnum = pgEnum("code_analysis_source_type", ["zip", "github"]);

export interface CodeIssue {
  file: string;
  line: number;
  column: number;
  rule: string | null;
  severity: "error" | "warning" | "suggestion";
  message: string;
  aiExplanation: string;
  aiFixSuggestion: string;
  codeContext: string;
  contextStartLine: number;
}

export const codeAnalysisJobsTable = pgTable("code_analysis_jobs", {
  id: serial("id").primaryKey(),
  createdById: integer("created_by_id").references(() => usersTable.id),
  name: text("name").notNull(),
  sourceType: codeAnalysisSourceTypeEnum("source_type").notNull(),
  sourceUrl: text("source_url"),
  status: codeAnalysisStatusEnum("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  overallScore: real("overall_score"),
  errorCount: integer("error_count").notNull().default(0),
  warningCount: integer("warning_count").notNull().default(0),
  suggestionCount: integer("suggestion_count").notNull().default(0),
  filesAnalyzed: integer("files_analyzed").notNull().default(0),
  issues: jsonb("issues").$type<CodeIssue[]>(),
  pdfUrl: text("pdf_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export type CodeAnalysisJob = typeof codeAnalysisJobsTable.$inferSelect;
