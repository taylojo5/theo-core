// ═══════════════════════════════════════════════════════════════════════════
// Execution Result Formatter
// Formats tool execution results for LLM response generation
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolCategory } from "../constants";
import type {
  ExecutionOutcome,
  ToolExecutionSuccess,
  ToolExecutionFailure,
  PendingApprovalResult,
  FormattedExecutionResult,
} from "./types";
import { toolRegistry } from "../tools/registry";

// ─────────────────────────────────────────────────────────────
// Main Formatting Functions
// ─────────────────────────────────────────────────────────────

/**
 * Format an execution outcome for LLM response generation
 *
 * This converts the raw execution result into a format that's easy
 * for the LLM to use when generating a response to the user.
 *
 * @param outcome - The execution outcome
 * @param toolName - Name of the tool that was executed
 * @returns Formatted result for LLM
 */
export function formatExecutionResult(
  outcome: ExecutionOutcome,
  toolName: string
): FormattedExecutionResult {
  const tool = toolRegistry.get(toolName);
  const toolCategory: ToolCategory = tool?.category ?? "query";

  if (!outcome.success) {
    return formatFailureResult(outcome, toolName, toolCategory);
  }

  if ("approvalRequired" in outcome && outcome.approvalRequired) {
    return formatApprovalResult(outcome, toolName, toolCategory);
  }

  return formatSuccessResult(outcome, toolName, toolCategory);
}

/**
 * Format a successful execution result
 */
function formatSuccessResult(
  outcome: ToolExecutionSuccess,
  toolName: string,
  toolCategory: ToolCategory
): FormattedExecutionResult {
  const summary = generateSuccessSummary(toolName, toolCategory, outcome.result);
  const suggestedFollowUps = getSuggestedFollowUps(toolName, toolCategory, outcome.result);

  return {
    success: true,
    summary,
    details: outcome.result,
    suggestedFollowUps,
    metadata: {
      toolName,
      toolCategory,
      auditLogId: outcome.auditLogId,
      durationMs: outcome.durationMs,
      requiredApproval: false,
    },
  };
}

/**
 * Format a pending approval result
 */
function formatApprovalResult(
  outcome: PendingApprovalResult,
  toolName: string,
  toolCategory: ToolCategory
): FormattedExecutionResult {
  const summary = generateApprovalSummary(outcome);

  return {
    success: true,
    summary,
    details: {
      approvalId: outcome.approvalId,
      expiresAt: outcome.expiresAt.toISOString(),
      action: outcome.approvalSummary.actionDescription,
      riskLevel: outcome.approvalSummary.riskLevel,
    },
    userNotification: `Action requires your approval. Please review and confirm.`,
    metadata: {
      toolName,
      toolCategory,
      auditLogId: outcome.auditLogId,
      durationMs: outcome.durationMs,
      requiredApproval: true,
      approvalId: outcome.approvalId,
    },
  };
}

/**
 * Format a failed execution result
 */
