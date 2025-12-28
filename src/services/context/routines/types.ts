// ═══════════════════════════════════════════════════════════════════════════
// Routines Service Types
// Routine-specific types, DTOs, and interfaces
// ═══════════════════════════════════════════════════════════════════════════

import type { Routine } from "@prisma/client";
import type {
  CreateRoutineInput,
  UpdateRoutineInput,
  ListRoutinesOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
  RoutineStatus,
  RoutineType,
  RoutineFrequency,
} from "../types";

// ─────────────────────────────────────────────────────────────
// Search Options
// ─────────────────────────────────────────────────────────────

/** Options for routine search */
export interface SearchRoutinesOptions {
  /** Maximum results to return (default: 20) */
  limit?: number;
  /** Include soft-deleted routines */
  includeDeleted?: boolean;
  /** Filter by active status */
  isActive?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Source Routine Input
// ─────────────────────────────────────────────────────────────

/** Input for upserting routines from external sources */
export interface SourceRoutineInput {
  /** Unique ID from the source system */
  sourceId: string;
  /** Routine data */
  data: Omit<CreateRoutineInput, "source" | "sourceId">;
}

// ─────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────

export interface IRoutinesService {
  // CRUD
  create(
    userId: string,
    data: CreateRoutineInput,
    context?: ServiceContext
  ): Promise<Routine>;

  getById(userId: string, id: string): Promise<Routine | null>;

  update(
    userId: string,
    id: string,
    data: UpdateRoutineInput,
    context?: ServiceContext
  ): Promise<Routine>;

  delete(userId: string, id: string, context?: ServiceContext): Promise<void>;

  restore(userId: string, id: string, context?: ServiceContext): Promise<Routine>;

  // Status transitions
  pause(userId: string, id: string, context?: ServiceContext): Promise<Routine>;

  resume(userId: string, id: string, context?: ServiceContext): Promise<Routine>;

  archive(userId: string, id: string, context?: ServiceContext): Promise<Routine>;

  // Completion tracking
  recordCompletion(
    userId: string,
    id: string,
    rating?: number,
    context?: ServiceContext
  ): Promise<Routine>;

  recordSkip(userId: string, id: string, context?: ServiceContext): Promise<Routine>;

  // Query
  list(
    userId: string,
    options?: ListRoutinesOptions
  ): Promise<PaginatedResult<Routine>>;

  findBySource(
    userId: string,
    source: Source,
    sourceId: string
  ): Promise<Routine | null>;

  search(
    userId: string,
    query: string,
    options?: SearchRoutinesOptions
  ): Promise<Routine[]>;

  // Schedule queries
  getDueNow(userId: string, limit?: number): Promise<Routine[]>;

  getUpcoming(userId: string, hours?: number, limit?: number): Promise<Routine[]>;

  getByCategory(userId: string, category: string): Promise<Routine[]>;

  // Bulk
  upsertFromSource(
    userId: string,
    source: Source,
    routines: SourceRoutineInput[],
    context?: ServiceContext
  ): Promise<UpsertResult<Routine>>;
}

// ─────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────

/** Error codes specific to routines service */
export type RoutinesErrorCode =
  | "ROUTINE_NOT_FOUND"
  | "ROUTINE_ALREADY_EXISTS"
  | "DUPLICATE_SOURCE_ID"
  | "INVALID_STATUS_TRANSITION"
  | "INVALID_SCHEDULE";

/** Custom error for routines service operations */
export class RoutinesServiceError extends Error {
  constructor(
    public readonly code: RoutinesErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "RoutinesServiceError";
  }
}

// Re-export types from base for convenience
export type {
  Routine,
  CreateRoutineInput,
  UpdateRoutineInput,
  ListRoutinesOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
  RoutineStatus,
  RoutineType,
  RoutineFrequency,
};

