// ═══════════════════════════════════════════════════════════════════════════
// Tool Execution Engine
// Executes LLM-selected tools with validation, integration checks, and audit
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import { parseScopes, getIntegrationStatus } from "@/lib/auth/scopes";
import { agentLogger } from "../logger";
import { toolRegistry } from "../tools/registry";
import { validateToolParams } from "../tools/validation";
import { formatErrorsForLLM } from "../tools/validation";
import { logAgentAction } from "../audit/service";
import { createPendingApproval } from "./approval";
import { formatExecutionResult, formatErrorResult } from "./result-formatter";
import type {
  ToolExecutionRequest,
  ExecutionOutcome,
  ToolExecutionSuccess,
  ToolExecutionFailure,
  PendingApprovalResult,
  ParameterValidationResult,
  IntegrationCheckResult,
  FieldValidationError,
  ToolExecutionError,
} from "./types";
import type { AnyToolDefinition } from "../tools/types";

const logger = agentLogger.child("execution-engine");

// ─────────────────────────────────────────────────────────────
// Main Execution Function
// ─────────────────────────────────────────────────────────────

/**
 * Execute a tool call from the LLM
 *
 * This is the main entry point for tool execution. It:
 * 1. Validates the tool exists
 * 2. Validates parameters against the tool's Zod schema
 * 3. Checks required integrations are connected
 * 4. Either executes immediately or creates an approval record
 * 5. Logs all executions to the audit trail
 *
 * @param request - The tool execution request
 * @returns Execution outcome (success, failure, or pending approval)
 */
export async function executeToolCall(
  request: ToolExecutionRequest
): Promise<ExecutionOutcome> {
  const startTime = Date.now();
  const { toolName, parameters, context, decision } = request;

  logger.debug("Executing tool call", {
    toolName,
    userId: context.userId,
    action: decision.action,
  });

  // Step 1: Get the tool definition
  const tool = toolRegistry.get(toolName);
  if (!tool) {
    logger.warn("Tool not found", { toolName });
    return createFailureResult(
      {
        code: "tool_not_found",
        message: `Tool "${toolName}" is not registered`,
        retryable: false,
      },
      await logToolNotFoundError(request, startTime),
      startTime
    );
  }

  // Step 2: Validate parameters
  const validationResult = validateParameters(tool, parameters);
  if (!validationResult.valid) {
    logger.debug("Parameter validation failed", {
      toolName,
      errors: validationResult.errors,
    });
    return createFailureResult(
      {
        code: "validation_failed",
        message: "Parameter validation failed",
        details: {
          type: "validation",
          fieldErrors: validationResult.errors,
          llmFriendlyMessage: formatErrorsForLLM(
            validationResult.errors.map((e) => ({
              path: e.path,
              message: e.message,
              expected: e.expected,
              received: e.received,
            })),
            toolName
          ),
        },
        retryable: true,
      },
      await logValidationError(request, validationResult.errors, startTime),
      startTime
    );
  }

  // Step 3: Check integrations
  const integrationCheck = await checkIntegrations(
    tool.requiredIntegrations,
    context.userId
  );
  if (!integrationCheck.available) {
    logger.info("Missing required integrations", {
      toolName,
      missing: integrationCheck.missing,
    });
    return createFailureResult(
      {
        code: "integration_missing",
        message: `Required integrations not connected: ${integrationCheck.missing.join(", ")}`,
        details: {
          type: "integration",
          missingIntegrations: integrationCheck.missing,
          connectionInstructions: getConnectionInstructions(
            integrationCheck.missing
          ),
        },
        retryable: false,
      },
      await logIntegrationError(request, integrationCheck.missing, startTime),
      startTime
    );
  }

  // Step 4: Execute or request approval based on decision
  if (decision.action === "request_approval") {
    return createApprovalRequest(
      tool,
      validationResult.parsed as Record<string, unknown>,
      request,
      startTime
    );
  }

  // Step 5: Execute the tool
  return executeValidatedTool(
    tool,
    validationResult.parsed,
    request,
    startTime
  );
}

// ─────────────────────────────────────────────────────────────
// Validation Functions
// ─────────────────────────────────────────────────────────────

/**
 * Validate LLM-provided parameters against tool's Zod schema
 *
 * @param tool - Tool definition
 * @param parameters - Raw parameters from LLM
 * @returns Validation result with parsed data or errors
 */
export function validateParameters<T>(
  tool: AnyToolDefinition,
  parameters: unknown
): ParameterValidationResult<T> {
  const result = validateToolParams(tool, parameters);

  if (result.success) {
    return {
      valid: true,
      parsed: result.data as T,
    };
  }

  return {
    valid: false,
    errors:
      result.errors?.map((e) => ({
        path: e.path,
        message: e.message,
        expected: e.expected,
        received: e.received,
      })) ?? [],
  };
}

// ─────────────────────────────────────────────────────────────
// Integration Check Functions
// ─────────────────────────────────────────────────────────────

