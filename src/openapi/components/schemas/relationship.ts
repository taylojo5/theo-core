// ═══════════════════════════════════════════════════════════════════════════
// Relationship OpenAPI Schemas
// Schema definitions for entity relationships
// ═══════════════════════════════════════════════════════════════════════════

import {
  z,
  BaseEntitySchema,
  MetadataSchema,
  createPaginatedSchema,
} from "./common";

// Entity types that can have relationships
const EntityTypeSchema = z.enum(["person", "place", "event", "task", "deadline"]);

// ─────────────────────────────────────────────────────────────
// Relationship Create Schema
// ─────────────────────────────────────────────────────────────

export const RelationshipCreateSchema = z
  .object({
    sourceType: EntityTypeSchema.openapi({
      description: "Type of the source entity",
      example: "person",
    }),
    sourceId: z.string().min(1).openapi({
      description: "ID of the source entity",
      example: "clx1234567890abcdef",
    }),
    targetType: EntityTypeSchema.openapi({
      description: "Type of the target entity",
      example: "place",
    }),
    targetId: z.string().min(1).openapi({
      description: "ID of the target entity",
      example: "clx9876543210fedcba",
    }),
    relationship: z.string().min(1).max(100).openapi({
      description: "Type of relationship",
      example: "works_at",
    }),
    strength: z.coerce.number().int().min(1).max(10).default(5).openapi({
      description: "Relationship strength (1-10)",
      example: 8,
    }),
    bidirectional: z.boolean().default(false).openapi({
      description: "Whether the relationship goes both ways",
    }),
    notes: z.string().optional().nullable().openapi({
      description: "Notes about this relationship",
    }),
    metadata: MetadataSchema.default({}),
  })
  .openapi("RelationshipCreate");

// ─────────────────────────────────────────────────────────────
// Relationship Update Schema
// ─────────────────────────────────────────────────────────────

export const RelationshipUpdateSchema = z
  .object({
    relationship: z.string().min(1).max(100).optional(),
    strength: z.coerce.number().int().min(1).max(10).optional(),
    bidirectional: z.boolean().optional(),
    notes: z.string().optional().nullable(),
    metadata: MetadataSchema.optional(),
  })
  .openapi("RelationshipUpdate");

// ─────────────────────────────────────────────────────────────
// Relationship Response Schema
// ─────────────────────────────────────────────────────────────

export const RelationshipSchema = BaseEntitySchema.extend({
  userId: z.string(),
  sourceType: EntityTypeSchema,
  sourceId: z.string(),
  targetType: EntityTypeSchema,
  targetId: z.string(),
  relationship: z.string(),
  strength: z.number(),
  bidirectional: z.boolean(),
  notes: z.string().nullable(),
  metadata: MetadataSchema,
}).openapi("Relationship");

// ─────────────────────────────────────────────────────────────
// Relationship List Query Schema
// ─────────────────────────────────────────────────────────────

export const RelationshipListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().optional(),
    entityType: EntityTypeSchema.optional().openapi({
      description: "Filter by entity type (source or target)",
    }),
    entityId: z.string().optional().openapi({
      description: "Filter by entity ID (source or target)",
    }),
    relationship: z.string().optional().openapi({
      description: "Filter by relationship type",
      example: "works_at",
    }),
  })
  .openapi("RelationshipListQuery");

// ─────────────────────────────────────────────────────────────
// Paginated Response
// ─────────────────────────────────────────────────────────────

export const PaginatedRelationshipsSchema = createPaginatedSchema(
  RelationshipSchema,
  "Relationships"
);

