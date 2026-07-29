import { pgTable, serial, integer, text, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const feedbackStatusEnum = pgEnum("feedback_status", [
  "new",
  "under_review",
  "accepted",
  "planned",
  "in_progress",
  "testing",
  "implemented",
  "released",
  "rejected",
]);

export const feedbackPriorityEnum = pgEnum("feedback_priority", ["critical", "high", "medium", "low"]);

export const feedbackCategoryEnum = pgEnum("feedback_category", [
  "ui_ux",
  "projects",
  "audits",
  "bug_tracker",
  "reports",
  "ai_copilot",
  "security",
  "performance",
  "api_monitoring",
  "automation",
  "accessibility",
  "integrations",
  "test_management",
  "release_readiness",
  "other",
]);

export const feedbackSuggestionsTable = pgTable("feedback_suggestions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: feedbackCategoryEnum("category").notNull().default("other"),
  priority: feedbackPriorityEnum("priority").notNull().default("medium"),
  status: feedbackStatusEnum("status").notNull().default("new"),
  affectedModule: text("affected_module"),
  businessImpact: text("business_impact"),
  expectedBenefit: text("expected_benefit"),
  browser: text("browser"),
  environment: text("environment"),
  email: text("email"),
  anonymous: boolean("anonymous").notNull().default(false),
  votes: integer("votes").notNull().default(0),
  watchers: integer("watchers").notNull().default(0),
  submittedById: integer("submitted_by_id").references(() => usersTable.id),
  assignedToId: integer("assigned_to_id").references(() => usersTable.id),
  // AI analysis fields
  aiAnalysisScore: integer("ai_analysis_score"),
  aiComplexity: text("ai_complexity"),           // low, medium, high
  aiRiskLevel: text("ai_risk_level"),            // low, medium, high, critical
  aiEstimatedEffort: text("ai_estimated_effort"), // e.g. "3-5 days"
  aiSuggestedSprint: text("ai_suggested_sprint"),
  aiSuggestedTeam: text("ai_suggested_team"),
  aiSummary: text("ai_summary"),
  aiConfidenceScore: integer("ai_confidence_score"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const feedbackCommentsTable = pgTable("feedback_comments", {
  id: serial("id").primaryKey(),
  suggestionId: integer("suggestion_id").notNull().references(() => feedbackSuggestionsTable.id, { onDelete: "cascade" }),
  authorId: integer("author_id").references(() => usersTable.id),
  content: text("content").notNull(),
  role: text("role").notNull().default("user"), // user, developer, product_owner
  parentId: integer("parent_id"),               // for replies
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const feedbackVotesTable = pgTable("feedback_votes", {
  id: serial("id").primaryKey(),
  suggestionId: integer("suggestion_id").notNull().references(() => feedbackSuggestionsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const feedbackWatchersTable = pgTable("feedback_watchers", {
  id: serial("id").primaryKey(),
  suggestionId: integer("suggestion_id").notNull().references(() => feedbackSuggestionsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type FeedbackSuggestion = typeof feedbackSuggestionsTable.$inferSelect;
export type InsertFeedbackSuggestion = typeof feedbackSuggestionsTable.$inferInsert;
export type FeedbackComment = typeof feedbackCommentsTable.$inferSelect;
export type FeedbackVote = typeof feedbackVotesTable.$inferSelect;
