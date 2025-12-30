// ═══════════════════════════════════════════════════════════════════════════
// Plan Rollback
// Handles rolling back completed steps when a plan fails or is cancelled
// ═══════════════════════════════════════════════════════════════════════════

import { planRepository } from "./repository";
import { PLAN_STATUS, STEP_STATUS } from "../constants";
import { agentLogger } from "../logger";
import { PlanningError } from "./types";
import { executeToolCall } from "../execution/engine";
import { toolRegistry } from "../tools/registry";
import type { StructuredPlan, StructuredStep, RollbackAction } from "./types";
import type { ExecutionContext } from "../types";

const logger = agentLogger.child("plan-rollback");

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/**
 * Result of a plan rollback operation
 */
export interface RollbackResult {
  /** Plan ID */
  planId: string;

  /** Whether the rollback was successful */
  success: boolean;

  /** Total number of steps that could be rolled back */
  totalRollbackable: number;

  /** Number of steps successfully rolled back */
  rolledBackCount: number;

  /** IDs of steps that were rolled back */
  rolledBackSteps: string[];

  /** IDs of steps that failed to rollback */
  failedSteps: string[];

  /** Error messages for failed rollbacks */
  errors: RollbackError[];

  /** Total duration of rollback operation in milliseconds */
  durationMs: number;
}

/**
 * Error during rollback
 */
export interface RollbackError {
  /** Step ID that failed */
  stepId: string;

  /** Step index */
  stepIndex: number;

  /** Tool that was used for rollback */
  toolName: string;

  /** Error message */
  error: string;
}

/**
 * Options for rollback
 */
export interface RollbackOptions {
  /** Execution context for tool calls */
  context?: ExecutionContext;

  /** Whether to continue on error (default: true) */
  continueOnError?: boolean;

  /** Specific step IDs to rollback (default: all rollbackable) */
  stepIds?: string[];

  /** Dry run - don't actually execute rollbacks */
  dryRun?: boolean;
}

/**
 * Result of analyzing rollback capability
 */
export interface RollbackAnalysis {
  /** Plan ID */
  planId: string;

  /** Whether any steps can be rolled back */
  canRollback: boolean;

  /** Steps that can be rolled back */
  rollbackableSteps: RollbackableStep[];

  /** Steps that cannot be rolled back */
  nonRollbackableSteps: NonRollbackableStep[];

  /** Estimated effort level for rollback */
  effort: "none" | "minimal" | "moderate" | "significant";
}

/**
 * A step that can be rolled back
 */
export interface RollbackableStep {
  /** Step ID */
  stepId: string;

  /** Step index */
  index: number;

  /** Tool name */
  toolName: string;

  /** Description */
  description: string;

  /** Rollback action */
  rollbackAction: RollbackAction;
}

/**
 * A step that cannot be rolled back
 */
export interface NonRollbackableStep {
  /** Step ID */
  stepId: string;

  /** Step index */
  index: number;

  /** Tool name */
  toolName: string;

  /** Description */
  description: string;

  /** Reason why it can't be rolled back */
  reason: string;
}

// ─────────────────────────────────────────────────────────────
// Main Rollback Functions
// ─────────────────────────────────────────────────────────────

/**
 * Rollback all completed steps in a plan
 * 
 * Executes rollback actions for each completed step that has one defined,
 * in reverse order (last completed first). Updates step statuses to ROLLED_BACK.
 * 
 * @param planId - ID of the plan to rollback
 * @param options - Rollback options
 * @returns Rollback result
 */
