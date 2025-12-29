// ═══════════════════════════════════════════════════════════════════════════
// Context Retrieval Service
// Multi-source context retrieval to enrich LLM responses
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import { contextLogger } from "../logger";
import { getContextSearchService } from "@/services/context/context-search";
import type { IntentAnalysisResult, ProcessedEntity } from "../intent/types";
import type { ResolutionResult, ResolvedEntity } from "../entities/types";
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
import { excludeDeleted } from "@/services/context/utils";
import {
  mergeAndRank,
  rankSemanticMatches,
  calculateTimeRelevance,
  calculateRecencyRelevance,
} from "./ranking";
import type {
  ContextRetrieval,
  RetrievalOptions,
  SemanticFilters,
  SemanticMatch,
  ConversationMessage,
  Interaction,
  RankedContext,
  IContextRetrievalService,
  ContextRetrievalError,
  PersonWithRelevance,
  EventWithRelevance,
  TaskWithRelevance,
  DeadlineWithRelevance,
  PlaceWithRelevance,
  RoutineWithRelevance,
  OpenLoopWithRelevance,
  ProjectWithRelevance,
  NoteWithRelevance,
  OpportunityWithRelevance,
  ContextRetrievalStats,
} from "./types";
import { DEFAULT_RETRIEVAL_OPTIONS, ContextRetrievalError as ContextError } from "./types";

// ─────────────────────────────────────────────────────────────
// Context Retrieval Service Implementation
// ─────────────────────────────────────────────────────────────

export class ContextRetrievalService implements IContextRetrievalService {
  private readonly searchService = getContextSearchService();