/**
 * Check if required integrations are connected for a user
 *
 * @param requiredIntegrations - List of required integration names
 * @param userId - User ID to check
 * @returns Integration check result
 */
export async function checkIntegrations(
  requiredIntegrations: string[],
  userId: string
): Promise<IntegrationCheckResult> {
  if (requiredIntegrations.length === 0) {
    return { available: true };
  }

  // Get user's connected integrations
  const connectedIntegrations = await getConnectedIntegrations(userId);

  // Check which required integrations are missing
  const missing = requiredIntegrations.filter(
    (integration) => !connectedIntegrations.includes(integration)
  );

  if (missing.length === 0) {
    return { available: true };
  }

  return { available: false, missing };
}

/**
 * Get list of integrations connected for a user
 */
async function getConnectedIntegrations(userId: string): Promise<string[]> {
  const connected: string[] = [];

  // Check Google account and scopes
  const account = await db.account.findFirst({
    where: {
      userId,
      provider: "google",
    },
    select: {
      scope: true,
    },
  });

  if (account?.scope) {
    const grantedScopes = parseScopes(account.scope);
    const status = getIntegrationStatus(grantedScopes);

    if (status.gmail.connected) {
      connected.push("gmail");
    }
    if (status.calendar.connected) {
      connected.push("calendar");
    }
    if (status.contacts.connected) {
      connected.push("contacts");
    }
  }

  // Future: Add checks for other integrations (Slack, etc.)

  return connected;
}

/**
 * Get user-friendly instructions for connecting missing integrations
 */
function getConnectionInstructions(missing: string[]): string {
  const instructions = missing.map((integration) => {
    switch (integration) {
      case "gmail":
        return "Connect Gmail in Settings > Integrations > Gmail";
      case "calendar":
        return "Connect Calendar in Settings > Integrations > Calendar";
      case "contacts":
        return "Enable Contacts access in Settings > Integrations > Gmail";
      default:
        return `Connect ${integration} in Settings > Integrations`;
    }
  });

  return instructions.join(". ");
}

// ─────────────────────────────────────────────────────────────
// Execution Functions
// ─────────────────────────────────────────────────────────────

/**
 * Execute a validated tool
 */
