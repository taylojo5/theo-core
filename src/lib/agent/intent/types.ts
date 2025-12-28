// ═══════════════════════════════════════════════════════════════════════════
// Intent Analysis Types
// LLM-First intent analysis types for the Agent Engine
// ═══════════════════════════════════════════════════════════════════════════

import type {
  ClassificationRequest,
  ClassificationResponse,
  LLMExtractedEntity,
  LLMAssumption,
  ToolForLLM,
} from "../llm/types";
import type { IntentCategory, EntityType, AssumptionCategory } from "../constants";

// Re-export LLM types for convenience
export type {
  ClassificationRequest,
  ClassificationResponse,
  LLMExtractedEntity,
  LLMAssumption,
  ToolForLLM,
};

// ─────────────────────────────────────────────────────────────
// Intent Analysis Result
// ─────────────────────────────────────────────────────────────

/**
 * Processed intent analysis result
 * Converted from LLM ClassificationResponse to internal format
 */
export interface IntentAnalysisResult {
  /** Primary intent category */
  category: IntentCategory;

  /** Specific action within the category (e.g., "schedule_meeting") */
  action?: string;

  /** Human-readable summary of the intent */
  summary: string;

  /** Overall confidence in the analysis (0.0 - 1.0) */
  confidence: number;

  /** Extracted entities from the message */
  entities: ProcessedEntity[];

  /** Suggested tool and parameters */
  suggestedTool?: SuggestedToolCall;

  /** Clarification requirements */
  clarification?: ClarificationRequirement;

  /** Assumptions made during analysis */
  assumptions: ProcessedAssumption[];

  /** Raw LLM response (for debugging/audit) */
  rawResponse?: ClassificationResponse;
}

/**
 * Processed entity with typed values
 */
export interface ProcessedEntity {
  /** Entity type from constants */
  type: EntityType | string;

  /** Original text in the message */
  text: string;

  /** Normalized/parsed value */
  value: unknown;

  /** Confidence in extraction (0.0 - 1.0) */
  confidence: number;

  /** Whether this entity needs database resolution */
  needsResolution: boolean;

  /** Start position in the original text */
  startIndex?: number;

  /** End position in the original text */
  endIndex?: number;
}

/**
 * Suggested tool call from intent analysis
 */
export interface SuggestedToolCall {
  /** Tool name */
  name: string;

  /** Suggested parameters */
  parameters: Record<string, unknown>;

  /** Confidence in this suggestion (0.0 - 1.0) */
  confidence: number;

  /** Reasoning for this suggestion */
  reasoning: string;
}

/**
 * Clarification requirements
 */
export interface ClarificationRequirement {
  /** Whether clarification is required */
  required: boolean;

  /** Questions to ask the user */
  questions: string[];

  /** What information is missing */
  missingInfo: string[];
}

/**
 * Processed assumption with typed category
 */
export interface ProcessedAssumption {
  /** Unique identifier */
  id: string;

  /** The assumption statement */
  statement: string;

  /** Category of the assumption */
  category: AssumptionCategory;

  /** Evidence supporting this assumption */
  evidence: string[];

  /** Confidence in this assumption (0.0 - 1.0) */
  confidence: number;

  /** Whether the assumption has been verified */
  verified?: boolean;

  /** User's correction (if assumption was wrong) */
  correction?: string;
}

// ─────────────────────────────────────────────────────────────
// Intent Analyzer Configuration
// ─────────────────────────────────────────────────────────────

/**
 * Configuration for the intent analyzer
 */
export interface IntentAnalyzerConfig {
  /** Minimum confidence to suggest a tool (0.0 - 1.0) */
  minToolConfidence?: number;

  /** Minimum confidence to take action without clarification (0.0 - 1.0) */
  minActionConfidence?: number;

  /** Whether to include raw LLM response in results */
  includeRawResponse?: boolean;

  /** User's timezone for date/time parsing */
  timezone?: string;

  /** Maximum conversation history messages to include */
  maxHistoryMessages?: number;
}

/**
 * Default intent analyzer configuration
 */
export const DEFAULT_INTENT_ANALYZER_CONFIG: Required<IntentAnalyzerConfig> = {
  minToolConfidence: 0.7,
  minActionConfidence: 0.7,
  includeRawResponse: false,
  timezone: "UTC",
  maxHistoryMessages: 10,
};

// ─────────────────────────────────────────────────────────────
// Ambiguity Analysis
// ─────────────────────────────────────────────────────────────

/**
 * Type of ambiguity detected in the intent
 */
export type AmbiguityType =
  | "low_confidence"
  | "entity_resolution"
  | "missing_info"
  | "multiple_actions"
  | "unclear_intent";

/**
 * Ambiguity analysis result
 */
export interface AmbiguityAnalysis {
  /** Whether the intent is ambiguous */
  isAmbiguous: boolean;

  /** Types of ambiguity detected */
  ambiguityTypes: AmbiguityType[];

  /** Suggested clarification questions */
  clarificationQuestions: string[];

  /** Primary reason for ambiguity */
  primaryReason?: string;

  /** Confidence in the ambiguity analysis */
  confidence: number;
}

// ─────────────────────────────────────────────────────────────
// Intent Analyzer Interface
// ─────────────────────────────────────────────────────────────

/**
 * Input for intent analysis
 */
export interface AnalyzeIntentInput {
  /** The user's message to analyze */
  message: string;

  /** Available tools for this user */
  availableTools: ToolForLLM[];

  /** Recent conversation history */
  conversationHistory?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;

  /** User's timezone */
  timezone?: string;

  /** Current timestamp */
  currentTime?: Date;
}

/**
 * Intent Analyzer interface
 */
export interface IIntentAnalyzer {
  /**
   * Analyze user intent from a message
   * Uses LLM for classification and returns processed result
   */
  analyzeIntent(input: AnalyzeIntentInput): Promise<IntentAnalysisResult>;

  /**
   * Detect ambiguity in an intent analysis result
   */
  detectAmbiguity(result: IntentAnalysisResult): AmbiguityAnalysis;

  /**
   * Convert LLM ClassificationResponse to internal IntentAnalysisResult
   */
  toIntentAnalysisResult(response: ClassificationResponse): IntentAnalysisResult;

  /**
   * Get the current configuration
   */
  getConfig(): Required<IntentAnalyzerConfig>;
}
