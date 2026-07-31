// ─── Feedback & Ideas API Routes ─────────────────────────────────────────────

import { Router } from "express";
import { db } from "@workspace/db";
import {
  feedbackSuggestionsTable,
  feedbackCommentsTable,
  feedbackVotesTable,
  feedbackWatchersTable,
  usersTable,
} from "@workspace/db";
import { eq, desc, count, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
const router = Router();

// ─── Validation helpers ───────────────────────────────────────────────────────

const VALID_CATEGORIES = new Set(["ui_ux","projects","audits","bug_tracker","reports","ai_copilot","security","performance","api_monitoring","automation","accessibility","integrations","test_management","release_readiness","other"]);
const VALID_PRIORITIES = new Set(["critical","high","medium","low"]);
const VALID_STATUSES = new Set(["new","under_review","accepted","planned","in_progress","testing","implemented","released","rejected"]);

function parseCreateSuggestion(body: Record<string, unknown>) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!title || title.length < 5) return { error: "title must be at least 5 characters" };
  if (!description || description.length < 10) return { error: "description must be at least 10 characters" };
  return {
    data: {
      title,
      description,
      category: (VALID_CATEGORIES.has(body.category as string) ? body.category : "other") as string,
      priority: (VALID_PRIORITIES.has(body.priority as string) ? body.priority : "medium") as string,
      affectedModule: typeof body.affectedModule === "string" ? body.affectedModule : undefined,
      businessImpact: typeof body.businessImpact === "string" ? body.businessImpact : undefined,
      expectedBenefit: typeof body.expectedBenefit === "string" ? body.expectedBenefit : undefined,
      browser: typeof body.browser === "string" ? body.browser : undefined,
      environment: typeof body.environment === "string" ? body.environment : undefined,
      email: typeof body.email === "string" && body.email ? body.email : null,
      anonymous: body.anonymous === true,
    },
  };
}

function parseUpdateSuggestion(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!VALID_STATUSES.has(body.status as string)) return { error: "invalid status" };
    data.status = body.status;
  }
  if (body.priority !== undefined) {
    if (!VALID_PRIORITIES.has(body.priority as string)) return { error: "invalid priority" };
    data.priority = body.priority;
  }
  if (body.assignedToId !== undefined) {
    data.assignedToId = body.assignedToId === null ? null : Number(body.assignedToId);
  }
  return { data };
}

// ─── AI Analysis (mock) ───────────────────────────────────────────────────────

