// ═══════════════════════════════════════════════════════════════════════════
// Agent Engine Types
// Core type definitions for the Agent Engine
// ═══════════════════════════════════════════════════════════════════════════

import type {
  ToolCategory,
  RiskLevel,
  ApprovalLevel,
  PlanStatus,
  StepStatus,
  ActionApprovalStatus,
  AuditStatus,
  IntentCategory,
  EntityType,
  AssumptionCategory,
  MessageRole,
  ConversationStatus,
  SSEEventType,
  EvidenceSource,
} from "./constants";

// Re-export constant types for convenience
export type {
  ToolCategory,
  RiskLevel,
  ApprovalLevel,
  PlanStatus,
  StepStatus,
  ActionApprovalStatus,
  AuditStatus,
  IntentCategory,
  EntityType,
  AssumptionCategory,
  MessageRole,
  ConversationStatus,
  SSEEventType,
  EvidenceSource,
};

// ─────────────────────────────────────────────────────────────
// Message Types
// ─────────────────────────────────────────────────────────────

/**
 * A message in a conversation
 */
export interface AgentMessage {
  /** Unique message identifier */
  id: string;

  /** Conversation this message belongs to */
  conversationId: string;

  /** Role of the message sender */
  role: MessageRole;

  /** Text content of the message */
  content: string;

  /** Tool calls made by assistant (if any) */
  toolCalls?: ToolCall[];

  /** Tool call ID this message is responding to (for tool role) */
  toolCallId?: string;

  /** Additional metadata */
  metadata?: MessageMetadata;

  /** When the message was created */
  createdAt: Date;
}

/**
 * Metadata attached to a message
 */
export interface MessageMetadata {
  /** Intent analysis result (for user messages) */
  intentAnalysis?: IntentAnalysis;

  /** Model used for this response (for assistant messages) */
  model?: string;

  /** Tokens used for this message */
  tokensUsed?: number;

  /** Processing duration in milliseconds */
  durationMs?: number;

  /** Audit log ID for this message */
  auditLogId?: string;

  /** Plan ID if this message is part of a plan */
  planId?: string;

  /** Additional custom metadata */
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────
// Conversation Types
// ─────────────────────────────────────────────────────────────

/**
 * A conversation with the agent
 */
export interface Conversation {
  /** Unique conversation identifier */
  id: string;

  /** User who owns this conversation */
  userId: string;

  /** Title of the conversation (auto-generated or user-provided) */
  title?: string;

  /** Current status of the conversation */
  status: ConversationStatus;

  /** When the conversation was created */
  createdAt: Date;

  /** When the conversation was last updated */
  updatedAt: Date;

  /** When the last message was sent */
  lastMessageAt?: Date;

  /** Messages in this conversation (when loaded) */
  messages?: AgentMessage[];
}

// ─────────────────────────────────────────────────────────────
// Intent Analysis Types
// ─────────────────────────────────────────────────────────────

/**
 * Result of analyzing user intent from a message
 */
export interface IntentAnalysis {
  /** Primary intent category */
  intent: IntentCategory;

  /** Specific intent (e.g., "schedule_meeting", "send_email") */
  specificIntent?: string;

  /** Confidence score (0.0 - 1.0) */
  confidence: number;

  /** Extracted entities */
  entities: ExtractedEntity[];

  /** Implied but unstated needs */
  impliedNeeds: string[];

  /** Whether clarification is needed */
  clarificationNeeded: boolean;

  /** Suggested clarification questions */
  clarificationQuestions: string[];

  /** Assumptions made during analysis */
  assumptions: Assumption[];
}

/**
 * An entity extracted from user input
 */
export interface ExtractedEntity {
  /** Type of entity */
  type: EntityType;

  /** Original text in the message */
  text: string;

  /** Parsed/normalized value */
  value: unknown;

  /** Confidence in extraction (0.0 - 1.0) */
  confidence: number;

  /** Start position in the original text */
  startIndex?: number;

  /** End position in the original text */
  endIndex?: number;

