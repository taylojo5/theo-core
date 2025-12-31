// ═══════════════════════════════════════════════════════════════════════════
// Embeddings Module
// Vector embedding generation and storage for semantic search
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  EmbeddingModel,
  GenerateEmbeddingOptions,
  EmbeddingResult,
  BatchEmbeddingResult,
  StoreEmbeddingInput,
  StoredEmbedding,
  ChunkingOptions,
  ChunkedContent,
  RateLimitConfig,
  EmbeddingErrorType,
  EmbeddingProvider,
  IEmbeddingService,
} from "./types";

export {
  DEFAULT_EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  DEFAULT_CHUNKING_OPTIONS,
  DEFAULT_RATE_LIMIT_CONFIG,
  EmbeddingError,
} from "./types";

// ─────────────────────────────────────────────────────────────
// OpenAI Provider
// ─────────────────────────────────────────────────────────────

export {
  OpenAIEmbeddingProvider,
  getOpenAIProvider,
  createOpenAIProvider,
} from "./openai-provider";

// ─────────────────────────────────────────────────────────────
// Embedding Service
// ─────────────────────────────────────────────────────────────

export {
  EmbeddingService,
  getEmbeddingService,
  createEmbeddingService,
  // Convenience functions
  generateEmbedding,
  storeEmbedding,
  deleteEmbeddings,
  needsReembedding,
} from "./embedding-service";

// ─────────────────────────────────────────────────────────────
// Semantic Search Service
// ─────────────────────────────────────────────────────────────

export type {
  SemanticSearchParams,
  FindSimilarParams,
  SemanticSearchResult,
} from "./search-service";

export {
  SemanticSearchService,
  getSemanticSearchService,
  createSemanticSearchService,
  // Convenience functions
  searchSimilar,
  findSimilarToEntity,
  hasEmbedding,
} from "./search-service";