function generateAIAnalysis(title: string, description: string, category: string) {
  // All values are derived deterministically from keywords — no Math.random().
  const words = (title + " " + description).toLowerCase();
  const isSecurity = words.includes("security") || words.includes("auth") || words.includes("vulnerability");
  const isPerf = words.includes("performance") || words.includes("slow") || words.includes("speed");
  const isUI = words.includes("ui") || words.includes("design") || words.includes("button") || words.includes("page");
  const isAPI = words.includes("api") || words.includes("endpoint") || words.includes("integration");
  const isBug = words.includes("bug") || words.includes("error") || words.includes("crash") || words.includes("broken");

  const complexity = isSecurity || isAPI ? "high" : isUI ? "low" : "medium";
  const risk = isSecurity ? "critical" : isPerf || isBug ? "high" : isAPI ? "medium" : "low";
  const effort =
    complexity === "high" ? "2-4 weeks" :
    complexity === "medium" ? "1-2 weeks" :
    "1-2 days";
  const team =
    isSecurity ? "Platform" :
    isUI ? "Frontend" :
    isAPI ? "Backend" :
    isPerf ? "Full Stack" :
    "QA";
  const sprint =
    risk === "critical" ? "Sprint 1" :
    risk === "high" ? "Sprint 2" :
    "Sprint 3";
  // Score reflects anticipated impact based on keyword signals
  const score =
    isSecurity ? 62 :
    isPerf ? 74 :
    isUI ? 80 :
    isAPI ? 68 :
    isBug ? 70 :
    65;
  // Confidence is higher when we have clear keyword signals
  const confidence = (isSecurity || isPerf || isUI || isAPI || isBug) ? 88 : 75;

  const summary = `This ${category.replace("_", " ")} improvement has ${complexity} implementation complexity with ${risk} risk. ${
    isSecurity ? "Security-related changes require thorough review and testing." :
    isPerf ? "Performance improvements can significantly impact user experience metrics." :
    isUI ? "UI changes should be validated with user testing before release." :
    "Standard feature implementation with no unusual dependencies."
  } Estimated delivery: ${effort} with the ${team} team. Impact score: ${score}/100.`;

  return { complexity, risk, effort, team, sprint, score, confidence, summary };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /feedback/stats
router.get("/feedback/stats", requireAuth, async (_req, res) => {
  const [total] = await db.select({ count: count() }).from(feedbackSuggestionsTable);
  const [pending] = await db.select({ count: count() }).from(feedbackSuggestionsTable)
    .where(sql`${feedbackSuggestionsTable.status} IN ('new', 'under_review')`);
  const [accepted] = await db.select({ count: count() }).from(feedbackSuggestionsTable)
    .where(eq(feedbackSuggestionsTable.status, "accepted"));
  const [inProgress] = await db.select({ count: count() }).from(feedbackSuggestionsTable)
    .where(sql`${feedbackSuggestionsTable.status} IN ('in_progress', 'planned', 'testing')`);
  const [implemented] = await db.select({ count: count() }).from(feedbackSuggestionsTable)
    .where(sql`${feedbackSuggestionsTable.status} IN ('implemented', 'released')`);
  const [rejected] = await db.select({ count: count() }).from(feedbackSuggestionsTable)
    .where(eq(feedbackSuggestionsTable.status, "rejected"));

  // Most requested (highest votes)
  const [topSuggestion] = await db.select({
    title: feedbackSuggestionsTable.title,
    votes: feedbackSuggestionsTable.votes,
  }).from(feedbackSuggestionsTable).orderBy(desc(feedbackSuggestionsTable.votes)).limit(1);

  res.json({
    total: total.count,
    pendingReview: pending.count,
    accepted: accepted.count,
    inProgress: inProgress.count,
    implemented: implemented.count,
    rejected: rejected.count,
    mostRequested: topSuggestion ?? null,
    averageResponseTimeHours: null, // computed from real timestamps when data is available
  });
});

// GET /feedback — list suggestions
router.get("/feedback", requireAuth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const offset = Number(req.query.offset) || 0;
  const status = req.query.status as string | undefined;
  const category = req.query.category as string | undefined;
  const priority = req.query.priority as string | undefined;
  const search = req.query.search as string | undefined;

  const conditions = [];
  if (status) conditions.push(eq(feedbackSuggestionsTable.status, status as "new"));
  if (category) conditions.push(eq(feedbackSuggestionsTable.category, category as "other"));
  if (priority) conditions.push(eq(feedbackSuggestionsTable.priority, priority as "medium"));
  if (search) {
    conditions.push(sql`(${feedbackSuggestionsTable.title} ILIKE ${'%' + search + '%'} OR ${feedbackSuggestionsTable.description} ILIKE ${'%' + search + '%'})`);
  }

  const suggestions = await db
    .select({
      id: feedbackSuggestionsTable.id,
      title: feedbackSuggestionsTable.title,
      description: feedbackSuggestionsTable.description,
      category: feedbackSuggestionsTable.category,
      priority: feedbackSuggestionsTable.priority,
      status: feedbackSuggestionsTable.status,
      affectedModule: feedbackSuggestionsTable.affectedModule,
      businessImpact: feedbackSuggestionsTable.businessImpact,
      expectedBenefit: feedbackSuggestionsTable.expectedBenefit,
      votes: feedbackSuggestionsTable.votes,
      watchers: feedbackSuggestionsTable.watchers,
      anonymous: feedbackSuggestionsTable.anonymous,
      submittedById: feedbackSuggestionsTable.submittedById,
      submittedByName: usersTable.name,
      assignedToId: feedbackSuggestionsTable.assignedToId,
      aiAnalysisScore: feedbackSuggestionsTable.aiAnalysisScore,
      aiComplexity: feedbackSuggestionsTable.aiComplexity,
      aiRiskLevel: feedbackSuggestionsTable.aiRiskLevel,
      aiEstimatedEffort: feedbackSuggestionsTable.aiEstimatedEffort,
      aiSuggestedSprint: feedbackSuggestionsTable.aiSuggestedSprint,
      aiSuggestedTeam: feedbackSuggestionsTable.aiSuggestedTeam,
      aiSummary: feedbackSuggestionsTable.aiSummary,
      aiConfidenceScore: feedbackSuggestionsTable.aiConfidenceScore,
      createdAt: feedbackSuggestionsTable.createdAt,
      updatedAt: feedbackSuggestionsTable.updatedAt,
    })
    .from(feedbackSuggestionsTable)
    .leftJoin(usersTable, eq(feedbackSuggestionsTable.submittedById, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(feedbackSuggestionsTable.votes), desc(feedbackSuggestionsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count: totalCount }] = await db.select({ count: count() })
    .from(feedbackSuggestionsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  res.json({
    suggestions: suggestions.map(s => ({
      ...s,
      submittedByName: s.anonymous ? "Anonymous" : (s.submittedByName ?? "Unknown"),
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })),
    total: totalCount,
    limit,
    offset,
  });
});

// POST /feedback — create suggestion
router.post("/feedback", requireAuth, async (req, res) => {
  const parsed = parseCreateSuggestion(req.body as Record<string, unknown>);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const { anonymous, email, ...rest } = parsed.data;
  const ai = generateAIAnalysis(rest.title, rest.description, rest.category ?? "other");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertValues: any = {
    ...rest,
    anonymous: anonymous ?? false,
    email: anonymous ? null : (email ?? null),
    submittedById: anonymous ? null : req.user!.userId,
    votes: 0,
    watchers: 0,
    aiAnalysisScore: ai.score,
    aiComplexity: ai.complexity,
    aiRiskLevel: ai.risk,
    aiEstimatedEffort: ai.effort,
    aiSuggestedSprint: ai.sprint,
    aiSuggestedTeam: ai.team,
    aiSummary: ai.summary,
    aiConfidenceScore: ai.confidence,
  };
  const [suggestion] = await db.insert(feedbackSuggestionsTable).values(insertValues).returning();

  res.status(201).json({
    ...suggestion,
    createdAt: suggestion.createdAt.toISOString(),
    updatedAt: suggestion.updatedAt.toISOString(),
  });
});

// GET /feedback/:id
router.get("/feedback/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [suggestion] = await db
    .select({
      id: feedbackSuggestionsTable.id,
      title: feedbackSuggestionsTable.title,
      description: feedbackSuggestionsTable.description,
      category: feedbackSuggestionsTable.category,
      priority: feedbackSuggestionsTable.priority,
      status: feedbackSuggestionsTable.status,
      affectedModule: feedbackSuggestionsTable.affectedModule,
      businessImpact: feedbackSuggestionsTable.businessImpact,
      expectedBenefit: feedbackSuggestionsTable.expectedBenefit,
      browser: feedbackSuggestionsTable.browser,
      environment: feedbackSuggestionsTable.environment,
      votes: feedbackSuggestionsTable.votes,
      watchers: feedbackSuggestionsTable.watchers,
      anonymous: feedbackSuggestionsTable.anonymous,
      submittedById: feedbackSuggestionsTable.submittedById,
      submittedByName: usersTable.name,
      assignedToId: feedbackSuggestionsTable.assignedToId,
      aiAnalysisScore: feedbackSuggestionsTable.aiAnalysisScore,
      aiComplexity: feedbackSuggestionsTable.aiComplexity,
      aiRiskLevel: feedbackSuggestionsTable.aiRiskLevel,
      aiEstimatedEffort: feedbackSuggestionsTable.aiEstimatedEffort,
      aiSuggestedSprint: feedbackSuggestionsTable.aiSuggestedSprint,
      aiSuggestedTeam: feedbackSuggestionsTable.aiSuggestedTeam,
      aiSummary: feedbackSuggestionsTable.aiSummary,
      aiConfidenceScore: feedbackSuggestionsTable.aiConfidenceScore,
      createdAt: feedbackSuggestionsTable.createdAt,
      updatedAt: feedbackSuggestionsTable.updatedAt,
    })
    .from(feedbackSuggestionsTable)
    .leftJoin(usersTable, eq(feedbackSuggestionsTable.submittedById, usersTable.id))
    .where(eq(feedbackSuggestionsTable.id, id))
    .limit(1);

  if (!suggestion) { res.status(404).json({ error: "Suggestion not found" }); return; }

  const comments = await db
    .select({
      id: feedbackCommentsTable.id,
      content: feedbackCommentsTable.content,
      role: feedbackCommentsTable.role,
      parentId: feedbackCommentsTable.parentId,
      authorName: usersTable.name,
      authorId: feedbackCommentsTable.authorId,
      createdAt: feedbackCommentsTable.createdAt,
    })
    .from(feedbackCommentsTable)
    .leftJoin(usersTable, eq(feedbackCommentsTable.authorId, usersTable.id))
    .where(eq(feedbackCommentsTable.suggestionId, id))
    .orderBy(feedbackCommentsTable.createdAt);

  // Check if current user has voted / is watching
  const [vote] = await db.select().from(feedbackVotesTable)
    .where(and(eq(feedbackVotesTable.suggestionId, id), eq(feedbackVotesTable.userId, req.user!.userId)))
    .limit(1);
  const [watch] = await db.select().from(feedbackWatchersTable)
    .where(and(eq(feedbackWatchersTable.suggestionId, id), eq(feedbackWatchersTable.userId, req.user!.userId)))
    .limit(1);

  res.json({
    ...suggestion,
    submittedByName: suggestion.anonymous ? "Anonymous" : (suggestion.submittedByName ?? "Unknown"),
    createdAt: suggestion.createdAt.toISOString(),
    updatedAt: suggestion.updatedAt.toISOString(),
    comments: comments.map(c => ({ ...c, createdAt: c.createdAt.toISOString() })),
    currentUserVoted: !!vote,
    currentUserWatching: !!watch,
  });
});

// PATCH /feedback/:id — update status/priority (admin)
router.patch("/feedback/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = parseUpdateSuggestion(req.body as Record<string, unknown>);
  if ("error" in parsed) { res.status(400).json({ error: parsed.error }); return; }

  const [updated] = await db.update(feedbackSuggestionsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(feedbackSuggestionsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Suggestion not found" }); return; }
  res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
});

// POST /feedback/:id/vote
router.post("/feedback/:id/vote", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const userId = req.user!.userId;
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(feedbackVotesTable)
    .where(and(eq(feedbackVotesTable.suggestionId, id), eq(feedbackVotesTable.userId, userId)))
    .limit(1);

  if (existing) {
    // Toggle off — remove vote
    await db.delete(feedbackVotesTable)
      .where(and(eq(feedbackVotesTable.suggestionId, id), eq(feedbackVotesTable.userId, userId)));
    await db.update(feedbackSuggestionsTable)
      .set({ votes: sql`GREATEST(0, ${feedbackSuggestionsTable.votes} - 1)`, updatedAt: new Date() })
      .where(eq(feedbackSuggestionsTable.id, id));
    res.json({ voted: false });
  } else {
    await db.insert(feedbackVotesTable).values({ suggestionId: id, userId });
    await db.update(feedbackSuggestionsTable)
      .set({ votes: sql`${feedbackSuggestionsTable.votes} + 1`, updatedAt: new Date() })
      .where(eq(feedbackSuggestionsTable.id, id));
    res.json({ voted: true });
  }
});

// POST /feedback/:id/watch
router.post("/feedback/:id/watch", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const userId = req.user!.userId;
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(feedbackWatchersTable)
    .where(and(eq(feedbackWatchersTable.suggestionId, id), eq(feedbackWatchersTable.userId, userId)))
    .limit(1);

  if (existing) {
    await db.delete(feedbackWatchersTable)
      .where(and(eq(feedbackWatchersTable.suggestionId, id), eq(feedbackWatchersTable.userId, userId)));
    await db.update(feedbackSuggestionsTable)
      .set({ watchers: sql`GREATEST(0, ${feedbackSuggestionsTable.watchers} - 1)`, updatedAt: new Date() })
      .where(eq(feedbackSuggestionsTable.id, id));
    res.json({ watching: false });
  } else {
    await db.insert(feedbackWatchersTable).values({ suggestionId: id, userId });
    await db.update(feedbackSuggestionsTable)
      .set({ watchers: sql`${feedbackSuggestionsTable.watchers} + 1`, updatedAt: new Date() })
      .where(eq(feedbackSuggestionsTable.id, id));
    res.json({ watching: true });
  }
});

