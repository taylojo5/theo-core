// ═══════════════════════════════════════════════════════════════════════════
// Gmail Error Types
// Comprehensive error handling for Gmail API operations
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gmail-specific error codes
 */
export enum GmailErrorCode {
  /** Token is invalid or expired */
  UNAUTHORIZED = "UNAUTHORIZED",
  /** Request was rate limited by Gmail API */
  RATE_LIMITED = "RATE_LIMITED",
  /** Daily quota exceeded */
  QUOTA_EXCEEDED = "QUOTA_EXCEEDED",
  /** Resource (message, thread, label) not found */
  NOT_FOUND = "NOT_FOUND",
  /** Invalid request parameters */
  INVALID_REQUEST = "INVALID_REQUEST",
  /** Network connectivity issue */
  NETWORK_ERROR = "NETWORK_ERROR",
  /** User does not have required scope */
  INSUFFICIENT_PERMISSION = "INSUFFICIENT_PERMISSION",
  /** Gmail API returned unexpected error */
  UNKNOWN = "UNKNOWN",
  /** Request timed out */
  TIMEOUT = "TIMEOUT",
  /** Server error from Gmail */
  SERVER_ERROR = "SERVER_ERROR",
  /** Gmail account not found or not accessible */
  ACCOUNT_NOT_FOUND = "ACCOUNT_NOT_FOUND",
}

/**
 * Gmail API error with retry information
 */
export class GmailError extends Error {
  constructor(
    public readonly code: GmailErrorCode,
    message: string,
    public readonly retryable: boolean = false,
    public readonly retryAfterMs?: number,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = "GmailError";
    Object.setPrototypeOf(this, GmailError.prototype);
  }

  /**
   * Create a string representation of the error
   */
  toString(): string {
    let str = `GmailError [${this.code}]: ${this.message}`;
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

// ─────────────────────────────────────────────────────────────
// Error Factory Functions
// ─────────────────────────────────────────────────────────────

/**
 * Parse a Google API error and convert to GmailError
 */
export function parseGoogleApiError(error: unknown): GmailError {
  // Handle GaxiosError from googleapis
  if (isGaxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data as GoogleErrorResponse | undefined;
    const googleError = data?.error;

    switch (status) {
      case 401:
        return new GmailError(
          GmailErrorCode.UNAUTHORIZED,
          "Access token is invalid or expired",
          true, // Can retry after token refresh
          undefined,
          error
        );

      case 403:
        if (googleError?.message?.includes("rate limit")) {
          return new GmailError(
            GmailErrorCode.RATE_LIMITED,
            "Gmail API rate limit exceeded",
            true,
            getRetryAfterMs(error),
            error
          );
        }
        if (googleError?.message?.includes("quota")) {
          return new GmailError(
            GmailErrorCode.QUOTA_EXCEEDED,
            "Gmail API daily quota exceeded",
            true,
            getRetryAfterMs(error) || 60 * 60 * 1000, // Default 1 hour
            error
          );
        }
        return new GmailError(
          GmailErrorCode.INSUFFICIENT_PERMISSION,
          googleError?.message ||
            "Insufficient permission to perform this action",
          false,
          undefined,
          error
        );

      case 404:
        return new GmailError(
          GmailErrorCode.NOT_FOUND,
          googleError?.message || "Resource not found",
          false,
          undefined,
          error
        );

      case 400:
        return new GmailError(
          GmailErrorCode.INVALID_REQUEST,
          googleError?.message || "Invalid request",
          false,
          undefined,
          error
        );

      case 429:
        return new GmailError(
          GmailErrorCode.RATE_LIMITED,
          "Too many requests to Gmail API",
          true,
          getRetryAfterMs(error) || 60 * 1000, // Default 1 minute
          error
        );

      case 500:
      case 502:
      case 503:
        return new GmailError(
          GmailErrorCode.SERVER_ERROR,
          "Gmail server error",
          true,
          getRetryAfterMs(error) || 5 * 1000, // Default 5 seconds
          error
        );

      default:
        return new GmailError(
          GmailErrorCode.UNKNOWN,
          googleError?.message || error.message || "Unknown Gmail API error",
          status ? status >= 500 : false,
          undefined,
          error
        );
    }
  }

  // Handle network errors
  if (isNetworkError(error)) {
    return new GmailError(
      GmailErrorCode.NETWORK_ERROR,
      "Network error connecting to Gmail API",
      true,
      5 * 1000, // Retry after 5 seconds
      error instanceof Error ? error : undefined
    );
  }

  // Handle timeout errors
  if (isTimeoutError(error)) {
    return new GmailError(
      GmailErrorCode.TIMEOUT,
      "Gmail API request timed out",
      true,
      10 * 1000,
      error instanceof Error ? error : undefined
    );
  }

  // Generic error
  return new GmailError(
    GmailErrorCode.UNKNOWN,
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
 * Check if an error is a GmailError
 */
export function isGmailError(error: unknown): error is GmailError {
  return error instanceof GmailError;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (isGmailError(error)) {
    return error.retryable;
  }
  return false;
}

/**
 * Check if an error indicates token refresh is needed
 */
export function needsTokenRefresh(error: unknown): boolean {
  if (isGmailError(error)) {
    return error.code === GmailErrorCode.UNAUTHORIZED;
  }
  return false;
}

/**
 * Check if the error is due to insufficient scopes
 */
export function needsScopeUpgrade(error: unknown): boolean {
  if (isGmailError(error)) {
    return error.code === GmailErrorCode.INSUFFICIENT_PERMISSION;
  }
  return false;
}
