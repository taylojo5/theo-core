import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════
// Validation Schemas
// Zod schemas for request validation across API routes
// ═══════════════════════════════════════════════════════════════════════════

// Helper to transform null to undefined for service compatibility
const nullToUndefined = <T>(val: T | null | undefined): T | undefined =>
  val === null ? undefined : val;

// Optional string that converts null to undefined
const optionalString = z
  .string()
  .optional()
  .nullable()
  .transform(nullToUndefined);

const optionalNumber = z
  .number()
  .optional()
  .nullable()
  .transform(nullToUndefined);

// ─────────────────────────────────────────────────────────────
// Common Schemas
// ─────────────────────────────────────────────────────────────

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.string().min(1, "ID is required"),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1, "Search query is required").max(500),
  types: z.string().optional(), // comma-separated entity types
  limit: z.coerce.number().int().min(1).max(50).default(10),
  useSemanticSearch: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

// ─────────────────────────────────────────────────────────────
// Entity Schemas
// ─────────────────────────────────────────────────────────────

export const sourceSchema = z.enum(["manual", "gmail", "slack", "calendar"]);

// Person
export const createPersonSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(255),
    email: z.string().email("Invalid email").optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    type: z.string().max(50).default("contact"),
    importance: z.coerce.number().int().min(1).max(10).default(5),
    company: z.string().max(255).optional().nullable(),
    title: z.string().max(255).optional().nullable(),
    location: z.string().max(255).optional().nullable(),
    timezone: z.string().max(50).optional().nullable(),
    bio: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    source: sourceSchema.default("manual"),
    sourceId: z.string().max(255).optional().nullable(),
    tags: z.array(z.string().max(50)).default([]),
    metadata: z.record(z.unknown()).default({}),
  })
  .transform((data) => ({
    ...data,
    email: nullToUndefined(data.email),
    phone: nullToUndefined(data.phone),
    company: nullToUndefined(data.company),
    title: nullToUndefined(data.title),
    location: nullToUndefined(data.location),
    timezone: nullToUndefined(data.timezone),
    bio: nullToUndefined(data.bio),
    notes: nullToUndefined(data.notes),
    sourceId: nullToUndefined(data.sourceId),
  }));

export const updatePersonSchema = z
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
    tags: z.array(z.string().max(50)).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .transform((data) => ({
    ...data,
    email: nullToUndefined(data.email),
    phone: nullToUndefined(data.phone),
    company: nullToUndefined(data.company),
    title: nullToUndefined(data.title),
    location: nullToUndefined(data.location),
    timezone: nullToUndefined(data.timezone),
    bio: nullToUndefined(data.bio),
    notes: nullToUndefined(data.notes),
  }));

export const listPeopleQuerySchema = paginationSchema.extend({
  type: z.string().optional(),
  source: sourceSchema.optional(),
  search: z.string().optional(),
  tags: z.string().optional(), // comma-separated
  includeDeleted: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

// Place
export const createPlaceSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(255),
    type: z.string().max(50).default("location"),
    address: optionalString,
    city: z.string().max(100).optional().nullable(),
    state: z.string().max(100).optional().nullable(),
    country: z.string().max(100).optional().nullable(),
    postalCode: z.string().max(20).optional().nullable(),
    latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
    timezone: z.string().max(50).optional().nullable(),
    notes: z.string().optional().nullable(),
    importance: z.coerce.number().int().min(1).max(10).default(5),
    source: sourceSchema.default("manual"),
    sourceId: z.string().max(255).optional().nullable(),
    tags: z.array(z.string().max(50)).default([]),
    metadata: z.record(z.unknown()).default({}),
  })
  .transform((data) => ({
    ...data,
    city: nullToUndefined(data.city),
    state: nullToUndefined(data.state),
    country: nullToUndefined(data.country),
    postalCode: nullToUndefined(data.postalCode),
    latitude: nullToUndefined(data.latitude),
    longitude: nullToUndefined(data.longitude),
    timezone: nullToUndefined(data.timezone),
    notes: nullToUndefined(data.notes),
    sourceId: nullToUndefined(data.sourceId),
  }));

export const updatePlaceSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    type: z.string().max(50).optional(),
    address: optionalString,
    city: z.string().max(100).optional().nullable(),
    state: z.string().max(100).optional().nullable(),
    country: z.string().max(100).optional().nullable(),
    postalCode: z.string().max(20).optional().nullable(),
    latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
    timezone: z.string().max(50).optional().nullable(),
    notes: z.string().optional().nullable(),
    importance: z.coerce.number().int().min(1).max(10).optional(),
    tags: z.array(z.string().max(50)).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .transform((data) => ({
    ...data,
    city: nullToUndefined(data.city),
    state: nullToUndefined(data.state),
    country: nullToUndefined(data.country),
    postalCode: nullToUndefined(data.postalCode),
    latitude: nullToUndefined(data.latitude),
    longitude: nullToUndefined(data.longitude),
    timezone: nullToUndefined(data.timezone),
    notes: nullToUndefined(data.notes),
  }));

