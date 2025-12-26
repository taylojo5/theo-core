// ═══════════════════════════════════════════════════════════════════════════
// Agent Engine Error Types
// Comprehensive error handling for the Agent Engine
// ═══════════════════════════════════════════════════════════════════════════

import type { RiskLevel } from "./constants";

/**
 * Agent-specific error codes
 */
export enum AgentErrorCode {
  /** User's intent is unclear */
  INTENT_UNCLEAR = "INTENT_UNCLEAR",

  /** Required context is missing */
  CONTEXT_MISSING = "CONTEXT_MISSING",

  /** Tool is not available (not registered or integration not connected) */
  TOOL_NOT_AVAILABLE = "TOOL_NOT_AVAILABLE",

  /** Action approval timed out */
  APPROVAL_TIMEOUT = "APPROVAL_TIMEOUT",

  /** Tool execution failed */
  TOOL_EXECUTION_FAILED = "TOOL_EXECUTION_FAILED",

  /** Plan execution failed */
  PLAN_FAILED = "PLAN_FAILED",

  /** Rate limit exceeded */
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",

  /** Invalid tool parameters */
  INVALID_PARAMETERS = "INVALID_PARAMETERS",

  /** Required integration not connected */
  INTEGRATION_NOT_CONNECTED = "INTEGRATION_NOT_CONNECTED",

  /** LLM request failed */
  LLM_ERROR = "LLM_ERROR",

  /** LLM request timed out */
  LLM_TIMEOUT = "LLM_TIMEOUT",

  /** Content was blocked by safety filters */
  CONTENT_BLOCKED = "CONTENT_BLOCKED",

  /** Conversation not found */
  CONVERSATION_NOT_FOUND = "CONVERSATION_NOT_FOUND",

  /** Plan not found */
  PLAN_NOT_FOUND = "PLAN_NOT_FOUND",

  /** Action not found */
  ACTION_NOT_FOUND = "ACTION_NOT_FOUND",

  /** Invalid plan state for operation */
  INVALID_PLAN_STATE = "INVALID_PLAN_STATE",

  /** Entity resolution failed */
  ENTITY_RESOLUTION_FAILED = "ENTITY_RESOLUTION_FAILED",

  /** Unknown error */
  UNKNOWN = "UNKNOWN",
}

// ─────────────────────────────────────────────────────────────
// Base Agent Error
// ─────────────────────────────────────────────────────────────

/**
 * Base error class for all Agent Engine errors
 */
export class AgentError extends Error {
  constructor(
    public readonly code: AgentErrorCode,
    message: string,
    public readonly retryable: boolean = false,
    public readonly retryAfterMs?: number,
    public readonly userMessage?: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = "AgentError";
    Object.setPrototypeOf(this, AgentError.prototype);
  }

  /**
   * Create a string representation of the error
   */
  toString(): string {
    let str = `AgentError [${this.code}]: ${this.message}`;
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
      userMessage: this.userMessage,
      retryable: this.retryable,
      retryAfterMs: this.retryAfterMs,
    };
  }

  /**
   * Get a user-friendly message for display
   */
  getUserMessage(): string {
    return this.userMessage || this.message;
  }
}

// ─────────────────────────────────────────────────────────────
// Specific Error Classes
// ─────────────────────────────────────────────────────────────

/**
 * Error when the user's intent cannot be understood
 */
export class IntentUnclearError extends AgentError {
  constructor(
    message: string,
    public readonly clarificationQuestions: string[] = [],
    public readonly confidence?: number,
    originalError?: Error
  ) {
    super(
      AgentErrorCode.INTENT_UNCLEAR,
      message,
      false, // Not retryable without user clarification
      undefined,
      "I'm not sure I understand what you're asking. Could you please clarify?",
      originalError
    );
    this.name = "IntentUnclearError";
    Object.setPrototypeOf(this, IntentUnclearError.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      clarificationQuestions: this.clarificationQuestions,
      confidence: this.confidence,
    };
  }
}

/**
 * Error when required context is missing
 */
export class ContextMissingError extends AgentError {
  constructor(
    message: string,
    public readonly missingContextTypes: string[],
    public readonly suggestion?: string,
    originalError?: Error
  ) {
    super(
      AgentErrorCode.CONTEXT_MISSING,
      message,
      false,
      undefined,
      suggestion || "I don't have enough information to help with that.",
      originalError
    );
    this.name = "ContextMissingError";
    Object.setPrototypeOf(this, ContextMissingError.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      missingContextTypes: this.missingContextTypes,
      suggestion: this.suggestion,
    };
  }
}

