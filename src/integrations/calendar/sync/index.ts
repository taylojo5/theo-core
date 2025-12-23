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
  
  // Job data types
  FullCalendarSyncJobData,
  IncrementalCalendarSyncJobData,
  WebhookProcessJobData,
  ExpireCalendarApprovalsJobData,
  RenewWebhookJobData,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Job Definitions
// ─────────────────────────────────────────────────────────────

export {
  CALENDAR_JOB_NAMES,
} from "./jobs";

export type {
  CalendarJobName,
  FullSyncJobData,
  IncrementalSyncJobData,
  ProcessWebhookJobData,
  RenewWebhookJobData as RenewWebhookJobDataFromJobs,
  ExpireApprovalsJobData,
  BulkEventEmbedJobData,
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