function formatFailureResult(
  outcome: ToolExecutionFailure,
  toolName: string,
  toolCategory: ToolCategory
): FormattedExecutionResult {
  const summary = generateErrorSummary(toolName, outcome.error);
  const suggestedFollowUps = getErrorFollowUps(outcome.error);

  return {
    success: false,
    summary,
    details: {
      errorCode: outcome.error.code,
      errorMessage: outcome.error.message,
      retryable: outcome.error.retryable,
    },
    suggestedFollowUps,
    metadata: {
      toolName,
      toolCategory,
      auditLogId: outcome.auditLogId,
      durationMs: outcome.durationMs,
      requiredApproval: false,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Convenience Functions
// ─────────────────────────────────────────────────────────────

/**
 * Format an error result directly (without going through execution)
 * Useful for pre-execution errors like tool not found
 */
export function formatErrorResult(
  toolName: string,
  errorCode: string,
  errorMessage: string,
  auditLogId: string
): FormattedExecutionResult {
  return {
    success: false,
    summary: `Failed to execute ${toolName}: ${errorMessage}`,
    details: {
      errorCode,
      errorMessage,
      retryable: false,
    },
    metadata: {
      toolName,
      toolCategory: "query",
      auditLogId,
      durationMs: 0,
      requiredApproval: false,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Summary Generation
// ─────────────────────────────────────────────────────────────

/**
 * Generate a human-readable summary of a successful execution
 */
function generateSuccessSummary(
  toolName: string,
  category: ToolCategory,
  result: unknown
): string {
  // Handle null/undefined results
  if (result === null || result === undefined) {
    return `Successfully executed ${formatToolName(toolName)}`;
  }

  // Handle array results (queries)
  if (Array.isArray(result)) {
    const count = result.length;
    const itemType = getItemTypeFromToolName(toolName);
    if (count === 0) {
      return `No ${itemType} found`;
    }
    return `Found ${count} ${itemType}${count === 1 ? "" : "s"}`;
  }

  // Handle object results based on category
  if (typeof result === "object") {
    return generateObjectSummary(toolName, category, result as Record<string, unknown>);
  }

  // Default summary
  return `Successfully executed ${formatToolName(toolName)}`;
}

/**
 * Generate summary for object results
 */
function generateObjectSummary(
  toolName: string,
  category: ToolCategory,
  result: Record<string, unknown>
): string {
  switch (category) {
    case "create":
      return generateCreateSummary(toolName, result);
    case "update":
      return generateUpdateSummary(toolName, result);
    case "delete":
      return generateDeleteSummary(toolName, result);
    case "draft":
      return generateDraftSummary(toolName, result);
    case "external":
      return generateExternalSummary(toolName, result);
    case "query":
    case "compute":
    default:
      return `Successfully retrieved ${formatToolName(toolName)} data`;
  }
}

/**
 * Generate summary for create operations
 */
function generateCreateSummary(
  toolName: string,
  result: Record<string, unknown>
): string {
  const entityType = getEntityTypeFromToolName(toolName);
  const title = result.title || result.name || result.subject || result.id;
  
  if (title) {
    return `Created ${entityType}: "${title}"`;
  }
  return `Created new ${entityType}`;
}

/**
 * Generate summary for update operations
 */
function generateUpdateSummary(
  toolName: string,
  result: Record<string, unknown>
): string {
  const entityType = getEntityTypeFromToolName(toolName);
  const title = result.title || result.name || result.subject || result.id;
  
  if (title) {
    return `Updated ${entityType}: "${title}"`;
  }
  return `Updated ${entityType}`;
}

/**
 * Generate summary for delete operations
 */
function generateDeleteSummary(
  toolName: string,
  result: Record<string, unknown>
): string {
  const entityType = getEntityTypeFromToolName(toolName);
  const title = result.title || result.name || result.subject;
  
  if (title) {
    return `Deleted ${entityType}: "${title}"`;
  }
  return `Deleted ${entityType}`;
}

/**
 * Generate summary for draft operations
 */
function generateDraftSummary(
  toolName: string,
  result: Record<string, unknown>
): string {
  if (toolName.includes("email")) {
    const to = result.to || result.recipients;
    const subject = result.subject;
    if (subject && to) {
      return `Created email draft to ${formatRecipients(to)} with subject "${subject}"`;
    }
    if (subject) {
      return `Created email draft: "${subject}"`;
    }
    return "Created email draft";
  }
  
  return `Created draft for ${formatToolName(toolName)}`;
}

/**
 * Generate summary for external API operations
 */
function generateExternalSummary(
  toolName: string,
  result: Record<string, unknown>
): string {
  if (toolName.includes("send_email") || toolName.includes("email")) {
    const to = result.to || result.recipients;
    if (to) {
      return `Sent email to ${formatRecipients(to)}`;
    }
    return "Email sent successfully";
  }
  
  return `Successfully executed ${formatToolName(toolName)}`;
}

/**
 * Generate summary for approval requests
 */
function generateApprovalSummary(outcome: PendingApprovalResult): string {
  const { approvalSummary } = outcome;
  return `I need your approval to ${approvalSummary.actionDescription.toLowerCase()}. This is a ${approvalSummary.riskLevel} risk action.`;
}

/**
 * Generate summary for errors
 */
function generateErrorSummary(
  toolName: string,
  error: ToolExecutionFailure["error"]
): string {
  switch (error.code) {
    case "tool_not_found":
      return `I couldn't find the tool "${toolName}"`;
    case "validation_failed":
      return `The parameters for ${formatToolName(toolName)} weren't quite right`;
    case "integration_missing":
      return `I need additional integrations to be connected to perform this action`;
    case "permission_denied":
      return `I don't have permission to perform this action`;
    case "rate_limited":
      return `I've hit a rate limit. Please try again in a moment`;
    case "timeout":
      return `The operation timed out. Please try again`;
    case "execution_failed":
    default:
      return `Something went wrong while executing ${formatToolName(toolName)}`;
  }
}

// ─────────────────────────────────────────────────────────────
// Follow-up Suggestions
// ─────────────────────────────────────────────────────────────

/**
 * Get suggested follow-up actions based on the executed tool
 */
function getSuggestedFollowUps(
  toolName: string,
  category: ToolCategory,
  result: unknown
): string[] {
  const suggestions: string[] = [];

  // Query results might prompt for action
  if (category === "query" && Array.isArray(result) && result.length > 0) {
    if (toolName.includes("event") || toolName.includes("calendar")) {
      suggestions.push("Would you like me to create a new event?");
      suggestions.push("Should I reschedule any of these events?");
    }
    if (toolName.includes("task")) {
      suggestions.push("Would you like to update any of these tasks?");
      suggestions.push("Should I create a new task?");
    }
    if (toolName.includes("email")) {
      suggestions.push("Would you like me to draft a reply?");
    }
  }

  // Create actions might prompt for follow-ups
  if (category === "create") {
    if (toolName.includes("event") || toolName.includes("calendar")) {
      suggestions.push("Would you like to invite anyone to this event?");
    }
    if (toolName.includes("task")) {
      suggestions.push("Would you like to set a reminder for this task?");
    }
  }

  return suggestions.slice(0, 2); // Limit to 2 suggestions
}

/**
 * Get suggested follow-ups for errors
 */
function getErrorFollowUps(error: ToolExecutionFailure["error"]): string[] {
  switch (error.code) {
    case "integration_missing":
      return ["Would you like me to help you connect the required integrations?"];
    case "validation_failed":
      return ["Could you provide more details so I can try again?"];
    case "rate_limited":
      return ["I can try again in a moment if you'd like"];
    default:
      return [];
  }
}

// ─────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────

/**
 * Format tool name for display
 */
function formatToolName(toolName: string): string {
  return toolName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Get item type from tool name for plural summaries
 */
function getItemTypeFromToolName(toolName: string): string {
  if (toolName.includes("event") || toolName.includes("calendar")) return "event";
  if (toolName.includes("task")) return "task";
  if (toolName.includes("email")) return "email";
  if (toolName.includes("contact") || toolName.includes("person")) return "contact";
  if (toolName.includes("deadline")) return "deadline";
  return "item";
}

/**
 * Get entity type from tool name
 */
function getEntityTypeFromToolName(toolName: string): string {
  if (toolName.includes("event") || toolName.includes("calendar")) return "event";
  if (toolName.includes("task")) return "task";
  if (toolName.includes("email")) return "email";
  if (toolName.includes("deadline")) return "deadline";
  if (toolName.includes("note")) return "note";
  return "item";
}

/**
 * Format recipients for display
 */
function formatRecipients(recipients: unknown): string {
  if (typeof recipients === "string") {
    return recipients;
  }
  if (Array.isArray(recipients)) {
    if (recipients.length === 1) {
      return String(recipients[0]);
    }
    if (recipients.length === 2) {
      return `${recipients[0]} and ${recipients[1]}`;
    }
    return `${recipients[0]} and ${recipients.length - 1} others`;
  }
  return "recipient";
}

// ─────────────────────────────────────────────────────────────
// Result Extraction Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Extract key information from a result for summarization
 */
export function extractResultHighlights(result: unknown): Record<string, unknown> {
  if (!result || typeof result !== "object") {
    return {};
  }

  const obj = result as Record<string, unknown>;
  const highlights: Record<string, unknown> = {};

  // Common important fields
  const importantFields = [
    "id",
    "title",
    "name",
    "subject",
    "status",
    "date",
    "startDate",
    "endDate",
    "dueDate",
    "priority",
    "to",
    "from",
    "count",
    "total",
  ];

  for (const field of importantFields) {
    if (field in obj && obj[field] !== null && obj[field] !== undefined) {
      highlights[field] = obj[field];
    }
  }

  return highlights;
}

/**
 * Truncate result for logging/display
 */
export function truncateResultForDisplay(
  result: unknown,
  maxLength: number = 500
): string {
  const json = JSON.stringify(result, null, 2);
  if (json.length <= maxLength) {
    return json;
  }
  return json.substring(0, maxLength) + "...";
}

