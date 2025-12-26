// ═══════════════════════════════════════════════════════════════════════════
// Agent Configuration Service
// Provides effective configuration by merging DB + defaults + env vars
// ═══════════════════════════════════════════════════════════════════════════

import { getLogger } from "@/lib/logging";
import { agentConfigRepository, type AgentConfigUpdateInput } from "./repository";
import type {
  AgentRateLimits,
  TokenLimits,
  ContentFilterConfig,
  AgentFeatureFlags,
  ConfidenceThresholds,
  EffectiveAgentConfig,
} from "./types";

const logger = getLogger("AgentConfigService");

// ─────────────────────────────────────────────────────────────
// Default Values (from env vars with fallbacks)
// ─────────────────────────────────────────────────────────────

/**
 * Get default rate limits from environment variables
 */
export function getDefaultRateLimits(): Required<AgentRateLimits> {
  return {
    CHAT_PER_MINUTE: parseInt(
      process.env.AGENT_RATE_CHAT_PER_MINUTE ?? "20",
      10
    ),
    ACTIONS_PER_MINUTE: parseInt(
      process.env.AGENT_RATE_ACTIONS_PER_MINUTE ?? "10",
      10
    ),
    EXTERNAL_CALLS_PER_HOUR: parseInt(
      process.env.AGENT_RATE_EXTERNAL_CALLS_PER_HOUR ?? "50",
      10
    ),
    LLM_TOKENS_PER_HOUR: parseInt(
      process.env.AGENT_RATE_LLM_TOKENS_PER_HOUR ?? "100000",
      10
    ),
    MAX_CONCURRENT_PLANS: parseInt(
      process.env.AGENT_RATE_MAX_CONCURRENT_PLANS ?? "3",
      10
    ),
    MAX_PLAN_STEPS: parseInt(
      process.env.AGENT_RATE_MAX_PLAN_STEPS ?? "10",
      10
    ),
  };
}

/**
 * Get default token limits from environment variables
 */
export function getDefaultTokenLimits(): Required<TokenLimits> {
  return {
    MAX_CONVERSATION_CONTEXT: parseInt(
      process.env.AGENT_TOKEN_MAX_CONVERSATION_CONTEXT ?? "4000",
      10
    ),
    MAX_RETRIEVED_CONTEXT: parseInt(
      process.env.AGENT_TOKEN_MAX_RETRIEVED_CONTEXT ?? "2000",
      10
    ),
    MAX_SYSTEM_PROMPT: parseInt(
      process.env.AGENT_TOKEN_MAX_SYSTEM_PROMPT ?? "1500",
      10
    ),
    MAX_TOOL_DESCRIPTIONS: parseInt(
      process.env.AGENT_TOKEN_MAX_TOOL_DESCRIPTIONS ?? "2000",
      10
    ),
    MAX_RESPONSE_TOKENS: parseInt(
      process.env.AGENT_TOKEN_MAX_RESPONSE_TOKENS ?? "2000",
      10
    ),
    TARGET_REQUEST_BUDGET: parseInt(
      process.env.AGENT_TOKEN_TARGET_REQUEST_BUDGET ?? "8000",
      10
    ),
  };
}

/**
 * Get default content filter config from environment variables
 */
export function getDefaultContentFilterConfig(): Required<ContentFilterConfig> {
  return {
    SANITIZE_INPUT: process.env.AGENT_FILTER_SANITIZE_INPUT !== "false",
    FILTER_OUTPUT: process.env.AGENT_FILTER_OUTPUT !== "false",
    MAX_MESSAGE_LENGTH: parseInt(
      process.env.AGENT_FILTER_MAX_MESSAGE_LENGTH ?? "10000",
      10
    ),
    MAX_PROMPT_LENGTH: parseInt(
      process.env.AGENT_FILTER_MAX_PROMPT_LENGTH ?? "50000",
      10
    ),
    DETECT_INJECTION: process.env.AGENT_FILTER_DETECT_INJECTION !== "false",
  };
}

