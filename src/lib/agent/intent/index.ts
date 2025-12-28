// ═══════════════════════════════════════════════════════════════════════════
// Intent Analysis Module
// LLM-First intent understanding for the Agent Engine
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Re-exported LLM types
  ClassificationRequest,
  ClassificationResponse,
  LLMExtractedEntity,
  LLMAssumption,
  ToolForLLM,

  // Intent analysis types
  IntentAnalysisResult,
  ProcessedEntity,
  SuggestedToolCall,
  ClarificationRequirement,
  ProcessedAssumption,

  // Configuration types
  IntentAnalyzerConfig,

  // Ambiguity types
  AmbiguityType,
  AmbiguityAnalysis,

  // Input types
  AnalyzeIntentInput,

  // Interface
  IIntentAnalyzer,
} from "./types";

export { DEFAULT_INTENT_ANALYZER_CONFIG } from "./types";

// ─────────────────────────────────────────────────────────────
// Analyzer
// ─────────────────────────────────────────────────────────────

export {
  // Factory function
  createIntentAnalyzer,

  // Singleton access
  getDefaultIntentAnalyzer,
  resetDefaultIntentAnalyzer,
  setDefaultIntentAnalyzer,

  // Convenience function
  analyzeIntent,
} from "./analyzer";

// ─────────────────────────────────────────────────────────────
// Ambiguity Detection
// ─────────────────────────────────────────────────────────────

export {
  // Main analysis
  analyzeAmbiguity,

  // Utility functions
  requiresClarification,
  getPrimaryClarificationQuestion,
  canProceedWithAssumptions,
  getAssumptionsToVerify,

  // Constants
  AMBIGUITY_THRESHOLDS,
} from "./ambiguity";
