// ═══════════════════════════════════════════════════════════════════════════
// Calendar Error Types
// Comprehensive error handling for Google Calendar API operations
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calendar-specific error codes
 */
export enum CalendarErrorCode {
  /** Token is invalid or expired */
  UNAUTHORIZED = "UNAUTHORIZED",
  /** Request was rate limited by Calendar API */
  RATE_LIMITED = "RATE_LIMITED",
  /** Daily quota exceeded */
  QUOTA_EXCEEDED = "QUOTA_EXCEEDED",
  /** Resource (calendar, event) not found */
  NOT_FOUND = "NOT_FOUND",
  /** Invalid request parameters */
  INVALID_REQUEST = "INVALID_REQUEST",
  /** Network connectivity issue */
  NETWORK_ERROR = "NETWORK_ERROR",
  /** User does not have required scope */
  INSUFFICIENT_PERMISSION = "INSUFFICIENT_PERMISSION",
  /** Calendar API returned unexpected error */
  UNKNOWN = "UNKNOWN",
  /** Request timed out */
  TIMEOUT = "TIMEOUT",
  /** Server error from Calendar API */
  SERVER_ERROR = "SERVER_ERROR",
  /** Calendar or event not accessible */
  ACCESS_DENIED = "ACCESS_DENIED",
  /** Sync token is no longer valid */
  SYNC_TOKEN_EXPIRED = "SYNC_TOKEN_EXPIRED",
  /** A full sync is required (no sync token available) */
  SYNC_REQUIRED = "SYNC_REQUIRED",
  /** Event time conflict detected */
  CONFLICT = "CONFLICT",
  /** Invalid recurrence rule */
  INVALID_RECURRENCE = "INVALID_RECURRENCE",
  /** Attendee limit exceeded */
  ATTENDEE_LIMIT = "ATTENDEE_LIMIT",
  /** Calendar not found */
  CALENDAR_NOT_FOUND = "CALENDAR_NOT_FOUND",
  /** Event not found */
  EVENT_NOT_FOUND = "EVENT_NOT_FOUND",
}

/**
 * Calendar API error with retry information
 */
export class CalendarError extends Error {
  constructor(
    public readonly code: CalendarErrorCode,
    message: string,
    public readonly retryable: boolean = false,
    public readonly retryAfterMs?: number,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = "CalendarError";
    Object.setPrototypeOf(this, CalendarError.prototype);
  }

  /**
   * Create a string representation of the error
   */
  toString(): string {
    let str = `CalendarError [${this.code}]: ${this.message}`;
    if (this.retryable) {
      str += ` (retryable${this.retryAfterMs ? ` after ${this.retryAfterMs}ms` : ""})`;
    }
    return str;
  }

  /**
   * Convert to a safe object for logging (no sensitive data)
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      retryAfterMs: this.retryAfterMs,
    };
  }
}

/**
 * Error for authentication/authorization issues
 */
export class CalendarAuthError extends CalendarError {
  constructor(
    message: string,
    public readonly needsReauth: boolean = false,
    public readonly missingScopeAction?: "read" | "write",
    originalError?: Error
  ) {
    super(
      needsReauth
        ? CalendarErrorCode.UNAUTHORIZED
        : CalendarErrorCode.INSUFFICIENT_PERMISSION,
      message,
      needsReauth, // Can retry after token refresh
      undefined,
      originalError
    );
    this.name = "CalendarAuthError";
    Object.setPrototypeOf(this, CalendarAuthError.prototype);
  }
}

/**
 * Error for sync-related issues
 */
export class CalendarSyncError extends CalendarError {
  constructor(
    message: string,
    public readonly syncTokenExpired: boolean = false,
    public readonly partialProgress?: {
      processedEvents: number;
      totalEvents?: number;
      lastSuccessfulPage?: string;
    },
    originalError?: Error
  ) {
    super(
      syncTokenExpired
        ? CalendarErrorCode.SYNC_TOKEN_EXPIRED
        : CalendarErrorCode.UNKNOWN,
      message,
      true, // Sync errors are generally retryable
      undefined,
      originalError
    );
    this.name = "CalendarSyncError";
    Object.setPrototypeOf(this, CalendarSyncError.prototype);
  }
}

/**
 * Error for API-level issues with status codes
 */
export class CalendarApiError extends CalendarError {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly googleErrorCode?: string,
    originalError?: Error
  ) {
    const code = CalendarApiError.statusToErrorCode(statusCode);
    const retryable = CalendarApiError.isStatusRetryable(statusCode);
    const retryAfterMs = CalendarApiError.getRetryDelay(statusCode);

    super(code, message, retryable, retryAfterMs, originalError);
    this.name = "CalendarApiError";
    Object.setPrototypeOf(this, CalendarApiError.prototype);
  }