  /** Resolved entity (if matched to database) */
  resolved?: ResolvedEntity;
}

/**
 * An entity resolved to a database record
 */
export interface ResolvedEntity {
  /** ID of the resolved entity */
  entityId: string;

  /** Type of the resolved entity (table name) */
  entityType: string;

  /** Display name of the entity */
  displayName: string;

  /** Additional metadata about the entity */
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// Assumption Types
// ─────────────────────────────────────────────────────────────

/**
 * An assumption made by the agent during reasoning
 */
export interface Assumption {
  /** Unique identifier for this assumption */
  id?: string;

  /** The assumption statement */
  statement: string;

  /** Category of the assumption */
  category: AssumptionCategory;

  /** Evidence supporting this assumption */
  evidence: Evidence[];

  /** Confidence in this assumption (0.0 - 1.0) */
  confidence: number;

  /** Whether the assumption has been verified by user */
  verified?: boolean;

  /** When the assumption was verified */
  verifiedAt?: Date;

  /** User's correction (if assumption was wrong) */
  correction?: string;
}

/**
 * Evidence supporting an assumption or decision
 */
export interface Evidence {
  /** Source of the evidence */
  source: EvidenceSource;

  /** Content of the evidence */
  content: string;

  /** Weight/importance of this evidence (0.0 - 1.0) */
  weight: number;
}

// ─────────────────────────────────────────────────────────────
// Tool Types
// ─────────────────────────────────────────────────────────────

/**
 * A tool call requested by the LLM
 */
export interface ToolCall {
  /** Unique identifier for this tool call */
  id: string;

  /** Name of the tool being called */
  name: string;

  /** Arguments passed to the tool */
  arguments: Record<string, unknown>;
}

/**
 * Result of executing a tool
 */
export interface ToolResult {
  /** Tool call ID this is responding to */
  toolCallId: string;

  /** Whether the tool execution succeeded */
  success: boolean;

  /** Result data (if successful) */
  result?: unknown;

  /** Error message (if failed) */
  error?: string;

  /** Whether this action requires approval */
  requiresApproval?: boolean;

  /** Approval ID (if awaiting approval) */
  approvalId?: string;

  /** Audit log ID for this execution */
  auditLogId?: string;
}

// ─────────────────────────────────────────────────────────────
// Plan Types
// ─────────────────────────────────────────────────────────────

/**
 * A multi-step execution plan
 */
export interface AgentPlan {
  /** Unique plan identifier */
  id: string;

  /** User who owns this plan */
  userId: string;

  /** Conversation this plan belongs to (if any) */
  conversationId?: string;

  /** The goal this plan is trying to achieve */
  goal: string;

  /** Type/category of the goal */
  goalType: string;

  /** Current status of the plan */
  status: PlanStatus;

  /** Index of the current step (0-based) */
  currentStep: number;

  /** Whether any step requires approval */
  requiresApproval: boolean;

  /** When the plan was approved */
  approvedAt?: Date;

  /** Who approved the plan */
  approvedBy?: string;

  /** Steps in this plan */
  steps: PlanStep[];

  /** When the plan was created */
  createdAt: Date;

  /** When the plan was last updated */
  updatedAt: Date;

  /** When the plan completed */
  completedAt?: Date;
}

/**
 * A single step in an execution plan
 */
export interface PlanStep {
  /** Unique step identifier */
  id: string;

  /** Plan this step belongs to */
  planId: string;

  /** Order of this step (0-based) */
  stepOrder: number;

  /** Tool to execute */
  toolName: string;

  /** Parameters for the tool */
  toolParams: Record<string, unknown>;

  /** IDs of steps this step depends on */
  dependsOn: string[];

  /** Current status of this step */
  status: StepStatus;

  /** Result of execution (if completed) */
  result?: unknown;

  /** Error message (if failed) */
  errorMessage?: string;

  /** Rollback action definition (if reversible) */
  rollbackAction?: {
    toolName: string;
    toolParams: Record<string, unknown>;
  };

  /** When the step was rolled back */
  rolledBackAt?: Date;

  /** When the step was created */
  createdAt: Date;

