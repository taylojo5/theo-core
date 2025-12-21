// ═══════════════════════════════════════════════════════════════════════════
// API Utilities
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Error codes
  ErrorCodes,
  type ErrorCode,
  type ApiErrorResponse,
  // Error factory
  apiError,
  // Common errors
  unauthorized,
  forbidden,
  notFound,
  validationError,
  conflict,
  gone,
  internalError,
  serviceUnavailable,
  // Gmail errors
  gmailNotConnected,
  approvalExpired,
  // Handler utility
  handleApiError,
} from "./errors";
