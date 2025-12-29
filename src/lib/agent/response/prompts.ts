// ═══════════════════════════════════════════════════════════════════════════
// Response Prompt Building
// Builds prompts for LLM response generation based on action decisions
// ═══════════════════════════════════════════════════════════════════════════

import type {
  ActionDecision,
  ExecuteToolDecision,
  ConfirmActionDecision,
  ClarifyDecision,
  RespondDecision,
  ErrorDecision,
} from "../routing/types";
import type { ContextRetrieval, RankedContext } from "../context/types";
import type { ResponseStyle } from "../llm/types";

// ─────────────────────────────────────────────────────────────
// System Prompts
// ─────────────────────────────────────────────────────────────

/**
 * Base system prompt for all response generation
 */
const BASE_SYSTEM_PROMPT = `You are Theo, a helpful AI assistant. Generate clear, friendly responses based on the action context provided.

Key principles:
1. Be concise but complete - don't over-explain
2. When you've done something, clearly state what was done
3. If assumptions were made, briefly mention the most important ones
4. For errors, explain what went wrong and suggest next steps
5. Maintain a helpful, professional tone
6. Never include JSON, formatting markers, or technical jargon in responses`;

/**
 * System prompt for execution responses
 */
const EXECUTE_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

For tool execution:
- Summarize what action was taken or will be taken
- Include key details (who, what, when) naturally
- If results are available, incorporate them conversationally
- If approval is required, explain clearly what will happen after approval`;

/**
 * System prompt for confirmation requests
 */
const CONFIRM_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

For confirmation requests:
- Summarize the proposed action clearly
- Explain what you're uncertain about
- Ask for explicit confirmation in a natural way
- Keep assumptions visible so user can correct if needed`;

/**
 * System prompt for clarification requests
 */
const CLARIFY_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

For clarification requests:
- Acknowledge what you understood
- Ask the most important question first
- Don't ask more than 2 questions at once
- Be specific about what information you need`;

/**
 * System prompt for conversational responses
 */
const CONVERSATIONAL_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

For conversational responses:
- Match the user's tone when appropriate
- Be informative but not verbose
- If providing information, organize it clearly
- For simple acknowledgments, keep responses brief`;

/**
 * System prompt for error responses
 */
const ERROR_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

