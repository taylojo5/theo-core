// ═══════════════════════════════════════════════════════════════════════════
// Action Router
// Routes LLM classification to appropriate actions based on confidence
// ═══════════════════════════════════════════════════════════════════════════

import type { ClassificationResponse, LLMAssumption } from "../llm/types";
import type { ResolutionResult, ResolvedEntity } from "../entities/types";
import { toolRegistry } from "../tools/registry";
import { agentLogger } from "../logger";
import {
  DEFAULT_THRESHOLDS,
  getThresholdBand,
  mergeThresholds,
} from "./thresholds";
import type {
  PerceptionResult,
  ActionDecision,
  ExecuteToolDecision,
  ConfirmActionDecision,
  ClarifyDecision,
  RespondDecision,
  ErrorDecision,
  RoutingContext,
  RoutingResult,
  ConfidenceThresholdConfig,
  ClarificationReason,
  ResponseStyle,
  IActionRouter,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Action Router Class
// ─────────────────────────────────────────────────────────────

/**
 * ActionRouter routes LLM classification results to appropriate actions.
 *
 * The router uses confidence thresholds to decide:
 * - High confidence → Execute immediately
 * - Medium confidence → Confirm with user
 * - Low confidence → Ask clarifying questions
 * - No tool suggested → Generate conversational response
 *
 * The LLM has already done the heavy lifting (classification, entity extraction,
 * tool suggestion). This router just applies decision logic based on confidence.
 */
export class ActionRouter implements IActionRouter {
  private thresholds: ConfidenceThresholdConfig;

  constructor(thresholds?: Partial<ConfidenceThresholdConfig>) {
    this.thresholds = mergeThresholds(thresholds);
  }

  /**
   * Route perception result to an action decision
   */
  async routeToAction(
    perception: PerceptionResult,
    context?: RoutingContext
  ): Promise<RoutingResult> {
    const startTime = Date.now();

    // Merge user-specific thresholds if provided
    const effectiveThresholds = context?.userThresholds
      ? mergeThresholds({ ...this.thresholds, ...context.userThresholds })
      : this.thresholds;

    // Override to always confirm if user preference is set
    const alwaysConfirm = context?.alwaysConfirm ?? false;

    try {
      const decision = this.makeDecision(
        perception,
        effectiveThresholds,
        alwaysConfirm,
        context?.disabledTools
      );

      agentLogger.debug("Routing decision made", {
        decisionType: decision.type,
        confidence: perception.classification.confidence,
        thresholds: effectiveThresholds,
      });

      return {
        decision,
        perception,
        thresholdsUsed: effectiveThresholds,
        durationMs: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      agentLogger.error("Routing failed", { error });

      const errorDecision: ErrorDecision = {
        type: "error",
        errorCode: "perception_failed",
        error: error instanceof Error ? error.message : "Unknown routing error",
        recoverable: true,
        recoverySuggestion: "Please try rephrasing your request",
      };

      return {
        decision: errorDecision,
        perception,
        thresholdsUsed: effectiveThresholds,
        durationMs: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Check if a classification should be executed immediately
   */
  shouldExecute(
    classification: ClassificationResponse,
    resolution: ResolutionResult
  ): boolean {
    // Must have a suggested tool
    if (!classification.suggestedTool) {
      return false;
    }

    // Must have high confidence
    if (classification.confidence < this.thresholds.execute) {
      return false;
    }

    // Must not have unresolved entities that are critical
    if (this.hasCriticalUnresolvedEntities(classification, resolution)) {
      return false;
    }

    // Must not require clarification
    if (classification.clarificationNeeded?.required) {
      return false;
    }

    return true;
  }

  /**
   * Check if clarification is needed
   */
  needsClarification(
    classification: ClassificationResponse,
    resolution: ResolutionResult
  ): boolean {
    // Explicit clarification requested by LLM
    if (classification.clarificationNeeded?.required) {
      return true;
    }

    // Low overall confidence
    if (classification.confidence < this.thresholds.clarify) {
      return true;
    }

    // Ambiguous entities need clarification
    if (resolution.ambiguous.length > 0) {
      return true;
    }

    // Critical entities not found
    if (this.hasCriticalNotFoundEntities(classification, resolution)) {
      return true;
    }

    return false;
  }

  /**
   * Get current threshold configuration
   */
  getThresholds(): ConfidenceThresholdConfig {
    return { ...this.thresholds };
  }

  // ─────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Main decision-making logic
   */
  private makeDecision(
    perception: PerceptionResult,
    thresholds: ConfidenceThresholdConfig,
    alwaysConfirm: boolean,
    disabledTools?: string[]
  ): ActionDecision {
    const { classification, resolution } = perception;

    // Check if clarification is needed first
    if (this.needsClarification(classification, resolution)) {
      return this.buildClarifyDecision(classification, resolution);
    }

    // If no tool suggested, route to conversational response
    if (!classification.suggestedTool) {
      return this.buildRespondDecision(classification);
    }

    const { suggestedTool } = classification;

    // Check if tool is disabled
    if (disabledTools?.includes(suggestedTool.name)) {
      return {
        type: "error",
        errorCode: "tool_not_found",
        error: `The tool "${suggestedTool.name}" is currently disabled`,
        recoverable: true,
        recoverySuggestion: "Please enable the tool or try a different approach",
      };
    }

    // Verify tool exists in registry
    const toolDef = toolRegistry.get(suggestedTool.name);
    if (!toolDef) {
      return {
        type: "error",
        errorCode: "tool_not_found",
        error: `Tool "${suggestedTool.name}" not found`,
        recoverable: true,
        recoverySuggestion: "Please try a different request",
      };
    }

    // Determine the confidence band
    const band = getThresholdBand(classification.confidence, thresholds);

    // If user always wants confirmation, downgrade execute to confirm
    if (alwaysConfirm && band === "execute") {
      return this.buildConfirmDecision(classification, suggestedTool);
    }

    switch (band) {
      case "execute":
        // High confidence - execute immediately (may still require approval based on tool)
        return this.buildExecuteDecision(classification, suggestedTool, toolDef);

      case "confirm":
        // Medium confidence - ask for confirmation
        return this.buildConfirmDecision(classification, suggestedTool);

      case "clarify":
      case "uncertain":
        // Low confidence - ask clarifying questions
        return this.buildClarifyDecision(classification, resolution);
    }
  }

  /**
   * Build execute tool decision
   */
  private buildExecuteDecision(
    classification: ClassificationResponse,
    suggestedTool: NonNullable<ClassificationResponse["suggestedTool"]>,
    toolDef: { requiresApproval: boolean }
  ): ExecuteToolDecision {
    return {
      type: "execute_tool",
      tool: suggestedTool.name,
      params: suggestedTool.parameters,
      requiresApproval: toolDef.requiresApproval,
      confidence: suggestedTool.confidence,
      reasoning: suggestedTool.reasoning,
      assumptions: classification.assumptions,
    };
  }

  /**
   * Build confirm action decision
   */
  private buildConfirmDecision(
    classification: ClassificationResponse,
    suggestedTool: NonNullable<ClassificationResponse["suggestedTool"]>
  ): ConfirmActionDecision {
    // Build confirmation message
    const confirmationMessage = this.buildConfirmationMessage(
      classification,
      suggestedTool
    );

    // Identify uncertainties
    const uncertainties = this.identifyUncertainties(classification);

    // Find assumptions that should be verified
    const assumptionsToVerify = classification.assumptions.filter(
      (a) => a.confidence < 0.8
    );

    return {
      type: "confirm_action",
      tool: suggestedTool.name,
      params: suggestedTool.parameters,
      confirmationMessage,
      uncertainties,
      confidence: suggestedTool.confidence,
      assumptionsToVerify,
    };
  }

  /**
   * Build clarify decision
   */
  private buildClarifyDecision(
    classification: ClassificationResponse,
    resolution: ResolutionResult
  ): ClarifyDecision {
    const questions: string[] = [];
    const missingInfo: string[] = [];
    let clarificationReason: ClarificationReason = "low_confidence";

    // Add LLM-generated clarification questions
    if (classification.clarificationNeeded?.questions) {
      questions.push(...classification.clarificationNeeded.questions);
    }

    // Add missing info from LLM
    if (classification.clarificationNeeded?.missingInfo) {
      missingInfo.push(...classification.clarificationNeeded.missingInfo);
      clarificationReason = "missing_required_info";
    }

    // Add questions for ambiguous entities
    if (resolution.ambiguous.length > 0) {
      questions.push(...resolution.clarificationQuestions);
      clarificationReason = "ambiguous_entity";
    }

    // Add questions for not-found entities (if critical)
    if (resolution.notFound.length > 0) {
      for (const entity of resolution.notFound) {
        questions.push(
          `I couldn't find "${entity.extracted.text}" in your contacts. Could you provide more details?`
        );
      }
    }

    // If no specific questions, generate generic ones based on low confidence
    if (questions.length === 0) {
      questions.push("Could you please provide more details about what you'd like me to do?");
      clarificationReason = "unclear_intent";
    }

    // Build partial understanding
    const partialUnderstanding: ClarifyDecision["partialUnderstanding"] = {};

    if (classification.intent.category !== "unknown") {
      partialUnderstanding.possibleIntent = classification.intent.summary;
    }
    if (classification.suggestedTool) {
      partialUnderstanding.possibleTool = classification.suggestedTool.name;
    }
    if (resolution.resolved.length > 0) {
      partialUnderstanding.recognizedEntities = resolution.resolved.map(
        (e) => e.extracted.text
      );
    }

    return {
      type: "clarify",
      questions,
      missingInfo,
      partialUnderstanding:
        Object.keys(partialUnderstanding).length > 0
          ? partialUnderstanding
          : undefined,
      clarificationReason,
    };
  }

  /**
   * Build respond decision (no tool needed)
   */
  private buildRespondDecision(
    classification: ClassificationResponse
  ): RespondDecision {
    // Determine response style based on intent
    const responseStyle = this.determineResponseStyle(classification);

    // Build context for response generation
    const responseContext = this.buildResponseContext(classification);

    // Simple responses are acknowledgments or very short answers
    const isSimple =
      classification.intent.category === "conversation" &&
      !classification.entities.length;

    return {
      type: "respond",
      responseStyle,
      responseContext,
      isSimple,
    };
  }

  /**
   * Build confirmation message for the user
   */
  private buildConfirmationMessage(
    classification: ClassificationResponse,
    suggestedTool: NonNullable<ClassificationResponse["suggestedTool"]>
  ): string {
    const action = this.describeToolAction(suggestedTool.name, suggestedTool.parameters);

    // Include key assumptions
    const keyAssumptions = classification.assumptions
      .filter((a) => a.confidence < 0.9)
      .slice(0, 2);

    let message = `I can ${action}. `;

    if (keyAssumptions.length > 0) {
      message += `I'm assuming ${keyAssumptions.map((a) => a.statement.toLowerCase()).join(" and ")}. `;
    }

    message += "Should I proceed?";

    return message;
  }

  /**
   * Identify uncertainties in the classification
   */
  private identifyUncertainties(
    classification: ClassificationResponse
  ): string[] {
    const uncertainties: string[] = [];

    // Low confidence tool suggestion
    if (
      classification.suggestedTool &&
      classification.suggestedTool.confidence < 0.8
    ) {
      uncertainties.push(
        `Uncertain about the action (${Math.round(classification.suggestedTool.confidence * 100)}% confident)`
      );
    }

    // Low confidence assumptions
    for (const assumption of classification.assumptions) {
      if (assumption.confidence < 0.7) {
        uncertainties.push(`Uncertain about: ${assumption.statement}`);
      }
    }

    return uncertainties;
  }

  /**
   * Describe what a tool does for user-facing messages
   */
  private describeToolAction(
    toolName: string,
    params: Record<string, unknown>
  ): string {
    // Get tool definition for better descriptions
    const tool = toolRegistry.get(toolName);

    // Create a simple description based on tool name and key params
    switch (toolName) {
      case "send_email":
        return `send an email to ${params.to || "the recipient"}`;
      case "draft_email":
        return `draft an email to ${params.to || "the recipient"}`;
      case "create_task":
        return `create a task: "${params.title || params.description || "new task"}"`;
      case "create_event":
      case "create_calendar_event":
        return `schedule "${params.title || params.summary || "an event"}"`;
      case "update_task":
        return `update the task "${params.title || "selected task"}"`;
      case "update_event":
      case "update_calendar_event":
        return `update "${params.title || params.summary || "the event"}"`;
      default:
        return tool?.description || `execute ${toolName}`;
    }
  }

  /**
   * Determine response style based on classification
   */
  private determineResponseStyle(
    classification: ClassificationResponse
  ): ResponseStyle {
    const category = classification.intent.category;

    switch (category) {
      case "query":
        return "informational";
      case "conversation":
        return "conversational";
      case "unknown":
        return "clarification";
      default:
        return "informational";
    }
  }

  /**
   * Build context string for response generation
   */
  private buildResponseContext(
    classification: ClassificationResponse
  ): string {
    const parts: string[] = [];

    parts.push(`User intent: ${classification.intent.summary}`);

    if (classification.entities.length > 0) {
      const entityDescriptions = classification.entities
        .map((e) => `${e.type}: "${e.text}"`)
        .join(", ");
      parts.push(`Mentioned: ${entityDescriptions}`);
    }

    return parts.join(". ");
  }

  /**
   * Check if there are critical unresolved entities
   * (entities that are required for the suggested tool)
   */
  private hasCriticalUnresolvedEntities(
    classification: ClassificationResponse,
    resolution: ResolutionResult
  ): boolean {
    // If no tool suggested, no critical entities
    if (!classification.suggestedTool) {
      return false;
    }

    // Check if any ambiguous or not-found entities are used in tool params
    const toolParams = classification.suggestedTool.parameters;
    const unresolvedTexts = [
      ...resolution.ambiguous.map((e) => e.extracted.text.toLowerCase()),
      ...resolution.notFound.map((e) => e.extracted.text.toLowerCase()),
    ];

    // Check if any parameter values reference unresolved entities
    for (const value of Object.values(toolParams)) {
      if (typeof value === "string") {
        const lowerValue = value.toLowerCase();
        if (unresolvedTexts.some((text) => lowerValue.includes(text))) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if there are critical not-found entities
   */
  private hasCriticalNotFoundEntities(
    classification: ClassificationResponse,
    resolution: ResolutionResult
  ): boolean {
    // Only critical if we're trying to use a tool
    if (!classification.suggestedTool) {
      return false;
    }

    // Check for person entities that need resolution
    const personNotFound = resolution.notFound.filter(
      (e) => e.extracted.type === "person"
    );

    return personNotFound.length > 0;
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton and Factory Functions
// ─────────────────────────────────────────────────────────────

/**
 * Default action router instance
 */
export const actionRouter = new ActionRouter();

/**
 * Create a new action router with custom thresholds
 */
export function createActionRouter(
  thresholds?: Partial<ConfidenceThresholdConfig>
): ActionRouter {
  return new ActionRouter(thresholds);
}

// ─────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────

/**
 * Route perception result to action (convenience function)
 */
export async function routeToAction(
  perception: PerceptionResult,
  context?: RoutingContext
): Promise<RoutingResult> {
  return actionRouter.routeToAction(perception, context);
}

/**
 * Check if classification should execute immediately
 */
export function shouldExecute(
  classification: ClassificationResponse,
  resolution: ResolutionResult,
  thresholds?: Partial<ConfidenceThresholdConfig>
): boolean {
  const router = thresholds ? new ActionRouter(thresholds) : actionRouter;
  return router.shouldExecute(classification, resolution);
}

/**
 * Check if clarification is needed
 */
export function needsClarification(
  classification: ClassificationResponse,
  resolution: ResolutionResult,
  thresholds?: Partial<ConfidenceThresholdConfig>
): boolean {
  const router = thresholds ? new ActionRouter(thresholds) : actionRouter;
  return router.needsClarification(classification, resolution);
}


