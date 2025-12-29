// ═══════════════════════════════════════════════════════════════════════════
// Context Ranking
// Relevance ranking for multi-source context retrieval
// ═══════════════════════════════════════════════════════════════════════════

import type {
  ContextRetrieval,
  RankedContext,
  RankedContextItem,
  WithRelevance,
  ContextSource,
  SemanticMatch,
  ConversationMessage,
  Interaction,
} from "./types";
import type { IntentAnalysisResult } from "../intent/types";
import type { IntentCategory } from "../constants";
import { estimateTokenCount } from "../safety/content-filter";
import type {
  Person,
  Place,
  Event,
  Task,
  Deadline,
  Routine,
  OpenLoop,
  Project,
  Note,
  Opportunity,
  EntityType,
} from "@/services/context/types";

// ─────────────────────────────────────────────────────────────
// Ranking Configuration
// ─────────────────────────────────────────────────────────────

/**
 * Weights for different context sources
 */
export const SOURCE_WEIGHTS: Record<ContextSource, number> = {
  resolved_entity: 1.0,      // Highest - directly mentioned
  semantic_search: 0.8,      // High - semantically relevant
  text_search: 0.7,          // Good - text match
  conversation: 0.6,         // Moderate - from history
  related_entity: 0.5,       // Moderate - related
  recent_interaction: 0.4,   // Lower - recent but may not be relevant
  time_based: 0.3,           // Lowest - just time-based
};

/**
 * Weights for intent categories to boost relevant entity types
 */
export const INTENT_ENTITY_WEIGHTS: Partial<Record<IntentCategory, Partial<Record<EntityType, number>>>> = {
  schedule: {
    event: 1.2,
    person: 1.1,
    place: 1.0,
  },
  task: {
    task: 1.3,
    deadline: 1.2,
    project: 1.1,
  },
  communicate: {
    person: 1.2,
  },
  query: {
    // All entities equally relevant for queries
  },
  remind: {
    task: 1.2,
    deadline: 1.2,
    routine: 1.1,
  },
  search: {
    // All entities equally relevant for search
  },
  summarize: {
    project: 1.1,
    note: 1.1,
  },
};

/**
 * Maximum tokens to use for context summary
 */
export const MAX_CONTEXT_TOKENS = 2000;

// ─────────────────────────────────────────────────────────────
// Entity Summarization
// ─────────────────────────────────────────────────────────────

/**
 * Get display name for an entity
 */
export function getEntityDisplayName(
  entity: Person | Place | Event | Task | Deadline | Routine | OpenLoop | Project | Note | Opportunity,
  entityType: EntityType
): string {
  switch (entityType) {
    case "person":
      return (entity as Person).name;
    case "place":
      return (entity as Place).name;
    case "event":
      return (entity as Event).title;
    case "task":
      return (entity as Task).title;
    case "deadline":
      return (entity as Deadline).title;
    case "routine":
      return (entity as Routine).name;
    case "open_loop":
      return (entity as OpenLoop).title;
    case "project":
      return (entity as Project).name;
    case "note":
      return (entity as Note).title || "Untitled Note";
    case "opportunity":
      return (entity as Opportunity).title;
    default:
      return "Unknown";
  }
}

/**
 * Generate a brief summary for an entity
 */
