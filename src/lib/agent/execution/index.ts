// ═══════════════════════════════════════════════════════════════════════════
// Tool Execution Engine Module
// Executes LLM-selected tools with validation, approval, and audit
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Request types
  ToolExecutionRequest,
  ExecutionDecision,

  // Result types
  ExecutionOutcome,
  ToolExecutionSuccess,
  ToolExecutionFailure,
  PendingApprovalResult,
  ApprovalSummary,

  // Error types
  ExecutionErrorCode,
  ToolExecutionError,
  ErrorDetails,
  ValidationErrorDetails,
  IntegrationErrorDetails,
  ExecutionErrorDetails,
  FieldValidationError,

  // Check types
  IntegrationCheckResult,
  ParameterValidationResult,

  // Formatting types
  FormattedExecutionResult,
  ResultMetadata,

  // Approval types
  ApprovalCreationInput,
  ApprovalCreationResult,
} from "./types";

// Type guards
export {
  isSuccessfulExecution,
  isFailedExecution,
  isPendingApproval,
  isValidationError,
  isIntegrationError,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Execution Engine
// ─────────────────────────────────────────────────────────────

export {
  // Main execution function
  executeToolCall,

  // Validation function
  validateParameters,

  // Integration check
  checkIntegrations,
} from "./engine";

// ─────────────────────────────────────────────────────────────
// Approval Management
// ─────────────────────────────────────────────────────────────

export {
  // Create approval
  createPendingApproval,

  // Query approvals
  getPendingApproval,
  listPendingApprovals,

  // Update approvals
  updateApprovalStatus,
  expireApprovals,

  // Utilities
  getDefaultExpirationMs,
} from "./approval";

// ─────────────────────────────────────────────────────────────
// Result Formatting
// ─────────────────────────────────────────────────────────────

export {
  // Main formatters
  formatExecutionResult,
  formatErrorResult,

  // Utilities
  extractResultHighlights,
  truncateResultForDisplay,
} from "./result-formatter";


