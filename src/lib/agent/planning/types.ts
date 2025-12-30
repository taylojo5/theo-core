// ═══════════════════════════════════════════════════════════════════════════
// Plan Generation & Structuring Types
// Types for LLM-generated plans and agent-structured execution plans
// ═══════════════════════════════════════════════════════════════════════════

import type {
  LLMGeneratedPlan,
  LLMPlanStep,
  LLMAssumption,
  ToolForLLM,
} from "../llm/types";
import type { ResolvedEntity } from "../types";
import type { RankedContextItem } from "../context/types";
import type { PlanStatus, StepStatus, RiskLevel } from "../constants";

// Re-export LLM types for convenience
export type { LLMGeneratedPlan, LLMPlanStep, LLMAssumption };

// ─────────────────────────────────────────────────────────────
// Planning Context Types
// ─────────────────────────────────────────────────────────────

/**
 * Context provided to the planning process
 */
export interface PlanningContext {
  /** User making the request */
  userId: string;

  /** Available tools for planning */
  availableTools: ToolForLLM[];

  /** Entities resolved from user input */
  resolvedEntities: ResolvedEntity[];

  /** Relevant context from retrieval */
  relevantContext: RankedContextItem[];

  /** User's timezone */
  timezone?: string;

  /** Current timestamp */
  currentTime?: Date;

  /** Conversation ID (if in a conversation) */
  conversationId?: string;

  /** Session ID */
  sessionId?: string;
}

/**
 * Constraints for plan generation
 */
export interface PlanConstraints {
  /** Maximum number of steps allowed */
  maxSteps?: number;

  /** Tool names that always require approval */
  requireApprovalBefore?: string[];

  /** Maximum allowed plan duration (for estimation) */
  maxDurationMinutes?: number;

  /** Whether to allow risky operations */
  allowHighRisk?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Structured Plan Types (Agent-side)
// ─────────────────────────────────────────────────────────────

/**
 * A structured, validated execution plan
 * 
 * This is the agent's representation of an LLM-generated plan,
 * validated and ready for execution.
 */
export interface StructuredPlan {
  /** Unique plan identifier */
  id: string;

  /** User who owns this plan */
  userId: string;

  /** The goal this plan achieves */
  goal: string;

  /** Goal type/category */
  goalType: string;

  /** Current status of the plan */
  status: PlanStatus;

  /** Steps in execution order */
  steps: StructuredStep[];

  /** Index of the current step (0-based) */
  currentStepIndex: number;

  /** Whether any step requires approval */
  requiresApproval: boolean;

  /** LLM's reasoning for this plan */
  reasoning: string;

  /** Assumptions made during planning */
  assumptions: StoredAssumption[];

  /** Confidence in plan success (0.0 - 1.0) */
  confidence: number;

  /** Conversation this plan belongs to (if any) */
  conversationId?: string;

  /** When the plan was approved */
  approvedAt?: Date;

  /** Who approved the plan */
  approvedBy?: string;

  /** When the plan was created */
  createdAt: Date;

  /** When the plan was last updated */
  updatedAt: Date;

  /** When the plan completed */
  completedAt?: Date;
}

/**
 * A single step in a structured plan
 */
export interface StructuredStep {
  /** Unique step identifier */
  id: string;

  /** Plan this step belongs to */
  planId: string;

  /** Order of this step (0-based) */
  index: number;

  /** Tool to execute */
  toolName: string;

  /** Validated parameters for the tool */
  parameters: Record<string, unknown>;

  /** IDs of steps this step depends on */
  dependsOn: string[];

  /** Indices of steps this depends on (for convenience) */
  dependsOnIndices: number[];

  /** Description of what this step does */
  description: string;

  /** Current status of this step */
  status: StepStatus;

  /** Whether this step requires approval */
  requiresApproval: boolean;

  /** Approval ID (if awaiting approval) */
  approvalId?: string;

  /** Result of execution (if completed) */
  result?: unknown;

  /** Error message (if failed) */
  errorMessage?: string;

  /** Rollback action definition (if reversible) */
  rollbackAction?: RollbackAction;

  /** When the step was rolled back */
  rolledBackAt?: Date;

  /** When the step was created */
  createdAt: Date;

  /** When the step was executed */
  executedAt?: Date;
}

/**
 * Definition of a rollback action for a step
 */
export interface RollbackAction {
  /** Tool to use for rollback */
  toolName: string;

