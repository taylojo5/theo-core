// ═══════════════════════════════════════════════════════════════════════════
// Classification Prompt Builder
// Builds prompts for intent classification
// ═══════════════════════════════════════════════════════════════════════════

import type { ClassificationRequest, ClassificationResponse } from "../types";

/**
 * System prompt for classification
 */
const CLASSIFICATION_SYSTEM_PROMPT = `You are Theo, an intelligent AI assistant that helps users manage tasks, emails, calendar events, and more.

Your job is to analyze the user's message and return a structured JSON response describing:
1. What the user wants (intent)
2. Key entities mentioned (people, dates, times, etc.)
3. Which tool to use (if any)
4. Any clarifications needed
5. Assumptions you're making

Be precise and helpful. When uncertain, ask for clarification rather than making risky assumptions.`;

/**
 * Build the classification prompt for the LLM
 */
export function buildClassificationPrompt(
  request: ClassificationRequest
): string {
  const parts: string[] = [];

  // Add available tools
  if (request.availableTools.length > 0) {
    parts.push("## Available Tools\n");
    for (const tool of request.availableTools) {
      parts.push(`### ${tool.name}`);
      parts.push(`Description: ${tool.description}`);
      parts.push(`When to use: ${tool.whenToUse}`);
      if (tool.examples && tool.examples.length > 0) {
        parts.push(`Examples: ${tool.examples.join("; ")}`);
      }
      parts.push(`Requires approval: ${tool.requiresApproval ? "Yes" : "No"}`);
      parts.push("");
    }
  }

  // Add conversation history (only user and assistant messages)
  if (request.conversationHistory && request.conversationHistory.length > 0) {
    const conversationMessages = request.conversationHistory
      .filter((msg) => msg.role === "user" || msg.role === "assistant")
      .slice(-10);
    
    if (conversationMessages.length > 0) {
      parts.push("## Recent Conversation\n");
      for (const msg of conversationMessages) {
        const role = msg.role === "user" ? "User" : "Assistant";
        parts.push(`${role}: ${msg.content}`);
      }
      parts.push("");
    }
  }

  // Add context
  if (request.timezone) {
    parts.push(`User timezone: ${request.timezone}`);
  }
  if (request.currentTime) {
    parts.push(`Current time: ${request.currentTime.toISOString()}`);
  }

  // Add the user message
  parts.push(`\n## User Message\n"${request.message}"\n`);

  // Add response format
  parts.push(`## Response Format

Respond with a JSON object matching this exact schema:

\`\`\`json
{
  "intent": {
    "category": "query" | "action" | "planning" | "conversation" | "unknown",
    "action": "specific_action_name (optional)",
    "summary": "Brief description of what the user wants"
  },
  "entities": [
    {
      "type": "person" | "datetime" | "duration" | "location" | "email" | "task" | "event" | "other",
      "text": "original text from message",
      "value": "parsed/normalized value",
      "needsResolution": true | false
    }
  ],
  "suggestedTool": {
    "name": "tool_name",
    "parameters": { ... },
    "confidence": 0.0-1.0,
    "reasoning": "Why this tool is appropriate"
  },
  "clarificationNeeded": {
    "required": true | false,
    "questions": ["Question to ask..."],
    "missingInfo": ["What information is missing"]
  },
  "assumptions": [
    {
      "statement": "What you assumed",
      "category": "intent" | "context" | "preference" | "inference",
      "evidence": ["Evidence for this assumption"],
      "confidence": 0.0-1.0
    }
  ],
  "confidence": 0.0-1.0
}
\`\`\`

Guidelines:
- Set category to "query" for information requests, "action" for single operations, "planning" for multi-step goals
- Only suggest a tool if you're confident (>0.7) it's the right one
- Always include assumptions you're making, even implicit ones
- If key information is missing, set clarificationNeeded.required to true`);

  return parts.join("\n");
}

/**
 * Get the system prompt for classification
 */
export function getClassificationSystemPrompt(): string {
  return CLASSIFICATION_SYSTEM_PROMPT;
}

/**
 * Parse the LLM response into a ClassificationResponse
 * Handles validation and error cases
 */
export function parseClassificationResponse(
  rawResponse: string
): ClassificationResponse {
  // Try to extract JSON from the response
  let jsonStr = rawResponse;

  // Handle markdown code blocks
  const jsonMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // Validate required fields and provide defaults
    return {
      intent: {
        category: parsed.intent?.category || "unknown",
        action: parsed.intent?.action,
        summary: parsed.intent?.summary || "Unable to determine intent",
      },
      entities: Array.isArray(parsed.entities)
        ? parsed.entities.map((e: Record<string, unknown>) => ({
            type: String(e.type || "other"),
            text: String(e.text || ""),
            value: e.value,
            needsResolution: Boolean(e.needsResolution),
          }))
        : [],
      suggestedTool: parsed.suggestedTool
        ? {
            name: String(parsed.suggestedTool.name || ""),
            parameters: parsed.suggestedTool.parameters || {},
            confidence: Number(parsed.suggestedTool.confidence) || 0,
            reasoning: String(parsed.suggestedTool.reasoning || ""),
          }
        : undefined,
      clarificationNeeded: parsed.clarificationNeeded
        ? {
            required: Boolean(parsed.clarificationNeeded.required),
            questions: Array.isArray(parsed.clarificationNeeded.questions)
              ? parsed.clarificationNeeded.questions.map(String)
              : [],
            missingInfo: Array.isArray(parsed.clarificationNeeded.missingInfo)
              ? parsed.clarificationNeeded.missingInfo.map(String)
              : [],
          }
        : undefined,
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
    // Return a fallback response if parsing fails
    return {
      intent: {
        category: "unknown",
        summary: "Failed to parse LLM response",
      },
      entities: [],
      assumptions: [],
      confidence: 0,
    };
  }
}

