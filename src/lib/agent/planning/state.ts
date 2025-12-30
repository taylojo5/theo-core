// ═══════════════════════════════════════════════════════════════════════════
// Plan State Management
// Functions for retrieving, updating, and querying plan state for resumption
// ═══════════════════════════════════════════════════════════════════════════

import { planRepository } from "./repository";
import { PLAN_STATUS, STEP_STATUS } from "../constants";
import { agentLogger } from "../logger";
import { PlanningError } from "./types";
import type { StructuredPlan, StructuredStep, StoredAssumption } from "./types";
import type { PlanStatus, StepStatus } from "../constants";

const logger = agentLogger.child("plan-state");

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/**
 * Snapshot of plan state for resumption
 */
export interface PlanState {
  /** Plan ID */
  planId: string;

  /** User ID */
  userId: string;

  /** Current plan status */
  status: PlanStatus;

  /** Goal this plan is achieving */
  goal: string;

  /** Goal type/category */
  goalType: string;

  /** Total number of steps */
  totalSteps: number;

  /** Current step index (0-based) */
  currentStepIndex: number;

  /** Step statuses */
  stepStatuses: StepStateSnapshot[];

  /** Number of completed steps */
  completedSteps: number;

  /** Number of failed steps */
  failedSteps: number;

  /** Number of skipped steps */
  skippedSteps: number;

  /** Whether plan is awaiting approval */
  awaitingApproval: boolean;

  /** Pending approval ID (if any) */
  pendingApprovalId?: string;

  /** Pending approval step index (if any) */
  pendingApprovalStepIndex?: number;

  /** Plan confidence (0.0-1.0) */
  confidence: number;

  /** Assumptions made during planning */
  assumptions: StoredAssumption[];

  /** LLM reasoning for the plan */
  reasoning: string;

  /** When the plan was created */
  createdAt: Date;

  /** When the plan was last updated */
  updatedAt: Date;

  /** When the plan was completed (if applicable) */
  completedAt?: Date;

  /** Conversation ID (if any) */
  conversationId?: string;
}

/**
 * Snapshot of a single step's state
 */
export interface StepStateSnapshot {
  /** Step ID */
  stepId: string;

  /** Step index */
  index: number;

  /** Step status */
  status: StepStatus;

  /** Tool name */
  toolName: string;

  /** Step description */
  description: string;

  /** Whether this step requires approval */
  requiresApproval: boolean;

  /** Whether this step has a rollback action defined */
  hasRollback: boolean;

  /** Error message (if failed) */
  errorMessage?: string;

  /** Result (if completed) */
  result?: unknown;

  /** Approval ID (if awaiting approval) */
  approvalId?: string;

  /** When executed (if applicable) */
  executedAt?: Date;

  /** When rolled back (if applicable) */
  rolledBackAt?: Date;
}

/**
 * Input for updating plan state
 */
export interface PlanStateUpdate {
  /** New status (optional) */
  status?: PlanStatus;

  /** New current step index (optional) */
  currentStepIndex?: number;

  /** Mark a step with a new status */
  stepUpdate?: {
    stepId: string;
    status: StepStatus;
    result?: unknown;
    errorMessage?: string;
  };
}

/**
 * Options for finding interrupted plans
 */
export interface FindInterruptedPlansOptions {
  /** Include plans in PAUSED status (awaiting approval) */
  includePaused?: boolean;

  /** Maximum age in hours (default: 24) */
  maxAgeHours?: number;
}

// ─────────────────────────────────────────────────────────────
// State Retrieval Functions
// ─────────────────────────────────────────────────────────────

/**
 * Get current plan state for resumption
 * 
 * Returns a snapshot of the plan's current state including
 * step statuses, pending approvals, and progress metrics.
 * 
 * @param planId - ID of the plan to get state for
 * @returns PlanState snapshot
 * @throws PlanningError if plan not found
 */
export async function getPlanState(planId: string): Promise<PlanState> {
  logger.debug("Getting plan state", { planId });

  const plan = await planRepository.getById(planId, true);
  if (!plan) {
    throw new PlanningError(
      "plan_not_found",
      `Plan ${planId} not found`,
      planId
    );
  }

  return mapPlanToState(plan);
}

/**
 * Get plan state for a user (validates ownership)
 * 
 * @param planId - ID of the plan
 * @param userId - User ID to validate ownership
 * @returns PlanState snapshot
 * @throws PlanningError if plan not found or not owned by user
 */
export async function getPlanStateForUser(
  planId: string,
  userId: string
): Promise<PlanState> {
  logger.debug("Getting plan state for user", { planId, userId });

  const plan = await planRepository.getByIdForUser(planId, userId, true);
  if (!plan) {
    throw new PlanningError(
      "plan_not_found",
      `Plan ${planId} not found for user ${userId}`,
      planId
    );
  }

  return mapPlanToState(plan);
}

// ─────────────────────────────────────────────────────────────
// State Update Functions
// ─────────────────────────────────────────────────────────────

