// ═══════════════════════════════════════════════════════════════════════════
// Entity Resolution Types
// Types for resolving LLM-extracted entities to database records
// ═══════════════════════════════════════════════════════════════════════════

import type { LLMExtractedEntity } from "../intent";
import type { Person, Event, Task, Place, Deadline, Routine, OpenLoop, Project, Note } from "@/services/context/types";
import type { Email } from "@prisma/client";

// ─────────────────────────────────────────────────────────────
// Resolution Status
// ─────────────────────────────────────────────────────────────

/**
 * Status of entity resolution
 */
export type ResolutionStatus = "resolved" | "ambiguous" | "not_found";

/**
 * Types of entities that can be resolved to database records
 */
export type ResolvableEntityType = 
  | "person" 
  | "event" 
  | "task" 
  | "email"
  | "place"
  | "deadline"
  | "routine"
  | "open_loop"
  | "project"
  | "note";

// ─────────────────────────────────────────────────────────────
// Resolved Entity
// ─────────────────────────────────────────────────────────────

/**
 * A candidate match for ambiguous entity resolution
 */
export interface ResolutionCandidate {
  /** Database record ID */
  id: string;

  /** Human-readable label for the candidate */
  label: string;

  /** Match confidence (0-1) */
  confidence: number;

  /** Why this candidate matched */
  matchReason?: string;
}

/**
 * Database record match for a resolved entity
 */
export interface EntityMatch<T = unknown> {
  /** Database record ID */
  id: string;

  /** Entity type */
  type: ResolvableEntityType;

  /** The actual database record */
  record: T;

  /** Match confidence (0-1) */
  confidence: number;

  /** How the match was made */
  matchMethod: "exact" | "fuzzy" | "semantic";
}

/**
 * An entity that has been resolved to a database record
 */
export interface ResolvedEntity<T = unknown> {
  /** Original LLM extraction */
  extracted: LLMExtractedEntity;

  /** Resolution status */
  status: ResolutionStatus;

  /** Matched database record (if resolved) */
  match?: EntityMatch<T>;

  /** Multiple matches (if ambiguous) */
  candidates?: ResolutionCandidate[];

  /** Resolution confidence (0-1) */
  confidence: number;

  /** Error message if resolution failed */
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// Resolution Result
// ─────────────────────────────────────────────────────────────

/**
 * Result of resolving multiple entities
 */
export interface ResolutionResult {
  /** All resolved entities */
  entities: ResolvedEntity[];

  /** Entities that were successfully resolved */
  resolved: ResolvedEntity[];

  /** Entities with multiple matches needing clarification */
  ambiguous: ResolvedEntity[];

  /** Entities that couldn't be found */
  notFound: ResolvedEntity[];

  /** Whether any entities need clarification */
  needsClarification: boolean;

  /** Generated clarification questions for ambiguous entities */
  clarificationQuestions: string[];
}

// ─────────────────────────────────────────────────────────────
// Resolution Hints
// ─────────────────────────────────────────────────────────────

/**
 * Hints to improve person resolution
 */
export interface PersonResolutionHints {
  /** Email address if available */
  email?: string;

  /** Additional context (e.g., "from the marketing team") */
  context?: string;

  /** Company name if known */
  company?: string;

  /** Related event ID */
  relatedEventId?: string;
}

/**
 * Hints to improve event resolution
 */
export interface EventResolutionHints {
  /** Date range to search within */
  dateRange?: { start: Date; end: Date };

  /** Known attendees */
  attendees?: string[];

  /** Location hint */
  location?: string;

  /** Type of event (meeting, appointment, etc.) */
  eventType?: string;
}

/**
 * Hints to improve task resolution
 */
export interface TaskResolutionHints {
  /** Status filter */
  status?: string;

  /** Priority filter */
  priority?: string;

  /** Due date range */
  dueDateRange?: { start: Date; end: Date };

  /** Related project or tags */
  tags?: string[];
}

/**
 * Hints to improve email resolution
 */
export interface EmailResolutionHints {
  /** Sender email or name */
  sender?: string;

  /** Date range to search within */
  dateRange?: { start: Date; end: Date };

  /** Whether to include drafts */
  includeDrafts?: boolean;

  /** Labels to filter by */
  labels?: string[];
}

/**
 * Hints to improve place resolution
 */
export interface PlaceResolutionHints {
  /** Type of place (home, office, restaurant, etc.) */
  placeType?: string;

  /** City to filter by */
  city?: string;

  /** Country to filter by */
  country?: string;

  /** Associated person or company */
  associatedWith?: string;
}

/**
 * Hints to improve deadline resolution
 */
export interface DeadlineResolutionHints {
  /** Type of deadline (deadline, milestone, reminder) */
  type?: string;

  /** Status filter */
  status?: string;

  /** Due date range */
  dueDateRange?: { start: Date; end: Date };

  /** Related task or event */
  relatedEntityId?: string;
}

/**
 * Hints to improve routine resolution
 */
export interface RoutineResolutionHints {
  /** Type of routine (habit, ritual, process, schedule) */
  type?: string;

  /** Status filter */
  status?: string;

  /** Category filter */
  category?: string;