For error responses:
- Explain the issue in user-friendly terms
- Don't expose technical details or stack traces
- Always suggest a next step or alternative
- Be empathetic but not overly apologetic`;

// ─────────────────────────────────────────────────────────────
// Response Prompt Builders
// ─────────────────────────────────────────────────────────────

/**
 * Get the appropriate system prompt for a decision type
 */
export function getSystemPromptForDecision(decision: ActionDecision): string {
  switch (decision.type) {
    case "execute_tool":
      return EXECUTE_SYSTEM_PROMPT;
    case "confirm_action":
      return CONFIRM_SYSTEM_PROMPT;
    case "clarify":
      return CLARIFY_SYSTEM_PROMPT;
    case "respond":
      return CONVERSATIONAL_SYSTEM_PROMPT;
    case "error":
      return ERROR_SYSTEM_PROMPT;
  }
}

/**
 * Build the main response generation prompt based on the action decision
 *
 * @param decision - The action decision from routing
 * @param context - Retrieved context for enrichment
 * @param options - Additional options for prompt building
 * @returns The formatted prompt for LLM response generation
 */
export function buildResponsePromptFromDecision(
  decision: ActionDecision,
  context: ContextRetrieval | RankedContext,
  options?: ResponsePromptOptions
): string {
  switch (decision.type) {
    case "execute_tool":
      return buildExecutePrompt(decision, context, options);
    case "confirm_action":
      return buildConfirmPrompt(decision, context, options);
    case "clarify":
      return buildClarifyPrompt(decision, context, options);
    case "respond":
      return buildRespondPrompt(decision, context, options);
    case "error":
      return buildErrorPrompt(decision, options);
  }
}

/**
 * Options for prompt building
 */
export interface ResponsePromptOptions {
  /** User's original message */
  originalMessage?: string;

  /** Tool execution result (for execute decisions) */
  toolResult?: ToolResultForPrompt;

  /** Style preferences */
  style?: ResponseStyle;

  /** Maximum response length (words) */
  maxLength?: number;

  /** Whether to include assumptions in the response */
  includeAssumptions?: boolean;

  /** User's timezone */
  timezone?: string;
}

/**
 * Tool result information for prompts
 */
export interface ToolResultForPrompt {
  /** Whether execution succeeded */
  success: boolean;

  /** Result data (if success) */
  result?: unknown;

  /** Error message (if failed) */
  error?: string;

  /** Summary of what was done */
  summary?: string;
}

// ─────────────────────────────────────────────────────────────
// Decision-Specific Prompt Builders
// ─────────────────────────────────────────────────────────────

/**
 * Build prompt for tool execution response
 */
function buildExecutePrompt(
  decision: ExecuteToolDecision,
  context: ContextRetrieval | RankedContext,
  options?: ResponsePromptOptions
): string {
  const parts: string[] = [];

  // User message context
  if (options?.originalMessage) {
    parts.push(`## User's Request\n"${options.originalMessage}"\n`);
  }

  // Action details
  parts.push("## Action Taken");
  parts.push(`Tool: ${decision.tool}`);
  parts.push(`Confidence: ${(decision.confidence * 100).toFixed(0)}%`);

  // Parameters summary
  const paramSummary = summarizeParams(decision.params);
  if (paramSummary) {
    parts.push(`Parameters: ${paramSummary}`);
  }
  parts.push("");

  // Approval status
  if (decision.requiresApproval) {
    parts.push("## Status");
    parts.push("This action requires your approval before execution.");
    parts.push("");
  }

  // Tool result if available
  if (options?.toolResult) {
    parts.push("## Execution Result");
    if (options.toolResult.success) {
      parts.push("Status: Success");
      if (options.toolResult.summary) {
        parts.push(`Summary: ${options.toolResult.summary}`);
      } else if (options.toolResult.result) {
        parts.push(`Result: ${formatResultForPrompt(options.toolResult.result)}`);
      }
    } else {
      parts.push("Status: Failed");
      if (options.toolResult.error) {
        parts.push(`Error: ${options.toolResult.error}`);
      }
    }
    parts.push("");
  }

  // Assumptions
  if (options?.includeAssumptions !== false && decision.assumptions.length > 0) {
    parts.push("## Assumptions Made");
    for (const assumption of decision.assumptions.slice(0, 3)) {
      parts.push(`- ${assumption.statement}`);
    }
    parts.push("");
  }

  // Context summary
  const contextSummary = extractContextSummary(context);
  if (contextSummary) {
    parts.push("## Relevant Context");
    parts.push(contextSummary);
    parts.push("");
  }

  // Generation instructions
  parts.push(buildGenerationInstructions(options));

  return parts.join("\n");
}

/**
 * Build prompt for confirmation request response
 */
function buildConfirmPrompt(
  decision: ConfirmActionDecision,
  context: ContextRetrieval | RankedContext,
  options?: ResponsePromptOptions
): string {
  const parts: string[] = [];

  // User message context
  if (options?.originalMessage) {
    parts.push(`## User's Request\n"${options.originalMessage}"\n`);
  }

  // Proposed action
  parts.push("## Proposed Action");
  parts.push(`Tool: ${decision.tool}`);
  parts.push(`Confidence: ${(decision.confidence * 100).toFixed(0)}%`);

  const paramSummary = summarizeParams(decision.params);
  if (paramSummary) {
    parts.push(`Parameters: ${paramSummary}`);
  }
  parts.push("");

  // Uncertainties
  if (decision.uncertainties.length > 0) {
    parts.push("## Uncertainties");
    for (const uncertainty of decision.uncertainties) {
      parts.push(`- ${uncertainty}`);
    }
    parts.push("");
  }

  // Assumptions to verify
  if (decision.assumptionsToVerify.length > 0) {
    parts.push("## Assumptions to Verify");
    for (const assumption of decision.assumptionsToVerify) {
      parts.push(`- ${assumption.statement}`);
    }
    parts.push("");
  }

  // Context
  const contextSummary = extractContextSummary(context);
  if (contextSummary) {
    parts.push("## Relevant Context");
    parts.push(contextSummary);
    parts.push("");
  }

  // Instructions
  parts.push("## Generate Confirmation Request");
  parts.push(
    "Ask the user to confirm the action. Be clear about what will happen if they confirm."
  );
  if (decision.uncertainties.length > 0) {
    parts.push(
      "Mention the key uncertainties naturally in your question."
    );
  }
  parts.push("");
  parts.push(buildGenerationInstructions(options));

  return parts.join("\n");
}

