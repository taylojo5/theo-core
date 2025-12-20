// ═══════════════════════════════════════════════════════════════════════════
// Gmail to Database Mappers
// Convert Gmail API responses to Prisma model inputs
// ═══════════════════════════════════════════════════════════════════════════

import type { GmailLabel, ParsedGmailMessage, ParsedContact } from "./types";
import type { CreateEmailInput, CreateLabelInput } from "./repository";
import type { Prisma } from "@prisma/client";

// ─────────────────────────────────────────────────────────────
// Email Mappers
// ─────────────────────────────────────────────────────────────

/**
 * Convert a parsed Gmail message to a database email input
 */
export function mapGmailMessageToEmail(
  message: ParsedGmailMessage,
  userId: string
): CreateEmailInput {
  return {
    userId,
    gmailId: message.id,
    threadId: message.threadId,
    historyId: message.historyId,

    // Headers
    subject: message.subject || null,
    fromEmail: message.from.email,
    fromName: message.from.name || null,
    toEmails: message.to.map((addr) => addr.email),
    ccEmails: message.cc.map((addr) => addr.email),
    bccEmails: message.bcc.map((addr) => addr.email),
    replyTo: message.replyTo?.email || null,

    // Content
    snippet: message.snippet || null,
    bodyText: message.bodyText || null,
    bodyHtml: message.bodyHtml || null,

    // Metadata
    labelIds: message.labelIds,
    isRead: message.isRead,
    isStarred: message.isStarred,
    isImportant: message.isImportant,
    isDraft: message.isDraft,
    hasAttachments: message.hasAttachments,

    // Attachments as JSON
    attachments: message.attachments.map((att) => ({
      id: att.id,
      filename: att.filename,
      mimeType: att.mimeType,
      size: att.size,
    })),

    // Timestamps
    internalDate: message.internalDate,
    receivedAt: message.date,
  };
}

/**
 * Batch convert Gmail messages to email inputs
 */
export function mapGmailMessagesToEmails(
  messages: ParsedGmailMessage[],
  userId: string
): CreateEmailInput[] {
  return messages.map((msg) => mapGmailMessageToEmail(msg, userId));
}

// ─────────────────────────────────────────────────────────────
// Label Mappers
// ─────────────────────────────────────────────────────────────

/**
 * Convert a Gmail label to a database label input
 */
export function mapGmailLabelToEmailLabel(
  label: GmailLabel,
  userId: string
): CreateLabelInput {
  return {
    userId,
    gmailId: label.id,
    name: label.name,
    type: label.type,
    color: label.color ?? undefined,
    messageCount: label.messagesTotal || 0,
    unreadCount: label.messagesUnread || 0,
    messageListVisibility: label.messageListVisibility ?? undefined,
    labelListVisibility: label.labelListVisibility ?? undefined,
  };
}

/**
 * Batch convert Gmail labels to label inputs
 */
export function mapGmailLabelsToEmailLabels(
  labels: GmailLabel[],
  userId: string
): CreateLabelInput[] {
  return labels.map((label) => mapGmailLabelToEmailLabel(label, userId));
}

// ─────────────────────────────────────────────────────────────
// Contact to Person Mappers
// ─────────────────────────────────────────────────────────────

/**
 * Input type for creating a Person from a contact
 */
export interface CreatePersonFromContactInput {
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  company?: string;
  title?: string;
  bio?: string;
  source: string;
  sourceId: string;
  sourceSyncedAt: Date;
  metadata: Record<string, unknown>;
}

/**
 * Convert a parsed Google Contact to a Person entity input
 */
export function mapContactToPerson(
  contact: ParsedContact,
  userId: string
): CreatePersonFromContactInput {
  return {
    userId,
    name: contact.name || contact.email || "Unknown",
    email: contact.email || undefined,
    phone: contact.phone || undefined,
    avatarUrl: contact.photoUrl || undefined,
    company: contact.company || undefined,
    title: contact.title || undefined,
    bio: contact.notes || undefined,
    source: "gmail",
    sourceId: contact.resourceName,
    sourceSyncedAt: new Date(),
    metadata: {
      googleContact: {
        resourceName: contact.resourceName,
        etag: contact.etag,
        firstName: contact.firstName,
        lastName: contact.lastName,
        allEmails: contact.emails,
        allPhones: contact.phones,
        address: contact.address,
        birthday: contact.birthday?.toISOString(),
      },
    },
  };
}

