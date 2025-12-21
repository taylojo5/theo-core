// ═══════════════════════════════════════════════════════════════════════════
// Gmail Email Sending
// Direct email sending with audit logging
// ═══════════════════════════════════════════════════════════════════════════

import { logAuditEntry } from "@/services/audit";
import { GmailClient } from "../client";
import type { ParsedGmailMessage } from "../types";
import type { ComposeEmailParams, SendEmailResult } from "./types";

// ─────────────────────────────────────────────────────────────
// Direct Send (Use with caution - prefer approval workflow)
// ─────────────────────────────────────────────────────────────

/**
 * Send an email directly without approval
 *
 * ⚠️ WARNING: This bypasses the approval workflow.
 * Use only for user-initiated sends from the UI, not for agent actions.
 */
export async function sendEmailDirect(
  client: GmailClient,
  userId: string,
  params: ComposeEmailParams
): Promise<SendEmailResult> {
  try {
    const sentMessage = await client.sendMessage({
      to: params.to,
      cc: params.cc,
      bcc: params.bcc,
      subject: params.subject,
      body: params.body,
      bodyHtml: params.bodyHtml,
      threadId: params.threadId,
      inReplyTo: params.inReplyTo,
      references: params.references,
    });

    // Audit log
    await logAuditEntry({
      userId,
      actionType: "send",
      actionCategory: "integration",
      entityType: "email",
      entityId: sentMessage.id,
      intent: "Send email directly (user-initiated)",
      inputSummary: `Email to: ${params.to.join(", ")}, Subject: ${params.subject}`,
      outputSummary: `Sent message ${sentMessage.id}`,
      metadata: {
        messageId: sentMessage.id,
        threadId: sentMessage.threadId,
        recipients: params.to,
        cc: params.cc,
        bcc: params.bcc,
      },
    });

    return {
      success: true,
      messageId: sentMessage.id,
      threadId: sentMessage.threadId,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Audit log the failure
    await logAuditEntry({
      userId,
      actionType: "send",
      actionCategory: "integration",
      entityType: "email",
      intent: "Send email directly (user-initiated)",
      inputSummary: `Email to: ${params.to.join(", ")}, Subject: ${params.subject}`,
      outputSummary: `Failed to send: ${errorMessage}`,
      status: "failed",
      errorMessage,
      metadata: {
        recipients: params.to,
      },
    });

    return {
      success: false,
      errorMessage,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Send Draft
// ─────────────────────────────────────────────────────────────

/**
 * Send an existing draft
 */
export async function sendDraft(
  client: GmailClient,
  userId: string,
  draftId: string
): Promise<SendEmailResult> {
  try {
    const sentMessage = await client.sendDraft(draftId);

    // Audit log
    await logAuditEntry({
      userId,
      actionType: "send",
      actionCategory: "integration",
      entityType: "email",
      entityId: sentMessage.id,
      intent: "Send draft email",
      inputSummary: `Draft ID: ${draftId}`,
      outputSummary: `Sent message ${sentMessage.id}`,
      metadata: {
        draftId,
        messageId: sentMessage.id,
        threadId: sentMessage.threadId,
      },
    });

    return {
      success: true,
      messageId: sentMessage.id,
      threadId: sentMessage.threadId,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Audit log the failure
    await logAuditEntry({
      userId,
      actionType: "send",
      actionCategory: "integration",
      entityType: "email",
      intent: "Send draft email",
      inputSummary: `Draft ID: ${draftId}`,
      outputSummary: `Failed to send: ${errorMessage}`,
      status: "failed",
      errorMessage,
      metadata: {
        draftId,
      },
    });

    return {
      success: false,
      errorMessage,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Reply
// ─────────────────────────────────────────────────────────────

/**
 * Send a reply to an existing message
 */
export async function sendReply(
  client: GmailClient,
  userId: string,
  originalMessage: ParsedGmailMessage,
  replyBody: string,
  replyBodyHtml?: string
): Promise<SendEmailResult> {
  // Build reply subject
  const subject = originalMessage.subject.startsWith("Re:")
    ? originalMessage.subject
    : `Re: ${originalMessage.subject}`;

  // Build references
  const references: string[] = [];
  if (originalMessage.references) {
    references.push(...originalMessage.references);
  }
  if (originalMessage.messageId) {
    references.push(originalMessage.messageId);
  }

  return sendEmailDirect(client, userId, {
    to: [originalMessage.from.email],
    subject,
    body: replyBody,
    bodyHtml: replyBodyHtml,
    threadId: originalMessage.threadId,
    inReplyTo: originalMessage.messageId,
    references: references.length > 0 ? references : undefined,
  });
}

/**
 * Send a reply-all to an existing message
 */
export async function sendReplyAll(
  client: GmailClient,
  userId: string,
  originalMessage: ParsedGmailMessage,
  replyBody: string,
  replyBodyHtml?: string,
  userEmail?: string
): Promise<SendEmailResult> {
  // Build reply subject
  const subject = originalMessage.subject.startsWith("Re:")
    ? originalMessage.subject
    : `Re: ${originalMessage.subject}`;

  // Build recipients (excluding the user's own email)
  const to = [originalMessage.from.email];
  const cc = [
    ...originalMessage.to.map((addr) => addr.email),
    ...originalMessage.cc.map((addr) => addr.email),
  ].filter(
    (email) => email !== userEmail && email !== originalMessage.from.email
  );

  // Build references
  const references: string[] = [];
  if (originalMessage.references) {
    references.push(...originalMessage.references);
  }
  if (originalMessage.messageId) {
    references.push(originalMessage.messageId);
  }

  return sendEmailDirect(client, userId, {
    to,
    cc: cc.length > 0 ? cc : undefined,
    subject,
    body: replyBody,
    bodyHtml: replyBodyHtml,
    threadId: originalMessage.threadId,
    inReplyTo: originalMessage.messageId,
    references: references.length > 0 ? references : undefined,
  });
}
