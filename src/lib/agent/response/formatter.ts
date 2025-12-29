// ═══════════════════════════════════════════════════════════════════════════
// Response Formatter
// Formats LLM output and action decisions into structured responses
// ═══════════════════════════════════════════════════════════════════════════

import type {
  ActionDecision,
  ExecuteToolDecision,
  ConfirmActionDecision,
  ClarifyDecision,
  RespondDecision,
  ErrorDecision,
} from "../routing/types";
import type { TokenUsage } from "../llm/types";
import type {
  FormattedResponse,
  ExecuteResponse,
  ConfirmResponse,
  ClarifyResponse,
  ConversationalResponse,
  ErrorResponse,
  ResponseGenerationMetadata,
} from "./types";
import { convertAssumptions } from "./types";

// ─────────────────────────────────────────────────────────────
// Core Formatting Functions
// ─────────────────────────────────────────────────────────────

/**
 * Format a response from an action decision and LLM-generated content
 *
 * @param content - LLM-generated response content
 * @param decision - The action decision that led to this response
 * @param options - Additional formatting options
 * @returns Formatted response with full metadata
 */
export function formatResponse(
  content: string,
  decision: ActionDecision,
  options: FormatOptions = {}
): FormattedResponse {
  const metadata = buildMetadata(options);

  switch (decision.type) {
    case "execute_tool":
      return formatExecuteResponse(content, decision, options, metadata);
    case "confirm_action":
      return formatConfirmResponse(content, decision, metadata);
    case "clarify":
      return formatClarifyResponse(content, decision, metadata);
    case "respond":
      return formatConversationalResponse(content, decision, metadata);
    case "error":
      return formatErrorResponse(content, decision, metadata);
  }
}

/**
 * Options for response formatting
 */
export interface FormatOptions {
  /** Tokens used in generation */
  tokensUsed?: TokenUsage;

  /** Processing duration in milliseconds */
  durationMs?: number;

  /** Model used for generation */
  model?: string;

  /** How the response was generated */
  generationType?: "llm" | "template" | "direct";

  /** Tool execution result (for execute decisions) */
  toolResult?: {
    success: boolean;
    result?: unknown;
    error?: string;
  };

  /** Approval ID (for pending approvals) */
  approvalId?: string;
}

// ─────────────────────────────────────────────────────────────
// Decision-Specific Formatters
// ─────────────────────────────────────────────────────────────

/**
 * Format an execute response
 */
function formatExecuteResponse(
  content: string,
  decision: ExecuteToolDecision,
  options: FormatOptions,
  metadata: ResponseGenerationMetadata
): ExecuteResponse {
  return {
    type: "execute",
    content,
    tool: decision.tool,
    params: decision.params,
    requiresApproval: decision.requiresApproval,
    approvalId: options.approvalId,
    result: options.toolResult?.result,
    decision,
    assumptions: convertAssumptions(decision.assumptions),
    confidence: decision.confidence,
    metadata,
  };
}

/**
 * Format a confirm response
 */
function formatConfirmResponse(
  content: string,
  decision: ConfirmActionDecision,
  metadata: ResponseGenerationMetadata
): ConfirmResponse {
  return {
    type: "confirm",
    content,
    tool: decision.tool,
    params: decision.params,
    uncertainties: decision.uncertainties,
    decision,
    assumptionsToVerify: convertAssumptions(decision.assumptionsToVerify),
    confidence: decision.confidence,
    metadata,
  };
}

/**
 * Format a clarify response
 */
function formatClarifyResponse(
  content: string,
  decision: ClarifyDecision,
  metadata: ResponseGenerationMetadata
): ClarifyResponse {
  return {
    type: "clarify",
    content,
    questions: decision.questions,
    missingInfo: decision.missingInfo,
    partialUnderstanding: decision.partialUnderstanding,
    decision,
    metadata,
  };
}

/**
 * Format a conversational response
 */
function formatConversationalResponse(
  content: string,
  decision: RespondDecision,
  metadata: ResponseGenerationMetadata
): ConversationalResponse {
  return {
    type: "respond",
    content,
    decision,
    isSimple: decision.isSimple,
    metadata,
  };
}

/**
 * Format an error response
 */
