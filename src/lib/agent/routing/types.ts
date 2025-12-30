// ═══════════════════════════════════════════════════════════════════════════
// Action Routing Types
// Types for routing LLM classification to appropriate actions
// ═══════════════════════════════════════════════════════════════════════════

import type { ClassificationResponse, LLMAssumption } from "../llm/types";
import type { IntentAnalysisResult } from "../intent/types";
import type { ResolutionResult, ResolvedEntity } from "../entities/types";
import type { ContextRetrieval, RankedContext } from "../context/types";

// ─────────────────────────────────────────────────────────────
// Perception Result (Input from Perception Layer)
// ─────────────────────────────────────────────────────────────

/**
 * Combined result from the perception layer (P1I, P2E, P3C)
 * This is the input to the routing/decision layer
 */
export interface PerceptionResult {
  /** Classification from intent analyzer (P1I) */
  classification: ClassificationResponse;

  /** Processed intent analysis result */
  intent: IntentAnalysisResult;

  /** Resolved entities from entity resolver (P2E) */
  resolution: ResolutionResult;

  /** Retrieved context (P3C) */
  context: ContextRetrieval;

  /** Ranked context for LLM consumption */
  rankedContext?: RankedContext;

  /** User ID */
  userId: string;

  /** Conversation ID (if in a conversation) */
  conversationId?: string;

  /** Original user message */
  originalMessage: string;
}

// ─────────────────────────────────────────────────────────────
// Action Decision Types
// ─────────────────────────────────────────────────────────────

/**
 * Decision to execute a tool immediately
 * Used when confidence is high and all required info is available
 */
export interface ExecuteToolDecision {
  type: "execute_tool";

  /** Tool to execute */
  tool: string;

  /** Parameters for the tool (validated) */
  params: Record<string, unknown>;

  /** Whether this tool requires user approval before execution */
  requiresApproval: boolean;

  /** Confidence in this decision (from LLM) */
  confidence: number;

  /** Reasoning for this decision */
  reasoning: string;

  /** Assumptions made by the LLM */
  assumptions: LLMAssumption[];
}

/**
 * Decision to confirm with user before executing
 * Used when confidence is medium - we think we know what they want
 * but want to double-check
 */
export interface ConfirmActionDecision {
  type: "confirm_action";

  /** Tool that would be executed */
  tool: string;

  /** Parameters that would be used */
  params: Record<string, unknown>;

  /** Message to ask user for confirmation */
  confirmationMessage: string;

  /** What we're uncertain about */
  uncertainties: string[];

  /** Confidence in this decision */
  confidence: number;

  /** Assumptions we want user to verify */
  assumptionsToVerify: LLMAssumption[];
}

/**
 * Decision to ask for clarification
 * Used when confidence is low or required info is missing
 */
export interface ClarifyDecision {
  type: "clarify";

  /** Questions to ask the user */
  questions: string[];

  /** What information is missing */
  missingInfo: string[];

  /** Partial understanding we do have */
  partialUnderstanding?: {
    possibleIntent?: string;
    possibleTool?: string;
    recognizedEntities?: string[];
  };

  /** Why we need clarification */
  clarificationReason: ClarificationReason;
}

/**
 * Reason for needing clarification
 */
export type ClarificationReason =
  | "low_confidence"
  | "ambiguous_entity"
  | "missing_required_info"
  | "multiple_interpretations"
  | "unclear_intent";

/**
 * Decision to generate a conversational response
 * Used when no tool is needed (general chat, questions, etc.)
 */
export interface RespondDecision {
  type: "respond";

  /** Style of response to generate */
  responseStyle: ResponseStyle;

  /** Context to include in response generation */
  responseContext: string;

  /** Whether this is a simple acknowledgment vs. substantive response */
  isSimple: boolean;
}

/**
 * Style guidance for response generation
 */
export type ResponseStyle =
  | "informational"
  | "conversational"
  | "acknowledgment"
  | "suggestion"
  | "clarification";

