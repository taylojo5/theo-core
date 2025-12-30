// ═══════════════════════════════════════════════════════════════════════════
// Plan Executor
// Executes structured plans step-by-step with approval pausing and recovery
// ═══════════════════════════════════════════════════════════════════════════

import { PLAN_STATUS, STEP_STATUS } from "../constants";
import { agentLogger } from "../logger";
import { executeToolCall } from "../execution/engine";
import { createPendingApproval, updateApprovalStatus } from "../execution/approval";
import { toolRegistry } from "../tools/registry";
import { planRepository } from "./repository";
import { resolveStepOutputs, validateOutputReferences } from "./output-resolver";
import {
  PlanEventEmitter,
  createPlanStartedEvent,
  createStepStartingEvent,
  createStepCompletedEvent,
  createStepFailedEvent,
  createStepSkippedEvent,
  createPlanPausedEvent,
  createPlanResumedEvent,
  createPlanCompletedEvent,
  createPlanFailedEvent,
  createPlanCancelledEvent,
  createApprovalRequestedEvent,
  createApprovalReceivedEvent,
} from "./events";
import {
  PlanningError,
  type StructuredPlan,
  type StructuredStep,
  type ExecutionOptions,
  type PlanExecutionResult,
  type StepExecutionResult,
} from "./types";
import type { ExecutionOutcome, ToolExecutionSuccess, PendingApprovalResult } from "../execution/types";

// Re-export types for convenience
export type { ExecutionOptions, PlanExecutionResult, StepExecutionResult };

const logger = agentLogger.child("plan-executor");

// ─────────────────────────────────────────────────────────────
// Active Plan Executors (for event routing)
// ─────────────────────────────────────────────────────────────

const activeExecutors = new Map<string, PlanEventEmitter>();

/**
 * Get the event emitter for a plan (if executing)
 */
export function getPlanEventEmitter(planId: string): PlanEventEmitter | undefined {
  return activeExecutors.get(planId);
}

// ─────────────────────────────────────────────────────────────
// Main Execution Functions
// ─────────────────────────────────────────────────────────────

/**
 * Execute a structured plan step by step
 *
 * This is the main entry point for plan execution. It:
 * 1. Loads the plan from the database
 * 2. Validates the plan can be executed
 * 3. Executes steps sequentially, respecting dependencies
 * 4. Pauses at approval steps
 * 5. Updates plan/step status in the database
 *
 * @param planId - ID of the plan to execute
 * @param options - Execution options
 * @returns Execution result
 */