  /** Parameters for the rollback tool */
  parameters: Record<string, unknown>;
}

/**
 * An assumption stored with a plan
 */
export interface StoredAssumption {
  /** Unique identifier */
  id: string;

  /** The assumption statement */
  statement: string;

  /** Category of assumption */
  category: "intent" | "context" | "preference" | "inference";

  /** Evidence supporting this assumption */
  evidence: string[];

  /** Confidence in this assumption (0.0 - 1.0) */
  confidence: number;

  /** Whether verified by user */
  verified?: boolean;

  /** When verified */
  verifiedAt?: Date;

  /** User's correction (if wrong) */
  correction?: string;
}

// ─────────────────────────────────────────────────────────────
// Validation Types
// ─────────────────────────────────────────────────────────────

/**
 * Result of validating an LLM-generated plan
 */
export interface PlanValidationResult {
  /** Whether the plan is valid */
  valid: boolean;

  /** Validation errors (if invalid) */
  errors: PlanValidationError[];

  /** Warnings (plan valid but may have issues) */
  warnings: PlanValidationWarning[];

  /** Validated plan (if valid) */
  validatedPlan?: ValidatedLLMPlan;
}

/**
 * LLM plan after validation (with corrected/normalized values)
 */
export interface ValidatedLLMPlan extends LLMGeneratedPlan {
  /** Steps with validation metadata */
  validatedSteps: ValidatedStep[];
}

/**
 * A step that has passed validation
 */
export interface ValidatedStep extends LLMPlanStep {
  /** The tool definition (confirmed to exist) */
  toolExists: boolean;

  /** Whether parameters passed Zod validation */
  parametersValid: boolean;

  /** Corrected parameters (if any coercion was applied) */
  correctedParameters?: Record<string, unknown>;
}

/**
 * A validation error in a plan
 */
export interface PlanValidationError {
  /** Error code */
  code: PlanValidationErrorCode;

  /** Human-readable error message */
  message: string;

  /** Step index this error relates to (-1 for plan-level) */
  stepIndex: number;

  /** Field path within the step (if applicable) */
  fieldPath?: string;

  /** Expected value or type */
  expected?: string;

  /** Received value or type */
  received?: string;
}

/**
 * Validation error codes
 */
export type PlanValidationErrorCode =
  | "empty_plan"
  | "tool_not_found"
  | "invalid_parameters"
  | "missing_required_param"
  | "invalid_dependency"
  | "cyclic_dependency"
  | "dependency_out_of_order"
  | "too_many_steps"
  | "invalid_step_order"
  | "duplicate_step_order"
  | "missing_goal"
  | "invalid_confidence";

/**
 * A validation warning (plan valid but may have issues)
 */
export interface PlanValidationWarning {
  /** Warning code */
  code: PlanValidationWarningCode;

  /** Human-readable warning message */
  message: string;

  /** Step index this warning relates to (-1 for plan-level) */
  stepIndex: number;
}

/**
 * Validation warning codes
 */
export type PlanValidationWarningCode =
  | "high_risk_tool"
  | "no_rollback"
  | "low_confidence"
  | "many_dependencies"
  | "long_plan"
  | "approval_heavy";

// ─────────────────────────────────────────────────────────────
// Repository Types
// ─────────────────────────────────────────────────────────────

/**
 * Input for creating a plan
 */
export interface CreatePlanInput {
  /** User ID */
  userId: string;

  /** Goal description */
  goal: string;

  /** Goal type/category */
  goalType: string;

  /** Whether any step requires approval */
  requiresApproval: boolean;

  /** LLM's reasoning */
  reasoning: string;

  /** Assumptions made during planning */
  assumptions: Omit<StoredAssumption, "id">[];

  /** Confidence score */
  confidence: number;

  /** Associated conversation (optional) */
  conversationId?: string;

  /** Steps to create */
  steps: CreateStepInput[];
}

/**
 * Input for creating a step
 */
export interface CreateStepInput {
  /** Step order (0-based) */
  stepOrder: number;

  /** Tool name */
  toolName: string;

  /** Tool parameters */
  toolParams: Record<string, unknown>;

  /** IDs of steps this depends on */
  dependsOn: string[];

  /** Step description */
  description: string;

  /** Whether this step requires approval */
  requiresApproval: boolean;