export function summarizeEntity(
  entity: Person | Place | Event | Task | Deadline | Routine | OpenLoop | Project | Note | Opportunity,
  entityType: EntityType
): string {
  switch (entityType) {
    case "person": {
      const p = entity as Person;
      const parts = [p.name];
      if (p.title) parts.push(p.title);
      if (p.company) parts.push(`at ${p.company}`);
      if (p.email) parts.push(`(${p.email})`);
      return parts.join(" ");
    }
    case "place": {
      const pl = entity as Place;
      const parts = [pl.name];
      if (pl.address) parts.push(pl.address);
      if (pl.city) parts.push(pl.city);
      return parts.join(", ");
    }
    case "event": {
      const e = entity as Event;
      const parts = [e.title];
      if (e.startsAt) {
        parts.push(`on ${e.startsAt.toLocaleDateString()}`);
      }
      if (e.location) parts.push(`at ${e.location}`);
      return parts.join(" ");
    }
    case "task": {
      const t = entity as Task;
      const parts = [t.title];
      parts.push(`[${t.status}]`);
      if (t.dueDate) {
        parts.push(`due ${t.dueDate.toLocaleDateString()}`);
      }
      return parts.join(" ");
    }
    case "deadline": {
      const d = entity as Deadline;
      const parts = [d.title];
      parts.push(`due ${d.dueAt.toLocaleDateString()}`);
      parts.push(`[${d.status}]`);
      return parts.join(" ");
    }
    case "routine": {
      const r = entity as Routine;
      const parts = [r.name];
      if (r.frequency) parts.push(`(${r.frequency})`);
      parts.push(`[${r.status}]`);
      return parts.join(" ");
    }
    case "open_loop": {
      const o = entity as OpenLoop;
      const parts = [o.title];
      if (o.dueAt) {
        parts.push(`due ${o.dueAt.toLocaleDateString()}`);
      }
      parts.push(`[${o.status}]`);
      return parts.join(" ");
    }
    case "project": {
      const pr = entity as Project;
      const parts = [pr.name];
      parts.push(`[${pr.status}]`);
      if (pr.dueDate) {
        parts.push(`due ${pr.dueDate.toLocaleDateString()}`);
      }
      return parts.join(" ");
    }
    case "note": {
      const n = entity as Note;
      const title = n.title || "Untitled";
      const content = n.content.substring(0, 50) + (n.content.length > 50 ? "..." : "");
      return `${title}: ${content}`;
    }
    case "opportunity": {
      const opp = entity as Opportunity;
      const parts = [opp.title];
      parts.push(`[${opp.status}]`);
      if (opp.type && opp.type !== "general") parts.push(`(${opp.type})`);
      if (opp.expiresAt) {
        parts.push(`expires ${opp.expiresAt.toLocaleDateString()}`);
      }
      return parts.join(" ");
    }
    default:
      return "Unknown entity";
  }
}

// ─────────────────────────────────────────────────────────────
// Ranking Functions
// ─────────────────────────────────────────────────────────────

/**
 * Calculate final relevance score for an item
 */
export function calculateRelevanceScore<T>(
  item: WithRelevance<T>,
  entityType: EntityType,
  intent: IntentAnalysisResult
): number {
  // Start with base relevance
  let score = item.relevance;

  // Apply source weight
  score *= SOURCE_WEIGHTS[item.source];

  // Apply intent-based entity weight
  const intentWeights = INTENT_ENTITY_WEIGHTS[intent.category];
  if (intentWeights && intentWeights[entityType]) {
    score *= intentWeights[entityType]!;
  }

  // Boost if entity was explicitly mentioned
  const mentioned = intent.entities.some(
    (e) => e.type === entityType || e.type === "reference"
  );
  if (mentioned) {
    score *= 1.2;
  }

  // Cap at 1.0
  return Math.min(1.0, score);
}

/**
 * Rank context relevance and merge results
 */
export function rankContextRelevance(
  items: Array<{
    entityType: EntityType;
    entityId: string;
    entity: Person | Place | Event | Task | Deadline | Routine | OpenLoop | Project | Note;
    source: ContextSource;
    relevance: number;
    relevanceReason?: string;
  }>,
  intent: IntentAnalysisResult
): RankedContextItem[] {
  // Group by entity ID to merge sources
  const grouped = new Map<string, RankedContextItem>();

  for (const item of items) {
    const key = `${item.entityType}:${item.entityId}`;
    const existingItem = grouped.get(key);

    if (existingItem) {
      // Merge sources and take max relevance
      if (!existingItem.sources.includes(item.source)) {
        existingItem.sources.push(item.source);
      }
      if (item.relevanceReason && !existingItem.relevanceReasons.includes(item.relevanceReason)) {
        existingItem.relevanceReasons.push(item.relevanceReason);
      }
      existingItem.relevance = Math.max(
        existingItem.relevance,
        calculateRelevanceScore(
          { item: item.entity, relevance: item.relevance, source: item.source },
          item.entityType,
          intent
        )
      );
    } else {
      grouped.set(key, {
        entityType: item.entityType,
        entityId: item.entityId,
        displayName: getEntityDisplayName(item.entity, item.entityType),
        relevance: calculateRelevanceScore(
          { item: item.entity, relevance: item.relevance, source: item.source },
          item.entityType,
          intent
        ),
        relevanceReasons: item.relevanceReason ? [item.relevanceReason] : [],
        sources: [item.source],
        summary: summarizeEntity(item.entity, item.entityType),
        entity: item.entity,
      });
    }
  }

  // Sort by relevance descending
  return Array.from(grouped.values()).sort((a, b) => b.relevance - a.relevance);
}

