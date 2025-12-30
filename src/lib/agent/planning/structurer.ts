// ═══════════════════════════════════════════════════════════════════════════
// Plan Structurer
// Converts validated LLM-generated plans to structured, executable plans
// ═══════════════════════════════════════════════════════════════════════════

import { randomUUID } from "crypto";
import { toolRegistry } from "../tools/registry";
import { PLAN_STATUS, STEP_STATUS } from "../constants";
import { agentLogger } from "../logger";
import { validatePlan } from "./validator";
import { planRepository } from "./repository";
import { PlanningError } from "./types";
import type { LLMGeneratedPlan, LLMPlanStep, LLMAssumption } from "../llm/types";
import type {
  StructuredPlan,
  StructuredStep,
  StoredAssumption,
  PlanningContext,
  PlanConstraints,
  PlanValidationResult,
  RollbackAction,
} from "./types";

const logger = agentLogger.child("plan-structurer");

// ─────────────────────────────────────────────────────────────
// Main Structuring Functions
// ─────────────────────────────────────────────────────────────

/**
 * Structure and persist an LLM-generated plan
 *
 * This is the main entry point for plan structuring. It:
 * 1. Validates the LLM plan
 * 2. Converts to structured format
 * 3. Marks approval steps based on tool config
 * 4. Persists to database
 *
 * @param llmPlan - LLM-generated plan
 * @param context - Planning context
 * @param constraints - Optional constraints
 * @returns Structured plan ready for execution
 */
export async function structurePlan(
  llmPlan: LLMGeneratedPlan,
  context: PlanningContext,
  constraints?: PlanConstraints
): Promise<StructuredPlan> {
  logger.debug("Structuring plan", {
    goal: llmPlan.goal,
    stepCount: llmPlan.steps.length,
    userId: context.userId,
  });

  // Step 1: Validate the plan
  const validationResult = validatePlan(llmPlan, constraints);
  if (!validationResult.valid) {
    logger.warn("Plan validation failed", {
      errorCount: validationResult.errors.length,
    });
    throw new PlanningError(
      "validation_failed",
      `Plan validation failed: ${validationResult.errors.map((e) => e.message).join("; ")}`
    );
  }

  // Step 2: Create structured plan (in memory first)
  const planId = randomUUID();
  const now = new Date();

  // Create structured steps
  const structuredSteps = createStructuredSteps(
    llmPlan.steps,
    planId,
    constraints
  );

  // Determine if any step requires approval
  const requiresApproval = structuredSteps.some((s) => s.requiresApproval);

  // Convert assumptions
  const assumptions = convertAssumptions(llmPlan.assumptions);

  // Build structured plan
  const structuredPlan: StructuredPlan = {
    id: planId,
    userId: context.userId,
    goal: llmPlan.goal,
    goalType: llmPlan.goalType,
    status: PLAN_STATUS.PLANNED,
    steps: structuredSteps,
    currentStepIndex: 0,
    requiresApproval,
    reasoning: llmPlan.reasoning,
    assumptions,
    confidence: llmPlan.confidence,
    conversationId: context.conversationId,
    createdAt: now,
    updatedAt: now,
  };

  // Step 3: Persist to database
  const persisted = await planRepository.create({
    userId: context.userId,
    goal: llmPlan.goal,
    goalType: llmPlan.goalType,
    requiresApproval,
    reasoning: llmPlan.reasoning,
    assumptions,
    confidence: llmPlan.confidence,
    conversationId: context.conversationId,
    steps: structuredSteps.map((s) => ({
      stepOrder: s.index,
      toolName: s.toolName,
      toolParams: s.parameters,
      dependsOn: s.dependsOn,
      description: s.description,
      requiresApproval: s.requiresApproval,
      rollbackAction: s.rollbackAction,
    })),
  });

  logger.info("Plan structured and persisted", {
    planId: persisted.id,
    goal: persisted.goal,
    stepCount: structuredSteps.length,
    requiresApproval,
  });

  return persisted;
}

