// ═══════════════════════════════════════════════════════════════════════════
// Gmail Integration Constants
// Centralized constants for the Gmail integration module
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Sync Constants
// ─────────────────────────────────────────────────────────────

/**
 * Development mode email limit for full sync
 * Set GMAIL_DEV_MODE=true to limit full sync to this many emails
 * Useful during development/testing to avoid syncing thousands of emails
 */
export const DEV_MODE_MAX_EMAILS = 100;

/**
 * Production default for maximum emails in a full sync
 */
export const FULL_SYNC_DEFAULT_MAX_EMAILS = 100;

/**
 * Get the effective max emails limit based on dev mode
 */
export const getMaxEmailsLimit = (): number => {
  return FULL_SYNC_DEFAULT_MAX_EMAILS;
};

/**
 * Maximum number of pages to fetch during a full sync
 * Acts as a safety limit to prevent infinite loops
 */
export const FULL_SYNC_MAX_PAGES = 100;

/**
 * Maximum number of history entries to process in one incremental sync
 * Helps prevent overwhelming the system with too many changes at once
 */
export const INCREMENTAL_SYNC_MAX_HISTORY_ENTRIES = 500;

/**
 * Default page size for listing messages from Gmail API
 */
export const DEFAULT_MESSAGE_PAGE_SIZE = 100;

/**
 * Default page size for listing contacts from Google People API
 */
export const DEFAULT_CONTACTS_PAGE_SIZE = 100;

/**
 * Number of messages to fetch concurrently when retrieving full details
 */
export const MESSAGE_FETCH_CONCURRENCY = 10;

// ─────────────────────────────────────────────────────────────
// Embedding Constants
// ─────────────────────────────────────────────────────────────

/**
 * Maximum body text length to include in email embeddings
 * Longer content is truncated to manage API token costs
 */
export const EMBEDDING_MAX_BODY_LENGTH = 2000;

/**
 * Batch size for bulk embedding generation
 * Balances throughput with memory usage and API rate limits
 */
export const EMBEDDING_BATCH_SIZE = 5;

/**
 * Batch size for queueing embeddings during full sync
 * Larger batches for throughput during bulk operations
 */
export const FULL_SYNC_EMBEDDING_BATCH_SIZE = 20;

/**
 * Batch size for queueing embeddings during incremental sync
 * Smaller batches for lower latency on real-time updates
 */
export const INCREMENTAL_SYNC_EMBEDDING_BATCH_SIZE = 10;

/**
 * Delay between embedding batches in milliseconds
 * Helps respect rate limits and prevent API throttling
 */
export const EMBEDDING_BATCH_DELAY_MS = 100;

// ─────────────────────────────────────────────────────────────
// Rate Limiting Constants
// ─────────────────────────────────────────────────────────────

/**
 * Gmail API per-second quota units limit (conservative)
 * Gmail allows 250 units/sec but we use 100 for headroom
 */
export const GMAIL_QUOTA_PER_SECOND = 100;

/**
 * Gmail API per-minute quota units limit
 * Conservative limit leaving headroom for bursts
 */
export const GMAIL_QUOTA_PER_MINUTE = 15000;

/**
 * Maximum concurrent batch requests to Gmail API
 */
export const GMAIL_MAX_BATCH_REQUESTS = 10;

// ─────────────────────────────────────────────────────────────
// Client Constants
// ─────────────────────────────────────────────────────────────

/**
 * Default timeout for Gmail API requests in milliseconds
 */
export const GMAIL_REQUEST_TIMEOUT_MS = 30000;

/**
 * Default maximum retry attempts for retryable API errors
 */
export const GMAIL_MAX_RETRIES = 3;

/**
 * Maximum backoff delay between retries in milliseconds
 */
export const GMAIL_MAX_RETRY_DELAY_MS = 30000;

/**
 * Base delay for exponential backoff in milliseconds
 */
export const GMAIL_BASE_RETRY_DELAY_MS = 1000;

// ─────────────────────────────────────────────────────────────
// Job Scheduling Constants
// ─────────────────────────────────────────────────────────────

/**
 * Interval for recurring incremental sync in milliseconds (5 minutes)
 */
export const INCREMENTAL_SYNC_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Interval for approval expiration check in milliseconds (1 hour)
 */
export const APPROVAL_EXPIRATION_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Default stagger delay between batch user syncs in milliseconds
 */
export const BATCH_SYNC_STAGGER_DELAY_MS = 1000;

/**
 * Default delay before waiting for rate limit quota in milliseconds
 */
export const RATE_LIMIT_WAIT_TIMEOUT_MS = 30000;

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
// History ID Expiration Constants
// ─────────────────────────────────────────────────────────────

/**
 * Gmail history IDs expire after approximately 30 days
 * We use 25 days as a warning threshold
 */
export const HISTORY_ID_WARNING_DAYS = 25;

/**
 * Interval for checking history ID expiration (daily)
 */
export const HISTORY_EXPIRATION_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

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
// Content Constants
// ─────────────────────────────────────────────────────────────

/**
 * Minimum content length for email to be worth embedding
 * Emails with less content are skipped
 */
export const MIN_CONTENT_LENGTH_FOR_EMBEDDING = 20;

/**
 * System labels to filter out when preparing embeddings
 * These don't add semantic value to the search
 */
export const SYSTEM_LABELS_TO_FILTER = [
  "INBOX",
  "UNREAD",
  "SENT",
  "DRAFT",
  "TRASH",
  "SPAM",
] as const;

// ─────────────────────────────────────────────────────────────
// Default Person Fields for Contacts API
// ─────────────────────────────────────────────────────────────

/**
 * Default fields to request when fetching contacts from People API
 */
export const DEFAULT_CONTACT_PERSON_FIELDS = [
  "names",
  "emailAddresses",
  "phoneNumbers",
  "organizations",
  "photos",
  "addresses",
  "birthdays",
  "biographies",
] as const;
