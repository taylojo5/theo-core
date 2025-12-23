// ═══════════════════════════════════════════════════════════════════════════
// OpenAPI Common Parameters
// Reusable query and path parameters
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "./schemas/common";

// ─────────────────────────────────────────────────────────────
// Path Parameters
// ─────────────────────────────────────────────────────────────

export const IdPathParam = z.string().openapi({
  param: {
    name: "id",
    in: "path",
    required: true,
  },
  description: "Unique identifier (CUID)",
  example: "clx1234567890abcdef",
});

// ─────────────────────────────────────────────────────────────
// Pagination Parameters
// ─────────────────────────────────────────────────────────────

export const LimitParam = z.coerce
  .number()
  .int()
  .min(1)
  .max(100)
  .default(20)
  .openapi({
    param: {
      name: "limit",
      in: "query",
    },
    description: "Maximum number of items to return (1-100)",
    example: 20,
  });

export const CursorParam = z.string().optional().openapi({
  param: {
    name: "cursor",
    in: "query",
  },
  description: "Pagination cursor from previous response",
  example: "clx9876543210fedcba",
});

export const OffsetParam = z.coerce
  .number()
  .int()
  .min(0)
  .default(0)
  .openapi({
    param: {
      name: "offset",
      in: "query",
    },
    description: "Number of items to skip",
    example: 0,
  });

// ─────────────────────────────────────────────────────────────
// Filter Parameters
// ─────────────────────────────────────────────────────────────

export const SearchParam = z.string().optional().openapi({
  param: {
    name: "search",
    in: "query",
  },
  description: "Text search query",
  example: "john",
});

export const TagsParam = z.string().optional().openapi({
  param: {
    name: "tags",
    in: "query",
  },
  description: "Comma-separated list of tags to filter by",
  example: "work,important",
});

export const IncludeDeletedParam = z
  .string()
  .optional()
  .transform((val) => val === "true")
  .openapi({
    param: {
      name: "includeDeleted",
      in: "query",
    },
    description: "Include soft-deleted items in results",
    example: "false",
  });

export const SourceParam = z
  .enum(["manual", "gmail", "slack", "calendar"])
  .optional()
  .openapi({
    param: {
      name: "source",
      in: "query",
    },
    description: "Filter by data source",
    example: "gmail",
  });

// ─────────────────────────────────────────────────────────────
// Date Range Parameters
// ─────────────────────────────────────────────────────────────

export const StartDateParam = z.string().datetime().optional().openapi({
  param: {
    name: "startDate",
    in: "query",
  },
  description: "Filter by start date (ISO 8601)",
  example: "2024-01-01T00:00:00Z",
});

export const EndDateParam = z.string().datetime().optional().openapi({
  param: {
    name: "endDate",
    in: "query",
  },
  description: "Filter by end date (ISO 8601)",
  example: "2024-12-31T23:59:59Z",
});

// ─────────────────────────────────────────────────────────────
// Search Parameters
// ─────────────────────────────────────────────────────────────

export const SemanticSearchParam = z
  .string()
  .optional()
  .transform((val) => val === "true")
  .openapi({
    param: {
      name: "useSemanticSearch",
      in: "query",
    },
    description: "Enable AI-powered semantic search (slower, more accurate)",
    example: "true",
  });

export const MinSimilarityParam = z.coerce
  .number()
  .min(0)
  .max(1)
  .optional()
  .openapi({
    param: {
      name: "minSimilarity",
      in: "query",
    },
    description: "Minimum similarity threshold for semantic search (0-1)",
    example: 0.7,
  });
