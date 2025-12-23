// ═══════════════════════════════════════════════════════════════════════════
// Gmail Integration Types
// TypeScript type definitions for Gmail API interactions
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Message Types
// ─────────────────────────────────────────────────────────────

/**
 * A header in a Gmail message payload
 */
export interface GmailHeader {
  name: string;
  value: string;
}

/**
 * A part of a multipart message
 */
export interface GmailMessagePart {
  partId?: string;
  mimeType: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: {
    attachmentId?: string;
    size?: number;
    data?: string; // Base64url encoded
  };
  parts?: GmailMessagePart[];
}

/**
 * Message payload structure
 */
export interface GmailMessagePayload {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: {
    attachmentId?: string;
    size?: number;
    data?: string; // Base64url encoded
  };
  parts?: GmailMessagePart[];
}

/**
 * A Gmail message as returned by the API
 */
export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  internalDate?: string;
  payload?: GmailMessagePayload;
  sizeEstimate?: number;
  raw?: string;
}

/**
 * Parsed message with convenient access to common fields
 */
export interface ParsedGmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId: string;
  internalDate: Date;

  // Headers
  subject: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  replyTo?: EmailAddress;
  messageId?: string;
  references?: string[];
  inReplyTo?: string;
  date: Date;

  // Content
  bodyText?: string;
  bodyHtml?: string;

  // Metadata
  isRead: boolean;
  isStarred: boolean;
  isImportant: boolean;
  isDraft: boolean;
  hasAttachments: boolean;
  attachments: AttachmentInfo[];

  // Raw for reference
  raw?: GmailMessage;
}

/**
 * Parsed email address
 */
export interface EmailAddress {
  email: string;
  name?: string;
}

/**
 * Attachment information (without actual content)
 */
