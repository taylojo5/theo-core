// ═══════════════════════════════════════════════════════════════════════════
// Anthropic Provider
// LLM client implementation for Anthropic Claude
// ═══════════════════════════════════════════════════════════════════════════

import { llmLogger } from "../../logger";
import type {
  LLMClient,
  LLMConfig,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
  ClassificationRequest,
  ClassificationResponse,
  PlanGenerationRequest,
  LLMGeneratedPlan,
  ResponseGenerationRequest,
  RecoveryRequest,
  RecoveryAction,
  TokenUsage,
} from "../types";
import {
  buildClassificationPrompt,
  getClassificationSystemPrompt,
  parseClassificationResponse,
  buildPlanGenerationPrompt,
  getPlanGenerationSystemPrompt,
  parsePlanGenerationResponse,
  buildResponsePrompt,
  getResponseSystemPrompt,
  buildRecoveryPrompt,
  getRecoverySystemPrompt,
  parseRecoveryResponse,
} from "../prompts";
import { withRetry, withTimeout } from "../retry";

// ─────────────────────────────────────────────────────────────
// Types for Anthropic API (inline to avoid SDK dependency)
// ─────────────────────────────────────────────────────────────

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

interface AnthropicContentBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: string;
}

interface AnthropicResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface AnthropicStreamEvent {
  type: string;
  index?: number;
  delta?: {
    type?: string;
    text?: string;
    stop_reason?: string;
  };
  message?: AnthropicResponse;
  usage?: {
    output_tokens: number;
  };
}

// ─────────────────────────────────────────────────────────────
// Provider Implementation
// ─────────────────────────────────────────────────────────────

/**
 * Create an Anthropic LLM client
 */