async function executeValidatedTool(
  tool: AnyToolDefinition,
  validatedParams: unknown,
  request: ToolExecutionRequest,
  startTime: number
): Promise<ToolExecutionSuccess | ToolExecutionFailure> {
  const { context, decision } = request;

  try {
    // Execute the tool
    const result = await tool.execute(validatedParams, context);

    const durationMs = Date.now() - startTime;

    // Log successful execution
    const auditEntry = await logAgentAction({
      userId: context.userId,
      sessionId: context.sessionId,
      conversationId: context.conversationId,
      actionType: tool.category,
      actionCategory: "agent",
      entityType: getEntityTypeFromTool(tool),
      intent: `Execute ${tool.name}`,
      reasoning: decision.reasoning,
      confidence: decision.confidence,
      inputSummary: JSON.stringify(validatedParams),
      outputSummary: JSON.stringify(result),
      status: "completed",
      startedAt: new Date(startTime),
    });

    logger.info("Tool executed successfully", {
      toolName: tool.name,
      userId: context.userId,
      durationMs,
      auditLogId: auditEntry.id,
    });

    return {
      success: true,
      result,
      approvalRequired: false,
      auditLogId: auditEntry.id,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    logger.error("Tool execution failed", {
      toolName: tool.name,
      userId: context.userId,
      error: errorMessage,
      durationMs,
    });

    // Log failed execution
    const auditEntry = await logAgentAction({
      userId: context.userId,
      sessionId: context.sessionId,
      conversationId: context.conversationId,
      actionType: tool.category,
      actionCategory: "agent",
      entityType: getEntityTypeFromTool(tool),
      intent: `Execute ${tool.name}`,
      reasoning: decision.reasoning,
      confidence: decision.confidence,
      inputSummary: JSON.stringify(validatedParams),
      status: "failed",
      errorMessage,
      startedAt: new Date(startTime),
    });

    return {
      success: false,
      error: {
        code: "execution_failed",
        message: errorMessage,
        details: {
          type: "execution",
          originalError: errorMessage,
          ...(process.env.NODE_ENV === "development" && error instanceof Error
            ? { stack: error.stack }
            : {}),
        },
        retryable: isRetryableError(error),
      },
      auditLogId: auditEntry.id,
      durationMs,
    };
  }
}

/**
 * Create an approval request for a high-risk action
 */
async function createApprovalRequest(
  tool: AnyToolDefinition,
  validatedParams: Record<string, unknown>,
  request: ToolExecutionRequest,
  startTime: number
): Promise<PendingApprovalResult> {
  const { context, decision } = request;

  logger.debug("Creating approval request", {
    toolName: tool.name,
    userId: context.userId,
    riskLevel: tool.riskLevel,
  });

  const { approval, auditLogId } = await createPendingApproval({
    userId: context.userId,
    toolName: tool.name,
    parameters: validatedParams,
    actionType: tool.category,
    riskLevel: tool.riskLevel,
    reasoning: decision.reasoning,
    conversationId: context.conversationId,
    planId: context.planId,
    stepIndex: context.stepIndex,
  });

  const durationMs = Date.now() - startTime;

  logger.info("Approval request created", {
    toolName: tool.name,
    userId: context.userId,
    approvalId: approval.id,
    expiresAt: approval.expiresAt,
  });

  return {
    success: true,
    approvalRequired: true,
    approvalId: approval.id,
    expiresAt: approval.expiresAt!,
    approvalSummary: {
      toolName: tool.name,
      actionDescription: tool.description,
      riskLevel: tool.riskLevel,
      reasoning: decision.reasoning,
      keyParameters: sanitizeParametersForDisplay(validatedParams, tool),
    },
    auditLogId,
    durationMs,
  };
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Create a failure result from an error
 */
function createFailureResult(
  error: ToolExecutionError,
  auditLogId: string,
  startTime: number
): ToolExecutionFailure {
  return {
    success: false,
    error,
    auditLogId,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Log tool not found error to audit trail
 */
async function logToolNotFoundError(
  request: ToolExecutionRequest,
  startTime: number
): Promise<string> {
  const entry = await logAgentAction({
    userId: request.context.userId,
    sessionId: request.context.sessionId,
    conversationId: request.context.conversationId,
    actionType: "query",
    actionCategory: "agent",
    intent: `Execute ${request.toolName}`,
    reasoning: request.decision.reasoning,
    confidence: request.decision.confidence,
    inputSummary: JSON.stringify(request.parameters),
    status: "failed",
    errorMessage: `Tool "${request.toolName}" not found`,
    startedAt: new Date(startTime),
  });
  return entry.id;
}

/**
 * Log validation error to audit trail
 */
async function logValidationError(
  request: ToolExecutionRequest,
  errors: FieldValidationError[],
  startTime: number
): Promise<string> {
  const entry = await logAgentAction({
    userId: request.context.userId,
    sessionId: request.context.sessionId,
    conversationId: request.context.conversationId,
    actionType: "query",
    actionCategory: "agent",
    intent: `Execute ${request.toolName}`,
    reasoning: request.decision.reasoning,
    confidence: request.decision.confidence,
    inputSummary: JSON.stringify(request.parameters),
    status: "failed",
    errorMessage: `Validation failed: ${errors.map((e) => e.message).join(", ")}`,
    startedAt: new Date(startTime),
  });
  return entry.id;
}

/**
 * Log integration error to audit trail
 */
async function logIntegrationError(
  request: ToolExecutionRequest,
  missing: string[],
  startTime: number
): Promise<string> {
  const entry = await logAgentAction({
    userId: request.context.userId,
    sessionId: request.context.sessionId,
    conversationId: request.context.conversationId,
    actionType: "query",
    actionCategory: "agent",
    intent: `Execute ${request.toolName}`,
    reasoning: request.decision.reasoning,
    confidence: request.decision.confidence,
    inputSummary: JSON.stringify(request.parameters),
    status: "failed",
    errorMessage: `Missing integrations: ${missing.join(", ")}`,
    startedAt: new Date(startTime),
  });
  return entry.id;
}

/**
 * Get entity type from tool for audit logging
 */
function getEntityTypeFromTool(tool: AnyToolDefinition): string | undefined {
  // Extract entity type from tool name or required integrations
  if (tool.requiredIntegrations.includes("gmail")) {
    return "email";
  }
  if (tool.requiredIntegrations.includes("calendar")) {
    return "event";
  }
  if (tool.name.includes("task")) {
    return "task";
  }
  if (tool.name.includes("deadline")) {
    return "deadline";
  }
  return undefined;
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Network errors, rate limits, and timeouts are typically retryable
    return (
      message.includes("timeout") ||
      message.includes("rate limit") ||
      message.includes("temporarily") ||
      message.includes("retry") ||
      message.includes("network")
    );
  }
  return false;
}

/**
 * Sanitize parameters for display in approval UI
 * Removes sensitive fields and truncates long values
 */
function sanitizeParametersForDisplay(
  params: Record<string, unknown>,
  _tool: AnyToolDefinition
): Record<string, unknown> {
  const sensitiveFields = ["password", "token", "secret", "key", "auth"];
  const maxLength = 200;

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    // Skip sensitive fields
    if (sensitiveFields.some((f) => key.toLowerCase().includes(f))) {
      sanitized[key] = "[REDACTED]";
      continue;
    }

    // Truncate long string values
    if (typeof value === "string" && value.length > maxLength) {
      sanitized[key] = value.substring(0, maxLength) + "...";
      continue;
    }

    // Recursively sanitize objects
    if (value && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeParametersForDisplay(
        value as Record<string, unknown>,
        _tool
      );
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

// ─────────────────────────────────────────────────────────────
// Export convenience functions
// ─────────────────────────────────────────────────────────────

export { formatExecutionResult, formatErrorResult };

