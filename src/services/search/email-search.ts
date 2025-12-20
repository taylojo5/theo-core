// ═══════════════════════════════════════════════════════════════════════════
// Email Search Service
// Semantic and text search across email content
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import { getEmbeddingService } from "@/lib/embeddings";
import {
  emailRepository,
  type EmailSearchQuery,
} from "@/integrations/gmail/repository";
import { EMAIL_ENTITY_TYPE } from "@/integrations/gmail/embeddings";
import type { Email } from "@prisma/client";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/** Options for email semantic search */
export interface EmailSearchOptions {
  /** Maximum number of results to return (default: 20) */
  limit?: number;
  /** Minimum similarity score for semantic results (0-1, default: 0.5) */
  minSimilarity?: number;
  /** Use semantic search in addition to text search (default: true) */
  useSemanticSearch?: boolean;
  /** Filter by labels */
  labelIds?: string[];
  /** Filter by date range - start */
  startDate?: Date;
  /** Filter by date range - end */
  endDate?: Date;
  /** Filter by sender email */
  fromEmail?: string;
  /** Filter by read status */
  isRead?: boolean;
  /** Filter by starred status */
  isStarred?: boolean;
  /** Filter by attachments */
  hasAttachments?: boolean;
  /** Weight for semantic results in combined ranking (0-1, default: 0.7) */
  semanticWeight?: number;
}

/** Result from email search */
export interface EmailSearchResult {
  /** The matched email */
  email: Email;
  /** Relevance score (0-1, higher is more relevant) */
  score: number;
  /** How the match was found */
  matchType: "text" | "semantic" | "both";
  /** Matched content snippet */
  snippet?: string;
}

/** Combined search result structure */
export interface EmailSearchResponse {
  /** Search results */
  results: EmailSearchResult[];
  /** Total number of potential matches (for pagination) */
  total: number;
  /** Whether semantic search was used */
  usedSemanticSearch: boolean;
}

/** Raw semantic search result from database */
interface RawSemanticResult {
  entity_id: string;
  content: string;
  similarity: number;
  metadata: unknown;
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

/** Default weight for semantic results */
const DEFAULT_SEMANTIC_WEIGHT = 0.7;

// ─────────────────────────────────────────────────────────────
// Email Search Service
// ─────────────────────────────────────────────────────────────

export class EmailSearchService {
  /**
   * Search emails using combined text and semantic search
   *
   * Combines traditional text search with vector similarity search
   * for comprehensive email retrieval.
   */
  async search(
    userId: string,
    query: string,
    options: EmailSearchOptions = {}
  ): Promise<EmailSearchResponse> {
    const {
      limit = DEFAULT_LIMIT,
      minSimilarity = DEFAULT_MIN_SIMILARITY,
      useSemanticSearch = true,
      semanticWeight = DEFAULT_SEMANTIC_WEIGHT,
      ...filters
    } = options;

    const normalizedLimit = Math.min(Math.max(1, limit), MAX_LIMIT);
    const internalLimit = normalizedLimit * 2; // Fetch extra for merging

    // Run text and semantic search in parallel
    const [textResults, semanticResults] = await Promise.all([
      this.textSearch(userId, query, { ...filters, limit: internalLimit }),
      useSemanticSearch
        ? this.semanticSearch(userId, query, {
            limit: internalLimit,
            minSimilarity,
          })
        : Promise.resolve([]),
    ]);

    // Merge results
    const merged = this.mergeResults(
      textResults,
      semanticResults,
      semanticWeight
    );

    // Apply filters and limit
    const filtered = this.applyFilters(merged, filters);
    const limited = filtered.slice(0, normalizedLimit);

    return {
      results: limited,
      total: filtered.length,
      usedSemanticSearch: useSemanticSearch && semanticResults.length > 0,
    };
  }

  /**
   * Search emails using text matching only
   */
  async textSearch(
    userId: string,
    query: string,
    options: EmailSearchOptions = {}
  ): Promise<EmailSearchResult[]> {
    const { limit = DEFAULT_LIMIT, ...filters } = options;

    const searchQuery: EmailSearchQuery = {
      query,
      limit: Math.min(limit, MAX_LIMIT),
      orderBy: "internalDate",
      orderDirection: "desc",
      ...filters,
    };

    const result = await emailRepository.search(userId, searchQuery);

    return result.emails.map((email, index) => ({
      email,
      score: this.calculateTextScore(email, query, index, result.emails.length),
      matchType: "text" as const,
      snippet: this.extractSnippet(email, query),
    }));
  }

