// ═══════════════════════════════════════════════════════════════════════════
// Gmail Sync Job Types
// Type definitions for email sync background jobs
// ═══════════════════════════════════════════════════════════════════════════

import type { FullSyncOptions, IncrementalSyncOptions } from "./types";

// ─────────────────────────────────────────────────────────────
// Job Names
// ─────────────────────────────────────────────────────────────

export const GMAIL_JOB_NAMES = {
  FULL_SYNC: "gmail-full-sync",
  INCREMENTAL_SYNC: "gmail-incremental-sync",
  SYNC_LABELS: "gmail-sync-labels",
} as const;

export type GmailJobName =
  (typeof GMAIL_JOB_NAMES)[keyof typeof GMAIL_JOB_NAMES];

// ─────────────────────────────────────────────────────────────
// Full Sync Job
// ─────────────────────────────────────────────────────────────

/**
 * Data for a full email sync job
 * Used for initial import of all emails
 */
export interface FullSyncJobData {
  userId: string;
  /** Page token for resuming pagination */
  pageToken?: string;
  /** Options for full sync */
  options?: FullSyncOptions;
}

/**
 * Progress data for a full sync job
 */
export interface FullSyncProgress {
  phase: "fetching" | "storing" | "complete";
  messagesProcessed: number;
  messagesTotal?: number;
  currentPage: number;
  pagesTotal?: number;
}

// ─────────────────────────────────────────────────────────────
// Incremental Sync Job
// ─────────────────────────────────────────────────────────────

/**
 * Data for an incremental email sync job
 * Uses Gmail History API for delta updates
 */
export interface IncrementalSyncJobData {
  userId: string;
  /** History ID to start from (fetched from sync state if not provided) */
  startHistoryId?: string;
  /** Options for incremental sync */
  options?: IncrementalSyncOptions;
}

/**
 * Progress data for an incremental sync job
 */
export interface IncrementalSyncProgress {
  phase: "fetching-history" | "processing-changes" | "complete";
  changesProcessed: number;
  changesTotal?: number;
  messagesAdded: number;
  messagesDeleted: number;
  labelsChanged: number;
}

// ─────────────────────────────────────────────────────────────
// Label Sync Job
// ─────────────────────────────────────────────────────────────

/**
 * Data for syncing Gmail labels
 */
export interface LabelSyncJobData {
  userId: string;
}

// ─────────────────────────────────────────────────────────────
// Job Options
// ─────────────────────────────────────────────────────────────

/**
 * Default job options for Gmail sync jobs
 */
export const GMAIL_JOB_OPTIONS = {
  FULL_SYNC: {
    attempts: 3,
    backoff: {
      type: "exponential" as const,
      delay: 5000,
    },
    removeOnComplete: 50,
    removeOnFail: 100,
  },
  INCREMENTAL_SYNC: {
    attempts: 5,
    backoff: {
      type: "exponential" as const,
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
  LABEL_SYNC: {
    attempts: 3,
    backoff: {
      type: "exponential" as const,
      delay: 1000,
    },
    removeOnComplete: 10,
    removeOnFail: 50,
  },
} as const;

/**
 * Repeatable job configuration for incremental sync
 */
export const INCREMENTAL_SYNC_REPEAT = {
  /** Sync every 5 minutes */
  every: 5 * 60 * 1000,
  /** Start immediately */
  immediately: true,
} as const;
