// ═══════════════════════════════════════════════════════════════════════════
// Events Service Types
// Event-specific types, DTOs, and interfaces
// ═══════════════════════════════════════════════════════════════════════════

import type { Event, Place } from "@prisma/client";
import type {
  CreateEventInput,
  UpdateEventInput,
  ListEventsOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
  EventStatus,
} from "../types";

// ─────────────────────────────────────────────────────────────
// Search Options
// ─────────────────────────────────────────────────────────────

/** Options for event search */
export interface SearchEventsOptions {
  /** Maximum results to return (default: 20) */
  limit?: number;
  /** Include soft-deleted events */
  includeDeleted?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Source Event Input
// ─────────────────────────────────────────────────────────────

/** Input for upserting events from external sources */
export interface SourceEventInput {
  /** Unique ID from the source system */
  sourceId: string;
  /** Event data */
  data: Omit<CreateEventInput, "source" | "sourceId">;
}

// ─────────────────────────────────────────────────────────────
// Event with Relations
// ─────────────────────────────────────────────────────────────

/** Event with optional place relation */
export interface EventWithPlace extends Event {
  place?: Place | null;
}

// ─────────────────────────────────────────────────────────────
// Time Range Query Options
// ─────────────────────────────────────────────────────────────

/** Common time range presets */
export type TimeRangePreset =
  | "today"
  | "tomorrow"
  | "this_week"
  | "next_week"
  | "this_month"
  | "next_month";

/** Options for time-based event queries */
export interface EventTimeRangeOptions {
  /** Preset time range */
  preset?: TimeRangePreset;
  /** Custom start date */
  startsAfter?: Date;
  /** Custom end date */
  startsBefore?: Date;
  /** Include events that have ended */
  includeEnded?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────

export interface IEventsService {
  // CRUD
  create(
    userId: string,
    data: CreateEventInput,
    context?: ServiceContext
  ): Promise<Event>;

  getById(userId: string, id: string): Promise<Event | null>;

  getByIdWithPlace(userId: string, id: string): Promise<EventWithPlace | null>;

  update(
    userId: string,
    id: string,
    data: UpdateEventInput,
    context?: ServiceContext
  ): Promise<Event>;

  delete(userId: string, id: string, context?: ServiceContext): Promise<void>;

  restore(userId: string, id: string, context?: ServiceContext): Promise<Event>;

  // Status transitions
  updateStatus(
    userId: string,
    id: string,
    status: EventStatus,
    context?: ServiceContext
  ): Promise<Event>;

  cancel(userId: string, id: string, context?: ServiceContext): Promise<Event>;

  confirm(userId: string, id: string, context?: ServiceContext): Promise<Event>;

  // Query
  list(
    userId: string,
    options?: ListEventsOptions
  ): Promise<PaginatedResult<Event>>;

  findBySource(
    userId: string,
    source: Source,
    sourceId: string
  ): Promise<Event | null>;

  search(
    userId: string,
    query: string,
    options?: SearchEventsOptions
  ): Promise<Event[]>;

  // Time-based queries
  getUpcoming(userId: string, limit?: number): Promise<Event[]>;

  getPast(userId: string, limit?: number): Promise<Event[]>;

  getByTimeRange(userId: string, options: EventTimeRangeOptions): Promise<Event[]>;

  getOnDate(userId: string, date: Date): Promise<Event[]>;

  // Place-based queries
  getByPlace(userId: string, placeId: string): Promise<Event[]>;

  // Bulk
  upsertFromSource(
    userId: string,
    source: Source,
    events: SourceEventInput[],
    context?: ServiceContext
  ): Promise<UpsertResult<Event>>;
}

// ─────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────

/** Error codes specific to events service */
export type EventsErrorCode =
  | "EVENT_NOT_FOUND"
  | "EVENT_ALREADY_EXISTS"
  | "DUPLICATE_SOURCE_ID"
  | "INVALID_DATE_RANGE"
  | "INVALID_STATUS_TRANSITION"
  | "PLACE_NOT_FOUND";

/** Custom error for events service operations */
export class EventsServiceError extends Error {
  constructor(
    public readonly code: EventsErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "EventsServiceError";
  }
}

// Re-export types from base for convenience
export type {
  Event,
  Place,
  CreateEventInput,
  UpdateEventInput,
  ListEventsOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
  EventStatus,
};

