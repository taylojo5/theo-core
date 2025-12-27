// ═══════════════════════════════════════════════════════════════════════════
// LLM Client Types
// Type definitions for the LLM abstraction layer
// ═══════════════════════════════════════════════════════════════════════════

import type { LLMProvider } from "../config/globals";

// ─────────────────────────────────────────────────────────────
// Tool Definition Types (for LLM consumption)
// ─────────────────────────────────────────────────────────────

/**
 * Tool definition for LLM consumption
 * Tools provide this interface so the LLM knows how to use them
 */
export interface ToolForLLM {
  /** Unique tool name (e.g., "create_task", "send_email") */
  name: string;

  /** Human-readable description of what the tool does */
  description: string;

  /** Guidance on when to use this tool */
  whenToUse: string;

  /** Example usage scenarios */
  examples?: string[];

  /** JSON Schema for the tool's parameters */
  parameters: Record<string, unknown>;

  /** Whether this tool requires user approval before execution */
  requiresApproval: boolean;
}

// ─────────────────────────────────────────────────────────────
// Classification Types
// ─────────────────────────────────────────────────────────────

/**
 * Request to classify user intent
 */
export interface ClassificationRequest {
  /** The user's message to classify */
  message: string;

  /** Available tools the LLM can suggest */
  availableTools: ToolForLLM[];

  /** Recent conversation history for context */
  conversationHistory?: LLMMessage[];

  /** User's timezone for date/time parsing */
  timezone?: string;

  /** Current timestamp for relative date parsing */
  currentTime?: Date;
}

/**
 * LLM's classification of user intent
 */
export interface ClassificationResponse {
  /** Analyzed intent */
  intent: {
    /** Primary category (query, action, planning, conversation, unknown) */
    category: string;
    /** Specific action (e.g., "schedule_meeting", "send_email") */
    action?: string;
    /** Brief summary of the intent */
    summary: string;
  };

  /** Extracted entities from the message */
  entities: LLMExtractedEntity[];

  /** Suggested tool to use (if any) */
  suggestedTool?: {
    /** Tool name */
    name: string;
    /** Suggested parameters */
    parameters: Record<string, unknown>;
    /** Confidence in this suggestion (0.0 - 1.0) */
    confidence: number;
    /** Reasoning for this suggestion */
    reasoning: string;
  };

  /** Whether clarification is needed */
  clarificationNeeded?: {
    /** Whether clarification is required */
    required: boolean;
    /** Questions to ask the user */
    questions: string[];
    /** What information is missing */
    missingInfo: string[];
  };

  /** Assumptions made during analysis */
  assumptions: LLMAssumption[];

  /** Overall confidence in the classification (0.0 - 1.0) */
  confidence: number;
}

/**
 * Entity extracted by the LLM
 */
export interface LLMExtractedEntity {
  /** Entity type (person, datetime, location, etc.) */
  type: string;

  /** Original text in the message */
  text: string;

  /** Normalized/parsed value */
  value: unknown;

  /** Whether this entity needs database resolution */
  needsResolution: boolean;
}

/**
 * Assumption made by the LLM
 */
export interface LLMAssumption {
  /** The assumption statement */
  statement: string;

  /** Category of assumption */
  category: "intent" | "context" | "preference" | "inference";

  /** Evidence supporting this assumption */
  evidence: string[];

  /** Confidence in this assumption (0.0 - 1.0) */
  confidence: number;
}

// ─────────────────────────────────────────────────────────────
// Plan Generation Types
// ─────────────────────────────────────────────────────────────

/**
 * Request to generate an execution plan
 */
export interface PlanGenerationRequest {
  /** The goal to achieve */
  goal: string;

  /** Context about the goal */
  goalContext?: string;

  /** Available tools for the plan */
  availableTools: ToolForLLM[];

  /** Recent conversation history */
  conversationHistory?: LLMMessage[];

  /** Previous attempts/failures (for recovery) */
  previousAttempts?: PlanAttempt[];
}

/**
 * Previous plan attempt (for recovery context)
 */
export interface PlanAttempt {
  /** The plan that was tried */
  steps: LLMPlanStep[];

  /** What went wrong */
  failure: {
    stepIndex: number;
    error: string;
  };
}

