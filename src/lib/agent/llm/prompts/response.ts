// ═══════════════════════════════════════════════════════════════════════════
// Response Generation Prompt Builder
// Builds prompts for user-facing response generation
// ═══════════════════════════════════════════════════════════════════════════

import type { ResponseGenerationRequest, ResponseStyle } from "../types";

/**
 * System prompt for response generation
 */
const RESPONSE_GENERATION_SYSTEM_PROMPT = `You are Theo, a helpful AI assistant. Generate clear, friendly responses to help users.

Key principles:
1. Be concise but complete
2. When you've done something, clearly state what was done
3. If you made assumptions, briefly mention them
4. For errors, explain what went wrong and suggest next steps
5. Maintain a helpful, professional tone`;

/**
 * Build the response generation prompt
 */
export function buildResponsePrompt(request: ResponseGenerationRequest): string {
  const parts: string[] = [];

  // Add user message context
  parts.push(`## User's Message\n"${request.userMessage}"\n`);

  // Add classification context
  if (request.classification) {
    parts.push("## Understanding");
    parts.push(`Intent: ${request.classification.intent.summary}`);
    if (request.classification.suggestedTool) {
      parts.push(
        `Tool used: ${request.classification.suggestedTool.name}`
      );
    }
    parts.push("");
  }

  // Add tool results
  if (request.toolResults && request.toolResults.length > 0) {
    parts.push("## Tool Execution Results\n");
    for (const result of request.toolResults) {
      if (result.success) {
        parts.push(`✓ ${result.toolName}: Success`);
        parts.push(`  Result: ${JSON.stringify(result.result, null, 2)}`);
      } else {
        parts.push(`✗ ${result.toolName}: Failed`);
        parts.push(`  Error: ${result.error}`);
      }
    }
    parts.push("");
  }

  // Add additional context
  if (request.additionalContext) {
    parts.push(`## Additional Context\n${request.additionalContext}\n`);
  }

  // Add conversation history (only user and assistant messages)
  if (request.conversationHistory && request.conversationHistory.length > 0) {
    const conversationMessages = request.conversationHistory
      .filter((msg) => msg.role === "user" || msg.role === "assistant")
      .slice(-3);
    
    if (conversationMessages.length > 0) {
      parts.push("## Recent Conversation\n");
      for (const msg of conversationMessages) {
        const role = msg.role === "user" ? "User" : "Theo";
        parts.push(`${role}: ${msg.content}`);
      }
      parts.push("");
    }
  }

  // Add style guidance
  const style = request.style || {};
  parts.push("## Response Guidelines");
  
  switch (style.tone) {
    case "professional":
      parts.push("- Use a professional, formal tone");
      break;
    case "brief":
      parts.push("- Be very brief and to the point");
      break;
    default:
      parts.push("- Use a friendly, conversational tone");
  }

  if (style.includeAssumptions !== false) {
    parts.push("- If you made assumptions, briefly mention them");
  }

  if (style.maxLength) {
    parts.push(`- Keep response under ${style.maxLength} words`);
  }

  parts.push("\n## Generate Response\nRespond naturally as Theo. Do not include JSON or formatting markers.");

  return parts.join("\n");
}

/**
 * Get the system prompt for response generation
 */
export function getResponseSystemPrompt(): string {
  return RESPONSE_GENERATION_SYSTEM_PROMPT;
}

/**
 * Build an error response prompt
 */
export function buildErrorResponsePrompt(
  userMessage: string,
  errorMessage: string,
  errorType?: string
): string {
  return `## User's Message
"${userMessage}"

## Error Occurred
Type: ${errorType || "Unknown"}
Message: ${errorMessage}

## Generate Response
Explain the error in user-friendly terms and suggest what they can do next. Be helpful and apologetic without being overly technical.`;
}

/**
 * Build a clarification request prompt
 */
export function buildClarificationPrompt(
  userMessage: string,
  missingInfo: string[],
  questions: string[]
): string {
  return `## User's Message
"${userMessage}"

## Missing Information
${missingInfo.map((info) => `- ${info}`).join("\n")}

## Suggested Questions
${questions.map((q) => `- ${q}`).join("\n")}

## Generate Response
Ask the user for clarification in a natural, helpful way. Don't ask all questions at once if there are many - prioritize the most important 1-2.`;
}

/**
 * Determine the appropriate response style based on context
 */
export function determineResponseStyle(request: ResponseGenerationRequest): ResponseStyle {
  const style: ResponseStyle = {
    tone: "conversational",
    includeAssumptions: true,
  };

  // Brief responses for simple confirmations
  if (request.toolResults?.length === 1 && request.toolResults[0].success) {
    style.tone = "brief";
    style.maxLength = 50;
  }

  // More detailed for errors
  if (request.toolResults?.some((r) => !r.success)) {
    style.tone = "conversational";
    style.maxLength = 150;
  }

  return { ...style, ...request.style };
}