function formatErrorResponse(
  content: string,
  decision: ErrorDecision,
  metadata: ResponseGenerationMetadata
): ErrorResponse {
  return {
    type: "error",
    content,
    errorCode: decision.errorCode,
    recoverable: decision.recoverable,
    recoverySuggestion: decision.recoverySuggestion,
    decision,
    metadata,
  };
}

// ─────────────────────────────────────────────────────────────
// Tool Result Formatting
// ─────────────────────────────────────────────────────────────

/**
 * Format a tool execution result for user display
 * Converts raw results into human-readable summaries
 *
 * @param toolName - Name of the tool that was executed
 * @param result - Raw result from tool execution
 * @returns Human-readable result summary
 */
export function formatToolResult(toolName: string, result: unknown): string {
  if (result === null || result === undefined) {
    return "Action completed.";
  }

  // Handle arrays (list results)
  if (Array.isArray(result)) {
    return formatArrayResult(toolName, result);
  }

  // Handle objects with common patterns
  if (typeof result === "object") {
    return formatObjectResult(toolName, result as Record<string, unknown>);
  }

  // Handle primitives
  if (typeof result === "string") {
    return result.length > 200 ? result.slice(0, 197) + "..." : result;
  }

  if (typeof result === "number" || typeof result === "boolean") {
    return String(result);
  }

  return "Action completed successfully.";
}

/**
 * Format array results
 */
function formatArrayResult(toolName: string, results: unknown[]): string {
  if (results.length === 0) {
    return formatEmptyResult(toolName);
  }

  const count = results.length;
  const noun = inferResultNoun(toolName);

  if (count === 1) {
    return `Found 1 ${noun}.`;
  }

  return `Found ${count} ${noun}s.`;
}

/**
 * Format object results
 */
function formatObjectResult(
  toolName: string,
  result: Record<string, unknown>
): string {
  // Check for common result patterns

  // Created/updated entity pattern
  if (result.id && (result.createdAt || result.created)) {
    const name = (result.title ||
      result.name ||
      result.subject ||
      "item") as string;
    return `Created: ${name}`;
  }

  // Success with message
  if (result.success === true && result.message) {
    return String(result.message);
  }

  // Count result
  if (typeof result.count === "number") {
    const noun = inferResultNoun(toolName);
    return result.count === 1
      ? `Found 1 ${noun}.`
      : `Found ${result.count} ${noun}s.`;
  }

  // Items array
  if (Array.isArray(result.items)) {
    return formatArrayResult(toolName, result.items);
  }

  // Data array
  if (Array.isArray(result.data)) {
    return formatArrayResult(toolName, result.data);
  }

  // Default: summarize key fields
  const summaryFields = ["title", "name", "subject", "summary", "description"];
  for (const field of summaryFields) {
    if (typeof result[field] === "string") {
      return String(result[field]);
    }
  }

  return "Action completed successfully.";
}

/**
 * Format empty result
 */
function formatEmptyResult(toolName: string): string {
  const noun = inferResultNoun(toolName);
  return `No ${noun}s found.`;
}

/**
 * Infer result noun from tool name
 */
function inferResultNoun(toolName: string): string {
  const nameMap: Record<string, string> = {
    query_events: "event",
    list_events: "event",
    search_events: "event",
    query_tasks: "task",
    list_tasks: "task",
    search_tasks: "task",
    query_emails: "email",
    list_emails: "email",
    search_emails: "email",
    query_people: "person",
    list_people: "person",
    search_people: "person",
    query_deadlines: "deadline",
    list_deadlines: "deadline",
    query_context: "result",
  };

  if (nameMap[toolName]) {
    return nameMap[toolName];
  }

  // Extract noun from tool name
  const parts = toolName.split("_");
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    // Remove trailing 's' if present
    if (lastPart.endsWith("s") && lastPart.length > 3) {
      return lastPart.slice(0, -1);
    }
    return lastPart;
  }

  return "item";
}

// ─────────────────────────────────────────────────────────────
// Result Highlighting & Truncation
// ─────────────────────────────────────────────────────────────

/**
 * Extract key highlights from a result for display
 * Returns string summaries suitable for user-facing display
 *
 * @param result - Raw result to extract highlights from
 * @param maxHighlights - Maximum number of highlights to extract
 * @returns Array of highlight strings
 */
