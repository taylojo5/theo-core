// ═══════════════════════════════════════════════════════════════════════════
// LLM Client Factory
// Creates LLM clients with the appropriate provider
// ═══════════════════════════════════════════════════════════════════════════

import { getLLMProvider, getLLMModel, TIMING_CONFIG } from "../config/globals";
import { llmLogger } from "../logger";
import type { LLMClient, LLMConfig } from "./types";
import { createOpenAIClient } from "./providers/openai";
import { createAnthropicClient } from "./providers/anthropic";

// ─────────────────────────────────────────────────────────────
// Default Configuration
// ─────────────────────────────────────────────────────────────

/**
 * Get default LLM configuration from environment
 */
export function getDefaultLLMConfig(): LLMConfig {
  const provider = getLLMProvider();

  return {
    provider,
    models: {
      fast: getLLMModel("intentAnalysis"),
      reasoning: getLLMModel("planning"),
      conversational: getLLMModel("responseGeneration"),
    },
    defaultTemperature: 0.7,
    maxRetries: 3,
    timeout: TIMING_CONFIG.LLM_REQUEST_TIMEOUT_MS,
  };
}

// ─────────────────────────────────────────────────────────────
// Client Factory
// ─────────────────────────────────────────────────────────────

/**
 * Create an LLM client with the specified configuration
 */
export function createLLMClient(config?: Partial<LLMConfig>): LLMClient {
  const fullConfig: LLMConfig = {
    ...getDefaultLLMConfig(),
    ...config,
  };

  llmLogger.info("Creating LLM client", {
    provider: fullConfig.provider,
    models: fullConfig.models,
  });

  switch (fullConfig.provider) {
    case "openai":
      return createOpenAIClient(fullConfig);

    case "anthropic":
      return createAnthropicClient(fullConfig);

    default:
      throw new Error(`Unsupported LLM provider: ${fullConfig.provider}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────

let _defaultClient: LLMClient | null = null;

/**
 * Get the default LLM client (singleton)
 * Uses configuration from environment variables
 */
export function getDefaultLLMClient(): LLMClient {
  if (!_defaultClient) {
    _defaultClient = createLLMClient();
  }
  return _defaultClient;
}

/**
 * Reset the default client (for testing)
 */
export function resetDefaultLLMClient(): void {
  _defaultClient = null;
}

/**
 * Set a custom default client (for testing)
 */
export function setDefaultLLMClient(client: LLMClient): void {
  _defaultClient = client;
}

// ─────────────────────────────────────────────────────────────
// Provider Availability
// ─────────────────────────────────────────────────────────────

/**
 * Check if a provider is available (has API key configured)
 */
export function isProviderAvailable(provider: LLMConfig["provider"]): boolean {
  switch (provider) {
    case "openai":
      return !!process.env.OPENAI_API_KEY;

    case "anthropic":
      return !!process.env.ANTHROPIC_API_KEY;

    default:
      return false;
  }
}

/**
 * Get list of available providers
 */
export function getAvailableProviders(): LLMConfig["provider"][] {
  const providers: LLMConfig["provider"][] = [];

  if (isProviderAvailable("openai")) {
    providers.push("openai");
  }
  if (isProviderAvailable("anthropic")) {
    providers.push("anthropic");
  }

  return providers;
}

/**
 * Get the best available provider
 * Prefers OpenAI, falls back to Anthropic
 */
export function getBestAvailableProvider(): LLMConfig["provider"] | null {
  if (isProviderAvailable("openai")) {
    return "openai";
  }
  if (isProviderAvailable("anthropic")) {
    return "anthropic";
  }
  return null;
}

