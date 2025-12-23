// ═══════════════════════════════════════════════════════════════════════════
// Place OpenAPI Schemas
// Schema definitions for locations/places
// ═══════════════════════════════════════════════════════════════════════════

import {
  z,
  BaseEntitySchema,
  SoftDeleteSchema,
  SourceTrackingSchema,
  TagsSchema,
  MetadataSchema,
  createPaginatedSchema,
} from "./common";

// ─────────────────────────────────────────────────────────────
// Place Create Schema
// ─────────────────────────────────────────────────────────────

export const PlaceCreateSchema = z
  .object({
    name: z.string().min(1).max(255).openapi({
      description: "Name of the place",
      example: "Acme Corp HQ",
    }),
    type: z.string().max(50).default("location").openapi({
      description: "Type of place (office, home, restaurant, etc.)",
      example: "office",
    }),
    address: z.string().optional().nullable().openapi({
      description: "Street address",
      example: "123 Main St",
    }),
    city: z.string().max(100).optional().nullable().openapi({
      description: "City name",
      example: "San Francisco",
    }),
    state: z.string().max(100).optional().nullable().openapi({
      description: "State or province",
      example: "CA",
    }),
    country: z.string().max(100).optional().nullable().openapi({
      description: "Country",
      example: "USA",
    }),
    postalCode: z.string().max(20).optional().nullable().openapi({
      description: "Postal/ZIP code",
      example: "94102",
    }),
    latitude: z.coerce.number().min(-90).max(90).optional().nullable().openapi({
      description: "Latitude coordinate",
      example: 37.7749,
    }),
    longitude: z.coerce.number().min(-180).max(180).optional().nullable().openapi({
      description: "Longitude coordinate",
      example: -122.4194,
    }),
    timezone: z.string().max(50).optional().nullable().openapi({
      description: "IANA timezone",
      example: "America/Los_Angeles",
    }),
    notes: z.string().optional().nullable().openapi({
      description: "Private notes about this place",
    }),
    importance: z.coerce.number().int().min(1).max(10).default(5).openapi({
      description: "Importance level (1-10)",
      example: 7,
    }),
    source: z.enum(["manual", "gmail", "slack", "calendar"]).default("manual"),
    sourceId: z.string().max(255).optional().nullable(),
    tags: TagsSchema.default([]),
    metadata: MetadataSchema.default({}),
  })
  .openapi("PlaceCreate");

// ─────────────────────────────────────────────────────────────
// Place Update Schema
// ─────────────────────────────────────────────────────────────

export const PlaceUpdateSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    type: z.string().max(50).optional(),
    address: z.string().optional().nullable(),
    city: z.string().max(100).optional().nullable(),
    state: z.string().max(100).optional().nullable(),
    country: z.string().max(100).optional().nullable(),
    postalCode: z.string().max(20).optional().nullable(),
    latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
    timezone: z.string().max(50).optional().nullable(),
    notes: z.string().optional().nullable(),
    importance: z.coerce.number().int().min(1).max(10).optional(),
    tags: TagsSchema.optional(),
    metadata: MetadataSchema.optional(),
    restore: z.boolean().optional().openapi({
      description: "If true, restores a soft-deleted place",
    }),
  })
  .openapi("PlaceUpdate");

// ─────────────────────────────────────────────────────────────
// Place Response Schema
// ─────────────────────────────────────────────────────────────

export const PlaceSchema = BaseEntitySchema.merge(SoftDeleteSchema)
  .merge(SourceTrackingSchema)
  .extend({
    userId: z.string(),
    name: z.string(),
    type: z.string(),
    address: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    country: z.string().nullable(),
    postalCode: z.string().nullable(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    timezone: z.string().nullable(),
    notes: z.string().nullable(),
    importance: z.number(),
    tags: TagsSchema,
    metadata: MetadataSchema,
  })
  .openapi("Place");

// ─────────────────────────────────────────────────────────────
// Place List Query Schema
// ─────────────────────────────────────────────────────────────

export const PlaceListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().optional(),
    type: z.string().optional().openapi({
      description: "Filter by place type",
      example: "office",
    }),
    city: z.string().optional().openapi({
      description: "Filter by city",
      example: "San Francisco",
    }),
    country: z.string().optional().openapi({
      description: "Filter by country",
      example: "USA",
    }),
    search: z.string().optional().openapi({
      description: "Text search across name and address",
    }),
    includeDeleted: z
      .string()
      .optional()
      .transform((val) => val === "true"),
  })
  .openapi("PlaceListQuery");

// ─────────────────────────────────────────────────────────────
// Paginated Response
// ─────────────────────────────────────────────────────────────

export const PaginatedPlacesSchema = createPaginatedSchema(PlaceSchema, "Places");