/**
 * Update plan state atomically
 * 
 * Allows updating plan status, current step, or individual step status
 * in a single operation.
 * 
 * @param planId - ID of the plan to update
 * @param update - State update to apply
 */
export async function updatePlanState(
  planId: string,
  update: PlanStateUpdate
): Promise<void> {
  logger.debug("Updating plan state", { planId, update });

  // Apply plan-level updates
  if (update.status !== undefined || update.currentStepIndex !== undefined) {
    await planRepository.updateStatus(planId, {
      status: update.status || PLAN_STATUS.EXECUTING,
      currentStep: update.currentStepIndex,
    });
  }

  // Apply step-level update
  if (update.stepUpdate) {
    await planRepository.updateStepStatus(update.stepUpdate.stepId, {
      status: update.stepUpdate.status,
      result: update.stepUpdate.result,
      errorMessage: update.stepUpdate.errorMessage,
    });
  }

  logger.info("Plan state updated", { planId });
}

/**
 * Mark a plan as ready for resumption
 * 
 * Transitions a PAUSED or EXECUTING plan back to EXECUTING status
 * so it can be resumed.
 * 
 * @param planId - ID of the plan to mark
 * @returns Updated plan state
 */
export async function markPlanForResumption(planId: string): Promise<PlanState> {
  logger.debug("Marking plan for resumption", { planId });

  const plan = await planRepository.getById(planId);
  if (!plan) {
    throw new PlanningError(
      "plan_not_found",
      `Plan ${planId} not found`,
      planId
    );
  }

  // Only PAUSED and EXECUTING plans can be resumed
  if (
    plan.status !== PLAN_STATUS.PAUSED &&
    plan.status !== PLAN_STATUS.EXECUTING
  ) {
    throw new PlanningError(
      "invalid_state_transition",
      `Cannot resume plan in status: ${plan.status}`,
      planId
    );
  }

  // If already executing, no change needed
  if (plan.status === PLAN_STATUS.EXECUTING) {
    return mapPlanToState(plan);
  }

  // Transition to EXECUTING
  const updatedPlan = await planRepository.startExecution(planId);
  logger.info("Plan marked for resumption", { planId });

  return mapPlanToState(updatedPlan);
}

// ─────────────────────────────────────────────────────────────
// Interrupted Plan Detection
// ─────────────────────────────────────────────────────────────

/**
 * Find plans that need resumption (after server restart)
 * 
 * Returns plans that were in EXECUTING status when the server
 * stopped, or optionally PAUSED plans awaiting user action.
 * 
 * @param userId - User ID to find interrupted plans for
 * @param options - Options for filtering
 * @returns Array of interrupted plans
 */
export async function findInterruptedPlans(
  userId: string,
  options: FindInterruptedPlansOptions = {}
): Promise<StructuredPlan[]> {
  const { includePaused = true, maxAgeHours = 24 } = options;

  logger.debug("Finding interrupted plans", { userId, options });

  // Calculate max age cutoff
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - maxAgeHours);

  // Build status filter
  const statuses: PlanStatus[] = [PLAN_STATUS.EXECUTING];
  if (includePaused) {
    statuses.push(PLAN_STATUS.PAUSED);
  }

  // Query plans
  const plans = await planRepository.getByUserId(userId, {
    status: statuses,
    includeSteps: true,
  });

  // Filter by age
  const interruptedPlans = plans.filter(
    (plan) => plan.updatedAt >= cutoffDate
  );

  logger.info("Found interrupted plans", {
    userId,
    count: interruptedPlans.length,
    executing: interruptedPlans.filter(
      (p) => p.status === PLAN_STATUS.EXECUTING
    ).length,
    paused: interruptedPlans.filter(
      (p) => p.status === PLAN_STATUS.PAUSED
    ).length,
  });

  return interruptedPlans;
}

/**
 * Check if a user has any interrupted plans
 * 
 * Quick check for UI notification purposes.
 * 
 * @param userId - User ID to check
 * @returns True if user has interrupted plans
 */
export async function hasInterruptedPlans(userId: string): Promise<boolean> {
  const plans = await findInterruptedPlans(userId, {
    includePaused: true,
    maxAgeHours: 24,
  });
  return plans.length > 0;
}

/**
 * Get summary of interrupted plans for a user
 * 
 * Returns a brief summary suitable for display in UI.
 * 
 * @param userId - User ID to get summary for
 * @returns Summary of interrupted plans
 */
export async function getInterruptedPlansSummary(
  userId: string
): Promise<InterruptedPlansSummary> {
  const plans = await findInterruptedPlans(userId);

  return {
    total: plans.length,
    executing: plans.filter((p) => p.status === PLAN_STATUS.EXECUTING).length,
    paused: plans.filter((p) => p.status === PLAN_STATUS.PAUSED).length,
    awaitingApproval: plans.filter((p) =>
      p.steps.some((s) => s.status === STEP_STATUS.AWAITING_APPROVAL)
    ).length,
    plans: plans.map((p) => ({
      id: p.id,
      goal: p.goal,
      status: p.status,
      progress: `${countCompletedSteps(p)}/${p.steps.length}`,
      lastUpdated: p.updatedAt,
    })),
  };
}

