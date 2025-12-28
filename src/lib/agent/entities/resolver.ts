// ═══════════════════════════════════════════════════════════════════════════
// Entity Resolver
// Resolves LLM-extracted entities to database records
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import { searchContext } from "@/services/context/context-search";
import { searchPeople } from "@/services/context/people";
import { searchPlaces } from "@/services/context/places";
import { searchDeadlines } from "@/services/context/deadlines";
import { searchRoutines } from "@/services/context/routines";
import { searchOpenLoops } from "@/services/context/open-loops";
import { searchProjects } from "@/services/context/projects";
import { searchNotes } from "@/services/context/notes";
import type { Person, Event, Task, Place, Deadline, Routine, OpenLoop, Project, Note } from "@/services/context/types";
import type { Email } from "@prisma/client";
import type { LLMExtractedEntity } from "../intent";
import { ENTITY_TYPES } from "../constants";
import { agentLogger } from "../logger";
import {
  nameSimilarity,
  textSimilarity,
  nameMatchesEmail,
  couldBeNickname,
  generateDisambiguationQuestion,
  generateNotFoundMessage,
  rankCandidates,
} from "./matchers";
import {
  type ResolvedEntity,
  type ResolutionResult,
  type ResolutionCandidate,
  type PersonResolutionHints,
  type EventResolutionHints,
  type TaskResolutionHints,
  type EmailResolutionHints,
  type PlaceResolutionHints,
  type DeadlineResolutionHints,
  type RoutineResolutionHints,
  type OpenLoopResolutionHints,
  type ProjectResolutionHints,
  type NoteResolutionHints,
  type ResolverConfig,
  type IEntityResolver,
  DEFAULT_RESOLVER_CONFIG,
  EntityResolutionError,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Entity Resolver Implementation
// ─────────────────────────────────────────────────────────────

export class EntityResolver implements IEntityResolver {
  private config: Required<ResolverConfig>;

  constructor(config?: ResolverConfig) {
    this.config = { ...DEFAULT_RESOLVER_CONFIG, ...config };
  }

  /**
   * Resolve multiple LLM-extracted entities to database records
   */
  async resolveEntities(
    userId: string,
    entities: LLMExtractedEntity[]
  ): Promise<ResolutionResult> {
    const result: ResolutionResult = {
      entities: [],
      resolved: [],
      ambiguous: [],
      notFound: [],
      needsClarification: false,
      clarificationQuestions: [],
    };

    // Only resolve entities that need resolution
    const entitiesToResolve = entities.filter((e) => e.needsResolution);

    agentLogger.debug("Resolving entities", {
      total: entities.length,
      toResolve: entitiesToResolve.length,
    });

    // Resolve each entity
    for (const entity of entitiesToResolve) {
      try {
        const resolved = await this.resolveEntity(userId, entity);
        result.entities.push(resolved);

        switch (resolved.status) {
          case "resolved":
            result.resolved.push(resolved);
            break;
          case "ambiguous":
            result.ambiguous.push(resolved);
            break;
          case "not_found":
            result.notFound.push(resolved);
            break;
        }
      } catch (error) {
        agentLogger.warn("Failed to resolve entity", {
          entity,
          error: error instanceof Error ? error.message : String(error),
        });

        // Add as not_found with error
        const failedResolution: ResolvedEntity = {
          extracted: entity,
          status: "not_found",
          confidence: 0,
          error:
            error instanceof Error
              ? error.message
              : "Unknown resolution error",
        };
        result.entities.push(failedResolution);
        result.notFound.push(failedResolution);
      }
    }

    // Generate clarification questions for ambiguous entities
    if (result.ambiguous.length > 0) {
      result.needsClarification = true;
      result.clarificationQuestions = result.ambiguous.map((entity) =>
        generateDisambiguationQuestion(
          entity.extracted.type,
          entity.extracted.text,
          entity.candidates ?? []
        )
      );
    }

    // Also flag if there are critical not-found entities
    const criticalNotFound = result.notFound.filter(
      (e) => e.extracted.type === ENTITY_TYPES.PERSON
    );
    if (criticalNotFound.length > 0) {
      result.needsClarification = true;
      result.clarificationQuestions.push(
        ...criticalNotFound.map((e) =>
          generateNotFoundMessage(e.extracted.type, e.extracted.text)
        )
      );
    }

    agentLogger.info("Entity resolution complete", {
      resolved: result.resolved.length,
      ambiguous: result.ambiguous.length,
      notFound: result.notFound.length,
      needsClarification: result.needsClarification,
    });

    return result;
  }

  /**
   * Resolve a single entity based on its type
   */
  private async resolveEntity(
    userId: string,
    entity: LLMExtractedEntity
  ): Promise<ResolvedEntity> {
    switch (entity.type) {
      case ENTITY_TYPES.PERSON:
        return this.resolvePerson(userId, entity.text);

      case ENTITY_TYPES.EVENT:
        return this.resolveEvent(userId, entity.text);

      case ENTITY_TYPES.TASK:
        return this.resolveTask(userId, entity.text);

      case ENTITY_TYPES.EMAIL:
        return this.resolveEmail(userId, entity.text);

      case ENTITY_TYPES.PLACE:
      case ENTITY_TYPES.LOCATION:
        return this.resolvePlace(userId, entity.text);

      case ENTITY_TYPES.DEADLINE:
        return this.resolveDeadline(userId, entity.text);

      case ENTITY_TYPES.ROUTINE:
        return this.resolveRoutine(userId, entity.text);

      case ENTITY_TYPES.OPEN_LOOP:
        return this.resolveOpenLoop(userId, entity.text);

      case ENTITY_TYPES.PROJECT:
        return this.resolveProject(userId, entity.text);

      case ENTITY_TYPES.NOTE:
        return this.resolveNote(userId, entity.text);

      default:
        // For unhandled types, return as not found
        return {
          extracted: entity,
          status: "not_found",
          confidence: 0,
          error: `Entity type "${entity.type}" is not resolvable`,
        };
    }
  }

  /**
   * Resolve a person reference to a Person record
   */
  async resolvePerson(
    userId: string,
    name: string,
    hints?: PersonResolutionHints
  ): Promise<ResolvedEntity<Person>> {
    const entity: LLMExtractedEntity = {
      type: ENTITY_TYPES.PERSON,
      text: name,
      value: name,
      needsResolution: true,
    };

    try {
      // First, try exact email match if hint provided
      if (hints?.email) {
        const exactMatch = await db.person.findFirst({
          where: {
            userId,
            email: hints.email.toLowerCase(),
            deletedAt: null,
          },
        });

        if (exactMatch) {
          return {
            extracted: entity,
            status: "resolved",
            match: {
              id: exactMatch.id,
              type: "person",
              record: exactMatch,
              confidence: 1.0,
              matchMethod: "exact",
            },
            confidence: 1.0,
          };
        }
      }

      // Search for people matching the name
      const candidates = await searchPeople(userId, name, { limit: 10 });

      if (candidates.length === 0) {
        // Try semantic search as fallback
        if (this.config.useSemanticSearch) {
          const semanticResults = await searchContext(userId, name, {
            entityTypes: ["person"],
            limit: 10,
            minSimilarity: this.config.semanticThreshold,
          });

          if (semanticResults.length > 0) {
            return this.processPersonCandidates(
              entity,
              semanticResults.map((r) => r.entity as Person),
              name,
              hints
            );
          }
        }

        return {
          extracted: entity,
          status: "not_found",
          confidence: 0,
        };
      }

      return this.processPersonCandidates(entity, candidates, name, hints);
    } catch (error) {
      throw new EntityResolutionError(
        "RESOLUTION_FAILED",
        `Failed to resolve person "${name}"`,
        { name, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Process person candidates and determine resolution status
   */
  private processPersonCandidates(
    entity: LLMExtractedEntity,
    candidates: Person[],
    query: string,
    hints?: PersonResolutionHints
  ): ResolvedEntity<Person> {
    // Score each candidate
    const scoredCandidates: Array<{
      person: Person;
      score: number;
      matchReason: string;
    }> = [];

    for (const person of candidates) {
      let score = nameSimilarity(query, person.name);
      let matchReason = "Name similarity";

      // Boost for email match
      if (hints?.email && person.email === hints.email.toLowerCase()) {
        score = 1.0;
        matchReason = "Email exact match";
      } else if (person.email && nameMatchesEmail(query, person.email)) {
        score = Math.max(score, 0.9);
        matchReason = "Name matches email";
      }

      // Boost for nickname match
      if (couldBeNickname(query, person.name)) {
        score = Math.max(score, 0.85);
        matchReason = "Possible nickname";
      }

      // Boost for company context match
      if (hints?.company && person.company) {
        if (person.company.toLowerCase().includes(hints.company.toLowerCase())) {
          score += 0.1;
          matchReason += " + company match";
        }
      }

      // Cap score at 1.0
      scoredCandidates.push({ person, score: Math.min(1, score), matchReason });
    }

    // Sort by score descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    const topCandidate = scoredCandidates[0];

    // High confidence match
    if (topCandidate.score >= this.config.exactMatchThreshold) {
      return {
        extracted: entity,
        status: "resolved",
        match: {
          id: topCandidate.person.id,
          type: "person",
          record: topCandidate.person,
          confidence: topCandidate.score,
          matchMethod: topCandidate.score === 1.0 ? "exact" : "fuzzy",
        },
        confidence: topCandidate.score,
      };
    }

    // Check for clear winner vs ambiguous
    if (
      topCandidate.score >= this.config.fuzzyMatchThreshold &&
      (scoredCandidates.length === 1 ||
        topCandidate.score - scoredCandidates[1].score > 0.2)
    ) {
      return {
        extracted: entity,
        status: "resolved",
        match: {
          id: topCandidate.person.id,
          type: "person",
          record: topCandidate.person,
          confidence: topCandidate.score,
          matchMethod: "fuzzy",
        },
        confidence: topCandidate.score,
      };
    }

    // Ambiguous - multiple good matches
    if (
      topCandidate.score >= this.config.fuzzyMatchThreshold &&
      scoredCandidates.filter((c) => c.score >= this.config.fuzzyMatchThreshold)
        .length > 1
    ) {
      const resolutionCandidates: ResolutionCandidate[] = scoredCandidates
        .filter((c) => c.score >= this.config.fuzzyMatchThreshold)
        .slice(0, this.config.maxCandidates)
        .map((c) => ({
          id: c.person.id,
          label: c.person.email
            ? `${c.person.name} (${c.person.email})`
            : c.person.name,
          confidence: c.score,
          matchReason: c.matchReason,
        }));

      return {
        extracted: entity,
        status: "ambiguous",
        candidates: rankCandidates(resolutionCandidates),
        confidence: topCandidate.score,
      };
    }

    // Not found (scores too low)
    return {
      extracted: entity,
      status: "not_found",
      confidence: topCandidate.score,
    };
  }

  /**
   * Resolve an event reference to an Event record
   */
  async resolveEvent(
    userId: string,
    description: string,
    hints?: EventResolutionHints
  ): Promise<ResolvedEntity<Event>> {
    const entity: LLMExtractedEntity = {
      type: ENTITY_TYPES.EVENT,
      text: description,
      value: description,
      needsResolution: true,
    };

    try {
      // Build date filter if hints provided
      const dateFilter = hints?.dateRange
        ? {
            startsAt: {
              gte: hints.dateRange.start,
              lte: hints.dateRange.end,
            },
          }
        : {};

      // Search for events using semantic search
      const results = await searchContext(userId, description, {
        entityTypes: ["event"],
        limit: 10,
        minSimilarity: this.config.semanticThreshold,
      });

      // If date hints provided, filter results
      let filteredResults = results;
      if (hints?.dateRange) {
        filteredResults = results.filter((r) => {
          const event = r.entity as Event;
          return (
            event.startsAt >= hints.dateRange!.start &&
            event.startsAt <= hints.dateRange!.end
          );
        });
      }

      if (filteredResults.length === 0) {
        // Try database text search as fallback
        const events = await db.event.findMany({
          where: {
            userId,
            deletedAt: null,
            ...dateFilter,
            OR: [
              { title: { contains: description, mode: "insensitive" } },
              { description: { contains: description, mode: "insensitive" } },
            ],
          },
          take: 10,
          orderBy: { startsAt: "desc" },
        });

        if (events.length === 0) {
          return {
            extracted: entity,
            status: "not_found",
            confidence: 0,
          };
        }

        return this.processEventCandidates(entity, events, description);
      }

      return this.processEventCandidates(
        entity,
        filteredResults.map((r) => r.entity as Event),
        description
      );
    } catch (error) {
      throw new EntityResolutionError(
        "RESOLUTION_FAILED",
        `Failed to resolve event "${description}"`,
        {
          description,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  /**
   * Process event candidates and determine resolution status
   */
  private processEventCandidates(
    entity: LLMExtractedEntity,
    candidates: Event[],
    query: string
  ): ResolvedEntity<Event> {
    // Score each candidate
    const scoredCandidates: Array<{
      event: Event;
      score: number;
    }> = [];

    for (const event of candidates) {
      const titleScore = textSimilarity(query, event.title);
      const descScore = event.description
        ? textSimilarity(query, event.description) * 0.8
        : 0;

      scoredCandidates.push({
        event,
        score: Math.max(titleScore, descScore),
      });
    }

    // Sort by score descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    const topCandidate = scoredCandidates[0];

    // High confidence match
    if (topCandidate.score >= this.config.exactMatchThreshold) {
      return {
        extracted: entity,
        status: "resolved",
        match: {
          id: topCandidate.event.id,
          type: "event",
          record: topCandidate.event,
          confidence: topCandidate.score,
          matchMethod: "semantic",
        },
        confidence: topCandidate.score,
      };
    }

    // Clear winner
    if (
      topCandidate.score >= this.config.fuzzyMatchThreshold &&
      (scoredCandidates.length === 1 ||
        topCandidate.score - scoredCandidates[1].score > 0.15)
    ) {
      return {
        extracted: entity,
        status: "resolved",
        match: {
          id: topCandidate.event.id,
          type: "event",
          record: topCandidate.event,
          confidence: topCandidate.score,
          matchMethod: "fuzzy",
        },
        confidence: topCandidate.score,
      };
    }

    // Ambiguous
    if (
      topCandidate.score >= this.config.fuzzyMatchThreshold &&
      scoredCandidates.filter((c) => c.score >= this.config.fuzzyMatchThreshold)
        .length > 1
    ) {
      const resolutionCandidates: ResolutionCandidate[] = scoredCandidates
        .filter((c) => c.score >= this.config.fuzzyMatchThreshold)
        .slice(0, this.config.maxCandidates)
        .map((c) => ({
          id: c.event.id,
          label: `${c.event.title} (${c.event.startsAt.toLocaleDateString()})`,
          confidence: c.score,
        }));

      return {
        extracted: entity,
        status: "ambiguous",
        candidates: rankCandidates(resolutionCandidates),
        confidence: topCandidate.score,
      };
    }

    return {
      extracted: entity,
      status: "not_found",
      confidence: topCandidate.score,
    };
  }

  /**
   * Resolve a task reference to a Task record
   */
  async resolveTask(
    userId: string,
    description: string,
    hints?: TaskResolutionHints
  ): Promise<ResolvedEntity<Task>> {
    const entity: LLMExtractedEntity = {
      type: ENTITY_TYPES.TASK,
      text: description,
      value: description,
      needsResolution: true,
    };

    try {
      // Build filters from hints
      const filters: Record<string, unknown> = {};
      if (hints?.status) filters.status = hints.status;
      if (hints?.priority) filters.priority = hints.priority;
      if (hints?.tags?.length) filters.tags = { hasSome: hints.tags };

      // Search for tasks using semantic search
      const results = await searchContext(userId, description, {
        entityTypes: ["task"],
        limit: 10,
        minSimilarity: this.config.semanticThreshold,
      });

      if (results.length === 0) {
        // Try database text search as fallback
        const tasks = await db.task.findMany({
          where: {
            userId,
            deletedAt: null,
            ...filters,
            OR: [
              { title: { contains: description, mode: "insensitive" } },
              { description: { contains: description, mode: "insensitive" } },
            ],
          },
          take: 10,
          orderBy: { updatedAt: "desc" },
        });

        if (tasks.length === 0) {
          return {
            extracted: entity,
            status: "not_found",
            confidence: 0,
          };
        }

        return this.processTaskCandidates(entity, tasks, description);
      }

      return this.processTaskCandidates(
        entity,
        results.map((r) => r.entity as Task),
        description
      );
    } catch (error) {
      throw new EntityResolutionError(
        "RESOLUTION_FAILED",
        `Failed to resolve task "${description}"`,
        {
          description,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  /**
   * Process task candidates and determine resolution status
   */
  private processTaskCandidates(
    entity: LLMExtractedEntity,
    candidates: Task[],
    query: string
  ): ResolvedEntity<Task> {
    // Score each candidate
    const scoredCandidates: Array<{
      task: Task;
      score: number;
    }> = [];

    for (const task of candidates) {
      const titleScore = textSimilarity(query, task.title);
      const descScore = task.description
        ? textSimilarity(query, task.description) * 0.8
        : 0;

      scoredCandidates.push({
        task,
        score: Math.max(titleScore, descScore),
      });
    }

    // Sort by score descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    const topCandidate = scoredCandidates[0];

    // High confidence match
    if (topCandidate.score >= this.config.exactMatchThreshold) {
      return {
        extracted: entity,
        status: "resolved",
        match: {
          id: topCandidate.task.id,
          type: "task",
          record: topCandidate.task,
          confidence: topCandidate.score,
          matchMethod: "semantic",
        },
        confidence: topCandidate.score,
      };
    }

    // Clear winner
    if (
      topCandidate.score >= this.config.fuzzyMatchThreshold &&
      (scoredCandidates.length === 1 ||
        topCandidate.score - scoredCandidates[1].score > 0.15)
    ) {
      return {
        extracted: entity,
        status: "resolved",
        match: {
          id: topCandidate.task.id,
          type: "task",
          record: topCandidate.task,
          confidence: topCandidate.score,
          matchMethod: "fuzzy",
        },
        confidence: topCandidate.score,
      };
    }

    // Ambiguous
    if (
      topCandidate.score >= this.config.fuzzyMatchThreshold &&
      scoredCandidates.filter((c) => c.score >= this.config.fuzzyMatchThreshold)
        .length > 1
    ) {
      const resolutionCandidates: ResolutionCandidate[] = scoredCandidates
        .filter((c) => c.score >= this.config.fuzzyMatchThreshold)
        .slice(0, this.config.maxCandidates)
        .map((c) => ({
          id: c.task.id,
          label: c.task.title,
          confidence: c.score,
        }));

      return {
        extracted: entity,
        status: "ambiguous",
        candidates: rankCandidates(resolutionCandidates),
        confidence: topCandidate.score,
      };
    }

    return {
      extracted: entity,
      status: "not_found",
      confidence: topCandidate.score,
    };
  }

  /**
   * Resolve an email reference to an Email record
   */
  async resolveEmail(
    userId: string,
    description: string,
    hints?: EmailResolutionHints
  ): Promise<ResolvedEntity<Email>> {
    const entity: LLMExtractedEntity = {
      type: ENTITY_TYPES.EMAIL,
      text: description,
      value: description,
      needsResolution: true,
    };

    try {
      // Build date filter if hints provided
      const dateFilter = hints?.dateRange
        ? {
            receivedAt: {
              gte: hints.dateRange.start,
              lte: hints.dateRange.end,
            },
          }
        : {};

      // Build sender filter if hints provided
      const senderFilter = hints?.sender
        ? {
            OR: [
              { fromAddress: { contains: hints.sender, mode: "insensitive" as const } },
              { fromName: { contains: hints.sender, mode: "insensitive" as const } },
            ],
          }
        : {};

      // Build draft filter - by default exclude drafts unless explicitly included
      const draftFilter = hints?.includeDrafts === true
        ? {} // Include all emails (drafts and non-drafts)
        : { isDraft: false }; // Exclude drafts by default

      // Build labels filter if hints provided
      const labelsFilter = hints?.labels && hints.labels.length > 0
        ? { labelIds: { hasSome: hints.labels } }
        : {};

      // Search for emails
      const emails = await db.email.findMany({
        where: {
          userId,
          ...dateFilter,
          ...senderFilter,
          ...draftFilter,
          ...labelsFilter,
          OR: [
            { subject: { contains: description, mode: "insensitive" } },
            { snippet: { contains: description, mode: "insensitive" } },
          ],
        },
        take: 10,
        orderBy: { receivedAt: "desc" },
      });

      if (emails.length === 0) {
        return {
          extracted: entity,
          status: "not_found",
          confidence: 0,
        };
      }

      return this.processEmailCandidates(entity, emails, description);
    } catch (error) {
      throw new EntityResolutionError(
        "RESOLUTION_FAILED",
        `Failed to resolve email "${description}"`,
        {
          description,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  /**
   * Process email candidates and determine resolution status
   */
  private processEmailCandidates(
    entity: LLMExtractedEntity,
    candidates: Email[],
    query: string
  ): ResolvedEntity<Email> {
    // Score each candidate
    const scoredCandidates: Array<{
      email: Email;
      score: number;
    }> = [];

    for (const email of candidates) {
      const subjectScore = email.subject
        ? textSimilarity(query, email.subject)
        : 0;
      const snippetScore = email.snippet
        ? textSimilarity(query, email.snippet) * 0.7
        : 0;

      scoredCandidates.push({
        email,
        score: Math.max(subjectScore, snippetScore),
      });
    }

    // Sort by score descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    const topCandidate = scoredCandidates[0];

    // High confidence match
    if (topCandidate.score >= this.config.exactMatchThreshold) {
      return {
        extracted: entity,
        status: "resolved",
        match: {
          id: topCandidate.email.id,
          type: "email",
          record: topCandidate.email,
          confidence: topCandidate.score,
          matchMethod: "exact",
        },
        confidence: topCandidate.score,
      };
    }

    // Clear winner
    if (
      topCandidate.score >= this.config.fuzzyMatchThreshold &&
      (scoredCandidates.length === 1 ||
        topCandidate.score - scoredCandidates[1].score > 0.15)
    ) {
      return {
        extracted: entity,
        status: "resolved",
        match: {
          id: topCandidate.email.id,
          type: "email",
          record: topCandidate.email,
          confidence: topCandidate.score,
          matchMethod: "fuzzy",
        },
        confidence: topCandidate.score,
      };
    }

    // Ambiguous
    if (
      topCandidate.score >= this.config.fuzzyMatchThreshold &&
      scoredCandidates.filter((c) => c.score >= this.config.fuzzyMatchThreshold)
        .length > 1
    ) {
      const resolutionCandidates: ResolutionCandidate[] = scoredCandidates
        .filter((c) => c.score >= this.config.fuzzyMatchThreshold)
        .slice(0, this.config.maxCandidates)
        .map((c) => ({
          id: c.email.id,
          label: `"${c.email.subject ?? "No subject"}" from ${c.email.fromName ?? c.email.fromEmail}`,
          confidence: c.score,
        }));

      return {
        extracted: entity,
        status: "ambiguous",
        candidates: rankCandidates(resolutionCandidates),
        confidence: topCandidate.score,
      };
    }

    return {
      extracted: entity,
      status: "not_found",
      confidence: topCandidate.score,
    };
  }

  /**
   * Resolve a place reference to a Place record
   */
  async resolvePlace(
    userId: string,
    description: string,
    hints?: PlaceResolutionHints
  ): Promise<ResolvedEntity<Place>> {
    const entity: LLMExtractedEntity = {
      type: ENTITY_TYPES.PLACE,
      text: description,
      value: description,
      needsResolution: true,
    };

    try {
      // Search for places using semantic search
      const results = await searchContext(userId, description, {
        entityTypes: ["place"],
        limit: 10,
        minSimilarity: this.config.semanticThreshold,
      });

      if (results.length === 0) {
        // Try database text search as fallback
        const places = await searchPlaces(userId, description, { limit: 10 });

        if (places.length === 0) {
          return {
            extracted: entity,
            status: "not_found",
            confidence: 0,
          };
        }

        return this.processPlaceCandidates(entity, places, description, hints);
      }

      return this.processPlaceCandidates(
        entity,
        results.map((r) => r.entity as Place),
        description,
        hints
      );
    } catch (error) {
      throw new EntityResolutionError(
        "RESOLUTION_FAILED",
        `Failed to resolve place "${description}"`,
        {
          description,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  /**
   * Process place candidates and determine resolution status
   */
  private processPlaceCandidates(
    entity: LLMExtractedEntity,
    candidates: Place[],
    query: string,
    hints?: PlaceResolutionHints
  ): ResolvedEntity<Place> {
    // Score each candidate
    const scoredCandidates: Array<{
      place: Place;
      score: number;
    }> = [];

    for (const place of candidates) {
      const nameScore = textSimilarity(query, place.name);
      const addressScore = place.address
        ? textSimilarity(query, place.address) * 0.8
        : 0;
      const cityScore = place.city
        ? textSimilarity(query, place.city) * 0.6
        : 0;

      let score = Math.max(nameScore, addressScore, cityScore);

      // Boost for type match if hint provided
      if (hints?.placeType && place.type === hints.placeType) {
        score += 0.1;
      }

      // Boost for city match if hint provided
      if (hints?.city && place.city?.toLowerCase() === hints.city.toLowerCase()) {
        score += 0.15;
      }

      scoredCandidates.push({
        place,
        score: Math.min(1, score),
      });
    }

    // Sort by score descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    const topCandidate = scoredCandidates[0];

    // High confidence match
    if (topCandidate.score >= this.config.exactMatchThreshold) {
      return {
        extracted: entity,
        status: "resolved",
        match: {
          id: topCandidate.place.id,
          type: "place",
          record: topCandidate.place,
          confidence: topCandidate.score,
          matchMethod: "semantic",
        },
        confidence: topCandidate.score,
      };
    }

    // Clear winner
    if (
      topCandidate.score >= this.config.fuzzyMatchThreshold &&
      (scoredCandidates.length === 1 ||
        topCandidate.score - scoredCandidates[1].score > 0.15)
    ) {
      return {
        extracted: entity,
        status: "resolved",
        match: {
          id: topCandidate.place.id,
          type: "place",
          record: topCandidate.place,
          confidence: topCandidate.score,
          matchMethod: "fuzzy",
        },
        confidence: topCandidate.score,
      };
    }

    // Ambiguous
    if (
      topCandidate.score >= this.config.fuzzyMatchThreshold &&
      scoredCandidates.filter((c) => c.score >= this.config.fuzzyMatchThreshold)
        .length > 1
    ) {
      const resolutionCandidates: ResolutionCandidate[] = scoredCandidates
        .filter((c) => c.score >= this.config.fuzzyMatchThreshold)
        .slice(0, this.config.maxCandidates)
        .map((c) => ({
          id: c.place.id,
          label: c.place.address
            ? `${c.place.name} (${c.place.address})`
            : c.place.name,
          confidence: c.score,
        }));

      return {
        extracted: entity,
        status: "ambiguous",
        candidates: rankCandidates(resolutionCandidates),
        confidence: topCandidate.score,
      };
    }

    return {
      extracted: entity,
      status: "not_found",
      confidence: topCandidate.score,
    };
  }

  /**
   * Resolve a deadline reference to a Deadline record
   */
  async resolveDeadline(
    userId: string,
    description: string,
    hints?: DeadlineResolutionHints
  ): Promise<ResolvedEntity<Deadline>> {
    const entity: LLMExtractedEntity = {
      type: ENTITY_TYPES.DEADLINE,
      text: description,
      value: description,
      needsResolution: true,
    };

    try {
      // Search for deadlines using semantic search
      const results = await searchContext(userId, description, {
        entityTypes: ["deadline"],
        limit: 10,
        minSimilarity: this.config.semanticThreshold,
      });

      if (results.length === 0) {
        // Try database text search as fallback
        const deadlines = await searchDeadlines(userId, description, { limit: 10 });

        if (deadlines.length === 0) {
          return {
            extracted: entity,
            status: "not_found",
            confidence: 0,
          };
        }

        return this.processDeadlineCandidates(entity, deadlines, description, hints);
      }

      return this.processDeadlineCandidates(
        entity,
        results.map((r) => r.entity as Deadline),
        description,
        hints
      );
    } catch (error) {
      throw new EntityResolutionError(
        "RESOLUTION_FAILED",
        `Failed to resolve deadline "${description}"`,
        {
          description,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  /**
   * Process deadline candidates and determine resolution status
   */
  private processDeadlineCandidates(
    entity: LLMExtractedEntity,
    candidates: Deadline[],
    query: string,
    hints?: DeadlineResolutionHints
  ): ResolvedEntity<Deadline> {
    // Score each candidate
    const scoredCandidates: Array<{
      deadline: Deadline;
      score: number;
    }> = [];

    for (const deadline of candidates) {
      const titleScore = textSimilarity(query, deadline.title);
      const descScore = deadline.description
        ? textSimilarity(query, deadline.description) * 0.8
        : 0;

      let score = Math.max(titleScore, descScore);

      // Boost for type match if hint provided
      if (hints?.type && deadline.type === hints.type) {
        score += 0.1;
      }

      // Boost for status match if hint provided
      if (hints?.status && deadline.status === hints.status) {
        score += 0.05;
      }

      // Boost for related entity match if hint provided
      if (hints?.relatedEntityId) {
        if (
          deadline.taskId === hints.relatedEntityId ||
          deadline.eventId === hints.relatedEntityId
        ) {
          score += 0.15;
        }
      }

      scoredCandidates.push({
        deadline,
        score: Math.min(1, score),
      });
    }

    // Sort by score descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    const topCandidate = scoredCandidates[0];

    // High confidence match
    if (topCandidate.score >= this.config.exactMatchThreshold) {
      return {
        extracted: entity,
        status: "resolved",
        match: {
          id: topCandidate.deadline.id,
          type: "deadline",
          record: topCandidate.deadline,
          confidence: topCandidate.score,
          matchMethod: "semantic",
        },
        confidence: topCandidate.score,
      };
    }

    // Clear winner
    if (
      topCandidate.score >= this.config.fuzzyMatchThreshold &&
      (scoredCandidates.length === 1 ||
        topCandidate.score - scoredCandidates[1].score > 0.15)
    ) {
      return {
        extracted: entity,
        status: "resolved",
        match: {
          id: topCandidate.deadline.id,
          type: "deadline",
          record: topCandidate.deadline,
          confidence: topCandidate.score,
          matchMethod: "fuzzy",
        },
        confidence: topCandidate.score,
      };
    }

    // Ambiguous
    if (
      topCandidate.score >= this.config.fuzzyMatchThreshold &&
      scoredCandidates.filter((c) => c.score >= this.config.fuzzyMatchThreshold)
        .length > 1
    ) {
      const resolutionCandidates: ResolutionCandidate[] = scoredCandidates
        .filter((c) => c.score >= this.config.fuzzyMatchThreshold)
        .slice(0, this.config.maxCandidates)
        .map((c) => ({
          id: c.deadline.id,
          label: `${c.deadline.title} (${c.deadline.type}, due ${c.deadline.dueAt.toLocaleDateString()})`,
          confidence: c.score,
        }));

      return {
        extracted: entity,
        status: "ambiguous",
        candidates: rankCandidates(resolutionCandidates),
        confidence: topCandidate.score,
      };
    }

    return {
      extracted: entity,
      status: "not_found",
      confidence: topCandidate.score,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Routine Resolution
  // ─────────────────────────────────────────────────────────────

  /**
   * Resolve a routine reference to a Routine record
   */
  async resolveRoutine(
    userId: string,
    description: string,
    hints?: RoutineResolutionHints
  ): Promise<ResolvedEntity<Routine>> {
    const entity: LLMExtractedEntity = {
      type: ENTITY_TYPES.ROUTINE,
      text: description,
      value: description,
      needsResolution: true,
    };

    try {
      // Search for routines
      const routines = await searchRoutines(userId, description, { limit: 10 });

      if (routines.length === 0) {
        // Try semantic search as fallback
        const results = await searchContext(userId, description, {
          entityTypes: ["routine"],
          limit: 10,
          minSimilarity: this.config.semanticThreshold,
        });

        if (results.length === 0) {
          return {
            extracted: entity,
            status: "not_found",
            confidence: 0,
          };
        }

        return this.processRoutineCandidates(
          entity,
          results.map((r) => r.entity as Routine),
          description,
          hints
        );
      }

      return this.processRoutineCandidates(entity, routines, description, hints);
    } catch (error) {
      throw new EntityResolutionError(
        "RESOLUTION_FAILED",
        `Failed to resolve routine "${description}"`,
        {
          description,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  private processRoutineCandidates(
    entity: LLMExtractedEntity,
    candidates: Routine[],
    query: string,
    hints?: RoutineResolutionHints
  ): ResolvedEntity<Routine> {
    const scoredCandidates: Array<{ routine: Routine; score: number }> = [];

    for (const routine of candidates) {
      const nameScore = textSimilarity(query, routine.name);
      const descScore = routine.description
        ? textSimilarity(query, routine.description) * 0.8
        : 0;

      let score = Math.max(nameScore, descScore);

      // Boost for type match
      if (hints?.type && routine.type === hints.type) {
        score += 0.1;
      }

      // Boost for category match
      if (hints?.category && routine.category === hints.category) {
        score += 0.1;
      }

      scoredCandidates.push({ routine, score: Math.min(1, score) });
    }

    scoredCandidates.sort((a, b) => b.score - a.score);
    const topCandidate = scoredCandidates[0];

    if (topCandidate.score >= this.config.exactMatchThreshold) {
      return {
        extracted: entity,
        status: "resolved",
        match: {
          id: topCandidate.routine.id,
          type: "routine",
          record: topCandidate.routine,
          confidence: topCandidate.score,
          matchMethod: "semantic",
        },
        confidence: topCandidate.score,
      };
    }

    if (
      topCandidate.score >= this.config.fuzzyMatchThreshold &&
      (scoredCandidates.length === 1 ||
        topCandidate.score - scoredCandidates[1].score > 0.15)
    ) {
      return {
        extracted: entity,
        status: "resolved",
        match: {
          id: topCandidate.routine.id,
          type: "routine",
          record: topCandidate.routine,
          confidence: topCandidate.score,
          matchMethod: "fuzzy",
        },
        confidence: topCandidate.score,
      };
    }

    if (
      topCandidate.score >= this.config.fuzzyMatchThreshold &&
      scoredCandidates.filter((c) => c.score >= this.config.fuzzyMatchThreshold)
        .length > 1
    ) {
      const resolutionCandidates: ResolutionCandidate[] = scoredCandidates
        .filter((c) => c.score >= this.config.fuzzyMatchThreshold)
        .slice(0, this.config.maxCandidates)
        .map((c) => ({
          id: c.routine.id,
          label: `${c.routine.name} (${c.routine.type}, ${c.routine.frequency})`,
          confidence: c.score,
        }));

      return {
        extracted: entity,
        status: "ambiguous",
        candidates: rankCandidates(resolutionCandidates),
        confidence: topCandidate.score,
      };
    }

    return {
      extracted: entity,
      status: "not_found",
      confidence: topCandidate.score,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // OpenLoop Resolution
  // ─────────────────────────────────────────────────────────────

  /**
   * Resolve an open loop reference to an OpenLoop record
   */
  async resolveOpenLoop(
    userId: string,
    description: string,
    hints?: OpenLoopResolutionHints
  ): Promise<ResolvedEntity<OpenLoop>> {
    const entity: LLMExtractedEntity = {
      type: ENTITY_TYPES.OPEN_LOOP,
      text: description,
      value: description,
      needsResolution: true,
    };

    try {
      const openLoops = await searchOpenLoops(userId, description, { limit: 10 });

      if (openLoops.length === 0) {
        const results = await searchContext(userId, description, {
          entityTypes: ["open_loop"],
          limit: 10,
          minSimilarity: this.config.semanticThreshold,
        });

        if (results.length === 0) {
          return {
            extracted: entity,
            status: "not_found",
            confidence: 0,
          };
        }

        return this.processOpenLoopCandidates(
          entity,
          results.map((r) => r.entity as OpenLoop),
          description,
          hints
        );
      }

      return this.processOpenLoopCandidates(entity, openLoops, description, hints);
    } catch (error) {
      throw new EntityResolutionError(
        "RESOLUTION_FAILED",
        `Failed to resolve open loop "${description}"`,
        {
          description,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  private processOpenLoopCandidates(
    entity: LLMExtractedEntity,
    candidates: OpenLoop[],
    query: string,
    hints?: OpenLoopResolutionHints
  ): ResolvedEntity<OpenLoop> {
    const scoredCandidates: Array<{ openLoop: OpenLoop; score: number }> = [];

    for (const openLoop of candidates) {
      const titleScore = textSimilarity(query, openLoop.title);
      const descScore = openLoop.description
        ? textSimilarity(query, openLoop.description) * 0.8
        : 0;

      let score = Math.max(titleScore, descScore);

      // Boost for type match
      if (hints?.type && openLoop.type === hints.type) {
        score += 0.1;
      }

      // Boost for priority match
      if (hints?.priority && openLoop.priority === hints.priority) {
        score += 0.05;
      }

      // Boost for related person match
      if (hints?.relatedPersonId && openLoop.relatedPersonId === hints.relatedPersonId) {
        score += 0.15;
      }

      scoredCandidates.push({ openLoop, score: Math.min(1, score) });
    }

    scoredCandidates.sort((a, b) => b.score - a.score);
    const topCandidate = scoredCandidates[0];

    if (topCandidate.score >= this.config.exactMatchThreshold) {
      return {
        extracted: entity,
        status: "resolved",
        match: {
          id: topCandidate.openLoop.id,
          type: "open_loop",
          record: topCandidate.openLoop,
          confidence: topCandidate.score,
          matchMethod: "semantic",
        },
        confidence: topCandidate.score,
      };
    }

    if (
      topCandidate.score >= this.config.fuzzyMatchThreshold &&
      (scoredCandidates.length === 1 ||
        topCandidate.score - scoredCandidates[1].score > 0.15)
    ) {
      return {
        extracted: entity,
        status: "resolved",
        match: {
          id: topCandidate.openLoop.id,
          type: "open_loop",
          record: topCandidate.openLoop,
          confidence: topCandidate.score,
          matchMethod: "fuzzy",
        },
        confidence: topCandidate.score,
      };
    }

    if (
      topCandidate.score >= this.config.fuzzyMatchThreshold &&
      scoredCandidates.filter((c) => c.score >= this.config.fuzzyMatchThreshold)
        .length > 1
    ) {
      const resolutionCandidates: ResolutionCandidate[] = scoredCandidates
        .filter((c) => c.score >= this.config.fuzzyMatchThreshold)
        .slice(0, this.config.maxCandidates)
        .map((c) => ({
          id: c.openLoop.id,
          label: `${c.openLoop.title} (${c.openLoop.type}, ${c.openLoop.status})`,
          confidence: c.score,
        }));

      return {
        extracted: entity,
        status: "ambiguous",
        candidates: rankCandidates(resolutionCandidates),
        confidence: topCandidate.score,
      };
    }

    return {
      extracted: entity,
      status: "not_found",
      confidence: topCandidate.score,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Project Resolution
  // ─────────────────────────────────────────────────────────────

  /**
   * Resolve a project reference to a Project record
   */
  async resolveProject(
    userId: string,
    description: string,
    hints?: ProjectResolutionHints
  ): Promise<ResolvedEntity<Project>> {
    const entity: LLMExtractedEntity = {
      type: ENTITY_TYPES.PROJECT,
      text: description,
      value: description,
      needsResolution: true,
    };

    try {
      const projects = await searchProjects(userId, description, { limit: 10 });

      if (projects.length === 0) {
        const results = await searchContext(userId, description, {
          entityTypes: ["project"],
          limit: 10,
          minSimilarity: this.config.semanticThreshold,
        });

        if (results.length === 0) {
          return {
            extracted: entity,
            status: "not_found",
            confidence: 0,
          };
        }

        return this.processProjectCandidates(
          entity,
          results.map((r) => r.entity as Project),
          description,
          hints
        );
      }

      return this.processProjectCandidates(entity, projects, description, hints);
    } catch (error) {
      throw new EntityResolutionError(
        "RESOLUTION_FAILED",
        `Failed to resolve project "${description}"`,
        {
          description,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  private processProjectCandidates(
    entity: LLMExtractedEntity,
    candidates: Project[],
    query: string,
    hints?: ProjectResolutionHints
  ): ResolvedEntity<Project> {
    const scoredCandidates: Array<{ project: Project; score: number }> = [];

    for (const project of candidates) {
      const nameScore = textSimilarity(query, project.name);
      const descScore = project.description
        ? textSimilarity(query, project.description) * 0.8
        : 0;

      let score = Math.max(nameScore, descScore);

      // Boost for type match
      if (hints?.type && project.type === hints.type) {
        score += 0.1;
      }

      // Boost for status match
      if (hints?.status && project.status === hints.status) {
        score += 0.05;
      }

      // Boost for priority match
      if (hints?.priority && project.priority === hints.priority) {
        score += 0.05;
      }

      scoredCandidates.push({ project, score: Math.min(1, score) });
    }

    scoredCandidates.sort((a, b) => b.score - a.score);
    const topCandidate = scoredCandidates[0];

    if (topCandidate.score >= this.config.exactMatchThreshold) {
      return {
        extracted: entity,
        status: "resolved",
        match: {
          id: topCandidate.project.id,
          type: "project",
          record: topCandidate.project,
          confidence: topCandidate.score,
          matchMethod: "semantic",
        },
        confidence: topCandidate.score,
      };
    }

    if (
      topCandidate.score >= this.config.fuzzyMatchThreshold &&
      (scoredCandidates.length === 1 ||
        topCandidate.score - scoredCandidates[1].score > 0.15)
    ) {
      return {
        extracted: entity,
        status: "resolved",
        match: {
          id: topCandidate.project.id,
          type: "project",
          record: topCandidate.project,
          confidence: topCandidate.score,
          matchMethod: "fuzzy",
        },
        confidence: topCandidate.score,
      };
    }

    if (
      topCandidate.score >= this.config.fuzzyMatchThreshold &&
      scoredCandidates.filter((c) => c.score >= this.config.fuzzyMatchThreshold)
        .length > 1
    ) {
      const resolutionCandidates: ResolutionCandidate[] = scoredCandidates
        .filter((c) => c.score >= this.config.fuzzyMatchThreshold)
        .slice(0, this.config.maxCandidates)
        .map((c) => ({
          id: c.project.id,
          label: `${c.project.name} (${c.project.type}, ${c.project.status})`,
          confidence: c.score,
        }));

      return {
        extracted: entity,
        status: "ambiguous",
        candidates: rankCandidates(resolutionCandidates),
        confidence: topCandidate.score,
      };
    }

    return {
      extracted: entity,
      status: "not_found",
      confidence: topCandidate.score,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Note Resolution
  // ─────────────────────────────────────────────────────────────

  /**
   * Resolve a note reference to a Note record
   */
  async resolveNote(
    userId: string,
    description: string,
    hints?: NoteResolutionHints
  ): Promise<ResolvedEntity<Note>> {
    const entity: LLMExtractedEntity = {
      type: ENTITY_TYPES.NOTE,
      text: description,
      value: description,
      needsResolution: true,
    };

    try {
      const notes = await searchNotes(userId, description, {
        limit: 10,
        searchContent: hints?.searchContent ?? true,
      });

      if (notes.length === 0) {
        const results = await searchContext(userId, description, {
          entityTypes: ["note"],
          limit: 10,
          minSimilarity: this.config.semanticThreshold,
        });

        if (results.length === 0) {
          return {
            extracted: entity,
            status: "not_found",
            confidence: 0,
          };
        }

        return this.processNoteCandidates(
          entity,
          results.map((r) => r.entity as Note),
          description,
          hints
        );
      }

      return this.processNoteCandidates(entity, notes, description, hints);
    } catch (error) {
      throw new EntityResolutionError(
        "RESOLUTION_FAILED",
        `Failed to resolve note "${description}"`,
        {
          description,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  private processNoteCandidates(
    entity: LLMExtractedEntity,
    candidates: Note[],
    query: string,
    hints?: NoteResolutionHints
  ): ResolvedEntity<Note> {
    const scoredCandidates: Array<{ note: Note; score: number }> = [];

    for (const note of candidates) {
      const titleScore = note.title ? textSimilarity(query, note.title) : 0;
      const contentScore = textSimilarity(query, note.content.substring(0, 500)) * 0.7;

      let score = Math.max(titleScore, contentScore);

      // Boost for type match
      if (hints?.type && note.type === hints.type) {
        score += 0.1;
      }

      // Boost for category match
      if (hints?.category && note.category === hints.category) {
        score += 0.1;
      }

      // Boost for pinned notes if requested
      if (hints?.pinnedOnly && note.isPinned) {
        score += 0.15;
      }

      scoredCandidates.push({ note, score: Math.min(1, score) });
    }

    scoredCandidates.sort((a, b) => b.score - a.score);
    const topCandidate = scoredCandidates[0];

    if (topCandidate.score >= this.config.exactMatchThreshold) {
      return {
        extracted: entity,
        status: "resolved",
        match: {
          id: topCandidate.note.id,
          type: "note",
          record: topCandidate.note,
          confidence: topCandidate.score,
          matchMethod: "semantic",
        },
        confidence: topCandidate.score,
      };
    }

    if (
      topCandidate.score >= this.config.fuzzyMatchThreshold &&
      (scoredCandidates.length === 1 ||
        topCandidate.score - scoredCandidates[1].score > 0.15)
    ) {
      return {
        extracted: entity,
        status: "resolved",
        match: {
          id: topCandidate.note.id,
          type: "note",
          record: topCandidate.note,
          confidence: topCandidate.score,
          matchMethod: "fuzzy",
        },
        confidence: topCandidate.score,
      };
    }

    if (
      topCandidate.score >= this.config.fuzzyMatchThreshold &&
      scoredCandidates.filter((c) => c.score >= this.config.fuzzyMatchThreshold)
        .length > 1
    ) {
      const resolutionCandidates: ResolutionCandidate[] = scoredCandidates
        .filter((c) => c.score >= this.config.fuzzyMatchThreshold)
        .slice(0, this.config.maxCandidates)
        .map((c) => ({
          id: c.note.id,
          label: c.note.title || c.note.content.substring(0, 50) + "...",
          confidence: c.score,
        }));

      return {
        extracted: entity,
        status: "ambiguous",
        candidates: rankCandidates(resolutionCandidates),
        confidence: topCandidate.score,
      };
    }

    return {
      extracted: entity,
      status: "not_found",
      confidence: topCandidate.score,
    };
  }

  /**
   * Get the current configuration
   */
  getConfig(): Required<ResolverConfig> {
    return { ...this.config };
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────

let defaultResolver: EntityResolver | null = null;

/**
 * Get the default entity resolver instance
 */
export function getEntityResolver(): EntityResolver {
  if (!defaultResolver) {
    defaultResolver = new EntityResolver();
  }
  return defaultResolver;
}

/**
 * Create a new entity resolver instance with custom config
 */
export function createEntityResolver(config?: ResolverConfig): EntityResolver {
  return new EntityResolver(config);
}

// ─────────────────────────────────────────────────────────────
// Convenience Functions
// ─────────────────────────────────────────────────────────────

/**
 * Resolve multiple LLM-extracted entities to database records
 */
export async function resolveEntities(
  userId: string,
  entities: LLMExtractedEntity[]
): Promise<ResolutionResult> {
  return getEntityResolver().resolveEntities(userId, entities);
}

/**
 * Resolve a person reference to a Person record
 */
export async function resolvePerson(
  userId: string,
  name: string,
  hints?: PersonResolutionHints
): Promise<ResolvedEntity<Person>> {
  return getEntityResolver().resolvePerson(userId, name, hints);
}

/**
 * Resolve an event reference to an Event record
 */
export async function resolveEvent(
  userId: string,
  description: string,
  hints?: EventResolutionHints
): Promise<ResolvedEntity<Event>> {
  return getEntityResolver().resolveEvent(userId, description, hints);
}

/**
 * Resolve a task reference to a Task record
 */
export async function resolveTask(
  userId: string,
  description: string,
  hints?: TaskResolutionHints
): Promise<ResolvedEntity<Task>> {
  return getEntityResolver().resolveTask(userId, description, hints);
}

/**
 * Resolve an email reference to an Email record
 */
export async function resolveEmail(
  userId: string,
  description: string,
  hints?: EmailResolutionHints
): Promise<ResolvedEntity<Email>> {
  return getEntityResolver().resolveEmail(userId, description, hints);
}

/**
 * Resolve a place reference to a Place record
 */
export async function resolvePlace(
  userId: string,
  description: string,
  hints?: PlaceResolutionHints
): Promise<ResolvedEntity<Place>> {
  return getEntityResolver().resolvePlace(userId, description, hints);
}

/**
 * Resolve a deadline reference to a Deadline record
 */
export async function resolveDeadline(
  userId: string,
  description: string,
  hints?: DeadlineResolutionHints
): Promise<ResolvedEntity<Deadline>> {
  return getEntityResolver().resolveDeadline(userId, description, hints);
}

/**
 * Resolve a routine reference to a Routine record
 */
export async function resolveRoutine(
  userId: string,
  description: string,
  hints?: RoutineResolutionHints
): Promise<ResolvedEntity<Routine>> {
  return getEntityResolver().resolveRoutine(userId, description, hints);
}

/**
 * Resolve an open loop reference to an OpenLoop record
 */
export async function resolveOpenLoop(
  userId: string,
  description: string,
  hints?: OpenLoopResolutionHints
): Promise<ResolvedEntity<OpenLoop>> {
  return getEntityResolver().resolveOpenLoop(userId, description, hints);
}

/**
 * Resolve a project reference to a Project record
 */
export async function resolveProject(
  userId: string,
  description: string,
  hints?: ProjectResolutionHints
): Promise<ResolvedEntity<Project>> {
  return getEntityResolver().resolveProject(userId, description, hints);
}

/**
 * Resolve a note reference to a Note record
 */
export async function resolveNote(
  userId: string,
  description: string,
  hints?: NoteResolutionHints
): Promise<ResolvedEntity<Note>> {
  return getEntityResolver().resolveNote(userId, description, hints);
}