export async function rollbackPlan(
  planId: string,
  options: RollbackOptions = {}
): Promise<RollbackResult> {
  const startTime = Date.now();
  const { continueOnError = true, stepIds, dryRun = false } = options;

  logger.info("Starting plan rollback", { planId, dryRun, stepIds });

  // Load the plan
  const plan = await planRepository.getById(planId);
  if (!plan) {
    throw new PlanningError(
      "plan_not_found",
      `Plan ${planId} not found`,
      planId
    );
  }

  // Get rollbackable steps
  const rollbackableSteps = getRollbackableSteps(plan);

  // Filter by specific step IDs if provided
  const stepsToRollback = stepIds
    ? rollbackableSteps.filter((s) => stepIds.includes(s.id))
    : rollbackableSteps;

  const result: RollbackResult = {
    planId,
    success: true,
    totalRollbackable: stepsToRollback.length,
    rolledBackCount: 0,
    rolledBackSteps: [],
    failedSteps: [],
    errors: [],
    durationMs: 0,
  };

  if (stepsToRollback.length === 0) {
    logger.info("No steps to rollback", { planId });
    result.durationMs = Date.now() - startTime;
    return result;
  }

  // Build execution context
  const context = options.context || buildDefaultContext(plan);

  // Rollback in reverse order (last completed first)
  for (const step of stepsToRollback) {
    try {
      logger.debug("Rolling back step", {
        planId,
        stepId: step.id,
        stepIndex: step.index,
        toolName: step.toolName,
      });

      if (!dryRun) {
        await rollbackStep(step, context);
        await planRepository.rollbackStep(step.id);
      }

      result.rolledBackSteps.push(step.id);
      result.rolledBackCount++;

      logger.info("Step rolled back successfully", {
        planId,
        stepId: step.id,
        stepIndex: step.index,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Step rollback failed", {
        planId,
        stepId: step.id,
        error: errorMessage,
      });

      result.failedSteps.push(step.id);
      result.errors.push({
        stepId: step.id,
        stepIndex: step.index,
        toolName: step.rollbackAction?.toolName || "unknown",
        error: errorMessage,
      });
      result.success = false;

      if (!continueOnError) {
        break;
      }
    }
  }

  // Update plan status if all steps rolled back
  if (result.rolledBackCount > 0 && !dryRun) {
    // Mark remaining pending steps as skipped
    for (const step of plan.steps) {
      if (step.status === STEP_STATUS.PENDING) {
        await planRepository.skipStep(step.id);
      }
    }

    // Mark plan as cancelled
    await planRepository.cancelPlan(planId);
  }

  result.durationMs = Date.now() - startTime;

  logger.info("Plan rollback completed", {
    planId,
    success: result.success,
    rolledBack: result.rolledBackCount,
    failed: result.failedSteps.length,
    durationMs: result.durationMs,
  });

  return result;
}

/**
 * Rollback a single step
 * 
 * Executes the rollback action for a specific step.
 * 
 * @param step - Step to rollback
 * @param context - Execution context
 */
