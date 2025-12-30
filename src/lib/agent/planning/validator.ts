// ═══════════════════════════════════════════════════════════════════════════
// Plan Validator
// Validates LLM-generated plans before structuring and execution
// ═══════════════════════════════════════════════════════════════════════════

import { toolRegistry } from "../tools/registry";
import { validateToolParams } from "../tools/validation";
import { RISK_LEVELS } from "../constants";
import { agentLogger } from "../logger";
import type { LLMGeneratedPlan, LLMPlanStep } from "../llm/types";
import type {
  PlanValidationResult,
  PlanValidationError,
  PlanValidationWarning,
  PlanValidationErrorCode,
  PlanValidationWarningCode,
  ValidatedLLMPlan,
  ValidatedStep,
  PlanConstraints,
} from "./types";

const logger = agentLogger.child("plan-validator");

// ─────────────────────────────────────────────────────────────
// Default Constraints
// ─────────────────────────────────────────────────────────────

const DEFAULT_CONSTRAINTS: Required<PlanConstraints> = {
  maxSteps: 10,
  requireApprovalBefore: [],
  maxDurationMinutes: 30,
  allowHighRisk: true,
};

// ─────────────────────────────────────────────────────────────
// Main Validation Function
// ─────────────────────────────────────────────────────────────

/**
 * Validate an LLM-generated plan
 *
 * Checks:
 * 1. Plan has a goal and steps
 * 2. All referenced tools exist in the registry
 * 3. All tool parameters pass Zod validation
 * 4. Dependencies form a valid DAG (no cycles)
 * 5. Step ordering is valid
 * 6. Constraints are met (max steps, etc.)
 *
 * @param plan - LLM-generated plan to validate
 * @param constraints - Optional constraints to apply
 * @returns Validation result with errors and warnings
 */
export function validatePlan(
  plan: LLMGeneratedPlan,
  constraints?: PlanConstraints
): PlanValidationResult {
  const mergedConstraints = { ...DEFAULT_CONSTRAINTS, ...constraints };
  const errors: PlanValidationError[] = [];
  const warnings: PlanValidationWarning[] = [];

  logger.debug("Validating plan", {
    goal: plan.goal,
    stepCount: plan.steps.length,
  });

  // Step 1: Validate plan-level properties
  validatePlanLevel(plan, mergedConstraints, errors, warnings);

  // If no steps, can't continue validation
  if (!plan.steps || plan.steps.length === 0) {
    return {
      valid: false,
      errors,
      warnings,
    };
  }

  // Step 2: Validate each step
  const validatedSteps: ValidatedStep[] = [];
  for (const step of plan.steps) {
    const validatedStep = validateStep(step, mergedConstraints, errors, warnings);
    validatedSteps.push(validatedStep);
  }

  // Step 3: Validate step ordering
  validateStepOrdering(plan.steps, errors);

  // Step 4: Validate dependencies
  validateDependencies(plan.steps, errors, warnings);

  // Step 5: Check for cycles in dependency graph
  if (hasCyclicDependencies(plan.steps)) {
    errors.push({
      code: "cyclic_dependency",
      message: "Plan has circular dependencies between steps",
      stepIndex: -1,
    });
  }

  const valid = errors.length === 0;

  if (!valid) {
    logger.warn("Plan validation failed", {
      errorCount: errors.length,
      errors: errors.map((e) => e.message),
    });
  } else {
    logger.debug("Plan validation passed", {
      warningCount: warnings.length,
    });
  }

  return {
    valid,
    errors,
    warnings,
    validatedPlan: valid
      ? {
          ...plan,
          validatedSteps,
        }
      : undefined,
  };
}

// ─────────────────────────────────────────────────────────────
// Plan-Level Validation
// ─────────────────────────────────────────────────────────────

/**
 * Validate plan-level properties
 */
