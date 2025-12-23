// ═══════════════════════════════════════════════════════════════════════════
// Gmail Utilities
// Helper functions for parsing and processing Gmail data
// ═══════════════════════════════════════════════════════════════════════════

import type {
  GmailMessage,
  GmailMessagePayload,
  GmailMessagePart,
  GmailHeader,
  ParsedGmailMessage,
  EmailAddress,
  AttachmentInfo,
  GmailThread,
  ParsedGmailThread,
  GoogleContact,
  ParsedContact,
  SendMessageParams,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Message Parsing
// ─────────────────────────────────────────────────────────────

/**
 * Parse a raw Gmail message into a more usable format
 */
export function parseGmailMessage(message: GmailMessage): ParsedGmailMessage {
  const headers = message.payload?.headers || [];

  const labelIds = message.labelIds || [];
  const subject = getHeader(headers, "Subject") || "(No Subject)";
  const from = parseEmailAddress(getHeader(headers, "From") || "");
  const to = parseEmailAddressList(getHeader(headers, "To") || "");
  const cc = parseEmailAddressList(getHeader(headers, "Cc") || "");
  const bcc = parseEmailAddressList(getHeader(headers, "Bcc") || "");
  const replyTo = getHeader(headers, "Reply-To")
    ? parseEmailAddress(getHeader(headers, "Reply-To")!)
    : undefined;
  const messageId = getHeader(headers, "Message-ID");
  const inReplyTo = getHeader(headers, "In-Reply-To");
  const references = getHeader(headers, "References")
    ?.split(/\s+/)
    .filter(Boolean);
  const dateHeader = getHeader(headers, "Date");
  const date = dateHeader
    ? new Date(dateHeader)
    : new Date(parseInt(message.internalDate || "0"));

  // Extract body content
  const { bodyText, bodyHtml } = extractBody(message.payload);

  // Extract attachments
  const attachments = extractAttachments(message.payload);

  return {
    id: message.id,
    threadId: message.threadId,
    labelIds,
    snippet: message.snippet || "",
    historyId: message.historyId || "",
    internalDate: new Date(parseInt(message.internalDate || "0")),

    subject,
    from,
    to,
    cc,
    bcc,
    replyTo,
    messageId,
    references,
    inReplyTo,
    date,

    bodyText,
    bodyHtml,

    isRead: !labelIds.includes("UNREAD"),
    isStarred: labelIds.includes("STARRED"),
    isImportant: labelIds.includes("IMPORTANT"),
    isDraft: labelIds.includes("DRAFT"),
    hasAttachments: attachments.length > 0,
    attachments,

    raw: message,
  };
}

/**
 * Parse a Gmail thread into a more usable format
 */
export function parseGmailThread(thread: GmailThread): ParsedGmailThread {
  const messages = (thread.messages || []).map(parseGmailMessage);
  const allLabels = new Set<string>();
  const participants = new Map<string, EmailAddress>();

  messages.forEach((msg) => {
    msg.labelIds.forEach((l) => allLabels.add(l));
    [msg.from, ...msg.to, ...msg.cc].forEach((addr) => {
      if (addr.email) {
        participants.set(addr.email.toLowerCase(), addr);
      }
    });
  });

  const firstMessage = messages[0];
  const lastMessage = messages[messages.length - 1];

  return {
    id: thread.id,
    historyId: thread.historyId || "",
    snippet: thread.snippet || lastMessage?.snippet || "",
    messages,
    subject: firstMessage?.subject || "(No Subject)",
    participants: Array.from(participants.values()),
    latestDate: lastMessage?.date || new Date(),
    messageCount: messages.length,
    labelIds: Array.from(allLabels),
  };
}

// ─────────────────────────────────────────────────────────────
// Header Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Get a specific header value from headers array
 */
export function getHeader(
  headers: GmailHeader[],
  name: string
): string | undefined {
  const header = headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  );
  return header?.value;
}

/**
 * Parse an email address string "Name <email@example.com>" format
 */
