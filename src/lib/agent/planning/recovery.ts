// ═══════════════════════════════════════════════════════════════════════════
// Plan Recovery
// Handles failure recovery with LLM integration for intelligent decision making
// ═══════════════════════════════════════════════════════════════════════════

import { planRepository } from "./repository";
import { PLAN_STATUS, STEP_STATUS } from "../constants";
import { agentLogger } from "../logger";
import { PlanningError } from "./types";
import {
  isTransientError,
  getSuggestedRecoveryAction,
} from "../llm/prompts/recovery";
import type { StructuredPlan, StructuredStep } from "./types";
import type { RecoveryAction } from "../llm/types";
import type { LLMClient } from "../llm/types";

const logger = agentLogger.child("plan-recovery");

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/**
 * Information about a step failure
 */
export interface StepFailure {
  /** Step that failed */
  step: StructuredStep;

  /** Error message from the failure */
  error: string;

  /** Categorized error type */
  errorType: StepErrorType;

  /** Number of retry attempts so far */
  retryCount: number;

  /** Timestamp of the failure */
  failedAt: Date;
}

/**
 * Categorized error types for recovery decisions
 */
export type StepErrorType =
  | "rate_limit"
  | "timeout"
  | "network_error"
  | "service_unavailable"
  | "authentication"
  | "permission"
  | "validation"
  | "not_found"
  | "conflict"
  | "unknown";

/**
 * Result of a recovery attempt
 */
export interface RecoveryResult {
  /** The decision made */
  action: RecoveryAction;

  /** Whether recovery was successful */
  success: boolean;

  /** Whether the plan can continue */
  canContinue: boolean;

  /** If retrying, the modified parameters (if any) */
  modifiedParameters?: Record<string, unknown>;

  /** Message for the user (if action is ask_user) */
  userMessage?: string;

  /** Steps that were rolled back (if action is rollback) */
  rolledBackSteps?: string[];
}

/**
 * Options for recovery
 */
export interface RecoveryOptions {
  /** LLM client for intelligent recovery (optional) */
  llmClient?: LLMClient;

  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;

  /** Whether to use LLM for recovery decisions (default: true if client provided) */
  useLLMRecovery?: boolean;