/**
 * Build prompt for clarification request response
 */
function buildClarifyPrompt(
  decision: ClarifyDecision,
  context: ContextRetrieval | RankedContext,
  options?: ResponsePromptOptions
): string {
  const parts: string[] = [];

  // User message context
  if (options?.originalMessage) {
    parts.push(`## User's Request\n"${options.originalMessage}"\n`);
  }

  // What we understood
  if (decision.partialUnderstanding) {
    parts.push("## What We Understood");
    if (decision.partialUnderstanding.possibleIntent) {
      parts.push(`Possible intent: ${decision.partialUnderstanding.possibleIntent}`);
    }
    if (decision.partialUnderstanding.possibleTool) {
      parts.push(`Possible action: ${decision.partialUnderstanding.possibleTool}`);
    }
    if (decision.partialUnderstanding.recognizedEntities?.length) {
      parts.push(
        `Recognized: ${decision.partialUnderstanding.recognizedEntities.join(", ")}`
      );
    }
    parts.push("");
  }

  // Missing information
  parts.push("## Missing Information");
  for (const info of decision.missingInfo) {
    parts.push(`- ${info}`);
  }
  parts.push("");

  // Suggested questions
  parts.push("## Suggested Questions");
  for (const question of decision.questions) {
    parts.push(`- ${question}`);
  }
  parts.push("");

  // Clarification reason
  parts.push(`## Reason for Clarification`);
  parts.push(formatClarificationReason(decision.clarificationReason));
  parts.push("");

  // Context
  const contextSummary = extractContextSummary(context);
  if (contextSummary) {
    parts.push("## Relevant Context");
    parts.push(contextSummary);
    parts.push("");
  }

  // Instructions
  parts.push("## Generate Clarification Request");
  parts.push("Ask the user for the missing information.");
  parts.push("Prioritize the most important question - don't ask everything at once.");
  parts.push("Acknowledge what you did understand to show progress.");
  parts.push("");
  parts.push(buildGenerationInstructions(options));

  return parts.join("\n");
}

/**
 * Build prompt for conversational response
 */
function buildRespondPrompt(
  decision: RespondDecision,
  context: ContextRetrieval | RankedContext,
  options?: ResponsePromptOptions
): string {
  const parts: string[] = [];

  // User message context
  if (options?.originalMessage) {
    parts.push(`## User's Message\n"${options.originalMessage}"\n`);
  }

  // Response style
  parts.push("## Response Style");
  parts.push(`Style: ${decision.responseStyle}`);
  parts.push(`Simple response: ${decision.isSimple ? "Yes" : "No"}`);
  parts.push("");

  // Response context from decision
  if (decision.responseContext) {
    parts.push("## Response Context");
    parts.push(decision.responseContext);
    parts.push("");
  }

  // Retrieved context
  const contextSummary = extractContextSummary(context);
  if (contextSummary) {
    parts.push("## Relevant Information");
    parts.push(contextSummary);
    parts.push("");
  }

  // Instructions
  parts.push("## Generate Response");
  if (decision.isSimple) {
    parts.push("Keep the response brief - this is a simple acknowledgment or answer.");
  } else {
    parts.push("Provide a thoughtful response based on the context above.");
  }
  parts.push("");
  parts.push(buildGenerationInstructions(options));

  return parts.join("\n");
}

/**
 * Build prompt for error response
 */
