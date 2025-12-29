// ═══════════════════════════════════════════════════════════════════════════
// Context Retrieval Types
// Types for multi-source context retrieval to enrich LLM responses
// ═══════════════════════════════════════════════════════════════════════════

import type { IntentAnalysisResult } from "../intent/types";
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

// ─────────────────────────────────────────────────────────────
// Relevance Scoring
// ─────────────────────────────────────────────────────────────

/**
 * An item with a relevance score
 */
export interface WithRelevance<T> {
  /** The item */
  item: T;

  /** Relevance score (0-1) */
  relevance: number;

  /** Why this item is relevant */
  relevanceReason?: string;

  /** Source of the item (how it was found) */
  source: ContextSource;
}

/**
 * Source of context retrieval
 */
export type ContextSource =
  | "resolved_entity"     // From P2E entity resolution
  | "semantic_search"     // From embedding search
  | "text_search"         // From text matching
  | "conversation"        // From conversation history
  | "recent_interaction"  // From recent user activity
  | "related_entity"      // Related to a resolved entity
  | "time_based";         // Based on time relevance

// ─────────────────────────────────────────────────────────────
// Context Items with Relevance
// ─────────────────────────────────────────────────────────────

export type PersonWithRelevance = WithRelevance<Person>;
export type EventWithRelevance = WithRelevance<Event>;
export type TaskWithRelevance = WithRelevance<Task>;
export type DeadlineWithRelevance = WithRelevance<Deadline>;
export type PlaceWithRelevance = WithRelevance<Place>;
export type RoutineWithRelevance = WithRelevance<Routine>;
export type OpenLoopWithRelevance = WithRelevance<OpenLoop>;
export type ProjectWithRelevance = WithRelevance<Project>;
export type NoteWithRelevance = WithRelevance<Note>;
export type OpportunityWithRelevance = WithRelevance<Opportunity>;

// ─────────────────────────────────────────────────────────────
// Semantic Search Results
// ─────────────────────────────────────────────────────────────

/**
 * A semantic search match
 */
export interface SemanticMatch {
  /** Entity type */
  entityType: EntityType;

  /** Entity ID */
  entityId: string;

  /** Similarity score (0-1) */
  similarity: number;

  /** Content snippet that matched */
  content: string;

  /** The actual entity (when enriched) */
  entity?: Person | Place | Event | Task | Deadline | Routine | OpenLoop | Project | Note | Opportunity;
}

// ─────────────────────────────────────────────────────────────
// Conversation Context
// ─────────────────────────────────────────────────────────────

/**
 * A message from conversation history
 */
export interface ConversationMessage {
  /** Message ID */
  id: string;

  /** Message role */
  role: "user" | "assistant" | "system";

  /** Message content */
  content: string;

  /** When the message was sent */
  createdAt: Date;

  /** Message metadata */
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// Recent Interactions
// ─────────────────────────────────────────────────────────────

/**
 * Type of interaction
 */
export type InteractionType =
  | "viewed"
  | "created"
  | "updated"
  | "deleted"
  | "queried"
  | "searched";

/**
 * A recent user interaction
 */
export interface Interaction {
  /** Type of interaction */
  type: InteractionType;

  /** Entity type */
  entityType: EntityType | "email" | "conversation";

  /** Entity ID */
  entityId: string;

  /** Entity display name */
  displayName: string;

  /** When the interaction occurred */
  timestamp: Date;

  /** Additional context */
  context?: string;
}

// ─────────────────────────────────────────────────────────────
// Context Retrieval Result
// ─────────────────────────────────────────────────────────────

/**
 * Complete context retrieval result
 */
export interface ContextRetrieval {
  /** Relevant people */
  relevantPeople: PersonWithRelevance[];

  /** Relevant events */
  relevantEvents: EventWithRelevance[];

  /** Relevant tasks */
  relevantTasks: TaskWithRelevance[];

  /** Relevant deadlines */
  relevantDeadlines: DeadlineWithRelevance[];

  /** Relevant places */
  relevantPlaces: PlaceWithRelevance[];

  /** Relevant routines */
  relevantRoutines: RoutineWithRelevance[];

  /** Relevant open loops */
  relevantOpenLoops: OpenLoopWithRelevance[];

  /** Relevant projects */
  relevantProjects: ProjectWithRelevance[];

  /** Relevant notes */
  relevantNotes: NoteWithRelevance[];

  /** Relevant opportunities */
  relevantOpportunities: OpportunityWithRelevance[];

  /** Conversation history context */
  conversationContext: ConversationMessage[];

  /** Semantic search matches */
  semanticMatches: SemanticMatch[];

  /** Recent user interactions */
  recentInteractions: Interaction[];

  /** Summary statistics */
  stats: ContextRetrievalStats;
}

/**
 * Statistics about context retrieval
 */
export interface ContextRetrievalStats {
  /** Total items retrieved */
  totalItems: number;

  /** Items from entity resolution */
  fromResolution: number;

  /** Items from semantic search */
  fromSemanticSearch: number;

  /** Items from text search */
  fromTextSearch: number;

  /** Items from conversation history */
  fromConversation: number;

  /** Items from recent interactions */
  fromRecentInteractions: number;

  /** Retrieval duration in milliseconds */
  durationMs: number;
}

// ─────────────────────────────────────────────────────────────
// Retrieval Options
// ─────────────────────────────────────────────────────────────

/**
 * Options for context retrieval
 */
export interface RetrievalOptions {
  /** Conversation ID to retrieve history from */
  conversationId?: string;