async function rollbackStep(
  step: StructuredStep,
  context: ExecutionContext
): Promise<void> {
  if (!step.rollbackAction) {
    throw new Error(`Step ${step.id} has no rollback action defined`);
  }

  const { toolName, parameters } = step.rollbackAction;

  // Verify tool exists
  const tool = toolRegistry.get(toolName);
  if (!tool) {
    throw new Error(`Rollback tool "${toolName}" not found`);
  }

  // Inject step result into parameters if needed
  const resolvedParams = resolveRollbackParameters(parameters, step);

  logger.debug("Executing rollback action", {
    stepId: step.id,
    toolName,
    parameters: resolvedParams,
  });

  // Execute the rollback tool
  const result = await executeToolCall({
    toolName,
    parameters: resolvedParams,
    context: {
      ...context,
      // Pass original step context for reference
      planId: step.planId,
      stepIndex: step.index,
    },
    decision: {
      action: "execute",
      confidence: 1.0,
      reasoning: `Rolling back step: ${step.description}`,
    },
  });

  if (!result.success) {
    throw new Error(
      `Rollback execution failed: ${"error" in result ? result.error.message : "Unknown error"}`
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Rollback Analysis Functions
// ─────────────────────────────────────────────────────────────

/**
 * Analyze a plan's rollback capability
 * 
 * Returns detailed information about which steps can and cannot
 * be rolled back, and the overall effort required.
 * 
 * @param planId - ID of the plan to analyze
 * @returns Rollback analysis
 */
export async function analyzeRollback(planId: string): Promise<RollbackAnalysis> {
  const plan = await planRepository.getById(planId);
  if (!plan) {
    throw new PlanningError(
      "plan_not_found",
      `Plan ${planId} not found`,
      planId
    );
  }

  return analyzeRollbackForPlan(plan);
}

/**
 * Analyze rollback capability for a plan object
 */
export function analyzeRollbackForPlan(plan: StructuredPlan): RollbackAnalysis {
  const rollbackableSteps: RollbackableStep[] = [];
  const nonRollbackableSteps: NonRollbackableStep[] = [];

  for (const step of plan.steps) {
    if (step.status !== STEP_STATUS.COMPLETED) {
      continue; // Only analyze completed steps
    }

    if (step.rollbackAction) {
      rollbackableSteps.push({
        stepId: step.id,
        index: step.index,
        toolName: step.toolName,
        description: step.description,
        rollbackAction: step.rollbackAction,
      });
    } else {
      nonRollbackableSteps.push({
        stepId: step.id,
        index: step.index,
        toolName: step.toolName,
        description: step.description,
        reason: determineNonRollbackReason(step),
      });
    }
  }

  // Determine effort level
  let effort: RollbackAnalysis["effort"];
  const rollbackableRatio =
    rollbackableSteps.length /
    (rollbackableSteps.length + nonRollbackableSteps.length || 1);

  if (rollbackableSteps.length === 0) {
    effort = "none";
  } else if (rollbackableRatio >= 0.8) {
    effort = "minimal";
  } else if (rollbackableRatio >= 0.5) {
    effort = "moderate";
  } else {
    effort = "significant";
  }

  return {
    planId: plan.id,
    canRollback: rollbackableSteps.length > 0,
    rollbackableSteps,
    nonRollbackableSteps,
    effort,
  };
}

/**
 * Check if a plan can be fully rolled back
 * 
 * Returns true if all completed steps have rollback actions defined.
 */
export function canFullyRollback(plan: StructuredPlan): boolean {
  const completedSteps = plan.steps.filter(
    (s) => s.status === STEP_STATUS.COMPLETED
  );

  if (completedSteps.length === 0) {
    return true; // Nothing to rollback
  }

  return completedSteps.every((s) => s.rollbackAction !== undefined);
}

/**
 * Check if a plan has any rollbackable steps
 */
export function hasRollbackableSteps(plan: StructuredPlan): boolean {
  return plan.steps.some(
    (s) =>
      s.status === STEP_STATUS.COMPLETED &&
      s.rollbackAction !== undefined
  );
}

// ─────────────────────────────────────────────────────────────
// Rollback Action Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Create a rollback action for a create operation
 * 
 * Common pattern: create -> delete
 * 
 * @param deleteToolName - Name of the delete tool
 * @param idParamName - Name of the ID parameter in the delete tool
 * @param idPath - Path to the ID in the create result (e.g., "id", "data.id")
 */
export function createDeleteRollback(
  deleteToolName: string,
  idParamName: string = "id",
  idPath: string = "id"
): RollbackAction {
  return {
    toolName: deleteToolName,
    parameters: {
      [idParamName]: `{{result.${idPath}}}`,
    },
  };
}

/**
 * Create a rollback action for an update operation
 * 
 * Common pattern: update -> restore previous value
 * Requires the step to have stored the previous state.
 * 
 * @param updateToolName - Name of the update tool
 * @param idParamName - Name of the ID parameter
 * @param previousStatePath - Path to previous state in step parameters
 */
export function createRestoreRollback(
  updateToolName: string,
  idParamName: string = "id",
  previousStatePath: string = "_previousState"
): RollbackAction {
  return {
    toolName: updateToolName,
    parameters: {
      [idParamName]: `{{params.${idParamName}}}`,
      ...Object.fromEntries(
        Object.keys({}).map((key) => [
          key,
          `{{params.${previousStatePath}.${key}}}`,
        ])
      ),
    },
  };
}

/**
 * Standard rollback actions for common tools
 */
export const STANDARD_ROLLBACKS: Record<string, RollbackAction> = {
  // Calendar events
  create_calendar_event: createDeleteRollback("delete_calendar_event", "eventId", "eventId"),
  
  // Tasks
  create_task: createDeleteRollback("delete_task", "taskId", "id"),
  
  // Email drafts (can be deleted before sending)
  draft_email: createDeleteRollback("delete_draft", "draftId", "draftId"),
};

/**
 * Get a standard rollback action for a tool if one exists
 */
export function getStandardRollback(toolName: string): RollbackAction | undefined {
  return STANDARD_ROLLBACKS[toolName];
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Get rollbackable steps from a plan in reverse order
 */
function getRollbackableSteps(plan: StructuredPlan): StructuredStep[] {
  return plan.steps
    .filter(
      (s) =>
        s.status === STEP_STATUS.COMPLETED &&
        s.rollbackAction !== undefined
    )
    .sort((a, b) => b.index - a.index); // Reverse order
}

/**
 * Determine why a step cannot be rolled back
 */
function determineNonRollbackReason(step: StructuredStep): string {
  // Check if the tool is known to be non-reversible
  const nonReversibleTools = [
    "send_email", // Can't unsend
    "send_message", // Can't unsend
    "publish", // Usually can't unpublish
  ];

  if (nonReversibleTools.includes(step.toolName)) {
    return "This action type is not reversible";
  }

  // Check for external actions
  const tool = toolRegistry.get(step.toolName);
  if (tool?.riskLevel === "high" || tool?.riskLevel === "critical") {
    return "High-risk external action without defined rollback";
  }

  return "No rollback action defined for this step";
}

// ─────────────────────────────────────────────────────────────
// Path Resolution Security
// ─────────────────────────────────────────────────────────────

/** Allowed root prefixes for path resolution */
const ALLOWED_PATH_ROOTS = ["result", "params"] as const;

/** Maximum depth for path traversal (prevents deep object access) */
const MAX_PATH_DEPTH = 5;

/** Pattern for valid path segment (alphanumeric, underscore, no special chars) */
const VALID_PATH_SEGMENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Validate a template path for security
 * 
 * @param path - The path to validate (e.g., "result.id", "params.taskId")
 * @returns Validation result with error message if invalid
 */
function validateTemplatePath(path: string): { valid: boolean; error?: string } {
  const parts = path.split(".");
  
  // Check path has at least root and one property
  if (parts.length < 2) {
    return { valid: false, error: `Path must have at least root and property: "${path}"` };
  }
  
  // Check root is allowed
  const root = parts[0];
  if (!ALLOWED_PATH_ROOTS.includes(root as typeof ALLOWED_PATH_ROOTS[number])) {
    return { 
      valid: false, 
      error: `Invalid path root "${root}". Allowed: ${ALLOWED_PATH_ROOTS.join(", ")}` 
    };
  }
  
  // Check path depth
  if (parts.length > MAX_PATH_DEPTH) {
    return { 
      valid: false, 
      error: `Path exceeds maximum depth of ${MAX_PATH_DEPTH}: "${path}"` 
    };
  }
  
  // Check each segment is valid (prevents prototype pollution, etc.)
  for (const segment of parts.slice(1)) {
    // Allow numeric indices for array access
    if (/^\d+$/.test(segment)) {
      continue;
    }
    
    if (!VALID_PATH_SEGMENT.test(segment)) {
      return { 
        valid: false, 
        error: `Invalid path segment "${segment}" in "${path}". Must be alphanumeric/underscore.` 
      };
    }
    
    // Block prototype-related properties
    const blocked = ["__proto__", "constructor", "prototype"];
    if (blocked.includes(segment.toLowerCase())) {
      return { 
        valid: false, 
        error: `Blocked path segment "${segment}" in "${path}"` 
      };
    }
  }
  
  return { valid: true };
}

/**
 * Resolve rollback parameters by replacing template expressions
 * 
 * Supports templates like:
 * - {{result.id}} - Value from step result
 * - {{params.fieldName}} - Value from step parameters
 * 
 * Security:
 * - Only allows "result" and "params" as path roots
 * - Limits path depth to prevent deep traversal
 * - Validates path segments to prevent injection
 * - Logs all resolved values for audit
 */
function resolveRollbackParameters(
  parameters: Record<string, unknown>,
  step: StructuredStep
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(parameters)) {
    if (typeof value === "string" && value.startsWith("{{") && value.endsWith("}}")) {
      const path = value.slice(2, -2).trim();
      
      // Validate path before resolution
      const validation = validateTemplatePath(path);
      if (!validation.valid) {
        logger.warn("Invalid rollback template path", {
          stepId: step.id,
          key,
          path,
          error: validation.error,
        });
        throw new Error(`Invalid rollback parameter template: ${validation.error}`);
      }
      
      const resolvedValue = resolvePath(path, step);
      
      // Log resolution for audit trail
      logger.debug("Resolved rollback parameter", {
        stepId: step.id,
        key,
        path,
        resolvedType: typeof resolvedValue,
        hasValue: resolvedValue !== undefined,
      });
      
      resolved[key] = resolvedValue;
    } else if (typeof value === "object" && value !== null) {
      resolved[key] = resolveRollbackParameters(
        value as Record<string, unknown>,
        step
      );
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}

/**
 * Resolve a path expression against step data
 * 
 * @param path - Pre-validated path (e.g., "result.id")
 * @param step - Step containing the data
 * @returns Resolved value or undefined if path doesn't exist
 */
function resolvePath(path: string, step: StructuredStep): unknown {
  const parts = path.split(".");
  const root = parts[0];
  const rest = parts.slice(1);

  let value: unknown;
  if (root === "result") {
    value = step.result;
  } else if (root === "params") {
    value = step.parameters;
  } else {
    // Should never reach here due to prior validation
    return undefined;
  }

  for (const part of rest) {
    if (value === null || value === undefined) {
      return undefined;
    }
    // Use Object.hasOwn to prevent prototype chain access
    if (typeof value === "object" && Object.hasOwn(value as object, part)) {
      value = (value as Record<string, unknown>)[part];
    } else if (Array.isArray(value) && /^\d+$/.test(part)) {
      value = value[parseInt(part, 10)];
    } else {
      return undefined;
    }
  }

  return value;
}

/**
 * Build a default execution context for rollback
 */
function buildDefaultContext(plan: StructuredPlan): ExecutionContext {
  return {
    userId: plan.userId,
    conversationId: plan.conversationId,
    sessionId: `rollback-${plan.id}`,
    planId: plan.id,
  };
}

