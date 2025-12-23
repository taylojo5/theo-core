// ═══════════════════════════════════════════════════════════════════════════
// Calendar Integration
// Complete Google Calendar API client with rate limiting, error handling, and utilities
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Scopes
// ─────────────────────────────────────────────────────────────

export {
  // Scope constants
  CALENDAR_SCOPES,
  ALL_CALENDAR_SCOPES,
  CALENDAR_READ_SCOPES,
  CALENDAR_WRITE_SCOPES,
  // Scope utilities
  hasCalendarReadScope,
  hasCalendarWriteScope,
  hasCalendarSettingsScope,
  canPerformCalendarAction,
  getMissingCalendarScopes,
  needsCalendarScopeUpgrade,
  getCalendarScopeStatus,
  // Re-exports from auth module
  hasCalendarReadAccess,
  hasCalendarWriteAccess,
  getRequiredCalendarScopes,
} from "./scopes";

export type { CalendarScopeStatus } from "./scopes";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Calendar types
  GoogleCalendar,
  CalendarAccessRole,

  // Event types
  GoogleEvent,
  EventStatus,
  EventVisibility,
  EventType,
  EventCreator,
  EventOrganizer,
  EventAttendee,
  AttendeeResponseStatus,

  // DateTime types
  EventDateTime,

  // Conference types
  ConferenceData,
  ConferenceEntryPoint,

  // Reminder types
  EventReminders,
  EventReminder,

  // Extended properties
  EventExtendedProperties,
  EventSource,
  EventGadget,
  EventAttachment,

  // List response types
  CalendarListResponse,
  EventListResponse,

  // Watch/webhook types
  WatchResponse,
  WebhookNotification,

  // Client options
  ListCalendarsOptions,
  ListEventsOptions,

  // Input types
  EventCreateInput,
  EventUpdateInput,

  // Sync types
  CalendarSyncOptions,
  CalendarSyncStatus,

  // Action types
  CalendarActionType,
  CalendarApprovalStatus,

  // Quota types
  CalendarOperation,
} from "./types";

export { CALENDAR_QUOTA_UNITS } from "./types";

// ─────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────

export {
  CalendarError,
  CalendarErrorCode,
  CalendarAuthError,
  CalendarSyncError,
  CalendarApiError,
  CalendarConflictError,
  parseGoogleApiError,
  isCalendarError,
  isRetryableError,
  needsTokenRefresh,
  needsScopeUpgrade,
  isSyncTokenExpired,
  isConflictError,
} from "./errors";

// ─────────────────────────────────────────────────────────────
// Logger
// ─────────────────────────────────────────────────────────────

export {
  calendarLogger,
  syncLogger,
  workerLogger,
  schedulerLogger,
  actionsLogger,
  clientLogger,
  webhookLogger,
  embeddingsLogger,
  apiLogger,
  approvalLogger,
  createCalendarLogger,
  CalendarLogger,
} from "./logger";

export type { LogLevel, CalendarLogEntry } from "./logger";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

export {
  // Sync constants
  FULL_SYNC_MAX_PAGES,
  DEFAULT_EVENT_PAGE_SIZE,
  DEFAULT_CALENDAR_PAGE_SIZE,
  EVENT_FETCH_CONCURRENCY,
  FULL_SYNC_LOOKBACK_DAYS,
  FULL_SYNC_LOOKAHEAD_DAYS,
  INCREMENTAL_SYNC_MAX_EVENTS,

  // Embedding constants
  EMBEDDING_MAX_DESCRIPTION_LENGTH,
  EMBEDDING_BATCH_SIZE,
  FULL_SYNC_EMBEDDING_BATCH_SIZE,
  INCREMENTAL_SYNC_EMBEDDING_BATCH_SIZE,
  EMBEDDING_BATCH_DELAY_MS,
  MIN_CONTENT_LENGTH_FOR_EMBEDDING,

  // Rate limiting constants
  CALENDAR_QUOTA_PER_SECOND,
  CALENDAR_QUOTA_PER_MINUTE,
  CALENDAR_MAX_BATCH_REQUESTS,

  // Client constants
  CALENDAR_REQUEST_TIMEOUT_MS,
  CALENDAR_MAX_RETRIES,
  CALENDAR_MAX_RETRY_DELAY_MS,
  CALENDAR_BASE_RETRY_DELAY_MS,

  // Job scheduling constants
  INCREMENTAL_SYNC_INTERVAL_MS,
  APPROVAL_EXPIRATION_CHECK_INTERVAL_MS,
  BATCH_SYNC_STAGGER_DELAY_MS,
  RATE_LIMIT_WAIT_TIMEOUT_MS,

  // Webhook constants
  WEBHOOK_MAX_LIFETIME_MS,
  WEBHOOK_RENEWAL_BUFFER_MS,
  WEBHOOK_EXPIRATION_CHECK_INTERVAL_MS,
  WEBHOOK_DEBOUNCE_MS,

  // Job options constants
  FULL_SYNC_JOB_ATTEMPTS,
  INCREMENTAL_SYNC_JOB_ATTEMPTS,
  FULL_SYNC_BACKOFF_DELAY_MS,
  INCREMENTAL_SYNC_BACKOFF_DELAY_MS,
  FULL_SYNC_JOBS_RETAIN_COMPLETED,
  FULL_SYNC_JOBS_RETAIN_FAILED,
  INCREMENTAL_SYNC_JOBS_RETAIN_COMPLETED,
  INCREMENTAL_SYNC_JOBS_RETAIN_FAILED,

  // Approval constants
  APPROVAL_DEFAULT_EXPIRATION_MS,
  APPROVAL_MIN_LEAD_TIME_MS,

  // Calendar access roles
  CALENDAR_ACCESS_ROLES,

  // Event response statuses
  ATTENDEE_RESPONSE_STATUS,

  // Event visibility
  EVENT_VISIBILITY,

  // Event status
  EVENT_STATUS,

  // Reminder defaults
  DEFAULT_REMINDER_MINUTES,
  DEFAULT_REMINDER_METHOD,
} from "./constants";

// ─────────────────────────────────────────────────────────────
// Client
// ─────────────────────────────────────────────────────────────

export {
  CalendarClient,
  createCalendarClient,
} from "./client";

export type { CalendarClientConfig } from "./client";

// ─────────────────────────────────────────────────────────────
// Rate Limiter
// ─────────────────────────────────────────────────────────────

export {
  CalendarRateLimiter,
  createCalendarRateLimiter,
  calculateBatchQuota,
  estimateRemainingOperations,
  CALENDAR_RATE_LIMITS,
} from "./rate-limiter";

export type { RateLimitCheckResult } from "./rate-limiter";

