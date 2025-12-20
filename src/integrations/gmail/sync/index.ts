// ═══════════════════════════════════════════════════════════════════════════
// Gmail Sync Module
// Background sync operations for Gmail integration
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Contact Sync
// ─────────────────────────────────────────────────────────────

export {
  syncContacts,
  syncContactsForUser,
  getContactSyncStatus,
} from "./contacts";

// ─────────────────────────────────────────────────────────────
// Email Sync
// ─────────────────────────────────────────────────────────────

export { fullSync, resumeFullSync, type FullSyncProgress } from "./full-sync";

export {
  incrementalSync,
  type IncrementalSyncProgress,
} from "./incremental-sync";

// ─────────────────────────────────────────────────────────────
// Scheduler
// ─────────────────────────────────────────────────────────────

export {
  // Full sync scheduling
  scheduleFullSync,
  triggerFullSync,

  // Incremental sync scheduling
  scheduleIncrementalSync,
  triggerIncrementalSync,

  // Auto sync (detects type)
  scheduleSyncAuto,
  triggerSync,

  // Recurring sync management
  startRecurringSync,
  stopRecurringSync,
  hasRecurringSync,

  // Label sync
  scheduleLabelSync,

  // Batch operations
  scheduleMultipleUserSyncs,

  // Status
  getPendingSyncJobs,
  cancelPendingSyncs,
} from "./scheduler";

// ─────────────────────────────────────────────────────────────
// Worker
// ─────────────────────────────────────────────────────────────

export { registerGmailSyncWorker } from "./worker";

// ─────────────────────────────────────────────────────────────
// Job Types
// ─────────────────────────────────────────────────────────────

export {
  GMAIL_JOB_NAMES,
  GMAIL_JOB_OPTIONS,
  INCREMENTAL_SYNC_REPEAT,
  type GmailJobName,
  type FullSyncJobData,
  type IncrementalSyncJobData,
  type LabelSyncJobData,
  type FullSyncProgress as FullSyncJobProgress,
  type IncrementalSyncProgress as IncrementalSyncJobProgress,
} from "./jobs";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Contact sync types
  ContactSyncResult,
  ContactSyncError,
  ContactSyncOptions,

  // Email sync types
  EmailSyncType,
  EmailSyncResult,
  EmailSyncError,
  FullSyncOptions,
  IncrementalSyncOptions,

  // Sync status types
  SyncStatus,
  SyncState,

  // Job data types
  FullEmailSyncJobData,
  IncrementalEmailSyncJobData,
} from "./types";