/**
 * Decision indicating an error occurred
 * Used when something goes wrong in the perception layer
 */
export interface ErrorDecision {
  type: "error";

  /** Error code for programmatic handling */
  errorCode: RoutingErrorCode;

  /** Human-readable error message */
  error: string;

  /** Whether this is recoverable */
  recoverable: boolean;

  /** Suggested recovery action */
  recoverySuggestion?: string;
}

/**
 * Error codes for routing failures
 */
export type RoutingErrorCode =
  | "perception_failed"
  | "classification_failed"
  | "resolution_failed"
  | "context_retrieval_failed"
  | "tool_not_found"
  | "invalid_parameters"
  | "threshold_error";

/**
 * Union type for all possible action decisions
 */
export type ActionDecision =
  | ExecuteToolDecision
  | ConfirmActionDecision
  | ClarifyDecision
  | RespondDecision
  | ErrorDecision;

// ─────────────────────────────────────────────────────────────
// Type Guards
// ─────────────────────────────────────────────────────────────

/**
 * Type guard for execute tool decision
 */
export function isExecuteDecision(
  decision: ActionDecision
): decision is ExecuteToolDecision {
  return decision.type === "execute_tool";
}

/**
 * Type guard for confirm action decision
 */
export function isConfirmDecision(
  decision: ActionDecision
): decision is ConfirmActionDecision {
  return decision.type === "confirm_action";
}

/**
 * Type guard for clarify decision
 */
export function isClarifyDecision(
  decision: ActionDecision
): decision is ClarifyDecision {
  return decision.type === "clarify";
}

/**
 * Type guard for respond decision
 */
export function isRespondDecision(
  decision: ActionDecision
): decision is RespondDecision {
  return decision.type === "respond";
}

/**
 * Type guard for error decision
 */
export function isErrorDecision(
  decision: ActionDecision
): decision is ErrorDecision {
  return decision.type === "error";
}

// ─────────────────────────────────────────────────────────────
// Routing Context
// ─────────────────────────────────────────────────────────────

/**
 * Additional context for routing decisions
 */
export interface RoutingContext {
  /** User's configured confidence thresholds */
  userThresholds?: Partial<ConfidenceThresholdConfig>;

  /** Whether user prefers to always confirm actions */
  alwaysConfirm?: boolean;

  /** Tools the user has disabled */
  disabledTools?: string[];

  /** User's timezone */
  timezone?: string;
}

/**
 * Confidence threshold configuration
 */
export interface ConfidenceThresholdConfig {
  /** Threshold for immediate execution */
  execute: number;

  /** Threshold for confirmation request */
  confirm: number;

  /** Below this requires clarification */
  clarify: number;
}

// ─────────────────────────────────────────────────────────────
// Routing Result
// ─────────────────────────────────────────────────────────────

/**
 * Complete routing result with decision and metadata
 */
export interface RoutingResult {
  /** The action decision */
  decision: ActionDecision;

  /** Input perception result (for audit/debugging) */
  perception: PerceptionResult;

  /** Thresholds used for the decision */
  thresholdsUsed: ConfidenceThresholdConfig;

  /** Routing duration in milliseconds */
  durationMs: number;

  /** Timestamp of the decision */
  timestamp: Date;
}

// ─────────────────────────────────────────────────────────────
// Router Interface
// ─────────────────────────────────────────────────────────────

/**
 * Interface for the action router
 */
export interface IActionRouter {
  /**
   * Route perception result to an action decision
   */
  routeToAction(
    perception: PerceptionResult,
    context?: RoutingContext
  ): Promise<RoutingResult>;

  /**
   * Check if a classification should be executed immediately
   */
  shouldExecute(
    classification: ClassificationResponse,
    resolution: ResolutionResult
  ): boolean;

  /**
   * Check if clarification is needed
   */
  needsClarification(
    classification: ClassificationResponse,
    resolution: ResolutionResult
  ): boolean;

  /**
   * Get current threshold configuration
   */
  getThresholds(): ConfidenceThresholdConfig;
}



