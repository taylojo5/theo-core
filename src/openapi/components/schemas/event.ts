// ═══════════════════════════════════════════════════════════════════════════
// Event OpenAPI Schemas
// Schema definitions for events/calendar items
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
// Event Create Schema
// ─────────────────────────────────────────────────────────────

export const EventCreateSchema = z
  .object({
    title: z.string().min(1).max(500).openapi({
      description: "Event title",
      example: "Team Standup",
    }),
    description: z.string().optional().nullable().openapi({
      description: "Event description",
      example: "Daily team sync meeting",
    }),
    type: z.string().max(50).default("meeting").openapi({
      description: "Event type (meeting, appointment, reminder, etc.)",
      example: "meeting",
    }),
    startsAt: z.string().datetime().openapi({
      description: "Start time (ISO 8601)",
      example: "2024-01-15T09:00:00Z",
    }),
    endsAt: z.string().datetime().optional().nullable().openapi({
      description: "End time (ISO 8601)",
      example: "2024-01-15T09:30:00Z",
    }),
    allDay: z.boolean().default(false).openapi({
      description: "Whether this is an all-day event",
    }),
    timezone: z.string().max(50).optional().nullable().openapi({
      description: "IANA timezone",
      example: "America/Los_Angeles",
    }),
    location: z.string().optional().nullable().openapi({
      description: "Location description",
      example: "Conference Room A",
    }),
    placeId: z.string().optional().nullable().openapi({
      description: "Reference to a Place entity",
    }),
    virtualUrl: z.string().url().optional().nullable().or(z.literal("")).openapi({
      description: "Video call URL",
      example: "https://meet.google.com/abc-defg-hij",
    }),
    status: z.enum(["tentative", "confirmed", "cancelled"]).default("confirmed").openapi({
      description: "Event status",
    }),
    visibility: z.enum(["private", "public"]).default("private").openapi({
      description: "Event visibility",
    }),
    notes: z.string().optional().nullable().openapi({
      description: "Private notes",
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
  .openapi("EventCreate");

// ─────────────────────────────────────────────────────────────
// Event Update Schema
// ─────────────────────────────────────────────────────────────

export const EventUpdateSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().optional().nullable(),
    type: z.string().max(50).optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional().nullable(),
    allDay: z.boolean().optional(),
    timezone: z.string().max(50).optional().nullable(),
    location: z.string().optional().nullable(),
    placeId: z.string().optional().nullable(),
    virtualUrl: z.string().url().optional().nullable().or(z.literal("")),
    status: z.enum(["tentative", "confirmed", "cancelled"]).optional(),
    visibility: z.enum(["private", "public"]).optional(),
    notes: z.string().optional().nullable(),
    importance: z.coerce.number().int().min(1).max(10).optional(),
    tags: TagsSchema.optional(),
    metadata: MetadataSchema.optional(),
    restore: z.boolean().optional().openapi({
      description: "If true, restores a soft-deleted event",
    }),
  })
  .openapi("EventUpdate");

// ─────────────────────────────────────────────────────────────
// Event Response Schema
// ─────────────────────────────────────────────────────────────

export const EventSchema = BaseEntitySchema.merge(SoftDeleteSchema)
  .merge(SourceTrackingSchema)
  .extend({
    userId: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    type: z.string(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().nullable(),
    allDay: z.boolean(),
    timezone: z.string().nullable(),
    location: z.string().nullable(),
    placeId: z.string().nullable(),
    virtualUrl: z.string().nullable(),
    status: z.enum(["tentative", "confirmed", "cancelled"]),
    visibility: z.enum(["private", "public"]),
    notes: z.string().nullable(),
    importance: z.number(),
    tags: TagsSchema,
    metadata: MetadataSchema,
  })
  .openapi("Event");

// ─────────────────────────────────────────────────────────────
// Event List Query Schema
// ─────────────────────────────────────────────────────────────

export const EventListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().optional(),
    type: z.string().optional().openapi({
      description: "Filter by event type",
      example: "meeting",
    }),
    status: z.enum(["tentative", "confirmed", "cancelled"]).optional().openapi({
      description: "Filter by status",
    }),
    startsAfter: z.string().datetime().optional().openapi({
      description: "Filter events starting after this time",
      example: "2024-01-01T00:00:00Z",
    }),
    startsBefore: z.string().datetime().optional().openapi({
      description: "Filter events starting before this time",
      example: "2024-12-31T23:59:59Z",
    }),
    search: z.string().optional().openapi({
      description: "Text search across title and description",
    }),
    includeDeleted: z
      .string()
      .optional()
      .transform((val) => val === "true"),
  })
  .openapi("EventListQuery");

// ─────────────────────────────────────────────────────────────
// Paginated Response
// ─────────────────────────────────────────────────────────────

export const PaginatedEventsSchema = createPaginatedSchema(EventSchema, "Events");

