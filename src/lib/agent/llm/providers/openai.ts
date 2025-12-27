// ═══════════════════════════════════════════════════════════════════════════
// OpenAI Provider
// LLM client implementation for OpenAI
// ═══════════════════════════════════════════════════════════════════════════

import OpenAI from "openai";
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
  LLMMessage,
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
// Provider Implementation
// ─────────────────────────────────────────────────────────────

/**
 * Create an OpenAI LLM client
 */
export function createOpenAIClient(config: LLMConfig): LLMClient {
  const openai = new OpenAI({
    apiKey: config.apiKey || process.env.OPENAI_API_KEY,
  });

  const logger = llmLogger.child("openai");

  /**
   * Convert LLM messages to OpenAI format
   */
  function toOpenAIMessages(
    messages: LLMMessage[]
  ): OpenAI.ChatCompletionMessageParam[] {
    return messages.map((msg, index) => {
      if (msg.role === "tool") {
        // Tool messages must have a toolCallId that matches a preceding tool_call
        if (!msg.toolCallId) {
          throw new Error(
            `Invalid tool message at index ${index}: toolCallId is required for tool role messages`
          );
        }
        return {
          role: "tool" as const,
          content: msg.content,
          tool_call_id: msg.toolCallId,
        };
      }

      if (msg.role === "assistant" && msg.toolCalls) {
        return {
          role: "assistant" as const,
          content: msg.content,
          tool_calls: msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: tc.arguments,
            },
          })),
        };
      }

      return {
        role: msg.role as "system" | "user" | "assistant",
        content: msg.content,
      };
    });
  }

  /**
   * Extract token usage from OpenAI response
   */
  function extractUsage(usage?: OpenAI.CompletionUsage): TokenUsage {
    return {
      promptTokens: usage?.prompt_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? 0,
      totalTokens: usage?.total_tokens ?? 0,
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

    const retryResult = await withRetry(
      async () => {
        const response = await withTimeout(
          openai.chat.completions.create({
            model: config.models.fast,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.3, // Lower temperature for classification
            max_tokens: 2000,
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

    const content = retryResult.result.choices[0]?.message?.content || "";
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

    const retryResult = await withRetry(
      async () => {
        const response = await withTimeout(
          openai.chat.completions.create({
            model: config.models.reasoning,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.5, // Moderate temperature for creative planning
            max_tokens: 4000,
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

    const content = retryResult.result.choices[0]?.message?.content || "";
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

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add conversation history
    if (request.conversationHistory) {
      messages.push(...toOpenAIMessages(request.conversationHistory));
    }

    messages.push({ role: "user", content: userPrompt });

    // Estimate prompt tokens for fallback usage calculation
    const promptText = messages.map((m) => m.content).join("\n");
    const estimatedPromptTokens = estimateTokens(promptText);

    const stream = await openai.chat.completions.create({
      model: config.models.conversational,
      messages,
      temperature: config.defaultTemperature,
      max_tokens: request.style?.maxLength ? request.style.maxLength * 5 : 2000,
      stream: true,
    });

    let totalContent = "";
    let usage: TokenUsage | undefined;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        totalContent += delta.content;
        yield {
          content: delta.content,
          done: false,
        };
      }

      // Check for usage in the final chunk
      if (chunk.usage) {
        usage = extractUsage(chunk.usage);
      }
    }

    // Final chunk with token usage
    const estimatedCompletionTokens = estimateTokens(totalContent);
    yield {
      done: true,
      usage: usage || {
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

    const retryResult = await withRetry(
      async () => {
        const response = await withTimeout(
          openai.chat.completions.create({
            model: config.models.fast,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.2, // Low temperature for deterministic decisions
            max_tokens: 500,
          }),
          config.timeout
        );

        return response;
      },
      { maxRetries: 1 } // Only 1 retry for recovery decisions
    );

    if (!retryResult.success || !retryResult.result) {
      // Default to asking user if recovery decision fails
      return {
        action: "ask_user",
        reasoning: "Failed to determine recovery action",
        userMessage: "I encountered an issue and need your guidance on how to proceed.",
        confidence: 0,
      };
    }

    const content = retryResult.result.choices[0]?.message?.content || "";
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
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "user", content: prompt },
    ];

    const retryResult = await withRetry(
      async () => {
        const response = await withTimeout(
          openai.chat.completions.create({
            model,
            messages,
            temperature: options?.temperature ?? config.defaultTemperature,
            max_tokens: options?.maxTokens ?? 2000,
            response_format:
              options?.responseFormat === "json"
                ? { type: "json_object" }
                : undefined,
            stop: options?.stop,
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

    const choice = retryResult.result.choices[0];

    logger.debug("Completion finished", {
      model,
      durationMs: Date.now() - startTime,
    });

    return {
      content: choice?.message?.content || "",
      usage: extractUsage(retryResult.result.usage),
      model: retryResult.result.model,
      finishReason: mapFinishReason(choice?.finish_reason),
      toolCalls: choice?.message?.tool_calls
        ?.filter((tc): tc is OpenAI.ChatCompletionMessageToolCall & { type: 'function' } => tc.type === 'function')
        ?.map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: tc.function.arguments,
        })),
    };
  }

  async function* streamComplete(
    prompt: string,
    options?: CompletionOptions
  ): AsyncGenerator<StreamChunk> {
    const model = options?.model || config.models.conversational;

    // Estimate prompt tokens for fallback usage calculation
    const estimatedPromptTokens = estimateTokens(prompt);

    const stream = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: options?.temperature ?? config.defaultTemperature,
      max_tokens: options?.maxTokens ?? 2000,
      stop: options?.stop,
      stream: true,
    });

    let totalContent = "";

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        totalContent += delta.content;
        yield {
          content: delta.content,
          done: false,
        };
      }
    }

    // Final chunk with token usage
    const estimatedCompletionTokens = estimateTokens(totalContent);
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
    return "openai" as const;
  }

  function getModel(useCase: "fast" | "reasoning" | "conversational"): string {
    return config.models[useCase];
  }

  function mapFinishReason(
    reason?: string
  ): CompletionResult["finishReason"] {
    switch (reason) {
      case "stop":
        return "stop";
      case "length":
        return "length";
      case "tool_calls":
        return "tool_calls";
      case "content_filter":
        return "content_filter";
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