export interface AttachmentInfo {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

// ─────────────────────────────────────────────────────────────
// Thread Types
// ─────────────────────────────────────────────────────────────

/**
 * A Gmail thread
 */
export interface GmailThread {
  id: string;
  historyId?: string;
  messages?: GmailMessage[];
  snippet?: string;
}

/**
 * Parsed thread with messages
 */
export interface ParsedGmailThread {
  id: string;
  historyId: string;
  snippet: string;
  messages: ParsedGmailMessage[];
  subject: string;
  participants: EmailAddress[];
  latestDate: Date;
  messageCount: number;
  labelIds: string[];
}

// ─────────────────────────────────────────────────────────────
// Label Types
// ─────────────────────────────────────────────────────────────

/**
 * A Gmail label
 */
export interface GmailLabel {
  id: string;
  name: string;
  messageListVisibility?: "show" | "hide";
  labelListVisibility?: "labelShow" | "labelShowIfUnread" | "labelHide";
  type: "system" | "user";
  messagesTotal?: number;
  messagesUnread?: number;
  threadsTotal?: number;
  threadsUnread?: number;
  color?: {
    textColor?: string;
    backgroundColor?: string;
  };
}

/**
 * Well-known system label IDs
 */
export const SYSTEM_LABELS = {
  INBOX: "INBOX",
  SENT: "SENT",
  DRAFT: "DRAFT",
  TRASH: "TRASH",
  SPAM: "SPAM",
  STARRED: "STARRED",
  UNREAD: "UNREAD",
  IMPORTANT: "IMPORTANT",
  CATEGORY_PERSONAL: "CATEGORY_PERSONAL",
  CATEGORY_SOCIAL: "CATEGORY_SOCIAL",
  CATEGORY_PROMOTIONS: "CATEGORY_PROMOTIONS",
  CATEGORY_UPDATES: "CATEGORY_UPDATES",
  CATEGORY_FORUMS: "CATEGORY_FORUMS",
} as const;

export type SystemLabelId = (typeof SYSTEM_LABELS)[keyof typeof SYSTEM_LABELS];

// ─────────────────────────────────────────────────────────────
// Draft Types
// ─────────────────────────────────────────────────────────────

/**
 * A Gmail draft
 */
export interface GmailDraft {
  id: string;
  message?: GmailMessage;
}

// ─────────────────────────────────────────────────────────────
// History Types
// ─────────────────────────────────────────────────────────────

/**
 * A history record representing changes
 */
export interface GmailHistory {
  id: string;
  messages?: GmailMessage[];
  messagesAdded?: Array<{ message: GmailMessage }>;
  messagesDeleted?: Array<{ message: GmailMessage }>;
  labelsAdded?: Array<{
    message: GmailMessage;
    labelIds: string[];
  }>;
  labelsRemoved?: Array<{
    message: GmailMessage;
    labelIds: string[];
  }>;
}

/**
 * History list response
 */
export interface GmailHistoryList {
  history?: GmailHistory[];
  nextPageToken?: string;
  historyId?: string;
}

// ─────────────────────────────────────────────────────────────
// Contact Types (People API)
// ─────────────────────────────────────────────────────────────

/**
 * A Google Contact from People API
 */
export interface GoogleContact {
  resourceName: string;
  etag?: string;
  metadata?: {
    sources?: Array<{
      type: string;
      id: string;
      etag?: string;
      updateTime?: string;
    }>;
    deleted?: boolean;
  };
  names?: Array<{
    displayName?: string;
    familyName?: string;
    givenName?: string;
    middleName?: string;
    displayNameLastFirst?: string;
  }>;
  emailAddresses?: Array<{
    value?: string;
    type?: string;
    formattedType?: string;
  }>;
  phoneNumbers?: Array<{
    value?: string;
    type?: string;
    formattedType?: string;
  }>;
  organizations?: Array<{
    name?: string;
    title?: string;
    department?: string;
  }>;
  photos?: Array<{
    url?: string;
    default?: boolean;
  }>;
  addresses?: Array<{
    formattedValue?: string;
    type?: string;
    streetAddress?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  }>;
  birthdays?: Array<{
    date?: {
      year?: number;
      month?: number;
      day?: number;
    };
  }>;
  biographies?: Array<{
    value?: string;
    contentType?: string;
  }>;
}

/**
 * Simplified contact representation
 */
export interface ParsedContact {
  resourceName: string;
  etag?: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  emails: string[];
  phone?: string;
  phones: string[];
  company?: string;
  title?: string;
  photoUrl?: string;
  address?: string;
  birthday?: Date;
  notes?: string;
}

// ─────────────────────────────────────────────────────────────
// Client Options Types
// ─────────────────────────────────────────────────────────────

/**
 * Options for listing messages
 */
export interface ListMessagesOptions {
  /** Gmail search query (same as search box) */
  query?: string;
  /** Maximum number of messages to return */
  maxResults?: number;
  /** Page token for pagination */
  pageToken?: string;
  /** Label IDs to filter by */
  labelIds?: string[];
  /** Include spam and trash */
  includeSpamTrash?: boolean;
}

/**
 * Options for listing threads
 */
export interface ListThreadsOptions {
  query?: string;
  maxResults?: number;
  pageToken?: string;
  labelIds?: string[];
  includeSpamTrash?: boolean;
}

/**
 * Message format when fetching
 */
export type MessageFormat = "minimal" | "full" | "raw" | "metadata";

/**
 * Options for getting a message
 */
export interface GetMessageOptions {
  format?: MessageFormat;
  metadataHeaders?: string[];
}

/**
 * Options for listing contacts
 */
export interface ListContactsOptions {
  pageSize?: number;
  pageToken?: string;
  /** Fields to request (default includes common fields) */
  personFields?: string[];
  /** Filter by source type */
  sources?: ("READ_SOURCE_TYPE_CONTACT" | "READ_SOURCE_TYPE_PROFILE")[];
  /** Sort order */
  sortOrder?:
    | "LAST_MODIFIED_ASCENDING"
    | "LAST_MODIFIED_DESCENDING"
    | "FIRST_NAME_ASCENDING"
    | "LAST_NAME_ASCENDING";
}

/**
 * Options for listing history
 */
export interface ListHistoryOptions {
  startHistoryId: string;
  pageToken?: string;
  maxResults?: number;
  labelId?: string;
  historyTypes?: (
    | "messageAdded"
    | "messageDeleted"
    | "labelAdded"
    | "labelRemoved"
  )[];
}

// ─────────────────────────────────────────────────────────────
// Response Types
// ─────────────────────────────────────────────────────────────

/**
 * Paginated message list response
 */
export interface GmailMessageList {
  messages: GmailMessage[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

/**
 * Paginated thread list response
 */
export interface GmailThreadList {
  threads: GmailThread[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

/**
 * Paginated contact list response
 */
export interface GoogleContactList {
  contacts: GoogleContact[];
  nextPageToken?: string;
  totalItems?: number;
}

// ─────────────────────────────────────────────────────────────
// Send/Draft Types
// ─────────────────────────────────────────────────────────────

/**
 * Parameters for sending a message
 */
export interface SendMessageParams {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string[];
}

/**
 * Parameters for creating a draft
 */
export interface CreateDraftParams extends SendMessageParams {
  threadId?: string;
}

/**
 * Parameters for updating a draft
 */
export interface UpdateDraftParams extends SendMessageParams {
  draftId: string;
}

// ─────────────────────────────────────────────────────────────
// Profile Types
// ─────────────────────────────────────────────────────────────

/**
 * Gmail user profile
 */
export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

// ─────────────────────────────────────────────────────────────
// Rate Limit Types
// ─────────────────────────────────────────────────────────────

/**
 * Gmail API quota units
 * Different operations consume different quota amounts
 */
export const GMAIL_QUOTA_UNITS = {
  // Read operations
  "messages.list": 5,
  "messages.get": 5,
  "threads.list": 10,
  "threads.get": 10,
  "labels.list": 1,
  "labels.get": 1,
  "history.list": 2,
  "users.getProfile": 1,
  "drafts.list": 5,
  "drafts.get": 5,

  // Write operations
  "messages.send": 100,
  "drafts.create": 10,
  "drafts.update": 10,
  "drafts.send": 100,
  "drafts.delete": 10,
  "messages.modify": 5,
  "messages.trash": 5,
  "messages.untrash": 5,
  "messages.delete": 10,
  "threads.trash": 5,
  "threads.untrash": 5,
  "labels.create": 5,
  "labels.delete": 5,

  // People API (Contacts) operations
  "contacts.list": 5,
  "contacts.get": 5,
  "contacts.search": 5,
} as const;

export type GmailOperation = keyof typeof GMAIL_QUOTA_UNITS;
