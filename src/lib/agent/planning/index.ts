// ═══════════════════════════════════════════════════════════════════════════
// Plan Generation & Structuring Module
// Converts LLM-generated plans into structured, executable plans
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Types (from types.ts)
// ─────────────────────────────────────────────────────────────

export type {
  // LLM types (re-exported for convenience)
  LLMGeneratedPlan,
  LLMPlanStep,
  LLMAssumption,

  // Planning context
  PlanningContext,
  PlanConstraints,

  // Structured plan types
  StructuredPlan,
  StructuredStep,
  StoredAssumption,
  RollbackAction,

  // Validation types
  PlanValidationResult,
  ValidatedLLMPlan,
  ValidatedStep,
  PlanValidationError,
  PlanValidationWarning,
  PlanValidationErrorCode,
  PlanValidationWarningCode,

  // Repository types
  CreatePlanInput,
  CreateStepInput,
  UpdatePlanStatusInput,
  UpdateStepStatusInput,
  PlanQueryOptions,
  PlanQueryResult,

  // Original event types (from types.ts - plan creation/validation)
  PlanEvent,
  PlanCreatedEvent,
  PlanValidationEvent,
  StepStartedEvent,
  StepCompletedEvent,
  StepFailedEvent,
  PlanPausedEvent,
  PlanCompletedEvent,
  PlanFailedEvent,

  // Error types
  PlanningErrorCode,

  // Output resolution types
  OutputResolutionResult,
  OutputResolutionError,
  ResolvedReference,

  // Execution types
  ExecutionOptions,
  PlanExecutionResult,
  StepExecutionResult,

  // Execution event types
  PlanExecutionEvent,
  BasePlanEvent,
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

  // Event listener types
  PlanEventListener,
  AsyncPlanEventListener,
} from "./types";

export { PlanningError } from "./types";

// ─────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────

export {
  // Main validation function
  validatePlan,

  // Utilities
  formatValidationErrorsForLLM,
  canRetryPlanGeneration,
  getAvailableToolNames,
} from "./validator";

// ─────────────────────────────────────────────────────────────
// Structuring
// ─────────────────────────────────────────────────────────────

export {
  // Main structuring function
  structurePlan,

  // Preview and validation
  validatePlanOnly,
  createPlanPreview,

  // Approval helpers
  markApprovalSteps,
  getApprovalRequiredSteps,
  getNextApprovalStep,

  // Utilities
  estimatePlanDuration,
  summarizePlan,
  canExecuteNextStep,
  getExecutionOrder,
} from "./structurer";

// ─────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────

export { planRepository } from "./repository";

// ─────────────────────────────────────────────────────────────
// Execution
// ─────────────────────────────────────────────────────────────

export {
  // Main execution functions
  executePlan,
  resumePlan,
  resumePlanAfterRejection,
  cancelPlan,

  // Query functions
  getPendingPlans,
  getInterruptedPlans,

  // Emitter access
  getPlanEventEmitter,
} from "./executor";

// ─────────────────────────────────────────────────────────────
// Output Resolution
// ─────────────────────────────────────────────────────────────

export {
  // Main resolution function
  resolveStepOutputs,

  // Utilities
  hasOutputReferences,
  getReferencedStepIndices,
  validateOutputReferences,
  formatOutputReferences,
  createOutputReference,
} from "./output-resolver";

// ─────────────────────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────────────────────

export {
  // Event emitter
  PlanEventEmitter,

  // Event factory functions
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
