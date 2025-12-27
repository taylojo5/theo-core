// ═══════════════════════════════════════════════════════════════════════════
// Agent Engine Module
// The intelligent brain of Theo - context-aware, action-capable assistance
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

export {
  // Confidence thresholds
  CONFIDENCE_THRESHOLDS,

  // Tool categories
  TOOL_CATEGORIES,
  type ToolCategory,

  // Risk levels
  RISK_LEVELS,
  type RiskLevel,

  // Approval levels
  APPROVAL_LEVELS,
  type ApprovalLevel,

  // Plan status
  PLAN_STATUS,
  type PlanStatus,

  // Step status
  STEP_STATUS,
  type StepStatus,

  // Action approval status
  ACTION_APPROVAL_STATUS,
  type ActionApprovalStatus,

  // Audit status
  AUDIT_STATUS,
  type AuditStatus,

  // Intent categories
  INTENT_CATEGORIES,
  type IntentCategory,

  // Entity types
  ENTITY_TYPES,
  type EntityType,

  // Assumption categories
  ASSUMPTION_CATEGORIES,
  type AssumptionCategory,

  // Message roles
  MESSAGE_ROLES,
  type MessageRole,

  // Conversation status
  CONVERSATION_STATUS,
  type ConversationStatus,

  // SSE event types
  SSE_EVENT_TYPES,
  type SSEEventType,

  // Evidence sources
  EVIDENCE_SOURCES,
  type EvidenceSource,
} from "./constants";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Message types
  AgentMessage,
  MessageMetadata,
  Conversation,

  // Intent types
  IntentAnalysis,
  ExtractedEntity,
  ResolvedEntity,

  // Assumption types
  Assumption,
  Evidence,

  // Tool types
  ToolCall,
  ToolResult,

  // Plan types
  AgentPlan,
  PlanStep,

  // Approval types
  ActionApproval,

  // Audit types
  AuditEntry,

  // SSE types
  SSEEvent,
  SSEEventBase,
  ThinkingEvent,
  ToolCallEvent,
  ToolResultEvent,
  ApprovalNeededEvent,
  ContentEvent,
  DoneEvent,
  ErrorEvent,

  // Context types
  MessageContext,
  ExecutionContext,

  // Hypothesis types
  Hypothesis,
  SuggestedAction,

  // Response types
  AgentResponse,
  ActionSuggestion,
  ResponseMetadata,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────

export {
  // Error codes
  AgentErrorCode,

  // Base error
  AgentError,

  // Specific errors
  IntentUnclearError,
  ContextMissingError,
  ToolNotAvailableError,
  ApprovalTimeoutError,
  ToolExecutionFailedError,
  PlanFailedError,
  RateLimitExceededError,
  InvalidParametersError,
  LLMError,
  ContentBlockedError,
  EntityResolutionError,

  // Error utilities
  isAgentError,
  isRetryableError,
  needsClarification,
  needsIntegration,
  wrapError,
} from "./errors";

// ─────────────────────────────────────────────────────────────
// Loggers
// ─────────────────────────────────────────────────────────────

export {
  // Main logger
  agentLogger,

  // Child loggers
  intentLogger,
  planLogger,
  toolLogger,
  auditLogger,
  contextLogger,
  llmLogger,
  approvalLogger,
  entityLogger,
  reasoningLogger,
  responseLogger,
  executionLogger,
  streamLogger,
} from "./logger";

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

export {
  // Config types
  type AgentRateLimits,
  type TokenLimits,
  type ContentFilterConfig,
  type AgentFeatureFlags,
  type ConfidenceThresholds,
  type EffectiveAgentConfig,
  type PartialAgentConfig,

  // Repository
  agentConfigRepository,
  type AgentConfigUpdateInput,
  type RepositoryResult,

  // Service
  agentConfigService,
  getDefaultRateLimits,
  getDefaultTokenLimits,
  getDefaultContentFilterConfig,
  getDefaultFeatureFlags,
  getDefaultConfidenceThresholds,
  getDefaultAgentConfig,

  // Global configs
  type LLMProvider,
  type LLMModelConfig,
  getLLMModel,
  getLLMProvider,
  DEFAULT_LLM_MODELS,
  TIMING_CONFIG,
  REQUIRED_ENV_VARS,
  OPTIONAL_ENV_VARS,
  validateAgentConfig,
  getAgentConfigSummary,
} from "./config";

// ─────────────────────────────────────────────────────────────
// Safety
// ─────────────────────────────────────────────────────────────

export {
  // Content filtering
  sanitizeInput,
  filterOutput,
  isContentSafe,

  // Detection
  detectPromptInjection,
  detectHarmfulContent,

  // Utilities
  estimateTokenCount,
  truncateToTokenLimit,

  // Types
  type ContentFilterResult,
  type ContentFilterOptions,
} from "./safety";

// ─────────────────────────────────────────────────────────────
// Audit Trail
// ─────────────────────────────────────────────────────────────

