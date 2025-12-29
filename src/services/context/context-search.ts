// ═══════════════════════════════════════════════════════════════════════════
// Context Search Service
// Unified search across all context entities with text and semantic search
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import {
  getSemanticSearchService,
  type SemanticSearchResult,
} from "@/lib/embeddings/search-service";
import type {
  EntityType,
  ContextSearchOptions,
  ContextSearchResult,
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
} from "./types";
import { excludeDeleted, extractSnippet } from "./utils";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/** Extended search options with semantic parameters */
export interface UnifiedSearchOptions extends ContextSearchOptions {
  /** Minimum similarity score for semantic results (0-1) */
  minSimilarity?: number;
  /** Weight for semantic results in combined ranking (0-1, default: 0.7) */
  semanticWeight?: number;
  /** Include content snippets in results */
  includeSnippets?: boolean;
}

/** Search service interface */
export interface IContextSearchService {
  /** Unified search across all entity types */
  search(
    userId: string,
    query: string,
    options?: UnifiedSearchOptions
  ): Promise<ContextSearchResult[]>;

  /** Search only using text matching */
  textSearch(
    userId: string,
    query: string,
    options?: ContextSearchOptions
  ): Promise<ContextSearchResult[]>;

  /** Search only using semantic similarity */
  semanticSearch(
    userId: string,
    query: string,
    options?: ContextSearchOptions & { minSimilarity?: number }
  ): Promise<ContextSearchResult[]>;
}

/** Internal map of entity ID to search result */
interface ResultMap {
  [key: string]: ContextSearchResult;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** Default search limit */
const DEFAULT_LIMIT = 20;

/** Maximum search limit */
const MAX_LIMIT = 100;

/** Default minimum similarity for semantic search */
const DEFAULT_MIN_SIMILARITY = 0.5;

/** Default weight for semantic results in combined ranking */
const DEFAULT_SEMANTIC_WEIGHT = 0.7;

/** All searchable entity types */
const ALL_ENTITY_TYPES: EntityType[] = [
  "person",
  "place",
  "event",
  "task",
  "deadline",
  "routine",
  "open_loop",
  "project",
  "note",
  "opportunity",
];

// ─────────────────────────────────────────────────────────────
// Context Search Service
// ─────────────────────────────────────────────────────────────

export class ContextSearchService implements IContextSearchService {
  /**
   * Unified search combining text and semantic search
   *
   * Results are deduplicated and ranked by a weighted combination
   * of text match score and semantic similarity.
   */
  async search(
    userId: string,
    query: string,
    options: UnifiedSearchOptions = {}
  ): Promise<ContextSearchResult[]> {
    const {
      entityTypes = ALL_ENTITY_TYPES,
      limit = DEFAULT_LIMIT,
      useSemanticSearch = true,
      minSimilarity = DEFAULT_MIN_SIMILARITY,
      semanticWeight = DEFAULT_SEMANTIC_WEIGHT,
      includeSnippets = true,
    } = options;

    const normalizedLimit = Math.min(Math.max(1, limit), MAX_LIMIT);
    const internalLimit = normalizedLimit * 2; // Fetch extra for deduplication

    // Run text and semantic search in parallel
    const [textResults, semanticResults] = await Promise.all([
      this.textSearch(userId, query, { entityTypes, limit: internalLimit }),
      useSemanticSearch
        ? this.semanticSearch(userId, query, {
            entityTypes,
            limit: internalLimit,
            minSimilarity,
          })
        : Promise.resolve([]),
    ]);

    // Merge and rank results
    const merged = this.mergeResults(
      textResults,
      semanticResults,
      semanticWeight
    );

    // Limit final results
    const limited = merged.slice(0, normalizedLimit);

    // Add snippets if requested
    if (includeSnippets) {
      return limited.map((result) => ({
        ...result,
        snippet: result.snippet ?? this.generateSnippet(result.entity, query),
      }));
    }

    return limited;
  }

