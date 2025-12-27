// ═══════════════════════════════════════════════════════════════════════════
// Plan Generation Prompt Builder
// Builds prompts for multi-step plan generation
// ═══════════════════════════════════════════════════════════════════════════

import type { PlanGenerationRequest, LLMGeneratedPlan } from "../types";

/**
 * System prompt for plan generation
 */
const PLAN_GENERATION_SYSTEM_PROMPT = `You are Theo, an intelligent AI assistant that creates execution plans to achieve user goals.

Your job is to break down complex goals into a series of actionable steps. Each step should:
1. Use exactly one available tool
2. Have clear parameters
3. Define dependencies on previous steps
4. Consider what happens if the step fails

Be methodical and thorough. For risky operations, include rollback steps. Consider the optimal order of operations.`;

/**
 * Build the plan generation prompt
 */
export function buildPlanGenerationPrompt(
  request: PlanGenerationRequest
): string {
  const parts: string[] = [];

  // Add goal
  parts.push(`## Goal\n${request.goal}\n`);

  if (request.goalContext) {
    parts.push(`## Additional Context\n${request.goalContext}\n`);
  }

  // Add available tools (only if there are any)
  if (request.availableTools.length > 0) {
    parts.push("## Available Tools\n");
    for (const tool of request.availableTools) {
      parts.push(`### ${tool.name}`);
      parts.push(`Description: ${tool.description}`);
      parts.push(`When to use: ${tool.whenToUse}`);
      parts.push(`Requires approval: ${tool.requiresApproval ? "Yes" : "No"}`);
      parts.push(`Parameters: ${JSON.stringify(tool.parameters, null, 2)}`);
      parts.push("");
    }
  }

  // Add conversation history if relevant (only user and assistant messages)
  if (request.conversationHistory && request.conversationHistory.length > 0) {
    const conversationMessages = request.conversationHistory
      .filter((msg) => msg.role === "user" || msg.role === "assistant")
      .slice(-5);
    
    if (conversationMessages.length > 0) {
      parts.push("## Relevant Conversation\n");
      for (const msg of conversationMessages) {
        const role = msg.role === "user" ? "User" : "Assistant";
        parts.push(`${role}: ${msg.content}`);
      }
      parts.push("");
    }
  }

  // Add previous attempts if this is a retry
  if (request.previousAttempts && request.previousAttempts.length > 0) {
    parts.push("## Previous Attempts\n");
    for (const attempt of request.previousAttempts) {
      parts.push(`Failed at step ${attempt.failure.stepIndex}: ${attempt.failure.error}`);
      parts.push(`Previous plan: ${attempt.steps.map((s) => s.toolName).join(" → ")}`);
    }
    parts.push("\nPlease create an improved plan that avoids these issues.\n");
  }

  // Add response format
  parts.push(`## Response Format

Create a plan by responding with JSON matching this schema:

\`\`\`json
{
  "goal": "Brief summary of the goal",
  "goalType": "category (scheduling, email, task_management, research, etc.)",
  "steps": [
    {
      "order": 0,
      "toolName": "tool_name",
      "parameters": { ... },
      "dependsOn": [],
      "description": "What this step does",
      "requiresApproval": true | false,
      "rollback": {
        "toolName": "rollback_tool",
        "parameters": { ... }
      }
    }
  ],
  "requiresApproval": true | false,
  "reasoning": "Why this plan structure was chosen",
  "assumptions": [
    {
      "statement": "What you assumed",
      "category": "intent" | "context" | "preference" | "inference",
      "evidence": ["Evidence..."],
      "confidence": 0.0-1.0
    }
  ],
  "confidence": 0.0-1.0
}
\`\`\`

Guidelines:
- Order steps from 0 to N-1
- Include all dependencies in dependsOn (indices of steps that must complete first)
- Set requiresApproval to true for any risky operation (sending emails, deleting items, external APIs)
- Include rollback steps for operations that can be undone
- Keep plans focused - prefer fewer, well-defined steps`);

  return parts.join("\n");
}

/**
 * Get the system prompt for plan generation
 */
export function getPlanGenerationSystemPrompt(): string {
  return PLAN_GENERATION_SYSTEM_PROMPT;
}

/**
 * Parse the LLM response into an LLMGeneratedPlan
 */
export function parsePlanGenerationResponse(rawResponse: string): LLMGeneratedPlan {
  // Try to extract JSON from the response
  let jsonStr = rawResponse;

  const jsonMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  try {
    const parsed = JSON.parse(jsonStr);

    return {
      goal: String(parsed.goal || ""),
      goalType: String(parsed.goalType || "unknown"),
      steps: Array.isArray(parsed.steps)
        ? parsed.steps.map((s: Record<string, unknown>, idx: number) => ({
            order: typeof s.order === "number" ? s.order : idx,
            toolName: String(s.toolName || ""),
            parameters: (s.parameters as Record<string, unknown>) || {},
            dependsOn: Array.isArray(s.dependsOn)
              ? s.dependsOn.filter((d): d is number => typeof d === "number")
              : [],
            description: String(s.description || ""),
            requiresApproval: Boolean(s.requiresApproval),
            rollback: s.rollback
              ? {
                  toolName: String((s.rollback as Record<string, unknown>).toolName || ""),
                  parameters: ((s.rollback as Record<string, unknown>).parameters as Record<string, unknown>) || {},
                }
              : undefined,
          }))
        : [],
      requiresApproval: Boolean(parsed.requiresApproval),
      reasoning: String(parsed.reasoning || ""),
      assumptions: Array.isArray(parsed.assumptions)
        ? parsed.assumptions.map((a: Record<string, unknown>) => ({
            statement: String(a.statement || ""),
            category: (a.category as "intent" | "context" | "preference" | "inference") || "inference",
            evidence: Array.isArray(a.evidence) ? a.evidence.map(String) : [],
            confidence: Number(a.confidence) || 0.5,
          }))
        : [],
      confidence: Number(parsed.confidence) || 0.5,
    };
  } catch {
    // Return a minimal fallback plan
    return {
      goal: "Failed to parse plan",
      goalType: "unknown",
      steps: [],
      requiresApproval: true,
      reasoning: "LLM response parsing failed",
      assumptions: [],
      confidence: 0,
    };
  }
}

