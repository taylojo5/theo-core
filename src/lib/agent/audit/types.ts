// ═══════════════════════════════════════════════════════════════════════════
// Agent Audit Types
// Type definitions for the audit trail system
// ═══════════════════════════════════════════════════════════════════════════

import type { AuditStatus, AssumptionCategory, EvidenceSource } from "../constants";
import type { Evidence } from "../types";

// ─────────────────────────────────────────────────────────────
// Audit Log Types
// ─────────────────────────────────────────────────────────────

/**
 * Input for creating a new audit log entry
 */
export interface AuditLogCreateInput {
  /** User performing the action */
  userId: string;

  /** Session ID (if available) */
  sessionId?: string;

  /** Conversation ID (if part of a conversation) */
  conversationId?: string;

  /** Type of action (query, create, update, delete, send, analyze) */
  actionType: string;

  /** Category of action (context, integration, agent, user, calendar) */
  actionCategory: string;

  /** Type of entity affected (if any) */
  entityType?: string;

  /** ID of entity affected (if any) */
  entityId?: string;

  /** Snapshot of entity state (for changes) */
  entitySnapshot?: Record<string, unknown>;

  /** Agent's understanding of user intent */
  intent?: string;

  /** Agent's reasoning for this action */
  reasoning?: string;

  /** Confidence in this action (0.0 - 1.0) */
  confidence?: number;

  /** Summary of input to the action */
  inputSummary?: string;

  /** Summary of output from the action */
  outputSummary?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;

  /** Status of the action */
  status?: AuditStatus;

  /** Error message (if failed) */
  errorMessage?: string;

  /** When the action started */
  startedAt?: Date;
}

/**
 * Input for updating an existing audit log entry
 */
export interface AuditLogUpdateInput {
  /** Updated status */
  status?: AuditStatus;

  /** Agent's reasoning */
  reasoning?: string;

  /** Confidence score */
  confidence?: number;

  /** Output summary */
  outputSummary?: string;

  /** Error message */
  errorMessage?: string;

  /** Entity snapshot after changes */
  entitySnapshot?: Record<string, unknown>;

  /** When the action completed */
  completedAt?: Date;

  /** Duration in milliseconds */
  durationMs?: number;
}

/**
 * Audit log entry with assumptions included
 */
export interface AuditLogWithAssumptions {
  id: string;
  userId: string;
  sessionId: string | null;
  conversationId: string | null;
  actionType: string;
  actionCategory: string;
  entityType: string | null;
  entityId: string | null;
  entitySnapshot: unknown;
  intent: string | null;
  reasoning: string | null;
  confidence: number | null;
  inputSummary: string | null;
  outputSummary: string | null;
  metadata: unknown;
  status: string;
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  createdAt: Date;
  assumptions: AssumptionRecord[];
}

// ─────────────────────────────────────────────────────────────
// Assumption Types
// ─────────────────────────────────────────────────────────────

/**
 * Input for creating a new assumption
 */
export interface AssumptionCreateInput {
  /** Audit log entry this assumption belongs to */
  auditLogId: string;

  /** The assumption statement */
  assumption: string;

  /** Category of the assumption */
  category: AssumptionCategory;

  /** Evidence supporting this assumption */
  evidence: Evidence[];

  /** Confidence in this assumption (0.0 - 1.0) */
  confidence: number;
}

/**
 * Input for verifying an assumption
 */
export interface AssumptionVerifyInput {
  /** Whether the assumption was verified as correct */
  verified: boolean;

  /** Who/what verified the assumption */
  verifiedBy: "user" | "system" | "feedback";

  /** Correction if the assumption was wrong */
  correction?: string;
}

/**
 * Assumption record from database
 */
export interface AssumptionRecord {
  id: string;
  auditLogId: string;
  assumption: string;
  category: string;
  evidence: unknown;
  confidence: number;
  verified: boolean | null;
  verifiedAt: Date | null;
  verifiedBy: string | null;
  correction: string | null;
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────
// Query Options
// ─────────────────────────────────────────────────────────────

/**
 * Options for querying audit log entries
 */
export interface AuditQueryOptions {
  /** User ID (required for security) */
  userId: string;

  /** Session ID to filter by */
  sessionId?: string;

  /** Conversation ID to filter by */
  conversationId?: string;

  /** Action types to include */
  actionTypes?: string[];

  /** Action categories to include */
  actionCategories?: string[];

  /** Entity type to filter by */
  entityType?: string;

  /** Entity ID to filter by */
  entityId?: string;

  /** Status to filter by */
  status?: AuditStatus | AuditStatus[];

  /** Date range filter */
  dateRange?: {
    start: Date;
    end: Date;
  };

  /** Maximum number of results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;

  /** Include assumptions in results */
  includeAssumptions?: boolean;

  /** Sort order */
  orderBy?: "asc" | "desc";
}

/**
 * Options for querying assumptions
 */
export interface AssumptionQueryOptions {
  /** Audit log ID to filter by */
  auditLogId?: string;

  /** User ID (required for security) */
  userId: string;

  /** Category to filter by */
  category?: AssumptionCategory;

  /** Only unverified assumptions */
  unverifiedOnly?: boolean;

  /** Maximum number of results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

// ─────────────────────────────────────────────────────────────
// Result Types
// ─────────────────────────────────────────────────────────────

/**
 * Result of an audit query
 */
export interface AuditQueryResult {
  /** Audit log entries */
  entries: AuditLogWithAssumptions[];

  /** Total count (for pagination) */
  totalCount: number;

  /** Whether there are more results */
  hasMore: boolean;
}

/**
 * Result of an assumption query
 */
export interface AssumptionQueryResult {
  /** Assumptions */
  assumptions: AssumptionRecord[];

  /** Total count */
  totalCount: number;

  /** Whether there are more results */
  hasMore: boolean;
}

// ─────────────────────────────────────────────────────────────
// Service Types
// ─────────────────────────────────────────────────────────────

/**
 * Combined input for creating an audit entry with assumptions
 */
export interface AuditActionInput extends AuditLogCreateInput {
  /** Assumptions made during this action */
  assumptions?: Omit<AssumptionCreateInput, "auditLogId">[];
}

/**
 * Statistics about the audit log
 */
export interface AuditStats {
  /** Total entries for the user */
  totalEntries: number;

  /** Entries by action type */
  byActionType: Record<string, number>;

  /** Entries by status */
  byStatus: Record<string, number>;

  /** Total assumptions */
  totalAssumptions: number;

  /** Unverified assumptions */
  unverifiedAssumptions: number;

  /** Verification rate (verified/total) */
  verificationRate: number;
}

/**
 * Represents a complete action with audit trail
 */
export interface AuditedAction<T = unknown> {
  /** The audit log entry ID */
  auditLogId: string;

  /** The result of the action */
  result: T;

  /** Duration in milliseconds */
  durationMs: number;
}