/**
 * Merge and rank all context sources
 */
export function mergeAndRank(
  context: ContextRetrieval,
  intent: IntentAnalysisResult
): RankedContext {
  // Collect all items with their types
  const allItems: Array<{
    entityType: EntityType;
    entityId: string;
    entity: Person | Place | Event | Task | Deadline | Routine | OpenLoop | Project | Note;
    source: ContextSource;
    relevance: number;
    relevanceReason?: string;
  }> = [];

  // Add people
  for (const item of context.relevantPeople) {
    allItems.push({
      entityType: "person",
      entityId: item.item.id,
      entity: item.item,
      source: item.source,
      relevance: item.relevance,
      relevanceReason: item.relevanceReason,
    });
  }

  // Add events
  for (const item of context.relevantEvents) {
    allItems.push({
      entityType: "event",
      entityId: item.item.id,
      entity: item.item,
      source: item.source,
      relevance: item.relevance,
      relevanceReason: item.relevanceReason,
    });
  }

  // Add tasks
  for (const item of context.relevantTasks) {
    allItems.push({
      entityType: "task",
      entityId: item.item.id,
      entity: item.item,
      source: item.source,
      relevance: item.relevance,
      relevanceReason: item.relevanceReason,
    });
  }

  // Add deadlines
  for (const item of context.relevantDeadlines) {
    allItems.push({
      entityType: "deadline",
      entityId: item.item.id,
      entity: item.item,
      source: item.source,
      relevance: item.relevance,
      relevanceReason: item.relevanceReason,
    });
  }

  // Add places
  for (const item of context.relevantPlaces) {
    allItems.push({
      entityType: "place",
      entityId: item.item.id,
      entity: item.item,
      source: item.source,
      relevance: item.relevance,
      relevanceReason: item.relevanceReason,
    });
  }

  // Add routines
  for (const item of context.relevantRoutines) {
    allItems.push({
      entityType: "routine",
      entityId: item.item.id,
      entity: item.item,
      source: item.source,
      relevance: item.relevance,
      relevanceReason: item.relevanceReason,
    });
  }

  // Add open loops
  for (const item of context.relevantOpenLoops) {
    allItems.push({
      entityType: "open_loop",
      entityId: item.item.id,
      entity: item.item,
      source: item.source,
      relevance: item.relevance,
      relevanceReason: item.relevanceReason,
    });
  }

  // Add projects
  for (const item of context.relevantProjects) {
    allItems.push({
      entityType: "project",
      entityId: item.item.id,
      entity: item.item,
      source: item.source,
      relevance: item.relevance,
      relevanceReason: item.relevanceReason,
    });
  }

  // Add notes
  for (const item of context.relevantNotes) {
    allItems.push({
      entityType: "note",
      entityId: item.item.id,
      entity: item.item,
      source: item.source,
      relevance: item.relevance,
      relevanceReason: item.relevanceReason,
    });
  }

  // Rank all items
  const rankedItems = rankContextRelevance(allItems, intent);

  // Build context summary
  const { summary, tokens } = buildContextSummary(
    rankedItems,
    context.conversationContext,
    context.recentInteractions,
    MAX_CONTEXT_TOKENS
  );

  return {
    topItems: rankedItems,
    contextSummary: summary,
    estimatedTokens: tokens,
  };
}

// ─────────────────────────────────────────────────────────────
// Context Summary Building
// ─────────────────────────────────────────────────────────────

/**
 * Build a summary of context for LLM system prompt
 */
