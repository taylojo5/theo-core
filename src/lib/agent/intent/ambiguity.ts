// ═══════════════════════════════════════════════════════════════════════════
// Ambiguity Detection
// Analyzes intent analysis results for ambiguity signals
// ═══════════════════════════════════════════════════════════════════════════

import { intentLogger } from "../logger";
import type {
  IntentAnalysisResult,
  AmbiguityAnalysis,
  AmbiguityType,
  IntentAnalyzerConfig,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

/**
 * Thresholds for ambiguity detection
 */
export const AMBIGUITY_THRESHOLDS = {
  /** Below this confidence, intent is considered low-confidence */
  LOW_CONFIDENCE: 0.5,

  /** Below this confidence for suggested tool, consider ambiguous */
  LOW_TOOL_CONFIDENCE: 0.6,

  /** Maximum number of unresolved entities before flagging */
  MAX_UNRESOLVED_ENTITIES: 2,

  /** Minimum confidence difference between action types for multiple_actions */
  ACTION_CONFIDENCE_GAP: 0.2,
} as const;

// ─────────────────────────────────────────────────────────────
// Main Analysis Function
// ─────────────────────────────────────────────────────────────

/**
 * Analyze an intent analysis result for ambiguity
 *
 * LLM-First Design:
 * - Trusts the LLM's clarificationNeeded flag as primary signal
 * - Supplements with confidence-based heuristics
 * - Detects specific types of ambiguity for targeted clarification
 *
 * @param result - Intent analysis result to analyze
 * @param config - Optional analyzer configuration
 * @returns Ambiguity analysis with types and suggestions
 */
export function analyzeAmbiguity(
  result: IntentAnalysisResult,
  config?: IntentAnalyzerConfig
): AmbiguityAnalysis {
  const ambiguityTypes: AmbiguityType[] = [];
  const clarificationQuestions: string[] = [];
  let primaryReason: string | undefined;

  // 1. Check LLM's explicit clarification flag (trust the LLM)
  if (result.clarification?.required) {
    intentLogger.debug("LLM requested clarification", {
      questions: result.clarification.questions,
      missingInfo: result.clarification.missingInfo,
    });

    if (result.clarification.missingInfo.length > 0) {
      ambiguityTypes.push("missing_info");
      primaryReason = primaryReason ?? "Missing required information";
    }

    clarificationQuestions.push(...result.clarification.questions);
  }

  // 2. Check overall confidence
  const minConfidence = config?.minActionConfidence ?? 0.7;
  if (result.confidence < AMBIGUITY_THRESHOLDS.LOW_CONFIDENCE) {
    ambiguityTypes.push("low_confidence");
    primaryReason = primaryReason ?? "Low confidence in understanding";

    if (clarificationQuestions.length === 0) {
      clarificationQuestions.push(
        "I'm not quite sure what you mean. Could you provide more details?"
      );
    }
  } else if (result.confidence < minConfidence) {
    // Between LOW_CONFIDENCE and minActionConfidence - uncertain but not unclear
    if (!ambiguityTypes.includes("low_confidence")) {
      ambiguityTypes.push("low_confidence");
    }
    primaryReason = primaryReason ?? "Not confident enough to proceed";
  }

  // 3. Check for entities needing resolution
  const unresolvedEntities = result.entities.filter((e) => e.needsResolution);
  if (unresolvedEntities.length > 0) {
    ambiguityTypes.push("entity_resolution");

    // Generate entity-specific clarification questions
    for (const entity of unresolvedEntities) {
      const question = generateEntityQuestion(entity.type, entity.text);
      if (question && !clarificationQuestions.includes(question)) {
        clarificationQuestions.push(question);
      }
    }

    if (!primaryReason && unresolvedEntities.length > 0) {
      primaryReason = `Need to confirm ${unresolvedEntities[0].type}: "${unresolvedEntities[0].text}"`;
    }
  }

  // 4. Check for unclear intent (unknown category)
  if (result.category === "unknown") {
    ambiguityTypes.push("unclear_intent");
    primaryReason = primaryReason ?? "Could not determine intent";

    if (clarificationQuestions.length === 0) {
      clarificationQuestions.push("What would you like me to help you with?");
    }
  }

  // 5. Check for multiple possible actions (low tool confidence with suggested tool)
  if (
    result.suggestedTool &&
    result.suggestedTool.confidence < AMBIGUITY_THRESHOLDS.LOW_TOOL_CONFIDENCE
  ) {
    ambiguityTypes.push("multiple_actions");
    primaryReason = primaryReason ?? "Multiple actions could apply";

    const toolQuestion = `I think you want to ${result.summary}. Should I proceed?`;
    if (!clarificationQuestions.includes(toolQuestion)) {
      clarificationQuestions.push(toolQuestion);
    }
  }

  // 6. Check for conflicting assumptions
  const lowConfidenceAssumptions = result.assumptions.filter(
    (a) => a.confidence < 0.5
  );
  if (lowConfidenceAssumptions.length > 0) {
    // Don't add a new type, but add clarification questions
    for (const assumption of lowConfidenceAssumptions.slice(0, 2)) {
      const question = `Just to confirm: ${assumption.statement}?`;
      if (!clarificationQuestions.includes(question)) {
        clarificationQuestions.push(question);
      }
    }
  }

  const isAmbiguous = ambiguityTypes.length > 0;

  // Calculate confidence in the ambiguity analysis
  // Higher confidence when LLM explicitly flagged, lower when using heuristics
  const analysisConfidence = result.clarification?.required
    ? 0.9
    : isAmbiguous
      ? 0.7
      : 0.95;

  intentLogger.debug("Ambiguity analysis complete", {
    isAmbiguous,
    types: ambiguityTypes,
    questionCount: clarificationQuestions.length,
    confidence: analysisConfidence,
  });

  return {
    isAmbiguous,
    ambiguityTypes,
    clarificationQuestions,
    primaryReason,
    confidence: analysisConfidence,
  };
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Generate a clarification question for an entity type
 */
function generateEntityQuestion(
  entityType: string,
  entityText: string
): string | undefined {
  switch (entityType) {
    case "person":
      return `Which "${entityText}" are you referring to?`;

    case "event":
      return `Which event do you mean by "${entityText}"?`;

    case "task":
      return `Which task is "${entityText}"?`;

    case "email":
      return `Which email thread are you referring to?`;

    case "date":
    case "time":
    case "datetime":
      return `Could you clarify the time/date "${entityText}"?`;

    case "location":
      return `Where exactly is "${entityText}"?`;

    default:
      return `Could you clarify "${entityText}"?`;
  }
}

// ─────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────

/**
 * Check if a result requires clarification before action
 */
export function requiresClarification(
  result: IntentAnalysisResult,
  config?: IntentAnalyzerConfig
): boolean {
  const analysis = analyzeAmbiguity(result, config);
  return analysis.isAmbiguous;
}

/**
 * Get primary clarification question
 */
export function getPrimaryClarificationQuestion(
  result: IntentAnalysisResult,
  config?: IntentAnalyzerConfig
): string | undefined {
  const analysis = analyzeAmbiguity(result, config);

  if (!analysis.isAmbiguous) {
    return undefined;
  }

  return analysis.clarificationQuestions[0];
}

/**
 * Determine if we can proceed with assumptions
 * Returns true if confidence is high enough and no critical ambiguity
 */
export function canProceedWithAssumptions(
  result: IntentAnalysisResult,
  config?: IntentAnalyzerConfig
): boolean {
  const minConfidence = config?.minActionConfidence ?? 0.7;

  // Must have sufficient overall confidence
  if (result.confidence < minConfidence) {
    return false;
  }

  // Must not have unclear intent
  if (result.category === "unknown") {
    return false;
  }

  // Must not have critical missing info
  if (result.clarification?.required && result.clarification.missingInfo.length > 0) {
    return false;
  }

  // Must not have entities needing resolution
  const unresolvedEntities = result.entities.filter((e) => e.needsResolution);
  if (unresolvedEntities.length > 0) {
    return false;
  }

  return true;
}

/**
 * Get assumptions that should be verified with the user
 * Returns assumptions with confidence below threshold
 */
export function getAssumptionsToVerify(
  result: IntentAnalysisResult,
  confidenceThreshold: number = 0.6
): typeof result.assumptions {
  return result.assumptions.filter((a) => a.confidence < confidenceThreshold);
}