  /**
   * Search using text matching only
   *
   * Searches across entity names, titles, descriptions, and other
   * text fields using case-insensitive pattern matching.
   */
  async textSearch(
    userId: string,
    query: string,
    options: ContextSearchOptions = {}
  ): Promise<ContextSearchResult[]> {
    const { entityTypes = ALL_ENTITY_TYPES, limit = DEFAULT_LIMIT } = options;

    const normalizedLimit = Math.min(Math.max(1, limit), MAX_LIMIT);
    const perTypeLimit = Math.ceil(normalizedLimit / entityTypes.length) + 5;

    const results: ContextSearchResult[] = [];

    // Search each entity type in parallel
    const searchPromises: Promise<ContextSearchResult[]>[] = [];

    if (entityTypes.includes("person")) {
      searchPromises.push(
        this.searchPeopleText(userId, query, perTypeLimit)
      );
    }

    if (entityTypes.includes("place")) {
      searchPromises.push(
        this.searchPlacesText(userId, query, perTypeLimit)
      );
    }

    if (entityTypes.includes("event")) {
      searchPromises.push(
        this.searchEventsText(userId, query, perTypeLimit)
      );
    }

    if (entityTypes.includes("task")) {
      searchPromises.push(
        this.searchTasksText(userId, query, perTypeLimit)
      );
    }

    if (entityTypes.includes("deadline")) {
      searchPromises.push(
        this.searchDeadlinesText(userId, query, perTypeLimit)
      );
    }

    if (entityTypes.includes("routine")) {
      searchPromises.push(
        this.searchRoutinesText(userId, query, perTypeLimit)
      );
    }

    if (entityTypes.includes("open_loop")) {
      searchPromises.push(
        this.searchOpenLoopsText(userId, query, perTypeLimit)
      );
    }

    if (entityTypes.includes("project")) {
      searchPromises.push(
        this.searchProjectsText(userId, query, perTypeLimit)
      );
    }

    if (entityTypes.includes("note")) {
      searchPromises.push(
        this.searchNotesText(userId, query, perTypeLimit)
      );
    }

    if (entityTypes.includes("opportunity")) {
      searchPromises.push(
        this.searchOpportunitiesText(userId, query, perTypeLimit)
      );
    }

    const allResults = await Promise.all(searchPromises);
    results.push(...allResults.flat());

    // Sort by score and limit
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, normalizedLimit);
  }

  /**
   * Search using semantic similarity only
   *
   * Uses vector embeddings to find semantically similar content.
   */
  async semanticSearch(
    userId: string,
    query: string,
    options: ContextSearchOptions & { minSimilarity?: number } = {}
  ): Promise<ContextSearchResult[]> {
    const {
      entityTypes = ALL_ENTITY_TYPES,
      limit = DEFAULT_LIMIT,
      minSimilarity = DEFAULT_MIN_SIMILARITY,
    } = options;

    const normalizedLimit = Math.min(Math.max(1, limit), MAX_LIMIT);

    try {
      const semanticService = getSemanticSearchService();
      const semanticResults = await semanticService.searchSimilar({
        userId,
        query,
        entityTypes,
        limit: normalizedLimit,
        minSimilarity,
      });

      // Fetch actual entities for each result
      const enrichedResults = await this.enrichSemanticResults(
        userId,
        semanticResults
      );

      return enrichedResults;
    } catch (error) {
      // If semantic search fails (e.g., no OpenAI key), return empty
      console.warn("Semantic search failed, falling back to empty results:", error);
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Text Search Helpers
  // ─────────────────────────────────────────────────────────────

  private async searchPeopleText(
    userId: string,
    query: string,
    limit: number
  ): Promise<ContextSearchResult[]> {
    const people = await db.person.findMany({
      where: {
        userId,
        ...excludeDeleted(),
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
          { company: { contains: query, mode: "insensitive" } },
          { title: { contains: query, mode: "insensitive" } },
          { bio: { contains: query, mode: "insensitive" } },
          { notes: { contains: query, mode: "insensitive" } },
          { tags: { hasSome: [query.toLowerCase()] } },
        ],
      },
      take: limit,
      orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
    });

    return people.map((person, index) => ({
      entityType: "person" as EntityType,
      entityId: person.id,
      entity: person,
      score: this.calculateTextScore(person, query, index, limit),
      matchType: "text" as const,
    }));
  }

  private async searchPlacesText(
    userId: string,
    query: string,
    limit: number
  ): Promise<ContextSearchResult[]> {
    const places = await db.place.findMany({
      where: {
        userId,
        ...excludeDeleted(),
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { address: { contains: query, mode: "insensitive" } },
          { city: { contains: query, mode: "insensitive" } },
          { country: { contains: query, mode: "insensitive" } },
          { notes: { contains: query, mode: "insensitive" } },
          { tags: { hasSome: [query.toLowerCase()] } },
        ],
      },
      take: limit,
      orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
    });

    return places.map((place, index) => ({
      entityType: "place" as EntityType,
      entityId: place.id,
      entity: place,
      score: this.calculateTextScore(place, query, index, limit),
      matchType: "text" as const,
    }));
  }