export function buildContextSummary(
  rankedItems: RankedContextItem[],
  conversationHistory: ConversationMessage[],
  recentInteractions: Interaction[],
  maxTokens: number
): { summary: string; tokens: number } {
  const sections: string[] = [];
  let currentTokens = 0;

  // Add high-relevance context items
  const highRelevance = rankedItems.filter((item) => item.relevance >= 0.6);
  if (highRelevance.length > 0) {
    const itemSummaries = highRelevance
      .slice(0, 10) // Limit to top 10
      .map((item) => `- ${item.entityType}: ${item.summary}`)
      .join("\n");

    const section = `## Relevant Context\n${itemSummaries}`;
    const sectionTokens = estimateTokenCount(section);

    if (currentTokens + sectionTokens <= maxTokens) {
      sections.push(section);
      currentTokens += sectionTokens;
    }
  }

  // Add recent conversation context
  if (conversationHistory.length > 0 && currentTokens < maxTokens) {
    const recentMessages = conversationHistory.slice(-5); // Last 5 messages
    const messageSummaries = recentMessages
      .map((m) => `${m.role}: ${m.content.substring(0, 100)}${m.content.length > 100 ? "..." : ""}`)
      .join("\n");

    const section = `## Recent Conversation\n${messageSummaries}`;
    const sectionTokens = estimateTokenCount(section);

    if (currentTokens + sectionTokens <= maxTokens) {
      sections.push(section);
      currentTokens += sectionTokens;
    }
  }

  // Add recent interactions summary
  if (recentInteractions.length > 0 && currentTokens < maxTokens) {
    const interactionSummaries = recentInteractions
      .slice(0, 5)
      .map((i) => `- ${i.type} ${i.entityType}: ${i.displayName}`)
      .join("\n");

    const section = `## Recent Activity\n${interactionSummaries}`;
    const sectionTokens = estimateTokenCount(section);

    if (currentTokens + sectionTokens <= maxTokens) {
      sections.push(section);
      currentTokens += sectionTokens;
    }
  }

  const summary = sections.join("\n\n");
  return { summary, tokens: currentTokens };
}

// ─────────────────────────────────────────────────────────────
// Semantic Match Ranking
// ─────────────────────────────────────────────────────────────

/**
 * Rank semantic matches by similarity and intent relevance
 */
export function rankSemanticMatches(
  matches: SemanticMatch[],
  intent: IntentAnalysisResult
): SemanticMatch[] {
  return matches
    .map((match) => {
      // Apply intent-based boost
      const intentWeights = INTENT_ENTITY_WEIGHTS[intent.category];
      const boost = intentWeights?.[match.entityType] ?? 1.0;

      return {
        ...match,
        similarity: Math.min(1.0, match.similarity * boost),
      };
    })
    .sort((a, b) => b.similarity - a.similarity);
}

// ─────────────────────────────────────────────────────────────
// Time-Based Relevance
// ─────────────────────────────────────────────────────────────

/**
 * Calculate time-based relevance for an event
 */
export function calculateTimeRelevance(
  eventDate: Date,
  referenceDate: Date = new Date()
): number {
  const diffMs = Math.abs(eventDate.getTime() - referenceDate.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  // Higher relevance for events closer in time
  if (diffDays <= 1) return 1.0;      // Today/tomorrow
  if (diffDays <= 7) return 0.8;      // This week
  if (diffDays <= 30) return 0.6;     // This month
  if (diffDays <= 90) return 0.4;     // This quarter
  return 0.2;                          // Further out
}

/**
 * Calculate recency relevance for interactions
 */
export function calculateRecencyRelevance(
  interactionDate: Date,
  referenceDate: Date = new Date()
): number {
  const diffMs = Math.abs(referenceDate.getTime() - interactionDate.getTime());
  const diffHours = diffMs / (1000 * 60 * 60);

  // Higher relevance for more recent interactions
  if (diffHours <= 1) return 1.0;     // Last hour
  if (diffHours <= 24) return 0.8;    // Last day
  if (diffHours <= 168) return 0.6;   // Last week
  if (diffHours <= 720) return 0.4;   // Last month
  return 0.2;                          // Older
}


