// ═══════════════════════════════════════════════════════════════════════════
// Gmail Test Fixtures - Messages
// Mock Gmail message data for testing
// ═══════════════════════════════════════════════════════════════════════════

import type {
  GmailMessage,
  GmailThread,
  ParsedGmailMessage,
} from "@/integrations/gmail";

// ─────────────────────────────────────────────────────────────
// Raw Gmail Message Fixtures
// ─────────────────────────────────────────────────────────────

/**
 * Simple text-only email
 */
export const simpleTextMessage: GmailMessage = {
  id: "msg_simple_text_001",
  threadId: "thread_001",
  labelIds: ["INBOX", "UNREAD"],
  snippet: "This is a simple test email with plain text content.",
  historyId: "12345",
  internalDate: "1703145600000", // Dec 21, 2024
  payload: {
    mimeType: "text/plain",
    headers: [
      { name: "From", value: "sender@example.com" },
      { name: "To", value: "recipient@example.com" },
      { name: "Subject", value: "Simple Test Email" },
      { name: "Date", value: "Sat, 21 Dec 2024 10:00:00 -0000" },
      { name: "Message-ID", value: "<simple-001@example.com>" },
    ],
    body: {
      data: Buffer.from(
        "This is a simple test email with plain text content."
      ).toString("base64"),
    },
  },
};

/**
 * Email with HTML body
 */
export const htmlMessage: GmailMessage = {
  id: "msg_html_001",
  threadId: "thread_002",
  labelIds: ["INBOX", "IMPORTANT"],
  snippet: "This is an HTML email preview...",
  historyId: "12346",
  internalDate: "1703145700000",
  payload: {
    mimeType: "multipart/alternative",
    headers: [
      { name: "From", value: "John Doe <john@example.com>" },
      {
        name: "To",
        value: "Jane Smith <jane@example.com>, Bob <bob@example.com>",
      },
      { name: "Cc", value: "manager@example.com" },
      { name: "Subject", value: "Meeting Follow-up" },
      { name: "Date", value: "Sat, 21 Dec 2024 11:00:00 -0000" },
      { name: "Message-ID", value: "<html-001@example.com>" },
      { name: "In-Reply-To", value: "<original-001@example.com>" },
      { name: "References", value: "<original-001@example.com>" },
    ],
    parts: [
      {
        mimeType: "text/plain",
        body: {
          data: Buffer.from("This is the plain text version.").toString(
            "base64"
          ),
        },
      },
      {
        mimeType: "text/html",
        body: {
          data: Buffer.from(
            "<p>This is the <strong>HTML</strong> version.</p>"
          ).toString("base64"),
        },
      },
    ],
  },
};

/**
 * Email with attachment
 */
export const attachmentMessage: GmailMessage = {
  id: "msg_attachment_001",
  threadId: "thread_003",
  labelIds: ["INBOX", "STARRED"],
  snippet: "Please see the attached document.",
  historyId: "12347",
  internalDate: "1703145800000",
  payload: {
    mimeType: "multipart/mixed",
    headers: [
      { name: "From", value: "documents@company.com" },
      { name: "To", value: "recipient@example.com" },
      { name: "Subject", value: "Document Attached" },
      { name: "Date", value: "Sat, 21 Dec 2024 12:00:00 -0000" },
      { name: "Message-ID", value: "<attach-001@example.com>" },
    ],
    parts: [
      {
        mimeType: "text/plain",
        body: {
          data: Buffer.from("Please see the attached document.").toString(
            "base64"
          ),
        },
      },
      {
        mimeType: "application/pdf",
        filename: "report.pdf",
        body: {
          attachmentId: "attachment_id_001",
          size: 102400,
        },
      },
    ],
  },
};

/**
 * Draft message
 */
export const draftMessage: GmailMessage = {
  id: "msg_draft_001",
  threadId: "thread_004",
  labelIds: ["DRAFT"],
  snippet: "This is a draft email...",
  historyId: "12348",
  internalDate: "1703145900000",
  payload: {
    mimeType: "text/plain",
    headers: [
      { name: "From", value: "me@example.com" },
      { name: "To", value: "recipient@example.com" },
      { name: "Subject", value: "Draft Email" },
      { name: "Date", value: "Sat, 21 Dec 2024 13:00:00 -0000" },
    ],
    body: {
      data: Buffer.from("This is a draft email in progress...").toString(
        "base64"
      ),
    },
  },
};

/**
 * Email with deadlines and action items (for content extraction testing)
 */
export const actionableMessage: GmailMessage = {
  id: "msg_actionable_001",
  threadId: "thread_005",
  labelIds: ["INBOX", "UNREAD", "IMPORTANT"],
  snippet: "Please review the proposal by Friday...",
  historyId: "12349",
  internalDate: "1703146000000",
  payload: {
    mimeType: "text/plain",
    headers: [
      { name: "From", value: "Manager <manager@company.com>" },
      { name: "To", value: "team@company.com" },
      { name: "Subject", value: "URGENT: Project Deadline Update" },
      { name: "Date", value: "Sat, 21 Dec 2024 14:00:00 -0000" },
      { name: "Message-ID", value: "<actionable-001@company.com>" },
    ],
    body: {
      data: Buffer.from(
        `Hi Team,

Please review the proposal by Friday, December 27th.

Action items:
1. Review the budget spreadsheet
2. Submit your feedback by end of day Wednesday
3. Schedule a meeting with John for next week

The client deadline is January 5th, 2025, so time is critical.

Thanks,
Manager`
      ).toString("base64"),
    },
  },
};

