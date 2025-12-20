// ═══════════════════════════════════════════════════════════════════════════
// Gmail Sync Types
// Type definitions for sync operations
// ═══════════════════════════════════════════════════════════════════════════

import type { Person } from "@prisma/client";

// ─────────────────────────────────────────────────────────────
// Contact Sync Types
// ─────────────────────────────────────────────────────────────

/**
 * Result of a contact sync operation
 */
export interface ContactSyncResult {
  /** Number of new people created */
  created: number;
  /** Number of existing people updated */
  updated: number;
  /** Number of contacts that were unchanged */
  unchanged: number;
  /** Number of contacts skipped (no email or invalid) */
  skipped: number;
  /** Total contacts processed */
  total: number;
  /** Any errors encountered during sync */
  errors: ContactSyncError[];
  /** Sync duration in milliseconds */
  durationMs: number;
  /** Created person entities */
  createdPeople?: Person[];
  /** Updated person entities */
  updatedPeople?: Person[];
}

/**
 * Error encountered during contact sync
 */
export interface ContactSyncError {
  /** Contact resource name that failed */
  resourceName: string;
  /** Contact name (if available) */
  contactName?: string;
  /** Error message */
  message: string;
  /** Error code */
  code?: string;
}

/**
 * Options for contact sync
 */
export interface ContactSyncOptions {
  /** Maximum number of contacts to sync (default: 1000) */
  maxContacts?: number;
  /** Only sync contacts with email addresses (default: true) */
  requireEmail?: boolean;
  /** Force update even if no changes detected (default: false) */
  forceUpdate?: boolean;
  /** Include contact photo URLs (default: true) */
  includePhotos?: boolean;
  /** Page size for API requests (default: 100) */
  pageSize?: number;
}

// ─────────────────────────────────────────────────────────────
// Email Sync Types (for future chunks)
// ─────────────────────────────────────────────────────────────

/**
 * Type of email sync operation
 */
export type EmailSyncType = "full" | "incremental";

/**
 * Result of an email sync operation
 */
export interface EmailSyncResult {
  /** Type of sync performed */
  syncType: EmailSyncType;
  /** Number of new emails imported */
  added: number;
  /** Number of emails updated */
  updated: number;
  /** Number of emails deleted */
  deleted: number;
  /** Number of emails unchanged */
  unchanged: number;
  /** Total emails processed */
  total: number;
  /** New history ID after sync */
  historyId: string;
  /** Whether there are more emails to sync */
  hasMore: boolean;
  /** Next page token for pagination */
  nextPageToken?: string;
  /** Sync duration in milliseconds */
  durationMs: number;
  /** Any errors encountered */
  errors: EmailSyncError[];
}

/**
 * Error encountered during email sync
 */
export interface EmailSyncError {
  /** Gmail message ID that failed */
  messageId: string;
  /** Thread ID */
  threadId?: string;
  /** Error message */
  message: string;
  /** Error code */
  code?: string;
  /** Whether the error is retryable */
  retryable: boolean;
}

/**
 * Options for full email sync
 */
export interface FullSyncOptions {
  /** Maximum number of emails to sync (default: unlimited) */
  maxEmails?: number;
  /** Labels to sync (default: all) */
  labelIds?: string[];
  /** Only sync emails newer than this date */
  afterDate?: Date;
  /** Page size for API requests (default: 100) */
  pageSize?: number;
}

/**
 * Options for incremental email sync
 */
export interface IncrementalSyncOptions {
  /** Starting history ID */
  startHistoryId: string;
  /** Labels to watch (default: all) */
  labelIds?: string[];
  /** Maximum history entries to process (default: 500) */
  maxHistoryEntries?: number;
}

// ─────────────────────────────────────────────────────────────
// Sync Status Types
// ─────────────────────────────────────────────────────────────

/**
 * Current status of sync operations
 */
export type SyncStatus = "idle" | "syncing" | "error";

/**
 * Detailed sync state for a user
 */
export interface SyncState {
  /** Current sync status */
  status: SyncStatus;
  /** History ID for incremental sync */
  historyId?: string;
  /** Last successful sync timestamp */
  lastSyncAt?: Date;
  /** Last full sync timestamp */
  lastFullSyncAt?: Date;
  /** Error message if status is error */
  error?: string;
  /** Sync statistics */
  stats: {
    emailCount: number;
    labelCount: number;
    contactCount: number;
  };
}

// ─────────────────────────────────────────────────────────────
// Job Data Types
// Note: ContactSyncJobData is defined in @/lib/queue/jobs.ts
// to maintain the established pattern of job types in the queue module
// ─────────────────────────────────────────────────────────────

/**
 * Data for a full email sync job
 */
export interface FullEmailSyncJobData {
  userId: string;
  accountId: string;
  options?: FullSyncOptions;
}

/**
 * Data for an incremental email sync job
 */
export interface IncrementalEmailSyncJobData {
  userId: string;
  accountId: string;
  options?: IncrementalSyncOptions;
}
