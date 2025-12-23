// ═══════════════════════════════════════════════════════════════════════════
// Calendar Sync Module
// Full and incremental sync for Google Calendar integration
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Sync result types
  CalendarSyncType,
  CalendarSyncResult,
  SyncOperationError,
  
  // Full sync types
  FullCalendarSyncOptions,
  FullSyncCheckpoint,
  FullSyncProgress,
  
  // Incremental sync types
  IncrementalCalendarSyncOptions,
  IncrementalSyncProgress,
  EventChange,
  
  // Status types
  SyncStatus,
  SyncState,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Job Definitions
// ─────────────────────────────────────────────────────────────

export {
  CALENDAR_JOB_NAMES,
} from "./jobs";

export type {
  // Job name type
  CalendarJobName,
  
  // Job data types (canonical definitions)
  FullSyncJobData,
  IncrementalSyncJobData,
  ProcessWebhookJobData,
  RenewWebhookJobData,
  ExpireApprovalsJobData,
  BulkEventEmbedJobData,
  
  // Job result types
  SyncJobResult,
  WebhookJobResult,
  EmbeddingJobResult,
} from "./jobs";

// ─────────────────────────────────────────────────────────────
// Full Sync
// ─────────────────────────────────────────────────────────────

export {
  fullCalendarSync,
  resumeFullSync,
} from "./full-sync";

// ─────────────────────────────────────────────────────────────
// Incremental Sync
// ─────────────────────────────────────────────────────────────

export {
  incrementalCalendarSync,
  triggerIncrementalSync,
} from "./incremental-sync";

// ─────────────────────────────────────────────────────────────
// Webhooks
// ─────────────────────────────────────────────────────────────

export {
  registerWebhook,
  stopWebhook,
  processWebhookNotification,
  parseWebhookHeaders,
  renewExpiringWebhooks,
  needsRenewal,
} from "./webhook";

export type {
  WebhookRegistration,
  WebhookNotification,
  WebhookProcessResult,
} from "./webhook";

// ─────────────────────────────────────────────────────────────
// Scheduler
// ─────────────────────────────────────────────────────────────

export {
  // One-time job scheduling
  scheduleFullSync,
  scheduleIncrementalSync,
  scheduleWebhookProcessing,
  scheduleWebhookRenewal,
  
  // Recurring job management
  startRecurringSync,
  stopRecurringSync,
  startWebhookRenewalScheduler,
  stopWebhookRenewalScheduler,
  startApprovalExpirationScheduler,
  stopApprovalExpirationScheduler,
  
  // Scheduler initialization
  initializeSchedulers,
  shutdownSchedulers,
  
  // Utilities
  hasRecurringSyncActive,
} from "./scheduler";

export type {
  CalendarJobQueue,
  SchedulerConfig,
} from "./scheduler";

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

export {
  // Embedding utilities
  queueEventEmbeddings,
  queueFullSyncEmbeddings,
  queueIncrementalSyncEmbeddings,
  
  // Checkpoint utilities
  saveCheckpoint,
  getCheckpoint,
  clearCheckpoint,
  
  // Time range utilities
  getDefaultSyncTimeRange,
  formatDateForApi,
  
  // Error utilities
  createSyncError,
  
  // Statistics utilities
  updateEmbeddingStats,
} from "./utils";

export type { QueueEmbeddingsOptions } from "./utils";
