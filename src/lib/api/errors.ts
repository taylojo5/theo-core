// ═══════════════════════════════════════════════════════════════════════════
// API Error Response Helpers
// Standardized error responses across all API routes
// ═══════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────
// Error Codes
// ─────────────────────────────────────────────────────────────

export const ErrorCodes = {
  // Authentication & Authorization
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  CSRF_VALIDATION_FAILED: "CSRF_VALIDATION_FAILED",
  INVALID_TOKEN: "INVALID_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  SCOPE_REQUIRED: "SCOPE_REQUIRED",

  // Validation
  VALIDATION_FAILED: "VALIDATION_FAILED",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",

  // Resource
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  CONFLICT: "CONFLICT",
  GONE: "GONE",

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

  // Server Errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",

  // Gmail-specific
  GMAIL_NOT_CONNECTED: "GMAIL_NOT_CONNECTED",
  GMAIL_TOKEN_EXPIRED: "GMAIL_TOKEN_EXPIRED",
  GMAIL_SYNC_FAILED: "GMAIL_SYNC_FAILED",
  GMAIL_SEND_FAILED: "GMAIL_SEND_FAILED",
  APPROVAL_EXPIRED: "APPROVAL_EXPIRED",
  APPROVAL_ALREADY_PROCESSED: "APPROVAL_ALREADY_PROCESSED",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// ─────────────────────────────────────────────────────────────
// Error Response Interface
// ─────────────────────────────────────────────────────────────

export interface ApiErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

// ─────────────────────────────────────────────────────────────
// Error Response Factory
// ─────────────────────────────────────────────────────────────

interface ErrorOptions {
  code: ErrorCode;
  message: string;
  status: number;
  details?: unknown;
  headers?: HeadersInit;
}

/**
 * Create a standardized API error response
 */
export function apiError({
  code,
  message,
  status,
  details,
  headers,
}: ErrorOptions): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = {
    error: {
      code,
      message,
      ...(details !== undefined && { details }),
    },
  };

  return NextResponse.json(body, { status, headers });
}

// ─────────────────────────────────────────────────────────────
// Common Error Responses
// ─────────────────────────────────────────────────────────────

/**
 * 401 Unauthorized - User is not authenticated
 */
export function unauthorized(
  message = "Authentication required",
  headers?: HeadersInit
): NextResponse<ApiErrorResponse> {
  return apiError({
    code: ErrorCodes.UNAUTHORIZED,
    message,
    status: 401,
    headers,
  });
}

/**
 * 403 Forbidden - User lacks permission
 */
export function forbidden(
  message = "Access denied",
  headers?: HeadersInit
): NextResponse<ApiErrorResponse> {
  return apiError({
    code: ErrorCodes.FORBIDDEN,
    message,
    status: 403,
    headers,
  });
}

/**
 * 404 Not Found - Resource doesn't exist
 */
export function notFound(
  resource = "Resource",
  headers?: HeadersInit
): NextResponse<ApiErrorResponse> {
  return apiError({
    code: ErrorCodes.NOT_FOUND,
    message: `${resource} not found`,
    status: 404,
    headers,
  });
}

/**
 * 400 Bad Request - Validation failed
 */
export function validationError(
  message: string,
  details?: unknown,
  headers?: HeadersInit
): NextResponse<ApiErrorResponse> {
  return apiError({
    code: ErrorCodes.VALIDATION_FAILED,
    message,
    status: 400,
    details,
    headers,
  });
}

/**
 * 409 Conflict - Resource already exists or conflicts
 */
export function conflict(
  message: string,
  headers?: HeadersInit
): NextResponse<ApiErrorResponse> {
  return apiError({
    code: ErrorCodes.CONFLICT,
    message,
    status: 409,
    headers,
  });
}

/**
 * 410 Gone - Resource expired or removed
 */
export function gone(
  message: string,
  headers?: HeadersInit
): NextResponse<ApiErrorResponse> {
  return apiError({
    code: ErrorCodes.GONE,
    message,
    status: 410,
    headers,
  });
}

/**
 * 500 Internal Server Error
 */
export function internalError(
  message = "An unexpected error occurred",
  headers?: HeadersInit
): NextResponse<ApiErrorResponse> {
  return apiError({
    code: ErrorCodes.INTERNAL_ERROR,
    message,
    status: 500,
    headers,
  });
}

/**
 * 503 Service Unavailable
 */
export function serviceUnavailable(
  message = "Service temporarily unavailable",
  headers?: HeadersInit
): NextResponse<ApiErrorResponse> {
  return apiError({
    code: ErrorCodes.SERVICE_UNAVAILABLE,
    message,
    status: 503,
    headers,
  });
}

// ─────────────────────────────────────────────────────────────
// Gmail-specific Errors
// ─────────────────────────────────────────────────────────────

/**
 * Gmail not connected error
 */
export function gmailNotConnected(
  headers?: HeadersInit
): NextResponse<ApiErrorResponse> {
  return apiError({
    code: ErrorCodes.GMAIL_NOT_CONNECTED,
    message: "Gmail not connected or token expired",
    status: 401,
    headers,
  });
}

/**
 * Approval expired error
 */
export function approvalExpired(
  headers?: HeadersInit
): NextResponse<ApiErrorResponse> {
  return apiError({
    code: ErrorCodes.APPROVAL_EXPIRED,
    message: "Approval has expired",
    status: 410,
    headers,
  });
}

// ─────────────────────────────────────────────────────────────
// Error Handler Utility
// ─────────────────────────────────────────────────────────────

/**
 * Convert an unknown error to a standardized API response
 */
export function handleApiError(
  error: unknown,
  headers?: HeadersInit
): NextResponse<ApiErrorResponse> {
  // Already a NextResponse (e.g., from CSRF middleware)
  if (error instanceof NextResponse) {
    return error as NextResponse<ApiErrorResponse>;
  }

  const message = error instanceof Error ? error.message : "Unknown error";

  // Check for common error patterns
  if (message.includes("not found")) {
    return notFound("Resource", headers);
  }
  if (message.includes("expired")) {
    return gone(message, headers);
  }
  if (message.includes("Cannot") || message.includes("already")) {
    return conflict(message, headers);
  }

  return internalError(message, headers);
}
