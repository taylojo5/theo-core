// ═══════════════════════════════════════════════════════════════════════════
// Action Routing Module
// Routes LLM classification to appropriate actions based on confidence
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Core types
  PerceptionResult,
  ActionDecision,
  RoutingResult,
  RoutingContext,
  ConfidenceThresholdConfig,
  IActionRouter,

  // Decision types
  ExecuteToolDecision,
  ConfirmActionDecision,
  ClarifyDecision,
  RespondDecision,
  ErrorDecision,

  // Supporting types
  ClarificationReason,
  ResponseStyle,
  RoutingErrorCode,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Type Guards
// ─────────────────────────────────────────────────────────────

export {
  isExecuteDecision,
  isConfirmDecision,
  isClarifyDecision,
  isRespondDecision,
  isErrorDecision,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Thresholds
// ─────────────────────────────────────────────────────────────

export {
  // Threshold presets
  DEFAULT_THRESHOLDS,
  CONSERVATIVE_THRESHOLDS,
  AGGRESSIVE_THRESHOLDS,
  ALWAYS_CONFIRM_THRESHOLDS,

  // Threshold utilities
  getThresholdPreset,
  mergeThresholds,
  validateThresholds,
  getThresholdBand,
  describeConfidenceAction,
} from "./thresholds";

export type { ThresholdPreset, ThresholdBand } from "./thresholds";

// ─────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────

export {
  // Router class
  ActionRouter,

  // Singleton
  actionRouter,

  // Factory
  createActionRouter,

  // Convenience functions
  routeToAction,
  shouldExecute,
  needsClarification,
} from "./router";



