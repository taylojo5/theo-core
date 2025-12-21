// ═══════════════════════════════════════════════════════════════════════════
// Gmail Mock Factories
// Functions to create mock Gmail API response objects for testing
// ═══════════════════════════════════════════════════════════════════════════

import type {
  GmailMessage,
  GmailThread,
  GmailLabel,
  GmailDraft,
  GmailProfile,
  GmailHistory,
  GoogleContact,
  EmailAddress,
  GmailMessagePart,
} from "@/integrations/gmail";

// ─────────────────────────────────────────────────────────────
// Message Factory
// ─────────────────────────────────────────────────────────────

export interface CreateMessageOptions {
  id?: string;
  threadId?: string;
  labelIds?: string[];
  subject?: string;
  from?: string | EmailAddress;
  to?: string | EmailAddress | (string | EmailAddress)[];
  cc?: string | EmailAddress | (string | EmailAddress)[];
  body?: string;
  bodyHtml?: string;
  date?: Date;
  /** Gmail internal date as Unix timestamp in milliseconds (string) */
  internalDate?: string;
  historyId?: string;
  hasAttachments?: boolean;
  attachments?: Array<{
    filename: string;
    mimeType: string;
    size: number;
  }>;
  inReplyTo?: string;
  references?: string;
}

let messageCounter = 0;

/**
 * Create a mock Gmail message
 */
