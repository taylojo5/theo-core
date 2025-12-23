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

export {
  fullSync,
  resumeFullSync,
  resumeFullSyncFromToken,
  getCheckpoint,
  saveCheckpoint,
  clearCheckpoint,
  hasCheckpoint,
  type FullSyncProgress,
} from "./full-sync";

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

  // Approval expiration scheduler
  startApprovalExpirationScheduler,
  stopApprovalExpirationScheduler,
  isApprovalExpirationSchedulerRunning,
  triggerApprovalExpiration,

  // Contact sync scheduling
  scheduleContactSync,
  triggerContactSync,
} from "./scheduler";

// ─────────────────────────────────────────────────────────────
// Worker
// ─────────────────────────────────────────────────────────────

export { registerGmailSyncWorker } from "./worker";

// ─────────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────────

import { registerGmailSyncWorker } from "./worker";
import { startApprovalExpirationScheduler } from "./scheduler";

/**
 * Initialize the Gmail sync system
 *
 * This should be called once on application startup.
 * It registers the BullMQ worker and starts the approval expiration scheduler.
 *
 * @example
 * ```ts
 * // In your server initialization file
 * import { initializeGmailSync } from '@/integrations/gmail';
 *
 * await initializeGmailSync();
 * ```
 */
export async function initializeGmailSync(): Promise<void> {
  // Register the worker to process sync jobs
  registerGmailSyncWorker();

  // Start the approval expiration scheduler (runs hourly)
  await startApprovalExpirationScheduler();
}

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

export {
  queueEmailEmbeddings,
  queueFullSyncEmbeddings,
  queueIncrementalSyncEmbeddings,
  FULL_SYNC_EMBEDDING_BATCH_SIZE,
  INCREMENTAL_SYNC_EMBEDDING_BATCH_SIZE,
  type QueueEmbeddingsOptions,
} from "./utils";

// ─────────────────────────────────────────────────────────────
// Job Types
// ─────────────────────────────────────────────────────────────

export {
  GMAIL_JOB_NAMES,
  GMAIL_JOB_OPTIONS,
  INCREMENTAL_SYNC_REPEAT,
  EXPIRE_APPROVALS_REPEAT,
  type GmailJobName,
  type FullSyncJobData,
  type IncrementalSyncJobData,
  type LabelSyncJobData,
  type ExpireApprovalsJobData,
  type ContactSyncJobData,
  type FullSyncProgress as FullSyncJobProgress,
  type IncrementalSyncProgress as IncrementalSyncJobProgress,
} from "./jobs";

// ─────────────────────────────────────────────────────────────
// Embedding Retry
// ─────────────────────────────────────────────────────────────

export {
  retryFailedEmbeddings,
  queueEmbeddingRetry,
  getEmbeddingStats,
  getEmailsNeedingEmbedding,
  markEmbeddingCompleted,
  markEmbeddingFailed,
  markEmbeddingProcessing,
  resetFailedEmbeddings,
  updateEmbeddingStatsInSyncState,
  type EmbeddingStatus,
  type EmbeddingRetryResult,
  type EmbeddingStats,
} from "./embedding-retry";

// ─────────────────────────────────────────────────────────────
// Batch Error Reporting
// ─────────────────────────────────────────────────────────────

export {
  BatchErrorCollector,
  executeBatchWithErrorCollection,
  executeBatchParallelWithErrorCollection,
  classifyError,
  BATCH_ERROR_CODES,
  type BatchItemError,
  type BatchOperationResult,
  type BatchErrorReport,
  type BatchOperationType,
  type BatchErrorCode,
} from "./batch-errors";

// ─────────────────────────────────────────────────────────────
// History ID Monitoring
// ─────────────────────────────────────────────────────────────

export {
  runHistoryIdMonitor,
  getHistoryIdStatus,
  getAllHistoryIdStatuses,
  getHistoryIdHealthSummary,
  calculateHistoryIdAge,
  calculateDaysUntilExpiration,
  isHistoryIdExpiringSoon,
  isHistoryIdExpired,
  updateHistoryIdWithTimestamp,
  type HistoryIdStatus,
  type HistoryIdMonitorResult,
} from "./history-monitor";

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

  // Sync checkpoint types
  FullSyncCheckpoint,

  // Sync status types
  SyncStatus,
  SyncState,

  // Job data types
  FullEmailSyncJobData,
  IncrementalEmailSyncJobData,
} from "./types";