  private static statusToErrorCode(status: number): CalendarErrorCode {
    switch (status) {
      case 401:
        return CalendarErrorCode.UNAUTHORIZED;
      case 403:
        return CalendarErrorCode.INSUFFICIENT_PERMISSION;
      case 404:
        return CalendarErrorCode.NOT_FOUND;
      case 409:
        return CalendarErrorCode.CONFLICT;
      case 410:
        return CalendarErrorCode.SYNC_TOKEN_EXPIRED;
      case 429:
        return CalendarErrorCode.RATE_LIMITED;
      case 500:
      case 502:
      case 503:
        return CalendarErrorCode.SERVER_ERROR;
      default:
        return CalendarErrorCode.UNKNOWN;
    }
  }

  private static isStatusRetryable(status: number): boolean {
    return status === 429 || status === 500 || status === 502 || status === 503;
  }

  private static getRetryDelay(status: number): number | undefined {
    switch (status) {
      case 429:
        return 60 * 1000; // 1 minute for rate limit
      case 500:
      case 502:
      case 503:
        return 5 * 1000; // 5 seconds for server errors
      default:
        return undefined;
    }
  }
}

/**
 * Error for scheduling conflicts
 */
export class CalendarConflictError extends CalendarError {
  constructor(
    message: string,
    public readonly conflictingEventIds: string[],
    public readonly suggestedTimes?: Array<{ start: Date; end: Date }>,
    originalError?: Error
  ) {
    super(CalendarErrorCode.CONFLICT, message, false, undefined, originalError);
    this.name = "CalendarConflictError";
    Object.setPrototypeOf(this, CalendarConflictError.prototype);
  }
}

// ─────────────────────────────────────────────────────────────
// Error Factory Functions
// ─────────────────────────────────────────────────────────────

/**
 * Parse a Google API error and convert to CalendarError
 */
export function parseGoogleApiError(error: unknown): CalendarError {
  // Handle GaxiosError from googleapis
  if (isGaxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data as GoogleErrorResponse | undefined;
    const googleError = data?.error;

    switch (status) {
      case 401:
        return new CalendarAuthError(
          "Access token is invalid or expired",
          true,
          undefined,
          error
        );

      case 403:
        if (googleError?.message?.includes("rate limit")) {
          return new CalendarError(
            CalendarErrorCode.RATE_LIMITED,
            "Calendar API rate limit exceeded",
            true,
            getRetryAfterMs(error),
            error
          );
        }
        if (googleError?.message?.includes("quota")) {
          return new CalendarError(
            CalendarErrorCode.QUOTA_EXCEEDED,
            "Calendar API daily quota exceeded",
            true,
            getRetryAfterMs(error) || 60 * 60 * 1000, // Default 1 hour
            error
          );
        }
        return new CalendarAuthError(
          googleError?.message || "Insufficient permission to perform this action",
          false,
          undefined,
          error
        );

      case 404:
        return new CalendarError(
          CalendarErrorCode.NOT_FOUND,
          googleError?.message || "Resource not found",
          false,
          undefined,
          error
        );

      case 400:
        return new CalendarError(
          CalendarErrorCode.INVALID_REQUEST,
          googleError?.message || "Invalid request",
          false,
          undefined,
          error
        );

      case 409:
        return new CalendarConflictError(
          googleError?.message || "Scheduling conflict detected",
          [],
          undefined,
          error
        );

      case 410:
        return new CalendarSyncError(
          "Sync token is no longer valid. Full sync required.",
          true,
          undefined,
          error
        );

      case 429:
        return new CalendarError(
          CalendarErrorCode.RATE_LIMITED,
          "Too many requests to Calendar API",
          true,
          getRetryAfterMs(error) || 60 * 1000, // Default 1 minute
          error
        );

      case 500:
      case 502:
      case 503:
        return new CalendarError(
          CalendarErrorCode.SERVER_ERROR,
          "Calendar server error",
          true,
          getRetryAfterMs(error) || 5 * 1000, // Default 5 seconds
          error
        );

      default:
        return new CalendarError(
          CalendarErrorCode.UNKNOWN,
          googleError?.message || error.message || "Unknown Calendar API error",
          status ? status >= 500 : false,
          undefined,
          error
        );
    }
  }

  // Handle network errors
  if (isNetworkError(error)) {
    return new CalendarError(
      CalendarErrorCode.NETWORK_ERROR,
      "Network error connecting to Calendar API",
      true,
      5 * 1000, // Retry after 5 seconds
      error instanceof Error ? error : undefined
    );
  }

  // Handle timeout errors
  if (isTimeoutError(error)) {
    return new CalendarError(
      CalendarErrorCode.TIMEOUT,
      "Calendar API request timed out",
      true,
      10 * 1000,
      error instanceof Error ? error : undefined
    );
  }

  // Generic error
  return new CalendarError(
    CalendarErrorCode.UNKNOWN,
    error instanceof Error ? error.message : "Unknown error",
    false,
    undefined,
    error instanceof Error ? error : undefined
  );
}

