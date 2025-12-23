// ═══════════════════════════════════════════════════════════════════════════
// Gmail Actions
// Email composition, drafts, approvals, and sending
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Status types
  ApprovalStatus,

  // Compose types
  ComposeEmailParams,
  CreateDraftResult,
  UpdateDraftResult,

  // Approval types
  RequestApprovalParams,
  EmailApproval,
  RequestApprovalResult,
  ApproveAndSendResult,
  RejectApprovalResult,

  // Send types
  SendEmailResult,
  SendDraftOptions,

  // Query types
  ApprovalQueryOptions,
  ApprovalStats,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Compose
// ─────────────────────────────────────────────────────────────

export {
  // Draft management
  createDraft,
  updateDraft,
  deleteDraft,
  getDraft,
  listDrafts,

  // Composition utilities
  validateEmailAddresses,
  validateComposeParams,
  buildReplyParams,
  buildForwardParams,
  formatEmailForDisplay,
  parseDisplayEmail,
} from "./compose";

// ─────────────────────────────────────────────────────────────
// Approval Workflow
// ─────────────────────────────────────────────────────────────

export {
  // Request and decision
  requestApproval,
  approveAndSend,
  rejectApproval,

  // Query
  getApproval,
  getPendingApprovals,
  getApprovals,
  getApprovalStats,

  // Expiration
  expireOverdueApprovals,
  isApprovalExpired,
  getTimeUntilExpiration,
} from "./approval";

// ─────────────────────────────────────────────────────────────
// Send
// ─────────────────────────────────────────────────────────────

export {
  // Direct send (use with caution)
  sendEmailDirect,

  // Draft send
  sendDraft,

  // Reply helpers
  sendReply,
  sendReplyAll,
} from "./send";
