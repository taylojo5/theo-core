// ═══════════════════════════════════════════════════════════════════════════
// Agent Engine Constants
// Static constants for the Agent Engine
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Confidence Thresholds (Defaults)
// Note: Per-user overrides are stored in AgentUserConfig (see config/)
// ─────────────────────────────────────────────────────────────

/**
 * Default confidence thresholds for agent decision-making
 * These are used when no per-user override exists
 */
export const CONFIDENCE_THRESHOLDS = {
  /** Below this, ask for clarification before taking action (0-1) */
  ACTION: 0.7,

  /** Below this, present statements as uncertain (0-1) */
  STATEMENT: 0.5,

  /** Below this, don't show the assumption to the user (0-1) */
  ASSUMPTION: 0.3,

  /** Required confidence for high-risk actions (0-1) */
  HIGH_RISK: 0.9,

  /** Threshold for entity resolution (0-1) */
  ENTITY_RESOLUTION: 0.8,
} as const;

// ─────────────────────────────────────────────────────────────
// Tool Categories
// ─────────────────────────────────────────────────────────────

/**
 * Tool categories define the type of operation a tool performs
 * Used for authorization, risk assessment, and UI grouping
 */
export const TOOL_CATEGORIES = {
  /** Read-only queries (search, list, get) */
  QUERY: "query",

  /** Computation or transformation (no side effects) */
  COMPUTE: "compute",

  /** Draft creation (not sent/published) */
  DRAFT: "draft",

  /** Create new entity */
  CREATE: "create",

  /** Modify existing entity */
  UPDATE: "update",

  /** Remove entity */
  DELETE: "delete",

  /** External API call (Gmail, Calendar, Slack) */
  EXTERNAL: "external",
} as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[keyof typeof TOOL_CATEGORIES];

// ─────────────────────────────────────────────────────────────
// Risk Levels
// ─────────────────────────────────────────────────────────────

/**
 * Risk levels for agent actions
 * Higher risk requires higher confidence and may require approval
 */
export const RISK_LEVELS = {
  /** Read-only, no side effects */
  LOW: "low",

  /** Creates/modifies internal data */
  MEDIUM: "medium",

  /** Sends external communication or creates external entities */
  HIGH: "high",

  /** Irreversible or highly sensitive actions */
  CRITICAL: "critical",
} as const;

export type RiskLevel = (typeof RISK_LEVELS)[keyof typeof RISK_LEVELS];

// ─────────────────────────────────────────────────────────────
// Approval Levels
// ─────────────────────────────────────────────────────────────

/**
 * Approval levels for user autonomy settings
 */
export const APPROVAL_LEVELS = {
  /** Execute immediately without user interaction */
  AUTO: "auto",

  /** Execute and notify user afterwards */
  NOTIFY: "notify",

  /** Require explicit user approval before execution */
  CONFIRM: "confirm",

  /** Present draft for user editing before execution */
  REVIEW: "review",
} as const;

export type ApprovalLevel = (typeof APPROVAL_LEVELS)[keyof typeof APPROVAL_LEVELS];

// ─────────────────────────────────────────────────────────────
// Plan Status
// ─────────────────────────────────────────────────────────────

/**
 * Status of a multi-step plan
 */
export const PLAN_STATUS = {
  /** Plan created, not yet started */
  PLANNED: "planned",

  /** Plan is currently executing */
  EXECUTING: "executing",

  /** Plan is paused (waiting for approval or user input) */
  PAUSED: "paused",

  /** Plan completed successfully */
  COMPLETED: "completed",

  /** Plan failed (one or more steps failed) */
  FAILED: "failed",

  /** Plan was cancelled by user */
  CANCELLED: "cancelled",
} as const;

export type PlanStatus = (typeof PLAN_STATUS)[keyof typeof PLAN_STATUS];

// ─────────────────────────────────────────────────────────────
// Plan Step Status
// ─────────────────────────────────────────────────────────────

/**
 * Status of an individual plan step
 */
export const STEP_STATUS = {
  /** Step not yet executed */
  PENDING: "pending",

  /** Step is currently executing */
  EXECUTING: "executing",

  /** Step completed successfully */
  COMPLETED: "completed",

  /** Step failed */
  FAILED: "failed",

  /** Step was skipped (dependency failed or user cancelled) */
  SKIPPED: "skipped",

  /** Step is awaiting user approval */
  AWAITING_APPROVAL: "awaiting_approval",

  /** Step has been rolled back */
  ROLLED_BACK: "rolled_back",
} as const;

export type StepStatus = (typeof STEP_STATUS)[keyof typeof STEP_STATUS];

// ─────────────────────────────────────────────────────────────
// Action Approval Status
// ─────────────────────────────────────────────────────────────

/**
 * Status of an action requiring approval
 */
export const ACTION_APPROVAL_STATUS = {
  /** Waiting for user decision */
  PENDING: "pending",

  /** User approved the action */
  APPROVED: "approved",

  /** User rejected the action */
  REJECTED: "rejected",

  /** Action expired before user decision */
  EXPIRED: "expired",

  /** Action was executed successfully */
  EXECUTED: "executed",

  /** Action execution failed */
  FAILED: "failed",
} as const;

export type ActionApprovalStatus =
  (typeof ACTION_APPROVAL_STATUS)[keyof typeof ACTION_APPROVAL_STATUS];

// ─────────────────────────────────────────────────────────────
// Audit Status
// ─────────────────────────────────────────────────────────────

/**
 * Status of an audit log entry
 */
export const AUDIT_STATUS = {
  /** Action in progress */
  PENDING: "pending",

  /** Action completed successfully */
  COMPLETED: "completed",

  /** Action failed */
  FAILED: "failed",

  /** Action was rolled back */
  ROLLED_BACK: "rolled_back",
} as const;