/**
 * Get default feature flags from environment variables
 */
export function getDefaultFeatureFlags(): Required<AgentFeatureFlags> {
  return {
    enablePlanning: process.env.AGENT_ENABLE_PLANNING !== "false",
    enableProactive: process.env.AGENT_ENABLE_PROACTIVE === "true",
    enableLearning: process.env.AGENT_ENABLE_LEARNING === "true",
    enableToolExecution: process.env.AGENT_ENABLE_TOOLS !== "false",
    enableAuditLogging: process.env.AGENT_ENABLE_AUDIT !== "false",
    enableStreaming: process.env.AGENT_ENABLE_STREAMING !== "false",
  };
}

/**
 * Get default confidence thresholds from environment variables
 */
export function getDefaultConfidenceThresholds(): Required<ConfidenceThresholds> {
  return {
    ACTION: parseFloat(process.env.AGENT_CONFIDENCE_ACTION ?? "0.7"),
    STATEMENT: parseFloat(process.env.AGENT_CONFIDENCE_STATEMENT ?? "0.5"),
    ASSUMPTION: parseFloat(process.env.AGENT_CONFIDENCE_ASSUMPTION ?? "0.3"),
    HIGH_RISK: parseFloat(process.env.AGENT_CONFIDENCE_HIGH_RISK ?? "0.9"),
    ENTITY_RESOLUTION: parseFloat(
      process.env.AGENT_CONFIDENCE_ENTITY_RESOLUTION ?? "0.8"
    ),
  };
}

/**
 * Get all defaults combined
 */
export function getDefaultAgentConfig(): EffectiveAgentConfig {
  return {
    rateLimits: getDefaultRateLimits(),
    tokenLimits: getDefaultTokenLimits(),
    contentFilterConfig: getDefaultContentFilterConfig(),
    featureFlags: getDefaultFeatureFlags(),
    confidenceThresholds: getDefaultConfidenceThresholds(),
  };
}

// ─────────────────────────────────────────────────────────────
// Config Merging
// ─────────────────────────────────────────────────────────────

/**
 * Merge user config with defaults
 * User values override defaults where present
 * Returns a Required<T> type since defaults fill in all missing values
 */