/**
 * Validate a plan without persisting
 *
 * Useful for pre-flight checks before showing plan to user.
 *
 * @param llmPlan - LLM-generated plan
 * @param constraints - Optional constraints
 * @returns Validation result
 */
export function validatePlanOnly(
  llmPlan: LLMGeneratedPlan,
  constraints?: PlanConstraints
): PlanValidationResult {
  return validatePlan(llmPlan, constraints);
}

/**
 * Create a structured plan preview without persisting
 *
 * Useful for showing the user what will be executed.
 *
 * @param llmPlan - LLM-generated plan
 * @param context - Planning context
 * @param constraints - Optional constraints
 * @returns Structured plan preview (not persisted)
 */
export function createPlanPreview(
  llmPlan: LLMGeneratedPlan,
  context: PlanningContext,
  constraints?: PlanConstraints
): Omit<StructuredPlan, "id" | "createdAt" | "updatedAt"> {
  const validationResult = validatePlan(llmPlan, constraints);
  if (!validationResult.valid) {
    throw new PlanningError(
      "validation_failed",
      `Plan validation failed: ${validationResult.errors.map((e) => e.message).join("; ")}`
    );
  }

  const planId = "preview";
  const structuredSteps = createStructuredSteps(llmPlan.steps, planId, constraints);
  const requiresApproval = structuredSteps.some((s) => s.requiresApproval);
  const assumptions = convertAssumptions(llmPlan.assumptions);

  return {
    userId: context.userId,
    goal: llmPlan.goal,
    goalType: llmPlan.goalType,
    status: PLAN_STATUS.PLANNED,
    steps: structuredSteps,
    currentStepIndex: 0,
    requiresApproval,
    reasoning: llmPlan.reasoning,
    assumptions,
    confidence: llmPlan.confidence,
    conversationId: context.conversationId,
  };
}

// ─────────────────────────────────────────────────────────────
// Step Structuring
// ─────────────────────────────────────────────────────────────

/**
 * Create structured steps from LLM steps
 */
function createStructuredSteps(
  llmSteps: LLMPlanStep[],
  planId: string,
  constraints?: PlanConstraints
): StructuredStep[] {
  // Sort steps by order
  const sortedSteps = [...llmSteps].sort((a, b) => a.order - b.order);

  // Create mappings for dependencies:
  // - orderToId: step order → step ID (for dependsOn field, storing IDs)
  // - orderToIndex: step order → array index (for dependsOnIndices field)
  const orderToId = new Map<number, string>();
  const orderToIndex = new Map<number, number>();
  const stepIds: string[] = [];

  for (let i = 0; i < sortedSteps.length; i++) {
    const step = sortedSteps[i];
    const stepId = randomUUID();
    orderToId.set(step.order, stepId);
    orderToIndex.set(step.order, i);
    stepIds.push(stepId);
  }

  // Create structured steps
  return sortedSteps.map((llmStep, index) => {
    const stepId = stepIds[index];
    
    // Map dependency orders to step IDs
    const dependsOnIds = (llmStep.dependsOn || [])
      .map((order) => orderToId.get(order))
      .filter((id): id is string => id !== undefined);
    
    // Map dependency orders to array indices (for getExecutionOrder)
    const dependsOnIndices = (llmStep.dependsOn || [])
      .map((order) => orderToIndex.get(order))
      .filter((idx): idx is number => idx !== undefined);

    return createStructuredStep(
      llmStep,
      stepId,
      planId,
      index,
      dependsOnIds,
      dependsOnIndices,
      constraints
    );
  });
}

/**
 * Create a single structured step from an LLM step
 * @param llmStep - The LLM-generated step
 * @param stepId - Generated UUID for this step
 * @param planId - ID of the parent plan
 * @param index - Array index of this step (0-based position after sorting)
 * @param dependsOnIds - Step IDs that this step depends on
 * @param dependsOnIndices - Array indices of dependency steps (for getExecutionOrder)
 * @param constraints - Optional plan constraints
 */
