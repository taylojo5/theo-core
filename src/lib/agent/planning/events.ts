// ═══════════════════════════════════════════════════════════════════════════
// Plan Execution Events
// Event emitter and factory functions for streaming plan execution progress
// ═══════════════════════════════════════════════════════════════════════════

import type { RiskLevel } from "../constants";
import type {
  PlanExecutionEvent,
  PlanExecutionStartedEvent,
  StepStartingEvent,
  StepExecutionCompletedEvent,
  StepExecutionFailedEvent,
  StepSkippedEvent,
  PlanExecutionPausedEvent,
  PlanResumedEvent,
  PlanExecutionCompletedEvent,
  PlanExecutionFailedEvent,
  PlanCancelledEvent,
  ApprovalRequestedEvent,
  ApprovalReceivedEvent,
  PlanEventListener,
  AsyncPlanEventListener,
} from "./types";

// Re-export types for convenience (with aliases for backwards compatibility)
export type {
  PlanExecutionEvent,
  PlanExecutionStartedEvent as PlanStartedEvent,
  StepStartingEvent,
  StepExecutionCompletedEvent as StepCompletedEvent,
  StepExecutionFailedEvent as StepFailedEvent,
  StepSkippedEvent,
  PlanExecutionPausedEvent as PlanPausedEvent,
  PlanResumedEvent,
  PlanExecutionCompletedEvent as PlanCompletedEvent,
  PlanExecutionFailedEvent as PlanFailedEvent,
  PlanCancelledEvent,
  ApprovalRequestedEvent,
  ApprovalReceivedEvent,
  PlanEventListener,
  AsyncPlanEventListener,
};

// Aliases for internal use in factory functions
type PlanStartedEvent = PlanExecutionStartedEvent;
type StepCompletedEvent = StepExecutionCompletedEvent;
type StepFailedEvent = StepExecutionFailedEvent;
type PlanPausedEvent = PlanExecutionPausedEvent;
type PlanCompletedEvent = PlanExecutionCompletedEvent;
type PlanFailedEvent = PlanExecutionFailedEvent;

// ─────────────────────────────────────────────────────────────
// Event Emitter
// ─────────────────────────────────────────────────────────────

/**
 * Execution event emitter for a single plan
 *
 * Used to stream execution progress to clients (via SSE, WebSocket, etc.)
 */
export class PlanEventEmitter {
  private listeners: Set<PlanEventListener> = new Set();
  private asyncListeners: Set<AsyncPlanEventListener> = new Set();
  private eventHistory: PlanExecutionEvent[] = [];
  private readonly planId: string;
  private readonly maxHistorySize: number;

  constructor(planId: string, options?: { maxHistorySize?: number }) {
    this.planId = planId;
    this.maxHistorySize = options?.maxHistorySize ?? 100;
  }

