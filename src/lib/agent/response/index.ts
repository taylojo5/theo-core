// ═══════════════════════════════════════════════════════════════════════════
// Response Module
// Response formatting, prompt building, and output structuring for the Agent Engine
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Metadata types
  ResponseGenerationMetadata,
  ClientResponseMetadata,

  // Response types
  ExecuteResponse,
  ConfirmResponse,
  ClarifyResponse,
  ConversationalResponse,
  ErrorResponse,
  FormattedResponse,

  // Streaming types
  ResponseChunk,
  StreamingOptions,
} from "./types";

export {
  // Type guards
  isExecuteResponse,
  isConfirmResponse,
  isClarifyResponse,
  isConversationalResponse,
  isErrorResponse,
  requiresUserAction,

  // Conversion utilities
  llmAssumptionToAssumption,
  convertAssumptions,
  getDecisionType,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Prompt Building
// ─────────────────────────────────────────────────────────────

export {
  // System prompts
  getSystemPromptForDecision,

  // Main prompt builder
  buildResponsePromptFromDecision,

  // Template responses (no LLM)
  buildTemplateResponse,

  // Types
  type ResponsePromptOptions,
  type ToolResultForPrompt,
} from "./prompts";

// ─────────────────────────────────────────────────────────────
// Response Formatting
// ─────────────────────────────────────────────────────────────

export {
  // Core formatting
  formatResponse,
  type FormatOptions,

  // Tool result formatting
  formatToolResult,

  // Result utilities
  extractDisplayHighlights,
  truncateResultStructured,

  // Content utilities
  cleanContent,
  combineContents,

  // Metadata utilities
  getTotalTokens,
  estimateCost,

  // Serialization
  serializeForClient,
  type ClientFormattedResponse,
} from "./formatter";


