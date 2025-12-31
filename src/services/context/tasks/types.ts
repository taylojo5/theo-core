// ═══════════════════════════════════════════════════════════════════════════
// Tasks Service Types
// Task-specific types, DTOs, and interfaces
// ═══════════════════════════════════════════════════════════════════════════

import type { Task, Person } from "@prisma/client";
import type {
  CreateTaskInput,
  UpdateTaskInput,
  ListTasksOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
  TaskStatus,
  TaskPriority,
} from "../types";

// ─────────────────────────────────────────────────────────────
// Search Options
// ─────────────────────────────────────────────────────────────

/** Options for task search */
export interface SearchTasksOptions {
  /** Maximum results to return (default: 20) */
  limit?: number;
  /** Include soft-deleted tasks */
  includeDeleted?: boolean;
  /** Include subtasks in search */
  includeSubtasks?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Source Task Input
// ─────────────────────────────────────────────────────────────

/** Input for upserting tasks from external sources */
export interface SourceTaskInput {
  /** Unique ID from the source system */
  sourceId: string;
  /** Task data */
  data: Omit<CreateTaskInput, "source" | "sourceId">;
}

// ─────────────────────────────────────────────────────────────
// Task with Relations
// ─────────────────────────────────────────────────────────────

/** Task with optional relations */
export interface TaskWithRelations extends Task {
  parent?: Task | null;
  subtasks?: Task[];
  assignedTo?: Person | null;
}

// ─────────────────────────────────────────────────────────────
// Due Date Query Options
// ─────────────────────────────────────────────────────────────

/** Options for due date queries */
export interface TaskDueDateOptions {
  /** Include overdue tasks (due date in past) */
  overdue?: boolean;
  /** Include tasks due within N days */
  dueSoonDays?: number;
  /** Include tasks with no due date */
  includeNoDueDate?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────

export interface ITasksService {
  // CRUD
  create(
    userId: string,
    data: CreateTaskInput,
    context?: ServiceContext
  ): Promise<Task>;

  getById(userId: string, id: string): Promise<Task | null>;

  getByIdWithRelations(
    userId: string,
    id: string
  ): Promise<TaskWithRelations | null>;

  update(
    userId: string,
    id: string,
    data: UpdateTaskInput,
    context?: ServiceContext
  ): Promise<Task>;

  delete(userId: string, id: string, context?: ServiceContext): Promise<void>;

  restore(userId: string, id: string, context?: ServiceContext): Promise<Task>;

  // Status transitions
  updateStatus(
    userId: string,
    id: string,
    status: TaskStatus,
    context?: ServiceContext
  ): Promise<Task>;

  complete(userId: string, id: string, context?: ServiceContext): Promise<Task>;

  start(userId: string, id: string, context?: ServiceContext): Promise<Task>;

  defer(userId: string, id: string, context?: ServiceContext): Promise<Task>;

  cancel(userId: string, id: string, context?: ServiceContext): Promise<Task>;

  reopen(userId: string, id: string, context?: ServiceContext): Promise<Task>;

  // Hierarchy
  getSubtasks(userId: string, parentId: string): Promise<Task[]>;

  setParent(
    userId: string,
    id: string,
    parentId: string | null,
    context?: ServiceContext
  ): Promise<Task>;

  reorder(
    userId: string,
    id: string,
    position: number,
    context?: ServiceContext
  ): Promise<Task>;

  // Query
  list(
    userId: string,
    options?: ListTasksOptions
  ): Promise<PaginatedResult<Task>>;

  findBySource(
    userId: string,
    source: Source,
    sourceId: string
  ): Promise<Task | null>;

  search(
    userId: string,
    query: string,
    options?: SearchTasksOptions
  ): Promise<Task[]>;

  // Due date queries
  getOverdue(userId: string, limit?: number): Promise<Task[]>;

  getDueSoon(userId: string, days?: number, limit?: number): Promise<Task[]>;

  getDueOnDate(userId: string, date: Date): Promise<Task[]>;

  // Assignment queries
  getAssignedTo(userId: string, personId: string): Promise<Task[]>;

  // Bulk
  upsertFromSource(
    userId: string,
    source: Source,
    tasks: SourceTaskInput[],
    context?: ServiceContext
  ): Promise<UpsertResult<Task>>;
}

// ─────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────

/** Error codes specific to tasks service */
export type TasksErrorCode =
  | "TASK_NOT_FOUND"
  | "TASK_ALREADY_EXISTS"
  | "DUPLICATE_SOURCE_ID"
  | "INVALID_STATUS_TRANSITION"
  | "INVALID_HIERARCHY"
  | "PERSON_NOT_FOUND"
  | "CIRCULAR_REFERENCE";

/** Custom error for tasks service operations */
export class TasksServiceError extends Error {
  constructor(
    public readonly code: TasksErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "TasksServiceError";
  }
}

// Re-export types from base for convenience
export type {
  Task,
  Person,
  CreateTaskInput,
  UpdateTaskInput,
  ListTasksOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
  TaskStatus,
  TaskPriority,
};