function buildErrorPrompt(
  decision: ErrorDecision,
  options?: ResponsePromptOptions
): string {
  const parts: string[] = [];

  // User message context
  if (options?.originalMessage) {
    parts.push(`## User's Request\n"${options.originalMessage}"\n`);
  }

  // Error details
  parts.push("## Error Information");
  parts.push(`Type: ${decision.errorCode}`);
  parts.push(`Message: ${decision.error}`);
  parts.push(`Recoverable: ${decision.recoverable ? "Yes" : "No"}`);
  if (decision.recoverySuggestion) {
    parts.push(`Suggested recovery: ${decision.recoverySuggestion}`);
  }
  parts.push("");

  // Instructions
  parts.push("## Generate Error Response");
  parts.push("Explain the issue in user-friendly terms.");
  parts.push("Don't include technical details or jargon.");
  if (decision.recoverable) {
    parts.push("Suggest what the user can do to resolve the issue.");
  }
  parts.push("");
  parts.push(buildGenerationInstructions(options));

  return parts.join("\n");
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Summarize parameters for prompt display
 */
function summarizeParams(params: Record<string, unknown>): string {
  const entries = Object.entries(params);
  if (entries.length === 0) return "";

  const summaries = entries.map(([key, value]) => {
    if (typeof value === "string") {
      // Truncate long strings
      const display = value.length > 50 ? value.slice(0, 47) + "..." : value;
      return `${key}: "${display}"`;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return `${key}: ${value}`;
    }
    if (Array.isArray(value)) {
      return `${key}: [${value.length} items]`;
    }
    if (value === null) {
      return `${key}: null`;
    }
    if (typeof value === "object") {
      return `${key}: {...}`;
    }
    return `${key}: ${String(value)}`;
  });

  return summaries.join(", ");
}

/**
 * Format a result object for inclusion in prompt
 */
function formatResultForPrompt(result: unknown): string {
  if (result === null || result === undefined) {
    return "No data";
  }
  if (typeof result === "string") {
    return result.length > 200 ? result.slice(0, 197) + "..." : result;
  }
  if (typeof result === "number" || typeof result === "boolean") {
    return String(result);
  }
  if (Array.isArray(result)) {
    return `${result.length} items returned`;
  }
  if (typeof result === "object") {
    try {
      const json = JSON.stringify(result, null, 2);
      return json.length > 500 ? json.slice(0, 497) + "..." : json;
    } catch {
      return "[Complex object]";
    }
  }
  return String(result);
}

/**
 * Type guard to check if context is RankedContext
 */
function isRankedContext(
  context: ContextRetrieval | RankedContext
): context is RankedContext {
  return "topItems" in context && "contextSummary" in context && "estimatedTokens" in context;
}

/**
 * Extract a summary from context (works with both types)
 */
function extractContextSummary(
  context: ContextRetrieval | RankedContext
): string | null {
  // Use proper type guard to distinguish between types
  if (isRankedContext(context)) {
    // RankedContext - return contextSummary if non-empty
    return context.contextSummary.trim() || null;
  }

  // It's ContextRetrieval - build a brief summary
  const items: string[] = [];

  if (context.relevantPeople.length > 0) {
    items.push(
      `People: ${context.relevantPeople
        .slice(0, 3)
        .map((p) => p.item.name)
        .join(", ")}`
    );
  }
  if (context.relevantEvents.length > 0) {
    items.push(
      `Events: ${context.relevantEvents
        .slice(0, 3)
        .map((e) => e.item.title)
        .join(", ")}`
    );
  }
  if (context.relevantTasks.length > 0) {
    items.push(
      `Tasks: ${context.relevantTasks
        .slice(0, 3)
        .map((t) => t.item.title)
        .join(", ")}`
    );
  }

  return items.length > 0 ? items.join("\n") : null;
}

/**
 * Format clarification reason as human-readable text
 */
function formatClarificationReason(
  reason: ClarifyDecision["clarificationReason"]
): string {
  switch (reason) {
    case "low_confidence":
      return "I'm not confident enough about what you're asking for.";
    case "ambiguous_entity":
      return "Some references are ambiguous and could match multiple things.";
    case "missing_required_info":
      return "Some required information is missing from your request.";
    case "multiple_interpretations":
      return "Your request could be interpreted in multiple ways.";
    case "unclear_intent":
      return "I couldn't determine what action you'd like me to take.";
    default:
      return "Additional information is needed to proceed.";
  }
}

/**
 * Build common generation instructions
 */
function buildGenerationInstructions(options?: ResponsePromptOptions): string {
  const parts: string[] = ["## Response Guidelines"];

  // Tone
  if (options?.style?.tone) {
    switch (options.style.tone) {
      case "professional":
        parts.push("- Use a professional, formal tone");
        break;
      case "brief":
        parts.push("- Be very brief and to the point");
        break;
      default:
        parts.push("- Use a friendly, conversational tone");
    }
  } else {
    parts.push("- Use a friendly, conversational tone");
  }

  // Length
  if (options?.maxLength) {
    parts.push(`- Keep response under ${options.maxLength} words`);
  }

  // Assumptions
  if (options?.includeAssumptions === false) {
    parts.push("- Do not mention assumptions");
  } else {
    parts.push("- Briefly mention key assumptions if relevant");
  }

  parts.push(
    "- Respond naturally as Theo - no JSON, no markdown headers, no formatting markers"
  );

  return parts.join("\n");
}

// ─────────────────────────────────────────────────────────────
// Template-Based Response Building (No LLM)
// ─────────────────────────────────────────────────────────────

/**
 * Build a simple template response without LLM
 * Used for simple confirmations, acknowledgments, and errors
 */
export function buildTemplateResponse(
  decision: ActionDecision,
  options?: ResponsePromptOptions
): string | null {
  switch (decision.type) {
    case "execute_tool":
      return buildExecuteTemplate(decision, options);
    case "confirm_action":
      return buildConfirmTemplate(decision);
    case "clarify":
      return buildClarifyTemplate(decision);
    case "error":
      return buildErrorTemplate(decision);
    case "respond":
      // Conversational responses should use LLM
      return null;
  }
}

/**
 * Simple template for execution confirmation
 */
function buildExecuteTemplate(
  decision: ExecuteToolDecision,
  options?: ResponsePromptOptions
): string | null {
  // Only use template for simple successful executions
  if (!options?.toolResult?.success) {
    return null;
  }

  const toolDisplayName = formatToolName(decision.tool);

  if (decision.requiresApproval) {
    return `I'd like to ${toolDisplayName}. This action requires your approval before I proceed.`;
  }

  if (options?.toolResult?.summary) {
    return `Done! ${options.toolResult.summary}`;
  }

  return `Done! I've completed the ${toolDisplayName}.`;
}

/**
 * Simple template for confirmation request
 */
function buildConfirmTemplate(decision: ConfirmActionDecision): string {
  const toolDisplayName = formatToolName(decision.tool);

  if (decision.uncertainties.length > 0) {
    const uncertainty = decision.uncertainties[0];
    return `I can ${toolDisplayName}, but I want to confirm: ${uncertainty}. Should I proceed?`;
  }

  return `Would you like me to ${toolDisplayName}?`;
}

/**
 * Simple template for clarification
 */
function buildClarifyTemplate(decision: ClarifyDecision): string {
  if (decision.questions.length > 0) {
    const primaryQuestion = decision.questions[0];
    if (decision.partialUnderstanding?.possibleIntent) {
      return `I think you want to ${decision.partialUnderstanding.possibleIntent}, but ${primaryQuestion}`;
    }
    return primaryQuestion;
  }

  if (decision.missingInfo.length > 0) {
    return `I need to know: ${decision.missingInfo[0]}`;
  }

  return "Could you tell me more about what you'd like me to do?";
}

/**
 * Simple template for errors
 */
function buildErrorTemplate(decision: ErrorDecision): string {
  const base = `I ran into an issue: ${decision.error}`;

  if (decision.recoverySuggestion) {
    return `${base} ${decision.recoverySuggestion}`;
  }

  if (decision.recoverable) {
    return `${base} Would you like to try again?`;
  }

  return base;
}

/**
 * Format tool name for display
 */
function formatToolName(toolName: string): string {
  // Convert snake_case to readable text
  return toolName
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
}


