// ═══════════════════════════════════════════════════════════════════════════
// Plan Generation & Structuring Module
// Converts LLM-generated plans into structured, executable plans
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Types
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

  // Event types
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

