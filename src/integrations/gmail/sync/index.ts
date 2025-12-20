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
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Contact sync types
  ContactSyncResult,
  ContactSyncError,
  ContactSyncOptions,

  // Email sync types (for future chunks)
  EmailSyncType,
  EmailSyncResult,
  EmailSyncError,
  FullSyncOptions,
  IncrementalSyncOptions,

  // Sync status types
  SyncStatus,
  SyncState,

  // Job data types
  // Note: ContactSyncJobData is defined in @/lib/queue/jobs.ts
  FullEmailSyncJobData,
  IncrementalEmailSyncJobData,
} from "./types";
