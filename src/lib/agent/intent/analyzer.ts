// ═══════════════════════════════════════════════════════════════════════════
// Intent Analyzer
// LLM-First intent analysis for the Agent Engine
// ═══════════════════════════════════════════════════════════════════════════

import { v4 as uuidv4 } from "uuid";
import { getDefaultLLMClient } from "../llm/client";
import type { LLMClient, ClassificationResponse, LLMMessage } from "../llm/types";
import { ENTITY_TYPES, INTENT_CATEGORIES, ASSUMPTION_CATEGORIES } from "../constants";
import type { IntentCategory, EntityType, AssumptionCategory } from "../constants";
import { intentLogger } from "../logger";
import type {
  IIntentAnalyzer,
  IntentAnalyzerConfig,
  IntentAnalysisResult,
  AnalyzeIntentInput,
  ProcessedEntity,
  ProcessedAssumption,
  SuggestedToolCall,
  ClarificationRequirement,
  AmbiguityAnalysis,
  DEFAULT_INTENT_ANALYZER_CONFIG,
} from "./types";
import { analyzeAmbiguity } from "./ambiguity";

// ─────────────────────────────────────────────────────────────
// Intent Analyzer Implementation
// ─────────────────────────────────────────────────────────────

/**
 * Intent Analyzer implementation
 * Uses LLM for classification and provides processed results
 */
class IntentAnalyzer implements IIntentAnalyzer {
  private config: Required<IntentAnalyzerConfig>;
  private llmClient: LLMClient;

  constructor(config?: IntentAnalyzerConfig, llmClient?: LLMClient) {
    this.config = {
      minToolConfidence: config?.minToolConfidence ?? 0.7,
      minActionConfidence: config?.minActionConfidence ?? 0.7,
      includeRawResponse: config?.includeRawResponse ?? false,
      timezone: config?.timezone ?? "UTC",
      maxHistoryMessages: config?.maxHistoryMessages ?? 10,
    };
    this.llmClient = llmClient ?? getDefaultLLMClient();
  }

