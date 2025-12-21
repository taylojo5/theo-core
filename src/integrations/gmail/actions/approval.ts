// ═══════════════════════════════════════════════════════════════════════════
// Gmail Email Approval Workflow
// Manages email approvals for agent-initiated sends
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import { logAuditEntry } from "@/services/audit";
import { sanitizeComposeHtml, containsDangerousHtml } from "@/lib/sanitize";
import { GmailClient } from "../client";
import { actionsLogger } from "../logger";
import { createDraft } from "./compose";
import type {
  Prisma,
  EmailApproval as PrismaEmailApproval,
} from "@prisma/client";
import type {
  EmailApproval,
  RequestApprovalParams,
  RequestApprovalResult,
  ApproveAndSendResult,
  RejectApprovalResult,
  ApprovalQueryOptions,
  ApprovalStats,
  ApprovalStatus,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** Default expiration time for approvals (24 hours) */
const DEFAULT_EXPIRATION_MINUTES = 24 * 60;

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

/**
 * Map Prisma EmailApproval to domain type
 */
function mapPrismaApproval(prisma: PrismaEmailApproval): EmailApproval {
  return {
    id: prisma.id,
    userId: prisma.userId,
    draftId: prisma.draftId,
    gmailDraftId: prisma.gmailDraftId,
    to: prisma.to,
    cc: prisma.cc,
    bcc: prisma.bcc,
    subject: prisma.subject,
    body: prisma.body,
    bodyHtml: prisma.bodyHtml,
    threadId: prisma.threadId,
    inReplyTo: prisma.inReplyTo,
    status: prisma.status as ApprovalStatus,
    requestedAt: prisma.requestedAt,
    requestedBy: prisma.requestedBy,
    expiresAt: prisma.expiresAt,
    decidedAt: prisma.decidedAt,
    decidedBy: prisma.decidedBy,
    sentMessageId: prisma.sentMessageId,
    sentAt: prisma.sentAt,
    errorMessage: prisma.errorMessage,
    notes: prisma.notes,
    metadata: prisma.metadata as Record<string, unknown>,
    createdAt: prisma.createdAt,
    updatedAt: prisma.updatedAt,
  };
}

// ─────────────────────────────────────────────────────────────
// Request Approval
// ─────────────────────────────────────────────────────────────

/**
 * Request approval for sending an email
 * Creates a draft in Gmail and an approval record in the database
 */
export async function requestApproval(
  client: GmailClient,
  userId: string,
  params: RequestApprovalParams
): Promise<RequestApprovalResult> {
  let draftResult: {
    draftId: string;
    gmailDraftId: string;
    threadId?: string;
  } | null = null;

  // Sanitize HTML body to prevent XSS if the email is displayed in a web UI
  const sanitizedBodyHtml = params.bodyHtml
    ? sanitizeComposeHtml(params.bodyHtml)
    : undefined;

  // Log a warning if dangerous content was detected
  if (params.bodyHtml && containsDangerousHtml(params.bodyHtml)) {
    actionsLogger.warn(
      "Potentially dangerous HTML detected in email body - content was sanitized",
      {
        userId,
        recipients: params.to,
      }
    );
  }

  try {
    // Create the draft in Gmail first
    draftResult = await createDraft(client, {
      to: params.to,
      cc: params.cc,
      bcc: params.bcc,
      subject: params.subject,
      body: params.body,
      bodyHtml: sanitizedBodyHtml,
      threadId: params.threadId,
      inReplyTo: params.inReplyTo,
      references: params.references,
    });

    // Calculate expiration
    const expirationMinutes =
      params.expiresInMinutes ?? DEFAULT_EXPIRATION_MINUTES;
    const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);

    // Create approval record with sanitized HTML
    const approval = await db.emailApproval.create({
      data: {
        userId,
        draftId: draftResult.draftId,
        gmailDraftId: draftResult.gmailDraftId,
        to: params.to,
        cc: params.cc ?? [],
        bcc: params.bcc ?? [],
        subject: params.subject,
        body: params.body,
        bodyHtml: sanitizedBodyHtml,
        threadId: params.threadId ?? draftResult.threadId,
        inReplyTo: params.inReplyTo,
        status: "pending",
        requestedBy: params.requestedBy,
        expiresAt,
        metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    // Audit log
    await logAuditEntry({
      userId,
      actionType: "create",
      actionCategory: "integration",
      entityType: "email_approval",
      entityId: approval.id,
      intent: "Request approval for sending email",
      inputSummary: `Email to: ${params.to.join(", ")}, Subject: ${params.subject}`,
      outputSummary: `Created approval ${approval.id} with draft ${draftResult.draftId}`,
      metadata: {
        draftId: draftResult.draftId,
        recipients: params.to,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return {
      approval: mapPrismaApproval(approval),
      draftId: draftResult.draftId,
      gmailDraftId: draftResult.gmailDraftId,
    };
  } catch (error) {
    // Clean up the Gmail draft if it was created but subsequent operations failed
    if (draftResult) {
      try {
        await client.deleteDraft(draftResult.draftId);
      } catch (cleanupError) {
        // Log cleanup failure but don't mask the original error
        actionsLogger.error(
          "Failed to cleanup orphaned draft",
          {
            draftId: draftResult.draftId,
            userId,
          },
          cleanupError
        );
      }
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// Approve and Send
// ─────────────────────────────────────────────────────────────

/**
 * Approve an email and send it
 */
export async function approveAndSend(
  client: GmailClient,
  userId: string,
  approvalId: string
): Promise<ApproveAndSendResult> {
  // Get the approval
  const approval = await db.emailApproval.findUnique({
    where: { id: approvalId },
  });

  if (!approval) {
    throw new Error(`Approval not found: ${approvalId}`);
  }

  if (approval.userId !== userId) {
    throw new Error("Unauthorized: approval belongs to different user");
  }

  if (approval.status !== "pending") {
    throw new Error(`Cannot approve: approval status is ${approval.status}`);
  }

  // Check if expired
  if (approval.expiresAt && approval.expiresAt < new Date()) {
    await db.emailApproval.update({
      where: { id: approvalId },
      data: {
        status: "expired",
        decidedAt: new Date(),
        decidedBy: "auto_expired",
      },
    });
    throw new Error("Approval has expired");
  }

  try {
    // Send the draft
    const sentMessage = await client.sendDraft(approval.draftId);

    // Update approval record
    const updatedApproval = await db.emailApproval.update({
      where: { id: approvalId },
      data: {
        status: "sent",
        decidedAt: new Date(),
        decidedBy: "user",
        sentMessageId: sentMessage.id,
        sentAt: new Date(),
      },
    });

    // Audit log
    await logAuditEntry({
      userId,
      actionType: "send",
      actionCategory: "integration",
      entityType: "email_approval",
      entityId: approvalId,
      intent: "Approve and send email",
      inputSummary: `Approved email to: ${approval.to.join(", ")}`,
      outputSummary: `Sent message ${sentMessage.id}`,
      metadata: {
        draftId: approval.draftId,
        sentMessageId: sentMessage.id,
      },
    });

    return {
      success: true,
      approval: mapPrismaApproval(updatedApproval),
      sentMessageId: sentMessage.id,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Update approval with error but keep status as pending so user can retry
    const updatedApproval = await db.emailApproval.update({
      where: { id: approvalId },
      data: {
        errorMessage,
      },
    });

    // Audit log the failure
    await logAuditEntry({
      userId,
      actionType: "send",
      actionCategory: "integration",
      entityType: "email_approval",
      entityId: approvalId,
      intent: "Approve and send email",
      inputSummary: `Approved email to: ${approval.to.join(", ")}`,
      outputSummary: `Failed to send: ${errorMessage}`,
      status: "failed",
      errorMessage,
      metadata: {
        draftId: approval.draftId,
      },
    });

    return {
      success: false,
      approval: mapPrismaApproval(updatedApproval),
      errorMessage,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Reject Approval
// ─────────────────────────────────────────────────────────────

/**
 * Reject an email approval
 */
export async function rejectApproval(
  client: GmailClient,
  userId: string,
  approvalId: string,
  notes?: string
): Promise<RejectApprovalResult> {
  // Get the approval
  const approval = await db.emailApproval.findUnique({
    where: { id: approvalId },
  });

  if (!approval) {
    throw new Error(`Approval not found: ${approvalId}`);
  }

  if (approval.userId !== userId) {
    throw new Error("Unauthorized: approval belongs to different user");
  }

  if (approval.status !== "pending") {
    throw new Error(`Cannot reject: approval status is ${approval.status}`);
  }

  // Delete the draft from Gmail
  try {
    await client.deleteDraft(approval.draftId);
  } catch {
    // Draft may already be deleted or not exist
    actionsLogger.warn("Failed to delete draft - it may not exist", {
      draftId: approval.draftId,
      approvalId: approval.id,
    });
  }

  // Update approval record
  const updatedApproval = await db.emailApproval.update({
    where: { id: approvalId },
    data: {
      status: "rejected",
      decidedAt: new Date(),
      decidedBy: "user",
      notes,
    },
  });

  // Audit log
  await logAuditEntry({
    userId,
    actionType: "delete",
    actionCategory: "integration",
    entityType: "email_approval",
    entityId: approvalId,
    intent: "Reject email approval",
    inputSummary: `Rejected email to: ${approval.to.join(", ")}`,
    outputSummary: notes
      ? `Rejected with notes: ${notes}`
      : "Rejected without notes",
    metadata: {
      draftId: approval.draftId,
      notes,
    },
  });

  return {
    success: true,
    approval: mapPrismaApproval(updatedApproval),
  };
}

// ─────────────────────────────────────────────────────────────
// Query Approvals
// ─────────────────────────────────────────────────────────────

/**
 * Get an approval by ID
 */
export async function getApproval(
  userId: string,
  approvalId: string
): Promise<EmailApproval | null> {
  const approval = await db.emailApproval.findFirst({
    where: {
      id: approvalId,
      userId,
    },
  });

  return approval ? mapPrismaApproval(approval) : null;
}

/**
 * Get pending approvals for a user
 */
export async function getPendingApprovals(
  userId: string,
  options: ApprovalQueryOptions = {}
): Promise<EmailApproval[]> {
  const { limit = 50, offset = 0, includeExpired = false } = options;

  const where: Prisma.EmailApprovalWhereInput = {
    userId,
    status: "pending",
  };

  // Exclude expired if not including them
  if (!includeExpired) {
    where.OR = [{ expiresAt: null }, { expiresAt: { gt: new Date() } }];
  }

  const approvals = await db.emailApproval.findMany({
    where,
    orderBy: { requestedAt: "desc" },
    take: limit,
    skip: offset,
  });

  return approvals.map(mapPrismaApproval);
}

/**
 * Get approvals for a user with filters
 */
export async function getApprovals(
  userId: string,
  options: ApprovalQueryOptions = {}
): Promise<EmailApproval[]> {
  const { status, limit = 50, offset = 0 } = options;

  const where: Prisma.EmailApprovalWhereInput = { userId };

  if (status) {
    where.status = Array.isArray(status) ? { in: status } : status;
  }

  const approvals = await db.emailApproval.findMany({
    where,
    orderBy: { requestedAt: "desc" },
    take: limit,
    skip: offset,
  });

  return approvals.map(mapPrismaApproval);
}

/**
 * Get approval statistics for a user
 */
export async function getApprovalStats(userId: string): Promise<ApprovalStats> {
  const [pending, approved, rejected, expired, sent] = await Promise.all([
    db.emailApproval.count({ where: { userId, status: "pending" } }),
    db.emailApproval.count({ where: { userId, status: "approved" } }),
    db.emailApproval.count({ where: { userId, status: "rejected" } }),
    db.emailApproval.count({ where: { userId, status: "expired" } }),
    db.emailApproval.count({ where: { userId, status: "sent" } }),
  ]);

  return {
    pending,
    approved,
    rejected,
    expired,
    sent,
    total: pending + approved + rejected + expired + sent,
  };
}

// ─────────────────────────────────────────────────────────────
// Expiration Management
// ─────────────────────────────────────────────────────────────

/**
 * Expire all overdue pending approvals
 * This should be run periodically (e.g., via cron job)
 */
export async function expireOverdueApprovals(): Promise<number> {
  const result = await db.emailApproval.updateMany({
    where: {
      status: "pending",
      expiresAt: { lt: new Date() },
    },
    data: {
      status: "expired",
      decidedAt: new Date(),
      decidedBy: "auto_expired",
    },
  });

  return result.count;
}

/**
 * Check if an approval is expired
 */
export function isApprovalExpired(approval: EmailApproval): boolean {
  if (!approval.expiresAt) return false;
  return approval.expiresAt < new Date();
}

/**
 * Get time until approval expires
 */
export function getTimeUntilExpiration(approval: EmailApproval): number | null {
  if (!approval.expiresAt) return null;
  return approval.expiresAt.getTime() - Date.now();
}