export const listPlacesQuerySchema = paginationSchema.extend({
  type: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  search: z.string().optional(),
  includeDeleted: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

// Event
export const createEventSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(500),
    description: z.string().optional().nullable(),
    type: z.string().max(50).default("meeting"),
    startsAt: z.string().datetime("Invalid start date"),
    endsAt: z.string().datetime("Invalid end date").optional().nullable(),
    allDay: z.boolean().default(false),
    timezone: z.string().max(50).optional().nullable(),
    location: z.string().optional().nullable(),
    placeId: z.string().optional().nullable(),
    virtualUrl: z
      .string()
      .url("Invalid URL")
      .optional()
      .nullable()
      .or(z.literal("")),
    status: z
      .enum(["tentative", "confirmed", "cancelled"])
      .default("confirmed"),
    visibility: z.enum(["private", "public"]).default("private"),
    notes: z.string().optional().nullable(),
    importance: z.coerce.number().int().min(1).max(10).default(5),
    source: sourceSchema.default("manual"),
    sourceId: z.string().max(255).optional().nullable(),
    tags: z.array(z.string().max(50)).default([]),
    metadata: z.record(z.unknown()).default({}),
  })
  .transform((data) => ({
    ...data,
    description: nullToUndefined(data.description),
    endsAt: nullToUndefined(data.endsAt),
    timezone: nullToUndefined(data.timezone),
    location: nullToUndefined(data.location),
    placeId: nullToUndefined(data.placeId),
    virtualUrl:
      data.virtualUrl === "" ? undefined : nullToUndefined(data.virtualUrl),
    notes: nullToUndefined(data.notes),
    sourceId: nullToUndefined(data.sourceId),
  }));

export const updateEventSchema = z
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
    tags: z.array(z.string().max(50)).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .transform((data) => ({
    ...data,
    description: nullToUndefined(data.description),
    endsAt: nullToUndefined(data.endsAt),
    timezone: nullToUndefined(data.timezone),
    location: nullToUndefined(data.location),
    placeId: nullToUndefined(data.placeId),
    virtualUrl:
      data.virtualUrl === "" ? undefined : nullToUndefined(data.virtualUrl),
    notes: nullToUndefined(data.notes),
  }));

export const listEventsQuerySchema = paginationSchema.extend({
  type: z.string().optional(),
  status: z.enum(["tentative", "confirmed", "cancelled"]).optional(),
  startsAfter: z.string().datetime().optional(),
  startsBefore: z.string().datetime().optional(),
  search: z.string().optional(),
  includeDeleted: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

// Task
export const createTaskSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(500),
    description: z.string().optional().nullable(),
    parentId: z.string().optional().nullable(),
    status: z
      .enum(["pending", "in_progress", "completed", "cancelled", "deferred"])
      .default("pending"),
    priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
    dueDate: z.string().datetime().optional().nullable(),
    startDate: z.string().datetime().optional().nullable(),
    estimatedMinutes: z.coerce.number().int().positive().optional().nullable(),
    notes: z.string().optional().nullable(),
    assignedToId: z.string().optional().nullable(),
    source: sourceSchema.default("manual"),
    sourceId: z.string().max(255).optional().nullable(),
    tags: z.array(z.string().max(50)).default([]),
    metadata: z.record(z.unknown()).default({}),
  })
  .transform((data) => ({
    ...data,
    description: nullToUndefined(data.description),
    parentId: nullToUndefined(data.parentId),
    dueDate: nullToUndefined(data.dueDate),
    startDate: nullToUndefined(data.startDate),
    estimatedMinutes: nullToUndefined(data.estimatedMinutes),
    notes: nullToUndefined(data.notes),
    assignedToId: nullToUndefined(data.assignedToId),
    sourceId: nullToUndefined(data.sourceId),
  }));

export const updateTaskSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().optional().nullable(),
    parentId: z.string().optional().nullable(),
    status: z
      .enum(["pending", "in_progress", "completed", "cancelled", "deferred"])
      .optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    dueDate: z.string().datetime().optional().nullable(),
    startDate: z.string().datetime().optional().nullable(),
    estimatedMinutes: z.coerce.number().int().positive().optional().nullable(),
    notes: z.string().optional().nullable(),
    assignedToId: z.string().optional().nullable(),
    tags: z.array(z.string().max(50)).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .transform((data) => ({
    ...data,
    description: nullToUndefined(data.description),
    parentId: nullToUndefined(data.parentId),
    dueDate: nullToUndefined(data.dueDate),
    startDate: nullToUndefined(data.startDate),
    estimatedMinutes: nullToUndefined(data.estimatedMinutes),
    notes: nullToUndefined(data.notes),
    assignedToId: nullToUndefined(data.assignedToId),
  }));