  /** Rollback action (optional) */
  rollbackAction?: RollbackAction;
}

/**
 * Input for updating plan status
 */
export interface UpdatePlanStatusInput {
  /** New status */
  status: PlanStatus;

  /** Current step index */
  currentStep?: number;

  /** When approved */
  approvedAt?: Date;

  /** Who approved */
  approvedBy?: string;

  /** When completed */
  completedAt?: Date;
}

/**
 * Input for updating step status
 */
export interface UpdateStepStatusInput {
  /** New status */
  status: StepStatus;

  /** Execution result (if completed) */
  result?: unknown;

  /** Error message (if failed) */
  errorMessage?: string;

  /** When executed */
  executedAt?: Date;

  /** When rolled back */
  rolledBackAt?: Date;

  /** Approval ID (if awaiting approval) */
  approvalId?: string;
}

/**
 * Options for querying plans
 */
export interface PlanQueryOptions {
  /** Filter by status */
  status?: PlanStatus | PlanStatus[];

  /** Filter by user */
  userId?: string;

  /** Filter by conversation */
  conversationId?: string;

  /** Include steps in result */
  includeSteps?: boolean;

  /** Include assumptions in result */
  includeAssumptions?: boolean;

  /** Order by field */
  orderBy?: "createdAt" | "updatedAt";

  /** Order direction */
  orderDirection?: "asc" | "desc";

  /** Maximum results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

/**
 * Result of a plan query
 */
export interface PlanQueryResult {
  /** Matching plans */
  plans: StructuredPlan[];

  /** Total count (for pagination) */
  total: number;

  /** Whether there are more results */
  hasMore: boolean;
}

// ─────────────────────────────────────────────────────────────
// Event Types (for streaming/UI)
// ─────────────────────────────────────────────────────────────

/**
 * Events emitted during plan creation/execution
 */
export type PlanEvent =
  | PlanCreatedEvent
  | PlanValidationEvent
  | StepStartedEvent
  | StepCompletedEvent
  | StepFailedEvent
  | PlanPausedEvent
  | PlanCompletedEvent
  | PlanFailedEvent;

export interface PlanCreatedEvent {
  type: "plan_created";
  planId: string;
  goal: string;
  stepCount: number;
}

export interface PlanValidationEvent {
  type: "plan_validation";
  valid: boolean;
  errorCount: number;
  warningCount: number;
}

export interface StepStartedEvent {
  type: "step_started";
  planId: string;
  stepIndex: number;
  toolName: string;
  description: string;
}

export interface StepCompletedEvent {
  type: "step_completed";
  planId: string;
  stepIndex: number;
  toolName: string;
  result: unknown;
}

export interface StepFailedEvent {
  type: "step_failed";
  planId: string;
  stepIndex: number;
  toolName: string;
  error: string;
}

export interface PlanPausedEvent {
  type: "plan_paused";
  planId: string;
  stepIndex: number;
  reason: "approval_needed" | "user_requested";
  approvalId?: string;
}

export interface PlanCompletedEvent {
  type: "plan_completed";
  planId: string;
  successfulSteps: number;
  totalSteps: number;
}

export interface PlanFailedEvent {
  type: "plan_failed";
  planId: string;
  failedStepIndex: number;
  error: string;
}

// ─────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────

/**
 * Error codes for planning operations
 */
export type PlanningErrorCode =
  | "validation_failed"
  | "plan_not_found"
  | "step_not_found"
  | "plan_not_pending"
  | "plan_already_completed"
  | "plan_already_failed"
  | "step_not_executable"
  | "dependency_not_met"
  | "tool_execution_failed"
  | "persistence_error"
  | "invalid_state_transition";

/**
 * Error class for planning operations
 */
export class PlanningError extends Error {
  constructor(
    public readonly code: PlanningErrorCode,
    message: string,
    public readonly planId?: string,
    public readonly stepIndex?: number
  ) {
    super(message);
    this.name = "PlanningError";
  }
}

// ─────────────────────────────────────────────────────────────
// Output Resolution Types
// ─────────────────────────────────────────────────────────────

/**
 * Result of resolving step outputs
 */
export interface OutputResolutionResult {
  /** Whether all references were successfully resolved */
  success: boolean;

  /** Resolved parameters */
  resolvedParams: Record<string, unknown>;

