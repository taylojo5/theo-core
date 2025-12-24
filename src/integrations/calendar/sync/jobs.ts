// ═══════════════════════════════════════════════════════════════════════════
// Calendar Sync Job Types
// Type definitions for calendar sync background jobs
// ═══════════════════════════════════════════════════════════════════════════

import type {
  FullCalendarSyncOptions,
  IncrementalCalendarSyncOptions,
  FullSyncProgress,
  IncrementalSyncProgress,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Job Names
// ─────────────────────────────────────────────────────────────

export const CALENDAR_JOB_NAMES = {
  /** Full calendar sync job */
  FULL_SYNC: "calendar-full-sync",
  /** Incremental sync using sync token */
  INCREMENTAL_SYNC: "calendar-incremental-sync",
  /** Process webhook notification */
  PROCESS_WEBHOOK: "calendar-process-webhook",
  /** Expire overdue calendar approvals */
  EXPIRE_APPROVALS: "calendar-expire-approvals",
  /** Renew calendar webhook before expiration */
  RENEW_WEBHOOK: "calendar-renew-webhook",
  /** Bulk generate event embeddings */
  BULK_EVENT_EMBED: "calendar-bulk-event-embed",
} as const;

export type CalendarJobName =
  (typeof CALENDAR_JOB_NAMES)[keyof typeof CALENDAR_JOB_NAMES];

// ─────────────────────────────────────────────────────────────
// Full Sync Job
// ─────────────────────────────────────────────────────────────

/**
 * Data for a full calendar sync job
 * Used for initial import of all calendar events
 */
export interface FullSyncJobData {
  userId: string;
  /** Page token for resuming pagination within a calendar */
  pageToken?: string;
  /** Current calendar being synced (for resume) */
  currentCalendarId?: string;
  /** Options for full sync */
  options?: FullCalendarSyncOptions;
}

export { FullSyncProgress };

// ─────────────────────────────────────────────────────────────
// Incremental Sync Job
// ─────────────────────────────────────────────────────────────

/**
 * Data for an incremental calendar sync job
 * Uses Calendar API sync tokens for delta updates
 */
export interface IncrementalSyncJobData {
  userId: string;
  /** Sync token from previous sync (fetched from sync state if not provided) */
  syncToken?: string;
  /** Options for incremental sync */
  options?: IncrementalCalendarSyncOptions;
}

export { IncrementalSyncProgress };

// ─────────────────────────────────────────────────────────────
// Webhook Job
// ─────────────────────────────────────────────────────────────

/**
 * Data for processing a webhook notification
 */
export interface ProcessWebhookJobData {
  userId: string;
  /** Channel ID from the webhook */
  channelId: string;
  /** Resource ID from the webhook */
  resourceId: string;
  /** Resource state indicating change type */
  resourceState: "sync" | "exists" | "not_exists";
  /** Timestamp when the notification was received */
  receivedAt: Date;
}

/**
 * Data for renewing a webhook before expiration
 */
export interface RenewWebhookJobData {
  /** 
   * User ID to renew webhook for.
   * If undefined, the job processes ALL users with expiring webhooks (global scheduler mode).
   */
  userId?: string;
  /** Current channel ID to replace */
  oldChannelId?: string;
}

// ─────────────────────────────────────────────────────────────
// Approval Job
// ─────────────────────────────────────────────────────────────

/**
 * Data for expiring overdue calendar approvals
 * This is a global job (not user-specific)
 */
export interface ExpireApprovalsJobData {
  /** Optional: limit to specific user for testing */
  userId?: string;
}

// ─────────────────────────────────────────────────────────────
// Embedding Job
// ─────────────────────────────────────────────────────────────

/**
 * Data for bulk embedding generation
 */
export interface BulkEventEmbedJobData {
  userId: string;
  /** Array of internal event IDs to generate embeddings for */
  eventIds: string[];
}

// ─────────────────────────────────────────────────────────────
// Job Result Types
// ─────────────────────────────────────────────────────────────

/**
 * Result of a sync job
 */
export interface SyncJobResult {
  success: boolean;
  syncType: "full" | "incremental";
  eventsProcessed: number;
  eventsAdded: number;
  eventsUpdated: number;
  eventsDeleted: number;
  calendarsProcessed: number;
  syncToken?: string;
  durationMs: number;
  error?: string;
}

/**
 * Result of a webhook processing job
 */
export interface WebhookJobResult {
  success: boolean;
  triggedSync: boolean;
  eventsProcessed?: number;
  error?: string;
}

/**
 * Result of an embedding job
 */
export interface EmbeddingJobResult {
  success: boolean;
  processed: number;
  failed: number;
  errors?: string[];
}

