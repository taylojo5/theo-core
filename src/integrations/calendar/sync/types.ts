// ═══════════════════════════════════════════════════════════════════════════
// Calendar Sync Types
// Type definitions for Calendar sync operations
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Sync Type Enum
// ─────────────────────────────────────────────────────────────

/**
 * Type of calendar sync operation
 */
export type CalendarSyncType = "full" | "incremental";

// ─────────────────────────────────────────────────────────────
// Sync Result Types
// ─────────────────────────────────────────────────────────────

/**
 * Result of a calendar sync operation
 */
export interface CalendarSyncResult {
  /** Type of sync performed */
  syncType: CalendarSyncType;
  /** Number of calendars synced */
  calendarsProcessed: number;
  /** Number of new events imported */
  eventsAdded: number;
  /** Number of events updated */
  eventsUpdated: number;
  /** Number of events deleted/cancelled */
  eventsDeleted: number;
  /** Number of events unchanged */
  eventsUnchanged: number;
  /** Total events processed */
  eventsTotal: number;
  /** New sync token for incremental sync */
  syncToken?: string;
  /** Whether there are more events to sync */
  hasMore: boolean;
  /** Next page token for pagination */
  nextPageToken?: string;
  /** Sync duration in milliseconds */
  durationMs: number;
  /** Any errors encountered */
  errors: SyncOperationError[];
}

/**
 * Error encountered during calendar sync operations
 * Note: Named SyncOperationError to avoid conflict with CalendarSyncError class in errors.ts
 */
export interface SyncOperationError {
  /** Google Event ID or Calendar ID that failed */
  resourceId: string;
  /** Type of resource */
  resourceType: "calendar" | "event";
  /** Error message */
  message: string;
  /** Error code */
  code?: string;
  /** Whether the error is retryable */
  retryable: boolean;
}

// ─────────────────────────────────────────────────────────────
// Full Sync Types
// ─────────────────────────────────────────────────────────────

/**
 * Options for full calendar sync
 */
export interface FullCalendarSyncOptions {
  /** Maximum number of events to sync per calendar (default: unlimited) */
  maxEventsPerCalendar?: number;
  /** Only sync specific calendar IDs */
  calendarIds?: string[];
  /** Calendars to exclude from sync */
  excludeCalendarIds?: string[];
  /** Time range start: only sync events after this date (default: 30 days ago) */
  timeMin?: Date;
  /** Time range end: only sync events before this date (default: 1 year ahead) */
  timeMax?: Date;
  /** Whether to expand recurring events into instances (default: true) */
  singleEvents?: boolean;
  /** Page size for API requests (default: 250) */
  pageSize?: number;
  /** Whether to resume from a saved checkpoint (default: false) */
  resumeFromCheckpoint?: boolean;
}

/**
 * Checkpoint for resumable full sync
 */
export interface FullSyncCheckpoint {
  /** Calendar ID currently being synced */
  currentCalendarId?: string;
  /** Page token to resume from within current calendar */
  pageToken?: string;
  /** Number of events processed so far */
  eventsProcessed: number;
  /** Number of calendars completed */
  calendarsCompleted: number;
  /** Total calendars to process */
  calendarsTotal: number;
  /** When the sync was started */
  startedAt: Date;
}

/**
 * Progress data for full sync
 */
export interface FullSyncProgress {
  phase: "calendars" | "events" | "complete";
  currentCalendar?: string;
  calendarsProcessed: number;
  calendarsTotal: number;
  eventsProcessed: number;
  eventsTotal?: number;
  currentPage?: number;
}

// ─────────────────────────────────────────────────────────────
// Incremental Sync Types
// ─────────────────────────────────────────────────────────────

/**
 * Options for incremental calendar sync
 */
export interface IncrementalCalendarSyncOptions {
  /** Sync token from previous sync (fetched from sync state if not provided) */
  syncToken?: string;
  /** Only sync specific calendar IDs */
  calendarIds?: string[];
  /** Maximum events to process (default: 500) */
  maxEvents?: number;
}

/**
 * Progress data for incremental sync
 */
export interface IncrementalSyncProgress {
  phase: "fetching" | "processing" | "complete";
  eventsProcessed: number;
  eventsTotal?: number;
  eventsAdded: number;
  eventsUpdated: number;
  eventsDeleted: number;
}

/**
 * An event change from incremental sync
 */
export interface EventChange {
  /** Type of change */
  type: "added" | "updated" | "deleted";
  /** Google Event ID */
  eventId: string;
  /** Google Calendar ID */
  calendarId: string;
  /** The event data (for added/updated) */
  event?: import("../types").GoogleEvent;
}

// ─────────────────────────────────────────────────────────────
// Sync Status Types
// ─────────────────────────────────────────────────────────────

/**
 * Current status of sync operations
 */
export type SyncStatus =
  | "idle"
  | "syncing"
  | "full_sync"
  | "incremental_sync"
  | "error"
  | "paused";

/**
 * Detailed sync state for a user
 */
export interface SyncState {
  /** Current sync status */
  status: SyncStatus;
  /** Sync token for incremental sync */
  syncToken?: string;
  /** Last successful sync timestamp */
  lastSyncAt?: Date;
  /** Last full sync timestamp */
  lastFullSyncAt?: Date;
  /** Error message if status is error */
  error?: string;
  /** Sync statistics */
  stats: {
    eventCount: number;
    calendarCount: number;
    embeddingsPending: number;
    embeddingsCompleted: number;
  };
}

// ─────────────────────────────────────────────────────────────
// Job Data Types
// ─────────────────────────────────────────────────────────────
// NOTE: Job data types are defined in ./jobs.ts to avoid duplication.
// Import from there for FullSyncJobData, IncrementalSyncJobData,
// ProcessWebhookJobData, ExpireApprovalsJobData, RenewWebhookJobData, etc.