export async function executePlan(
  planId: string,
  options: ExecutionOptions
): Promise<PlanExecutionResult> {
  const startTime = Date.now();
  const stepResults = new Map<number, unknown>();

  logger.info("Starting plan execution", { planId });

  // Load the plan
  const plan = await planRepository.getById(planId);
  if (!plan) {
    throw new PlanningError("plan_not_found", `Plan ${planId} not found`, planId);
  }

  // Validate the plan can be executed
  if (plan.status === PLAN_STATUS.COMPLETED) {
    throw new PlanningError(
      "plan_already_completed",
      "Plan has already been completed",
      planId
    );
  }

  if (plan.status === PLAN_STATUS.FAILED) {
    throw new PlanningError(
      "plan_already_failed",
      "Plan has already failed",
      planId
    );
  }

  if (plan.status === PLAN_STATUS.CANCELLED) {
    throw new PlanningError(
      "invalid_state_transition",
      "Cannot execute cancelled plan",
      planId
    );
  }

  // Reuse existing emitter if one is already registered (e.g., from resumePlan)
  // This ensures events from the calling function aren't lost when executePlan is called
  const existingEmitter = activeExecutors.get(planId);
  const emitter = existingEmitter ?? new PlanEventEmitter(planId);
  const ownsEmitter = !existingEmitter; // Only clean up if we created it
  
  if (!existingEmitter) {
    activeExecutors.set(planId, emitter);
  }

  // Subscribe event listeners (these are additive, won't duplicate if already subscribed)
  if (options.onEvent) {
    emitter.subscribe(options.onEvent);
  }
  if (options.onEventAsync) {
    emitter.subscribeAsync(options.onEventAsync);
  }

  let completedSteps = 0;
  let failedSteps = 0;
  let skippedSteps = 0;
  let stoppedAtStep = plan.currentStepIndex;
  let paused = false;
  let pendingApprovalId: string | undefined;
  let error: string | undefined;

  try {
    // Start execution (skip if already executing, e.g., when called from resumePlan)
    if (plan.status !== PLAN_STATUS.EXECUTING) {
      await planRepository.startExecution(planId);
      await emitter.emit(
        createPlanStartedEvent(plan.goal, plan.steps.length, plan.requiresApproval)
      );
    }

    // Collect results from previously completed steps
    for (const step of plan.steps) {
      if (step.status === STEP_STATUS.COMPLETED && step.result !== undefined) {
        stepResults.set(step.index, step.result);
        completedSteps++;
      } else if (step.status === STEP_STATUS.FAILED) {
        failedSteps++;
      } else if (step.status === STEP_STATUS.SKIPPED) {
        skippedSteps++;
      }
    }

    // Execute remaining steps
    for (let i = plan.currentStepIndex; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      stoppedAtStep = i;

      // Skip already completed/failed/skipped steps
      if (
        step.status === STEP_STATUS.COMPLETED ||
        step.status === STEP_STATUS.FAILED ||
        step.status === STEP_STATUS.SKIPPED
      ) {
        continue;
      }

      // Check dependencies
      const dependencyResult = checkDependencies(step, plan);
      if (!dependencyResult.canExecute) {
        // Skip step if dependencies failed
        await planRepository.skipStep(step.id);
        await emitter.emit(
          createStepSkippedEvent(
            step.index,
            step.toolName,
            step.description,
            "dependency_failed"
          )
        );
        skippedSteps++;

        if (options.stopOnFailure) {
          error = `Step ${i} skipped due to failed dependencies`;
          break;
        }
        continue;
      }

      // Execute the step
      const stepResult = await executeStep(plan, step, options, emitter, stepResults);

      if (stepResult.approvalRequested) {
        // Plan paused for approval
        paused = true;
        pendingApprovalId = stepResult.approvalId;
        await planRepository.pauseExecution(planId);
        break;
      }

      if (stepResult.success) {
        stepResults.set(step.index, stepResult.result);
        completedSteps++;

        // Update current step index
        await planRepository.updateCurrentStep(planId, i + 1);
      } else {
        failedSteps++;
        error = stepResult.error;

        if (options.stopOnFailure) {
          break;
        }
      }
    }

    // Determine final status
    const allStepsProcessed = stoppedAtStep === plan.steps.length - 1;
    const allSucceeded = failedSteps === 0 && skippedSteps === 0;
    const success = allStepsProcessed && allSucceeded && !paused;

    // Update plan status (if not paused)
    if (!paused) {
      if (success) {
        await planRepository.completePlan(planId);
        await emitter.emit(
          createPlanCompletedEvent(
            plan.goal,
            completedSteps,
            plan.steps.length,
            Date.now() - startTime
          )
        );
      } else if (failedSteps > 0 || error) {
        await planRepository.failPlan(planId);
        await emitter.emit(
          createPlanFailedEvent(
            plan.goal,
            stoppedAtStep,
            error || "Unknown error",
            completedSteps,
            plan.steps.length
          )
        );
      }
    }

    // Get final plan state
    const finalPlan = await planRepository.getById(planId);

    return {
      plan: finalPlan!,
      success: success && !error,
      paused,
      pendingApprovalId,
      stoppedAtStep,
      completedSteps,
      failedSteps,
      skippedSteps,
      durationMs: Date.now() - startTime,
      stepResults,
      error,
    };
  } finally {
    // Only clean up if we created the emitter (not if reusing from resumePlan)
    if (ownsEmitter) {
      emitter.clear();
      activeExecutors.delete(planId);
    }
  }
}

/**
 * Execute a single step
 *
 * @param plan - The plan containing the step
 * @param step - The step to execute
 * @param options - Execution options
 * @param emitter - Event emitter for this plan
 * @param stepResults - Results from previous steps (for output injection)
 * @returns Step execution result
 */