  /** Errors encountered during resolution */
  errors: OutputResolutionError[];

  /** References that were resolved */
  resolvedReferences: ResolvedReference[];
}

/**
 * An error during output resolution
 */
export interface OutputResolutionError {
  /** Type of error */
  type: "step_not_found" | "step_not_completed" | "path_not_found" | "invalid_reference";

  /** The reference that failed */
  reference: string;

  /** Human-readable error message */
  message: string;

  /** Step index referenced (if applicable) */
  stepIndex?: number;

  /** Path within the output (if applicable) */
  path?: string;
}

/**
 * A successfully resolved reference
 */
export interface ResolvedReference {
  /** Original reference string */
  reference: string;

  /** Step index that was referenced */
  stepIndex: number;

  /** Path within the output (if any) */
  path?: string;

  /** Resolved value */
  value: unknown;
}

// ─────────────────────────────────────────────────────────────
// Execution Types
// ─────────────────────────────────────────────────────────────

/**
 * Options for plan execution
 */
export interface ExecutionOptions {
  /** Context for tool execution */
  context: import("../types").ExecutionContext;

  /** Whether to stop on first failure */
  stopOnFailure?: boolean;

  /** Event listener for real-time updates */
  onEvent?: PlanEventListener;

  /** Async event listener for real-time updates */
  onEventAsync?: AsyncPlanEventListener;

  /** Whether to skip approval checks (for testing) */
  skipApprovals?: boolean;
}

/**
 * Result of plan execution
 */
export interface PlanExecutionResult {
  /** Final plan state */
  plan: StructuredPlan;

  /** Whether execution completed successfully */
  success: boolean;

  /** Whether execution was paused (for approval) */
  paused: boolean;

  /** Approval ID if paused for approval */
  pendingApprovalId?: string;

  /** Step index where execution stopped */
  stoppedAtStep: number;

  /** Number of steps completed */
  completedSteps: number;

  /** Number of steps failed */
  failedSteps: number;

  /** Number of steps skipped */
  skippedSteps: number;

  /** Total execution duration in milliseconds */
  durationMs: number;

  /** Step results (for completed steps) */
  stepResults: Map<number, unknown>;

  /** Error message if failed */
  error?: string;
}

/**
 * Result of single step execution
 */
export interface StepExecutionResult {
  /** The step that was executed */
  step: StructuredStep;

  /** Whether the step succeeded */
  success: boolean;

  /** Whether approval was requested */
  approvalRequested: boolean;

  /** Approval ID (if approval requested) */
  approvalId?: string;

  /** Step result (if successful) */
  result?: unknown;

  /** Error message (if failed) */
  error?: string;

  /** Execution duration in milliseconds */
  durationMs: number;
}

// ─────────────────────────────────────────────────────────────
// Execution Event Types
// ─────────────────────────────────────────────────────────────

/**
 * All possible plan execution events
 */
export type PlanExecutionEvent =
  | PlanExecutionStartedEvent
  | StepStartingEvent
  | StepExecutionCompletedEvent
  | StepExecutionFailedEvent
  | StepSkippedEvent
  | PlanExecutionPausedEvent
  | PlanResumedEvent
  | PlanExecutionCompletedEvent
  | PlanExecutionFailedEvent
  | PlanCancelledEvent
  | ApprovalRequestedEvent
  | ApprovalReceivedEvent;

/**
 * Base interface for all plan events
 */
export interface BasePlanEvent {
  /** Event type discriminator */
  type: string;

  /** Plan ID */
  planId: string;

  /** Timestamp of the event */
  timestamp: Date;
}

/**
 * Emitted when plan execution starts
 */
export interface PlanExecutionStartedEvent extends BasePlanEvent {
  type: "plan_started";

  /** Plan goal */
  goal: string;

  /** Total number of steps */
  totalSteps: number;

  /** Whether any step requires approval */
  requiresApproval: boolean;
}

/**
 * Emitted when a step is about to start executing
 */
export interface StepStartingEvent extends BasePlanEvent {
  type: "step_starting";

  /** Step index (0-based) */
  stepIndex: number;

  /** Tool being executed */
  toolName: string;

  /** Step description */
  description: string;

  /** Whether this step requires approval */
  requiresApproval: boolean;
}

/**
 * Emitted when a step completes successfully
 */
export interface StepExecutionCompletedEvent extends BasePlanEvent {
  type: "step_completed";