/**
 * Batch convert contacts to person inputs
 */
export function mapContactsToPersons(
  contacts: ParsedContact[],
  userId: string
): CreatePersonFromContactInput[] {
  return contacts.map((contact) => mapContactToPerson(contact, userId));
}

/**
 * Convert Person input to Prisma create data
 */
export function personInputToPrisma(
  input: CreatePersonFromContactInput
): Prisma.PersonCreateInput {
  return {
    user: { connect: { id: input.userId } },
    name: input.name,
    email: input.email,
    phone: input.phone,
    avatarUrl: input.avatarUrl,
    company: input.company,
    title: input.title,
    bio: input.bio,
    source: input.source,
    sourceId: input.sourceId,
    sourceSyncedAt: input.sourceSyncedAt,
    metadata: input.metadata as Prisma.InputJsonValue,
  };
}

// ─────────────────────────────────────────────────────────────
// Email Address Extraction
// ─────────────────────────────────────────────────────────────

/**
 * Extract all unique email addresses from a set of emails
 * Returns a Map of email -> name for deduplication
 */
export function extractEmailParticipants(
  messages: ParsedGmailMessage[]
): Map<string, string | null> {
  const participants = new Map<string, string | null>();

  for (const message of messages) {
    // From
    if (message.from.email) {
      const existing = participants.get(message.from.email.toLowerCase());
      if (!existing && message.from.name) {
        participants.set(message.from.email.toLowerCase(), message.from.name);
      } else if (!existing) {
        participants.set(message.from.email.toLowerCase(), null);
      }
    }

    // To
    for (const addr of message.to) {
      if (addr.email) {
        const existing = participants.get(addr.email.toLowerCase());
        if (!existing && addr.name) {
          participants.set(addr.email.toLowerCase(), addr.name);
        } else if (!existing) {
          participants.set(addr.email.toLowerCase(), null);
        }
      }
    }

    // CC
    for (const addr of message.cc) {
      if (addr.email) {
        const existing = participants.get(addr.email.toLowerCase());
        if (!existing && addr.name) {
          participants.set(addr.email.toLowerCase(), addr.name);
        } else if (!existing) {
          participants.set(addr.email.toLowerCase(), null);
        }
      }
    }

    // BCC
    for (const addr of message.bcc) {
      if (addr.email) {
        const existing = participants.get(addr.email.toLowerCase());
        if (!existing && addr.name) {
          participants.set(addr.email.toLowerCase(), addr.name);
        } else if (!existing) {
          participants.set(addr.email.toLowerCase(), null);
        }
      }
    }
  }

  return participants;
}

// ─────────────────────────────────────────────────────────────
// Embedding Content Preparation
// ─────────────────────────────────────────────────────────────

/**
 * Prepare email content for embedding generation
 * Combines relevant fields into searchable text
 */
export function prepareEmailForEmbedding(email: {
  subject?: string | null;
  fromName?: string | null;
  fromEmail: string;
  snippet?: string | null;
  bodyText?: string | null;
}): string {
  const parts: string[] = [];

  if (email.subject) {
    parts.push(`Subject: ${email.subject}`);
  }

  if (email.fromName) {
    parts.push(`From: ${email.fromName} <${email.fromEmail}>`);
  } else {
    parts.push(`From: ${email.fromEmail}`);
  }

  // Use snippet or truncated body text
  if (email.snippet) {
    parts.push(email.snippet);
  } else if (email.bodyText) {
    // Limit body text for embedding
    const maxLength = 2000;
    parts.push(email.bodyText.slice(0, maxLength));
  }

  return parts.join("\n");
}

/**
 * Prepare email metadata for embedding storage
 */
export function prepareEmailEmbeddingMetadata(email: {
  id: string;
  gmailId: string;
  threadId: string;
  subject?: string | null;
  fromEmail: string;
  internalDate: Date;
  labelIds: string[];
}): Record<string, unknown> {
  return {
    emailId: email.id,
    gmailId: email.gmailId,
    threadId: email.threadId,
    subject: email.subject,
    from: email.fromEmail,
    date: email.internalDate.toISOString(),
    labels: email.labelIds,
  };
}