  /**
   * Search emails using semantic similarity only
   */
  async semanticSearch(
    userId: string,
    query: string,
    options: { limit?: number; minSimilarity?: number } = {}
  ): Promise<EmailSearchResult[]> {
    const { limit = DEFAULT_LIMIT, minSimilarity = DEFAULT_MIN_SIMILARITY } =
      options;

    const normalizedLimit = Math.min(Math.max(1, limit), MAX_LIMIT);

    try {
      // Generate embedding for the query
      const embeddingService = getEmbeddingService();
      const queryEmbedding = await embeddingService.generateEmbedding(query);
      const vectorString = `[${queryEmbedding.join(",")}]`;

      // Search for similar email embeddings
      const results = await db.$queryRaw<RawSemanticResult[]>`
        SELECT 
          "entityId" as entity_id,
          content,
          1 - (embedding <=> ${vectorString}::vector) as similarity,
          metadata
        FROM "Embedding"
        WHERE "userId" = ${userId}
          AND "entityType" = ${EMAIL_ENTITY_TYPE}
          AND embedding IS NOT NULL
          AND 1 - (embedding <=> ${vectorString}::vector) >= ${minSimilarity}
        ORDER BY embedding <=> ${vectorString}::vector ASC
        LIMIT ${normalizedLimit}
      `;

      if (results.length === 0) {
        return [];
      }

      // Fetch the actual email records
      const emailIds = results.map((r) => r.entity_id);
      const emails = await db.email.findMany({
        where: {
          id: { in: emailIds },
          userId,
        },
      });

      // Create a lookup map
      const emailMap = new Map(emails.map((e) => [e.id, e]));

      // Map results with emails
      return results
        .filter((r) => emailMap.has(r.entity_id))
        .map((r) => ({
          email: emailMap.get(r.entity_id)!,
          score: Number(r.similarity),
          matchType: "semantic" as const,
          snippet: r.content.slice(0, 200),
        }));
    } catch (error) {
      console.warn("[EmailSearch] Semantic search failed:", error);
      return [];
    }
  }

  /**
   * Find emails similar to a given email
   */
  async findSimilar(
    userId: string,
    emailId: string,
    options: { limit?: number; minSimilarity?: number } = {}
  ): Promise<EmailSearchResult[]> {
    const { limit = 10, minSimilarity = DEFAULT_MIN_SIMILARITY } = options;

    // Get the source email's embedding
    const sourceEmbedding = await db.embedding.findFirst({
      where: {
        userId,
        entityType: EMAIL_ENTITY_TYPE,
        entityId: emailId,
        chunkIndex: 0,
      },
      select: { id: true },
    });

    if (!sourceEmbedding) {
      return [];
    }

    // Find similar emails using the source embedding
    const results = await db.$queryRaw<RawSemanticResult[]>`
      SELECT 
        e."entityId" as entity_id,
        e.content,
        1 - (e.embedding <=> source.embedding) as similarity,
        e.metadata
      FROM "Embedding" e
      CROSS JOIN (
        SELECT embedding FROM "Embedding" WHERE id = ${sourceEmbedding.id}
      ) source
      WHERE e."userId" = ${userId}
        AND e."entityType" = ${EMAIL_ENTITY_TYPE}
        AND e.embedding IS NOT NULL
        AND 1 - (e.embedding <=> source.embedding) >= ${minSimilarity}
        AND e."entityId" != ${emailId}
      ORDER BY e.embedding <=> source.embedding ASC
      LIMIT ${limit}
    `;

    if (results.length === 0) {
      return [];
    }

    // Fetch the actual email records
    const emailIds = results.map((r) => r.entity_id);
    const emails = await db.email.findMany({
      where: {
        id: { in: emailIds },
        userId,
      },
    });

    const emailMap = new Map(emails.map((e) => [e.id, e]));

    return results
      .filter((r) => emailMap.has(r.entity_id))
      .map((r) => ({
        email: emailMap.get(r.entity_id)!,
        score: Number(r.similarity),
        matchType: "semantic" as const,
        snippet: r.content.slice(0, 200),
      }));
  }

  /**
   * Search emails by thread (conversation)
   */
  async searchThread(
    userId: string,
    threadId: string
  ): Promise<EmailSearchResult[]> {
    const emails = await emailRepository.findByThread(userId, threadId);

    return emails.map((email, index) => ({
      email,
      score: 1 - index * 0.01, // Slight decay by position
      matchType: "text" as const,
    }));
  }

  // ─────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────