  /** Step index (0-based) */
  stepIndex: number;

  /** Tool that was executed */
  toolName: string;

  /** Step description */
  description: string;

  /** Execution duration in milliseconds */
  durationMs: number;

  /** Summary of the result (for display) */
  resultSummary?: string;
}

/**
 * Emitted when a step fails
 */
export interface StepExecutionFailedEvent extends BasePlanEvent {
  type: "step_failed";

  /** Step index (0-based) */
  stepIndex: number;

  /** Tool that was executed */
  toolName: string;

  /** Step description */
  description: string;

  /** Error message */
  error: string;

  /** Whether the error is retryable */
  retryable: boolean;

  /** Execution duration in milliseconds */
  durationMs: number;
}

/**
 * Emitted when a step is skipped
 */
export interface StepSkippedEvent extends BasePlanEvent {
  type: "step_skipped";

  /** Step index (0-based) */
  stepIndex: number;

  /** Tool that would have been executed */
  toolName: string;

  /** Step description */
  description: string;

  /** Reason for skipping */
  reason: "dependency_failed" | "user_cancelled" | "plan_cancelled";
}

/**
 * Emitted when plan pauses for approval
 */
export interface PlanExecutionPausedEvent extends BasePlanEvent {
  type: "plan_paused";

  /** Step index where the plan paused */
  stepIndex: number;

  /** Reason for pausing */
  reason: "approval_needed" | "user_requested";

  /** Approval ID (if paused for approval) */
  approvalId?: string;

  /** Tool requiring approval */
  toolName?: string;

  /** Risk level of the action */
  riskLevel?: RiskLevel;
}

/**
 * Emitted when plan resumes after pause
 */
export interface PlanResumedEvent extends BasePlanEvent {
  type: "plan_resumed";

  /** Step index where execution will resume */
  stepIndex: number;

  /** How the plan was resumed */
  resumeReason: "approval_granted" | "user_requested";
}

/**
 * Emitted when plan completes successfully
 */
export interface PlanExecutionCompletedEvent extends BasePlanEvent {
  type: "plan_completed";

  /** Plan goal */
  goal: string;

  /** Number of steps that succeeded */
  successfulSteps: number;

  /** Total number of steps */
  totalSteps: number;

  /** Total execution duration in milliseconds */
  totalDurationMs: number;
}

/**
 * Emitted when plan fails
 */
export interface PlanExecutionFailedEvent extends BasePlanEvent {
  type: "plan_failed";

  /** Plan goal */
  goal: string;

  /** Step index where failure occurred */
  failedStepIndex: number;

  /** Error message from the failed step */
  error: string;

  /** Number of steps completed before failure */
  completedSteps: number;

  /** Total number of steps */
  totalSteps: number;
}

/**
 * Emitted when plan is cancelled
 */
export interface PlanCancelledEvent extends BasePlanEvent {
  type: "plan_cancelled";

  /** Plan goal */
  goal: string;

  /** Step index where cancellation occurred */
  cancelledAtStep: number;

  /** Number of steps completed before cancellation */
  completedSteps: number;

  /** Total number of steps */
  totalSteps: number;

  /** Who cancelled the plan */
  cancelledBy: "user" | "system";
}

/**
 * Emitted when an approval is requested
 */
export interface ApprovalRequestedEvent extends BasePlanEvent {
  type: "approval_requested";

  /** Step index requiring approval */
  stepIndex: number;

  /** Approval record ID */
  approvalId: string;

  /** Tool requiring approval */
  toolName: string;

  /** Description of what needs approval */
  description: string;

  /** Risk level */
  riskLevel: RiskLevel;

  /** When the approval expires */
  expiresAt: Date;
}

/**
 * Emitted when an approval decision is received
 */
export interface ApprovalReceivedEvent extends BasePlanEvent {
  type: "approval_received";

  /** Step index that was approved/rejected */
  stepIndex: number;

  /** Approval record ID */
  approvalId: string;

  /** The decision */
  decision: "approved" | "rejected";

  /** Who made the decision */
  decidedBy?: string;
}

/**
 * Callback function for plan execution events
 */
export type PlanEventListener = (event: PlanExecutionEvent) => void;

/**
 * Async callback function for plan execution events
 */
export type AsyncPlanEventListener = (event: PlanExecutionEvent) => Promise<void>;