export function createAnthropicClient(config: LLMConfig): LLMClient {
  const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
  const baseUrl = "https://api.anthropic.com/v1";
  const logger = llmLogger.child("anthropic");

  if (!apiKey) {
    logger.warn("Anthropic API key not configured");
  }

  /**
   * Make a request to Anthropic API
   */
  async function anthropicRequest<T>(
    endpoint: string,
    body: Record<string, unknown>
  ): Promise<T> {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const err = new Error(
        (error as { error?: { message?: string } })?.error?.message ||
          `Anthropic API error: ${response.status}`
      );
      Object.assign(err, {
        status: response.status,
        error,
        headers: Object.fromEntries(response.headers.entries()),
      });
      throw err;
    }

    return response.json() as Promise<T>;
  }

  /**
   * Make a streaming request to Anthropic API
   */
  async function* anthropicStreamRequest(
    endpoint: string,
    body: Record<string, unknown>
  ): AsyncGenerator<AnthropicStreamEvent> {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ ...body, stream: true }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        (error as { error?: { message?: string } })?.error?.message ||
          `Anthropic API error: ${response.status}`
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();

      if (value) {
        buffer += decoder.decode(value, { stream: true });
      }

      // Process all complete lines in the buffer
      const lines = buffer.split("\n");
      // Keep the last incomplete line in the buffer (or empty string if ends with newline)
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            yield JSON.parse(data) as AnthropicStreamEvent;
          } catch {
            // Skip invalid JSON
          }
        }
      }

      // Exit after processing when stream is done
      if (done) {
        // Process any remaining data in buffer (final chunk without trailing newline)
        if (buffer.trim()) {
          if (buffer.startsWith("data: ")) {
            const data = buffer.slice(6);
            if (data !== "[DONE]") {
              try {
                yield JSON.parse(data) as AnthropicStreamEvent;
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
        break;
      }
    }
  }

  /**
   * Extract text from Anthropic content blocks
   */
  function extractText(content: AnthropicContentBlock[]): string {
    return content
      .filter((block) => block.type === "text")
      .map((block) => block.text || "")
      .join("");
  }

  /**
   * Extract token usage
   */
  function extractUsage(response: AnthropicResponse): TokenUsage {
    return {
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Classification
  // ─────────────────────────────────────────────────────────────

  async function classify(
    request: ClassificationRequest
  ): Promise<ClassificationResponse> {
    const startTime = Date.now();
    logger.debug("Classifying message", { messageLength: request.message.length });

    const systemPrompt = getClassificationSystemPrompt();
    const userPrompt = buildClassificationPrompt(request);

    // Add JSON formatting instruction
    const jsonPrompt = `${userPrompt}\n\nRespond ONLY with valid JSON, no other text.`;

    const retryResult = await withRetry(
      async () => {
        const response = await withTimeout(
          anthropicRequest<AnthropicResponse>("/messages", {
            model: config.models.fast,
            max_tokens: 2000,
            system: systemPrompt,
            messages: [{ role: "user", content: jsonPrompt }],
          }),
          config.timeout
        );

        return response;
      },
      { maxRetries: config.maxRetries }
    );

    if (!retryResult.success || !retryResult.result) {
      throw new Error(retryResult.error?.message || "Classification failed");
    }

    const content = extractText(retryResult.result.content);
    const classification = parseClassificationResponse(content);

    logger.info("Classification complete", {
      intent: classification.intent.category,
      confidence: classification.confidence,
      durationMs: Date.now() - startTime,
    });

    return classification;
  }

  // ─────────────────────────────────────────────────────────────
  // Plan Generation
  // ─────────────────────────────────────────────────────────────

  async function generatePlan(
    request: PlanGenerationRequest
  ): Promise<LLMGeneratedPlan> {
    const startTime = Date.now();
    logger.debug("Generating plan", { goal: request.goal });

    const systemPrompt = getPlanGenerationSystemPrompt();
    const userPrompt = buildPlanGenerationPrompt(request);
    const jsonPrompt = `${userPrompt}\n\nRespond ONLY with valid JSON, no other text.`;

    const retryResult = await withRetry(
      async () => {
        const response = await withTimeout(
          anthropicRequest<AnthropicResponse>("/messages", {
            model: config.models.reasoning,
            max_tokens: 4000,
            system: systemPrompt,
            messages: [{ role: "user", content: jsonPrompt }],
          }),
          config.timeout
        );

        return response;
      },
      { maxRetries: config.maxRetries }
    );

    if (!retryResult.success || !retryResult.result) {
      throw new Error(retryResult.error?.message || "Plan generation failed");
    }

    const content = extractText(retryResult.result.content);
    const plan = parsePlanGenerationResponse(content);

    logger.info("Plan generation complete", {
      stepCount: plan.steps.length,
      requiresApproval: plan.requiresApproval,
      durationMs: Date.now() - startTime,
    });

    return plan;
  }

  // ─────────────────────────────────────────────────────────────
  // Response Generation (Streaming)
  // ─────────────────────────────────────────────────────────────

  async function* generateResponse(
    request: ResponseGenerationRequest
  ): AsyncGenerator<StreamChunk> {
    const startTime = Date.now();
    logger.debug("Generating response", {
      messageLength: request.userMessage.length,
    });

    const systemPrompt = getResponseSystemPrompt();
    const userPrompt = buildResponsePrompt(request);

    const messages: AnthropicMessage[] = [];

    // Add conversation history
    if (request.conversationHistory) {
      for (const msg of request.conversationHistory) {
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({
            role: msg.role,
            content: msg.content,
          });
        }
      }
    }

    messages.push({ role: "user", content: userPrompt });

    // Estimate prompt tokens for fallback usage calculation
    const promptText = systemPrompt + "\n" + messages.map((m) => 
      typeof m.content === "string" ? m.content : JSON.stringify(m.content)
    ).join("\n");
    const estimatedPromptTokens = estimateTokens(promptText);

    let totalContent = "";
    let outputTokens = 0;

    for await (const event of anthropicStreamRequest("/messages", {
      model: config.models.conversational,
      max_tokens: request.style?.maxLength ? request.style.maxLength * 5 : 2000,
      system: systemPrompt,
      messages,
    })) {
      if (event.type === "content_block_delta" && event.delta?.text) {
        totalContent += event.delta.text;
        yield {
          content: event.delta.text,
          done: false,
        };
      }

      if (event.usage?.output_tokens) {
        outputTokens = event.usage.output_tokens;
      }
    }

    // Final chunk with token usage
    const estimatedCompletionTokens = outputTokens || estimateTokens(totalContent);
    yield {
      done: true,
      usage: {
        promptTokens: estimatedPromptTokens,
        completionTokens: estimatedCompletionTokens,
        totalTokens: estimatedPromptTokens + estimatedCompletionTokens,
      },
    };

    logger.info("Response generation complete", {
      contentLength: totalContent.length,
      durationMs: Date.now() - startTime,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Recovery Decision
  // ─────────────────────────────────────────────────────────────

  async function decideRecovery(request: RecoveryRequest): Promise<RecoveryAction> {
    const startTime = Date.now();
    logger.debug("Deciding recovery action", {
      failedStep: request.failure.stepIndex,
      retryCount: request.retryCount,
    });

    const systemPrompt = getRecoverySystemPrompt();
    const userPrompt = buildRecoveryPrompt(request);
    const jsonPrompt = `${userPrompt}\n\nRespond ONLY with valid JSON, no other text.`;

    const retryResult = await withRetry(
      async () => {
        const response = await withTimeout(
          anthropicRequest<AnthropicResponse>("/messages", {
            model: config.models.fast,
            max_tokens: 500,
            system: systemPrompt,
            messages: [{ role: "user", content: jsonPrompt }],
          }),
          config.timeout
        );

        return response;
      },
      { maxRetries: 1 }
    );

    if (!retryResult.success || !retryResult.result) {
      return {
        action: "ask_user",
        reasoning: "Failed to determine recovery action",
        userMessage: "I encountered an issue and need your guidance on how to proceed.",
        confidence: 0,
      };
    }

    const content = extractText(retryResult.result.content);
    const action = parseRecoveryResponse(content);

    logger.info("Recovery decision made", {
      action: action.action,
      confidence: action.confidence,
      durationMs: Date.now() - startTime,
    });

    return action;
  }

  // ─────────────────────────────────────────────────────────────
  // Raw Completion
  // ─────────────────────────────────────────────────────────────

  async function complete(
    prompt: string,
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    const startTime = Date.now();
    const model = options?.model || config.models.conversational;

    const messages: AnthropicMessage[] = [{ role: "user", content: prompt }];

    const retryResult = await withRetry(
      async () => {
        const response = await withTimeout(
          anthropicRequest<AnthropicResponse>("/messages", {
            model,
            max_tokens: options?.maxTokens ?? 2000,
            messages,
          }),
          options?.timeout || config.timeout
        );

        return response;
      },
      { maxRetries: config.maxRetries }
    );

    if (!retryResult.success || !retryResult.result) {
      throw new Error(retryResult.error?.message || "Completion failed");
    }

    const response = retryResult.result;
    const content = extractText(response.content);

    logger.debug("Completion finished", {
      model,
      durationMs: Date.now() - startTime,
    });

    return {
      content,
      usage: extractUsage(response),
      model: response.model,
      finishReason: mapFinishReason(response.stop_reason),
    };
  }

  async function* streamComplete(
    prompt: string,
    options?: CompletionOptions
  ): AsyncGenerator<StreamChunk> {
    const model = options?.model || config.models.conversational;

    // Estimate prompt tokens for fallback usage calculation
    const estimatedPromptTokens = estimateTokens(prompt);

    let totalContent = "";
    let outputTokens = 0;

    for await (const event of anthropicStreamRequest("/messages", {
      model,
      max_tokens: options?.maxTokens ?? 2000,
      messages: [{ role: "user", content: prompt }],
    })) {
      if (event.type === "content_block_delta" && event.delta?.text) {
        totalContent += event.delta.text;
        yield {
          content: event.delta.text,
          done: false,
        };
      }

      if (event.usage?.output_tokens) {
        outputTokens = event.usage.output_tokens;
      }
    }

    // Final chunk with token usage
    const estimatedCompletionTokens = outputTokens || estimateTokens(totalContent);
    yield {
      done: true,
      usage: {
        promptTokens: estimatedPromptTokens,
        completionTokens: estimatedCompletionTokens,
        totalTokens: estimatedPromptTokens + estimatedCompletionTokens,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────

  function getProvider() {
    return "anthropic" as const;
  }

  function getModel(useCase: "fast" | "reasoning" | "conversational"): string {
    return config.models[useCase];
  }

  function mapFinishReason(
    reason: string | null
  ): CompletionResult["finishReason"] {
    switch (reason) {
      case "end_turn":
        return "stop";
      case "max_tokens":
        return "length";
      case "tool_use":
        return "tool_calls";
      default:
        return "stop";
    }
  }

  // Return the client implementation
  return {
    classify,
    generatePlan,
    generateResponse,
    decideRecovery,
    complete,
    streamComplete,
    getProvider,
    getModel,
  };
}

// ─────────────────────────────────────────────────────────────
// Token Estimation
// ─────────────────────────────────────────────────────────────

/**
 * Rough token estimation (4 chars per token for English)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