export function parseEmailAddress(addressString: string): EmailAddress {
  if (!addressString) {
    return { email: "", name: undefined };
  }

  // Handle "Name <email>" format
  const match = addressString.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return {
      name: match[1].trim().replace(/^["']|["']$/g, ""),
      email: match[2].trim().toLowerCase(),
    };
  }

  // Plain email address
  return { email: addressString.trim().toLowerCase() };
}

/**
 * Parse a comma-separated list of email addresses
 */
export function parseEmailAddressList(
  addressListString: string
): EmailAddress[] {
  if (!addressListString) return [];

  // Split on commas, but not commas inside angle brackets
  const addresses: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of addressListString) {
    if (char === "<") depth++;
    if (char === ">") depth--;
    if (char === "," && depth === 0) {
      if (current.trim()) addresses.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) addresses.push(current.trim());

  return addresses.map(parseEmailAddress);
}

/**
 * Format an email address back to string
 */
export function formatEmailAddress(address: EmailAddress): string {
  if (address.name) {
    return `${address.name} <${address.email}>`;
  }
  return address.email;
}

// ─────────────────────────────────────────────────────────────
// Body Extraction
// ─────────────────────────────────────────────────────────────

interface ExtractedBody {
  bodyText?: string;
  bodyHtml?: string;
}

/**
 * Extract plain text and HTML body from message payload
 */
export function extractBody(payload?: GmailMessagePayload): ExtractedBody {
  if (!payload) return {};

  // Check if the body is directly in the payload
  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    const mimeType = payload.mimeType || "";

    if (mimeType === "text/html") {
      return { bodyHtml: decoded };
    }
    return { bodyText: decoded };
  }

  // For multipart messages, recursively find parts
  if (payload.parts) {
    return extractBodyFromParts(payload.parts);
  }

  return {};
}

/**
 * Recursively extract body from message parts
 */
function extractBodyFromParts(parts: GmailMessagePart[]): ExtractedBody {
  let bodyText: string | undefined;
  let bodyHtml: string | undefined;

  for (const part of parts) {
    const mimeType = part.mimeType || "";

    // Recurse into nested parts
    if (part.parts) {
      const nested = extractBodyFromParts(part.parts);
      bodyText = bodyText || nested.bodyText;
      bodyHtml = bodyHtml || nested.bodyHtml;
      continue;
    }

    // Skip attachments
    if (part.filename) continue;

    // Extract content
    if (part.body?.data) {
      const decoded = decodeBase64Url(part.body.data);

      if (mimeType === "text/plain" && !bodyText) {
        bodyText = decoded;
      } else if (mimeType === "text/html" && !bodyHtml) {
        bodyHtml = decoded;
      }
    }
  }

  return { bodyText, bodyHtml };
}

/**
 * Extract attachments from message payload
 */
export function extractAttachments(
  payload?: GmailMessagePayload
): AttachmentInfo[] {
  if (!payload) return [];

  const attachments: AttachmentInfo[] = [];

  function processPartForAttachments(part: GmailMessagePart) {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        id: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType,
        size: part.body.size || 0,
      });
    }

    if (part.parts) {
      part.parts.forEach(processPartForAttachments);
    }
  }

  if (payload.parts) {
    payload.parts.forEach(processPartForAttachments);
  }

  return attachments;
}

// ─────────────────────────────────────────────────────────────
// Contact Parsing
// ─────────────────────────────────────────────────────────────

/**
 * Parse a Google Contact into a simplified format
 */
export function parseGoogleContact(contact: GoogleContact): ParsedContact {
  const name =
    contact.names?.[0]?.displayName ||
    contact.emailAddresses?.[0]?.value ||
    "Unknown";
  const firstName = contact.names?.[0]?.givenName;
  const lastName = contact.names?.[0]?.familyName;

  const emails = (contact.emailAddresses || [])
    .map((e) => e.value)
    .filter((e): e is string => !!e);

  const phones = (contact.phoneNumbers || [])
    .map((p) => p.value)
    .filter((p): p is string => !!p);

  const birthday = contact.birthdays?.[0]?.date;
  let birthdayDate: Date | undefined;
  if (birthday && birthday.year && birthday.month && birthday.day) {
    birthdayDate = new Date(birthday.year, birthday.month - 1, birthday.day);
  }

  return {
    resourceName: contact.resourceName,
    etag: contact.etag,
    name,
    firstName,
    lastName,
    email: emails[0],
    emails,
    phone: phones[0],
    phones,
    company: contact.organizations?.[0]?.name,
    title: contact.organizations?.[0]?.title,
    photoUrl: contact.photos?.find((p) => !p.default)?.url,
    address: contact.addresses?.[0]?.formattedValue,
    birthday: birthdayDate,
    notes: contact.biographies?.[0]?.value,
  };
}

// ─────────────────────────────────────────────────────────────
// Message Composition
// ─────────────────────────────────────────────────────────────

/**
 * Build a raw RFC 2822 email message from parameters
 */