export const listTasksQuerySchema = paginationSchema.extend({
  status: z
    .enum(["pending", "in_progress", "completed", "cancelled", "deferred"])
    .optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  parentId: z.string().optional(),
  dueBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
  search: z.string().optional(),
  includeDeleted: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

// Deadline
export const createDeadlineSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(500),
    description: z.string().optional().nullable(),
    type: z.enum(["deadline", "milestone", "reminder"]).default("deadline"),
    dueAt: z.string().datetime("Invalid due date"),
    reminderAt: z.string().datetime().optional().nullable(),
    status: z
      .enum(["pending", "completed", "missed", "extended"])
      .default("pending"),
    importance: z.coerce.number().int().min(1).max(10).default(5),
    taskId: z.string().optional().nullable(),
    eventId: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    consequences: z.string().optional().nullable(),
    source: sourceSchema.default("manual"),
    sourceId: z.string().max(255).optional().nullable(),
    tags: z.array(z.string().max(50)).default([]),
    metadata: z.record(z.unknown()).default({}),
  })
  .transform((data) => ({
    ...data,
    description: nullToUndefined(data.description),
    reminderAt: nullToUndefined(data.reminderAt),
    taskId: nullToUndefined(data.taskId),
    eventId: nullToUndefined(data.eventId),
    notes: nullToUndefined(data.notes),
    consequences: nullToUndefined(data.consequences),
    sourceId: nullToUndefined(data.sourceId),
  }));

export const updateDeadlineSchema = z
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
    tags: z.array(z.string().max(50)).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .transform((data) => ({
    ...data,
    description: nullToUndefined(data.description),
    reminderAt: nullToUndefined(data.reminderAt),
    taskId: nullToUndefined(data.taskId),
    eventId: nullToUndefined(data.eventId),
    notes: nullToUndefined(data.notes),
    consequences: nullToUndefined(data.consequences),
  }));

export const listDeadlinesQuerySchema = paginationSchema.extend({
  status: z.enum(["pending", "completed", "missed", "extended"]).optional(),
  type: z.enum(["deadline", "milestone", "reminder"]).optional(),
  dueBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
  search: z.string().optional(),
  includeDeleted: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

// Relationship
export const createRelationshipSchema = z
  .object({
    sourceType: z.enum(["person", "place", "event", "task", "deadline"]),
    sourceId: z.string().min(1, "Source ID is required"),
    targetType: z.enum(["person", "place", "event", "task", "deadline"]),
    targetId: z.string().min(1, "Target ID is required"),
    relationship: z.string().min(1, "Relationship type is required").max(100),
    strength: z.coerce.number().int().min(1).max(10).default(5),
    bidirectional: z.boolean().default(false),
    notes: z.string().optional().nullable(),
    metadata: z.record(z.unknown()).default({}),
  })
  .transform((data) => ({
    ...data,
    notes: nullToUndefined(data.notes),
  }));

export const updateRelationshipSchema = z
  .object({
    relationship: z.string().min(1).max(100).optional(),
    strength: z.coerce.number().int().min(1).max(10).optional(),
    bidirectional: z.boolean().optional(),
    notes: z.string().optional().nullable(),
    metadata: z.record(z.unknown()).optional(),
  })
  .transform((data) => ({
    ...data,
    notes: nullToUndefined(data.notes),
  }));

export const listRelationshipsQuerySchema = paginationSchema.extend({
  entityType: z
    .enum(["person", "place", "event", "task", "deadline"])
    .optional(),
  entityId: z.string().optional(),
  relationship: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────
// Chat Schemas
// ─────────────────────────────────────────────────────────────

export const createConversationSchema = z.object({
  title: z.string().max(255).optional(),
});

export const updateConversationSchema = z.object({
  title: z.string().max(255).optional(),
  summary: z.string().optional(),
});

export const listConversationsQuerySchema = paginationSchema;

export const createMessageSchema = z.object({
  content: z.string().min(1, "Message content is required"),
  role: z.enum(["user", "assistant", "system", "tool"]).default("user"),
  toolCalls: z.array(z.unknown()).optional(),
  toolCallId: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const listMessagesQuerySchema = paginationSchema.extend({
  direction: z.enum(["asc", "desc"]).default("asc"),
});

// ─────────────────────────────────────────────────────────────
// Email Search Schemas (Phase 3)
// ─────────────────────────────────────────────────────────────

export const emailSearchQuerySchema = z.object({
  q: z.string().min(1, "Search query is required").max(500),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  useSemanticSearch: z
    .string()
    .optional()
    .transform((val) => val === "true"),
  minSimilarity: z.coerce.number().min(0).max(1).optional(),
  semanticWeight: z.coerce.number().min(0).max(1).optional(),
  labelIds: z.string().optional(), // comma-separated
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  fromEmail: z.string().optional(),
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
});

export const findSimilarEmailsSchema = z.object({
  emailId: z.string().min(1, "Email ID is required"),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  minSimilarity: z.coerce.number().min(0).max(1).optional(),
});