export function createMockMessage(
  options: CreateMessageOptions = {}
): GmailMessage {
  messageCounter++;
  const id = options.id || `msg_${messageCounter.toString().padStart(3, "0")}`;
  const threadId = options.threadId || `thread_${messageCounter}`;
  const date = options.date || new Date();
  const historyId = options.historyId || `${12345 + messageCounter}`;

  // Format addresses
  const formatAddress = (
    addr: string | EmailAddress | undefined
  ): string | undefined => {
    if (!addr) return undefined;
    if (typeof addr === "string") return addr;
    return addr.name ? `${addr.name} <${addr.email}>` : addr.email;
  };

  const formatAddressList = (
    addrs: string | EmailAddress | (string | EmailAddress)[] | undefined
  ): string | undefined => {
    if (!addrs) return undefined;
    const list = Array.isArray(addrs) ? addrs : [addrs];
    return list.map((a) => formatAddress(a)).join(", ");
  };

  const from =
    formatAddress(options.from) || `sender${messageCounter}@example.com`;
  const to =
    formatAddressList(options.to) || `recipient${messageCounter}@example.com`;
  const cc = formatAddressList(options.cc);
  const subject = options.subject || `Test Subject ${messageCounter}`;
  const body = options.body || `This is test message body ${messageCounter}.`;
  const bodyHtml =
    options.bodyHtml || `<p>This is test message body ${messageCounter}.</p>`;

  // Build headers
  const headers: Array<{ name: string; value: string }> = [
    { name: "From", value: from },
    { name: "To", value: to },
    { name: "Subject", value: subject },
    { name: "Date", value: date.toUTCString() },
    { name: "Message-ID", value: `<${id}@example.com>` },
  ];

  if (cc) {
    headers.push({ name: "Cc", value: cc });
  }

  if (options.inReplyTo) {
    headers.push({ name: "In-Reply-To", value: options.inReplyTo });
  }

  if (options.references) {
    headers.push({ name: "References", value: options.references });
  }

  // Build parts
  const parts: GmailMessagePart[] = [
    {
      mimeType: "text/plain",
      body: {
        data: Buffer.from(body).toString("base64url"),
      },
    },
    {
      mimeType: "text/html",
      body: {
        data: Buffer.from(bodyHtml).toString("base64url"),
      },
    },
  ];

  // Add attachments
  if (options.hasAttachments || options.attachments?.length) {
    const attachments = options.attachments || [
      { filename: "document.pdf", mimeType: "application/pdf", size: 1024 },
    ];

    attachments.forEach((att, i) => {
      parts.push({
        mimeType: att.mimeType,
        filename: att.filename,
        body: {
          attachmentId: `att_${id}_${i}`,
          size: att.size,
        },
      });
    });
  }

  return {
    id,
    threadId,
    labelIds: options.labelIds || ["INBOX", "UNREAD"],
    snippet: body.slice(0, 100),
    historyId,
    internalDate: date.getTime().toString(),
    payload: {
      mimeType:
        parts.length > 2 || options.hasAttachments
          ? "multipart/mixed"
          : "multipart/alternative",
      headers,
      parts,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Thread Factory
// ─────────────────────────────────────────────────────────────

export interface CreateThreadOptions {
  id?: string;
  messages?: GmailMessage[];
  messageCount?: number;
  subject?: string;
}

let threadCounter = 0;

/**
 * Create a mock Gmail thread
 */
export function createMockThread(
  options: CreateThreadOptions = {}
): GmailThread {
  threadCounter++;
  const id =
    options.id || `thread_${threadCounter.toString().padStart(3, "0")}`;
  const subject = options.subject || `Thread Subject ${threadCounter}`;

  let messages: GmailMessage[];

  if (options.messages) {
    messages = options.messages.map((m) => ({ ...m, threadId: id }));
  } else {
    const count = options.messageCount || 1;
    const baseDate = new Date();

    messages = Array.from({ length: count }, (_, i) => {
      const msgDate = new Date(baseDate.getTime() - (count - i) * 3600000);
      return createMockMessage({
        threadId: id,
        subject: i === 0 ? subject : `Re: ${subject}`,
        date: msgDate,
        labelIds: i === count - 1 ? ["INBOX", "UNREAD"] : ["INBOX"],
        inReplyTo: i > 0 ? `<msg_${i}@example.com>` : undefined,
      });
    });
  }

  return {
    id,
    historyId: messages[messages.length - 1]?.historyId || "12345",
    snippet: messages[messages.length - 1]?.snippet || "",
    messages,
  };
}

// ─────────────────────────────────────────────────────────────
// History Factory
// ─────────────────────────────────────────────────────────────

export interface CreateHistoryEntryOptions {
  id?: string;
  messagesAdded?: Array<{ id: string; threadId: string }>;
  messagesDeleted?: Array<{ id: string; threadId?: string }>;
  labelsAdded?: Array<{ id: string; threadId?: string; labelIds: string[] }>;
  labelsRemoved?: Array<{ id: string; threadId?: string; labelIds: string[] }>;
}

let historyCounter = 12345;

/**
 * Create a mock Gmail history entry
 */
export function createMockHistoryEntry(
  options: CreateHistoryEntryOptions = {}
): GmailHistory {
  historyCounter++;
  const id = options.id || historyCounter.toString();

  const entry: GmailHistory = { id };

  if (options.messagesAdded?.length) {
    entry.messagesAdded = options.messagesAdded.map((m) => ({
      message: { id: m.id, threadId: m.threadId },
    }));
  }

  if (options.messagesDeleted?.length) {
    entry.messagesDeleted = options.messagesDeleted.map((m) => ({
      message: { id: m.id, threadId: m.threadId || m.id },
    }));
  }

  if (options.labelsAdded?.length) {
    entry.labelsAdded = options.labelsAdded.map((m) => ({
      message: { id: m.id, threadId: m.threadId || m.id },
      labelIds: m.labelIds,
    }));
  }

  if (options.labelsRemoved?.length) {
    entry.labelsRemoved = options.labelsRemoved.map((m) => ({
      message: { id: m.id, threadId: m.threadId || m.id },
      labelIds: m.labelIds,
    }));
  }

  return entry;
}

// ─────────────────────────────────────────────────────────────
// Profile Factory
// ─────────────────────────────────────────────────────────────

export interface CreateProfileOptions {
  emailAddress?: string;
  messagesTotal?: number;
  threadsTotal?: number;
  historyId?: string;
}

/**
 * Create a mock Gmail profile
 */
export function createMockProfile(
  options: CreateProfileOptions = {}
): GmailProfile {
  return {
    emailAddress: options.emailAddress || "test@example.com",
    messagesTotal: options.messagesTotal ?? 1000,
    threadsTotal: options.threadsTotal ?? 500,
    historyId: options.historyId || "12345",
  };
}

// ─────────────────────────────────────────────────────────────
// Label Factory
// ─────────────────────────────────────────────────────────────

export interface CreateLabelOptions {
  id?: string;
  name?: string;
  type?: "system" | "user";
  messagesTotal?: number;
  messagesUnread?: number;
  backgroundColor?: string;
  textColor?: string;
}

let labelCounter = 0;

/**
 * Create a mock Gmail label
 */
export function createMockLabel(options: CreateLabelOptions = {}): GmailLabel {
  labelCounter++;

  const id = options.id || `Label_${labelCounter}`;
  const name = options.name || `Custom Label ${labelCounter}`;

  return {
    id,
    name,
    type: options.type || "user",
    messagesTotal: options.messagesTotal,
    messagesUnread: options.messagesUnread,
    color: options.backgroundColor
      ? {
          backgroundColor: options.backgroundColor,
          textColor: options.textColor || "#ffffff",
        }
      : undefined,
  };
}

// ─────────────────────────────────────────────────────────────
// Draft Factory
// ─────────────────────────────────────────────────────────────

export interface CreateDraftOptions {
  id?: string;
  message?: GmailMessage;
  to?: string;
  subject?: string;
  body?: string;
}

let draftCounter = 0;

/**
 * Create a mock Gmail draft
 */
export function createMockDraft(options: CreateDraftOptions = {}): GmailDraft {
  draftCounter++;

  const id = options.id || `draft_${draftCounter.toString().padStart(3, "0")}`;

  const message =
    options.message ||
    createMockMessage({
      to: options.to || `recipient${draftCounter}@example.com`,
      subject: options.subject || `Draft Subject ${draftCounter}`,
      body: options.body || `Draft body content ${draftCounter}`,
      labelIds: ["DRAFT"],
    });

  return {
    id,
    message,
  };
}

// ─────────────────────────────────────────────────────────────
// Contact Factory
// ─────────────────────────────────────────────────────────────

export interface CreateContactOptions {
  resourceName?: string;
  displayName?: string;
  givenName?: string;
  familyName?: string;
  email?: string;
  emails?: string[];
  phone?: string;
  phones?: string[];
  company?: string;
  title?: string;
  photoUrl?: string;
}

let contactCounter = 0;

/**
 * Create a mock Google Contact
 */
export function createMockContact(
  options: CreateContactOptions = {}
): GoogleContact {
  contactCounter++;

  const resourceName =
    options.resourceName || `people/c${100000000 + contactCounter}`;
  const displayName = options.displayName || `Contact ${contactCounter}`;
  const givenName = options.givenName || `First${contactCounter}`;
  const familyName = options.familyName || `Last${contactCounter}`;
  const primaryEmail = options.email || `contact${contactCounter}@example.com`;

  const contact: GoogleContact = {
    resourceName,
    etag: `%EgMBBgkQL${contactCounter}=`,
    names: [
      {
        displayName,
        givenName,
        familyName,
      },
    ],
    emailAddresses: (options.emails || [primaryEmail]).map((email, i) => ({
      value: email,
      type: i === 0 ? "work" : "home",
    })),
  };

  if (options.phone || options.phones?.length) {
    contact.phoneNumbers = (
      options.phones || [options.phone || "+1-555-000-0000"]
    ).map((phone, i) => ({
      value: phone,
      type: i === 0 ? "mobile" : "work",
    }));
  }

  if (options.company || options.title) {
    contact.organizations = [
      {
        name: options.company,
        title: options.title,
      },
    ];
  }

  if (options.photoUrl) {
    contact.photos = [{ url: options.photoUrl, default: false }];
  }

  return contact;
}

// ─────────────────────────────────────────────────────────────
// Reset Counters (for test isolation)
// ─────────────────────────────────────────────────────────────

/**
 * Reset all counters for test isolation
 */
export function resetMockCounters(): void {
  messageCounter = 0;
  threadCounter = 0;
  historyCounter = 12345;
  labelCounter = 0;
  draftCounter = 0;
  contactCounter = 0;
}
