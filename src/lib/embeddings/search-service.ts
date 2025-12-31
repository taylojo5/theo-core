// ═══════════════════════════════════════════════════════════════════════════
// Semantic Search Service
// Vector similarity search using pgvector for context retrieval
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import type { EntityType } from "@/services/context/types";
import { getEmbeddingService } from "./embedding-service";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/** Parameters for semantic similarity search */
export interface SemanticSearchParams {
  /** User ID for ownership filtering */
  userId: string;
  /** Query text to find similar content for */
  query: string;
  /** Entity types to search (all if not specified) */
  entityTypes?: EntityType[];
  /** Maximum number of results (default: 10) */
  limit?: number;
  /** Minimum similarity score (0-1, default: 0.5) */
  minSimilarity?: number;
}

/** Parameters for finding similar entities to an existing entity */
export interface FindSimilarParams {
  /** User ID for ownership filtering */
  userId: string;
  /** Entity type of the source entity */
  entityType: EntityType;
  /** ID of the source entity */
  entityId: string;
  /** Target entity types to search (all if not specified) */
  targetTypes?: EntityType[];
  /** Maximum number of results (default: 10) */
  limit?: number;
  /** Minimum similarity score (0-1, default: 0.5) */
  minSimilarity?: number;
  /** Exclude the source entity from results (default: true) */
  excludeSelf?: boolean;
}

/** Result from semantic search */
export interface SemanticSearchResult {
  /** Type of the matched entity */
  entityType: EntityType;
  /** ID of the matched entity */
  entityId: string;
  /** The matched content chunk */
  content: string;
  /** Chunk index if content was split */
  chunkIndex: number;
  /** Similarity score (0-1, higher is more similar) */
  similarity: number;
  /** Additional metadata stored with the embedding */
  metadata: Record<string, unknown>;
}

/** Raw database result from vector search */
interface RawSearchResult {
  entity_type: string;
  entity_id: string;
  content: string;
  chunk_index: number;
  similarity: number;
  metadata: unknown;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** Default minimum similarity threshold */
const DEFAULT_MIN_SIMILARITY = 0.5;

/** Default maximum results */
const DEFAULT_LIMIT = 10;

/** Maximum results allowed */
const MAX_LIMIT = 100;

/** All searchable entity types */
const ALL_ENTITY_TYPES: EntityType[] = [
  "person",
  "place",
  "event",
  "task",
  "deadline",
];

// ─────────────────────────────────────────────────────────────
// Semantic Search Service
// ─────────────────────────────────────────────────────────────

export class SemanticSearchService {
  /**
   * Search for similar content using vector embeddings
   *
   * Uses cosine distance (<=>) with pgvector to find semantically
   * similar content based on the query text.
   */
  async searchSimilar(
    params: SemanticSearchParams
  ): Promise<SemanticSearchResult[]> {
    const {
      userId,
      query,
      entityTypes = ALL_ENTITY_TYPES,
      limit = DEFAULT_LIMIT,
      minSimilarity = DEFAULT_MIN_SIMILARITY,
    } = params;

    // Validate and normalize parameters
    const normalizedLimit = Math.min(Math.max(1, limit), MAX_LIMIT);
    const normalizedMinSimilarity = Math.min(Math.max(0, minSimilarity), 1);

    // Generate embedding for the query
    const embeddingService = getEmbeddingService();
    const queryEmbedding = await embeddingService.generateEmbedding(query);
    const vectorString = `[${queryEmbedding.join(",")}]`;

    // Perform vector similarity search using pgvector
    // Using cosine distance (<=>), converted to similarity (1 - distance)
    const results = await db.$queryRaw<RawSearchResult[]>`
      SELECT 
        "entityType" as entity_type,
        "entityId" as entity_id,
        content,
        "chunkIndex" as chunk_index,
        1 - (embedding <=> ${vectorString}::vector) as similarity,
        metadata
      FROM "Embedding"
      WHERE "userId" = ${userId}
        AND "entityType" = ANY(${entityTypes}::text[])
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> ${vectorString}::vector) >= ${normalizedMinSimilarity}
      ORDER BY embedding <=> ${vectorString}::vector ASC
      LIMIT ${normalizedLimit}
    `;

    return results.map((row) => ({
      entityType: row.entity_type as EntityType,
      entityId: row.entity_id,
      content: row.content,
      chunkIndex: row.chunk_index,
      similarity: Number(row.similarity),
      metadata: (row.metadata as Record<string, unknown>) ?? {},
    }));
  }

  /**
   * Find entities similar to an existing entity
   *
   * Retrieves the embedding for the source entity and finds
   * other entities with similar embeddings.
   */
  async findSimilarToEntity(
    params: FindSimilarParams
  ): Promise<SemanticSearchResult[]> {
    const {
      userId,
      entityType,
      entityId,
      targetTypes = ALL_ENTITY_TYPES,
      limit = DEFAULT_LIMIT,
      minSimilarity = DEFAULT_MIN_SIMILARITY,
      excludeSelf = true,
    } = params;

    // Get the source entity's embedding(s)
    const sourceEmbeddings = await db.embedding.findMany({
      where: {
        userId,
        entityType,
        entityId,
      },
      select: {
        id: true,
        chunkIndex: true,
      },
    });

    if (sourceEmbeddings.length === 0) {
      return [];
    }

    // Use the first chunk's embedding as the reference
    const sourceEmbeddingId = sourceEmbeddings[0].id;

    // Normalize parameters
    const normalizedLimit = Math.min(Math.max(1, limit), MAX_LIMIT);
    const normalizedMinSimilarity = Math.min(Math.max(0, minSimilarity), 1);

    // Find similar entities using the source embedding
    const resultsWithExclusion = await this.findSimilarWithExclusion(
      userId,
      sourceEmbeddingId,
      targetTypes,
      normalizedLimit,
      normalizedMinSimilarity,
      excludeSelf ? { entityType, entityId } : null
    );

    return resultsWithExclusion;
  }