export function extractDisplayHighlights(
  result: unknown,
  maxHighlights = 3
): string[] {
  const highlights: string[] = [];

  if (Array.isArray(result)) {
    // Extract highlights from array items
    for (const item of result.slice(0, maxHighlights)) {
      const highlight = extractItemHighlight(item);
      if (highlight) {
        highlights.push(highlight);
      }
    }
  } else if (typeof result === "object" && result !== null) {
    const obj = result as Record<string, unknown>;

    // Check for items/data array
    const items = obj.items || obj.data;
    if (Array.isArray(items)) {
      for (const item of items.slice(0, maxHighlights)) {
        const highlight = extractItemHighlight(item);
        if (highlight) {
          highlights.push(highlight);
        }
      }
    } else {
      // Single object result
      const highlight = extractItemHighlight(obj);
      if (highlight) {
        highlights.push(highlight);
      }
    }
  }

  return highlights;
}

/**
 * Extract a highlight from a single item
 */
function extractItemHighlight(item: unknown): string | null {
  if (typeof item === "string") {
    return item.length > 50 ? item.slice(0, 47) + "..." : item;
  }

  if (typeof item !== "object" || item === null) {
    return null;
  }

  const obj = item as Record<string, unknown>;

  // Try common highlight fields
  const fields = ["title", "name", "subject", "summary"];
  for (const field of fields) {
    if (typeof obj[field] === "string") {
      const value = obj[field] as string;
      return value.length > 50 ? value.slice(0, 47) + "..." : value;
    }
  }

  return null;
}

/**
 * Minimum length to allow for truncation (accounts for "..." suffix)
 */
const MIN_TRUNCATION_LENGTH = 10;

/**
 * Truncate a result for display while preserving structure
 * Unlike the execution module's truncateResultForDisplay (which returns string),
 * this preserves the result structure for structured display
 *
 * @param result - Result to truncate
 * @param maxLength - Maximum string length
 * @returns Truncated result preserving structure
 */
