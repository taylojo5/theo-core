// ═══════════════════════════════════════════════════════════════════════════
// Search OpenAPI Schemas
// Schema definitions for search endpoints
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "./common";

// ─────────────────────────────────────────────────────────────
// Context Search Schemas
// ─────────────────────────────────────────────────────────────

export const ContextSearchQuerySchema = z
  .object({
    q: z.string().min(1).max(500).openapi({
      description: "Search query",
      example: "meeting with John about project",
    }),
    types: z.string().optional().openapi({
      description: "Comma-separated entity types to search",
      example: "person,event,task",
    }),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    useSemanticSearch: z
      .string()
      .optional()
      .transform((val) => val === "true")
      .openapi({
        description: "Enable AI-powered semantic search",
      }),
    minSimilarity: z.coerce.number().min(0).max(1).optional().openapi({
      description: "Minimum similarity score for semantic results (0-1)",
      example: 0.7,
    }),
    semanticWeight: z.coerce.number().min(0).max(1).optional().openapi({
      description: "Weight given to semantic vs text results (0-1)",
      example: 0.7,
    }),
  })
  .openapi("ContextSearchQuery");

export const ContextSearchResultSchema = z
  .object({
    entityType: z.enum(["person", "place", "event", "task", "deadline"]),
    entityId: z.string(),
    title: z.string(),
    snippet: z.string().nullable().openapi({
      description: "Relevant text snippet from the result",
    }),
    score: z.number().openapi({
      description: "Relevance score",
    }),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi("ContextSearchResult");

export const ContextSearchResponseSchema = z
  .object({
    query: z.string(),
    totalResults: z.number(),
    resultsByType: z.record(z.string(), z.number()).openapi({
      description: "Count of results by entity type",
      example: { person: 3, event: 2, task: 5 },
    }),
    searchMode: z.enum(["text", "semantic", "hybrid"]),
    results: z.array(ContextSearchResultSchema),
  })
  .openapi("ContextSearchResponse");

// ─────────────────────────────────────────────────────────────
// Email Search Schemas
// ─────────────────────────────────────────────────────────────

export const EmailSearchQuerySchema = z
  .object({
    q: z.string().min(1).max(500).openapi({
      description: "Search query",
      example: "invoice from Acme Corp",
    }),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    useSemanticSearch: z
      .string()
      .optional()
      .transform((val) => val === "true"),
    minSimilarity: z.coerce.number().min(0).max(1).optional(),
    semanticWeight: z.coerce.number().min(0).max(1).optional(),
    labelIds: z.string().optional().openapi({
      description: "Comma-separated Gmail label IDs",
    }),
    startDate: z.string().datetime().optional().openapi({
      description: "Filter emails after this date",
    }),
    endDate: z.string().datetime().optional().openapi({
      description: "Filter emails before this date",
    }),
    fromEmail: z.string().optional().openapi({
      description: "Filter by sender email",
    }),
    isRead: z
      .string()
      .optional()
      .transform((val) => (val === undefined ? undefined : val === "true")),
    isStarred: z
      .string()
      .optional()
      .transform((val) => (val === undefined ? undefined : val === "true")),
    hasAttachments: z
      .string()
      .optional()
      .transform((val) => (val === undefined ? undefined : val === "true")),
  })
  .openapi("EmailSearchQuery");

export const EmailSearchResultSchema = z
  .object({
    id: z.string(),
    gmailMessageId: z.string(),
    threadId: z.string(),
    from: z.string(),
    to: z.array(z.string()),
    subject: z.string(),
    snippet: z.string(),
    receivedAt: z.string().datetime(),
    isRead: z.boolean(),
    isStarred: z.boolean(),
    score: z.number().optional().openapi({
      description: "Relevance score (for semantic search)",
    }),
  })
  .openapi("EmailSearchResult");

export const EmailSearchResponseSchema = z
  .object({
    query: z.string(),
    totalResults: z.number(),
    usedSemanticSearch: z.boolean(),
    results: z.array(EmailSearchResultSchema),
  })
  .openapi("EmailSearchResponse");

export const SimilarEmailsQuerySchema = z
  .object({
    similarTo: z.string().openapi({
      description: "Email ID to find similar emails for",
    }),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    minSimilarity: z.coerce.number().min(0).max(1).optional(),
  })
  .openapi("SimilarEmailsQuery");

export const SimilarEmailsResponseSchema = z
  .object({
    sourceEmailId: z.string(),
    totalResults: z.number(),
    results: z.array(EmailSearchResultSchema),
  })
  .openapi("SimilarEmailsResponse");

