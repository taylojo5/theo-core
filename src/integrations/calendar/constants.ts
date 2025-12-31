// ═══════════════════════════════════════════════════════════════════════════
// Calendar Integration Constants
// Centralized constants for the Calendar integration module
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Sync Constants
// ─────────────────────────────────────────────────────────────

/**
 * Maximum number of pages to fetch during a full sync
 * Acts as a safety limit to prevent infinite loops
 */
export const FULL_SYNC_MAX_PAGES = 100;

/**
 * Default page size for listing events from Calendar API
 */
export const DEFAULT_EVENT_PAGE_SIZE = 250;

/**
 * Default page size for listing calendars from Calendar API
 */
export const DEFAULT_CALENDAR_PAGE_SIZE = 100;

/**
 * Number of events to fetch concurrently when retrieving full details
 */
export const EVENT_FETCH_CONCURRENCY = 10;

/**
 * Default time range for full sync: look back this many days
 */
export const FULL_SYNC_LOOKBACK_DAYS = 30;

/**
 * Default time range for full sync: look ahead this many days
 */
export const FULL_SYNC_LOOKAHEAD_DAYS = 365;

/**
 * Maximum events to process in one incremental sync batch
 */
export const INCREMENTAL_SYNC_MAX_EVENTS = 500;

// ─────────────────────────────────────────────────────────────
// Embedding Constants
// ─────────────────────────────────────────────────────────────

/**
 * Maximum description length to include in event embeddings
 * Longer content is truncated to manage API token costs
 */
export const EMBEDDING_MAX_DESCRIPTION_LENGTH = 1500;

/**
 * Batch size for bulk embedding generation
 * Processing sequentially to avoid rate limits
 */
export const EMBEDDING_BATCH_SIZE = 1;

/**
 * Batch size for queueing embeddings during full sync
 */
export const FULL_SYNC_EMBEDDING_BATCH_SIZE = 20;

/**
 * Batch size for queueing embeddings during incremental sync
 */
export const INCREMENTAL_SYNC_EMBEDDING_BATCH_SIZE = 10;

/**
 * Delay between embedding API calls in milliseconds
 */
export const EMBEDDING_BATCH_DELAY_MS = 1500;

/**
 * Minimum description length for event to be worth embedding
 */
export const MIN_CONTENT_LENGTH_FOR_EMBEDDING = 10;

// ─────────────────────────────────────────────────────────────
// Embedding Retry Constants
// ─────────────────────────────────────────────────────────────

/**
 * Maximum number of embedding retry attempts before marking as permanently failed
 */
export const MAX_EMBEDDING_RETRY_ATTEMPTS = 3;

/**
 * Batch size for embedding retry processing
 */
export const EMBEDDING_RETRY_BATCH_SIZE = 50;

/**
 * Delay between embedding retry batches in milliseconds
 */
export const EMBEDDING_RETRY_DELAY_MS = 1000;

// ─────────────────────────────────────────────────────────────
// Rate Limiting Constants
// ─────────────────────────────────────────────────────────────

/**
 * Calendar API per-second quota units limit (conservative)
 * Calendar API has similar limits to other Google APIs
 */
export const CALENDAR_QUOTA_PER_SECOND = 100;

/**
 * Calendar API per-minute quota units limit
 * Conservative limit leaving headroom for bursts
 */
export const CALENDAR_QUOTA_PER_MINUTE = 15000;

/**
 * Maximum concurrent batch requests to Calendar API
 */
export const CALENDAR_MAX_BATCH_REQUESTS = 10;

// ─────────────────────────────────────────────────────────────
// Client Constants
// ─────────────────────────────────────────────────────────────

/**
 * Default timeout for Calendar API requests in milliseconds
 */
export const CALENDAR_REQUEST_TIMEOUT_MS = 30000;

/**
 * Default maximum retry attempts for retryable API errors
 */
export const CALENDAR_MAX_RETRIES = 3;

/**
 * Maximum backoff delay between retries in milliseconds
 */
export const CALENDAR_MAX_RETRY_DELAY_MS = 30000;

/**
 * Base delay for exponential backoff in milliseconds
 */
export const CALENDAR_BASE_RETRY_DELAY_MS = 1000;

// ─────────────────────────────────────────────────────────────
// Job Scheduling Constants
// ─────────────────────────────────────────────────────────────

/**
 * Interval for recurring incremental sync in milliseconds (5 minutes)
 */
export const INCREMENTAL_SYNC_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Interval for approval expiration check in milliseconds (15 minutes)
 */
export const APPROVAL_EXPIRATION_CHECK_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Default stagger delay between batch user syncs in milliseconds
 */
export const BATCH_SYNC_STAGGER_DELAY_MS = 1000;

/**
 * Default delay before waiting for rate limit quota in milliseconds
 */