async function executeStep(
  plan: StructuredPlan,
  step: StructuredStep,
  options: ExecutionOptions,
  emitter: PlanEventEmitter,
  stepResults: Map<number, unknown>
): Promise<StepExecutionResult> {
  const startTime = Date.now();

  logger.debug("Executing step", {
    planId: plan.id,
    stepIndex: step.index,
    toolName: step.toolName,
  });

  // ─────────────────────────────────────────────────────────────
  // Pre-execution validation (before marking step as executing)
  // This ensures we don't transition to EXECUTING if validation fails
  // ─────────────────────────────────────────────────────────────

  // Validate output references before starting execution
  const refErrors = validateOutputReferences(step, plan);
  if (refErrors.length > 0) {
    const errorMessage = `Invalid output references: ${refErrors.map((e) => e.message).join("; ")}`;
    logger.warn("Step validation failed before execution", {
      planId: plan.id,
      stepIndex: step.index,
      errors: refErrors,
    });
    
    // Mark step as failed without ever transitioning to EXECUTING
    await planRepository.failStep(step.id, errorMessage);
    await emitter.emit(
      createStepFailedEvent(
        step.index,
        step.toolName,
        step.description,
        errorMessage,
        false, // Not retryable - this is a validation error
        Date.now() - startTime
      )
    );
    
    return {
      step,
      success: false,
      approvalRequested: false,
      error: errorMessage,
      durationMs: Date.now() - startTime,
    };
  }

  // Build a temporary plan with injected results for resolution
  const planWithResults = buildPlanWithResults(plan, stepResults);

  // Resolve step output references (pre-validate before execution)
  const resolution = resolveStepOutputs(step, planWithResults);
  if (!resolution.success) {
    const errorMessage = `Failed to resolve step outputs: ${resolution.errors.map((e) => e.message).join("; ")}`;
    logger.warn("Step output resolution failed before execution", {
      planId: plan.id,
      stepIndex: step.index,
      errors: resolution.errors,
    });
    
    // Mark step as failed without ever transitioning to EXECUTING
    await planRepository.failStep(step.id, errorMessage);
    await emitter.emit(
      createStepFailedEvent(
        step.index,
        step.toolName,
        step.description,
        errorMessage,
        false, // Not retryable - this is a resolution error
        Date.now() - startTime
      )
    );
    
    return {
      step,
      success: false,
      approvalRequested: false,
      error: errorMessage,
      durationMs: Date.now() - startTime,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Validation passed - now start execution
  // ─────────────────────────────────────────────────────────────

  // Emit step starting event
  await emitter.emit(
    createStepStartingEvent(
      step.index,
      step.toolName,
      step.description,
      step.requiresApproval
    )
  );

  // Update step status to executing (only after validation passes)
  await planRepository.startStepExecution(step.id);

  try {

    // Check if step requires approval
    if (step.requiresApproval && !options.skipApprovals) {
      // Create approval record
      const tool = toolRegistry.get(step.toolName);
      const { approval } = await createPendingApproval({
        userId: plan.userId,
        toolName: step.toolName,
        parameters: resolution.resolvedParams,
        actionType: tool?.category ?? "unknown",
        riskLevel: tool?.riskLevel ?? "medium",
        reasoning: step.description,
        planId: plan.id,
        stepIndex: step.index,
        conversationId: plan.conversationId,
      });

      // Update step with approval ID
      await planRepository.markStepAwaitingApproval(step.id, approval.id);

      // Emit events
      await emitter.emit(
        createApprovalRequestedEvent(
          step.index,
          approval.id,
          step.toolName,
          step.description,
          tool?.riskLevel ?? "medium",
          approval.expiresAt!
        )
      );

      await emitter.emit(
        createPlanPausedEvent(step.index, "approval_needed", {
          approvalId: approval.id,
          toolName: step.toolName,
          riskLevel: tool?.riskLevel,
        })
      );

      logger.info("Step paused for approval", {
        planId: plan.id,
        stepIndex: step.index,
        approvalId: approval.id,
      });

      return {
        step,
        success: false,
        approvalRequested: true,
        approvalId: approval.id,
        durationMs: Date.now() - startTime,
      };
    }

    // Execute the tool
    const outcome = await executeToolCall({
      toolName: step.toolName,
      parameters: resolution.resolvedParams,
      context: {
        ...options.context,
        planId: plan.id,
        stepIndex: step.index,
      },
      decision: {
        action: "execute",
        confidence: 1.0,
        reasoning: step.description,
      },
    });

    const durationMs = Date.now() - startTime;

    if (isSuccessfulExecution(outcome)) {
      // Step succeeded
      await planRepository.completeStep(step.id, outcome.result);
      await emitter.emit(
        createStepCompletedEvent(
          step.index,
          step.toolName,
          step.description,
          durationMs,
          summarizeResult(outcome.result)
        )
      );

      logger.info("Step completed successfully", {
        planId: plan.id,
        stepIndex: step.index,
        durationMs,
      });

      return {
        step,
        success: true,
        approvalRequested: false,
        result: outcome.result,
        durationMs,
      };
    }

    // Step failed
    const errorMessage = isFailedExecution(outcome)
      ? outcome.error.message
      : "Unknown error";

    await planRepository.failStep(step.id, errorMessage);
    await emitter.emit(
      createStepFailedEvent(
        step.index,
        step.toolName,
        step.description,
        errorMessage,
        isFailedExecution(outcome) ? outcome.error.retryable : false,
        durationMs
      )
    );

    logger.warn("Step failed", {
      planId: plan.id,
      stepIndex: step.index,
      error: errorMessage,
      durationMs,
    });

    return {
      step,
      success: false,
      approvalRequested: false,
      error: errorMessage,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    await planRepository.failStep(step.id, errorMessage);
    await emitter.emit(
      createStepFailedEvent(
        step.index,
        step.toolName,
        step.description,
        errorMessage,
        false,
        durationMs
      )
    );

    logger.error("Step execution error", {
      planId: plan.id,
      stepIndex: step.index,
      error: errorMessage,
      durationMs,
    });

    return {
      step,
      success: false,
      approvalRequested: false,
      error: errorMessage,
      durationMs,
    };
  }
}

/**
 * Resume plan execution after approval
 *
 * Called when a pending approval has been granted. Executes the
 * approved step and continues with remaining steps.
 *
 * @param planId - ID of the plan to resume
 * @param approvalId - ID of the approval that was granted
 * @param options - Execution options
 * @returns Execution result
 */
export async function resumePlan(
  planId: string,
  approvalId: string,
  options: ExecutionOptions
): Promise<PlanExecutionResult> {
  const startTime = Date.now();
  
  logger.info("Resuming plan after approval", { planId, approvalId });

  // Load the plan
  const plan = await planRepository.getById(planId);
  if (!plan) {
    throw new PlanningError("plan_not_found", `Plan ${planId} not found`, planId);
  }

  // Verify plan is paused
  if (plan.status !== PLAN_STATUS.PAUSED) {
    throw new PlanningError(
      "plan_not_pending",
      `Plan is not paused (status: ${plan.status})`,
      planId
    );
  }

  // Find the step awaiting approval
  const stepIndex = plan.steps.findIndex(
    (s) => s.status === STEP_STATUS.AWAITING_APPROVAL && s.approvalId === approvalId
  );

  if (stepIndex === -1) {
    throw new PlanningError(
      "step_not_found",
      `No step found awaiting approval ${approvalId}`,
      planId
    );
  }

  const step = plan.steps[stepIndex];

  // Reuse existing emitter if one is already registered, otherwise create new one
  // This prevents orphaning listeners if executePlan is somehow still running
  const existingEmitter = activeExecutors.get(planId);
  const emitter = existingEmitter ?? new PlanEventEmitter(planId);
  const ownsEmitter = !existingEmitter;
  
  if (!existingEmitter) {
    activeExecutors.set(planId, emitter);
  }

  // Subscribe event listeners (additive, won't duplicate)
  if (options.onEvent) {
    emitter.subscribe(options.onEvent);
  }
  if (options.onEventAsync) {
    emitter.subscribeAsync(options.onEventAsync);
  }

  try {
    // Emit approval received event
    await emitter.emit(
      createApprovalReceivedEvent(stepIndex, approvalId, "approved")
    );

    // Emit plan resumed event
    await emitter.emit(createPlanResumedEvent(stepIndex, "approval_granted"));

    // Start execution
    await planRepository.startExecution(planId);

    // Execute the approved step directly (skip approval check since it was just approved)
    // This avoids the infinite approval loop that would occur if we called executePlan
    // with the step still in PENDING status and requiresApproval: true
    const stepResults = new Map<number, unknown>();
    
    // Collect results from previously completed steps for output resolution
    for (const s of plan.steps) {
      if (s.status === STEP_STATUS.COMPLETED && s.result !== undefined) {
        stepResults.set(s.index, s.result);
      }
    }

    // Clear approval status from step and set to pending before execution
    await planRepository.updateStepStatus(step.id, {
      status: STEP_STATUS.PENDING,
      approvalId: undefined,
    });

    // Reload step with cleared status
    const updatedPlan = await planRepository.getById(planId);
    const updatedStep = updatedPlan!.steps[stepIndex];

    // Execute the step with skipApprovals: true for THIS step only
    const stepResult = await executeStep(
      updatedPlan!,
      updatedStep,
      { ...options, skipApprovals: true }, // Skip approval for the just-approved step
      emitter,
      stepResults
    );

    if (stepResult.success) {
      stepResults.set(step.index, stepResult.result);
      // Update current step to next step
      await planRepository.updateCurrentStep(planId, stepIndex + 1);

      // Check if there are more steps to execute
      if (stepIndex + 1 >= plan.steps.length) {
        // This was the last step - complete the plan
        await planRepository.completePlan(planId);
        const finalPlan = await planRepository.getById(planId);
        
        const totalDurationMs = Date.now() - startTime;
        
        await emitter.emit(
          createPlanCompletedEvent(
            finalPlan!.goal,
            finalPlan!.steps.filter(s => s.status === STEP_STATUS.COMPLETED).length,
            finalPlan!.steps.length,
            totalDurationMs
          )
        );

        return {
          plan: finalPlan!,
          success: true,
          paused: false,
          stoppedAtStep: stepIndex,
          completedSteps: finalPlan!.steps.filter(s => s.status === STEP_STATUS.COMPLETED).length,
          failedSteps: finalPlan!.steps.filter(s => s.status === STEP_STATUS.FAILED).length,
          skippedSteps: finalPlan!.steps.filter(s => s.status === STEP_STATUS.SKIPPED).length,
          durationMs: totalDurationMs,
          stepResults,
        };
      }

      // Continue with remaining steps (normal approval flow)
      const result = await executePlan(planId, {
        ...options,
        skipApprovals: false,
      });

      return result;
    } else if (stepResult.approvalRequested) {
      // This shouldn't happen since we set skipApprovals: true, but handle it
      const pausedPlan = await planRepository.getById(planId);
      return {
        plan: pausedPlan!,
        success: false,
        paused: true,
        pendingApprovalId: stepResult.approvalId,
        stoppedAtStep: stepIndex,
        completedSteps: pausedPlan!.steps.filter(s => s.status === STEP_STATUS.COMPLETED).length,
        failedSteps: pausedPlan!.steps.filter(s => s.status === STEP_STATUS.FAILED).length,
        skippedSteps: pausedPlan!.steps.filter(s => s.status === STEP_STATUS.SKIPPED).length,
        durationMs: Date.now() - startTime,
        stepResults,
      };
    } else {
      // Step failed
      await planRepository.failPlan(planId);
      const failedPlan = await planRepository.getById(planId);
      
      // Count actual step statuses for accurate metrics
      const completedCount = failedPlan!.steps.filter(s => s.status === STEP_STATUS.COMPLETED).length;
      const failedCount = failedPlan!.steps.filter(s => s.status === STEP_STATUS.FAILED).length;
      const skippedCount = failedPlan!.steps.filter(s => s.status === STEP_STATUS.SKIPPED).length;
      
      await emitter.emit(
        createPlanFailedEvent(
          failedPlan!.goal,
          stepIndex,
          stepResult.error || "Unknown error",
          completedCount,
          failedPlan!.steps.length
        )
      );

      return {
        plan: failedPlan!,
        success: false,
        paused: false,
        stoppedAtStep: stepIndex,
        completedSteps: completedCount,
        failedSteps: failedCount,
        skippedSteps: skippedCount,
        durationMs: Date.now() - startTime,
        stepResults,
        error: stepResult.error,
      };
    }
  } finally {
    // Only clean up if we created the emitter
    if (ownsEmitter) {
      emitter.clear();
      activeExecutors.delete(planId);
    }
  }
}

/**
 * Resume plan after rejection - skip the rejected step and continue
 *
 * @param planId - ID of the plan to resume
 * @param approvalId - ID of the approval that was rejected
 * @param options - Execution options
 * @returns Execution result
 */
export async function resumePlanAfterRejection(
  planId: string,
  approvalId: string,
  options: ExecutionOptions
): Promise<PlanExecutionResult> {
  logger.info("Resuming plan after rejection", { planId, approvalId });

  // Load the plan
  const plan = await planRepository.getById(planId);
  if (!plan) {
    throw new PlanningError("plan_not_found", `Plan ${planId} not found`, planId);
  }

  // Verify plan is paused
  if (plan.status !== PLAN_STATUS.PAUSED) {
    throw new PlanningError(
      "plan_not_pending",
      `Plan is not paused (status: ${plan.status})`,
      planId
    );
  }

  // Find the step awaiting approval
  const stepIndex = plan.steps.findIndex(
    (s) => s.status === STEP_STATUS.AWAITING_APPROVAL && s.approvalId === approvalId
  );

  if (stepIndex === -1) {
    throw new PlanningError(
      "step_not_found",
      `No step found awaiting approval ${approvalId}`,
      planId
    );
  }

  const step = plan.steps[stepIndex];

  // Reuse existing emitter if one is already registered, otherwise create new one
  // This prevents orphaning listeners if executePlan is somehow still running
  const existingEmitter = activeExecutors.get(planId);
  const emitter = existingEmitter ?? new PlanEventEmitter(planId);
  const ownsEmitter = !existingEmitter;
  
  if (!existingEmitter) {
    activeExecutors.set(planId, emitter);
  }

  // Subscribe event listeners (additive, won't duplicate)
  if (options.onEvent) {
    emitter.subscribe(options.onEvent);
  }
  if (options.onEventAsync) {
    emitter.subscribeAsync(options.onEventAsync);
  }

  try {
    // Emit rejection event
    await emitter.emit(
      createApprovalReceivedEvent(stepIndex, approvalId, "rejected")
    );

    // Skip the rejected step
    await planRepository.skipStep(step.id);
    await emitter.emit(
      createStepSkippedEvent(
        step.index,
        step.toolName,
        step.description,
        "user_cancelled"
      )
    );

    // Update to next step
    await planRepository.updateCurrentStep(planId, stepIndex + 1);

    // Resume from next step
    await planRepository.startExecution(planId);

    // executePlan will reuse our emitter since it's already registered
    return await executePlan(planId, options);
  } finally {
    // Only clean up if we created the emitter
    if (ownsEmitter) {
      emitter.clear();
      activeExecutors.delete(planId);
    }
  }
}

/**
 * Cancel plan execution
 *
 * @param planId - ID of the plan to cancel
 * @param options - Options for cancellation
 */
export async function cancelPlan(
  planId: string,
  options?: { cancelledBy?: "user" | "system" }
): Promise<StructuredPlan> {
  logger.info("Cancelling plan", { planId });

  const plan = await planRepository.getById(planId);
  if (!plan) {
    throw new PlanningError("plan_not_found", `Plan ${planId} not found`, planId);
  }

  // Check plan can be cancelled
  if (
    plan.status === PLAN_STATUS.COMPLETED ||
    plan.status === PLAN_STATUS.CANCELLED
  ) {
    throw new PlanningError(
      "invalid_state_transition",
      `Cannot cancel plan with status: ${plan.status}`,
      planId
    );
  }

  // Cancel any pending approvals
  for (const step of plan.steps) {
    if (step.status === STEP_STATUS.AWAITING_APPROVAL && step.approvalId) {
      await updateApprovalStatus(plan.userId, step.approvalId, "rejected", {
        errorMessage: "Plan cancelled",
      });
    }
  }

  // Skip remaining pending steps
  const completedSteps = plan.steps.filter(
    (s) => s.status === STEP_STATUS.COMPLETED
  ).length;

  for (const step of plan.steps) {
    if (
      step.status === STEP_STATUS.PENDING ||
      step.status === STEP_STATUS.AWAITING_APPROVAL
    ) {
      await planRepository.skipStep(step.id);
    }
  }

  // Update plan status
  const cancelledPlan = await planRepository.cancelPlan(planId);

  // Emit cancellation event if there's an active emitter
  const emitter = activeExecutors.get(planId);
  if (emitter) {
    await emitter.emit(
      createPlanCancelledEvent(
        plan.goal,
        plan.currentStepIndex,
        completedSteps,
        plan.steps.length,
        options?.cancelledBy ?? "user"
      )
    );
  }

  logger.info("Plan cancelled", { planId, completedSteps });

  return cancelledPlan;
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Check if a step's dependencies are satisfied
 */
function checkDependencies(
  step: StructuredStep,
  plan: StructuredPlan
): { canExecute: boolean; failedDeps: string[] } {
  const failedDeps: string[] = [];

  for (const depId of step.dependsOn) {
    const depStep = plan.steps.find((s) => s.id === depId);
    if (!depStep) {
      failedDeps.push(depId);
      continue;
    }

    if (depStep.status !== STEP_STATUS.COMPLETED) {
      failedDeps.push(depId);
    }
  }

  return {
    canExecute: failedDeps.length === 0,
    failedDeps,
  };
}

/**
 * Build a plan with injected step results for output resolution
 */
function buildPlanWithResults(
  plan: StructuredPlan,
  stepResults: Map<number, unknown>
): StructuredPlan {
  const stepsWithResults = plan.steps.map((step) => {
    const result = stepResults.get(step.index);
    if (result !== undefined) {
      return {
        ...step,
        status: STEP_STATUS.COMPLETED,
        result,
      };
    }
    return step;
  }) as StructuredStep[];

  return {
    ...plan,
    steps: stepsWithResults,
  };
}

/**
 * Summarize a result for display
 */
function summarizeResult(result: unknown): string {
  if (result === null || result === undefined) {
    return "No result";
  }

  if (typeof result === "string") {
    return result.length > 100 ? result.slice(0, 100) + "..." : result;
  }

  if (typeof result === "object") {
    const json = JSON.stringify(result);
    return json.length > 100 ? json.slice(0, 100) + "..." : json;
  }

  return String(result);
}

/**
 * Type guard for successful execution
 */
function isSuccessfulExecution(
  outcome: ExecutionOutcome
): outcome is ToolExecutionSuccess {
  return (
    outcome.success &&
    !("approvalRequired" in outcome && outcome.approvalRequired)
  );
}

/**
 * Type guard for failed execution
 */
function isFailedExecution(
  outcome: ExecutionOutcome
): outcome is import("../execution/types").ToolExecutionFailure {
  return !outcome.success;
}

/**
 * Type guard for pending approval
 * @internal Exported for future use in recovery scenarios
 */
function _isPendingApproval(
  outcome: ExecutionOutcome
): outcome is PendingApprovalResult {
  return outcome.success && "approvalRequired" in outcome && outcome.approvalRequired;
}

// ─────────────────────────────────────────────────────────────
// Query Functions
// ─────────────────────────────────────────────────────────────

/**
 * Get pending plans for a user that need attention
 */
export async function getPendingPlans(
  userId: string
): Promise<StructuredPlan[]> {
  return planRepository.getByUserId(userId, {
    status: [PLAN_STATUS.PAUSED, PLAN_STATUS.PLANNED],
    includeSteps: true,
  });
}

/**
 * Get interrupted plans (executing when server restarted)
 */
export async function getInterruptedPlans(
  userId: string
): Promise<StructuredPlan[]> {
  return planRepository.getByUserId(userId, {
    status: [PLAN_STATUS.EXECUTING],
    includeSteps: true,
  });
}