// POST /feedback/:id/comments
router.post("/feedback/:id/comments", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const commentBody = req.body as Record<string, unknown>;
  const commentContent = typeof commentBody.content === "string" ? commentBody.content : "";
  const commentParentId = typeof commentBody.parentId === "number" ? commentBody.parentId : null;
  if (!commentContent.trim()) { res.status(400).json({ error: "Comment content is required" }); return; }

  const [suggestion] = await db.select({ id: feedbackSuggestionsTable.id })
    .from(feedbackSuggestionsTable).where(eq(feedbackSuggestionsTable.id, id)).limit(1);
  if (!suggestion) { res.status(404).json({ error: "Suggestion not found" }); return; }

  const user = await db.select({ role: usersTable.role, name: usersTable.name })
    .from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
  const role = user[0]?.role === "admin" ? "developer" : "user";

  const [comment] = await db.insert(feedbackCommentsTable).values({
    suggestionId: id,
    authorId: req.user!.userId,
    content: commentContent,
    parentId: commentParentId,
    role,
  }).returning();

  await db.update(feedbackSuggestionsTable)
    .set({ updatedAt: new Date() })
    .where(eq(feedbackSuggestionsTable.id, id));

  res.status(201).json({
    ...comment,
    authorName: user[0]?.name ?? "Unknown",
    createdAt: comment.createdAt.toISOString(),
  });
});

export default router;