/**
 * LLM-generated execution plan
 */
export interface LLMGeneratedPlan {
  /** Goal summary */
  goal: string;

  /** Goal type/category */
  goalType: string;

  /** Planned steps */
  steps: LLMPlanStep[];

  /** Whether any step requires approval */
  requiresApproval: boolean;

  /** Overall reasoning for this plan */
  reasoning: string;

  /** Assumptions made during planning */
  assumptions: LLMAssumption[];

  /** Confidence in plan success (0.0 - 1.0) */
  confidence: number;
}

/**
 * A step in an LLM-generated plan
 */
export interface LLMPlanStep {
  /** Step order (0-based) */
  order: number;

  /** Tool to execute */
  toolName: string;

  /** Parameters for the tool */
  parameters: Record<string, unknown>;

  /** Indices of steps this depends on */
  dependsOn: number[];

  /** Description of what this step does */
  description: string;

  /** Whether this step requires approval */
  requiresApproval: boolean;

  /** Rollback action if step fails (optional) */
  rollback?: {
    toolName: string;
    parameters: Record<string, unknown>;
  };
}

// ─────────────────────────────────────────────────────────────
// Response Generation Types
// ─────────────────────────────────────────────────────────────

/**
 * Request to generate a response
 */
export interface ResponseGenerationRequest {
  /** User's original message */
  userMessage: string;

  /** Classification result */
  classification?: ClassificationResponse;

  /** Tool execution results */
  toolResults?: ToolExecutionResult[];

  /** Recent conversation history */
  conversationHistory?: LLMMessage[];

  /** Additional context to include */
  additionalContext?: string;

  /** Response style guidance */
  style?: ResponseStyle;
}

/**
 * Result of tool execution
 */
export interface ToolExecutionResult {
  /** Tool name */
  toolName: string;

  /** Whether execution succeeded */
  success: boolean;

  /** Result data */
  result?: unknown;

  /** Error message (if failed) */
  error?: string;
}

/**
 * Style guidance for response generation
 */
export interface ResponseStyle {
  /** Tone (conversational, professional, brief) */
  tone?: "conversational" | "professional" | "brief";

  /** Whether to include assumptions in response */
  includeAssumptions?: boolean;

  /** Maximum response length (approximate words) */
  maxLength?: number;
}

// ─────────────────────────────────────────────────────────────
// Recovery Types
// ─────────────────────────────────────────────────────────────

/**
 * Request for recovery decision
 */
export interface RecoveryRequest {
  /** Current plan context */
  plan: {
    goal: string;
    steps: LLMPlanStep[];
    currentStepIndex: number;
  };

  /** The failure that occurred */
  failure: {
    stepIndex: number;
    error: string;
    errorType: string;
  };

  /** Number of previous retry attempts */
  retryCount: number;
}

/**
 * LLM's recovery decision
 */
export interface RecoveryAction {
  /** Action to take */
  action: "retry" | "skip" | "abort" | "ask_user" | "rollback";

  /** Reasoning for this decision */
  reasoning: string;

  /** Modified parameters (for retry) */
  modifiedParameters?: Record<string, unknown>;

  /** Message to user (for ask_user) */
  userMessage?: string;

  /** Confidence in this decision (0.0 - 1.0) */
  confidence: number;
}

// ─────────────────────────────────────────────────────────────
// LLM Client Types
// ─────────────────────────────────────────────────────────────

/**
 * Message for LLM conversation context
 */
export interface LLMMessage {
  /** Role of the message sender */
  role: "system" | "user" | "assistant" | "tool";

  /** Message content */
  content: string;

  /** Tool call ID (for tool role messages) */
  toolCallId?: string;

  /** Tool calls made by assistant */
  toolCalls?: LLMToolCall[];
}

/**
 * Tool call made by the LLM
 */
export interface LLMToolCall {
  /** Unique call ID */
  id: string;

  /** Tool name */
  name: string;

  /** Arguments as JSON string */
  arguments: string;
}

/**
 * Options for completion requests
 *
 * Note: For function/tool calling, use the specialized methods (classify, generatePlan)
 * which handle tool context via prompt engineering. The raw complete/streamComplete
 * methods are designed for simple text completions.
 */