export {
  // Service
  auditService,
  logAgentAction,
  startAuditAction,
  completeAuditAction,
  failAuditAction,
  withAuditTrail,
  queryAuditLog,
  getAuditEntry,
  getEntityAuditTrail,
  getRecentActions,
  getConversationAuditTrail,
  queryAssumptions,
  getAssumptionsForAction,
  getUnverifiedAssumptions,
  verifyAssumption,
  getAuditStats,

  // Repository
  auditLogRepository,
  assumptionRepository,

  // Types
  type AuditLogCreateInput,
  type AuditLogUpdateInput,
  type AuditLogWithAssumptions,
  type AssumptionCreateInput,
  type AssumptionVerifyInput,
  type AssumptionRecord,
  type AuditQueryOptions,
  type AssumptionQueryOptions,
  type AuditQueryResult,
  type AssumptionQueryResult,
  type AuditActionInput,
  type AuditStats,
  type AuditedAction,
} from "./audit";

// ─────────────────────────────────────────────────────────────
// LLM Client
// ─────────────────────────────────────────────────────────────

export {
  // Types
  type ToolForLLM,
  type ClassificationRequest,
  type ClassificationResponse,
  type LLMExtractedEntity,
  type LLMAssumption,
  type PlanGenerationRequest,
  type PlanAttempt,
  type LLMGeneratedPlan,
  type LLMPlanStep,
  type ResponseGenerationRequest,
  type ToolExecutionResult,
  type ResponseStyle,
  type RecoveryRequest,
  type RecoveryAction,
  type LLMMessage,
  type LLMToolCall,
  type CompletionOptions,
  type LLMConfig,
  type TokenUsage,
  type CompletionResult,
  type StreamChunk,
  type LLMClient,
  type LLMErrorCode,
  type LLMErrorDetails,

  // Client factory
  createLLMClient,
  getDefaultLLMConfig,
  getDefaultLLMClient,
  resetDefaultLLMClient,
  setDefaultLLMClient,
  isProviderAvailable,
  getAvailableProviders,
  getBestAvailableProvider,

  // Providers
  createOpenAIClient,
  createAnthropicClient,

  // Prompts
  buildClassificationPrompt,
  getClassificationSystemPrompt,
  parseClassificationResponse,
  buildPlanGenerationPrompt,
  getPlanGenerationSystemPrompt,
  parsePlanGenerationResponse,
  buildResponsePrompt,
  getResponseSystemPrompt,
  buildErrorResponsePrompt,
  buildClarificationPrompt,
  determineResponseStyle,
  buildRecoveryPrompt,
  getRecoverySystemPrompt,
  parseRecoveryResponse,
  isTransientError,
  getSuggestedRecoveryAction,

  // Retry logic
  DEFAULT_RETRY_CONFIG,
  type RetryConfig,
  type RetryResult,
  type RetryProgressCallback,
  calculateRetryDelay,
  isRetryableError as isRetryableLLMError,
  withRetry,
  extractErrorDetails,
  createTimeoutError,
  withTimeout,
} from "./llm";

// ─────────────────────────────────────────────────────────────
// Tools
// ─────────────────────────────────────────────────────────────

export {
  // Types
  type ToolDefinition,
  type AnyToolDefinition,
  type ToolFilterOptions,
  type UserToolsOptions,
  type JSONSchema,
  type JSONSchemaProperty,
  type ValidationResult,
  type ValidationError,
  type ToolExecutionResult as ToolExecResult,
  type ExtendedExecutionContext,
  type CreateContextOptions,
  type ToolRegistrySummary,

  // Type utilities
  toToolForLLM,
  isToolAvailable,
  defineTool,
  objectSchema,

  // Registry
  ToolRegistry,
  toolRegistry,

  // Validation
  validateToolParams,
  validateWithSchema,
  formatZodErrors,
  formatErrorsForLLM,
  formatValidationError,
  commonSchemas,
  paginatedQuerySchema,
  dateRangeSchema,

  // Context
  createExecutionContext,
  createExtendedContext,
  createSystemContext,
  withPlanContext,
  withConversationContext,
  withSessionContext,
  isValidContext,
  hasPlanContext,
  hasConversationContext,
  createTokenProvider,
} from "./tools";

// ─────────────────────────────────────────────────────────────
// Execution Engine
// ─────────────────────────────────────────────────────────────

export {
  // Execution
  executeToolCall,
  validateParameters,
  checkIntegrations,

  // Approval management
  createPendingApproval,
  getPendingApproval,
  listPendingApprovals,
  updateApprovalStatus,
  expireApprovals,
  getDefaultExpirationMs,

  // Result formatting
  formatExecutionResult,
  formatErrorResult,
  extractResultHighlights,
  truncateResultForDisplay,

  // Type guards
  isSuccessfulExecution,
  isFailedExecution,
  isPendingApproval,
  isValidationError,
  isIntegrationError,

  // Types
  type ToolExecutionRequest,
  type ExecutionDecision,
  type ExecutionOutcome,
  type ToolExecutionSuccess,
  type ToolExecutionFailure,
  type PendingApprovalResult,
  type ApprovalSummary,
  type ExecutionErrorCode,
  type ToolExecutionError,
  type ErrorDetails,
  type ValidationErrorDetails,
  type IntegrationErrorDetails,
  type ExecutionErrorDetails,
  type FieldValidationError,
  type IntegrationCheckResult,
  type ParameterValidationResult,
  type FormattedExecutionResult,
  type ResultMetadata,
  type ApprovalCreationInput,
  type ApprovalCreationResult,
} from "./execution";