export function truncateResultStructured(
  result: unknown,
  maxLength = 500
): unknown {
  // Ensure maxLength doesn't go below minimum to prevent negative slice indices
  const effectiveMaxLength = Math.max(maxLength, MIN_TRUNCATION_LENGTH);

  if (typeof result === "string") {
    if (result.length <= effectiveMaxLength) {
      return result;
    }
    // Safe truncation: ensure we have at least 1 character before "..."
    const truncateAt = Math.max(1, effectiveMaxLength - 3);
    return result.slice(0, truncateAt) + "...";
  }

  if (Array.isArray(result)) {
    // Keep first 5 items, ensure child maxLength doesn't go too small
    const childMaxLength = Math.max(effectiveMaxLength / 5, MIN_TRUNCATION_LENGTH);
    const truncated = result.slice(0, 5).map((item) =>
      truncateResultStructured(item, childMaxLength)
    );
    if (result.length > 5) {
      return {
        items: truncated,
        totalCount: result.length,
        truncated: true,
      };
    }
    return truncated;
  }

  if (typeof result === "object" && result !== null) {
    const obj = result as Record<string, unknown>;
    const truncated: Record<string, unknown> = {};
    // Ensure child maxLength doesn't go too small
    const childMaxLength = Math.max(effectiveMaxLength / 3, MIN_TRUNCATION_LENGTH);

    for (const [key, value] of Object.entries(obj)) {
      truncated[key] = truncateResultStructured(value, childMaxLength);
    }

    return truncated;
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// Response Content Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Clean LLM-generated content for display
 * Removes unwanted artifacts from LLM output
 *
 * @param content - Raw LLM output
 * @returns Cleaned content
 */
export function cleanContent(content: string): string {
  let cleaned = content;

  // Remove common LLM artifacts - prefix removal
  cleaned = cleaned.replace(/^(Assistant:|Theo:)\s*/i, "");

  // Remove JSON blocks first (before stripping individual backticks)
  cleaned = cleaned.replace(/```json[\s\S]*?```/g, "");

  // Remove remaining code blocks (opening and closing backticks)
  cleaned = cleaned.replace(/^\s*```\w*\s*\n?/gm, "");
  cleaned = cleaned.replace(/\n?\s*```\s*$/gm, "");

  // Remove markdown headers that shouldn't be in responses
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, "");

  // Normalize whitespace
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Combine multiple response contents into one
 *
 * @param contents - Array of content strings to combine
 * @param separator - Separator between contents
 * @returns Combined content
 */
export function combineContents(
  contents: string[],
  separator = "\n\n"
): string {
  return contents
    .filter((c) => c && c.trim())
    .map((c) => cleanContent(c))
    .join(separator);
}

// ─────────────────────────────────────────────────────────────
// Metadata Building
// ─────────────────────────────────────────────────────────────

/**
 * Build response generation metadata
 */
function buildMetadata(options: FormatOptions): ResponseGenerationMetadata {
  return {
    tokensUsed: options.tokensUsed,
    durationMs: options.durationMs ?? 0,
    model: options.model,
    generationType: options.generationType ?? "llm",
    generatedAt: new Date(),
  };
}

/**
 * Calculate total tokens from token usage
 */
export function getTotalTokens(usage?: TokenUsage): number {
  if (!usage) return 0;
  return usage.totalTokens ?? (usage.promptTokens + usage.completionTokens);
}

/**
 * Estimate response generation cost (in dollars)
 * Based on OpenAI GPT-4 pricing as reference
 */
export function estimateCost(usage?: TokenUsage, model?: string): number {
  if (!usage) return 0;

  // Pricing per 1M tokens (simplified)
  const pricing: Record<string, { input: number; output: number }> = {
    "gpt-4": { input: 30, output: 60 },
    "gpt-4-turbo": { input: 10, output: 30 },
    "gpt-4o": { input: 5, output: 15 },
    "gpt-4o-mini": { input: 0.15, output: 0.6 },
    "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
    "claude-3-opus": { input: 15, output: 75 },
    "claude-3-sonnet": { input: 3, output: 15 },
    "claude-3-haiku": { input: 0.25, output: 1.25 },
  };

  // Find matching pricing
  let rates = pricing["gpt-4o-mini"]; // Default
  if (model) {
    for (const [key, value] of Object.entries(pricing)) {
      if (model.toLowerCase().includes(key)) {
        rates = value;
        break;
      }
    }
  }

  const inputCost = (usage.promptTokens / 1_000_000) * rates.input;
  const outputCost = (usage.completionTokens / 1_000_000) * rates.output;

  return inputCost + outputCost;
}

// ─────────────────────────────────────────────────────────────
// Response Serialization
// ─────────────────────────────────────────────────────────────

/**
 * Serialize a formatted response for API output
 * Strips internal decision data and prepares for client
 */
export function serializeForClient(
  response: FormattedResponse
): ClientFormattedResponse {
  const base = {
    type: response.type,
    content: response.content,
    metadata: {
      durationMs: response.metadata.durationMs,
      model: response.metadata.model,
      generatedAt: response.metadata.generatedAt.toISOString(),
    },
  };

  switch (response.type) {
    case "execute":
      return {
        ...base,
        type: "execute",
        tool: response.tool,
        requiresApproval: response.requiresApproval,
        approvalId: response.approvalId,
        confidence: response.confidence,
        assumptions: response.assumptions.map((a) => ({
          statement: a.statement,
          confidence: a.confidence,
        })),
      };
    case "confirm":
      return {
        ...base,
        type: "confirm",
        tool: response.tool,
        uncertainties: response.uncertainties,
        confidence: response.confidence,
      };
    case "clarify":
      return {
        ...base,
        type: "clarify",
        questions: response.questions,
        missingInfo: response.missingInfo,
      };
    case "respond":
      return {
        ...base,
        type: "respond",
        isSimple: response.isSimple,
      };
    case "error":
      return {
        ...base,
        type: "error",
        errorCode: response.errorCode,
        recoverable: response.recoverable,
        recoverySuggestion: response.recoverySuggestion,
      };
  }
}

/**
 * Client-safe formatted response (without internal decision objects)
 */
export interface ClientFormattedResponse {
  type: "execute" | "confirm" | "clarify" | "respond" | "error";
  content: string;
  metadata: {
    durationMs: number;
    model?: string;
    generatedAt: string;
  };
  // Type-specific fields
  tool?: string;
  requiresApproval?: boolean;
  approvalId?: string;
  confidence?: number;
  assumptions?: Array<{ statement: string; confidence: number }>;
  uncertainties?: string[];
  questions?: string[];
  missingInfo?: string[];
  isSimple?: boolean;
  errorCode?: string;
  recoverable?: boolean;
  recoverySuggestion?: string;
}