// ─────────────────────────────────────────────────────────────
// Thread Fixtures
// ─────────────────────────────────────────────────────────────

/**
 * Thread with multiple messages
 */
export const conversationThread: GmailThread = {
  id: "thread_conversation_001",
  historyId: "12350",
  snippet: "Thanks for the update!",
  messages: [
    {
      id: "msg_conv_001",
      threadId: "thread_conversation_001",
      labelIds: ["INBOX"],
      snippet: "Initial message...",
      historyId: "12350",
      internalDate: "1703140000000",
      payload: {
        mimeType: "text/plain",
        headers: [
          { name: "From", value: "alice@example.com" },
          { name: "To", value: "bob@example.com" },
          { name: "Subject", value: "Project Discussion" },
          { name: "Date", value: "Sat, 21 Dec 2024 08:00:00 -0000" },
          { name: "Message-ID", value: "<conv-001@example.com>" },
        ],
        body: {
          data: Buffer.from(
            "Hey Bob, what do you think about the new project?"
          ).toString("base64"),
        },
      },
    },
    {
      id: "msg_conv_002",
      threadId: "thread_conversation_001",
      labelIds: ["INBOX"],
      snippet: "I think it's great...",
      historyId: "12351",
      internalDate: "1703142000000",
      payload: {
        mimeType: "text/plain",
        headers: [
          { name: "From", value: "bob@example.com" },
          { name: "To", value: "alice@example.com" },
          { name: "Subject", value: "Re: Project Discussion" },
          { name: "Date", value: "Sat, 21 Dec 2024 09:00:00 -0000" },
          { name: "Message-ID", value: "<conv-002@example.com>" },
          { name: "In-Reply-To", value: "<conv-001@example.com>" },
        ],
        body: {
          data: Buffer.from(
            "I think it's great! Let's schedule a call."
          ).toString("base64"),
        },
      },
    },
    {
      id: "msg_conv_003",
      threadId: "thread_conversation_001",
      labelIds: ["INBOX", "UNREAD"],
      snippet: "Thanks for the update!",
      historyId: "12352",
      internalDate: "1703144000000",
      payload: {
        mimeType: "text/plain",
        headers: [
          { name: "From", value: "alice@example.com" },
          { name: "To", value: "bob@example.com" },
          { name: "Subject", value: "Re: Project Discussion" },
          { name: "Date", value: "Sat, 21 Dec 2024 10:00:00 -0000" },
          { name: "Message-ID", value: "<conv-003@example.com>" },
          { name: "In-Reply-To", value: "<conv-002@example.com>" },
        ],
        body: {
          data: Buffer.from("Sounds good! How about Tuesday at 2pm?").toString(
            "base64"
          ),
        },
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────
// Parsed Message Fixtures (for tests that need parsed format)
// ─────────────────────────────────────────────────────────────

export const expectedParsedSimpleMessage: Partial<ParsedGmailMessage> = {
  id: "msg_simple_text_001",
  threadId: "thread_001",
  labelIds: ["INBOX", "UNREAD"],
  subject: "Simple Test Email",
  snippet: "This is a simple test email with plain text content.",
  bodyText: "This is a simple test email with plain text content.",
  isRead: false,
  isStarred: false,
  isImportant: false,
  isDraft: false,
  hasAttachments: false,
  from: {
    email: "sender@example.com",
  },
  to: [{ email: "recipient@example.com" }],
};

// ─────────────────────────────────────────────────────────────
// Message List Response Fixtures
// ─────────────────────────────────────────────────────────────

export const messageListResponse = {
  messages: [
    { id: "msg_001", threadId: "thread_001" },
    { id: "msg_002", threadId: "thread_002" },
    { id: "msg_003", threadId: "thread_003" },
  ],
  nextPageToken: "token_page_2",
  resultSizeEstimate: 100,
};

// ─────────────────────────────────────────────────────────────
// History Response Fixtures
// ─────────────────────────────────────────────────────────────

export const historyListResponse = {
  history: [
    {
      id: "12346",
      messagesAdded: [
        { message: { id: "msg_new_001", threadId: "thread_new" } },
      ],
    },
    {
      id: "12347",
      messagesDeleted: [{ message: { id: "msg_deleted_001" } }],
    },
    {
      id: "12348",
      labelsAdded: [{ message: { id: "msg_001" }, labelIds: ["STARRED"] }],
    },
  ],
  nextPageToken: undefined,
  historyId: "12350",
};

// ─────────────────────────────────────────────────────────────
// Label Fixtures
// ─────────────────────────────────────────────────────────────

export const labelFixtures = [
  {
    id: "INBOX",
    name: "INBOX",
    type: "system",
    messagesTotal: 100,
    messagesUnread: 5,
  },
  {
    id: "SENT",
    name: "SENT",
    type: "system",
    messagesTotal: 50,
  },
  {
    id: "Label_1",
    name: "Work",
    type: "user",
    messagesTotal: 25,
    messagesUnread: 3,
    color: {
      backgroundColor: "#4285f4",
      textColor: "#ffffff",
    },
  },
  {
    id: "Label_2",
    name: "Personal",
    type: "user",
    messagesTotal: 15,
    messagesUnread: 0,
  },
];

// ─────────────────────────────────────────────────────────────
// Profile Fixture
// ─────────────────────────────────────────────────────────────

export const profileFixture = {
  emailAddress: "user@example.com",
  messagesTotal: 5000,
  threadsTotal: 3000,
  historyId: "12345",
};
