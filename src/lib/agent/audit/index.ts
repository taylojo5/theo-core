// ═══════════════════════════════════════════════════════════════════════════
// Agent Audit Module
// Comprehensive audit trail system for the Agent Engine
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Audit log types
  AuditLogCreateInput,
  AuditLogUpdateInput,
  AuditLogWithAssumptions,

  // Assumption types
  AssumptionCreateInput,
  AssumptionVerifyInput,
  AssumptionRecord,

  // Query types
  AuditQueryOptions,
  AssumptionQueryOptions,
  AuditQueryResult,
  AssumptionQueryResult,

  // Service types
  AuditActionInput,
  AuditStats,
  AuditedAction,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────

export { auditLogRepository, assumptionRepository } from "./repository";

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

export {
  // Main service object
  auditService,

  // Audit logging functions
  logAgentAction,
  startAuditAction,
  completeAuditAction,
  failAuditAction,
  withAuditTrail,

  // Query functions
  queryAuditLog,
  getAuditEntry,
  getEntityAuditTrail,
  getRecentActions,
  getConversationAuditTrail,

  // Assumption functions
  queryAssumptions,
  getAssumptionsForAction,
  getUnverifiedAssumptions,
  verifyAssumption,

  // Statistics
  getAuditStats,
} from "./service";

