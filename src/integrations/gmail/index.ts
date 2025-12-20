// ═══════════════════════════════════════════════════════════════════════════
// Gmail Integration
// Complete Gmail API client with rate limiting, error handling, and utilities
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Client
// ─────────────────────────────────────────────────────────────

export { GmailClient, createGmailClient } from "./client";
export type { GmailClientConfig } from "./client";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Message types
  GmailMessage,
  GmailMessagePayload,
  GmailMessagePart,
  GmailHeader,
  ParsedGmailMessage,
  EmailAddress,
  AttachmentInfo,

  // Thread types
  GmailThread,
  ParsedGmailThread,

  // Label types
  GmailLabel,
  SystemLabelId,

  // Draft types
  GmailDraft,

  // History types
  GmailHistory,
  GmailHistoryList,

  // Contact types
  GoogleContact,
  ParsedContact,
  GoogleContactList,

  // Client options
  ListMessagesOptions,
  ListThreadsOptions,
  GetMessageOptions,
  ListContactsOptions,
  ListHistoryOptions,
  MessageFormat,

  // Response types
  GmailMessageList,
  GmailThreadList,

  // Action types
  SendMessageParams,
  CreateDraftParams,
  UpdateDraftParams,

  // Profile types
  GmailProfile,

  // Rate limit types
  GmailOperation,
} from "./types";

export { SYSTEM_LABELS, GMAIL_QUOTA_UNITS } from "./types";

// ─────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────

export {
  GmailError,
  GmailErrorCode,
  parseGoogleApiError,
  isGmailError,
  isRetryableError,
  needsTokenRefresh,
  needsScopeUpgrade,
} from "./errors";

// ─────────────────────────────────────────────────────────────
// Rate Limiting
// ─────────────────────────────────────────────────────────────

export {
  GmailRateLimiter,
  createRateLimiter,
  calculateBatchQuota,
  estimateRemainingOperations,
  GMAIL_RATE_LIMITS,
} from "./rate-limiter";

export type { RateLimitCheckResult } from "./rate-limiter";

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

export {
  // Message parsing
  parseGmailMessage,
  parseGmailThread,
  getHeader,

  // Email address parsing
  parseEmailAddress,
  parseEmailAddressList,
  formatEmailAddress,

  // Body extraction
  extractBody,
  extractAttachments,

  // Contact parsing
  parseGoogleContact,

  // Message composition
  buildRawMessage,

  // Base64 encoding
  decodeBase64Url,
  encodeBase64Url,

  // Label utilities
  isSystemLabel,
  getLabelDisplayName,

  // Query building
  buildSearchQuery,

  // HTML utilities
  stripHtml,
  truncateText,
} from "./utils";

// ─────────────────────────────────────────────────────────────
// Auth Scope Utilities (re-exported from auth module)
// ─────────────────────────────────────────────────────────────

export {
  GMAIL_SCOPES,
  ALL_GMAIL_SCOPES,
  hasGmailReadAccess,
  hasGmailSendAccess,
  hasContactsAccess,
  getIntegrationStatus,
} from "@/lib/auth/scopes";

// ─────────────────────────────────────────────────────────────
// Database Repository
// ─────────────────────────────────────────────────────────────

export {
  // Repositories
  emailRepository,
  labelRepository,
  syncStateRepository,
} from "./repository";

export type {
  // Repository types
  CreateEmailInput,
  UpsertEmailInput,
  UpdateEmailInput,
  EmailSearchQuery,
  EmailSearchResult,
  CreateLabelInput,
  SyncStateUpdate,
} from "./repository";

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

export {
  // Email mappers
  mapGmailMessageToEmail,
  mapGmailMessagesToEmails,

  // Label mappers
  mapGmailLabelToEmailLabel,
  mapGmailLabelsToEmailLabels,

  // Contact mappers
  mapContactToPerson,
  mapContactsToPersons,
  personInputToPrisma,

  // Utility mappers
  extractEmailParticipants,
  prepareEmailForEmbedding,
  prepareEmailEmbeddingMetadata,
} from "./mappers";

export type { CreatePersonFromContactInput } from "./mappers";

// ─────────────────────────────────────────────────────────────
// Sync Operations
// ─────────────────────────────────────────────────────────────

export {
  // Contact sync
  syncContacts,
  syncContactsForUser,
  getContactSyncStatus,
} from "./sync";

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
} from "./sync";