/**
 * Error when a required tool is not available
 */
export class ToolNotAvailableError extends AgentError {
  constructor(
    message: string,
    public readonly toolName: string,
    public readonly reason: "not_registered" | "integration_not_connected" | "disabled",
    public readonly requiredIntegration?: string,
    originalError?: Error
  ) {
    const userMessage =
      reason === "integration_not_connected" && requiredIntegration
        ? `This action requires connecting your ${requiredIntegration}. Please connect it in Settings.`
        : "This action is not currently available.";

    super(
      AgentErrorCode.TOOL_NOT_AVAILABLE,
      message,
      false,
      undefined,
      userMessage,
      originalError
    );
    this.name = "ToolNotAvailableError";
    Object.setPrototypeOf(this, ToolNotAvailableError.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      toolName: this.toolName,
      reason: this.reason,
      requiredIntegration: this.requiredIntegration,
    };
  }
}

/**
 * Error when an action approval times out
 */
export class ApprovalTimeoutError extends AgentError {
  constructor(
    message: string,
    public readonly actionId: string,
    public readonly toolName: string,
    public readonly expiresAt: Date,
    originalError?: Error
  ) {
    super(
      AgentErrorCode.APPROVAL_TIMEOUT,
      message,
      true, // Can retry by re-requesting approval
      undefined,
      "The action request has expired. Would you like me to try again?",
      originalError
    );
    this.name = "ApprovalTimeoutError";
    Object.setPrototypeOf(this, ApprovalTimeoutError.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      actionId: this.actionId,
      toolName: this.toolName,
      expiresAt: this.expiresAt.toISOString(),
    };
  }
}

/**
 * Error when tool execution fails
 */
export class ToolExecutionFailedError extends AgentError {
  constructor(
    message: string,
    public readonly toolName: string,
    public readonly toolParams: Record<string, unknown>,
    public readonly executionError: string,
    public readonly canRetry: boolean = false,
    originalError?: Error
  ) {
    super(
      AgentErrorCode.TOOL_EXECUTION_FAILED,
      message,
      canRetry,
      canRetry ? 5000 : undefined,
      `I couldn't complete that action. ${executionError}`,
      originalError
    );
    this.name = "ToolExecutionFailedError";
    Object.setPrototypeOf(this, ToolExecutionFailedError.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      toolName: this.toolName,
      // Don't include toolParams in JSON to avoid logging sensitive data
      executionError: this.executionError,
      canRetry: this.canRetry,
    };
  }
}

/**
 * Error when a multi-step plan fails
 */
export class PlanFailedError extends AgentError {
  constructor(
    message: string,
    public readonly planId: string,
    public readonly failedStepIndex: number,
    public readonly failedToolName: string,
    public readonly stepError: string,
    public readonly completedSteps: number,
    public readonly totalSteps: number,
    public readonly canRollback: boolean = false,
    public readonly rolledBack: boolean = false,
    originalError?: Error
  ) {
    const userMessage = rolledBack
      ? `The plan failed at step ${failedStepIndex + 1} of ${totalSteps}. I've undone the previous steps.`
      : `The plan failed at step ${failedStepIndex + 1} of ${totalSteps}. ${stepError}`;

    super(
      AgentErrorCode.PLAN_FAILED,
      message,
      false, // Plans should not auto-retry
      undefined,
      userMessage,
      originalError
    );
    this.name = "PlanFailedError";
    Object.setPrototypeOf(this, PlanFailedError.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      planId: this.planId,
      failedStepIndex: this.failedStepIndex,
      failedToolName: this.failedToolName,
      stepError: this.stepError,
      completedSteps: this.completedSteps,
      totalSteps: this.totalSteps,
      canRollback: this.canRollback,
      rolledBack: this.rolledBack,
    };
  }
}

/**
 * Error when rate limit is exceeded
 */
