// ═══════════════════════════════════════════════════════════════════════════
// Common OpenAPI Schemas
// Base schemas used across multiple entities
// ═══════════════════════════════════════════════════════════════════════════

import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

// Extend Zod with OpenAPI support (must be called before using .openapi())
extendZodWithOpenApi(z);

// Re-export z with OpenAPI extension
export { z };

// ─────────────────────────────────────────────────────────────
// Base Entity Schema
// ─────────────────────────────────────────────────────────────

export const BaseEntitySchema = z.object({
  id: z.string().openapi({ example: "clx1234567890abcdef" }),
  createdAt: z.string().datetime().openapi({ example: "2024-01-15T10:30:00Z" }),
  updatedAt: z.string().datetime().openapi({ example: "2024-01-15T10:30:00Z" }),
});

export const SoftDeleteSchema = z.object({
  deletedAt: z
    .string()
    .datetime()
    .nullable()
    .openapi({ example: null }),
});

// ─────────────────────────────────────────────────────────────
// Source Tracking
// ─────────────────────────────────────────────────────────────

export const SourceSchema = z
  .enum(["manual", "gmail", "slack", "calendar"])
  .openapi({
    description: "Origin of the data",
    example: "gmail",
  });

export const SourceTrackingSchema = z.object({
  source: SourceSchema,
  sourceId: z
    .string()
    .nullable()
    .openapi({
      description: "External ID from source system",
      example: "msg_abc123",
    }),
});

// ─────────────────────────────────────────────────────────────
// Metadata & Tags
// ─────────────────────────────────────────────────────────────

export const TagsSchema = z.array(z.string().max(50)).openapi({
  description: "User-defined tags for categorization",
  example: ["work", "important", "follow-up"],
});

export const MetadataSchema = z.record(z.string(), z.unknown()).openapi({
  description: "Arbitrary key-value metadata",
  example: { customField: "value", priority: 1 },
});

// ─────────────────────────────────────────────────────────────
// Pagination Response
// ─────────────────────────────────────────────────────────────

export function createPaginatedSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
  name: string
) {
  return z
    .object({
      items: z.array(itemSchema),
      hasMore: z.boolean().openapi({
        description: "Whether more results are available",
      }),
      nextCursor: z
        .string()
        .optional()
        .openapi({
          description: "Cursor for fetching the next page",
        }),
    })
    .openapi(`Paginated${name}`);
}

// ─────────────────────────────────────────────────────────────
// Success Response
// ─────────────────────────────────────────────────────────────

export const DeleteSuccessSchema = z
  .object({
    success: z.literal(true),
  })
  .openapi("DeleteSuccess", {
    description: "Successful deletion response",
  });

// ─────────────────────────────────────────────────────────────
// Rate Limit Headers
// ─────────────────────────────────────────────────────────────

export const rateLimitHeaders = {
  "X-RateLimit-Limit": {
    description: "Maximum requests allowed per window",
    schema: { type: "integer" as const },
  },
  "X-RateLimit-Remaining": {
    description: "Requests remaining in current window",
    schema: { type: "integer" as const },
  },
  "X-RateLimit-Reset": {
    description: "Unix timestamp when rate limit resets",
    schema: { type: "integer" as const },
  },
};
