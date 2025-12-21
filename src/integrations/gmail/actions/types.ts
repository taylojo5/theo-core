// ═══════════════════════════════════════════════════════════════════════════
// Gmail Actions Types
// Type definitions for email composition, drafts, and approvals
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Approval Status
// ─────────────────────────────────────────────────────────────

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "sent";

// ─────────────────────────────────────────────────────────────
// Compose Email
// ─────────────────────────────────────────────────────────────

/**
 * Parameters for composing an email
 */
export interface ComposeEmailParams {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  threadId?: string; // For replies
  inReplyTo?: string; // Message-Id being replied to
  references?: string[]; // Thread references
}

/**
 * Result of creating a draft
 */
export interface CreateDraftResult {
  draftId: string;
  gmailDraftId: string;
  messageId?: string;
  threadId?: string;
}

/**
 * Result of updating a draft
 */
export interface UpdateDraftResult {
  draftId: string;
  gmailDraftId: string;
  messageId?: string;
}

// ─────────────────────────────────────────────────────────────
// Email Approval
// ─────────────────────────────────────────────────────────────

/**
 * Request for email approval
 */
export interface RequestApprovalParams extends ComposeEmailParams {
  requestedBy?: string; // Agent action ID or identifier
  expiresInMinutes?: number; // Auto-expire after N minutes
  metadata?: Record<string, unknown>;
}

/**
 * An email approval record
 */
export interface EmailApproval {
  id: string;
  userId: string;
  draftId: string;
  gmailDraftId: string | null;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  bodyHtml: string | null;
  threadId: string | null;
  inReplyTo: string | null;
  status: ApprovalStatus;
  requestedAt: Date;
  requestedBy: string | null;
  expiresAt: Date | null;
  decidedAt: Date | null;
  decidedBy: string | null;
  sentMessageId: string | null;
  sentAt: Date | null;
  errorMessage: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Result of requesting approval
 */
export interface RequestApprovalResult {
  approval: EmailApproval;
  draftId: string;
  gmailDraftId: string;
}

/**
 * Result of approving and sending
 */
export interface ApproveAndSendResult {
  success: boolean;
  approval: EmailApproval;
  sentMessageId?: string;
  errorMessage?: string;
}

/**
 * Result of rejecting an approval
 */
export interface RejectApprovalResult {
  success: boolean;
  approval: EmailApproval;
}

// ─────────────────────────────────────────────────────────────
// Send Email
// ─────────────────────────────────────────────────────────────

/**
 * Result of sending an email
 */
export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  threadId?: string;
  errorMessage?: string;
}

/**
 * Options for sending a draft
 */
export interface SendDraftOptions {
  deleteDraftAfter?: boolean; // Gmail automatically deletes draft after sending
}

// ─────────────────────────────────────────────────────────────
// Approval Queries
// ─────────────────────────────────────────────────────────────

/**
 * Options for querying approvals
 */
export interface ApprovalQueryOptions {
  status?: ApprovalStatus | ApprovalStatus[];
  limit?: number;
  offset?: number;
  includeExpired?: boolean;
}

/**
 * Approval statistics
 */
export interface ApprovalStats {
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
  sent: number;
  total: number;
}
