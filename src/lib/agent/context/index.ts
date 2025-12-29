// ═══════════════════════════════════════════════════════════════════════════
// Agent Context Module
// Multi-source context retrieval to enrich LLM responses
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Relevance types
  WithRelevance,
  ContextSource,
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

  // Semantic search types
  SemanticMatch,

  // Conversation types
  ConversationMessage,

  // Interaction types
  InteractionType,
  Interaction,

  // Context retrieval types
  ContextRetrieval,
  ContextRetrievalStats,
  RetrievalOptions,
  SemanticFilters,

  // Ranked context types
  RankedContextItem,
  RankedContext,

  // Service interface
  IContextRetrievalService,

  // Error types
  ContextRetrievalErrorCode,
} from "./types";

export {
  // Constants
  DEFAULT_RETRIEVAL_OPTIONS,

  // Error class
  ContextRetrievalError,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Ranking
// ─────────────────────────────────────────────────────────────

export {
  // Weights
  SOURCE_WEIGHTS,
  INTENT_ENTITY_WEIGHTS,
  MAX_CONTEXT_TOKENS,

  // Entity utilities
  getEntityDisplayName,
  summarizeEntity,

  // Ranking functions
  calculateRelevanceScore,
  rankContextRelevance,
  mergeAndRank,

  // Context summary
  buildContextSummary,

  // Semantic ranking
  rankSemanticMatches,

  // Time-based relevance
  calculateTimeRelevance,
  calculateRecencyRelevance,
} from "./ranking";

// ─────────────────────────────────────────────────────────────
// Retrieval Service
// ─────────────────────────────────────────────────────────────

export {
  // Service class
  ContextRetrievalService,

  // Singleton management
  getContextRetrievalService,
  createContextRetrievalService,
  resetContextRetrievalService,

  // Convenience functions
  retrieveContext,
  retrieveFromResolution,
  searchSemantic,
  getRecentInteractions,
  getConversationContext,
  rankContext,
} from "./retrieval";