  /** Always ask user on any failure (default: false) */
  alwaysAskUser?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Main Recovery Functions
// ─────────────────────────────────────────────────────────────

/**
 * Determine recovery action for a failed step
 * 
 * Analyzes the failure and determines the best course of action:
 * - retry: Try the step again (possibly with modified parameters)
 * - skip: Skip the step and continue with the plan
 * - abort: Stop the plan entirely
 * - ask_user: Ask the user for guidance
 * - rollback: Undo completed steps and abort
 * 
 * If an LLM client is provided, it can be used to make more intelligent
 * decisions based on the context.
 * 
 * @param plan - The plan containing the failed step
 * @param failure - Information about the failure
 * @param options - Recovery options
 * @returns Recovery action to take
 */
export async function determineRecoveryAction(
  plan: StructuredPlan,
  failure: StepFailure,
  options: RecoveryOptions = {}
): Promise<RecoveryAction> {
  const {
    llmClient,
    maxRetries = 3,
    useLLMRecovery = llmClient !== undefined,
    alwaysAskUser = false,
  } = options;

  logger.info("Determining recovery action", {
    planId: plan.id,
    stepIndex: failure.step.index,
    errorType: failure.errorType,
    retryCount: failure.retryCount,
    useLLM: useLLMRecovery,
  });

  // If always ask user, return immediately
  if (alwaysAskUser) {
    return {
      action: "ask_user",
      reasoning: "User preference is to always be consulted on failures",
      userMessage: buildUserPrompt(plan, failure),
      confidence: 1.0,
    };
  }

  // Check if we should use LLM for recovery
  if (useLLMRecovery && llmClient) {
    try {
      const llmAction = await llmClient.decideRecovery({
        plan: {
          goal: plan.goal,
          steps: plan.steps.map((s) => ({
            order: s.index,
            toolName: s.toolName,
            description: s.description,
            parameters: s.parameters,
            dependsOn: s.dependsOnIndices,
            requiresApproval: s.requiresApproval,
          })),
          currentStepIndex: failure.step.index,
        },
        failure: {
          stepIndex: failure.step.index,
          error: failure.error,
          errorType: failure.errorType,
        },
        retryCount: failure.retryCount,
      });

      logger.info("LLM recovery decision", {
        planId: plan.id,
        action: llmAction.action,
        confidence: llmAction.confidence,
      });

      // Validate retry count if LLM suggests retry
      if (llmAction.action === "retry" && failure.retryCount >= maxRetries) {
        return {
          action: "ask_user",
          reasoning: `Maximum retry attempts (${maxRetries}) exceeded. Asking user for guidance.`,
          userMessage: buildUserPrompt(plan, failure),
          confidence: 0.8,
        };
      }

      return llmAction;
    } catch (error) {
      logger.warn("LLM recovery failed, falling back to heuristics", {
        error: error instanceof Error ? error.message : String(error),
      });
      // Fall through to heuristic recovery
    }
  }

  // Use heuristic recovery
  return determineRecoveryHeuristic(plan, failure, maxRetries);
}

/**
 * Determine recovery action using heuristics (no LLM)
 * 
 * Uses error type classification and step criticality to decide.
 */
function determineRecoveryHeuristic(
  plan: StructuredPlan,
  failure: StepFailure,
  maxRetries: number
): RecoveryAction {
  const { step, errorType, retryCount } = failure;

  logger.debug("Using heuristic recovery", {
    errorType,
    retryCount,
    stepCritical: isStepCritical(plan, step),
  });

  // Check retry limit
  if (retryCount >= maxRetries) {
    return {
      action: "ask_user",
      reasoning: `Maximum retry attempts (${maxRetries}) exceeded`,
      userMessage: buildUserPrompt(plan, failure),
      confidence: 0.8,
    };
  }

  // Get suggested action based on error type
  const suggestedAction = getSuggestedRecoveryAction(errorType, retryCount);

  // Transient errors should be retried
  if (isTransientError(errorType) && retryCount < maxRetries) {
    return {
      action: "retry",
      reasoning: `Error type "${errorType}" appears transient. Retrying (attempt ${retryCount + 1}/${maxRetries}).`,
      confidence: 0.7,
    };
  }

  // For non-critical steps, we might be able to skip
  if (!isStepCritical(plan, step) && suggestedAction !== "retry") {
    // Check if skipping would break dependencies
    if (canSkipStep(plan, step)) {
      return {
        action: "skip",
        reasoning: `Step is not critical to the goal and can be skipped safely.`,
        confidence: 0.6,
      };
    }
  }

  // Check if we have rollbackable steps
  const rollbackableSteps = plan.steps.filter(
    (s) =>
      s.status === STEP_STATUS.COMPLETED &&
      s.rollbackAction !== undefined
  );

  // For critical steps with failed state, consider rollback
  if (
    isStepCritical(plan, step) &&
    rollbackableSteps.length > 0 &&
    errorType !== "rate_limit" &&
    errorType !== "timeout"
  ) {
    // Only suggest rollback if there's significant completed work
    if (rollbackableSteps.length >= 2) {
      return {
        action: "ask_user",
        reasoning: `Critical step failed after completing ${rollbackableSteps.length} steps. User should decide whether to rollback.`,
        userMessage: buildRollbackPrompt(plan, failure, rollbackableSteps),
        confidence: 0.5,
      };
    }
  }

  // Default to asking user
  return {
    action: suggestedAction,
    reasoning: `Error type "${errorType}" requires user guidance.`,
    userMessage:
      suggestedAction === "ask_user" ? buildUserPrompt(plan, failure) : undefined,
    confidence: 0.5,
  };
}

/**
 * Execute the recovery action
 * 
 * Applies the recovery decision and returns the result.
 * 
 * @param plan - The plan to recover
 * @param failure - The failure that occurred
 * @param action - The recovery action to take
 * @returns Recovery result
 */
export async function executeRecovery(
  plan: StructuredPlan,
  failure: StepFailure,
  action: RecoveryAction
): Promise<RecoveryResult> {
  logger.info("Executing recovery action", {
    planId: plan.id,
    stepId: failure.step.id,
    action: action.action,
  });

  switch (action.action) {
    case "retry":
      return executeRetryRecovery(plan, failure, action);

    case "skip":
      return executeSkipRecovery(plan, failure);

    case "abort":
      return executeAbortRecovery(plan, failure);

    case "ask_user":
      return executeAskUserRecovery(plan, failure, action);

    case "rollback":
      return executeRollbackRecovery(plan);

    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = action.action;
      throw new PlanningError(
        "invalid_state_transition",
        `Unknown recovery action: ${_exhaustive}`,
        plan.id
      );
  }
}

// ─────────────────────────────────────────────────────────────
// Recovery Action Implementations
// ─────────────────────────────────────────────────────────────

/**
 * Execute retry recovery
 */
async function executeRetryRecovery(
  plan: StructuredPlan,
  failure: StepFailure,
  action: RecoveryAction
): Promise<RecoveryResult> {
  logger.info("Executing retry recovery", { planId: plan.id });

  // Reset step status to pending
  await planRepository.updateStepStatus(failure.step.id, {
    status: STEP_STATUS.PENDING,
    errorMessage: undefined,
  });

  return {
    action,
    success: true,
    canContinue: true,
    modifiedParameters: action.modifiedParameters,
  };
}

/**
 * Execute skip recovery
 */
async function executeSkipRecovery(
  plan: StructuredPlan,
  failure: StepFailure
): Promise<RecoveryResult> {
  logger.info("Executing skip recovery", { planId: plan.id });

  // Mark step as skipped
  await planRepository.skipStep(failure.step.id);

  // Update current step index to next
  await planRepository.updateCurrentStep(plan.id, failure.step.index + 1);

  return {
    action: {
      action: "skip",
      reasoning: "Step skipped to continue plan execution",
      confidence: 0.7,
    },
    success: true,
    canContinue: true,
  };
}

/**
 * Execute abort recovery
 */
async function executeAbortRecovery(
  plan: StructuredPlan,
  failure: StepFailure
): Promise<RecoveryResult> {
  logger.info("Executing abort recovery", { planId: plan.id });

  // Mark plan as failed
  await planRepository.failPlan(plan.id);

  // Skip remaining pending steps
  for (const step of plan.steps) {
    if (step.status === STEP_STATUS.PENDING) {
      await planRepository.skipStep(step.id);
    }
  }

  return {
    action: {
      action: "abort",
      reasoning: `Plan aborted due to step failure: ${failure.error}`,
      confidence: 0.8,
    },
    success: true,
    canContinue: false,
  };
}

/**
 * Execute ask user recovery (pauses for user input)
 */
async function executeAskUserRecovery(
  plan: StructuredPlan,
  _failure: StepFailure,
  action: RecoveryAction
): Promise<RecoveryResult> {
  logger.info("Executing ask user recovery", { planId: plan.id });

  // Pause the plan
  await planRepository.pauseExecution(plan.id);

  return {
    action,
    success: true,
    canContinue: false, // User needs to respond first
    userMessage: action.userMessage,
  };
}

/**
 * Execute rollback recovery
 */
async function executeRollbackRecovery(
  plan: StructuredPlan
): Promise<RecoveryResult> {
  logger.info("Executing rollback recovery", { planId: plan.id });

  // Import rollback function (avoiding circular deps)
  const { rollbackPlan } = await import("./rollback");

  // Execute rollback
  const rollbackResult = await rollbackPlan(plan.id);

  return {
    action: {
      action: "rollback",
      reasoning: "Rolling back completed steps due to critical failure",
      confidence: 0.8,
    },
    success: rollbackResult.success,
    canContinue: false,
    rolledBackSteps: rollbackResult.rolledBackSteps,
  };
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Classify an error message into an error type
 */
export function classifyError(error: string): StepErrorType {
  const lowercaseError = error.toLowerCase();

  // Rate limiting
  if (
    lowercaseError.includes("rate limit") ||
    lowercaseError.includes("too many requests") ||
    lowercaseError.includes("429")
  ) {
    return "rate_limit";
  }

  // Timeout
  if (
    lowercaseError.includes("timeout") ||
    lowercaseError.includes("timed out") ||
    lowercaseError.includes("deadline exceeded")
  ) {
    return "timeout";
  }

  // Network errors
  if (
    lowercaseError.includes("network") ||
    lowercaseError.includes("connection") ||
    lowercaseError.includes("econnrefused") ||
    lowercaseError.includes("enotfound")
  ) {
    return "network_error";
  }

  // Service unavailable
  if (
    lowercaseError.includes("unavailable") ||
    lowercaseError.includes("503") ||
    lowercaseError.includes("service error") ||
    lowercaseError.includes("model_overloaded")
  ) {
    return "service_unavailable";
  }

  // Authentication
  if (
    lowercaseError.includes("auth") ||
    lowercaseError.includes("401") ||
    lowercaseError.includes("unauthorized") ||
    lowercaseError.includes("unauthenticated")
  ) {
    return "authentication";
  }

  // Permission
  if (
    lowercaseError.includes("permission") ||
    lowercaseError.includes("403") ||
    lowercaseError.includes("forbidden") ||
    lowercaseError.includes("access denied")
  ) {
    return "permission";
  }

  // Validation
  if (
    lowercaseError.includes("validation") ||
    lowercaseError.includes("invalid") ||
    lowercaseError.includes("400") ||
    lowercaseError.includes("bad request")
  ) {
    return "validation";
  }

  // Not found
  if (
    lowercaseError.includes("not found") ||
    lowercaseError.includes("404") ||
    lowercaseError.includes("does not exist")
  ) {
    return "not_found";
  }

  // Conflict
  if (
    lowercaseError.includes("conflict") ||
    lowercaseError.includes("409") ||
    lowercaseError.includes("already exists")
  ) {
    return "conflict";
  }

  return "unknown";
}

/**
 * Determine if a step is critical to the plan's goal
 * 
 * A step is critical if:
 * - It's the only step in the plan
 * - Other steps depend on it
 * - It's marked as requiring approval (usually indicates importance)
 */
function isStepCritical(plan: StructuredPlan, step: StructuredStep): boolean {
  // Single step plan - always critical
  if (plan.steps.length === 1) {
    return true;
  }

  // Check if other steps depend on this one
  const hasDependents = plan.steps.some(
    (s) => s.index !== step.index && s.dependsOn.includes(step.id)
  );

  if (hasDependents) {
    return true;
  }

  // Steps requiring approval are usually important
  if (step.requiresApproval) {
    return true;
  }

  // First and last steps are often critical
  if (step.index === 0 || step.index === plan.steps.length - 1) {
    return true;
  }

  return false;
}

/**
 * Check if a step can be safely skipped
 * 
 * A step can be skipped if no other pending steps depend on it.
 */
function canSkipStep(plan: StructuredPlan, step: StructuredStep): boolean {
  // Check if any pending/executing steps depend on this one
  const blocksDependents = plan.steps.some(
    (s) =>
      s.index !== step.index &&
      (s.status === STEP_STATUS.PENDING ||
        s.status === STEP_STATUS.EXECUTING) &&
      s.dependsOn.includes(step.id)
  );

  return !blocksDependents;
}

/**
 * Build a user prompt for the ask_user action
 */
function buildUserPrompt(plan: StructuredPlan, failure: StepFailure): string {
  const step = failure.step;
  return (
    `Step ${step.index + 1} of "${plan.goal}" failed.\n\n` +
    `Action: ${step.toolName}\n` +
    `Description: ${step.description}\n` +
    `Error: ${failure.error}\n\n` +
    `What would you like to do?\n` +
    `- Retry the step\n` +
    `- Skip this step and continue\n` +
    `- Cancel the entire plan${hasRollbackableSteps(plan) ? "\n- Rollback completed steps and cancel" : ""}`
  );
}

/**
 * Build a rollback prompt for the user
 */
function buildRollbackPrompt(
  plan: StructuredPlan,
  failure: StepFailure,
  rollbackableSteps: StructuredStep[]
): string {
  return (
    buildUserPrompt(plan, failure) +
    `\n\n⚠️ ${rollbackableSteps.length} completed step(s) can be undone:\n` +
    rollbackableSteps.map((s) => `- ${s.description}`).join("\n")
  );
}

/**
 * Check if plan has any rollbackable steps
 */
function hasRollbackableSteps(plan: StructuredPlan): boolean {
  return plan.steps.some(
    (s) =>
      s.status === STEP_STATUS.COMPLETED &&
      s.rollbackAction !== undefined
  );
}

/**
 * Create a StepFailure from a step and error
 */
export function createStepFailure(
  step: StructuredStep,
  error: string,
  retryCount: number = 0
): StepFailure {
  return {
    step,
    error,
    errorType: classifyError(error),
    retryCount,
    failedAt: new Date(),
  };
}

