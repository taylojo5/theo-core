// ═══════════════════════════════════════════════════════════════════════════
// Gmail Email Composition
// Utilities for composing and managing email drafts
// ═══════════════════════════════════════════════════════════════════════════

import { GmailClient } from "../client";
import type { GmailDraft } from "../types";
import type {
  ComposeEmailParams,
  CreateDraftResult,
  UpdateDraftResult,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Draft Creation
// ─────────────────────────────────────────────────────────────

/**
 * Create a new email draft in Gmail
 */
export async function createDraft(
  client: GmailClient,
  params: ComposeEmailParams
): Promise<CreateDraftResult> {
  const draft = await client.createDraft({
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

  return {
    draftId: draft.id,
    gmailDraftId: draft.id,
    messageId: draft.message?.id,
    threadId: draft.message?.threadId,
  };
}

/**
 * Update an existing email draft
 */
export async function updateDraft(
  client: GmailClient,
  draftId: string,
  params: ComposeEmailParams
): Promise<UpdateDraftResult> {
  const draft = await client.updateDraft(draftId, {
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

  return {
    draftId: draft.id,
    gmailDraftId: draft.id,
    messageId: draft.message?.id,
  };
}

/**
 * Delete a draft
 */
export async function deleteDraft(
  client: GmailClient,
  draftId: string
): Promise<void> {
  await client.deleteDraft(draftId);
}

/**
 * Get a draft by ID
 */
export async function getDraft(
  client: GmailClient,
  draftId: string
): Promise<GmailDraft> {
  return client.getDraft(draftId);
}

/**
 * List all drafts
 */
export async function listDrafts(
  client: GmailClient,
  options?: { maxResults?: number; pageToken?: string }
): Promise<{ drafts: GmailDraft[]; nextPageToken?: string }> {
  return client.listDrafts(options);
}

// ─────────────────────────────────────────────────────────────
// Email Composition Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Validate email addresses
 */
export function validateEmailAddresses(emails: string[]): {
  valid: string[];
  invalid: string[];
} {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const email of emails) {
    const trimmed = email.trim();
    if (emailRegex.test(trimmed)) {
      valid.push(trimmed);
    } else {
      invalid.push(trimmed);
    }
  }

  return { valid, invalid };
}

/**
 * Validate compose parameters
 */
export function validateComposeParams(params: ComposeEmailParams): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check required fields
  if (!params.to || params.to.length === 0) {
    errors.push("At least one recipient is required");
  }

  if (!params.subject || params.subject.trim() === "") {
    errors.push("Subject is required");
  }

  if (!params.body || params.body.trim() === "") {
    errors.push("Body is required");
  }

  // Validate email addresses
  const toValidation = validateEmailAddresses(params.to);
  if (toValidation.invalid.length > 0) {
    errors.push(
      `Invalid recipient addresses: ${toValidation.invalid.join(", ")}`
    );
  }

  if (params.cc) {
    const ccValidation = validateEmailAddresses(params.cc);
    if (ccValidation.invalid.length > 0) {
      errors.push(`Invalid CC addresses: ${ccValidation.invalid.join(", ")}`);
    }
  }

  if (params.bcc) {
    const bccValidation = validateEmailAddresses(params.bcc);
    if (bccValidation.invalid.length > 0) {
      errors.push(`Invalid BCC addresses: ${bccValidation.invalid.join(", ")}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Build a reply email with proper threading
 */
export function buildReplyParams(
  originalMessage: {
    id: string;
    threadId: string;
    subject: string;
    from: { email: string; name?: string };
    messageId?: string;
    references?: string[];
  },
  replyBody: string,
  replyBodyHtml?: string
): ComposeEmailParams {
  // Build reply subject
  const subject = originalMessage.subject.startsWith("Re:")
    ? originalMessage.subject
    : `Re: ${originalMessage.subject}`;

  // Build references chain
  const references: string[] = [];
  if (originalMessage.references) {
    references.push(...originalMessage.references);
  }
  if (originalMessage.messageId) {
    references.push(originalMessage.messageId);
  }

  return {
    to: [originalMessage.from.email],
    subject,
    body: replyBody,
    bodyHtml: replyBodyHtml,
    threadId: originalMessage.threadId,
    inReplyTo: originalMessage.messageId,
    references: references.length > 0 ? references : undefined,
  };
}

/**
 * Build a forward email
 */
export function buildForwardParams(
  originalMessage: {
    subject: string;
    from: { email: string; name?: string };
    date: Date;
    bodyText?: string;
    bodyHtml?: string;
  },
  forwardTo: string[],
  additionalMessage?: string
): ComposeEmailParams {
  // Build forward subject
  const subject = originalMessage.subject.startsWith("Fwd:")
    ? originalMessage.subject
    : `Fwd: ${originalMessage.subject}`;

  // Build forward body
  const forwardHeader = [
    "",
    "---------- Forwarded message ---------",
    `From: ${originalMessage.from.name ? `${originalMessage.from.name} <${originalMessage.from.email}>` : originalMessage.from.email}`,
    `Date: ${originalMessage.date.toLocaleString()}`,
    `Subject: ${originalMessage.subject}`,
    "",
  ].join("\n");

  const body = additionalMessage
    ? `${additionalMessage}\n${forwardHeader}${originalMessage.bodyText || ""}`
    : `${forwardHeader}${originalMessage.bodyText || ""}`;

  // Build HTML version if original has HTML
  let bodyHtml: string | undefined;
  if (originalMessage.bodyHtml) {
    const htmlHeader = `
      <br><br>
      <div style="border-top: 1px solid #ccc; padding-top: 10px;">
        <b>---------- Forwarded message ---------</b><br>
        <b>From:</b> ${originalMessage.from.name ? `${originalMessage.from.name} &lt;${originalMessage.from.email}&gt;` : originalMessage.from.email}<br>
        <b>Date:</b> ${originalMessage.date.toLocaleString()}<br>
        <b>Subject:</b> ${originalMessage.subject}<br>
      </div>
      <br>
    `;
    bodyHtml = additionalMessage
      ? `<p>${additionalMessage}</p>${htmlHeader}${originalMessage.bodyHtml}`
      : `${htmlHeader}${originalMessage.bodyHtml}`;
  }

  return {
    to: forwardTo,
    subject,
    body,
    bodyHtml,
  };
}

/**
 * Format email address for display
 */
export function formatEmailForDisplay(email: string, name?: string): string {
  if (name) {
    return `${name} <${email}>`;
  }
  return email;
}

/**
 * Parse display email back to components
 */
export function parseDisplayEmail(display: string): {
  email: string;
  name?: string;
} {
  const match = display.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return {
      name: match[1].trim(),
      email: match[2].trim(),
    };
  }
  return { email: display.trim() };
}
