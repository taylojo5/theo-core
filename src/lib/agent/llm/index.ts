// ═══════════════════════════════════════════════════════════════════════════
// LLM Module Index
// Central export point for the LLM abstraction layer
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Tool types
  ToolForLLM,

  // Classification types
  ClassificationRequest,
  ClassificationResponse,
  LLMExtractedEntity,
  LLMAssumption,

  // Plan generation types
  PlanGenerationRequest,
  PlanAttempt,
  LLMGeneratedPlan,
  LLMPlanStep,

  // Response generation types
  ResponseGenerationRequest,
  ToolExecutionResult,
  ResponseStyle,

  // Recovery types
  RecoveryRequest,
  RecoveryAction,

  // LLM client types
  LLMMessage,
  LLMToolCall,
  CompletionOptions,
  LLMConfig,
  TokenUsage,
  CompletionResult,
  StreamChunk,
  LLMClient,

  // Error types
  LLMErrorCode,
  LLMErrorDetails,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Client Factory
// ─────────────────────────────────────────────────────────────

export {
  // Factory functions
  createLLMClient,
  getDefaultLLMConfig,

  // Singleton management
  getDefaultLLMClient,
  resetDefaultLLMClient,
  setDefaultLLMClient,

  // Provider availability
  isProviderAvailable,
  getAvailableProviders,
  getBestAvailableProvider,
} from "./client";

// ─────────────────────────────────────────────────────────────
// Providers
// ─────────────────────────────────────────────────────────────

export { createOpenAIClient } from "./providers/openai";
export { createAnthropicClient } from "./providers/anthropic";

// ─────────────────────────────────────────────────────────────
// Prompts
// ─────────────────────────────────────────────────────────────

export {
  // Classification
  buildClassificationPrompt,
  getClassificationSystemPrompt,
  parseClassificationResponse,

  // Plan generation
  buildPlanGenerationPrompt,
  getPlanGenerationSystemPrompt,
  parsePlanGenerationResponse,

  // Response generation
  buildResponsePrompt,
  getResponseSystemPrompt,
  buildErrorResponsePrompt,
  buildClarificationPrompt,
  determineResponseStyle,

  // Recovery
  buildRecoveryPrompt,
  getRecoverySystemPrompt,
  parseRecoveryResponse,
  isTransientError,
  getSuggestedRecoveryAction,
} from "./prompts";

// ─────────────────────────────────────────────────────────────
// Retry Logic
// ─────────────────────────────────────────────────────────────

export {
  // Constants
  DEFAULT_RETRY_CONFIG,

  // Types
  type RetryConfig,
  type RetryResult,
  type RetryProgressCallback,

  // Functions
  calculateRetryDelay,
  isRetryableError,
  withRetry,
  extractErrorDetails,
  createTimeoutError,
  withTimeout,
} from "./retry";

