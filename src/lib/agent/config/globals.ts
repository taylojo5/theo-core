// ═══════════════════════════════════════════════════════════════════════════
// Agent Global Configuration
// Global settings that are NOT per-user (from env vars only)
// ═══════════════════════════════════════════════════════════════════════════

import {
  getDefaultRateLimits,
  getDefaultTokenLimits,
  getDefaultContentFilterConfig,
  getDefaultFeatureFlags,
  getDefaultConfidenceThresholds,
} from "./service";

// ─────────────────────────────────────────────────────────────
// LLM Model Configuration
// ─────────────────────────────────────────────────────────────

/**
 * Available LLM providers
 */
export type LLMProvider = "openai" | "anthropic";

/**
 * LLM model identifiers for different use cases
 */
export interface LLMModelConfig {
  /** Model for intent analysis (fast, good at classification) */
  intentAnalysis: string;
  /** Model for complex planning (strong reasoning) */
  planning: string;
  /** Model for tool selection (good function calling) */
  toolSelection: string;
  /** Model for response generation (balanced quality/speed) */
  responseGeneration: string;
}

/**
 * Default LLM models for each use case
 */
export const DEFAULT_LLM_MODELS: LLMModelConfig = {
  intentAnalysis: "gpt-4o-mini",
  planning: "gpt-4o",
  toolSelection: "gpt-4o",
  responseGeneration: "gpt-4o",
};

/**
 * Get the configured LLM model for a specific use case
 * Reads from environment variables with fallback to defaults
 */
export function getLLMModel(useCase: keyof LLMModelConfig): string {
  const envKeyMap: Record<keyof LLMModelConfig, string> = {
    intentAnalysis: "LLM_MODEL_INTENT_ANALYSIS",
    planning: "LLM_MODEL_PLANNING",
    toolSelection: "LLM_MODEL_TOOL_SELECTION",
    responseGeneration: "LLM_MODEL_RESPONSE_GENERATION",
  };

  const envValue = process.env[envKeyMap[useCase]];
  if (envValue) {
    return envValue;
  }
  return DEFAULT_LLM_MODELS[useCase];
}

/**
 * Get the LLM provider from environment (defaults to OpenAI)
 */
export function getLLMProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER?.toLowerCase();
  if (provider === "anthropic") {
    return "anthropic";
  }
  return "openai";
}

// ─────────────────────────────────────────────────────────────
// Timing Configuration (Global, not per-user)
// ─────────────────────────────────────────────────────────────

/**
 * Timeout and timing configuration
 * These are system-wide and not configurable per user
 */
export const TIMING_CONFIG = {
  /** LLM request timeout in milliseconds */
  LLM_REQUEST_TIMEOUT_MS: parseInt(
    process.env.AGENT_LLM_REQUEST_TIMEOUT_MS ?? "60000",
    10
  ),

  /** Tool execution timeout in milliseconds */
  TOOL_EXECUTION_TIMEOUT_MS: parseInt(
    process.env.AGENT_TOOL_EXECUTION_TIMEOUT_MS ?? "30000",
    10
  ),

  /** Default approval expiration in hours */
  APPROVAL_EXPIRATION_HOURS: parseInt(
    process.env.AGENT_APPROVAL_EXPIRATION_HOURS ?? "24",
    10
  ),

  /** Plan execution timeout in milliseconds (per step) */
  PLAN_STEP_TIMEOUT_MS: parseInt(
    process.env.AGENT_PLAN_STEP_TIMEOUT_MS ?? "60000",
    10
  ),

  /** Streaming chunk timeout in milliseconds */
  STREAM_CHUNK_TIMEOUT_MS: parseInt(
    process.env.AGENT_STREAM_CHUNK_TIMEOUT_MS ?? "30000",
    10
  ),
} as const;

// ─────────────────────────────────────────────────────────────
// Environment Validation
// ─────────────────────────────────────────────────────────────

/**
 * Required environment variables for the Agent Engine
 */
export const REQUIRED_ENV_VARS = ["OPENAI_API_KEY"] as const;

/**
 * Optional environment variables with their default values
 */
