// ═══════════════════════════════════════════════════════════════════════════
// Agent Configuration Module
// Centralized configuration for the Agent Engine
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  AgentRateLimits,
  TokenLimits,
  ContentFilterConfig,
  AgentFeatureFlags,
  ConfidenceThresholds,
  EffectiveAgentConfig,
  PartialAgentConfig,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Repository (for direct DB access)
// ─────────────────────────────────────────────────────────────

export {
  agentConfigRepository,
  type AgentConfigUpdateInput,
  type RepositoryResult,
} from "./repository";

// ─────────────────────────────────────────────────────────────
// Service (main API for getting effective config)
// ─────────────────────────────────────────────────────────────

export {
  agentConfigService,
  // Default getters (env vars + fallbacks)
  getDefaultRateLimits,
  getDefaultTokenLimits,
  getDefaultContentFilterConfig,
  getDefaultFeatureFlags,
  getDefaultConfidenceThresholds,
  getDefaultAgentConfig,
} from "./service";

// ─────────────────────────────────────────────────────────────
// Global Configs (not per-user, from env vars only)
// ─────────────────────────────────────────────────────────────

export {
  // LLM Configuration
  type LLMProvider,
  type LLMModelConfig,
  getLLMModel,
  getLLMProvider,
  DEFAULT_LLM_MODELS,

  // Timing Configuration (global, not per-user)
  TIMING_CONFIG,

  // Environment Validation
  REQUIRED_ENV_VARS,
  OPTIONAL_ENV_VARS,
  validateAgentConfig,
  getAgentConfigSummary,
} from "./globals";

