// ═══════════════════════════════════════════════════════════════════════════
// Tool Execution Engine Types
// Types for executing LLM-selected tools with validation and audit
// ═══════════════════════════════════════════════════════════════════════════

import type { RiskLevel, ToolCategory } from "../constants";
import type { ExecutionContext, ActionApproval } from "../types";

// ─────────────────────────────────────────────────────────────
// Execution Request Types
// ─────────────────────────────────────────────────────────────

/**
 * Request to execute a tool
 * Comes from decision logic after LLM selects a tool
 */
export interface ToolExecutionRequest {
  /** Name of the tool to execute */
  toolName: string;

  /** Parameters provided by the LLM (will be validated) */
  parameters: unknown;

  /** Execution context (user, session, conversation, etc.) */
  context: ExecutionContext;

  /** Decision from routing layer */
  decision: ExecutionDecision;
}

/**
 * Decision from the routing/decision layer
 * Determines how the tool should be executed
 */
export interface ExecutionDecision {
  /** Action to take */
  action: "execute" | "request_approval";

  /** Confidence in this decision */
  confidence: number;

  /** Reasoning for the decision (from LLM) */
  reasoning: string;
}

// ─────────────────────────────────────────────────────────────
// Execution Result Types
// ─────────────────────────────────────────────────────────────

/**
 * Base interface for all execution outcomes
 */
interface ExecutionOutcomeBase {
  /** Audit log ID for this execution */
  auditLogId: string;

  /** Duration of execution in milliseconds */
  durationMs: number;
}

/**
 * Result when tool executes successfully
 */
export interface ToolExecutionSuccess extends ExecutionOutcomeBase {
  /** Indicates successful execution */
  success: true;

  /** Tool execution result data */
  result: unknown;

  /** Whether this action required approval (already granted) */
  approvalRequired: false;
}

/**
 * Result when tool execution fails
 */
export interface ToolExecutionFailure extends ExecutionOutcomeBase {
  /** Indicates failed execution */
  success: false;

  /** Error details */
  error: ToolExecutionError;

  /** No result on failure */
  result?: undefined;
}

/**
 * Result when action requires user approval
 */
export interface PendingApprovalResult extends ExecutionOutcomeBase {
  /** Indicates approval is required */
  success: true;

  /** Action requires approval */
  approvalRequired: true;

  /** ID of the created approval record */
  approvalId: string;

  /** When the approval expires */
  expiresAt: Date;

  /** Summary of what needs approval */
  approvalSummary: ApprovalSummary;
}

/**
 * Summary of an action pending approval
 */
export interface ApprovalSummary {
  /** Tool name */
  toolName: string;

  /** Human-readable description of the action */
  actionDescription: string;

  /** Risk level of the action */
  riskLevel: RiskLevel;

  /** Agent's reasoning for proposing this action */
  reasoning: string;

  /** Key parameters (sanitized for display) */
  keyParameters: Record<string, unknown>;
}

/**
 * Union type for all possible execution outcomes
 */
export type ExecutionOutcome =
  | ToolExecutionSuccess
  | ToolExecutionFailure
  | PendingApprovalResult;

// ─────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────

/**
 * Error codes for tool execution failures
 */
export type ExecutionErrorCode =
  | "tool_not_found"
  | "validation_failed"
  | "integration_missing"
  | "execution_failed"
  | "permission_denied"
  | "rate_limited"
  | "timeout";

/**
 * Detailed error information for failed executions
 */
export interface ToolExecutionError {
  /** Error code for programmatic handling */
  code: ExecutionErrorCode;

  /** Human-readable error message */
  message: string;

  /** Additional error details */
  details?: ErrorDetails;

  /** Whether this error is retryable */
  retryable: boolean;
}

/**
 * Additional error details depending on error type
 */
export type ErrorDetails =
  | ValidationErrorDetails
  | IntegrationErrorDetails
  | ExecutionErrorDetails;

/**
 * Details for validation errors (provides info for LLM retry)
 */
export interface ValidationErrorDetails {
  type: "validation";
  /** Field-level validation errors */
  fieldErrors: FieldValidationError[];
  /** LLM-friendly error message for retry */
  llmFriendlyMessage: string;
}

/**
 * A single field validation error
 */
export interface FieldValidationError {
  /** Path to the field (e.g., "attendees[0].email") */
  path: string;
  /** What's wrong with the field */
  message: string;
  /** Expected type/format */
  expected?: string;
  /** What was received */
  received?: string;
}