  /** Maximum people to retrieve */
  maxPeople?: number;

  /** Maximum events to retrieve */
  maxEvents?: number;

  /** Maximum tasks to retrieve */
  maxTasks?: number;

  /** Maximum deadlines to retrieve */
  maxDeadlines?: number;

  /** Maximum places to retrieve */
  maxPlaces?: number;

  /** Maximum routines to retrieve */
  maxRoutines?: number;

  /** Maximum open loops to retrieve */
  maxOpenLoops?: number;

  /** Maximum projects to retrieve */
  maxProjects?: number;

  /** Maximum notes to retrieve */
  maxNotes?: number;

  /** Maximum opportunities to retrieve */
  maxOpportunities?: number;

  /** Maximum semantic search matches */
  maxSemanticMatches?: number;

  /** Maximum conversation messages to include */
  maxConversationMessages?: number;

  /** Maximum recent interactions to include */
  maxRecentInteractions?: number;

  /** Time range for event/task retrieval */
  timeRange?: { start: Date; end: Date };

  /** Whether to use semantic search */
  useSemanticSearch?: boolean;

  /** Minimum similarity for semantic matches (0-1) */
  minSimilarity?: number;

  /** Entity types to focus on */
  focusEntityTypes?: EntityType[];

  /** Include related entities */
  includeRelated?: boolean;

  /** User's timezone */
  timezone?: string;
}

/**
 * Default retrieval options
 */
export const DEFAULT_RETRIEVAL_OPTIONS: Required<
  Omit<RetrievalOptions, "timeRange" | "focusEntityTypes" | "timezone" | "conversationId">
> = {
  maxPeople: 5,
  maxEvents: 5,
  maxTasks: 10,
  maxDeadlines: 5,
  maxPlaces: 3,
  maxRoutines: 5,
  maxOpenLoops: 5,
  maxProjects: 5,
  maxNotes: 5,
  maxOpportunities: 5,
  maxSemanticMatches: 10,
  maxConversationMessages: 10,
  maxRecentInteractions: 5,
  useSemanticSearch: true,
  minSimilarity: 0.5,
  includeRelated: true,
};

// ─────────────────────────────────────────────────────────────
// Semantic Search Filters
// ─────────────────────────────────────────────────────────────

/**
 * Filters for semantic search
 */
export interface SemanticFilters {
  /** Entity types to search */
  entityTypes?: EntityType[];

  /** Minimum similarity threshold */
  minSimilarity?: number;

  /** Maximum results */
  limit?: number;

  /** Time range filter */
  dateRange?: { start: Date; end: Date };
}

// ─────────────────────────────────────────────────────────────
// Ranked Context
// ─────────────────────────────────────────────────────────────

/**
 * A context item with ranking information
 */
export interface RankedContextItem {
  /** Entity type */
  entityType: EntityType | "conversation" | "interaction";

  /** Entity ID */
  entityId: string;

  /** Display name */
  displayName: string;

  /** Combined relevance score (0-1) */
  relevance: number;

  /** Why this item is relevant */
  relevanceReasons: string[];

  /** Sources that found this item */
  sources: ContextSource[];

  /** Brief summary for LLM context */
  summary: string;

  /** The actual entity data */
  entity: unknown;
}

/**
 * Ranked and prioritized context for LLM
 */
export interface RankedContext {
  /** Top-ranked items across all types */
  topItems: RankedContextItem[];

  /** Summary of all context for LLM system prompt */
  contextSummary: string;

  /** Tokens used in context summary (estimated) */
  estimatedTokens: number;
}

// ─────────────────────────────────────────────────────────────
// Context Service Interface
// ─────────────────────────────────────────────────────────────

/**
 * Interface for context retrieval service
 */
export interface IContextRetrievalService {
  /**
   * Retrieve context for an intent analysis result
   */
  retrieveContext(
    userId: string,
    intent: IntentAnalysisResult,
    options?: RetrievalOptions
  ): Promise<ContextRetrieval>;

  /**
   * Retrieve context using resolved entities from P2E
   */
  retrieveFromResolution(
    userId: string,
    resolution: ResolutionResult,
    options?: RetrievalOptions
  ): Promise<ContextRetrieval>;

  /**
   * Search semantically for context
   */
  searchSemantic(
    userId: string,
    query: string,
    filters?: SemanticFilters
  ): Promise<SemanticMatch[]>;

  /**
   * Get recent user interactions
   */
  getRecentInteractions(
    userId: string,
    limit: number
  ): Promise<Interaction[]>;

  /**
   * Get conversation context
   */
  getConversationContext(
    conversationId: string,
    maxMessages: number
  ): Promise<ConversationMessage[]>;

  /**
   * Rank and prioritize context for LLM
   */
  rankContext(
    context: ContextRetrieval,
    intent: IntentAnalysisResult
  ): RankedContext;
}

// ─────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────

/**
 * Error codes for context retrieval
 */
export type ContextRetrievalErrorCode =
  | "RETRIEVAL_FAILED"
  | "SEMANTIC_SEARCH_FAILED"
  | "CONVERSATION_NOT_FOUND"
  | "DATABASE_ERROR"
  | "TIMEOUT";

/**
 * Context retrieval error
 */
export class ContextRetrievalError extends Error {
  readonly code: ContextRetrievalErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ContextRetrievalErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ContextRetrievalError";
    this.code = code;
    this.details = details;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ContextRetrievalError);
    }
  }
}


