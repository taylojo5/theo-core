// ═══════════════════════════════════════════════════════════════════════════
// Deadline OpenAPI Schemas
// Schema definitions for deadlines/milestones
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
// Deadline Create Schema
// ─────────────────────────────────────────────────────────────

export const DeadlineCreateSchema = z
  .object({
    title: z.string().min(1).max(500).openapi({
      description: "Deadline title",
      example: "Q1 Report Submission",
    }),
    description: z.string().optional().nullable().openapi({
      description: "Detailed description",
    }),
    type: z.enum(["deadline", "milestone", "reminder"]).default("deadline").openapi({
      description: "Type of deadline",
    }),
    dueAt: z.string().datetime().openapi({
      description: "Due date/time (ISO 8601)",
      example: "2024-03-31T23:59:59Z",
    }),
    reminderAt: z.string().datetime().optional().nullable().openapi({
      description: "When to send a reminder",
      example: "2024-03-30T09:00:00Z",
    }),
    status: z
      .enum(["pending", "completed", "missed", "extended"])
      .default("pending")
      .openapi({
        description: "Deadline status",
      }),
    importance: z.coerce.number().int().min(1).max(10).default(5).openapi({
      description: "Importance level (1-10)",
      example: 9,
    }),
    taskId: z.string().optional().nullable().openapi({
      description: "Related task ID",
    }),
    eventId: z.string().optional().nullable().openapi({
      description: "Related event ID",
    }),
    notes: z.string().optional().nullable().openapi({
      description: "Private notes",
    }),
    consequences: z.string().optional().nullable().openapi({
      description: "What happens if deadline is missed",
      example: "Late fee of $50 applied",
    }),
    source: z.enum(["manual", "gmail", "slack", "calendar"]).default("manual"),
    sourceId: z.string().max(255).optional().nullable(),
    tags: TagsSchema.default([]),
    metadata: MetadataSchema.default({}),
  })
  .openapi("DeadlineCreate");

// ─────────────────────────────────────────────────────────────
// Deadline Update Schema
// ─────────────────────────────────────────────────────────────

export const DeadlineUpdateSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().optional().nullable(),
    type: z.enum(["deadline", "milestone", "reminder"]).optional(),
    dueAt: z.string().datetime().optional(),
    reminderAt: z.string().datetime().optional().nullable(),
    status: z.enum(["pending", "completed", "missed", "extended"]).optional(),
    importance: z.coerce.number().int().min(1).max(10).optional(),
    taskId: z.string().optional().nullable(),
    eventId: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    consequences: z.string().optional().nullable(),
    tags: TagsSchema.optional(),
    metadata: MetadataSchema.optional(),
    restore: z.boolean().optional().openapi({
      description: "If true, restores a soft-deleted deadline",
    }),
  })
  .openapi("DeadlineUpdate");

// ─────────────────────────────────────────────────────────────
// Deadline Response Schema
// ─────────────────────────────────────────────────────────────

export const DeadlineSchema = BaseEntitySchema.merge(SoftDeleteSchema)
  .merge(SourceTrackingSchema)
  .extend({
    userId: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    type: z.enum(["deadline", "milestone", "reminder"]),
    dueAt: z.string().datetime(),
    reminderAt: z.string().datetime().nullable(),
    status: z.enum(["pending", "completed", "missed", "extended"]),
    importance: z.number(),
    taskId: z.string().nullable(),
    eventId: z.string().nullable(),
    notes: z.string().nullable(),
    consequences: z.string().nullable(),
    tags: TagsSchema,
    metadata: MetadataSchema,
  })
  .openapi("Deadline");

// ─────────────────────────────────────────────────────────────
// Deadline List Query Schema
// ─────────────────────────────────────────────────────────────

export const DeadlineListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().optional(),
    status: z.enum(["pending", "completed", "missed", "extended"]).optional().openapi({
      description: "Filter by status",
    }),
    type: z.enum(["deadline", "milestone", "reminder"]).optional().openapi({
      description: "Filter by type",
    }),
    dueBefore: z.string().datetime().optional().openapi({
      description: "Filter deadlines due before this time",
    }),
    dueAfter: z.string().datetime().optional().openapi({
      description: "Filter deadlines due after this time",
    }),
    search: z.string().optional().openapi({
      description: "Text search across title and description",
    }),
    includeDeleted: z
      .string()
      .optional()
      .transform((val) => val === "true"),
  })
  .openapi("DeadlineListQuery");

// ─────────────────────────────────────────────────────────────
// Paginated Response
// ─────────────────────────────────────────────────────────────

export const PaginatedDeadlinesSchema = createPaginatedSchema(DeadlineSchema, "Deadlines");