export class RateLimitExceededError extends AgentError {
  constructor(
    message: string,
    public readonly limitType: "chat" | "actions" | "llm_tokens" | "external_calls",
    public readonly limit: number,
    public readonly windowMs: number,
    public readonly resetAt: Date,
    originalError?: Error
  ) {
    const retryAfterMs = Math.max(0, resetAt.getTime() - Date.now());
    const minutes = Math.ceil(retryAfterMs / 60000);

    super(
      AgentErrorCode.RATE_LIMIT_EXCEEDED,
      message,
      true, // Retryable after waiting
      retryAfterMs,
      `You've reached the limit for this action. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      originalError
    );
    this.name = "RateLimitExceededError";
    Object.setPrototypeOf(this, RateLimitExceededError.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      limitType: this.limitType,
      limit: this.limit,
      windowMs: this.windowMs,
      resetAt: this.resetAt.toISOString(),
    };
  }
}

/**
 * Error when tool parameters are invalid
 */
export class InvalidParametersError extends AgentError {
  constructor(
    message: string,
    public readonly toolName: string,
    public readonly validationErrors: Array<{
      field: string;
      message: string;
      code?: string;
    }>,
    originalError?: Error
  ) {
    super(
      AgentErrorCode.INVALID_PARAMETERS,
      message,
      false,
      undefined,
      "I encountered an issue with the action parameters. Please try rephrasing your request.",
      originalError
    );
    this.name = "InvalidParametersError";
    Object.setPrototypeOf(this, InvalidParametersError.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      toolName: this.toolName,
      validationErrors: this.validationErrors,
    };
  }
}

/**
 * Error when LLM request fails
 */
export class LLMError extends AgentError {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly model: string,
    public readonly isTimeout: boolean = false,
    retryable: boolean = true,
    originalError?: Error
  ) {
    super(
      isTimeout ? AgentErrorCode.LLM_TIMEOUT : AgentErrorCode.LLM_ERROR,
      message,
      retryable,
      retryable ? 5000 : undefined,
      "I'm having trouble processing your request right now. Please try again.",
      originalError
    );
    this.name = "LLMError";
    Object.setPrototypeOf(this, LLMError.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      provider: this.provider,
      model: this.model,
      isTimeout: this.isTimeout,
    };
  }
}

/**
 * Error when content is blocked by safety filters
 */
export class ContentBlockedError extends AgentError {
  constructor(
    message: string,
    public readonly blockedReasons: string[],
    public readonly isInput: boolean = true,
    originalError?: Error
  ) {
    super(
      AgentErrorCode.CONTENT_BLOCKED,
      message,
      false,
      undefined,
      isInput
        ? "I'm not able to help with that request."
        : "I'm unable to generate a response for that request.",
      originalError
    );
    this.name = "ContentBlockedError";
    Object.setPrototypeOf(this, ContentBlockedError.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      blockedReasons: this.blockedReasons,
      isInput: this.isInput,
    };
  }
}

/**
 * Error when entity resolution fails
 */
export class EntityResolutionError extends AgentError {
  constructor(
    message: string,
    public readonly entityType: string,
    public readonly entityText: string,
    public readonly candidates?: Array<{
      id: string;
      name: string;
      confidence: number;
    }>,
    originalError?: Error
  ) {
    let userMessage: string;
    if (candidates && candidates.length > 1) {
      userMessage = `I found multiple matches for "${entityText}". Could you be more specific?`;
    } else if (candidates && candidates.length === 1) {
      userMessage = `I found "${entityText}" but couldn't confirm it's the right one. Could you verify?`;
    } else {
      userMessage = `I couldn't find "${entityText}" in your data.`;
    }

    super(
      AgentErrorCode.ENTITY_RESOLUTION_FAILED,
      message,
      false,
      undefined,
      userMessage,
      originalError
    );
    this.name = "EntityResolutionError";
    Object.setPrototypeOf(this, EntityResolutionError.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      entityType: this.entityType,
      entityText: this.entityText,
      candidateCount: this.candidates?.length ?? 0,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Error Checking Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Check if an error is an AgentError
 */
export function isAgentError(error: unknown): error is AgentError {
  return error instanceof AgentError;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (isAgentError(error)) {
    return error.retryable;
  }
  return false;
}

/**
 * Check if an error requires user clarification
 */
export function needsClarification(error: unknown): error is IntentUnclearError {
  return error instanceof IntentUnclearError;
}

/**
 * Check if an error requires connecting an integration
 */
export function needsIntegration(
  error: unknown
): error is ToolNotAvailableError {
  return (
    error instanceof ToolNotAvailableError &&
    error.reason === "integration_not_connected"
  );
}

/**
 * Wrap an unknown error in an AgentError
 */
export function wrapError(error: unknown, context?: string): AgentError {
  if (isAgentError(error)) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const contextPrefix = context ? `${context}: ` : "";

  return new AgentError(
    AgentErrorCode.UNKNOWN,
    `${contextPrefix}${message}`,
    false,
    undefined,
    "An unexpected error occurred. Please try again.",
    error instanceof Error ? error : undefined
  );
}