  private async searchEventsText(
    userId: string,
    query: string,
    limit: number
  ): Promise<ContextSearchResult[]> {
    const events = await db.event.findMany({
      where: {
        userId,
        ...excludeDeleted(),
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { location: { contains: query, mode: "insensitive" } },
          { notes: { contains: query, mode: "insensitive" } },
          { tags: { hasSome: [query.toLowerCase()] } },
        ],
      },
      take: limit,
      orderBy: [{ importance: "desc" }, { startsAt: "desc" }],
    });

    return events.map((event, index) => ({
      entityType: "event" as EntityType,
      entityId: event.id,
      entity: event,
      score: this.calculateTextScore(event, query, index, limit),
      matchType: "text" as const,
    }));
  }

  private async searchTasksText(
    userId: string,
    query: string,
    limit: number
  ): Promise<ContextSearchResult[]> {
    const tasks = await db.task.findMany({
      where: {
        userId,
        ...excludeDeleted(),
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { notes: { contains: query, mode: "insensitive" } },
          { tags: { hasSome: [query.toLowerCase()] } },
        ],
      },
      take: limit,
      orderBy: [{ priority: "asc" }, { dueDate: "asc" }, { updatedAt: "desc" }],
    });

    return tasks.map((task, index) => ({
      entityType: "task" as EntityType,
      entityId: task.id,
      entity: task,
      score: this.calculateTextScore(task, query, index, limit),
      matchType: "text" as const,
    }));
  }

  private async searchDeadlinesText(
    userId: string,
    query: string,
    limit: number
  ): Promise<ContextSearchResult[]> {
    const deadlines = await db.deadline.findMany({
      where: {
        userId,
        ...excludeDeleted(),
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { notes: { contains: query, mode: "insensitive" } },
          { consequences: { contains: query, mode: "insensitive" } },
          { tags: { hasSome: [query.toLowerCase()] } },
        ],
      },
      take: limit,
      orderBy: [{ importance: "desc" }, { dueAt: "asc" }],
    });

    return deadlines.map((deadline, index) => ({
      entityType: "deadline" as EntityType,
      entityId: deadline.id,
      entity: deadline,
      score: this.calculateTextScore(deadline, query, index, limit),
      matchType: "text" as const,
    }));
  }

  private async searchRoutinesText(
    userId: string,
    query: string,
    limit: number
  ): Promise<ContextSearchResult[]> {
    const routines = await db.routine.findMany({
      where: {
        userId,
        ...excludeDeleted(),
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { category: { contains: query, mode: "insensitive" } },
          { notes: { contains: query, mode: "insensitive" } },
          { tags: { hasSome: [query.toLowerCase()] } },
        ],
      },
      take: limit,
      orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
    });

    return routines.map((routine, index) => ({
      entityType: "routine" as EntityType,
      entityId: routine.id,
      entity: routine,
      score: this.calculateTextScore(routine, query, index, limit),
      matchType: "text" as const,
    }));
  }

  private async searchOpenLoopsText(
    userId: string,
    query: string,
    limit: number
  ): Promise<ContextSearchResult[]> {
    const openLoops = await db.openLoop.findMany({
      where: {
        userId,
        ...excludeDeleted(),
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { context: { contains: query, mode: "insensitive" } },
          { tags: { hasSome: [query.toLowerCase()] } },
        ],
      },
      take: limit,
      orderBy: [{ priority: "desc" }, { dueAt: "asc" }, { updatedAt: "desc" }],
    });

    return openLoops.map((openLoop, index) => ({
      entityType: "open_loop" as EntityType,
      entityId: openLoop.id,
      entity: openLoop,
      score: this.calculateTextScore(openLoop, query, index, limit),
      matchType: "text" as const,
    }));
  }

  private async searchProjectsText(
    userId: string,
    query: string,
    limit: number
  ): Promise<ContextSearchResult[]> {
    const projects = await db.project.findMany({
      where: {
        userId,
        ...excludeDeleted(),
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { objective: { contains: query, mode: "insensitive" } },
          { notes: { contains: query, mode: "insensitive" } },
          { tags: { hasSome: [query.toLowerCase()] } },
        ],
      },
      take: limit,
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { updatedAt: "desc" }],
    });

    return projects.map((project, index) => ({
      entityType: "project" as EntityType,
      entityId: project.id,
      entity: project,
      score: this.calculateTextScore(project, query, index, limit),
      matchType: "text" as const,
    }));
  }

  private async searchNotesText(
    userId: string,
    query: string,
    limit: number
  ): Promise<ContextSearchResult[]> {
    const notes = await db.note.findMany({
      where: {
        userId,
        ...excludeDeleted(),
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { content: { contains: query, mode: "insensitive" } },
          { category: { contains: query, mode: "insensitive" } },
          { tags: { hasSome: [query.toLowerCase()] } },
        ],
      },
      take: limit,
      orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
    });

    return notes.map((note, index) => ({
      entityType: "note" as EntityType,
      entityId: note.id,
      entity: note,
      score: this.calculateTextScore(note, query, index, limit),
      matchType: "text" as const,
    }));
  }

  private async searchOpportunitiesText(
    userId: string,
    query: string,
    limit: number
  ): Promise<ContextSearchResult[]> {
    const opportunities = await db.opportunity.findMany({
      where: {
        userId,
        ...excludeDeleted(),
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { context: { contains: query, mode: "insensitive" } },
          { tags: { hasSome: [query.toLowerCase()] } },
        ],
      },
      take: limit,
      orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
    });

    return opportunities.map((opportunity, index) => ({
      entityType: "opportunity" as EntityType,
      entityId: opportunity.id,
      entity: opportunity,
      score: this.calculateTextScore(opportunity, query, index, limit),
      matchType: "text" as const,
    }));
  }

  // ─────────────────────────────────────────────────────────────
  // Scoring & Merging
  // ─────────────────────────────────────────────────────────────

  /**
   * Calculate a text match score based on position and match quality
   */
  private calculateTextScore(
    entity: Person | Place | Event | Task | Deadline | Routine | OpenLoop | Project | Note | Opportunity,
    query: string,
    position: number,
    total: number
  ): number {
    const queryLower = query.toLowerCase();

    // Base score from position
    let score = 1 - (position / total) * 0.3;

    // Boost for exact title/name match
    const title = this.getEntityTitle(entity);
    if (title.toLowerCase() === queryLower) {
      score += 0.3;
    } else if (title.toLowerCase().startsWith(queryLower)) {
      score += 0.2;
    } else if (title.toLowerCase().includes(queryLower)) {
      score += 0.1;
    }

    // Ensure score is between 0 and 1
    return Math.min(1, Math.max(0, score));
  }

  /**
   * Get the primary title/name field from an entity
   */
  private getEntityTitle(entity: Person | Place | Event | Task | Deadline | Routine | OpenLoop | Project | Note | Opportunity): string {
    if ("name" in entity && entity.name) {
      return entity.name;
    }
    if ("title" in entity && entity.title) {
      return entity.title;
    }
    // For notes, fall back to content snippet if no title
    if ("content" in entity) {
      return entity.content.substring(0, 50);
    }
    return "";
  }

  /**
   * Merge text and semantic results with weighted scoring
   */
  private mergeResults(
    textResults: ContextSearchResult[],
    semanticResults: ContextSearchResult[],
    semanticWeight: number
  ): ContextSearchResult[] {
    const textWeight = 1 - semanticWeight;
    const merged: ResultMap = {};

    // Add text results
    for (const result of textResults) {
      const key = `${result.entityType}:${result.entityId}`;
      merged[key] = {
        ...result,
        score: result.score * textWeight,
        matchType: "text",
      };
    }

    // Add/merge semantic results
    for (const result of semanticResults) {
      const key = `${result.entityType}:${result.entityId}`;
      if (merged[key]) {
        // Entity found by both searches
        merged[key].score += result.score * semanticWeight;
        merged[key].matchType = "both";
        // Keep the snippet from semantic search if available
        if (result.snippet) {
          merged[key].snippet = result.snippet;
        }
      } else {
        // Only found by semantic search
        merged[key] = {
          ...result,
          score: result.score * semanticWeight,
          matchType: "semantic",
        };
      }
    }

    // Convert to array and sort by score
    return Object.values(merged).sort((a, b) => b.score - a.score);
  }

  /**
   * Enrich semantic search results with actual entity data
   */
  private async enrichSemanticResults(
    userId: string,
    results: SemanticSearchResult[]
  ): Promise<ContextSearchResult[]> {
    if (results.length === 0) {
      return [];
    }

    // Group results by entity type for batch fetching
    const byType: Record<EntityType, SemanticSearchResult[]> = {
      person: [],
      place: [],
      event: [],
      task: [],
      deadline: [],
      routine: [],
      open_loop: [],
      project: [],
      note: [],
      opportunity: [],
    };

    for (const result of results) {
      byType[result.entityType].push(result);
    }

    // Fetch entities by type
    const [people, places, events, tasks, deadlines, routines, openLoops, projects, notes, opportunities] = await Promise.all([
      byType.person.length > 0
        ? db.person.findMany({
            where: {
              userId,
              id: { in: byType.person.map((r) => r.entityId) },
              ...excludeDeleted(),
            },
          })
        : Promise.resolve([]),
      byType.place.length > 0
        ? db.place.findMany({
            where: {
              userId,
              id: { in: byType.place.map((r) => r.entityId) },
              ...excludeDeleted(),
            },
          })
        : Promise.resolve([]),
      byType.event.length > 0
        ? db.event.findMany({
            where: {
              userId,
              id: { in: byType.event.map((r) => r.entityId) },
              ...excludeDeleted(),
            },
          })
        : Promise.resolve([]),
      byType.task.length > 0
        ? db.task.findMany({
            where: {
              userId,
              id: { in: byType.task.map((r) => r.entityId) },
              ...excludeDeleted(),
            },
          })
        : Promise.resolve([]),
      byType.deadline.length > 0
        ? db.deadline.findMany({
            where: {
              userId,
              id: { in: byType.deadline.map((r) => r.entityId) },
              ...excludeDeleted(),
            },
          })
        : Promise.resolve([]),
      byType.routine.length > 0
        ? db.routine.findMany({
            where: {
              userId,
              id: { in: byType.routine.map((r) => r.entityId) },
              ...excludeDeleted(),
            },
          })
        : Promise.resolve([]),
      byType.open_loop.length > 0
        ? db.openLoop.findMany({
            where: {
              userId,
              id: { in: byType.open_loop.map((r) => r.entityId) },
              ...excludeDeleted(),
            },
          })
        : Promise.resolve([]),
      byType.project.length > 0
        ? db.project.findMany({
            where: {
              userId,
              id: { in: byType.project.map((r) => r.entityId) },
              ...excludeDeleted(),
            },
          })
        : Promise.resolve([]),
      byType.note.length > 0
        ? db.note.findMany({
            where: {
              userId,
              id: { in: byType.note.map((r) => r.entityId) },
              ...excludeDeleted(),
            },
          })
        : Promise.resolve([]),
      byType.opportunity.length > 0
        ? db.opportunity.findMany({
            where: {
              userId,
              id: { in: byType.opportunity.map((r) => r.entityId) },
              ...excludeDeleted(),
            },
          })
        : Promise.resolve([]),
    ]);

    // Create lookup maps
    const entityMaps: Record<EntityType, Map<string, unknown>> = {
      person: new Map(people.map((p) => [p.id, p])),
      place: new Map(places.map((p) => [p.id, p])),
      event: new Map(events.map((e) => [e.id, e])),
      task: new Map(tasks.map((t) => [t.id, t])),
      deadline: new Map(deadlines.map((d) => [d.id, d])),
      routine: new Map(routines.map((r) => [r.id, r])),
      open_loop: new Map(openLoops.map((o) => [o.id, o])),
      project: new Map(projects.map((p) => [p.id, p])),
      note: new Map(notes.map((n) => [n.id, n])),
      opportunity: new Map(opportunities.map((o) => [o.id, o])),
    };

    // Map results with entities
    const enriched: ContextSearchResult[] = [];

    for (const result of results) {
      const entity = entityMaps[result.entityType].get(result.entityId);
      if (entity) {
        enriched.push({
          entityType: result.entityType,
          entityId: result.entityId,
          entity: entity as Person | Place | Event | Task | Deadline | Routine | OpenLoop | Project | Note | Opportunity,
          score: result.similarity,
          matchType: "semantic",
          snippet: result.content,
        });
      }
    }

    return enriched;
  }

  /**
   * Generate a snippet from entity content
   */
  private generateSnippet(
    entity: Person | Place | Event | Task | Deadline | Routine | OpenLoop | Project | Note | Opportunity,
    query: string
  ): string | undefined {
    // Get searchable text from entity
    const texts: string[] = [];

    if ("name" in entity && entity.name) texts.push(entity.name);
    if ("title" in entity && entity.title) texts.push(entity.title);
    if ("description" in entity && entity.description)
      texts.push(entity.description);
    if ("bio" in entity && entity.bio) texts.push(entity.bio);
    if ("notes" in entity && entity.notes) texts.push(entity.notes);
    if ("content" in entity && entity.content) texts.push(entity.content);
    if ("objective" in entity && entity.objective) texts.push(entity.objective);
    if ("context" in entity && entity.context) texts.push(entity.context);

    const content = texts.join(" ");

    if (!content) {
      return undefined;
    }

    return extractSnippet(content, query, 150);
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────

let defaultService: ContextSearchService | null = null;

/**
 * Get the default context search service instance
 */
export function getContextSearchService(): ContextSearchService {
  if (!defaultService) {
    defaultService = new ContextSearchService();
  }
  return defaultService;
}

/**
 * Create a new context search service instance
 */
export function createContextSearchService(): ContextSearchService {
  return new ContextSearchService();
}

// ─────────────────────────────────────────────────────────────
// Convenience Functions
// ─────────────────────────────────────────────────────────────

/**
 * Unified search across all context entities (convenience function)
 */
export async function searchContext(
  userId: string,
  query: string,
  options?: UnifiedSearchOptions
): Promise<ContextSearchResult[]> {
  return getContextSearchService().search(userId, query, options);
}

/**
 * Text-only search across all context entities (convenience function)
 */
export async function textSearchContext(
  userId: string,
  query: string,
  options?: ContextSearchOptions
): Promise<ContextSearchResult[]> {
  return getContextSearchService().textSearch(userId, query, options);
}

/**
 * Semantic-only search across all context entities (convenience function)
 */
export async function semanticSearchContext(
  userId: string,
  query: string,
  options?: ContextSearchOptions & { minSimilarity?: number }
): Promise<ContextSearchResult[]> {
  return getContextSearchService().semanticSearch(userId, query, options);
}