export type AuditStatus = (typeof AUDIT_STATUS)[keyof typeof AUDIT_STATUS];

// ─────────────────────────────────────────────────────────────
// Intent Categories
// ─────────────────────────────────────────────────────────────

/**
 * High-level categories of user intent
 */
export const INTENT_CATEGORIES = {
  /** Information retrieval queries */
  QUERY: "query",

  /** Calendar/scheduling operations */
  SCHEDULE: "schedule",

  /** Email, Slack, or other communication */
  COMMUNICATE: "communicate",

  /** Task creation or management */
  TASK: "task",

  /** Reminder creation */
  REMIND: "remind",

  /** Summarization requests */
  SUMMARIZE: "summarize",

  /** Search operations */
  SEARCH: "search",

  /** Unclear or unrecognized intent */
  UNKNOWN: "unknown",
} as const;

export type IntentCategory = (typeof INTENT_CATEGORIES)[keyof typeof INTENT_CATEGORIES];

// ─────────────────────────────────────────────────────────────
// Entity Types
// ─────────────────────────────────────────────────────────────

/**
 * Types of entities that can be extracted from user input
 */
export const ENTITY_TYPES = {
  /** Person reference (name, pronoun) */
  PERSON: "person",

  /** Date (today, tomorrow, next Monday) */
  DATE: "date",

  /** Time (2pm, in an hour) */
  TIME: "time",

  /** Combined date and time */
  DATETIME: "datetime",

  /** Duration (30 minutes, 2 hours) */
  DURATION: "duration",

  /** Location or place reference */
  LOCATION: "location",

  /** Place/venue stored in context (office, restaurant, etc.) */
  PLACE: "place",

  /** Calendar event reference */
  EVENT: "event",

  /** Task reference */
  TASK: "task",

  /** Deadline or milestone reference */
  DEADLINE: "deadline",

  /** Email or email thread reference */
  EMAIL: "email",

  /** Routine/habit reference */
  ROUTINE: "routine",

  /** Open loop/follow-up reference */
  OPEN_LOOP: "open_loop",

  /** Project/goal reference */
  PROJECT: "project",

  /** Note/memo reference */
  NOTE: "note",

  /** Relationship reference (e.g., "Sarah's manager") */
  RELATIONSHIP: "relationship",

  /** Unrecognized entity type */
  UNKNOWN: "unknown",
} as const;

export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];

// ─────────────────────────────────────────────────────────────
// Assumption Categories
// ─────────────────────────────────────────────────────────────

/**
 * Categories of assumptions the agent makes
 */
export const ASSUMPTION_CATEGORIES = {
  /** Assumption about user's intent */
  INTENT: "intent",

  /** Assumption based on context (who, what, when) */
  CONTEXT: "context",

  /** Assumption about user preferences */
  PREFERENCE: "preference",

  /** Logical inference from available data */
  INFERENCE: "inference",
} as const;

export type AssumptionCategory =
  (typeof ASSUMPTION_CATEGORIES)[keyof typeof ASSUMPTION_CATEGORIES];

// ─────────────────────────────────────────────────────────────
// Message Roles
// ─────────────────────────────────────────────────────────────

/**
 * Roles in a conversation message
 */
export const MESSAGE_ROLES = {
  /** Message from the user */
  USER: "user",

  /** Message from the assistant (Theo) */
  ASSISTANT: "assistant",

  /** System message (instructions, context) */
  SYSTEM: "system",

  /** Tool execution result */
  TOOL: "tool",
} as const;

export type MessageRole = (typeof MESSAGE_ROLES)[keyof typeof MESSAGE_ROLES];

// ─────────────────────────────────────────────────────────────
// Conversation Status
// ─────────────────────────────────────────────────────────────

/**
 * Status of a conversation
 */
export const CONVERSATION_STATUS = {
  /** Conversation is active */
  ACTIVE: "active",

  /** Conversation is archived */
  ARCHIVED: "archived",

  /** Conversation is deleted (soft delete) */
  DELETED: "deleted",
} as const;

export type ConversationStatus =
  (typeof CONVERSATION_STATUS)[keyof typeof CONVERSATION_STATUS];

// ─────────────────────────────────────────────────────────────
// SSE Event Types
// ─────────────────────────────────────────────────────────────

/**
 * Server-Sent Event types for streaming responses
 */
export const SSE_EVENT_TYPES = {
  /** Agent is thinking/reasoning */
  THINKING: "thinking",

  /** Tool is being called */
  TOOL_CALL: "tool_call",

  /** Tool execution result */
  TOOL_RESULT: "tool_result",

  /** Action requires user approval */
  APPROVAL_NEEDED: "approval_needed",

  /** Response content chunk */
  CONTENT: "content",

  /** Response complete */
  DONE: "done",

  /** Error occurred */
  ERROR: "error",
} as const;

export type SSEEventType = (typeof SSE_EVENT_TYPES)[keyof typeof SSE_EVENT_TYPES];

// ─────────────────────────────────────────────────────────────
// Evidence Sources
// ─────────────────────────────────────────────────────────────

/**
 * Sources of evidence for agent reasoning
 */
export const EVIDENCE_SOURCES = {
  /** Direct user input */
  USER_INPUT: "user_input",

  /** Retrieved context (people, events, etc.) */
  CONTEXT: "context",

  /** Logical inference */
  INFERENCE: "inference",

  /** Conversation history */
  HISTORY: "history",
} as const;

export type EvidenceSource = (typeof EVIDENCE_SOURCES)[keyof typeof EVIDENCE_SOURCES];


