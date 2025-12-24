// ═══════════════════════════════════════════════════════════════════════════
// Job Types
// Type definitions for all background jobs
// ═══════════════════════════════════════════════════════════════════════════

import { type EntityType } from "@/services/context";
import { type ContactSyncOptions } from "@/integrations/gmail/sync/types";

// ─────────────────────────────────────────────────────────────
// Job Names
// ─────────────────────────────────────────────────────────────

export const JOB_NAMES = {
  // Embedding jobs
  GENERATE_EMBEDDING: "generate-embedding",
  DELETE_EMBEDDING: "delete-embedding",
  BULK_EMBED: "bulk-embed",

  // Email embedding jobs (Phase 3)
  GENERATE_EMAIL_EMBEDDING: "generate-email-embedding",
  BULK_EMAIL_EMBED: "bulk-email-embed",
  RETRY_FAILED_EMBEDDINGS: "retry-failed-embeddings",

  // Contact sync jobs (Phase 3)
  SYNC_CONTACTS: "sync-contacts",

  // Email sync jobs (Phase 3)
  SYNC_GMAIL: "sync-gmail",
  SYNC_GMAIL_INCREMENTAL: "sync-gmail-incremental",
  PROCESS_EMAIL: "process-email",

  // Slack sync jobs (Phase 4)
  SYNC_SLACK: "sync-slack",
  PROCESS_MESSAGE: "process-message",

  // Notification jobs
  SEND_NOTIFICATION: "send-notification",
  DEADLINE_REMINDER: "deadline-reminder",

  // Maintenance jobs
  CLEANUP_EMBEDDINGS: "cleanup-embeddings",
  REFRESH_TOKEN: "refresh-token",
  CHECK_HISTORY_EXPIRATION: "check-history-expiration",
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

// ─────────────────────────────────────────────────────────────
// Embedding Jobs
// Uses discriminated unions with 'type' field for explicit routing
// ─────────────────────────────────────────────────────────────

/** Embedding job types - used as discriminant for routing */
export const EMBEDDING_JOB_TYPES = {
  /** Single entity embedding (person, place, event, task, deadline) */
  ENTITY: "entity",
  /** Bulk entity embedding */
  ENTITY_BULK: "entity-bulk",
  /** Single email embedding */
  EMAIL: "email",
  /** Bulk email embedding */
  EMAIL_BULK: "email-bulk",
  /** Single calendar event embedding */
  CALENDAR_EVENT: "calendar-event",
  /** Bulk calendar event embedding */
  CALENDAR_EVENT_BULK: "calendar-event-bulk",
} as const;

export type EmbeddingJobType =
  (typeof EMBEDDING_JOB_TYPES)[keyof typeof EMBEDDING_JOB_TYPES];

/** Base interface for all embedding jobs */
interface BaseEmbeddingJobData {
  type: EmbeddingJobType;
  userId: string;
}

/** Single entity embedding job */
export interface EntityEmbeddingJobData extends BaseEmbeddingJobData {
  type: typeof EMBEDDING_JOB_TYPES.ENTITY;
  entityType: EntityType;
  entityId: string;
  operation: "create" | "update" | "delete";
}

/** Bulk entity embedding job */
export interface BulkEntityEmbedJobData extends BaseEmbeddingJobData {
  type: typeof EMBEDDING_JOB_TYPES.ENTITY_BULK;
  entityType: EntityType;
  entityIds: string[];
}

// ─────────────────────────────────────────────────────────────
// Contact Sync Jobs (for Phase 3)
// ─────────────────────────────────────────────────────────────

export interface ContactSyncJobData {
  userId: string;
  options?: ContactSyncOptions;
}

// ─────────────────────────────────────────────────────────────
// Email Sync Jobs (for Phase 3)
// ─────────────────────────────────────────────────────────────

export interface EmailSyncJobData {
  userId: string;
  accountId: string;
  syncType: "full" | "incremental";
  cursor?: string;
}

export interface ProcessEmailJobData {
  userId: string;
  accountId: string;
  messageId: string;
  threadId: string;
}

// ─────────────────────────────────────────────────────────────
// Email Embedding Jobs (Phase 3)
// ─────────────────────────────────────────────────────────────

/** Single email embedding job */
export interface EmailEmbeddingJobData extends BaseEmbeddingJobData {
  type: typeof EMBEDDING_JOB_TYPES.EMAIL;
  emailId: string;
  operation: "create" | "update" | "delete";
}

/** Bulk email embedding job */
export interface BulkEmailEmbedJobData extends BaseEmbeddingJobData {
  type: typeof EMBEDDING_JOB_TYPES.EMAIL_BULK;
  emailIds: string[];
}

export interface RetryFailedEmbeddingsJobData {
  userId: string;
  maxRetries?: number;
  batchSize?: number;
}

// ─────────────────────────────────────────────────────────────
// Calendar Event Embedding Jobs
// ─────────────────────────────────────────────────────────────

/** Single calendar event embedding job */
export interface CalendarEventEmbeddingJobData extends BaseEmbeddingJobData {
  type: typeof EMBEDDING_JOB_TYPES.CALENDAR_EVENT;
  eventId: string;
  operation: "create" | "update" | "delete";
}

/** Bulk calendar event embedding job */
export interface BulkCalendarEventEmbedJobData extends BaseEmbeddingJobData {
  type: typeof EMBEDDING_JOB_TYPES.CALENDAR_EVENT_BULK;
  eventIds: string[];
}

// ─────────────────────────────────────────────────────────────
// Union Type for All Embedding Jobs
// ─────────────────────────────────────────────────────────────

/** All embedding job data (discriminated union) */
export type AnyEmbeddingJobData =
  | EntityEmbeddingJobData
  | BulkEntityEmbedJobData
  | EmailEmbeddingJobData
  | BulkEmailEmbedJobData
  | CalendarEventEmbeddingJobData
  | BulkCalendarEventEmbedJobData;

// ─────────────────────────────────────────────────────────────
// Notification Jobs
// ─────────────────────────────────────────────────────────────

export interface NotificationJobData {
  userId: string;
  type: "deadline" | "reminder" | "sync-complete" | "error";
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface DeadlineReminderJobData {
  userId: string;
  deadlineId: string;
  reminderMinutesBefore: number;
}

// ─────────────────────────────────────────────────────────────
// Maintenance Jobs
// ─────────────────────────────────────────────────────────────

export interface CleanupEmbeddingsJobData {
  userId: string;
  olderThanDays?: number;
}

export interface RefreshTokenJobData {
  userId: string;
  accountId: string;
  provider: "google" | "slack";
}

export interface CheckHistoryExpirationJobData {
  userId?: string; // If not provided, check all users
}
