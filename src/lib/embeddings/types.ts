// ═══════════════════════════════════════════════════════════════════════════
// Embedding Service Types
// Type definitions for vector embeddings and semantic search
// ═══════════════════════════════════════════════════════════════════════════

import type { EntityType } from "@/services/context/types";

// ─────────────────────────────────────────────────────────────
// Embedding Models
// ─────────────────────────────────────────────────────────────

/**
 * Supported embedding models
 * - text-embedding-3-small: 1536 dimensions, cheaper, good quality
 * - text-embedding-3-large: 3072 dimensions, best quality, more expensive
 * - text-embedding-ada-002: 1536 dimensions, legacy model
 */
export type EmbeddingModel =
  | "text-embedding-3-small"
  | "text-embedding-3-large"
  | "text-embedding-ada-002";

/** Default embedding model for the service */
export const DEFAULT_EMBEDDING_MODEL: EmbeddingModel = "text-embedding-3-small";

/** Dimensions for each embedding model */
export const EMBEDDING_DIMENSIONS: Record<EmbeddingModel, number> = {
  "text-embedding-3-small": 1536,
  "text-embedding-3-large": 3072,
  "text-embedding-ada-002": 1536,
};

// ─────────────────────────────────────────────────────────────
// Embedding Generation
// ─────────────────────────────────────────────────────────────

/** Options for generating embeddings */
export interface GenerateEmbeddingOptions {
  /** Model to use for embedding generation */
  model?: EmbeddingModel;
  /** Optional user identifier for OpenAI abuse monitoring */
  user?: string;
}

/** Result of embedding generation */
export interface EmbeddingResult {
  /** The vector embedding */
  embedding: number[];
  /** Model used for generation */
  model: EmbeddingModel;
  /** Tokens used for this embedding */
  tokensUsed: number;
}

/** Result of batch embedding generation */
export interface BatchEmbeddingResult {
  /** Embeddings in order of input */
  embeddings: number[][];
  /** Model used for generation */
  model: EmbeddingModel;
  /** Total tokens used */
  totalTokensUsed: number;
}

// ─────────────────────────────────────────────────────────────
// Embedding Storage
// ─────────────────────────────────────────────────────────────

/** Input for storing an embedding */
export interface StoreEmbeddingInput {
  /** User who owns this embedding */
  userId: string;
  /** Type of entity this embedding represents */
  entityType: EntityType | string;
  /** ID of the entity */
  entityId: string;
  /** Text content that was embedded */
  content: string;
  /** Chunk index for long content split into multiple embeddings */
  chunkIndex?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/** Stored embedding record */
export interface StoredEmbedding {
  id: string;
  userId: string;
  entityType: string;
  entityId: string;
  chunkIndex: number;
  content: string;
  contentHash: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────
// Content Chunking
// ─────────────────────────────────────────────────────────────

/** Options for content chunking */
export interface ChunkingOptions {
  /** Maximum tokens per chunk (default: 8000 for text-embedding-3-small) */
  maxTokens?: number;
  /** Overlap between chunks in tokens (default: 100) */
  overlapTokens?: number;
  /** Separator to use when splitting (default: sentence boundaries) */
  separator?: "sentence" | "paragraph" | "word";
}

/** Default chunking options */
export const DEFAULT_CHUNKING_OPTIONS: Required<ChunkingOptions> = {
  maxTokens: 8000,
  overlapTokens: 100,
  separator: "sentence",
};

/** Result of content chunking */
export interface ChunkedContent {
  /** The text chunks */
  chunks: string[];
  /** Original content length in characters */
  originalLength: number;
  /** Whether content was chunked */
  wasChunked: boolean;
}

// ─────────────────────────────────────────────────────────────
// Rate Limiting
// ─────────────────────────────────────────────────────────────

/** Rate limit configuration */
export interface RateLimitConfig {
  /** Maximum requests per minute */
  requestsPerMinute: number;
  /** Maximum tokens per minute */
  tokensPerMinute: number;
  /** Initial retry delay in ms */
  initialRetryDelay: number;
  /** Maximum retry delay in ms */
  maxRetryDelay: number;
  /** Maximum number of retries */
  maxRetries: number;
}

/** Default rate limit configuration (conservative) */
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  requestsPerMinute: 3000,
  tokensPerMinute: 1000000,
  initialRetryDelay: 1000,
  maxRetryDelay: 60000,
  maxRetries: 5,
};

// ─────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────

/** Types of embedding errors */
export type EmbeddingErrorType =
  | "rate_limit"
  | "invalid_input"
  | "api_error"
  | "network_error"
  | "content_too_long"
  | "empty_content";

/** Custom error for embedding operations */
export class EmbeddingError extends Error {
  constructor(
    message: string,
    public readonly type: EmbeddingErrorType,
    public readonly retryable: boolean = false,
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = "EmbeddingError";
  }

  static rateLimited(retryAfter?: number): EmbeddingError {
    return new EmbeddingError(
      `Rate limited${retryAfter ? `, retry after ${retryAfter}ms` : ""}`,
      "rate_limit",
      true,
      retryAfter
    );
  }

  static invalidInput(message: string): EmbeddingError {
    return new EmbeddingError(message, "invalid_input", false);
  }

  static apiError(message: string): EmbeddingError {
    return new EmbeddingError(message, "api_error", true);
  }

  static networkError(message: string): EmbeddingError {
    return new EmbeddingError(message, "network_error", true);
  }

  static contentTooLong(length: number, maxLength: number): EmbeddingError {
    return new EmbeddingError(
      `Content too long: ${length} characters (max: ${maxLength})`,
      "content_too_long",
      false
    );
  }

  static emptyContent(): EmbeddingError {
    return new EmbeddingError(
      "Cannot generate embedding for empty content",
      "empty_content",
      false
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────

/** Embedding provider interface (for swappable backends) */
export interface EmbeddingProvider {
  /** Generate embedding for a single text */
  generateEmbedding(
    text: string,
    options?: GenerateEmbeddingOptions
  ): Promise<EmbeddingResult>;

  /** Generate embeddings for multiple texts (batched) */
  generateEmbeddings(
    texts: string[],
    options?: GenerateEmbeddingOptions
  ): Promise<BatchEmbeddingResult>;

  /** Get the current model being used */
  getModel(): EmbeddingModel;

  /** Get dimensions for the current model */
  getDimensions(): number;
}

/** Main embedding service interface */
export interface IEmbeddingService {
  /** Generate embedding for text */
  generateEmbedding(
    text: string,
    options?: GenerateEmbeddingOptions
  ): Promise<number[]>;

  /** Generate embeddings for multiple texts */
  generateEmbeddings(
    texts: string[],
    options?: GenerateEmbeddingOptions
  ): Promise<number[][]>;

  /** Store embedding for an entity */
  storeEmbedding(input: StoreEmbeddingInput): Promise<StoredEmbedding>;

  /** Update embedding when entity changes */
  updateEmbedding(
    userId: string,
    entityType: EntityType | string,
    entityId: string,
    newContent: string
  ): Promise<void>;

  /** Delete embeddings for an entity */
  deleteEmbeddings(
    userId: string,
    entityType: EntityType | string,
    entityId: string
  ): Promise<void>;

  /** Chunk long content for embedding */
  chunkContent(content: string, options?: ChunkingOptions): string[];

  /** Check if content needs to be re-embedded (hash comparison) */
  needsReembedding(
    userId: string,
    entityType: EntityType | string,
    entityId: string,
    content: string
  ): Promise<boolean>;
}

