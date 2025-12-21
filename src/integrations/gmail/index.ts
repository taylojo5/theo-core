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
// Logger
// ─────────────────────────────────────────────────────────────

export {
  gmailLogger,
  syncLogger,
  workerLogger,
  schedulerLogger,
  actionsLogger,
  clientLogger,
  embeddingsLogger,
  apiLogger,
  createGmailLogger,
  GmailLogger,
} from "./logger";

export type { LogLevel, GmailLogEntry } from "./logger";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

export {
  // Sync constants
  FULL_SYNC_MAX_PAGES,
  INCREMENTAL_SYNC_MAX_HISTORY_ENTRIES,
  DEFAULT_MESSAGE_PAGE_SIZE,
  DEFAULT_CONTACTS_PAGE_SIZE,
  MESSAGE_FETCH_CONCURRENCY,

  // Embedding constants
  EMBEDDING_MAX_BODY_LENGTH,
  EMBEDDING_BATCH_SIZE,
  FULL_SYNC_EMBEDDING_BATCH_SIZE,
  INCREMENTAL_SYNC_EMBEDDING_BATCH_SIZE,
  EMBEDDING_BATCH_DELAY_MS,
  MIN_CONTENT_LENGTH_FOR_EMBEDDING,
  SYSTEM_LABELS_TO_FILTER,

  // Rate limiting constants
  GMAIL_QUOTA_PER_SECOND,
  GMAIL_QUOTA_PER_MINUTE,
  GMAIL_MAX_BATCH_REQUESTS,

  // Client constants
  GMAIL_REQUEST_TIMEOUT_MS,
  GMAIL_MAX_RETRIES,
  GMAIL_MAX_RETRY_DELAY_MS,
  GMAIL_BASE_RETRY_DELAY_MS,

  // Job scheduling constants
  INCREMENTAL_SYNC_INTERVAL_MS,
  APPROVAL_EXPIRATION_CHECK_INTERVAL_MS,
  BATCH_SYNC_STAGGER_DELAY_MS,
  RATE_LIMIT_WAIT_TIMEOUT_MS,

  // Contact API constants
  DEFAULT_CONTACT_PERSON_FIELDS,
} from "./constants";

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

  // Email sync
  fullSync,
  resumeFullSync,
  incrementalSync,

  // Scheduler
  scheduleFullSync,
  triggerFullSync,
  scheduleIncrementalSync,
  triggerIncrementalSync,
  scheduleSyncAuto,
  triggerSync,
  startRecurringSync,
  stopRecurringSync,
  hasRecurringSync,
  scheduleLabelSync,
  scheduleMultipleUserSyncs,
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

  // Worker registration
  registerGmailSyncWorker,

  // Initialization
  initializeGmailSync,

  // Job constants
  GMAIL_JOB_NAMES,
  GMAIL_JOB_OPTIONS,
  INCREMENTAL_SYNC_REPEAT,
  EXPIRE_APPROVALS_REPEAT,
} from "./sync";

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

  // Progress types
  FullSyncProgress,
  IncrementalSyncProgress,

  // Job types
  GmailJobName,
  FullSyncJobData,
  IncrementalSyncJobData,
  LabelSyncJobData,
  ExpireApprovalsJobData,
  ContactSyncJobData,
} from "./sync";

// ─────────────────────────────────────────────────────────────
// Content Extraction
// ─────────────────────────────────────────────────────────────

export {
  // Main processing
  processEmailContent,
  processEmailQuick,
  processEmailBatch,

  // Processing utilities
  hasActionableContent,
  getDeadlines,
  getHighPriorityActions,
  getLinkedPeople,
  hasProcessingErrors,
  getPrimaryTopic,
  PROCESSING_VERSION,

  // People extraction
  extractPeople,
  extractSender,
  extractRecipients,
  getUniqueEmails,
  getPeopleByRole,
  getLinkedPersonIds,

  // Date extraction
  extractDates,
  extractDeadlines,
  extractDatesFromSubject,
  formatExtractedDate,

  // Action item extraction
  extractActionItems,
  extractActionItemsWithAssignees,
  extractListItems,
  containsActionPatterns,

  // Topic categorization
  extractTopics,
  getEmailPrimaryTopic,
  matchesTopic,
  getAllCategories,
  isValidCategory,
} from "./extraction";

export type {
  // Processing results
  EmailProcessingResult,
  ProcessingMetadata,
  ProcessingError,
  BatchProcessingResult,

  // People
  ExtractedPerson,
  PersonRole,
  PeopleExtractionOptions,

  // Dates
  ExtractedDate,
  DateType,
  DateExtractionOptions,

  // Action items
  ExtractedActionItem,
  ActionPriority,
  ActionIndicator,
  ActionExtractionOptions,

  // Topics
  ExtractedTopic,
  TopicCategory,
  TopicExtractionOptions,

  // Processing options
  EmailProcessingOptions,
  BatchProcessingOptions,

  // Input types
  EmailInput,
} from "./extraction";

// ─────────────────────────────────────────────────────────────
// Email Embeddings
// ─────────────────────────────────────────────────────────────

export {
  // Content building
  buildEmailContent,
  buildEmailMetadata,

  // Single embedding
  generateEmailEmbedding,
  generateEmailEmbeddingById,

  // Bulk embeddings
  generateEmailEmbeddings,
  generateUserEmailEmbeddings,

  // Management
  deleteEmailEmbedding,
  deleteEmailEmbeddings,
  emailNeedsReembedding,

  // Constants
  EMAIL_ENTITY_TYPE,
} from "./embeddings";

export type {
  EmailEmbeddingResult,
  BulkEmailEmbeddingResult,
  EmailEmbeddingMetadata,
} from "./embeddings";

// ─────────────────────────────────────────────────────────────
// Email Actions (Draft, Send, Approval)
// ─────────────────────────────────────────────────────────────

export {
  // Draft management
  createDraft,
  updateDraft,
  deleteDraft,
  getDraft,
  listDrafts,

  // Composition utilities
  validateEmailAddresses,
  validateComposeParams,
  buildReplyParams,
  buildForwardParams,
  formatEmailForDisplay,
  parseDisplayEmail,

  // Approval workflow
  requestApproval,
  approveAndSend,
  rejectApproval,
  getApproval,
  getPendingApprovals,
  getApprovals,
  getApprovalStats,
  expireOverdueApprovals,
  isApprovalExpired,
  getTimeUntilExpiration,

  // Send
  sendEmailDirect,
  sendDraft,
  sendReply,
  sendReplyAll,
} from "./actions";

export type {
  // Status types
  ApprovalStatus,

  // Compose types
  ComposeEmailParams,
  CreateDraftResult,
  UpdateDraftResult,

  // Approval types
  RequestApprovalParams,
  EmailApproval,
  RequestApprovalResult,
  ApproveAndSendResult,
  RejectApprovalResult,

  // Send types
  SendEmailResult,
  SendDraftOptions,

  // Query types
  ApprovalQueryOptions,
  ApprovalStats,
} from "./actions";
