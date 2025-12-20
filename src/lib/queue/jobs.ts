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
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

// ─────────────────────────────────────────────────────────────
// Embedding Jobs
// ─────────────────────────────────────────────────────────────

export interface EmbeddingJobData {
  userId: string;
  entityType: EntityType;
  entityId: string;
  operation: "create" | "update" | "delete";
}

export interface BulkEmbedJobData {
  userId: string;
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