  /**
   * Internal helper for finding similar entities with optional exclusion
   */
  private async findSimilarWithExclusion(
    userId: string,
    sourceEmbeddingId: string,
    targetTypes: EntityType[],
    limit: number,
    minSimilarity: number,
    exclude: { entityType: EntityType; entityId: string } | null
  ): Promise<SemanticSearchResult[]> {
    if (exclude) {
      const results = await db.$queryRaw<RawSearchResult[]>`
        SELECT 
          e."entityType" as entity_type,
          e."entityId" as entity_id,
          e.content,
          e."chunkIndex" as chunk_index,
          1 - (e.embedding <=> source.embedding) as similarity,
          e.metadata
        FROM "Embedding" e
        CROSS JOIN (
          SELECT embedding FROM "Embedding" WHERE id = ${sourceEmbeddingId}
        ) source
        WHERE e."userId" = ${userId}
          AND e."entityType" = ANY(${targetTypes}::text[])
          AND e.embedding IS NOT NULL
          AND 1 - (e.embedding <=> source.embedding) >= ${minSimilarity}
          AND NOT (e."entityType" = ${exclude.entityType} AND e."entityId" = ${exclude.entityId})
        ORDER BY e.embedding <=> source.embedding ASC
        LIMIT ${limit}
      `;

      return results.map((row) => ({
        entityType: row.entity_type as EntityType,
        entityId: row.entity_id,
        content: row.content,
        chunkIndex: row.chunk_index,
        similarity: Number(row.similarity),
        metadata: (row.metadata as Record<string, unknown>) ?? {},
      }));
    }

    const results = await db.$queryRaw<RawSearchResult[]>`
      SELECT 
        e."entityType" as entity_type,
        e."entityId" as entity_id,
        e.content,
        e."chunkIndex" as chunk_index,
        1 - (e.embedding <=> source.embedding) as similarity,
        e.metadata
      FROM "Embedding" e
      CROSS JOIN (
        SELECT embedding FROM "Embedding" WHERE id = ${sourceEmbeddingId}
      ) source
      WHERE e."userId" = ${userId}
        AND e."entityType" = ANY(${targetTypes}::text[])
        AND e.embedding IS NOT NULL
        AND 1 - (e.embedding <=> source.embedding) >= ${minSimilarity}
      ORDER BY e.embedding <=> source.embedding ASC
      LIMIT ${limit}
    `;

    return results.map((row) => ({
      entityType: row.entity_type as EntityType,
      entityId: row.entity_id,
      content: row.content,
      chunkIndex: row.chunk_index,
      similarity: Number(row.similarity),
      metadata: (row.metadata as Record<string, unknown>) ?? {},
    }));
  }

  /**
   * Get the number of embeddings for a user
   */
  async getEmbeddingCount(
    userId: string,
    entityTypes?: EntityType[]
  ): Promise<number> {
    const types = entityTypes ?? ALL_ENTITY_TYPES;

    const result = await db.embedding.count({
      where: {
        userId,
        entityType: { in: types },
      },
    });

    return result;
  }

  /**
   * Check if an entity has embeddings
   */
  async hasEmbedding(
    userId: string,
    entityType: EntityType,
    entityId: string
  ): Promise<boolean> {
    const count = await db.embedding.count({
      where: {
        userId,
        entityType,
        entityId,
      },
    });

    return count > 0;
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────

let defaultService: SemanticSearchService | null = null;

/**
 * Get the default semantic search service instance
 */
export function getSemanticSearchService(): SemanticSearchService {
  if (!defaultService) {
    defaultService = new SemanticSearchService();
  }
  return defaultService;
}

/**
 * Create a new semantic search service instance
 */
export function createSemanticSearchService(): SemanticSearchService {
  return new SemanticSearchService();
}

// ─────────────────────────────────────────────────────────────
// Convenience Functions
// ─────────────────────────────────────────────────────────────

/**
 * Search for semantically similar content (convenience function)
 */
export async function searchSimilar(
  params: SemanticSearchParams
): Promise<SemanticSearchResult[]> {
  return getSemanticSearchService().searchSimilar(params);
}

/**
 * Find entities similar to an existing entity (convenience function)
 */
export async function findSimilarToEntity(
  params: FindSimilarParams
): Promise<SemanticSearchResult[]> {
  return getSemanticSearchService().findSimilarToEntity(params);
}

/**
 * Check if an entity has embeddings (convenience function)
 */
export async function hasEmbedding(
  userId: string,
  entityType: EntityType,
  entityId: string
): Promise<boolean> {
  return getSemanticSearchService().hasEmbedding(userId, entityType, entityId);
}