  /**
   * Subscribe to events
   */
  subscribe(listener: PlanEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Subscribe with async handler
   */
  subscribeAsync(listener: AsyncPlanEventListener): () => void {
    this.asyncListeners.add(listener);
    return () => this.asyncListeners.delete(listener);
  }

  /**
   * Emit an event to all listeners
   */
  async emit(event: Omit<PlanExecutionEvent, "planId" | "timestamp">): Promise<void> {
    const fullEvent = {
      ...event,
      planId: this.planId,
      timestamp: new Date(),
    } as PlanExecutionEvent;

    // Store in history
    this.eventHistory.push(fullEvent);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Notify sync listeners
    for (const listener of this.listeners) {
      try {
        listener(fullEvent);
      } catch (error) {
        console.error("Error in plan event listener:", error);
      }
    }

    // Notify async listeners
    await Promise.all(
      Array.from(this.asyncListeners).map(async (listener) => {
        try {
          await listener(fullEvent);
        } catch (error) {
          console.error("Error in async plan event listener:", error);
        }
      })
    );
  }

  /**
   * Get event history
   */
  getHistory(): PlanExecutionEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Get last event of a specific type
   */
  getLastEvent<T extends PlanExecutionEvent["type"]>(
    type: T
  ): Extract<PlanExecutionEvent, { type: T }> | undefined {
    for (let i = this.eventHistory.length - 1; i >= 0; i--) {
      if (this.eventHistory[i].type === type) {
        return this.eventHistory[i] as Extract<PlanExecutionEvent, { type: T }>;
      }
    }
    return undefined;
  }

  /**
   * Clear all listeners
   */
  clear(): void {
    this.listeners.clear();
    this.asyncListeners.clear();
  }
}

// ─────────────────────────────────────────────────────────────
// Event Factory Functions
// ─────────────────────────────────────────────────────────────

/**
 * Create a plan_started event
 */
export function createPlanStartedEvent(
  goal: string,
  totalSteps: number,
  requiresApproval: boolean
): Omit<PlanStartedEvent, "planId" | "timestamp"> {
  return {
    type: "plan_started",
    goal,
    totalSteps,
    requiresApproval,
  };
}

/**
 * Create a step_starting event
 */
export function createStepStartingEvent(
  stepIndex: number,
  toolName: string,
  description: string,
  requiresApproval: boolean
): Omit<StepStartingEvent, "planId" | "timestamp"> {
  return {
    type: "step_starting",
    stepIndex,
    toolName,
    description,
    requiresApproval,
  };
}

/**
 * Create a step_completed event
 */
export function createStepCompletedEvent(
  stepIndex: number,
  toolName: string,
  description: string,
  durationMs: number,
  resultSummary?: string
): Omit<StepCompletedEvent, "planId" | "timestamp"> {
  return {
    type: "step_completed",
    stepIndex,
    toolName,
    description,
    durationMs,
    resultSummary,
  };
}

/**
 * Create a step_failed event
 */
export function createStepFailedEvent(
  stepIndex: number,
  toolName: string,
  description: string,
  error: string,
  retryable: boolean,
  durationMs: number
): Omit<StepFailedEvent, "planId" | "timestamp"> {
  return {
    type: "step_failed",
    stepIndex,
    toolName,
    description,
    error,
    retryable,
    durationMs,
  };
}

/**
 * Create a step_skipped event
 */
export function createStepSkippedEvent(
  stepIndex: number,
  toolName: string,
  description: string,
  reason: StepSkippedEvent["reason"]
): Omit<StepSkippedEvent, "planId" | "timestamp"> {
  return {
    type: "step_skipped",
    stepIndex,
    toolName,
    description,
    reason,
  };
}

/**
 * Create a plan_paused event
 */
export function createPlanPausedEvent(
  stepIndex: number,
  reason: PlanPausedEvent["reason"],
  options?: {
    approvalId?: string;
    toolName?: string;
    riskLevel?: RiskLevel;
  }
): Omit<PlanPausedEvent, "planId" | "timestamp"> {
  return {
    type: "plan_paused",
    stepIndex,
    reason,
    ...options,
  };
}

/**
 * Create a plan_resumed event
 */
export function createPlanResumedEvent(
  stepIndex: number,
  resumeReason: PlanResumedEvent["resumeReason"]
): Omit<PlanResumedEvent, "planId" | "timestamp"> {
  return {
    type: "plan_resumed",
    stepIndex,
    resumeReason,
  };
}

/**
 * Create a plan_completed event
 */
export function createPlanCompletedEvent(
  goal: string,
  successfulSteps: number,
  totalSteps: number,
  totalDurationMs: number
): Omit<PlanCompletedEvent, "planId" | "timestamp"> {
  return {
    type: "plan_completed",
    goal,
    successfulSteps,
    totalSteps,
    totalDurationMs,
  };
}

/**
 * Create a plan_failed event
 */
export function createPlanFailedEvent(
  goal: string,
  failedStepIndex: number,
  error: string,
  completedSteps: number,
  totalSteps: number
): Omit<PlanFailedEvent, "planId" | "timestamp"> {
  return {
    type: "plan_failed",
    goal,
    failedStepIndex,
    error,
    completedSteps,
    totalSteps,
  };
}

/**
 * Create a plan_cancelled event
 */
export function createPlanCancelledEvent(
  goal: string,
  cancelledAtStep: number,
  completedSteps: number,
  totalSteps: number,
  cancelledBy: PlanCancelledEvent["cancelledBy"]
): Omit<PlanCancelledEvent, "planId" | "timestamp"> {
  return {
    type: "plan_cancelled",
    goal,
    cancelledAtStep,
    completedSteps,
    totalSteps,
    cancelledBy,
  };
}

/**
 * Create an approval_requested event
 */
export function createApprovalRequestedEvent(
  stepIndex: number,
  approvalId: string,
  toolName: string,
  description: string,
  riskLevel: RiskLevel,
  expiresAt: Date
): Omit<ApprovalRequestedEvent, "planId" | "timestamp"> {
  return {
    type: "approval_requested",
    stepIndex,
    approvalId,
    toolName,
    description,
    riskLevel,
    expiresAt,
  };
}

/**
 * Create an approval_received event
 */
export function createApprovalReceivedEvent(
  stepIndex: number,
  approvalId: string,
  decision: ApprovalReceivedEvent["decision"],
  decidedBy?: string
): Omit<ApprovalReceivedEvent, "planId" | "timestamp"> {
  return {
    type: "approval_received",
    stepIndex,
    approvalId,
    decision,
    decidedBy,
  };
}

