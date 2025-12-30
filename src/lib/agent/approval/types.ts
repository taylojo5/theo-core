// ═══════════════════════════════════════════════════════════════════════════
// Agent Approval Types
// Type definitions for the action approval system
// ═══════════════════════════════════════════════════════════════════════════

import type { RiskLevel, ActionApprovalStatus, AssumptionCategory } from "../constants";
import type { LLMAssumption } from "../llm/types";

// ─────────────────────────────────────────────────────────────
// Approval Status Types
// ─────────────────────────────────────────────────────────────

/**
 * Approval status values
 * Re-exported from constants for convenience
 */
export type ApprovalStatus = ActionApprovalStatus;

/**
 * Resolution source for approval decisions
 */
export type ApprovalResolver = "user" | "timeout" | "system" | "superseded";

// ─────────────────────────────────────────────────────────────
// Core Approval Types
// ─────────────────────────────────────────────────────────────

/**
 * Full action approval record with LLM context
 *
 * This is the domain model for approvals - it includes all the
 * LLM reasoning so users understand WHY the agent wants to take
 * this action.
 */
export interface AgentActionApproval {
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

  // ─────────────────────────────────────────────────────────────
  // Action Details (from LLM)
  // ─────────────────────────────────────────────────────────────

  /** Type of action (create, update, delete, send, etc.) */
  actionType: string;

  /** Tool name to execute */
  toolName: string;

  /** Original parameters proposed by LLM */
  parameters: Record<string, unknown>;

  // ─────────────────────────────────────────────────────────────
  // LLM Context (preserved for user review)
  // ─────────────────────────────────────────────────────────────

  /** LLM's reasoning for this action */
  reasoning: string;

  /** LLM's confidence score (0.0 - 1.0) */
  confidence: number;

  /** Assumptions made during decision */
  assumptions: LLMAssumption[];

  /** Human-readable action summary */
  summary: string;

  /** Risk level assessment */
  riskLevel: RiskLevel;

  // ─────────────────────────────────────────────────────────────
  // Workflow State
  // ─────────────────────────────────────────────────────────────

  /** Current approval status */
  status: ApprovalStatus;

  /** When the approval was requested */
  requestedAt: Date;

  /** When the approval expires */
  expiresAt?: Date;

  /** When the user made a decision */
  decidedAt?: Date;

  /** Who/what resolved the approval */
  resolvedBy?: ApprovalResolver;

  // ─────────────────────────────────────────────────────────────
  // User Modifications
  // ─────────────────────────────────────────────────────────────

  /** User's feedback (especially on rejection) */
  userFeedback?: string;

  /** Parameters modified by user before approval */
  modifiedParameters?: Record<string, unknown>;

  // ─────────────────────────────────────────────────────────────
  // Execution Result
  // ─────────────────────────────────────────────────────────────

  /** Result after execution (if executed) */
  result?: unknown;

  /** Error message (if failed) */
  errorMessage?: string;

  // ─────────────────────────────────────────────────────────────
  // Audit Linkage
  // ─────────────────────────────────────────────────────────────

  /** Associated audit log ID */
  auditLogId?: string;

  /** When the approval was created */
  createdAt: Date;

  /** When the approval was last updated */
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────
// Create/Update Types
// ─────────────────────────────────────────────────────────────

/**
 * Input for creating a new approval record
 */
export interface ApprovalCreateInput {
  /** User ID */
  userId: string;

  /** Tool name */
  toolName: string;

  /** Tool parameters */
  parameters: Record<string, unknown>;

  /** Action type (from tool category) */
  actionType: string;

  /** Risk level */
  riskLevel: RiskLevel;

  /** LLM's reasoning for this action */
  reasoning: string;

  /** LLM's confidence (0.0 - 1.0) */
  confidence: number;

  /** Assumptions made during decision */
  assumptions?: LLMAssumption[];

  /** Human-readable summary */
  summary?: string;

  /** Conversation context (if any) */
  conversationId?: string;

  /** Plan context (if any) */
  planId?: string;

  /** Step index (if executing as part of a plan) */
  stepIndex?: number;

  /** Custom expiration duration in milliseconds */
  expiresInMs?: number;
}

/**
 * Input for updating an existing approval
 */
export interface ApprovalUpdateInput {
  /** Updated status */
  status?: ApprovalStatus;

  /** When decided */
  decidedAt?: Date;

  /** Who resolved */
  resolvedBy?: ApprovalResolver;

  /** User feedback */
  userFeedback?: string;

  /** Modified parameters */
  modifiedParameters?: Record<string, unknown>;

  /** Execution result */
  result?: unknown;

  /** Error message */
  errorMessage?: string;
}

// ─────────────────────────────────────────────────────────────
// Query Types
// ─────────────────────────────────────────────────────────────

/**
 * Options for querying approvals
 */
export interface ApprovalQueryOptions {
  /** Filter by status */
  status?: ApprovalStatus | ApprovalStatus[];

  /** Filter by conversation */
  conversationId?: string;

  /** Filter by plan */
  planId?: string;

  /** Include expired approvals */
  includeExpired?: boolean;