  /**
   * Retrieve context for an intent analysis result
   */
  async retrieveContext(
    userId: string,
    intent: IntentAnalysisResult,
    options: RetrievalOptions = {}
  ): Promise<ContextRetrieval> {
    const startTime = Date.now();
    const opts = { ...DEFAULT_RETRIEVAL_OPTIONS, ...options };

    contextLogger.debug("Retrieving context for intent", {
      userId,
      category: intent.category,
      entityCount: intent.entities.length,
    });

    try {
      // Initialize stats
      const stats: ContextRetrievalStats = {
        totalItems: 0,
        fromResolution: 0,
        fromSemanticSearch: 0,
        fromTextSearch: 0,
        fromConversation: 0,
        fromRecentInteractions: 0,
        durationMs: 0,
      };

      // Run all retrievals in parallel
      const [
        resolvedContext,
        semanticContext,
        timeBasedContext,
        conversationContext,
        recentInteractions,
      ] = await Promise.all([
        this.retrieveFromEntities(userId, intent.entities, opts),
        opts.useSemanticSearch
          ? this.searchSemanticWithIntent(userId, intent, opts)
          : Promise.resolve({ matches: [], results: this.emptySearchResults() }),
        this.retrieveTimeBasedContext(userId, intent, opts),
        opts.maxConversationMessages && opts.maxConversationMessages > 0 && options.conversationId
          ? this.getConversationContext(options.conversationId, opts.maxConversationMessages)
          : Promise.resolve([]),
        opts.maxRecentInteractions && opts.maxRecentInteractions > 0
          ? this.getRecentInteractions(userId, opts.maxRecentInteractions)
          : Promise.resolve([]),
      ]);

      // Merge all context sources
      const merged = this.mergeContextSources(
        resolvedContext,
        semanticContext.results,
        timeBasedContext
      );

      // Update stats
      stats.fromResolution = Object.values(resolvedContext)
        .filter(Array.isArray)
        .flat().length;
      stats.fromSemanticSearch = semanticContext.matches.length;
      stats.fromConversation = conversationContext.length;
      stats.fromRecentInteractions = recentInteractions.length;
      stats.totalItems =
        stats.fromResolution +
        stats.fromSemanticSearch +
        stats.fromConversation +
        stats.fromRecentInteractions;
      stats.durationMs = Date.now() - startTime;

      const result: ContextRetrieval = {
        ...merged,
        conversationContext,
        semanticMatches: semanticContext.matches,
        recentInteractions,
        stats,
      };

      contextLogger.info("Context retrieval complete", {
        userId,
        totalItems: stats.totalItems,
        durationMs: stats.durationMs,
      });

      return result;
    } catch (error) {
      contextLogger.error("Context retrieval failed", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new ContextError(
        "RETRIEVAL_FAILED",
        `Failed to retrieve context: ${error instanceof Error ? error.message : String(error)}`,
        { userId, intent: intent.category }
      );
    }
  }

  /**
   * Retrieve context using resolved entities from P2E
   */
  async retrieveFromResolution(
    userId: string,
    resolution: ResolutionResult,
    options: RetrievalOptions = {}
  ): Promise<ContextRetrieval> {
    const startTime = Date.now();
    const opts = { ...DEFAULT_RETRIEVAL_OPTIONS, ...options };

    const result: ContextRetrieval = {
      relevantPeople: [],
      relevantEvents: [],
      relevantTasks: [],
      relevantDeadlines: [],
      relevantPlaces: [],
      relevantRoutines: [],
      relevantOpenLoops: [],
      relevantProjects: [],
      relevantNotes: [],
      relevantOpportunities: [],
      conversationContext: [],
      semanticMatches: [],
      recentInteractions: [],
      stats: {
        totalItems: 0,
        fromResolution: 0,
        fromSemanticSearch: 0,
        fromTextSearch: 0,
        fromConversation: 0,
        fromRecentInteractions: 0,
        durationMs: 0,
      },
    };

    // Add resolved entities
    for (const entity of resolution.resolved) {
      if (entity.match) {
        this.addResolvedEntity(result, entity);
        result.stats.fromResolution++;
      }
    }

    // Fetch related entities if requested
    if (opts.includeRelated) {
      await this.fetchRelatedEntities(userId, result, opts);
    }

    result.stats.totalItems = result.stats.fromResolution;
    result.stats.durationMs = Date.now() - startTime;

    return result;
  }

  /**
   * Search semantically for context
   */
  async searchSemantic(
    userId: string,
    query: string,
    filters: SemanticFilters = {}
  ): Promise<SemanticMatch[]> {
    try {
      const results = await this.searchService.semanticSearch(userId, query, {
        entityTypes: filters.entityTypes,
        limit: filters.limit || DEFAULT_RETRIEVAL_OPTIONS.maxSemanticMatches,
        minSimilarity: filters.minSimilarity || DEFAULT_RETRIEVAL_OPTIONS.minSimilarity,
      });

      return results.map((r) => ({
        entityType: r.entityType,
        entityId: r.entityId,
        similarity: r.score,
        content: r.snippet || "",
        entity: r.entity,
      }));
    } catch (error) {
      contextLogger.warn("Semantic search failed", {
        userId,
        query,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return empty on failure - semantic search is optional
      return [];
    }
  }

  /**
   * Get recent user interactions
   */
  async getRecentInteractions(
    userId: string,
    limit: number
  ): Promise<Interaction[]> {
    try {
      // Query audit log for recent interactions
      const auditLogs = await db.auditLog.findMany({
        where: {
          userId,
          actionType: { in: ["query", "create", "update", "delete"] },
          entityType: { not: null },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      return auditLogs.map((log) => ({
        type: this.mapActionToInteractionType(log.actionType),
        entityType: log.entityType as EntityType,
        entityId: log.entityId || "",
        displayName: log.outputSummary || log.entityType || "Unknown",
        timestamp: log.createdAt,
        context: log.intent || undefined,
      }));
    } catch (error) {
      contextLogger.warn("Failed to get recent interactions", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get conversation context
   */
  async getConversationContext(
    conversationId: string,
    maxMessages: number
  ): Promise<ConversationMessage[]> {
    if (!conversationId) {
      return [];
    }

    try {
      const messages = await db.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "desc" },
        take: maxMessages,
      });

      return messages
        .reverse() // Oldest first
        .map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
          createdAt: m.createdAt,
          metadata: m.metadata as Record<string, unknown> | undefined,
        }));
    } catch (error) {
      contextLogger.warn("Failed to get conversation context", {
        conversationId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Rank and prioritize context for LLM
   */
  rankContext(
    context: ContextRetrieval,
    intent: IntentAnalysisResult
  ): RankedContext {
    return mergeAndRank(context, intent);
  }

  // ─────────────────────────────────────────────────────────────
  // Private Helper Methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Retrieve context from extracted entities
   */
  private async retrieveFromEntities(
    userId: string,
    entities: ProcessedEntity[],
    opts: RetrievalOptions & typeof DEFAULT_RETRIEVAL_OPTIONS
  ): Promise<Partial<ContextRetrieval>> {
    const result: Partial<ContextRetrieval> = {
      relevantPeople: [],
      relevantEvents: [],
      relevantTasks: [],
      relevantDeadlines: [],
      relevantPlaces: [],
      relevantRoutines: [],
      relevantOpenLoops: [],
      relevantProjects: [],
      relevantNotes: [],
      relevantOpportunities: [],
    };

    // Group entities by type
    const personRefs = entities.filter((e) => e.type === "person");
    const eventRefs = entities.filter((e) => e.type === "event");
    const taskRefs = entities.filter((e) => e.type === "task");

    // Fetch people
    if (personRefs.length > 0) {
      const names = personRefs.map((p) => p.text);
      const people = await this.findPeopleByNames(userId, names, opts.maxPeople);
      result.relevantPeople = people.map((p) => ({
        item: p,
        relevance: 0.9, // High relevance for directly mentioned
        relevanceReason: "Mentioned in message",
        source: "resolved_entity" as const,
      }));
    }

    // Fetch events referenced
    if (eventRefs.length > 0) {
      const titles = eventRefs.map((e) => e.text);
      const events = await this.findEventsByTitles(userId, titles, opts.maxEvents);
      result.relevantEvents = events.map((e) => ({
        item: e,
        relevance: 0.9,
        relevanceReason: "Mentioned in message",
        source: "resolved_entity" as const,
      }));
    }

    // Fetch tasks referenced
    if (taskRefs.length > 0) {
      const titles = taskRefs.map((t) => t.text);
      const tasks = await this.findTasksByTitles(userId, titles, opts.maxTasks);
      result.relevantTasks = tasks.map((t) => ({
        item: t,
        relevance: 0.9,
        relevanceReason: "Mentioned in message",
        source: "resolved_entity" as const,
      }));
    }

    return result;
  }

  /**
   * Search semantic with intent context
   */
  private async searchSemanticWithIntent(
    userId: string,
    intent: IntentAnalysisResult,
    opts: RetrievalOptions & typeof DEFAULT_RETRIEVAL_OPTIONS
  ): Promise<{ matches: SemanticMatch[]; results: Partial<ContextRetrieval> }> {
    // Build search query from intent summary
    const query = intent.summary || "";
    if (!query) {
      return { matches: [], results: this.emptySearchResults() };
    }

    const matches = await this.searchSemantic(userId, query, {
      entityTypes: opts.focusEntityTypes,
      limit: opts.maxSemanticMatches,
      minSimilarity: opts.minSimilarity,
    });

    // Rank matches by intent relevance
    const rankedMatches = rankSemanticMatches(matches, intent);

    // Convert to result structure
    const results = this.semanticMatchesToResults(rankedMatches);

    return { matches: rankedMatches, results };
  }

  /**
   * Retrieve time-based context (upcoming events, due tasks)
   */
  private async retrieveTimeBasedContext(
    userId: string,
    intent: IntentAnalysisResult,
    opts: RetrievalOptions & typeof DEFAULT_RETRIEVAL_OPTIONS
  ): Promise<Partial<ContextRetrieval>> {
    const result: Partial<ContextRetrieval> = {
      relevantEvents: [],
      relevantTasks: [],
      relevantDeadlines: [],
    };

    const now = new Date();
    const isSchedulingIntent = intent.category === "schedule";
    const isTaskIntent = intent.category === "task" || intent.category === "remind";

    // Get upcoming events for scheduling intents
    if (isSchedulingIntent) {
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const events = await db.event.findMany({
        where: {
          userId,
          ...excludeDeleted(),
          startsAt: { gte: now, lte: weekFromNow },
        },
        orderBy: { startsAt: "asc" },
        take: opts.maxEvents,
      });

      result.relevantEvents = events.map((e) => ({
        item: e as Event,
        relevance: calculateTimeRelevance(e.startsAt, now),
        relevanceReason: "Upcoming event",
        source: "time_based" as const,
      }));
    }

    // Get due tasks for task intents
    if (isTaskIntent) {
      const tasks = await db.task.findMany({
        where: {
          userId,
          ...excludeDeleted(),
          status: { in: ["pending", "in_progress"] },
          dueDate: { gte: now },
        },
        orderBy: { dueDate: "asc" },
        take: opts.maxTasks,
      });

      result.relevantTasks = tasks.map((t) => ({
        item: t as Task,
        relevance: t.dueDate ? calculateTimeRelevance(t.dueDate, now) : 0.5,
        relevanceReason: "Upcoming task",
        source: "time_based" as const,
      }));

      // Get upcoming deadlines
      const deadlines = await db.deadline.findMany({
        where: {
          userId,
          ...excludeDeleted(),
          status: "pending",
          dueAt: { gte: now },
        },
        orderBy: { dueAt: "asc" },
        take: opts.maxDeadlines,
      });

      result.relevantDeadlines = deadlines.map((d) => ({
        item: d as Deadline,
        relevance: calculateTimeRelevance(d.dueAt, now),
        relevanceReason: "Upcoming deadline",
        source: "time_based" as const,
      }));
    }

    return result;
  }

  /**
   * Merge context from multiple sources
   */
  private mergeContextSources(
    resolved: Partial<ContextRetrieval>,
    semantic: Partial<ContextRetrieval>,
    timeBased: Partial<ContextRetrieval>
  ): Omit<ContextRetrieval, "conversationContext" | "semanticMatches" | "recentInteractions" | "stats"> {
    return {
      relevantPeople: this.mergeWithDedup(
        resolved.relevantPeople || [],
        semantic.relevantPeople || []
      ),
      relevantEvents: this.mergeWithDedup(
        resolved.relevantEvents || [],
        semantic.relevantEvents || [],
        timeBased.relevantEvents || []
      ),
      relevantTasks: this.mergeWithDedup(
        resolved.relevantTasks || [],
        semantic.relevantTasks || [],
        timeBased.relevantTasks || []
      ),
      relevantDeadlines: this.mergeWithDedup(
        resolved.relevantDeadlines || [],
        semantic.relevantDeadlines || [],
        timeBased.relevantDeadlines || []
      ),
      relevantPlaces: this.mergeWithDedup(
        resolved.relevantPlaces || [],
        semantic.relevantPlaces || []
      ),
      relevantRoutines: this.mergeWithDedup(
        resolved.relevantRoutines || [],
        semantic.relevantRoutines || []
      ),
      relevantOpenLoops: this.mergeWithDedup(
        resolved.relevantOpenLoops || [],
        semantic.relevantOpenLoops || []
      ),
      relevantProjects: this.mergeWithDedup(
        resolved.relevantProjects || [],
        semantic.relevantProjects || []
      ),
      relevantNotes: this.mergeWithDedup(
        resolved.relevantNotes || [],
        semantic.relevantNotes || []
      ),
      relevantOpportunities: this.mergeWithDedup(
        resolved.relevantOpportunities || [],
        semantic.relevantOpportunities || []
      ),
    };
  }

  /**
   * Merge arrays with deduplication by item id, keeping highest relevance
   */
  private mergeWithDedup<T extends { item: { id: string }; relevance: number }>(
    ...arrays: T[][]
  ): T[] {
    const map = new Map<string, T>();

    for (const arr of arrays) {
      for (const item of arr) {
        const existing = map.get(item.item.id);
        if (!existing || item.relevance > existing.relevance) {
          map.set(item.item.id, item);
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Find people by names
   */
  private async findPeopleByNames(
    userId: string,
    names: string[],
    limit: number
  ): Promise<Person[]> {
    if (names.length === 0) return [];

    return db.person.findMany({
      where: {
        userId,
        ...excludeDeleted(),
        OR: names.map((name) => ({
          name: { contains: name, mode: "insensitive" as const },
        })),
      },
      take: limit,
    });
  }

  /**
   * Find events by titles
   */
  private async findEventsByTitles(
    userId: string,
    titles: string[],
    limit: number
  ): Promise<Event[]> {
    if (titles.length === 0) return [];

    return db.event.findMany({
      where: {
        userId,
        ...excludeDeleted(),
        OR: titles.map((title) => ({
          title: { contains: title, mode: "insensitive" as const },
        })),
      },
      take: limit,
    });
  }

  /**
   * Find tasks by titles
   */
  private async findTasksByTitles(
    userId: string,
    titles: string[],
    limit: number
  ): Promise<Task[]> {
    if (titles.length === 0) return [];

    return db.task.findMany({
      where: {
        userId,
        ...excludeDeleted(),
        OR: titles.map((title) => ({
          title: { contains: title, mode: "insensitive" as const },
        })),
      },
      take: limit,
    });
  }

  /**
   * Convert semantic matches to result structure
   */
  private semanticMatchesToResults(
    matches: SemanticMatch[]
  ): Partial<ContextRetrieval> {
    const result: Partial<ContextRetrieval> = {
      relevantPeople: [],
      relevantEvents: [],
      relevantTasks: [],
      relevantDeadlines: [],
      relevantPlaces: [],
      relevantRoutines: [],
      relevantOpenLoops: [],
      relevantProjects: [],
      relevantNotes: [],
      relevantOpportunities: [],
    };

    for (const match of matches) {
      if (!match.entity) continue;

      const withRelevance = {
        item: match.entity,
        relevance: match.similarity,
        relevanceReason: "Semantically similar",
        source: "semantic_search" as const,
      };

      switch (match.entityType) {
        case "person":
          result.relevantPeople!.push(withRelevance as PersonWithRelevance);
          break;
        case "event":
          result.relevantEvents!.push(withRelevance as EventWithRelevance);
          break;
        case "task":
          result.relevantTasks!.push(withRelevance as TaskWithRelevance);
          break;
        case "deadline":
          result.relevantDeadlines!.push(withRelevance as DeadlineWithRelevance);
          break;
        case "place":
          result.relevantPlaces!.push(withRelevance as PlaceWithRelevance);
          break;
        case "routine":
          result.relevantRoutines!.push(withRelevance as RoutineWithRelevance);
          break;
        case "open_loop":
          result.relevantOpenLoops!.push(withRelevance as OpenLoopWithRelevance);
          break;
        case "project":
          result.relevantProjects!.push(withRelevance as ProjectWithRelevance);
          break;
        case "note":
          result.relevantNotes!.push(withRelevance as NoteWithRelevance);
          break;
        case "opportunity":
          result.relevantOpportunities!.push(withRelevance as OpportunityWithRelevance);
          break;
      }
    }

    return result;
  }

  /**
   * Add a resolved entity to the result
   */
  private addResolvedEntity(
    result: ContextRetrieval,
    resolved: ResolvedEntity
  ): void {
    if (!resolved.match) return;

    const withRelevance = {
      item: resolved.match.record,
      relevance: resolved.confidence,
      relevanceReason: "Directly resolved from message",
      source: "resolved_entity" as const,
    };

    switch (resolved.match.type) {
      case "person":
        result.relevantPeople.push(withRelevance as PersonWithRelevance);
        break;
      case "event":
        result.relevantEvents.push(withRelevance as EventWithRelevance);
        break;
      case "task":
        result.relevantTasks.push(withRelevance as TaskWithRelevance);
        break;
      case "deadline":
        result.relevantDeadlines.push(withRelevance as DeadlineWithRelevance);
        break;
      case "place":
        result.relevantPlaces.push(withRelevance as PlaceWithRelevance);
        break;
      case "routine":
        result.relevantRoutines.push(withRelevance as RoutineWithRelevance);
        break;
      case "open_loop":
        result.relevantOpenLoops.push(withRelevance as OpenLoopWithRelevance);
        break;
      case "project":
        result.relevantProjects.push(withRelevance as ProjectWithRelevance);
        break;
      case "note":
        result.relevantNotes.push(withRelevance as NoteWithRelevance);
        break;
      case "opportunity":
        result.relevantOpportunities.push(withRelevance as OpportunityWithRelevance);
        break;
    }
  }

  /**
   * Fetch related entities for resolved items
   */
  private async fetchRelatedEntities(
    userId: string,
    result: ContextRetrieval,
    opts: RetrievalOptions & typeof DEFAULT_RETRIEVAL_OPTIONS
  ): Promise<void> {
    // For each resolved person, find their upcoming events
    if (result.relevantPeople.length > 0) {
      const personNames = result.relevantPeople.map((p) => p.item.name);
      const relatedEvents = await db.event.findMany({
        where: {
          userId,
          ...excludeDeleted(),
          // Find events that may involve these people (check in description/notes)
          OR: personNames.flatMap((name) => [
            { description: { contains: name, mode: "insensitive" as const } },
            { notes: { contains: name, mode: "insensitive" as const } },
          ]),
          startsAt: { gte: new Date() },
        },
        orderBy: { startsAt: "asc" },
        take: opts.maxEvents,
      });

      for (const event of relatedEvents) {
        if (!result.relevantEvents.some((e) => e.item.id === event.id)) {
          result.relevantEvents.push({
            item: event as Event,
            relevance: 0.6,
            relevanceReason: "Related to mentioned person",
            source: "related_entity" as const,
          });
        }
      }
    }
  }

  /**
   * Map action type to interaction type
   */
  private mapActionToInteractionType(actionType: string): Interaction["type"] {
    switch (actionType) {
      case "query":
        return "queried";
      case "create":
        return "created";
      case "update":
        return "updated";
      case "delete":
        return "deleted";
      default:
        return "viewed";
    }
  }

  /**
   * Return empty search results structure
   */
  private emptySearchResults(): Partial<ContextRetrieval> {
    return {
      relevantPeople: [],
      relevantEvents: [],
      relevantTasks: [],
      relevantDeadlines: [],
      relevantPlaces: [],
      relevantRoutines: [],
      relevantOpenLoops: [],
      relevantProjects: [],
      relevantNotes: [],
      relevantOpportunities: [],
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────

let defaultService: ContextRetrievalService | null = null;

/**
 * Get the default context retrieval service instance
 */
export function getContextRetrievalService(): ContextRetrievalService {
  if (!defaultService) {
    defaultService = new ContextRetrievalService();
  }
  return defaultService;
}

/**
 * Create a new context retrieval service instance
 */
export function createContextRetrievalService(): ContextRetrievalService {
  return new ContextRetrievalService();
}

/**
 * Reset the default service (for testing)
 */
export function resetContextRetrievalService(): void {
  defaultService = null;
}

// ─────────────────────────────────────────────────────────────
// Convenience Functions
// ─────────────────────────────────────────────────────────────

/**
 * Retrieve context for an intent (convenience function)
 */
export async function retrieveContext(
  userId: string,
  intent: IntentAnalysisResult,
  options?: RetrievalOptions
): Promise<ContextRetrieval> {
  return getContextRetrievalService().retrieveContext(userId, intent, options);
}

/**
 * Retrieve context from resolved entities (convenience function)
 */
export async function retrieveFromResolution(
  userId: string,
  resolution: ResolutionResult,
  options?: RetrievalOptions
): Promise<ContextRetrieval> {
  return getContextRetrievalService().retrieveFromResolution(
    userId,
    resolution,
    options
  );
}

/**
 * Search semantically for context (convenience function)
 */
export async function searchSemantic(
  userId: string,
  query: string,
  filters?: SemanticFilters
): Promise<SemanticMatch[]> {
  return getContextRetrievalService().searchSemantic(userId, query, filters);
}

/**
 * Get recent user interactions (convenience function)
 */
export async function getRecentInteractions(
  userId: string,
  limit: number
): Promise<Interaction[]> {
  return getContextRetrievalService().getRecentInteractions(userId, limit);
}

/**
 * Get conversation context (convenience function)
 */
export async function getConversationContext(
  conversationId: string,
  maxMessages: number
): Promise<ConversationMessage[]> {
  return getContextRetrievalService().getConversationContext(
    conversationId,
    maxMessages
  );
}

/**
 * Rank context for LLM (convenience function)
 */
export function rankContext(
  context: ContextRetrieval,
  intent: IntentAnalysisResult
): RankedContext {
  return getContextRetrievalService().rankContext(context, intent);
}


