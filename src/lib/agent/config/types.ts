// ═══════════════════════════════════════════════════════════════════════════
// Agent Configuration Types
// Type definitions for per-user agent configuration
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Rate Limits
// ─────────────────────────────────────────────────────────────

/**
 * Agent-specific rate limiting configuration
 * All fields are optional - missing fields use defaults
 */
export interface AgentRateLimits {
  /** Max chat messages per minute per user */
  CHAT_PER_MINUTE?: number;

  /** Max actions (tool executions) per minute per user */
  ACTIONS_PER_MINUTE?: number;

  /** Max external API calls (Gmail, Calendar) per hour per user */
  EXTERNAL_CALLS_PER_HOUR?: number;

  /** Max LLM tokens per hour per user (cost control) */
  LLM_TOKENS_PER_HOUR?: number;

  /** Max concurrent plans per user */
  MAX_CONCURRENT_PLANS?: number;

  /** Max steps in a single plan */
  MAX_PLAN_STEPS?: number;
}

// ─────────────────────────────────────────────────────────────
// Token Limits
// ─────────────────────────────────────────────────────────────

/**
 * Token limits for context management
 * All fields are optional - missing fields use defaults
 */
export interface TokenLimits {
  /** Maximum tokens for conversation context */
  MAX_CONVERSATION_CONTEXT?: number;

  /** Maximum tokens for retrieved context */
  MAX_RETRIEVED_CONTEXT?: number;

  /** Maximum tokens for system prompt */
  MAX_SYSTEM_PROMPT?: number;

  /** Maximum tokens for tool descriptions */
  MAX_TOOL_DESCRIPTIONS?: number;

  /** Maximum tokens for a single response */
  MAX_RESPONSE_TOKENS?: number;

  /** Target token budget per request (input + output) */
  TARGET_REQUEST_BUDGET?: number;
}

// ─────────────────────────────────────────────────────────────
// Content Filter Config
// ─────────────────────────────────────────────────────────────

/**
 * Content filtering settings
 * All fields are optional - missing fields use defaults
 */
export interface ContentFilterConfig {
  /** Enable input sanitization */
  SANITIZE_INPUT?: boolean;

  /** Enable output filtering */
  FILTER_OUTPUT?: boolean;

  /** Maximum message length (characters) */
  MAX_MESSAGE_LENGTH?: number;

  /** Maximum prompt length after truncation */
  MAX_PROMPT_LENGTH?: number;

  /** Enable prompt injection detection */
  DETECT_INJECTION?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Feature Flags
// ─────────────────────────────────────────────────────────────

/**
 * Agent feature flags for per-user feature rollout
 * All fields are optional - missing fields use defaults
 */
export interface AgentFeatureFlags {
  /** Enable multi-step planning */
  enablePlanning?: boolean;

  /** Enable proactive suggestions */
  enableProactive?: boolean;

  /** Enable learning from feedback */
  enableLearning?: boolean;

  /** Enable tool execution (vs just suggestions) */
  enableToolExecution?: boolean;

  /** Enable audit logging */
  enableAuditLogging?: boolean;

  /** Enable streaming responses */
  enableStreaming?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Confidence Thresholds
// ─────────────────────────────────────────────────────────────

/**
 * Confidence thresholds for agent decision-making
 * All fields are optional - missing fields use defaults
 */
export interface ConfidenceThresholds {
  /** Below this, ask for clarification before taking action (0-1) */
  ACTION?: number;

  /** Below this, present statements as uncertain (0-1) */
  STATEMENT?: number;

  /** Below this, don't show the assumption to the user (0-1) */
  ASSUMPTION?: number;

  /** Required confidence for high-risk actions (0-1) */
  HIGH_RISK?: number;

  /** Threshold for entity resolution (0-1) */
  ENTITY_RESOLUTION?: number;
}

// ─────────────────────────────────────────────────────────────
// Combined User Config
// ─────────────────────────────────────────────────────────────

/**
 * Complete user agent configuration
 * Represents the effective config after merging DB values with defaults
 */
export interface EffectiveAgentConfig {
  rateLimits: Required<AgentRateLimits>;
  tokenLimits: Required<TokenLimits>;
  contentFilterConfig: Required<ContentFilterConfig>;
  featureFlags: Required<AgentFeatureFlags>;
  confidenceThresholds: Required<ConfidenceThresholds>;
}

/**
 * Partial user config (what's stored in DB)
 * All sections and their fields are optional
 */
export interface PartialAgentConfig {
  rateLimits?: Partial<AgentRateLimits>;
  tokenLimits?: Partial<TokenLimits>;
  contentFilterConfig?: Partial<ContentFilterConfig>;
  featureFlags?: Partial<AgentFeatureFlags>;
  confidenceThresholds?: Partial<ConfidenceThresholds>;
}