  /** Maximum results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;

  /** Sort order */
  orderBy?: "asc" | "desc";
}

/**
 * Result of a paginated approval query
 */
export interface ApprovalQueryResult {
  /** Approval records */
  approvals: AgentActionApproval[];

  /** Total count (for pagination) */
  totalCount: number;

  /** Whether there are more results */
  hasMore: boolean;
}

// ─────────────────────────────────────────────────────────────
// Decision Types
// ─────────────────────────────────────────────────────────────

/**
 * User's decision on an approval
 */
export type ApprovalDecision = "approve" | "reject";

/**
 * Options when approving an action
 */
export interface ApproveOptions {
  /** Modified parameters (user can edit before approving) */
  modifiedParameters?: Record<string, unknown>;
}

/**
 * Options when rejecting an action
 */
export interface RejectOptions {
  /** Reason for rejection (fed back to improve future decisions) */
  feedback?: string;
}

/**
 * Result of processing an approval decision
 */
export interface ApprovalDecisionResult {
  /** The updated approval record */
  approval: AgentActionApproval;

  /** Whether the action should be executed */
  shouldExecute: boolean;

  /** Parameters to use for execution (may be modified) */
  effectiveParameters?: Record<string, unknown>;

  /** Plan resumption info (if part of a plan) */
  planResumption?: {
    planId: string;
    stepIndex: number;
  };
}

// ─────────────────────────────────────────────────────────────
// Display Types
// ─────────────────────────────────────────────────────────────

/**
 * Approval data formatted for UI display
 */
export interface ApprovalDisplayData {
  /** Approval ID */
  id: string;

  /** Tool name */
  toolName: string;

  /** Human-readable summary */
  summary: string;

  /** LLM's reasoning */
  reasoning: string;

  /** Confidence level (formatted as percentage) */
  confidencePercent: number;

  /** Risk level */
  riskLevel: RiskLevel;

  /** Assumptions for review */
  assumptions: ApprovalAssumptionDisplay[];

  /** Parameters (sanitized for display) */
  parameters: Record<string, unknown>;

  /** Parameter schema for editing (if available) */
  parameterSchema?: Record<string, unknown>;

  /** When it expires (relative time) */
  expiresIn?: string;

  /** Whether it's urgent (expiring soon) */
  isUrgent: boolean;

  /** Plan context */
  planContext?: {
    planId: string;
    goalSummary: string;
    stepNumber: number;
    totalSteps: number;
  };
}

/**
 * Assumption formatted for display
 */
export interface ApprovalAssumptionDisplay {
  /** The assumption statement */
  statement: string;

  /** Category label */
  category: AssumptionCategory;

  /** Confidence as percentage */
  confidencePercent: number;

  /** Brief evidence summary */
  evidenceSummary: string;
}

// ─────────────────────────────────────────────────────────────
// Expiration Types
// ─────────────────────────────────────────────────────────────

/**
 * Default expiration times by risk level (in milliseconds)
 */
export const DEFAULT_EXPIRATION_MS: Record<RiskLevel, number> = {
  low: 24 * 60 * 60 * 1000, // 24 hours
  medium: 12 * 60 * 60 * 1000, // 12 hours
  high: 4 * 60 * 60 * 1000, // 4 hours
  critical: 1 * 60 * 60 * 1000, // 1 hour
};

/**
 * Result of expiring stale approvals
 */
export interface ExpirationResult {
  /** Number of approvals expired */
  expiredCount: number;

  /** IDs of expired approvals */
  expiredIds: string[];

  /** Plans that need attention due to expired approvals */
  affectedPlanIds: string[];
}

/**
 * Options for the expiration job
 */
export interface ExpirationOptions {
  /** Notify users of expired approvals */
  notifyUsers?: boolean;

  /** Cancel affected plans */
  cancelAffectedPlans?: boolean;

  /** Batch size for processing */
  batchSize?: number;
}

// ─────────────────────────────────────────────────────────────
// Type Guards
// ─────────────────────────────────────────────────────────────

/**
 * Check if an approval is pending
 */
export function isPendingApproval(approval: AgentActionApproval): boolean {
  return approval.status === "pending";
}

/**
 * Check if an approval has expired
 */
export function isExpiredApproval(approval: AgentActionApproval): boolean {
  if (!approval.expiresAt) return false;
  return new Date() > approval.expiresAt;
}

/**
 * Check if an approval is awaiting action (pending and not expired)
 */
export function isActionableApproval(approval: AgentActionApproval): boolean {
  return isPendingApproval(approval) && !isExpiredApproval(approval);
}

/**
 * Check if an approval was modified by the user
 */
export function hasUserModifications(approval: AgentActionApproval): boolean {
  return (
    approval.modifiedParameters !== undefined &&
    Object.keys(approval.modifiedParameters).length > 0
  );
}

/**
 * Get the effective parameters (modified if available, otherwise original)
 */
export function getEffectiveParameters(
  approval: AgentActionApproval
): Record<string, unknown> {
  if (hasUserModifications(approval)) {
    return {
      ...approval.parameters,
      ...approval.modifiedParameters,
    };
  }
  return approval.parameters;
}