// ─────────────────────────────────────────────────────────────
// Helper Types & Functions
// ─────────────────────────────────────────────────────────────

interface GoogleErrorResponse {
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{
      domain?: string;
      reason?: string;
      message?: string;
    }>;
  };
}

interface GaxiosErrorLike extends Error {
  response?: {
    status?: number;
    data?: unknown;
    headers?: Record<string, string>;
  };
  code?: string;
}

function isGaxiosError(error: unknown): error is GaxiosErrorLike {
  return (
    error instanceof Error &&
    "response" in error &&
    typeof (error as GaxiosErrorLike).response === "object"
  );
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes("network") ||
      error.message.includes("ECONNREFUSED") ||
      error.message.includes("ENOTFOUND") ||
      error.message.includes("EAI_AGAIN") ||
      ("code" in error &&
        typeof (error as NodeJS.ErrnoException).code === "string" &&
        ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT"].includes(
          (error as NodeJS.ErrnoException).code as string
        ))
    );
  }
  return false;
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes("timeout") ||
      error.message.includes("ETIMEDOUT") ||
      ("code" in error && (error as NodeJS.ErrnoException).code === "ETIMEDOUT")
    );
  }
  return false;
}

function getRetryAfterMs(error: GaxiosErrorLike): number | undefined {
  const retryAfter = error.response?.headers?.["retry-after"];
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────
// Error Checking Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Check if an error is a CalendarError
 */
export function isCalendarError(error: unknown): error is CalendarError {
  return error instanceof CalendarError;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (isCalendarError(error)) {
    return error.retryable;
  }
  return false;
}

/**
 * Check if an error indicates token refresh is needed
 */
export function needsTokenRefresh(error: unknown): boolean {
  if (isCalendarError(error)) {
    return error.code === CalendarErrorCode.UNAUTHORIZED;
  }
  return false;
}

/**
 * Check if the error is due to insufficient scopes
 */
export function needsScopeUpgrade(error: unknown): boolean {
  if (isCalendarError(error)) {
    return error.code === CalendarErrorCode.INSUFFICIENT_PERMISSION;
  }
  return false;
}

/**
 * Check if the error indicates sync token has expired
 */
export function isSyncTokenExpired(error: unknown): boolean {
  if (error instanceof CalendarSyncError) {
    return error.syncTokenExpired;
  }
  if (isCalendarError(error)) {
    return error.code === CalendarErrorCode.SYNC_TOKEN_EXPIRED;
  }
  return false;
}

/**
 * Check if the error is a conflict error
 */
export function isConflictError(error: unknown): error is CalendarConflictError {
  return error instanceof CalendarConflictError;
}

