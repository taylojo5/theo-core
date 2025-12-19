// ═══════════════════════════════════════════════════════════════════════════
// Deadlines Service Types
// Deadline-specific types, DTOs, and interfaces
// ═══════════════════════════════════════════════════════════════════════════

import type { Deadline, Task, Event } from "@prisma/client";
import type {
  CreateDeadlineInput,
  UpdateDeadlineInput,
  ListDeadlinesOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
  DeadlineStatus,
  DeadlineType,
} from "../types";

// ─────────────────────────────────────────────────────────────
// Search Options
// ─────────────────────────────────────────────────────────────

/** Options for deadline search */
export interface SearchDeadlinesOptions {
  /** Maximum results to return (default: 20) */
  limit?: number;
  /** Include soft-deleted deadlines */
  includeDeleted?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Source Deadline Input
// ─────────────────────────────────────────────────────────────

/** Input for upserting deadlines from external sources */
export interface SourceDeadlineInput {
  /** Unique ID from the source system */
  sourceId: string;
  /** Deadline data */
  data: Omit<CreateDeadlineInput, "source" | "sourceId">;
}

// ─────────────────────────────────────────────────────────────
// Deadline with Relations
// ─────────────────────────────────────────────────────────────

/** Deadline with optional relations */
export interface DeadlineWithRelations extends Deadline {
  task?: Task | null;
  event?: Event | null;
}

// ─────────────────────────────────────────────────────────────
// Urgency Classification
// ─────────────────────────────────────────────────────────────

/** Urgency level for deadlines */
export type UrgencyLevel = "overdue" | "urgent" | "approaching" | "normal" | "distant";

/** Deadline with calculated urgency */
export interface DeadlineWithUrgency extends Deadline {
  urgency: UrgencyLevel;
  daysRemaining: number;
}

// ─────────────────────────────────────────────────────────────
// Urgency Query Options
// ─────────────────────────────────────────────────────────────

/** Options for urgency-based queries */
export interface DeadlineUrgencyOptions {
  /** Include overdue deadlines */
  includeOverdue?: boolean;
  /** Days threshold for "urgent" (default: 1) */
  urgentDays?: number;
  /** Days threshold for "approaching" (default: 7) */
  approachingDays?: number;
  /** Filter by minimum urgency level */
  minUrgency?: UrgencyLevel;
}

// ─────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────

export interface IDeadlinesService {
  // CRUD
  create(
    userId: string,
    data: CreateDeadlineInput,
    context?: ServiceContext
  ): Promise<Deadline>;

  getById(userId: string, id: string): Promise<Deadline | null>;

  getByIdWithRelations(userId: string, id: string): Promise<DeadlineWithRelations | null>;

  update(
    userId: string,
    id: string,
    data: UpdateDeadlineInput,
    context?: ServiceContext
  ): Promise<Deadline>;

  delete(userId: string, id: string, context?: ServiceContext): Promise<void>;

  restore(userId: string, id: string, context?: ServiceContext): Promise<Deadline>;

  // Status transitions
  updateStatus(
    userId: string,
    id: string,
    status: DeadlineStatus,
    context?: ServiceContext
  ): Promise<Deadline>;

  complete(userId: string, id: string, context?: ServiceContext): Promise<Deadline>;

  markMissed(userId: string, id: string, context?: ServiceContext): Promise<Deadline>;

  extend(
    userId: string,
    id: string,
    newDueAt: Date,
    context?: ServiceContext
  ): Promise<Deadline>;

  reopen(userId: string, id: string, context?: ServiceContext): Promise<Deadline>;

  // Query
  list(
    userId: string,
    options?: ListDeadlinesOptions
  ): Promise<PaginatedResult<Deadline>>;

  findBySource(
    userId: string,
    source: Source,
    sourceId: string
  ): Promise<Deadline | null>;

  search(
    userId: string,
    query: string,
    options?: SearchDeadlinesOptions
  ): Promise<Deadline[]>;

  // Urgency queries
  getOverdue(userId: string, limit?: number): Promise<Deadline[]>;

  getApproaching(userId: string, days?: number, limit?: number): Promise<Deadline[]>;

  getByUrgency(
    userId: string,
    options?: DeadlineUrgencyOptions
  ): Promise<DeadlineWithUrgency[]>;

  calculateUrgency(deadline: Deadline): DeadlineWithUrgency;

  // Relation queries
  getByTask(userId: string, taskId: string): Promise<Deadline[]>;

  getByEvent(userId: string, eventId: string): Promise<Deadline[]>;

  // Bulk
  upsertFromSource(
    userId: string,
    source: Source,
    deadlines: SourceDeadlineInput[],
    context?: ServiceContext
  ): Promise<UpsertResult<Deadline>>;
}

// ─────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────

/** Error codes specific to deadlines service */
export type DeadlinesErrorCode =
  | "DEADLINE_NOT_FOUND"
  | "DEADLINE_ALREADY_EXISTS"
  | "DUPLICATE_SOURCE_ID"
  | "INVALID_STATUS_TRANSITION"
  | "INVALID_DUE_DATE"
  | "TASK_NOT_FOUND"
  | "EVENT_NOT_FOUND";

/** Custom error for deadlines service operations */
export class DeadlinesServiceError extends Error {
  constructor(
    public readonly code: DeadlinesErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "DeadlinesServiceError";
  }
}

// Re-export types from base for convenience
export type {
  Deadline,
  Task,
  Event,
  CreateDeadlineInput,
  UpdateDeadlineInput,
  ListDeadlinesOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
  DeadlineStatus,
  DeadlineType,
};