function createStructuredStep(
  llmStep: LLMPlanStep,
  stepId: string,
  planId: string,
  index: number,
  dependsOnIds: string[],
  dependsOnIndices: number[],
  constraints?: PlanConstraints
): StructuredStep {
  const now = new Date();

  // Determine if step requires approval
  const requiresApproval = determineApprovalRequired(
    llmStep.toolName,
    llmStep.requiresApproval,
    constraints
  );

  // Convert rollback action
  const rollbackAction = llmStep.rollback
    ? {
        toolName: llmStep.rollback.toolName,
        parameters: llmStep.rollback.parameters,
      }
    : undefined;

  return {
    id: stepId,
    planId,
    index,
    toolName: llmStep.toolName,
    parameters: llmStep.parameters,
    dependsOn: dependsOnIds,
    dependsOnIndices,
    description: llmStep.description,
    status: STEP_STATUS.PENDING,
    requiresApproval,
    rollbackAction,
    createdAt: now,
  };
}

/**
 * Determine if a step requires approval
 *
 * Based on:
 * 1. LLM's recommendation
 * 2. Tool's requiresApproval flag
 * 3. Constraints (forced approval list)
 */
function determineApprovalRequired(
  toolName: string,
  llmRecommendation: boolean,
  constraints?: PlanConstraints
): boolean {
  // Check constraints first
  if (constraints?.requireApprovalBefore?.includes(toolName)) {
    return true;
  }

  // Check tool definition
  const tool = toolRegistry.get(toolName);
  if (tool?.requiresApproval) {
    return true;
  }

  // Fall back to LLM recommendation
  return llmRecommendation;
}

// ─────────────────────────────────────────────────────────────
// Approval Step Marking
// ─────────────────────────────────────────────────────────────

/**
 * Mark steps that require approval based on tool configuration
 *
 * This function updates existing steps to mark approval requirements
 * based on the tool registry. Useful for re-evaluating a plan after
 * tool configurations change.
 *
 * @param steps - Steps to evaluate
 * @returns Updated steps with approval flags
 */
export function markApprovalSteps(steps: StructuredStep[]): StructuredStep[] {
  return steps.map((step) => {
    const tool = toolRegistry.get(step.toolName);
    const requiresApproval = tool?.requiresApproval ?? step.requiresApproval;

    return {
      ...step,
      requiresApproval,
    };
  });
}

/**
 * Get steps that require approval from a plan
 */
export function getApprovalRequiredSteps(plan: StructuredPlan): StructuredStep[] {
  return plan.steps.filter((s) => s.requiresApproval);
}

/**
 * Get the next step that requires approval
 */
