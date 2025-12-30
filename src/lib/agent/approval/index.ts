// ═══════════════════════════════════════════════════════════════════════════
// Agent Approval Module
// Action approval system with LLM context preservation
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Core types
  AgentActionApproval,
  ApprovalStatus,
  ApprovalResolver,

  // Create/Update
  ApprovalCreateInput,
  ApprovalUpdateInput,

  // Query
  ApprovalQueryOptions,
  ApprovalQueryResult,

  // Decision
  ApprovalDecision,
  ApproveOptions,
  RejectOptions,
  ApprovalDecisionResult,

  // Display
  ApprovalDisplayData,
  ApprovalAssumptionDisplay,

  // Expiration
  ExpirationResult,
  ExpirationOptions,
} from "./types";

export {
  // Constants
  DEFAULT_EXPIRATION_MS,

  // Type guards
  isPendingApproval,
  isExpiredApproval,
  isActionableApproval,
  hasUserModifications,
  getEffectiveParameters,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────

export { approvalRepository } from "./repository";

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

export {
  // Creation
  createApproval,

  // Queries
  getApproval,
  getPendingApprovals,
  queryApprovals,
  getPendingCount,

  // Decisions
  processApprovalDecision,
  approveAction,
  rejectAction,

  // Execution tracking
  markExecuted,
  markFailed,

  // Display
  getApprovalForDisplay,
  formatApprovalForDisplay,

  // Plan integration
  getPendingApprovalsForPlan,
  cancelApprovalsForPlan,

  // Service object
  approvalService,
} from "./service";

// ─────────────────────────────────────────────────────────────
// Expiration
// ─────────────────────────────────────────────────────────────

export {
  // Configuration
  getDefaultExpirationMs,
  isExpirationWarning,
  getTimeUntilExpiration,

  // Expiration processing
  expireStaleApprovals,
  processExpirationsInBatches,

  // Warning notifications
  getApproachingExpirations,

  // Job management
  startExpirationJob,
  runExpirationCheck,

  // Service object
  expirationService,
} from "./expiration";