  /** When the step was executed */
  executedAt?: Date;
}

// ─────────────────────────────────────────────────────────────
// Action Approval Types
// ─────────────────────────────────────────────────────────────

/**
 * An action pending user approval
 */
export interface ActionApproval {
  /** Unique approval identifier */
  id: string;

  /** User who needs to approve */
  userId: string;

  /** Plan this action belongs to (if any) */
  planId?: string;

  /** Step index in the plan (if any) */
  stepIndex?: number;

  /** Conversation context (if any) */
  conversationId?: string;

  /** Type of action */
  actionType: string;

  /** Tool name */
  toolName: string;

  /** Tool parameters */
  parameters: Record<string, unknown>;

  /** Current approval status */
  status: ActionApprovalStatus;

  /** Risk level of this action */
  riskLevel: RiskLevel;

  /** Agent's reasoning for proposing this action */
  reasoning: string;

  /** When the approval was requested */
  requestedAt: Date;

  /** When the approval expires */
  expiresAt?: Date;

  /** When the user made a decision */
  decidedAt?: Date;

  /** Result of execution (if executed) */
  result?: unknown;

  /** Error message (if failed) */
  errorMessage?: string;
}

// ─────────────────────────────────────────────────────────────
// Audit Types
// ─────────────────────────────────────────────────────────────

/**
 * An entry in the audit log
 */
export interface AuditEntry {
  /** Unique audit entry identifier */
  id: string;

  /** User who performed the action */
  userId: string;

  /** Session ID (if available) */
  sessionId?: string;

  /** Conversation ID (if applicable) */
  conversationId?: string;

  /** Type of action performed */
  actionType: string;

  /** Category of the action (tool category) */
  actionCategory: string;

  /** Agent's understanding of the user's intent */
  intent?: string;

  /** Agent's reasoning for this action */
  reasoning?: string;

  /** Confidence level for this action */
  confidence?: number;

  /** Type of entity affected (if any) */
  entityType?: string;

  /** ID of entity affected (if any) */
  entityId?: string;

  /** Entity state before the action */
  entityBefore?: unknown;

  /** Entity state after the action */
  entityAfter?: unknown;

  /** Input to the action */
  input?: unknown;

  /** Output from the action */
  output?: unknown;

  /** Status of the action */
  status: AuditStatus;

  /** Error message (if failed) */
  errorMessage?: string;

  /** Duration of the action in milliseconds */
  durationMs?: number;

  /** LLM model used (if applicable) */
  modelUsed?: string;

  /** Tokens consumed (if applicable) */
  tokensUsed?: number;

  /** When the action was performed */
  createdAt: Date;

  /** Assumptions made during this action */
  assumptions?: Assumption[];
}

// ─────────────────────────────────────────────────────────────
// SSE Streaming Types
// ─────────────────────────────────────────────────────────────

/**
 * Base SSE event
 */
export interface SSEEventBase {
  /** Type of event */
  type: SSEEventType;
}

/**
 * Thinking event - agent is reasoning
 */
export interface ThinkingEvent extends SSEEventBase {
  type: "thinking";
  /** Description of current reasoning step */
  step: string;
}

/**
 * Tool call event - agent is calling a tool
 */
export interface ToolCallEvent extends SSEEventBase {
  type: "tool_call";
  /** Tool name */
  tool: string;
  /** Tool parameters */
  params: Record<string, unknown>;
}

/**
 * Tool result event - tool execution completed
 */
export interface ToolResultEvent extends SSEEventBase {
  type: "tool_result";
  /** Tool name */
  tool: string;
  /** Execution result */
  result: unknown;
  /** Whether execution succeeded */
  success: boolean;
}

/**
 * Approval needed event - action requires user approval
 */
export interface ApprovalNeededEvent extends SSEEventBase {
  type: "approval_needed";
  /** Approval ID */
  actionId: string;
  /** Action details */
  details: {
    toolName: string;
    parameters: Record<string, unknown>;
    reasoning: string;
    riskLevel: RiskLevel;
  };
}

/**
 * Content event - response text chunk
 */
export interface ContentEvent extends SSEEventBase {
  type: "content";
  /** Text chunk */
  delta: string;
}

/**
 * Done event - response complete
 */
export interface DoneEvent extends SSEEventBase {
  type: "done";
  /** Message ID */
  messageId: string;
}

/**
 * Error event - error occurred
 */
export interface ErrorEvent extends SSEEventBase {
  type: "error";
  /** Error message */
  message: string;
  /** Error code (if applicable) */
  code?: string;
}

/**
 * Union of all SSE event types
 */
export type SSEEvent =
  | ThinkingEvent
  | ToolCallEvent
  | ToolResultEvent
  | ApprovalNeededEvent
  | ContentEvent
  | DoneEvent
  | ErrorEvent;

// ─────────────────────────────────────────────────────────────
// Context Types
// ─────────────────────────────────────────────────────────────

/**
 * Context for processing a message
 */
export interface MessageContext {
  /** User ID */
  userId: string;

