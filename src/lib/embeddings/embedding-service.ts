// ═══════════════════════════════════════════════════════════════════════════
// Embedding Service
// Core service for generating, storing, and managing vector embeddings
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import { generateContentHash } from "@/services/context/utils";
import type { EntityType } from "@/services/context/types";
import { getOpenAIProvider } from "./openai-provider";
import {
  type IEmbeddingService,
  type EmbeddingProvider,
  type GenerateEmbeddingOptions,
  type StoreEmbeddingInput,
  type StoredEmbedding,
  type ChunkingOptions,
  DEFAULT_CHUNKING_OPTIONS,
  EmbeddingError,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** Approximate characters per token (for rough estimation) */
const CHARS_PER_TOKEN = 4;

/** Maximum content length for a single embedding (conservative estimate) */

const _MAX_CONTENT_LENGTH = 8000 * CHARS_PER_TOKEN; // ~32,000 characters (reserved for future use)

/** Sentence-ending punctuation for chunking (captures the punctuation) */
const SENTENCE_ENDINGS = /([.!?])\s+/g;

/** Paragraph separators for chunking */
const PARAGRAPH_SEPARATORS = /\n\n+/g;

/** Delay between embedding API calls to avoid rate limits (ms) */
const EMBEDDING_THROTTLE_MS = 1500;

// ─────────────────────────────────────────────────────────────
// Embedding Service Implementation
// ─────────────────────────────────────────────────────────────

export class EmbeddingService implements IEmbeddingService {
  private provider: EmbeddingProvider;

  constructor(provider?: EmbeddingProvider) {
    this.provider = provider ?? getOpenAIProvider();
  }

  /**
   * Generate embedding for text
   */
  async generateEmbedding(
    text: string,
    options?: GenerateEmbeddingOptions
  ): Promise<number[]> {
    const result = await this.provider.generateEmbedding(text, options);
    return result.embedding;
  }

  /**
   * Generate embeddings for multiple texts (batched for efficiency)
   */
  async generateEmbeddings(
    texts: string[],
    options?: GenerateEmbeddingOptions
  ): Promise<number[][]> {
    const result = await this.provider.generateEmbeddings(texts, options);
    return result.embeddings;
  }

  /**
   * Store embedding for an entity
   * Generates the embedding and stores it in the database
   */
  async storeEmbedding(input: StoreEmbeddingInput): Promise<StoredEmbedding> {
    // Validate content
    if (!input.content || input.content.trim().length === 0) {
      throw EmbeddingError.emptyContent();
    }

    // Generate content hash for deduplication
    const contentHash = generateContentHash(input.content);

    // Check if embedding with same hash already exists
    const existing = await db.embedding.findFirst({
      where: {
        userId: input.userId,
        entityType: input.entityType,
        entityId: input.entityId,
        chunkIndex: input.chunkIndex ?? 0,
        contentHash,
      },
    });

    if (existing) {
      // Content unchanged, return existing
      return this.mapToStoredEmbedding(existing);
    }

    // Generate the embedding
    const embedding = await this.generateEmbedding(input.content);

    // Store in database using raw SQL for vector type
    const result = await db.$queryRaw<
      Array<{
        id: string;
        userId: string;
        entityType: string;
        entityId: string;
        chunkIndex: number;
        content: string;
        contentHash: string;
        metadata: unknown;
        createdAt: Date;
        updatedAt: Date;
      }>
    >`
      INSERT INTO "Embedding" (
        id,
        "userId",
        "entityType",
        "entityId",
        "chunkIndex",
        content,
        "contentHash",
        embedding,
        metadata,
        "createdAt",
        "updatedAt"
      )
      VALUES (
        gen_random_uuid()::text,
        ${input.userId},
        ${input.entityType},
        ${input.entityId},
        ${input.chunkIndex ?? 0},
        ${input.content},
        ${contentHash},
        ${this.vectorToString(embedding)}::vector,
        ${JSON.stringify(input.metadata ?? {})}::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT ("userId", "entityType", "entityId", "chunkIndex")
      DO UPDATE SET
        content = EXCLUDED.content,
        "contentHash" = EXCLUDED."contentHash",
        embedding = EXCLUDED.embedding,
        metadata = EXCLUDED.metadata,
        "updatedAt" = NOW()
      RETURNING 
        id,
        "userId",
        "entityType",
        "entityId",
        "chunkIndex",
        content,
        "contentHash",
        metadata,
        "createdAt",
        "updatedAt"
    `;

    if (!result[0]) {
      throw EmbeddingError.apiError("Failed to store embedding");
    }

    return {
      id: result[0].id,
      userId: result[0].userId,
      entityType: result[0].entityType,
      entityId: result[0].entityId,
      chunkIndex: result[0].chunkIndex,
      content: result[0].content,
      contentHash: result[0].contentHash,
      metadata: result[0].metadata as Record<string, unknown>,
      createdAt: result[0].createdAt,
      updatedAt: result[0].updatedAt,
    };
  }

  /**
   * Update embedding when entity content changes
   * Handles chunking for long content with throttling to avoid rate limits
   */
  async updateEmbedding(
    userId: string,
    entityType: EntityType | string,
    entityId: string,
    newContent: string
  ): Promise<void> {
    if (!newContent || newContent.trim().length === 0) {
      // If content is empty, delete existing embeddings
      await this.deleteEmbeddings(userId, entityType, entityId);
      return;
    }

    // Chunk content if needed
    const chunks = this.chunkContent(newContent);

    // Delete existing embeddings with higher chunk indices first
    await db.$executeRaw`
      DELETE FROM "Embedding"
      WHERE "userId" = ${userId}
        AND "entityType" = ${entityType}
        AND "entityId" = ${entityId}
        AND "chunkIndex" >= ${chunks.length}
    `;

    // Generate and store embeddings for each chunk sequentially with throttling
    for (let i = 0; i < chunks.length; i++) {
      const contentHash = generateContentHash(chunks[i]);
      const embedding = await this.generateEmbedding(chunks[i]);

      await db.$executeRaw`
        INSERT INTO "Embedding" (
          id,
          "userId",
          "entityType",
          "entityId",
          "chunkIndex",
          content,
          "contentHash",
          embedding,
          metadata,
          "createdAt",
          "updatedAt"
        )
        VALUES (
          gen_random_uuid()::text,
          ${userId},
          ${entityType},
          ${entityId},
          ${i},
          ${chunks[i]},
          ${contentHash},
          ${this.vectorToString(embedding)}::vector,
          '{}'::jsonb,
          NOW(),
          NOW()
        )
        ON CONFLICT ("userId", "entityType", "entityId", "chunkIndex")
        DO UPDATE SET
          content = EXCLUDED.content,
          "contentHash" = EXCLUDED."contentHash",
          embedding = EXCLUDED.embedding,
          "updatedAt" = NOW()
      `;

      // Throttle between chunks to avoid rate limits
      if (i < chunks.length - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, EMBEDDING_THROTTLE_MS)
        );
      }
    }
  }

  /**
   * Delete all embeddings for an entity
   */
  async deleteEmbeddings(
    userId: string,
    entityType: EntityType | string,
    entityId: string
  ): Promise<void> {
    await db.embedding.deleteMany({
      where: {
        userId,
        entityType,
        entityId,
      },
    });
  }

  /**
   * Chunk long content into smaller pieces for embedding
   * Returns array of text chunks
   */
  chunkContent(content: string, options?: ChunkingOptions): string[] {
    const opts = { ...DEFAULT_CHUNKING_OPTIONS, ...options };
    const maxChars = opts.maxTokens * CHARS_PER_TOKEN;
    const overlapChars = opts.overlapTokens * CHARS_PER_TOKEN;

    // If content is short enough, return as-is
    if (content.length <= maxChars) {
      return [content.trim()];
    }

    const chunks: string[] = [];
    let segmentsWithEndings: Array<{ text: string; ending: string }> = [];

    // Split by separator type
    switch (opts.separator) {
      case "paragraph":
        segmentsWithEndings = content.split(PARAGRAPH_SEPARATORS).map((s) => ({
          text: s,
          ending: "",
        }));
        break;
      case "sentence": {
        // Split while preserving the original punctuation
        // Use matchAll to capture both text and punctuation
        const parts = content.split(SENTENCE_ENDINGS);
        // After splitting with capturing group, parts alternates: [text, punct, text, punct, ...]
        for (let i = 0; i < parts.length; i += 2) {
          const text = parts[i];
          const punct = parts[i + 1] ?? ""; // punctuation captured by the group
          if (text) {
            segmentsWithEndings.push({ text, ending: punct });
          }
        }
        break;
      }
      case "word":
      default:
        segmentsWithEndings = content.split(/\s+/).map((s) => ({
          text: s,
          ending: "",
        }));
        break;
    }

    let currentChunk = "";
    let lastOverlap = "";

    for (const segment of segmentsWithEndings) {
      const trimmedSegment = segment.text.trim();
      if (!trimmedSegment) continue;

      // Add back the original sentence ending if splitting by sentence, otherwise just space
      const segmentWithEnding =
        opts.separator === "sentence"
          ? trimmedSegment + segment.ending + " "
          : trimmedSegment + " ";

      // Check if adding this segment would exceed the limit
      if (currentChunk.length + segmentWithEnding.length > maxChars) {
        // Save current chunk if not empty
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());

          // Calculate overlap from end of current chunk
          lastOverlap = currentChunk.slice(-overlapChars);
        }

        // Start new chunk with overlap
        currentChunk = lastOverlap + segmentWithEnding;
      } else {
        currentChunk += segmentWithEnding;
      }
    }

    // Add final chunk if not empty
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [content.trim()];
  }

  /**
   * Check if content needs to be re-embedded
   * Compares content hash with stored hash
   */
  async needsReembedding(
    userId: string,
    entityType: EntityType | string,
    entityId: string,
    content: string
  ): Promise<boolean> {
    if (!content || content.trim().length === 0) {
      return false;
    }

    const contentHash = generateContentHash(content);

    // Check if we have an embedding with this exact hash
    const existing = await db.embedding.findFirst({
      where: {
        userId,
        entityType,
        entityId,
        chunkIndex: 0,
        contentHash,
      },
      select: { id: true },
    });

    return !existing;
  }

  /**
   * Store embeddings for entity content (with auto-chunking)
   * This is a convenience method for the common case.
   * Includes throttling between chunks to avoid OpenAI rate limits.
   */
  async storeEntityEmbedding(
    userId: string,
    entityType: EntityType | string,
    entityId: string,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<StoredEmbedding[]> {
    if (!content || content.trim().length === 0) {
      return [];
    }

    // Chunk content if needed
    const chunks = this.chunkContent(content);
    const results: StoredEmbedding[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const result = await this.storeEmbedding({
        userId,
        entityType,
        entityId,
        content: chunks[i],
        chunkIndex: i,
        metadata,
      });
      results.push(result);

      // Throttle between chunks to avoid rate limits
      // Only delay if there are more chunks to process
      if (i < chunks.length - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, EMBEDDING_THROTTLE_MS)
        );
      }
    }

    // Clean up any old chunks beyond current chunk count
    await db.$executeRaw`
      DELETE FROM "Embedding"
      WHERE "userId" = ${userId}
        AND "entityType" = ${entityType}
        AND "entityId" = ${entityId}
        AND "chunkIndex" >= ${chunks.length}
    `;

    return results;
  }

  /**
   * Convert number array to PostgreSQL vector string format
   */
  private vectorToString(embedding: number[]): string {
    return `[${embedding.join(",")}]`;
  }

  /**
   * Map database record to StoredEmbedding
   */
  private mapToStoredEmbedding(record: {
    id: string;
    userId: string;
    entityType: string;
    entityId: string;
    chunkIndex: number;
    content: string;
    contentHash: string;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): StoredEmbedding {
    return {
      id: record.id,
      userId: record.userId,
      entityType: record.entityType,
      entityId: record.entityId,
      chunkIndex: record.chunkIndex,
      content: record.content,
      contentHash: record.contentHash,
      metadata: (record.metadata as Record<string, unknown>) ?? {},
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────

let defaultService: EmbeddingService | null = null;

/**
 * Get the default embedding service instance
 */
export function getEmbeddingService(): EmbeddingService {
  if (!defaultService) {
    defaultService = new EmbeddingService();
  }
  return defaultService;
}

/**
 * Create a new embedding service with custom provider
 */
export function createEmbeddingService(
  provider: EmbeddingProvider
): EmbeddingService {
  return new EmbeddingService(provider);
}

// ─────────────────────────────────────────────────────────────
// Convenience Functions
// ─────────────────────────────────────────────────────────────

/**
 * Generate embedding for text (convenience function)
 */
export async function generateEmbedding(
  text: string,
  options?: GenerateEmbeddingOptions
): Promise<number[]> {
  return getEmbeddingService().generateEmbedding(text, options);
}

/**
 * Store embedding for an entity (convenience function)
 */
export async function storeEmbedding(
  input: StoreEmbeddingInput
): Promise<StoredEmbedding> {
  return getEmbeddingService().storeEmbedding(input);
}

/**
 * Delete embeddings for an entity (convenience function)
 */
export async function deleteEmbeddings(
  userId: string,
  entityType: EntityType | string,
  entityId: string
): Promise<void> {
  return getEmbeddingService().deleteEmbeddings(userId, entityType, entityId);
}

/**
 * Check if content needs re-embedding (convenience function)
 */
export async function needsReembedding(
  userId: string,
  entityType: EntityType | string,
  entityId: string,
  content: string
): Promise<boolean> {
  return getEmbeddingService().needsReembedding(
    userId,
    entityType,
    entityId,
    content
  );
}