export function getNextApprovalStep(
  plan: StructuredPlan
): StructuredStep | null {
  for (let i = plan.currentStepIndex; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    if (step.requiresApproval && step.status === STEP_STATUS.PENDING) {
      return step;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Assumption Conversion
// ─────────────────────────────────────────────────────────────

/**
 * Convert LLM assumptions to stored format
 */
function convertAssumptions(
  llmAssumptions: LLMAssumption[]
): StoredAssumption[] {
  return llmAssumptions.map((assumption) => ({
    id: randomUUID(),
    statement: assumption.statement,
    category: assumption.category,
    evidence: assumption.evidence,
    confidence: assumption.confidence,
    verified: false,
  }));
}

// ─────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────

/**
 * Calculate estimated plan duration based on tool estimates
 *
 * This is a rough estimate for user display purposes.
 */
export function estimatePlanDuration(plan: StructuredPlan): {
  minSeconds: number;
  maxSeconds: number;
  formatted: string;
} {
  let minTotal = 0;
  let maxTotal = 0;

  for (const step of plan.steps) {
    // Base estimates per tool category
    const tool = toolRegistry.get(step.toolName);
    if (tool) {
      switch (tool.category) {
        case "query":
          minTotal += 1;
          maxTotal += 5;
          break;
        case "create":
        case "update":
        case "delete":
          minTotal += 2;
          maxTotal += 10;
          break;
        case "external":
          minTotal += 3;
          maxTotal += 15;
          break;
        case "draft":
          minTotal += 1;
          maxTotal += 3;
          break;
        default:
          minTotal += 1;
          maxTotal += 5;
      }
    } else {
      minTotal += 2;
      maxTotal += 10;
    }

    // Add time for approval steps
    if (step.requiresApproval) {
      // User decision time not counted, but add processing time
      maxTotal += 2;
    }
  }

  // Format duration
  let formatted: string;
  if (maxTotal < 60) {
    formatted = `${minTotal}-${maxTotal} seconds`;
  } else {
    const minMinutes = Math.ceil(minTotal / 60);
    const maxMinutes = Math.ceil(maxTotal / 60);
    formatted = `${minMinutes}-${maxMinutes} minutes`;
  }

  return { minSeconds: minTotal, maxSeconds: maxTotal, formatted };
}

/**
 * Get a human-readable summary of a plan
 */
export function summarizePlan(plan: StructuredPlan): string {
  const stepSummaries = plan.steps.map((step, i) => {
    const approval = step.requiresApproval ? " (requires approval)" : "";
    return `${i + 1}. ${step.description}${approval}`;
  });

  const approvalCount = plan.steps.filter((s) => s.requiresApproval).length;
  const duration = estimatePlanDuration(plan);

  const header = `Plan: ${plan.goal}\n` +
    `Steps: ${plan.steps.length}\n` +
    `Requires approval: ${approvalCount > 0 ? `Yes (${approvalCount} steps)` : "No"}\n` +
    `Estimated duration: ${duration.formatted}\n` +
    `Confidence: ${(plan.confidence * 100).toFixed(0)}%\n`;

  return header + "\nSteps:\n" + stepSummaries.join("\n");
}

/**
 * Check if a plan can be executed (all dependencies met for current step)
 */
export function canExecuteNextStep(plan: StructuredPlan): boolean {
  if (plan.status !== PLAN_STATUS.EXECUTING && plan.status !== PLAN_STATUS.PLANNED) {
    return false;
  }

  if (plan.currentStepIndex >= plan.steps.length) {
    return false;
  }

  const currentStep = plan.steps[plan.currentStepIndex];
  if (currentStep.status !== STEP_STATUS.PENDING) {
    return false;
  }

  // Check all dependencies are completed
  for (const depId of currentStep.dependsOn) {
    const depStep = plan.steps.find((s) => s.id === depId);
    if (!depStep || depStep.status !== STEP_STATUS.COMPLETED) {
      return false;
    }
  }

  return true;
}

/**
 * Get the execution order for steps (respecting dependencies)
 *
 * Uses topological sort to determine valid execution order.
 */
export function getExecutionOrder(plan: StructuredPlan): number[] {
  const steps = plan.steps;
  const inDegree = new Map<number, number>();
  const adjList = new Map<number, number[]>();

  // Initialize
  for (let i = 0; i < steps.length; i++) {
    inDegree.set(i, 0);
    adjList.set(i, []);
  }

  // Build graph
  for (let i = 0; i < steps.length; i++) {
    for (const depIdx of steps[i].dependsOnIndices) {
      const edges = adjList.get(depIdx) || [];
      edges.push(i);
      adjList.set(depIdx, edges);
      inDegree.set(i, (inDegree.get(i) || 0) + 1);
    }
  }

  // Kahn's algorithm
  const queue: number[] = [];
  const order: number[] = [];

  for (const [idx, deg] of inDegree) {
    if (deg === 0) {
      queue.push(idx);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);

    for (const neighbor of adjList.get(current) || []) {
      const newDegree = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  return order;
}

