// ═══════════════════════════════════════════════════════════════════════════
// Error Handler Utilities
// Standardized error handling for the application
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Structured application error
 */
export interface AppError {
  code: string;
  message: string;
  details?: unknown;
  timestamp: Date;
}

/**
 * Create a structured application error
 */
export function createAppError(
  code: string,
  message: string,
  details?: unknown
): AppError {
  return {
    code,
    message,
    details,
    timestamp: new Date(),
  };
}

/**
 * Log an error with structured context
 * In production, this would send to an error tracking service (Sentry, etc.)
 */
export function logError(
  error: AppError | Error,
  context?: Record<string, unknown>
) {
  const errorData =
    error instanceof Error
      ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        }
      : error;

  console.error("[Error]", {
    ...errorData,
    ...context,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });

  // TODO: In production, send to error tracking service
  // if (process.env.NODE_ENV === 'production') {
  //   Sentry.captureException(error, { extra: context });
  // }
}

/**
 * Standard API error response helper
 */
export function apiErrorResponse(
  code: string,
  message: string,
  status: number = 500
): Response {
  return Response.json(
    {
      error: {
        code,
        message,
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}

/**
 * Common API error codes
 */
export const API_ERRORS = {
  UNAUTHORIZED: {
    code: "UNAUTHORIZED",
    message: "Authentication required",
    status: 401,
  },
  FORBIDDEN: { code: "FORBIDDEN", message: "Access denied", status: 403 },
  NOT_FOUND: { code: "NOT_FOUND", message: "Resource not found", status: 404 },
  VALIDATION_ERROR: {
    code: "VALIDATION_ERROR",
    message: "Invalid request data",
    status: 400,
  },
  RATE_LIMIT_EXCEEDED: {
    code: "RATE_LIMIT_EXCEEDED",
    message: "Too many requests",
    status: 429,
  },
  INTERNAL_ERROR: {
    code: "INTERNAL_ERROR",
    message: "Internal server error",
    status: 500,
  },
} as const;

/**
 * Create a standard API error response from a predefined error
 */
export function apiError(
  errorType: keyof typeof API_ERRORS,
  customMessage?: string
): Response {
  const { code, message, status } = API_ERRORS[errorType];
  return apiErrorResponse(code, customMessage || message, status);
}

/**
 * Safe JSON parse with error handling
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Wrap an async function with error logging
 */
export function withErrorLogging<
  T extends (...args: unknown[]) => Promise<unknown>,
>(fn: T, context?: Record<string, unknown>): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      logError(
        error instanceof Error ? error : new Error(String(error)),
        context
      );
      throw error;
    }
  }) as T;
}

/**
 * Check if an error is an instance of a specific error type
 */
export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    "timestamp" in error
  );
}