  /**
   * Analyze user intent from a message
   */
  async analyzeIntent(input: AnalyzeIntentInput): Promise<IntentAnalysisResult> {
    const startTime = Date.now();

    intentLogger.info("Analyzing intent", {
      messageLength: input.message.length,
      toolCount: input.availableTools.length,
      hasHistory: !!input.conversationHistory?.length,
    });

    try {
      // Convert conversation history to LLM format
      const conversationHistory: LLMMessage[] | undefined =
        input.conversationHistory?.slice(-this.config.maxHistoryMessages).map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

      // Call LLM for classification
      const response = await this.llmClient.classify({
        message: input.message,
        availableTools: input.availableTools,
        conversationHistory,
        timezone: input.timezone ?? this.config.timezone,
        currentTime: input.currentTime ?? new Date(),
      });

      // Convert to internal format
      const result = this.toIntentAnalysisResult(response);

      intentLogger.info("Intent analyzed", {
        category: result.category,
        confidence: result.confidence,
        hasSuggestedTool: !!result.suggestedTool,
        entityCount: result.entities.length,
        assumptionCount: result.assumptions.length,
        durationMs: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      intentLogger.error("Failed to analyze intent", { error });

      // Return unknown intent on error
      return {
        category: INTENT_CATEGORIES.UNKNOWN,
        summary: "Failed to analyze intent",
        confidence: 0,
        entities: [],
        assumptions: [],
        clarification: {
          required: true,
          questions: ["I'm having trouble understanding. Could you please rephrase that?"],
          missingInfo: [],
        },
      };
    }
  }

  /**
   * Detect ambiguity in an intent analysis result
   */
  detectAmbiguity(result: IntentAnalysisResult): AmbiguityAnalysis {
    return analyzeAmbiguity(result, this.config);
  }

  /**
   * Convert LLM ClassificationResponse to internal IntentAnalysisResult
   */
  toIntentAnalysisResult(response: ClassificationResponse): IntentAnalysisResult {
    // Map intent category
    const category = this.mapIntentCategory(response.intent.category);

    // Process entities
    const entities = response.entities.map((entity) =>
      this.processEntity(entity)
    );

    // Process suggested tool
    const suggestedTool = this.processSuggestedTool(response);

    // Process clarification
    const clarification = this.processClarification(response);

    // Process assumptions
    const assumptions = response.assumptions.map((assumption) =>
      this.processAssumption(assumption)
    );

    const result: IntentAnalysisResult = {
      category,
      action: response.intent.action,
      summary: response.intent.summary,
      confidence: response.confidence,
      entities,
      suggestedTool,
      clarification,
      assumptions,
    };

    // Include raw response if configured
    if (this.config.includeRawResponse) {
      result.rawResponse = response;
    }

    return result;
  }

  /**
   * Get the current configuration
   */
  getConfig(): Required<IntentAnalyzerConfig> {
    return { ...this.config };
  }

  // ─────────────────────────────────────────────────────────────
  // Private Helper Methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Map LLM intent category to internal IntentCategory
   */
  private mapIntentCategory(category: string): IntentCategory {
    const normalized = category.toLowerCase();

    // Direct mapping for known categories
    const categoryMap: Record<string, IntentCategory> = {
      query: INTENT_CATEGORIES.QUERY,
      search: INTENT_CATEGORIES.SEARCH,
      schedule: INTENT_CATEGORIES.SCHEDULE,
      communicate: INTENT_CATEGORIES.COMMUNICATE,
      task: INTENT_CATEGORIES.TASK,
      remind: INTENT_CATEGORIES.REMIND,
      summarize: INTENT_CATEGORIES.SUMMARIZE,
      unknown: INTENT_CATEGORIES.UNKNOWN,
      // Map LLM's broader categories
      action: INTENT_CATEGORIES.TASK, // Default action to task
      planning: INTENT_CATEGORIES.TASK, // Multi-step planning
      conversation: INTENT_CATEGORIES.QUERY, // Conversational queries
    };

    return categoryMap[normalized] ?? INTENT_CATEGORIES.UNKNOWN;
  }

  /**
   * Process an LLM-extracted entity
   */
  private processEntity(entity: {
    type: string;
    text: string;
    value: unknown;
    needsResolution: boolean;
  }): ProcessedEntity {
    const entityType = this.mapEntityType(entity.type);

    return {
      type: entityType,
      text: entity.text,
      value: entity.value,
      confidence: 0.8, // LLM doesn't provide per-entity confidence, use default
      needsResolution: entity.needsResolution,
    };
  }

  /**
   * Map LLM entity type to internal EntityType
   */
  private mapEntityType(type: string): EntityType | string {
    const normalized = type.toLowerCase();

    const typeMap: Record<string, EntityType> = {
      person: ENTITY_TYPES.PERSON,
      date: ENTITY_TYPES.DATE,
      time: ENTITY_TYPES.TIME,
      datetime: ENTITY_TYPES.DATETIME,
      duration: ENTITY_TYPES.DURATION,
      location: ENTITY_TYPES.LOCATION,
      event: ENTITY_TYPES.EVENT,
      task: ENTITY_TYPES.TASK,
      email: ENTITY_TYPES.EMAIL,
      unknown: ENTITY_TYPES.UNKNOWN,
    };

    return typeMap[normalized] ?? normalized;
  }

  /**
   * Process suggested tool from LLM response
   */
  private processSuggestedTool(
    response: ClassificationResponse
  ): SuggestedToolCall | undefined {
    if (!response.suggestedTool) {
      return undefined;
    }

    // Only include if confidence meets threshold
    if (response.suggestedTool.confidence < this.config.minToolConfidence) {
      intentLogger.debug("Suggested tool below confidence threshold", {
        tool: response.suggestedTool.name,
        confidence: response.suggestedTool.confidence,
        threshold: this.config.minToolConfidence,
      });
      return undefined;
    }

    return {
      name: response.suggestedTool.name,
      parameters: response.suggestedTool.parameters,
      confidence: response.suggestedTool.confidence,
      reasoning: response.suggestedTool.reasoning,
    };
  }

  /**
   * Process clarification requirements
   * Also require clarification if overall confidence is too low
   */
  private processClarification(
    response: ClassificationResponse
  ): ClarificationRequirement | undefined {
    const hasExplicitClarification = response.clarificationNeeded?.required;
    const isLowConfidence = response.confidence < this.config.minActionConfidence;

    // Require clarification if LLM explicitly requested OR confidence is too low
    if (!hasExplicitClarification && !isLowConfidence) {
      return undefined;
    }

    // Build clarification from LLM response or generate default for low confidence
    if (response.clarificationNeeded) {
      return {
        required: true,
        questions: response.clarificationNeeded.questions,
        missingInfo: response.clarificationNeeded.missingInfo,
      };
    }

    // Low confidence without explicit clarification - generate default
    return {
      required: true,
      questions: ["I want to make sure I understand correctly. Could you provide more details?"],
      missingInfo: [],
    };
  }

  /**
   * Process an LLM assumption
   */
  private processAssumption(assumption: {
    statement: string;
    category: string;
    evidence: string[];
    confidence: number;
  }): ProcessedAssumption {
    const category = this.mapAssumptionCategory(assumption.category);

    return {
      id: uuidv4(),
      statement: assumption.statement,
      category,
      evidence: assumption.evidence,
      confidence: assumption.confidence,
      verified: false,
    };
  }

  /**
   * Map LLM assumption category to internal AssumptionCategory
   */
  private mapAssumptionCategory(category: string): AssumptionCategory {
    const normalized = category.toLowerCase();

    const categoryMap: Record<string, AssumptionCategory> = {
      intent: ASSUMPTION_CATEGORIES.INTENT,
      context: ASSUMPTION_CATEGORIES.CONTEXT,
      preference: ASSUMPTION_CATEGORIES.PREFERENCE,
      inference: ASSUMPTION_CATEGORIES.INFERENCE,
    };

    return categoryMap[normalized] ?? ASSUMPTION_CATEGORIES.INFERENCE;
  }
}

// ─────────────────────────────────────────────────────────────
// Factory Functions
// ─────────────────────────────────────────────────────────────

/**
 * Create an intent analyzer instance
 */
export function createIntentAnalyzer(
  config?: IntentAnalyzerConfig,
  llmClient?: LLMClient
): IIntentAnalyzer {
  return new IntentAnalyzer(config, llmClient);
}

// ─────────────────────────────────────────────────────────────
// Convenience Functions
// ─────────────────────────────────────────────────────────────

let _defaultAnalyzer: IIntentAnalyzer | null = null;

/**
 * Get the default intent analyzer (singleton)
 */
export function getDefaultIntentAnalyzer(): IIntentAnalyzer {
  if (!_defaultAnalyzer) {
    _defaultAnalyzer = createIntentAnalyzer();
  }
  return _defaultAnalyzer;
}

/**
 * Reset the default analyzer (for testing)
 */
export function resetDefaultIntentAnalyzer(): void {
  _defaultAnalyzer = null;
}

/**
 * Set a custom default analyzer (for testing)
 */
export function setDefaultIntentAnalyzer(analyzer: IIntentAnalyzer): void {
  _defaultAnalyzer = analyzer;
}

/**
 * Convenience function to analyze intent with default analyzer
 */
export async function analyzeIntent(
  input: AnalyzeIntentInput
): Promise<IntentAnalysisResult> {
  const analyzer = getDefaultIntentAnalyzer();
  return analyzer.analyzeIntent(input);
}