export const RATE_LIMIT_WAIT_TIMEOUT_MS = 30000;

// ─────────────────────────────────────────────────────────────
// Webhook Constants
// ─────────────────────────────────────────────────────────────

/**
 * Maximum webhook channel lifetime in milliseconds (7 days)
 * Google enforces this limit
 */
export const WEBHOOK_MAX_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Renew webhook this many milliseconds before expiration
 * Gives buffer to handle renewal before actual expiration
 */
export const WEBHOOK_RENEWAL_BUFFER_MS = 60 * 60 * 1000; // 1 hour

/**
 * Interval for checking webhook expiration (hourly)
 */
export const WEBHOOK_EXPIRATION_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Debounce webhook notifications within this window (milliseconds)
 * Prevents multiple syncs for rapid-fire notifications
 */
export const WEBHOOK_DEBOUNCE_MS = 5000;

// ─────────────────────────────────────────────────────────────
// Job Options Constants
// ─────────────────────────────────────────────────────────────

/**
 * Number of retry attempts for full sync jobs
 */
export const FULL_SYNC_JOB_ATTEMPTS = 3;

/**
 * Number of retry attempts for incremental sync jobs
 */
export const INCREMENTAL_SYNC_JOB_ATTEMPTS = 5;

/**
 * Backoff delay for full sync job retries in milliseconds
 */
export const FULL_SYNC_BACKOFF_DELAY_MS = 5000;

/**
 * Backoff delay for incremental sync job retries in milliseconds
 */
export const INCREMENTAL_SYNC_BACKOFF_DELAY_MS = 2000;

/**
 * Number of completed full sync jobs to retain
 */
export const FULL_SYNC_JOBS_RETAIN_COMPLETED = 50;

/**
 * Number of failed full sync jobs to retain
 */
export const FULL_SYNC_JOBS_RETAIN_FAILED = 100;

/**
 * Number of completed incremental sync jobs to retain
 */
export const INCREMENTAL_SYNC_JOBS_RETAIN_COMPLETED = 100;

/**
 * Number of failed incremental sync jobs to retain
 */
export const INCREMENTAL_SYNC_JOBS_RETAIN_FAILED = 200;

// ─────────────────────────────────────────────────────────────
// Approval Constants
// ─────────────────────────────────────────────────────────────

/**
 * Default expiration time for calendar approvals (24 hours)
 */
export const APPROVAL_DEFAULT_EXPIRATION_MS = 24 * 60 * 60 * 1000;

/**
 * Minimum time before event start to allow approval (15 minutes)
 * If less time remains, approval expires automatically
 */
export const APPROVAL_MIN_LEAD_TIME_MS = 15 * 60 * 1000;

// ─────────────────────────────────────────────────────────────
// Calendar Access Roles
// ─────────────────────────────────────────────────────────────

/**
 * Calendar access role values from Google Calendar API
 */
export const CALENDAR_ACCESS_ROLES = {
  /** Full owner access */
  OWNER: "owner",
  /** Can create and modify events */
  WRITER: "writer",
  /** Can only view events */
  READER: "reader",
  /** Can only see free/busy status */
  FREE_BUSY_READER: "freeBusyReader",
} as const;

// ─────────────────────────────────────────────────────────────
// Event Response Statuses
// ─────────────────────────────────────────────────────────────

/**
 * Event attendee response status values
 */
export const ATTENDEE_RESPONSE_STATUS = {
  NEEDS_ACTION: "needsAction",
  DECLINED: "declined",
  TENTATIVE: "tentative",
  ACCEPTED: "accepted",
} as const;

// ─────────────────────────────────────────────────────────────
// Event Visibility Settings
// ─────────────────────────────────────────────────────────────

/**
 * Event visibility options
 */
export const EVENT_VISIBILITY = {
  /** Uses calendar default */
  DEFAULT: "default",
  /** Show as busy only */
  PUBLIC: "public",
  /** Show full details only to attendees */
  PRIVATE: "private",
  /** Hide from free/busy lookups */
  CONFIDENTIAL: "confidential",
} as const;

// ─────────────────────────────────────────────────────────────
// Event Status Values
// ─────────────────────────────────────────────────────────────

/**
 * Event status values from Google Calendar API
 */
export const EVENT_STATUS = {
  CONFIRMED: "confirmed",
  TENTATIVE: "tentative",
  CANCELLED: "cancelled",
} as const;

// ─────────────────────────────────────────────────────────────
// Default Reminder Settings
// ─────────────────────────────────────────────────────────────

/**
 * Default reminder before event (in minutes)
 */
export const DEFAULT_REMINDER_MINUTES = 30;

/**
 * Default reminder method
 */
export const DEFAULT_REMINDER_METHOD = "popup" as const;