/**
 * Details for missing integration errors
 */
export interface IntegrationErrorDetails {
  type: "integration";
  /** Required integrations that are missing */
  missingIntegrations: string[];
  /** How to connect the missing integrations */
  connectionInstructions: string;
}

/**
 * Details for general execution errors
 */
export interface ExecutionErrorDetails {
  type: "execution";
  /** Original error message if available */
  originalError?: string;
  /** Stack trace (only in development) */
  stack?: string;
}

// ─────────────────────────────────────────────────────────────
// Integration Check Types
// ─────────────────────────────────────────────────────────────

/**
 * Result of checking if required integrations are connected
 */
export type IntegrationCheckResult =
  | { available: true }
  | { available: false; missing: string[] };

// ─────────────────────────────────────────────────────────────
// Validation Types
// ─────────────────────────────────────────────────────────────

/**
 * Result of validating tool parameters
 */
export type ParameterValidationResult<T = unknown> =
  | { valid: true; parsed: T }
  | { valid: false; errors: FieldValidationError[] };

// ─────────────────────────────────────────────────────────────
// Result Formatting Types
// ─────────────────────────────────────────────────────────────

/**
 * Formatted result for LLM response generation
 */
export interface FormattedExecutionResult {
  /** Whether the action was successful */
  success: boolean;

  /** Human-readable summary of what happened */
  summary: string;

  /** Detailed result (for complex queries) */
  details?: unknown;

  /** Suggested follow-up actions */
  suggestedFollowUps?: string[];

  /** Whether the user should be notified of anything */
  userNotification?: string;

  /** Metadata for the response builder */
  metadata: ResultMetadata;
}

/**
 * Metadata about the execution for response building
 */
export interface ResultMetadata {
  /** Tool that was executed */
  toolName: string;

  /** Category of the tool */
  toolCategory: ToolCategory;

  /** Audit log ID */
  auditLogId: string;

  /** Execution duration */
  durationMs: number;

  /** Whether approval was required */
  requiredApproval: boolean;

  /** Approval ID if pending approval */
  approvalId?: string;
}

// ─────────────────────────────────────────────────────────────
// Approval Creation Types
// ─────────────────────────────────────────────────────────────

/**
 * Input for creating an approval record
 */
export interface ApprovalCreationInput {
  /** User ID */
  userId: string;

  /** Tool name */
  toolName: string;

  /** Validated parameters */
  parameters: Record<string, unknown>;

  /** Action type (from tool category) */
  actionType: string;

  /** Risk level */
  riskLevel: RiskLevel;

  /** Agent's reasoning */
  reasoning: string;

  /** Conversation context (if any) */
  conversationId?: string;

  /** Plan context (if any) */
  planId?: string;

  /** Step index (if executing as part of a plan) */
  stepIndex?: number;

  /** Expiration duration in milliseconds (default from config) */
  expiresInMs?: number;
}

/**
 * Result of creating an approval record
 */
export interface ApprovalCreationResult {
  /** Created approval record */
  approval: ActionApproval;

  /** Audit log ID */
  auditLogId: string;
}

// ─────────────────────────────────────────────────────────────
// Helper Type Guards
// ─────────────────────────────────────────────────────────────

/**
 * Type guard to check if outcome is a successful execution
 */
export function isSuccessfulExecution(
  outcome: ExecutionOutcome
): outcome is ToolExecutionSuccess {
  return outcome.success && !("approvalRequired" in outcome && outcome.approvalRequired);
}

/**
 * Type guard to check if outcome is a failed execution
 */
export function isFailedExecution(
  outcome: ExecutionOutcome
): outcome is ToolExecutionFailure {
  return !outcome.success;
}

/**
 * Type guard to check if outcome is pending approval
 */
export function isPendingApproval(
  outcome: ExecutionOutcome
): outcome is PendingApprovalResult {
  return outcome.success && "approvalRequired" in outcome && outcome.approvalRequired;
}

/**
 * Type guard to check if error details are validation errors
 */
export function isValidationError(
  details: ErrorDetails | undefined
): details is ValidationErrorDetails {
  return details?.type === "validation";
}

/**
 * Type guard to check if error details are integration errors
 */
export function isIntegrationError(
  details: ErrorDetails | undefined
): details is IntegrationErrorDetails {
  return details?.type === "integration";
}