export const OPTIONAL_ENV_VARS = {
  // LLM Provider
  LLM_PROVIDER: "openai",

  // LLM Models
  LLM_MODEL_INTENT_ANALYSIS: "gpt-4o-mini",
  LLM_MODEL_PLANNING: "gpt-4o",
  LLM_MODEL_TOOL_SELECTION: "gpt-4o",
  LLM_MODEL_RESPONSE_GENERATION: "gpt-4o",

  // Feature Flags
  AGENT_ENABLE_PLANNING: "true",
  AGENT_ENABLE_PROACTIVE: "false",
  AGENT_ENABLE_LEARNING: "false",
  AGENT_ENABLE_TOOLS: "true",
  AGENT_ENABLE_AUDIT: "true",
  AGENT_ENABLE_STREAMING: "true",

  // Rate Limits
  AGENT_RATE_CHAT_PER_MINUTE: "20",
  AGENT_RATE_ACTIONS_PER_MINUTE: "10",
  AGENT_RATE_EXTERNAL_CALLS_PER_HOUR: "50",
  AGENT_RATE_LLM_TOKENS_PER_HOUR: "100000",
  AGENT_RATE_MAX_CONCURRENT_PLANS: "3",
  AGENT_RATE_MAX_PLAN_STEPS: "10",

  // Token Limits
  AGENT_TOKEN_MAX_CONVERSATION_CONTEXT: "4000",
  AGENT_TOKEN_MAX_RETRIEVED_CONTEXT: "2000",
  AGENT_TOKEN_MAX_SYSTEM_PROMPT: "1500",
  AGENT_TOKEN_MAX_TOOL_DESCRIPTIONS: "2000",
  AGENT_TOKEN_MAX_RESPONSE_TOKENS: "2000",
  AGENT_TOKEN_TARGET_REQUEST_BUDGET: "8000",

  // Content Filter
  AGENT_FILTER_SANITIZE_INPUT: "true",
  AGENT_FILTER_OUTPUT: "true",
  AGENT_FILTER_MAX_MESSAGE_LENGTH: "10000",
  AGENT_FILTER_MAX_PROMPT_LENGTH: "50000",
  AGENT_FILTER_DETECT_INJECTION: "true",

  // Confidence Thresholds
  AGENT_CONFIDENCE_ACTION: "0.7",
  AGENT_CONFIDENCE_STATEMENT: "0.5",
  AGENT_CONFIDENCE_ASSUMPTION: "0.3",
  AGENT_CONFIDENCE_HIGH_RISK: "0.9",
  AGENT_CONFIDENCE_ENTITY_RESOLUTION: "0.8",

  // Timing
  AGENT_LLM_REQUEST_TIMEOUT_MS: "60000",
  AGENT_TOOL_EXECUTION_TIMEOUT_MS: "30000",
  AGENT_APPROVAL_EXPIRATION_HOURS: "24",
  AGENT_PLAN_STEP_TIMEOUT_MS: "60000",
  AGENT_STREAM_CHUNK_TIMEOUT_MS: "30000",
} as const;

/**
 * Validate that required environment variables are set
 * Call this during application startup
 */
export function validateAgentConfig(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Get a summary of the current agent configuration
 * Useful for debugging and logging
 */
export function getAgentConfigSummary(): Record<string, unknown> {
  const validation = validateAgentConfig();

  return {
    provider: getLLMProvider(),
    models: {
      intentAnalysis: getLLMModel("intentAnalysis"),
      planning: getLLMModel("planning"),
      toolSelection: getLLMModel("toolSelection"),
      responseGeneration: getLLMModel("responseGeneration"),
    },
    defaults: {
      rateLimits: getDefaultRateLimits(),
      tokenLimits: getDefaultTokenLimits(),
      contentFilterConfig: getDefaultContentFilterConfig(),
      featureFlags: getDefaultFeatureFlags(),
      confidenceThresholds: getDefaultConfidenceThresholds(),
    },
    timing: TIMING_CONFIG,
    configValid: validation.valid,
    missingEnvVars: validation.missing,
  };
}