export interface InterruptedPlansSummary {
  total: number;
  executing: number;
  paused: number;
  awaitingApproval: number;
  plans: {
    id: string;
    goal: string;
    status: PlanStatus;
    progress: string;
    lastUpdated: Date;
  }[];
}

// ─────────────────────────────────────────────────────────────
// Step State Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Get the next executable step in a plan
 * 
 * Returns the next step that is pending and has all dependencies met.
 * 
 * @param plan - Plan to check
 * @returns Next executable step, or undefined if none
 */
export function getNextExecutableStep(
  plan: StructuredPlan
): StructuredStep | undefined {
  for (let i = plan.currentStepIndex; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    if (step.status === STEP_STATUS.PENDING) {
      // Check dependencies
      const dependenciesMet = step.dependsOn.every((depId) => {
        const depStep = plan.steps.find((s) => s.id === depId);
        return depStep?.status === STEP_STATUS.COMPLETED;
      });

      if (dependenciesMet) {
        return step;
      }
    }
  }
  return undefined;
}

/**
 * Get the step currently awaiting approval
 * 
 * @param plan - Plan to check
 * @returns Step awaiting approval, or undefined if none
 */
export function getStepAwaitingApproval(
  plan: StructuredPlan
): StructuredStep | undefined {
  return plan.steps.find((s) => s.status === STEP_STATUS.AWAITING_APPROVAL);
}

/**
 * Get steps that can be rolled back
 * 
 * Returns completed steps that have rollback actions defined.
 * 
 * @param plan - Plan to check
 * @returns Array of rollbackable steps in reverse execution order
 */
export function getRollbackableSteps(plan: StructuredPlan): StructuredStep[] {
  return plan.steps
    .filter(
      (s) =>
        s.status === STEP_STATUS.COMPLETED &&
        s.rollbackAction !== undefined
    )
    .sort((a, b) => b.index - a.index); // Reverse order for rollback
}

/**
 * Check if a plan can continue execution
 * 
 * A plan can continue if it's in EXECUTING or PAUSED status
 * and has pending steps.
 * 
 * @param plan - Plan to check
 * @returns True if plan can continue
 */
export function canPlanContinue(plan: StructuredPlan): boolean {
  // Check status
  if (
    plan.status !== PLAN_STATUS.EXECUTING &&
    plan.status !== PLAN_STATUS.PAUSED
  ) {
    return false;
  }

  // Check if there are pending steps
  const hasPendingSteps = plan.steps.some(
    (s) => s.status === STEP_STATUS.PENDING
  );

  // Check if there's a step awaiting approval
  const hasApprovalStep = plan.steps.some(
    (s) => s.status === STEP_STATUS.AWAITING_APPROVAL
  );

  return hasPendingSteps || hasApprovalStep;
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Map a StructuredPlan to PlanState
 */
function mapPlanToState(plan: StructuredPlan): PlanState {
  const stepStatuses = plan.steps.map(mapStepToSnapshot);

  // Find pending approval
  const approvalStep = plan.steps.find(
    (s) => s.status === STEP_STATUS.AWAITING_APPROVAL
  );

  return {
    planId: plan.id,
    userId: plan.userId,
    status: plan.status,
    goal: plan.goal,
    goalType: plan.goalType,
    totalSteps: plan.steps.length,
    currentStepIndex: plan.currentStepIndex,
    stepStatuses,
    completedSteps: countCompletedSteps(plan),
    failedSteps: countFailedSteps(plan),
    skippedSteps: countSkippedSteps(plan),
    awaitingApproval: approvalStep !== undefined,
    pendingApprovalId: approvalStep?.approvalId,
    pendingApprovalStepIndex: approvalStep?.index,
    confidence: plan.confidence,
    assumptions: plan.assumptions,
    reasoning: plan.reasoning,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    completedAt: plan.completedAt,
    conversationId: plan.conversationId,
  };
}

/**
 * Map a StructuredStep to StepStateSnapshot
 */
function mapStepToSnapshot(step: StructuredStep): StepStateSnapshot {
  return {
    stepId: step.id,
    index: step.index,
    status: step.status,
    toolName: step.toolName,
    description: step.description,
    requiresApproval: step.requiresApproval,
    hasRollback: step.rollbackAction !== undefined,
    errorMessage: step.errorMessage,
    result: step.result,
    approvalId: step.approvalId,
    executedAt: step.executedAt,
    rolledBackAt: step.rolledBackAt,
  };
}

/**
 * Count completed steps in a plan
 */
function countCompletedSteps(plan: StructuredPlan): number {
  return plan.steps.filter((s) => s.status === STEP_STATUS.COMPLETED).length;
}

/**
 * Count failed steps in a plan
 */
function countFailedSteps(plan: StructuredPlan): number {
  return plan.steps.filter((s) => s.status === STEP_STATUS.FAILED).length;
}

/**
 * Count skipped steps in a plan
 */
function countSkippedSteps(plan: StructuredPlan): number {
  return plan.steps.filter((s) => s.status === STEP_STATUS.SKIPPED).length;
}

