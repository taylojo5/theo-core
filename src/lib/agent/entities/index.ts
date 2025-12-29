// ═══════════════════════════════════════════════════════════════════════════
// Entity Resolution Module
// Resolves LLM-extracted entities to database records
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Resolution types
  ResolutionStatus,
  ResolvableEntityType,
  ResolutionCandidate,
  EntityMatch,
  ResolvedEntity,
  ResolutionResult,

  // Hint types
  PersonResolutionHints,
  EventResolutionHints,
  TaskResolutionHints,
  EmailResolutionHints,
  PlaceResolutionHints,
  DeadlineResolutionHints,
  RoutineResolutionHints,
  OpenLoopResolutionHints,
  ProjectResolutionHints,
  NoteResolutionHints,
  OpportunityResolutionHints,

  // Config types
  ResolverConfig,
  IEntityResolver,
} from "./types";

export {
  DEFAULT_RESOLVER_CONFIG,
  EntityResolutionError,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Matchers
// ─────────────────────────────────────────────────────────────

export {
  // String normalization
  normalizeString,
  normalizeName,
  extractNameParts,

  // Similarity algorithms
  levenshteinDistance,
  levenshteinSimilarity,
  jaroWinklerSimilarity,
  containsMatch,
  partialMatchScore,

  // Name matching
  nameSimilarity,
  couldBeNickname,

  // Email matching
  extractEmailUsername,
  nameMatchesEmail,

  // Text matching
  textSimilarity,

  // Disambiguation
  rankCandidates,
  generateDisambiguationQuestion,
  generateNotFoundMessage,
} from "./matchers";

// ─────────────────────────────────────────────────────────────
// Resolver
// ─────────────────────────────────────────────────────────────

export {
  // Resolver class
  EntityResolver,

  // Singleton access
  getEntityResolver,
  createEntityResolver,

  // Convenience functions
  resolveEntities,
  resolvePerson,
  resolveEvent,
  resolveTask,
  resolveEmail,
  resolvePlace,
  resolveDeadline,
  resolveRoutine,
  resolveOpenLoop,
  resolveProject,
  resolveNote,
  resolveOpportunity,
} from "./resolver";