export interface CompletionOptions {
  /** Model to use (overrides default) */
  model?: string;

  /** Temperature (0.0 - 2.0) */
  temperature?: number;

  /** Maximum tokens to generate */
  maxTokens?: number;

  /** Response format */
  responseFormat?: "text" | "json";

  /** Stop sequences */
  stop?: string[];

  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * LLM configuration
 */
export interface LLMConfig {
  /** Provider to use */
  provider: LLMProvider;

  /** Model configuration */
  models: {
    /** Fast model for classification */
    fast: string;
    /** Reasoning model for planning */
    reasoning: string;
    /** Conversational model for responses */
    conversational: string;
  };

  /** Default temperature */
  defaultTemperature: number;

  /** Maximum retry attempts */
  maxRetries: number;

  /** Request timeout in milliseconds */
  timeout: number;

  /** API key (optional, uses env var if not provided) */
  apiKey?: string;
}

/**
 * Token usage statistics
 */
export interface TokenUsage {
  /** Tokens in the prompt */
  promptTokens: number;

  /** Tokens in the completion */
  completionTokens: number;

  /** Total tokens used */
  totalTokens: number;
}

/**
 * Result of an LLM completion
 */
export interface CompletionResult {
  /** The generated content */
  content: string;

  /** Token usage */
  usage: TokenUsage;

  /** Model used */
  model: string;

  /** Finish reason */
  finishReason: "stop" | "length" | "tool_calls" | "content_filter";

  /** Tool calls (if any) */
  toolCalls?: LLMToolCall[];
}

/**
 * Streaming chunk from LLM
 */
export interface StreamChunk {
  /** Content delta */
  content?: string;

  /** Whether this is the final chunk */
  done: boolean;

  /** Tool call delta (if streaming tool calls) */
  toolCallDelta?: {
    id?: string;
    name?: string;
    arguments?: string;
  };

  /** Usage stats (only in final chunk) */
  usage?: TokenUsage;
}

// ─────────────────────────────────────────────────────────────
// LLM Client Interface
// ─────────────────────────────────────────────────────────────

/**
 * LLM Client interface
 * Provides abstraction over different LLM providers
 */
export interface LLMClient {
  /**
   * Classify user intent
   * Returns structured classification of the user's message
   */
  classify(request: ClassificationRequest): Promise<ClassificationResponse>;

  /**
   * Generate an execution plan
   * Returns a structured plan for achieving a goal
   */
  generatePlan(request: PlanGenerationRequest): Promise<LLMGeneratedPlan>;

  /**
   * Generate a response (streaming)
   * Yields content chunks as they are generated
   */
  generateResponse(
    request: ResponseGenerationRequest
  ): AsyncGenerator<StreamChunk>;

  /**
   * Decide how to recover from a failure
   * Returns a recovery action
   */
  decideRecovery(request: RecoveryRequest): Promise<RecoveryAction>;

  /**
   * Raw completion (non-streaming)
   * For flexible/custom use cases
   */
  complete(prompt: string, options?: CompletionOptions): Promise<CompletionResult>;

  /**
   * Raw completion (streaming)
   * For flexible/custom use cases
   */
  streamComplete(
    prompt: string,
    options?: CompletionOptions
  ): AsyncGenerator<StreamChunk>;

  /**
   * Get provider name
   */
  getProvider(): LLMProvider;

  /**
   * Get current model for a use case
   */
  getModel(useCase: "fast" | "reasoning" | "conversational"): string;
}

// ─────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────

/**
 * LLM-specific error codes
 */
export type LLMErrorCode =
  | "rate_limit"
  | "timeout"
  | "invalid_response"
  | "content_filter"
  | "model_overloaded"
  | "auth_error"
  | "context_length"
  | "unknown";

/**
 * Error details from LLM provider
 */
export interface LLMErrorDetails {
  /** Error code */
  code: LLMErrorCode;

  /** Error message */
  message: string;

  /** Whether this error is retryable */
  retryable: boolean;

  /** Suggested retry delay in milliseconds */
  retryAfterMs?: number;

  /** Provider-specific error details */
  providerError?: unknown;
}

