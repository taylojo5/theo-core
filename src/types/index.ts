// ═══════════════════════════════════════════════════════════════════════════
// Theo Type Definitions
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Common Types
// ─────────────────────────────────────────────────────────────

export type EntityType =
  | "person"
  | "place"
  | "event"
  | "task"
  | "deadline"
  | "relationship"
  | "message"
  | "email"
  | "conversation"
  | "gmail_connection"
  | "integration"
  | "email_approval"
  | "calendar"
  | "calendar_approval";

export type SourceType = "manual" | "gmail" | "slack" | "calendar" | "import";

// ─────────────────────────────────────────────────────────────
// Agent Types
// ─────────────────────────────────────────────────────────────

export interface AgentContext {
  userId: string;
  sessionId: string;
  conversationId?: string;
  timestamp: Date;
}

export interface AgentResponse {
  content: string;
  toolCalls?: ToolCall[];
  metadata?: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// Audit Types
// ─────────────────────────────────────────────────────────────

export type ActionCategory = "context" | "integration" | "agent" | "user" | "calendar";

export type ActionType =
  | "query"
  | "create"
  | "update"
  | "delete"
  | "send"
  | "analyze"
  // Calendar action types
  | "calendar_create_requested"
  | "calendar_create_executed"
  | "calendar_update_requested"
  | "calendar_update_executed"
  | "calendar_delete_requested"
  | "calendar_delete_executed"
  | "calendar_respond_requested"
  | "calendar_respond_executed"
  | "calendar_action_approved"
  | "calendar_action_rejected"
  | "calendar_action_cancelled"
  | "calendar_approvals_expired";

export type AuditStatus = "pending" | "completed" | "failed" | "rolled_back";

export interface AuditEntry {
  userId: string;
  sessionId?: string;
  conversationId?: string;
  actionType: ActionType;
  actionCategory: ActionCategory;
  entityType?: EntityType;
  entityId?: string;
  intent?: string;
  reasoning?: string;
  confidence?: number;
  inputSummary?: string;
  outputSummary?: string;
  metadata?: Record<string, unknown>;
  status?: AuditStatus;
  errorMessage?: string;
}

// ─────────────────────────────────────────────────────────────
// Integration Types
// ─────────────────────────────────────────────────────────────

export interface IntegrationConfig {
  provider: string;
  enabled: boolean;
  scopes: string[];
  syncEnabled: boolean;
  syncIntervalMinutes: number;
}

export interface SyncResult {
  success: boolean;
  itemsSynced: number;
  errors: string[];
  nextCursor?: string;
}

// ─────────────────────────────────────────────────────────────
// API Response Types
// ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