export function buildRawMessage(params: SendMessageParams): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const headers: string[] = [`From: me`, `To: ${params.to.join(", ")}`];

  if (params.cc?.length) {
    headers.push(`Cc: ${params.cc.join(", ")}`);
  }
  if (params.bcc?.length) {
    headers.push(`Bcc: ${params.bcc.join(", ")}`);
  }

  headers.push(`Subject: ${encodeSubject(params.subject)}`);
  headers.push(`MIME-Version: 1.0`);

  if (params.inReplyTo) {
    headers.push(`In-Reply-To: ${params.inReplyTo}`);
  }
  if (params.references?.length) {
    headers.push(`References: ${params.references.join(" ")}`);
  }

  // Build body
  let body: string;

  if (params.bodyHtml) {
    // Multipart message with text and HTML
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

    body = [
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      ``,
      params.body,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      ``,
      params.bodyHtml,
      ``,
      `--${boundary}--`,
    ].join("\r\n");
  } else {
    // Plain text only
    headers.push(`Content-Type: text/plain; charset="UTF-8"`);
    body = params.body;
  }

  const message = [...headers, "", body].join("\r\n");
  return encodeBase64Url(message);
}

/**
 * Encode subject for email header (handles special characters)
 */
function encodeSubject(subject: string): string {
  // Check if subject needs encoding (contains non-ASCII or special chars)
  if (/^[\x20-\x7E]*$/.test(subject)) {
    return subject;
  }

  // Use RFC 2047 encoded-word for UTF-8
  const encoded = Buffer.from(subject, "utf-8").toString("base64");
  return `=?UTF-8?B?${encoded}?=`;
}

// ─────────────────────────────────────────────────────────────
// Base64 URL Encoding/Decoding
// ─────────────────────────────────────────────────────────────

/**
 * Decode base64url encoded string
 */
export function decodeBase64Url(data: string): string {
  // Convert base64url to base64
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");

  // Add padding if needed
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);

  // Decode
  return Buffer.from(padded, "base64").toString("utf-8");
}

/**
 * Encode string to base64url
 */
export function encodeBase64Url(data: string): string {
  return Buffer.from(data, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ─────────────────────────────────────────────────────────────
// Label Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Check if a label ID is a system label
 */
export function isSystemLabel(labelId: string): boolean {
  const systemLabels = [
    "INBOX",
    "SENT",
    "DRAFT",
    "TRASH",
    "SPAM",
    "STARRED",
    "UNREAD",
    "IMPORTANT",
    "CATEGORY_PERSONAL",
    "CATEGORY_SOCIAL",
    "CATEGORY_PROMOTIONS",
    "CATEGORY_UPDATES",
    "CATEGORY_FORUMS",
    "CHAT",
  ];
  return systemLabels.includes(labelId);
}

/**
 * Get human-readable label name
 */
export function getLabelDisplayName(labelId: string): string {
  const displayNames: Record<string, string> = {
    INBOX: "Inbox",
    SENT: "Sent",
    DRAFT: "Drafts",
    TRASH: "Trash",
    SPAM: "Spam",
    STARRED: "Starred",
    UNREAD: "Unread",
    IMPORTANT: "Important",
    CATEGORY_PERSONAL: "Primary",
    CATEGORY_SOCIAL: "Social",
    CATEGORY_PROMOTIONS: "Promotions",
    CATEGORY_UPDATES: "Updates",
    CATEGORY_FORUMS: "Forums",
    CHAT: "Chat",
  };
  return displayNames[labelId] || labelId;
}

// ─────────────────────────────────────────────────────────────
// Query Building
// ─────────────────────────────────────────────────────────────

/**
 * Build a Gmail search query from parameters
 */
export function buildSearchQuery(params: {
  from?: string;
  to?: string;
  subject?: string;
  hasAttachment?: boolean;
  after?: Date;
  before?: Date;
  labelIds?: string[];
  isUnread?: boolean;
  isStarred?: boolean;
  query?: string;
}): string {
  const parts: string[] = [];

  if (params.from) parts.push(`from:${params.from}`);
  if (params.to) parts.push(`to:${params.to}`);
  if (params.subject) parts.push(`subject:${params.subject}`);
  if (params.hasAttachment) parts.push(`has:attachment`);
  if (params.after) parts.push(`after:${formatDateForQuery(params.after)}`);
  if (params.before) parts.push(`before:${formatDateForQuery(params.before)}`);
  if (params.isUnread) parts.push(`is:unread`);
  if (params.isStarred) parts.push(`is:starred`);
  if (params.labelIds?.length) {
    params.labelIds.forEach((l) => parts.push(`label:${l}`));
  }
  if (params.query) parts.push(params.query);

  return parts.join(" ");
}

/**
 * Format a date for Gmail query (YYYY/MM/DD)
 */
function formatDateForQuery(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}/${month}/${day}`;
}

// ─────────────────────────────────────────────────────────────
// HTML Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Strip HTML tags to get plain text
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}