function validatePlanLevel(
  plan: LLMGeneratedPlan,
  constraints: Required<PlanConstraints>,
  errors: PlanValidationError[],
  warnings: PlanValidationWarning[]
): void {
  // Check goal
  if (!plan.goal || plan.goal.trim().length === 0) {
    errors.push({
      code: "missing_goal",
      message: "Plan must have a goal",
      stepIndex: -1,
    });
  }

  // Check confidence
  if (typeof plan.confidence !== "number" || plan.confidence < 0 || plan.confidence > 1) {
    errors.push({
      code: "invalid_confidence",
      message: "Plan confidence must be a number between 0 and 1",
      stepIndex: -1,
      expected: "number 0-1",
      received: String(plan.confidence),
    });
  }

  // Check steps exist
  if (!plan.steps || plan.steps.length === 0) {
    errors.push({
      code: "empty_plan",
      message: "Plan must have at least one step",
      stepIndex: -1,
    });
    return;
  }

  // Check max steps constraint
  if (plan.steps.length > constraints.maxSteps) {
    errors.push({
      code: "too_many_steps",
      message: `Plan has ${plan.steps.length} steps, maximum allowed is ${constraints.maxSteps}`,
      stepIndex: -1,
      expected: `<= ${constraints.maxSteps}`,
      received: String(plan.steps.length),
    });
  }

  // Warnings
  if (plan.confidence < 0.5) {
    warnings.push({
      code: "low_confidence",
      message: `Plan has low confidence (${plan.confidence.toFixed(2)})`,
      stepIndex: -1,
    });
  }

  if (plan.steps.length > 5) {
    warnings.push({
      code: "long_plan",
      message: `Plan has ${plan.steps.length} steps - consider breaking into smaller plans`,
      stepIndex: -1,
    });
  }

  // Count approval-required steps
  const approvalSteps = plan.steps.filter((s) => s.requiresApproval).length;
  if (approvalSteps > plan.steps.length / 2) {
    warnings.push({
      code: "approval_heavy",
      message: `${approvalSteps} of ${plan.steps.length} steps require approval`,
      stepIndex: -1,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Step Validation
// ─────────────────────────────────────────────────────────────

/**
 * Validate a single step
 */
function validateStep(
  step: LLMPlanStep,
  constraints: Required<PlanConstraints>,
  errors: PlanValidationError[],
  warnings: PlanValidationWarning[]
): ValidatedStep {
  const validatedStep: ValidatedStep = {
    ...step,
    toolExists: false,
    parametersValid: false,
  };

  // Check tool exists
  const tool = toolRegistry.get(step.toolName);
  if (!tool) {
    errors.push({
      code: "tool_not_found",
      message: `Tool "${step.toolName}" not found in registry`,
      stepIndex: step.order,
      fieldPath: "toolName",
    });
    return validatedStep;
  }

  validatedStep.toolExists = true;

  // Validate parameters against tool's Zod schema
  const paramResult = validateToolParams(tool, step.parameters);
  if (!paramResult.success) {
    for (const error of paramResult.errors ?? []) {
      errors.push({
        code: "invalid_parameters",
        message: `Step ${step.order}: ${error.message}`,
        stepIndex: step.order,
        fieldPath: `parameters.${error.path}`,
        expected: error.expected,
        received: error.received,
      });
    }
  } else {
    validatedStep.parametersValid = true;
    // Store corrected parameters (after Zod coercion)
    validatedStep.correctedParameters = paramResult.data;
  }

  // Check high-risk tools
  if (!constraints.allowHighRisk && tool.riskLevel === RISK_LEVELS.CRITICAL) {
    errors.push({
      code: "invalid_parameters",
      message: `Step ${step.order}: Tool "${step.toolName}" is critical risk and not allowed`,
      stepIndex: step.order,
    });
  }

  // Check forced approval tools
  if (
    constraints.requireApprovalBefore.includes(step.toolName) &&
    !step.requiresApproval
  ) {
    // Auto-correct: mark as requiring approval
    validatedStep.requiresApproval = true;
  }

  // Warnings
  if (tool.riskLevel === RISK_LEVELS.HIGH || tool.riskLevel === RISK_LEVELS.CRITICAL) {
    warnings.push({
      code: "high_risk_tool",
      message: `Step ${step.order} uses high-risk tool "${step.toolName}"`,
      stepIndex: step.order,
    });
  }

  if (!step.rollback && (tool.riskLevel === RISK_LEVELS.HIGH || tool.riskLevel === RISK_LEVELS.CRITICAL)) {
    warnings.push({
      code: "no_rollback",
      message: `Step ${step.order} has no rollback for high-risk tool "${step.toolName}"`,
      stepIndex: step.order,
    });
  }

  return validatedStep;
}

// ─────────────────────────────────────────────────────────────
// Step Ordering Validation
// ─────────────────────────────────────────────────────────────

/**
 * Validate step ordering
 */
function validateStepOrdering(
  steps: LLMPlanStep[],
  errors: PlanValidationError[]
): void {
  const orders = new Set<number>();

  for (const step of steps) {
    // Check for valid order values
    if (typeof step.order !== "number" || step.order < 0) {
      errors.push({
        code: "invalid_step_order",
        message: `Step has invalid order: ${step.order}`,
        stepIndex: step.order,
        expected: "non-negative integer",
        received: String(step.order),
      });
      continue;
    }

    // Check for duplicate orders
    if (orders.has(step.order)) {
      errors.push({
        code: "duplicate_step_order",
        message: `Duplicate step order: ${step.order}`,
        stepIndex: step.order,
      });
    }

    orders.add(step.order);
  }

  // Check for gaps in ordering (warning, not error)
  const sortedOrders = Array.from(orders).sort((a, b) => a - b);
  for (let i = 0; i < sortedOrders.length; i++) {
    if (sortedOrders[i] !== i) {
      // There's a gap, but this is just a warning since we can still execute
      break;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Dependency Validation
// ─────────────────────────────────────────────────────────────

/**
 * Validate dependencies between steps
 */
function validateDependencies(
  steps: LLMPlanStep[],
  errors: PlanValidationError[],
  warnings: PlanValidationWarning[]
): void {
  const stepOrders = new Set(steps.map((s) => s.order));

  for (const step of steps) {
    if (!step.dependsOn || step.dependsOn.length === 0) {
      continue;
    }

    for (const depOrder of step.dependsOn) {
      // Check dependency exists
      if (!stepOrders.has(depOrder)) {
        errors.push({
          code: "invalid_dependency",
          message: `Step ${step.order} depends on non-existent step ${depOrder}`,
          stepIndex: step.order,
          fieldPath: "dependsOn",
        });
        continue;
      }

      // Check dependency comes before this step
      if (depOrder >= step.order) {
        errors.push({
          code: "dependency_out_of_order",
          message: `Step ${step.order} depends on step ${depOrder} which comes at or after it`,
          stepIndex: step.order,
          fieldPath: "dependsOn",
        });
      }
    }

    // Warning for many dependencies
    if (step.dependsOn.length > 3) {
      warnings.push({
        code: "many_dependencies",
        message: `Step ${step.order} has ${step.dependsOn.length} dependencies`,
        stepIndex: step.order,
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Cycle Detection
// ─────────────────────────────────────────────────────────────

/**
 * Check for cyclic dependencies using DFS
 */
function hasCyclicDependencies(steps: LLMPlanStep[]): boolean {
  // Build adjacency list (step order -> dependencies)
  const graph = new Map<number, number[]>();
  for (const step of steps) {
    graph.set(step.order, step.dependsOn || []);
  }

  const visited = new Set<number>();
  const recursionStack = new Set<number>();

  function hasCycle(node: number): boolean {
    if (recursionStack.has(node)) {
      return true; // Back edge found = cycle
    }

    if (visited.has(node)) {
      return false; // Already fully processed
    }

    visited.add(node);
    recursionStack.add(node);

    const dependencies = graph.get(node) || [];
    for (const dep of dependencies) {
      if (hasCycle(dep)) {
        return true;
      }
    }

    recursionStack.delete(node);
    return false;
  }

  // Check all nodes (handles disconnected components)
  for (const step of steps) {
    if (hasCycle(step.order)) {
      return true;
    }
  }

  return false;
}

// ─────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────

/**
 * Format validation errors for LLM retry
 *
 * When a plan fails validation, this function formats the errors
 * in a way that helps the LLM understand what to fix.
 */
export function formatValidationErrorsForLLM(
  errors: PlanValidationError[]
): string {
  if (errors.length === 0) {
    return "Plan is valid.";
  }

  const grouped = new Map<PlanValidationErrorCode, PlanValidationError[]>();
  for (const error of errors) {
    const existing = grouped.get(error.code) || [];
    existing.push(error);
    grouped.set(error.code, existing);
  }

  const parts: string[] = ["The plan has the following issues:\n"];

  for (const [code, codeErrors] of grouped) {
    parts.push(`\n## ${formatErrorCode(code)}\n`);
    for (const error of codeErrors) {
      if (error.stepIndex >= 0) {
        parts.push(`- Step ${error.stepIndex}: ${error.message}`);
      } else {
        parts.push(`- ${error.message}`);
      }
      if (error.expected && error.received) {
        parts.push(`  (expected: ${error.expected}, received: ${error.received})`);
      }
    }
  }

  parts.push("\nPlease correct these issues and regenerate the plan.");

  return parts.join("\n");
}

/**
 * Format error code as human-readable heading
 */
function formatErrorCode(code: PlanValidationErrorCode): string {
  const mapping: Record<PlanValidationErrorCode, string> = {
    empty_plan: "Empty Plan",
    tool_not_found: "Unknown Tools",
    invalid_parameters: "Invalid Parameters",
    missing_required_param: "Missing Required Parameters",
    invalid_dependency: "Invalid Dependencies",
    cyclic_dependency: "Circular Dependencies",
    dependency_out_of_order: "Dependencies Out of Order",
    too_many_steps: "Too Many Steps",
    invalid_step_order: "Invalid Step Order",
    duplicate_step_order: "Duplicate Step Order",
    missing_goal: "Missing Goal",
    invalid_confidence: "Invalid Confidence",
  };

  return mapping[code] || code;
}

/**
 * Check if a plan can be retried (errors are correctable by LLM)
 */
export function canRetryPlanGeneration(errors: PlanValidationError[]): boolean {
  // These errors can be fixed by regenerating the plan
  const retryableErrors: PlanValidationErrorCode[] = [
    "tool_not_found",
    "invalid_parameters",
    "missing_required_param",
    "invalid_dependency",
    "cyclic_dependency",
    "dependency_out_of_order",
    "too_many_steps",
    "invalid_step_order",
    "duplicate_step_order",
    "invalid_confidence",
  ];

  return errors.every((e) => retryableErrors.includes(e.code));
}

/**
 * Get available tool names for error messages
 */
export function getAvailableToolNames(): string[] {
  return toolRegistry.names();
}