  /** Conversation ID (if continuing a conversation) */
  conversationId?: string;

  /** Session ID */
  sessionId?: string;

  /** Recent conversation history */
  history?: AgentMessage[];

  /** Timezone for the user */
  timezone?: string;

  /** Current datetime (for relative date parsing) */
  currentTime?: Date;
}

/**
 * Execution context for tool calls
 */
export interface ExecutionContext {
  /** User ID */
  userId: string;

  /** Session ID */
  sessionId?: string;

  /** Conversation ID */
  conversationId?: string;

  /** Plan ID (if executing as part of a plan) */
  planId?: string;

  /** Step index (if executing as part of a plan) */
  stepIndex?: number;

  /** Access token for external APIs (if needed) */
  accessToken?: string;
}

// ─────────────────────────────────────────────────────────────
// Hypothesis Types
// ─────────────────────────────────────────────────────────────

/**
 * A hypothesis about what the user wants
 */
export interface Hypothesis {
  /** Unique hypothesis identifier */
  id: string;

  /** The hypothesis statement */
  statement: string;

  /** Confidence in this hypothesis (0.0 - 1.0) */
  confidence: number;

  /** Evidence supporting this hypothesis */
  supportingEvidence: Evidence[];

  /** Evidence contradicting this hypothesis */
  contradictingEvidence: Evidence[];

  /** Suggested actions if this hypothesis is correct */
  suggestedActions: SuggestedAction[];
}

/**
 * A suggested action based on a hypothesis
 */
export interface SuggestedAction {
  /** Tool to use */
  toolName: string;

  /** Parameters for the tool */
  parameters: Record<string, unknown>;

  /** Confidence in this suggestion */
  confidence: number;

  /** Risk level of this action */
  riskLevel: RiskLevel;
}

// ─────────────────────────────────────────────────────────────
// Response Types
// ─────────────────────────────────────────────────────────────

/**
 * Agent response to a user message
 */
export interface AgentResponse {
  /** Response content */
  content: string;

  /** Confidence in this response */
  confidence: number;

  /** Whether clarification is needed */
  clarificationNeeded: boolean;

  /** Clarification questions (if needed) */
  clarifications?: string[];

  /** Assumptions made in this response */
  assumptions: Assumption[];

  /** Suggested actions for the user */
  suggestedActions?: ActionSuggestion[];

  /** Response metadata */
  metadata: ResponseMetadata;
}

/**
 * An action suggestion for the user
 */
export interface ActionSuggestion {
  /** Description of the action */
  description: string;

  /** Tool that would be used */
  toolName: string;

  /** Parameters for the tool */
  parameters: Record<string, unknown>;

  /** Whether this requires approval */
  requiresApproval: boolean;
}

/**
 * Metadata about a response
 */
export interface ResponseMetadata {
  /** Model used */
  model?: string;

  /** Tokens used for input */
  inputTokens?: number;

  /** Tokens used for output */
  outputTokens?: number;

  /** Processing duration in milliseconds */
  durationMs?: number;

  /** Intent analysis result */
  intentAnalysis?: IntentAnalysis;

  /** Audit log ID */
  auditLogId?: string;
}