  /** Frequency filter */
  frequency?: string;
}

/**
 * Hints to improve open loop resolution
 */
export interface OpenLoopResolutionHints {
  /** Type of open loop (follow_up, waiting_for, promise, question, idea) */
  type?: string;

  /** Status filter */
  status?: string;

  /** Priority filter */
  priority?: string;

  /** Related person ID */
  relatedPersonId?: string;
}

/**
 * Hints to improve project resolution
 */
export interface ProjectResolutionHints {
  /** Type of project (project, goal, initiative, area) */
  type?: string;

  /** Status filter */
  status?: string;

  /** Priority filter */
  priority?: string;

  /** Parent project ID */
  parentId?: string;
}

/**
 * Hints to improve note resolution
 */
export interface NoteResolutionHints {
  /** Type of note (note, memo, journal, meeting_notes, idea, reference) */
  type?: string;

  /** Category filter */
  category?: string;

  /** Whether to search in content as well as title */
  searchContent?: boolean;

  /** Whether to include pinned notes only */
  pinnedOnly?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Resolver Configuration
// ─────────────────────────────────────────────────────────────

/**
 * Configuration for entity resolution
 */
export interface ResolverConfig {
  /** Minimum confidence for an exact match (0-1) */
  exactMatchThreshold?: number;

  /** Minimum confidence for a fuzzy match (0-1) */
  fuzzyMatchThreshold?: number;

  /** Maximum number of candidates for ambiguous resolution */
  maxCandidates?: number;

  /** Whether to use semantic search for resolution */
  useSemanticSearch?: boolean;

  /** Minimum similarity for semantic matches (0-1) */
  semanticThreshold?: number;

  /** User's timezone for date resolution */
  timezone?: string;
}

/**
 * Default resolver configuration
 */
export const DEFAULT_RESOLVER_CONFIG: Required<ResolverConfig> = {
  exactMatchThreshold: 0.95,
  fuzzyMatchThreshold: 0.7,
  maxCandidates: 5,
  useSemanticSearch: true,
  semanticThreshold: 0.75,
  timezone: "UTC",
};

// ─────────────────────────────────────────────────────────────
// Entity Resolver Interface
// ─────────────────────────────────────────────────────────────

/**
 * Interface for entity resolution
 */
export interface IEntityResolver {
  /**
   * Resolve multiple LLM-extracted entities to database records
   */
  resolveEntities(
    userId: string,
    entities: LLMExtractedEntity[]
  ): Promise<ResolutionResult>;

  /**
   * Resolve a person reference to a Person record
   */
  resolvePerson(
    userId: string,
    name: string,
    hints?: PersonResolutionHints
  ): Promise<ResolvedEntity<Person>>;

  /**
   * Resolve an event reference to an Event record
   */
  resolveEvent(
    userId: string,
    description: string,
    hints?: EventResolutionHints
  ): Promise<ResolvedEntity<Event>>;

  /**
   * Resolve a task reference to a Task record
   */
  resolveTask(
    userId: string,
    description: string,
    hints?: TaskResolutionHints
  ): Promise<ResolvedEntity<Task>>;

  /**
   * Resolve an email reference to an Email record
   */
  resolveEmail(
    userId: string,
    description: string,
    hints?: EmailResolutionHints
  ): Promise<ResolvedEntity<Email>>;

  /**
   * Resolve a place reference to a Place record
   */
  resolvePlace(
    userId: string,
    description: string,
    hints?: PlaceResolutionHints
  ): Promise<ResolvedEntity<Place>>;

  /**
   * Resolve a deadline reference to a Deadline record
   */
  resolveDeadline(
    userId: string,
    description: string,
    hints?: DeadlineResolutionHints
  ): Promise<ResolvedEntity<Deadline>>;

  /**
   * Resolve a routine reference to a Routine record
   */
  resolveRoutine(
    userId: string,
    description: string,
    hints?: RoutineResolutionHints
  ): Promise<ResolvedEntity<Routine>>;

  /**
   * Resolve an open loop reference to an OpenLoop record
   */
  resolveOpenLoop(
    userId: string,
    description: string,
    hints?: OpenLoopResolutionHints
  ): Promise<ResolvedEntity<OpenLoop>>;

  /**
   * Resolve a project reference to a Project record
   */
  resolveProject(
    userId: string,
    description: string,
    hints?: ProjectResolutionHints
  ): Promise<ResolvedEntity<Project>>;

  /**
   * Resolve a note reference to a Note record
   */
  resolveNote(
    userId: string,
    description: string,
    hints?: NoteResolutionHints
  ): Promise<ResolvedEntity<Note>>;

  /**
   * Get the current configuration
   */
  getConfig(): Required<ResolverConfig>;
}

// ─────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────

/**
 * Error codes for entity resolution
 */
export type EntityResolutionErrorCode =
  | "RESOLUTION_FAILED"
  | "INVALID_ENTITY_TYPE"
  | "SEARCH_ERROR"
  | "DATABASE_ERROR";

/**
 * Entity resolution error
 */
export class EntityResolutionError extends Error {
  readonly code: EntityResolutionErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: EntityResolutionErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "EntityResolutionError";
    this.code = code;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, EntityResolutionError);
    }
  }
}