  /**
   * Calculate text match score based on position and match quality
   */
  private calculateTextScore(
    email: Email,
    query: string,
    position: number,
    total: number
  ): number {
    const queryLower = query.toLowerCase();
    let score = 1 - (position / total) * 0.3;

    // Boost for subject match
    if (email.subject?.toLowerCase().includes(queryLower)) {
      if (email.subject.toLowerCase() === queryLower) {
        score += 0.3;
      } else if (email.subject.toLowerCase().startsWith(queryLower)) {
        score += 0.2;
      } else {
        score += 0.1;
      }
    }

    // Boost for sender match
    if (
      email.fromEmail.toLowerCase().includes(queryLower) ||
      email.fromName?.toLowerCase().includes(queryLower)
    ) {
      score += 0.1;
    }

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Merge text and semantic search results
   */
  private mergeResults(
    textResults: EmailSearchResult[],
    semanticResults: EmailSearchResult[],
    semanticWeight: number
  ): EmailSearchResult[] {
    const textWeight = 1 - semanticWeight;
    const merged: Map<string, EmailSearchResult> = new Map();

    // Add text results
    for (const result of textResults) {
      merged.set(result.email.id, {
        ...result,
        score: result.score * textWeight,
        matchType: "text",
      });
    }

    // Add/merge semantic results
    for (const result of semanticResults) {
      const existing = merged.get(result.email.id);
      if (existing) {
        merged.set(result.email.id, {
          ...existing,
          score: existing.score + result.score * semanticWeight,
          matchType: "both",
          snippet: result.snippet ?? existing.snippet,
        });
      } else {
        merged.set(result.email.id, {
          ...result,
          score: result.score * semanticWeight,
          matchType: "semantic",
        });
      }
    }

    // Sort by score and return
    return Array.from(merged.values()).sort((a, b) => b.score - a.score);
  }

  /**
   * Apply additional filters to search results
   */
  private applyFilters(
    results: EmailSearchResult[],
    filters: Omit<
      EmailSearchOptions,
      "limit" | "minSimilarity" | "useSemanticSearch" | "semanticWeight"
    >
  ): EmailSearchResult[] {
    return results.filter((result) => {
      const email = result.email;

      if (filters.labelIds && filters.labelIds.length > 0) {
        if (!filters.labelIds.some((label) => email.labelIds.includes(label))) {
          return false;
        }
      }

      if (filters.startDate && email.internalDate < filters.startDate) {
        return false;
      }

      if (filters.endDate && email.internalDate > filters.endDate) {
        return false;
      }

      if (
        filters.fromEmail &&
        !email.fromEmail.toLowerCase().includes(filters.fromEmail.toLowerCase())
      ) {
        return false;
      }

      if (filters.isRead !== undefined && email.isRead !== filters.isRead) {
        return false;
      }

      if (
        filters.isStarred !== undefined &&
        email.isStarred !== filters.isStarred
      ) {
        return false;
      }

      if (
        filters.hasAttachments !== undefined &&
        email.hasAttachments !== filters.hasAttachments
      ) {
        return false;
      }

      return true;
    });
  }

  /**
   * Extract a relevant snippet from email content
   */
  private extractSnippet(email: Email, query: string): string | undefined {
    // Try to find the query in the subject or snippet first
    const content = [email.subject, email.snippet, email.bodyText]
      .filter(Boolean)
      .join(" ");

    if (!content) {
      return undefined;
    }

    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();
    const index = contentLower.indexOf(queryLower);

    if (index === -1) {
      // Return beginning of content if query not found directly
      return content.slice(0, 200);
    }

    // Extract snippet around the match
    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + query.length + 150);
    let snippet = content.slice(start, end);

    if (start > 0) {
      snippet = "..." + snippet;
    }
    if (end < content.length) {
      snippet = snippet + "...";
    }

    return snippet;
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────

let defaultService: EmailSearchService | null = null;

/**
 * Get the default email search service instance
 */
export function getEmailSearchService(): EmailSearchService {
  if (!defaultService) {
    defaultService = new EmailSearchService();
  }
  return defaultService;
}

/**
 * Create a new email search service instance
 */
export function createEmailSearchService(): EmailSearchService {
  return new EmailSearchService();
}

// ─────────────────────────────────────────────────────────────
// Convenience Functions
// ─────────────────────────────────────────────────────────────

/**
 * Search emails using combined text and semantic search (convenience function)
 */
export async function searchEmails(
  userId: string,
  query: string,
  options?: EmailSearchOptions
): Promise<EmailSearchResponse> {
  return getEmailSearchService().search(userId, query, options);
}

/**
 * Search emails using semantic similarity only (convenience function)
 */
export async function semanticSearchEmails(
  userId: string,
  query: string,
  options?: { limit?: number; minSimilarity?: number }
): Promise<EmailSearchResult[]> {
  return getEmailSearchService().semanticSearch(userId, query, options);
}

/**
 * Find emails similar to a given email (convenience function)
 */
export async function findSimilarEmails(
  userId: string,
  emailId: string,
  options?: { limit?: number; minSimilarity?: number }
): Promise<EmailSearchResult[]> {
  return getEmailSearchService().findSimilar(userId, emailId, options);
}
