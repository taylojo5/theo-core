// ═══════════════════════════════════════════════════════════════════════════
// Person OpenAPI Schemas
// Schema definitions for people/contacts
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
// Person Create Schema
// ─────────────────────────────────────────────────────────────

export const PersonCreateSchema = z
  .object({
    name: z.string().min(1).max(255).openapi({
      description: "Full name of the person",
      example: "John Smith",
    }),
    email: z
      .string()
      .email()
      .optional()
      .nullable()
      .openapi({
        description: "Email address",
        example: "john.smith@example.com",
      }),
    phone: z
      .string()
      .max(50)
      .optional()
      .nullable()
      .openapi({
        description: "Phone number",
        example: "+1 555-123-4567",
      }),
    type: z.string().max(50).default("contact").openapi({
      description: "Category type (e.g., contact, colleague, client)",
      example: "colleague",
    }),
    importance: z.coerce.number().int().min(1).max(10).default(5).openapi({
      description: "Importance level (1-10)",
      example: 7,
    }),
    company: z
      .string()
      .max(255)
      .optional()
      .nullable()
      .openapi({
        description: "Company or organization",
        example: "Acme Corp",
      }),
    title: z
      .string()
      .max(255)
      .optional()
      .nullable()
      .openapi({
        description: "Job title",
        example: "Senior Engineer",
      }),
    location: z
      .string()
      .max(255)
      .optional()
      .nullable()
      .openapi({
        description: "Location or city",
        example: "San Francisco, CA",
      }),
    timezone: z
      .string()
      .max(50)
      .optional()
      .nullable()
      .openapi({
        description: "IANA timezone",
        example: "America/Los_Angeles",
      }),
    bio: z.string().optional().nullable().openapi({
      description: "Short biography or description",
      example: "Works on the platform team",
    }),
    notes: z.string().optional().nullable().openapi({
      description: "Private notes about this person",
      example: "Met at conference 2024",
    }),
    source: z.enum(["manual", "gmail", "slack", "calendar"]).default("manual"),
    sourceId: z.string().max(255).optional().nullable(),
    tags: TagsSchema.default([]),
    metadata: MetadataSchema.default({}),
  })
  .openapi("PersonCreate");

// ─────────────────────────────────────────────────────────────
// Person Update Schema
// ─────────────────────────────────────────────────────────────

export const PersonUpdateSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    email: z.string().email().optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    type: z.string().max(50).optional(),
    importance: z.coerce.number().int().min(1).max(10).optional(),
    company: z.string().max(255).optional().nullable(),
    title: z.string().max(255).optional().nullable(),
    location: z.string().max(255).optional().nullable(),
    timezone: z.string().max(50).optional().nullable(),
    bio: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    tags: TagsSchema.optional(),
    metadata: MetadataSchema.optional(),
    restore: z.boolean().optional().openapi({
      description: "If true, restores a soft-deleted person",
    }),
  })
  .openapi("PersonUpdate");

// ─────────────────────────────────────────────────────────────
// Person Response Schema
// ─────────────────────────────────────────────────────────────

export const PersonSchema = BaseEntitySchema.merge(SoftDeleteSchema)
  .merge(SourceTrackingSchema)
  .extend({
    userId: z.string(),
    name: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    type: z.string(),
    importance: z.number(),
    company: z.string().nullable(),
    title: z.string().nullable(),
    location: z.string().nullable(),
    timezone: z.string().nullable(),
    bio: z.string().nullable(),
    notes: z.string().nullable(),
    tags: TagsSchema,
    metadata: MetadataSchema,
    lastContactedAt: z.string().datetime().nullable(),
  })
  .openapi("Person");

// ─────────────────────────────────────────────────────────────
// Person List Query Schema
// ─────────────────────────────────────────────────────────────

export const PersonListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().optional().openapi({
      description: "Pagination cursor",
      example: "clx9876543210fedcba",
    }),
    type: z.string().optional().openapi({
      description: "Filter by person type",
      example: "contact",
    }),
    source: z.enum(["manual", "gmail", "slack", "calendar"]).optional(),
    search: z.string().optional().openapi({
      description: "Text search across name, email, company",
      example: "john",
    }),
    tags: z.string().optional().openapi({
      description: "Comma-separated tags to filter by",
      example: "work,important",
    }),
    includeDeleted: z
      .string()
      .optional()
      .transform((val) => val === "true"),
  })
  .openapi("PersonListQuery");

// ─────────────────────────────────────────────────────────────
// Paginated Response
// ─────────────────────────────────────────────────────────────

export const PaginatedPeopleSchema = createPaginatedSchema(
  PersonSchema,
  "People"
);
