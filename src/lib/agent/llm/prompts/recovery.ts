// ═══════════════════════════════════════════════════════════════════════════
// Recovery Prompt Builder
// Builds prompts for failure recovery decisions
// ═══════════════════════════════════════════════════════════════════════════

import type { RecoveryRequest, RecoveryAction } from "../types";

/**
 * System prompt for recovery decisions
 */
const RECOVERY_SYSTEM_PROMPT = `You are Theo, an AI assistant making a recovery decision after a plan step failed.

Your options are:
1. retry - Try the same step again (maybe with modified parameters)
2. skip - Skip this step and continue with the plan
3. abort - Stop the entire plan
4. ask_user - Ask the user for guidance
5. rollback - Undo completed steps and abort

Consider:
- How critical is this step to the overall goal?
- Is the error transient (retry might help) or permanent?
- What's the impact of skipping vs aborting?
- Is there enough context to make this decision, or should you ask the user?`;

/**
 * Build the recovery decision prompt
 */
export function buildRecoveryPrompt(request: RecoveryRequest): string {
  const parts: string[] = [];

  // Add plan context
  parts.push(`## Plan Goal\n${request.plan.goal}\n`);

  parts.push("## Plan Steps");
  for (let i = 0; i < request.plan.steps.length; i++) {
    const step = request.plan.steps[i];
    const status =
      i < request.plan.currentStepIndex
        ? "✓ Completed"
        : i === request.plan.currentStepIndex
          ? "✗ Failed"
          : "○ Pending";
    parts.push(`${i}. [${status}] ${step.toolName}: ${step.description}`);
  }
  parts.push("");

  // Add failure details
  parts.push("## Failure Details");
  parts.push(`Step: ${request.failure.stepIndex}`);
  parts.push(`Error type: ${request.failure.errorType}`);
  parts.push(`Error message: ${request.failure.error}`);
  parts.push(`Retry count: ${request.retryCount}`);
  parts.push("");

  // Add response format
  parts.push(`## Response Format

Respond with JSON:

\`\`\`json
{
  "action": "retry" | "skip" | "abort" | "ask_user" | "rollback",
  "reasoning": "Why this is the best course of action",
  "modifiedParameters": { ... },  // Only for retry - what to change
  "userMessage": "...",           // Only for ask_user - what to ask
  "confidence": 0.0-1.0
}
\`\`\`

Guidelines:
- Use "retry" only if the error seems transient and retrying might help (max 3 retries)
- Use "skip" if the step is optional and the plan can continue without it
- Use "abort" if the step is critical and cannot be completed
- Use "ask_user" if you're uncertain and need human judgment
- Use "rollback" if completed steps should be undone`);

  return parts.join("\n");
}

/**
 * Get the system prompt for recovery decisions
 */
export function getRecoverySystemPrompt(): string {
  return RECOVERY_SYSTEM_PROMPT;
}

/**
 * Parse the LLM response into a RecoveryAction
 */
export function parseRecoveryResponse(rawResponse: string): RecoveryAction {
  // Try to extract JSON from the response
  let jsonStr = rawResponse;

  const jsonMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  try {
    const parsed = JSON.parse(jsonStr);

    const action = parsed.action as RecoveryAction["action"];
    if (!["retry", "skip", "abort", "ask_user", "rollback"].includes(action)) {
      throw new Error("Invalid action");
    }

    return {
      action,
      reasoning: String(parsed.reasoning || "No reasoning provided"),
      modifiedParameters: parsed.modifiedParameters,
      userMessage: parsed.userMessage,
      confidence: Number(parsed.confidence) || 0.5,
    };
  } catch {
    // Default to asking the user if we can't parse
    return {
      action: "ask_user",
      reasoning: "Failed to parse recovery decision, asking user for guidance",
      userMessage: "I encountered an error and I'm not sure how to proceed. Would you like me to try again, skip this step, or stop the plan?",
      confidence: 0,
    };
  }
}

/**
 * Determine if an error type is likely transient
 */
export function isTransientError(errorType: string): boolean {
  const transientTypes = [
    "rate_limit",
    "timeout",
    "network_error",
    "service_unavailable",
    "model_overloaded",
  ];
  return transientTypes.includes(errorType.toLowerCase());
}

/**
 * Get suggested recovery action based on error type
 */
export function getSuggestedRecoveryAction(
  errorType: string,
  retryCount: number
): RecoveryAction["action"] {
  // Don't retry more than 3 times
  if (retryCount >= 3) {
    return "ask_user";
  }

  // Transient errors should be retried
  if (isTransientError(errorType)) {
    return "retry";
  }

  // Auth errors should ask user
  if (errorType.toLowerCase().includes("auth") || errorType.toLowerCase().includes("permission")) {
    return "ask_user";
  }

  // Validation errors should ask user
  if (errorType.toLowerCase().includes("validation") || errorType.toLowerCase().includes("invalid")) {
    return "ask_user";
  }

  // Default to asking user for unknown errors
  return "ask_user";
}