function mergeWithDefaults<T extends object>(
  userConfig: Partial<T> | null | undefined,
  defaults: Required<T>
): Required<T> {
  if (!userConfig) {
    return defaults;
  }

  const result = { ...defaults } as Required<T>;

  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const userValue = userConfig[key];
    if (userValue !== undefined && userValue !== null) {
      (result as Record<keyof T, unknown>)[key] = userValue;
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// Service Implementation
// ─────────────────────────────────────────────────────────────

class AgentConfigService {
  // Cache for user configs to reduce DB queries
  private cache: Map<string, { config: EffectiveAgentConfig; expires: number }> =
    new Map();
  private cacheTtlMs = 60_000; // 1 minute cache

  /**
   * Get the effective agent config for a user
   * Merges DB values with defaults from env vars
   */
  async getConfig(userId: string): Promise<EffectiveAgentConfig> {
    // Check cache first
    const cached = this.cache.get(userId);
    if (cached && cached.expires > Date.now()) {
      return cached.config;
    }

    // Get defaults
    const defaults = getDefaultAgentConfig();

    // Get user-specific overrides from DB
    const userConfig = await agentConfigRepository.findByUserId(userId);

    if (!userConfig) {
      // No user-specific config, use defaults
      this.cache.set(userId, {
        config: defaults,
        expires: Date.now() + this.cacheTtlMs,
      });
      return defaults;
    }

    // Merge user config with defaults
    const effectiveConfig: EffectiveAgentConfig = {
      rateLimits: mergeWithDefaults(
        userConfig.rateLimits as Partial<AgentRateLimits>,
        defaults.rateLimits
      ),
      tokenLimits: mergeWithDefaults(
        userConfig.tokenLimits as Partial<TokenLimits>,
        defaults.tokenLimits
      ),
      contentFilterConfig: mergeWithDefaults(
        userConfig.contentFilterConfig as Partial<ContentFilterConfig>,
        defaults.contentFilterConfig
      ),
      featureFlags: mergeWithDefaults(
        userConfig.featureFlags as Partial<AgentFeatureFlags>,
        defaults.featureFlags
      ),
      confidenceThresholds: mergeWithDefaults(
        userConfig.confidenceThresholds as Partial<ConfidenceThresholds>,
        defaults.confidenceThresholds
      ),
    };

    // Cache the result
    this.cache.set(userId, {
      config: effectiveConfig,
      expires: Date.now() + this.cacheTtlMs,
    });

    return effectiveConfig;
  }

  /**
   * Update user-specific config (merges with existing)
   */
  async updateConfig(
    userId: string,
    config: AgentConfigUpdateInput
  ): Promise<{ success: boolean; error?: string }> {
    const result = await agentConfigRepository.upsert(userId, config);

    if (result.success) {
      // Invalidate cache
      this.cache.delete(userId);
      logger.info("Updated agent config for user", { userId });
    }

    return { success: result.success, error: result.error };
  }

  /**
   * Reset user config to defaults (delete DB record)
   */
  async resetConfig(userId: string): Promise<{ success: boolean; error?: string }> {
    const result = await agentConfigRepository.delete(userId);

    if (result.success) {
      // Invalidate cache
      this.cache.delete(userId);
      logger.info("Reset agent config for user", { userId });
    }

    return { success: result.success, error: result.error };
  }

  /**
   * Reset a specific section to defaults
   */
  async resetSection(
    userId: string,
    section:
      | "rateLimits"
      | "tokenLimits"
      | "contentFilterConfig"
      | "featureFlags"
      | "confidenceThresholds"
  ): Promise<{ success: boolean; error?: string }> {
    const result = await agentConfigRepository.resetSection(userId, section);

    if (result.success) {
      // Invalidate cache
      this.cache.delete(userId);
      logger.info("Reset agent config section for user", { userId, section });
    }

    return { success: result.success, error: result.error };
  }

  /**
   * Get specific rate limit value for a user
   */
  async getRateLimit(
    userId: string,
    key: keyof AgentRateLimits
  ): Promise<number> {
    const config = await this.getConfig(userId);
    return config.rateLimits[key];
  }

  /**
   * Get specific token limit value for a user
   */
  async getTokenLimit(userId: string, key: keyof TokenLimits): Promise<number> {
    const config = await this.getConfig(userId);
    return config.tokenLimits[key];
  }

  /**
   * Get specific content filter setting for a user
   */
  async getContentFilterSetting<K extends keyof ContentFilterConfig>(
    userId: string,
    key: K
  ): Promise<ContentFilterConfig[K]> {
    const config = await this.getConfig(userId);
    return config.contentFilterConfig[key];
  }

  /**
   * Check if a feature is enabled for a user
   */
  async isFeatureEnabled(
    userId: string,
    feature: keyof AgentFeatureFlags
  ): Promise<boolean> {
    const config = await this.getConfig(userId);
    return config.featureFlags[feature];
  }

  /**
   * Get confidence threshold for a user
   */
  async getConfidenceThreshold(
    userId: string,
    threshold: keyof ConfidenceThresholds
  ): Promise<number> {
    const config = await this.getConfig(userId);
    return config.confidenceThresholds[threshold];
  }

  /**
   * Invalidate cache for a user
   * Call this after external config updates
   */
  invalidateCache(userId: string): void {
    this.cache.delete(userId);
  }

  /**
   * Clear entire cache
   * Useful for config reloads
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const agentConfigService = new AgentConfigService();

