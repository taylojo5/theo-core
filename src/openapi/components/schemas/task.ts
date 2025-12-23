// ═══════════════════════════════════════════════════════════════════════════
// Task OpenAPI Schemas
// Schema definitions for tasks/todos
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
// Task Create Schema
// ─────────────────────────────────────────────────────────────

export const TaskCreateSchema = z
  .object({
    title: z.string().min(1).max(500).openapi({
      description: "Task title",
      example: "Review PR #123",
    }),
    description: z.string().optional().nullable().openapi({
      description: "Detailed description",
      example: "Review the authentication changes in PR #123",
    }),
    parentId: z.string().optional().nullable().openapi({
      description: "Parent task ID for subtasks",
    }),
    status: z
      .enum(["pending", "in_progress", "completed", "cancelled", "deferred"])
      .default("pending")
      .openapi({
        description: "Task status",
      }),
    priority: z.enum(["low", "medium", "high", "urgent"]).default("medium").openapi({
      description: "Task priority",
    }),
    dueDate: z.string().datetime().optional().nullable().openapi({
      description: "Due date (ISO 8601)",
      example: "2024-01-20T17:00:00Z",
    }),
    startDate: z.string().datetime().optional().nullable().openapi({
      description: "Start date (ISO 8601)",
    }),
    estimatedMinutes: z.coerce.number().int().positive().optional().nullable().openapi({
      description: "Estimated time in minutes",
      example: 60,
    }),
    notes: z.string().optional().nullable().openapi({
      description: "Private notes",
    }),
    assignedToId: z.string().optional().nullable().openapi({
      description: "Person ID this task is assigned to",
    }),
    source: z.enum(["manual", "gmail", "slack", "calendar"]).default("manual"),
    sourceId: z.string().max(255).optional().nullable(),
    tags: TagsSchema.default([]),
    metadata: MetadataSchema.default({}),
  })
  .openapi("TaskCreate");

// ─────────────────────────────────────────────────────────────
// Task Update Schema
// ─────────────────────────────────────────────────────────────

export const TaskUpdateSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().optional().nullable(),
    parentId: z.string().optional().nullable(),
    status: z.enum(["pending", "in_progress", "completed", "cancelled", "deferred"]).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    dueDate: z.string().datetime().optional().nullable(),
    startDate: z.string().datetime().optional().nullable(),
    estimatedMinutes: z.coerce.number().int().positive().optional().nullable(),
    notes: z.string().optional().nullable(),
    assignedToId: z.string().optional().nullable(),
    tags: TagsSchema.optional(),
    metadata: MetadataSchema.optional(),
    restore: z.boolean().optional().openapi({
      description: "If true, restores a soft-deleted task",
    }),
  })
  .openapi("TaskUpdate");

// ─────────────────────────────────────────────────────────────
// Task Response Schema
// ─────────────────────────────────────────────────────────────

export const TaskSchema = BaseEntitySchema.merge(SoftDeleteSchema)
  .merge(SourceTrackingSchema)
  .extend({
    userId: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    parentId: z.string().nullable(),
    status: z.enum(["pending", "in_progress", "completed", "cancelled", "deferred"]),
    priority: z.enum(["low", "medium", "high", "urgent"]),
    dueDate: z.string().datetime().nullable(),
    startDate: z.string().datetime().nullable(),
    estimatedMinutes: z.number().nullable(),
    completedAt: z.string().datetime().nullable(),
    notes: z.string().nullable(),
    assignedToId: z.string().nullable(),
    tags: TagsSchema,
    metadata: MetadataSchema,
  })
  .openapi("Task");

// ─────────────────────────────────────────────────────────────
// Task List Query Schema
// ─────────────────────────────────────────────────────────────

export const TaskListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().optional(),
    status: z
      .enum(["pending", "in_progress", "completed", "cancelled", "deferred"])
      .optional()
      .openapi({
        description: "Filter by status",
      }),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional().openapi({
      description: "Filter by priority",
    }),
    parentId: z.string().optional().openapi({
      description: "Filter by parent task (for subtasks)",
    }),
    dueBefore: z.string().datetime().optional().openapi({
      description: "Filter tasks due before this time",
    }),
    dueAfter: z.string().datetime().optional().openapi({
      description: "Filter tasks due after this time",
    }),
    search: z.string().optional().openapi({
      description: "Text search across title and description",
    }),
    includeDeleted: z
      .string()
      .optional()
      .transform((val) => val === "true"),
  })
  .openapi("TaskListQuery");

// ─────────────────────────────────────────────────────────────
// Paginated Response
// ─────────────────────────────────────────────────────────────

export const PaginatedTasksSchema = createPaginatedSchema(TaskSchema, "Tasks");

