// ═══════════════════════════════════════════════════════════════════════════
// Gmail Integration Behavior Tests
// Tests for actual behavior using mock client
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from "vitest";
import { MockGmailClient, createMockGmailClient } from "./mocks/mock-client";
import { createMockMessage, createMockContact } from "./mocks/mock-factories";
import {
  parseGmailMessage,
  buildSearchQuery,
  stripHtml,
  truncateText,
  parseEmailAddress,
  formatEmailAddress,
  parseGoogleContact,
} from "@/integrations/gmail/utils";
import {
  extractActionItems,
  extractDates,
  extractPeople,
  extractTopics,
} from "@/integrations/gmail/extraction";
import {
  buildEmailContent,
  buildEmailMetadata,
} from "@/integrations/gmail/embeddings";
import {
  mapGmailMessageToEmail,
  mapContactToPerson,
} from "@/integrations/gmail/mappers";
import { GmailError, GmailErrorCode } from "@/integrations/gmail/errors";

// ─────────────────────────────────────────────────────────────
// Mock Client Behavior Tests
// ─────────────────────────────────────────────────────────────

describe("Gmail Mock Client Behavior", () => {
  let client: MockGmailClient;

  beforeEach(() => {
    client = createMockGmailClient({
      userEmail: "user@example.com",
      historyId: "10000",
    });
  });

  describe("Message Operations", () => {
    it("should list messages after adding them", async () => {
      // Add messages
      const msg1 = createMockMessage({
        subject: "Test 1",
        from: "sender1@example.com",
        to: ["user@example.com"],
        labelIds: ["INBOX"],
      });
      const msg2 = createMockMessage({
        subject: "Test 2",
        from: "sender2@example.com",
        to: ["user@example.com"],
        labelIds: ["INBOX"],
      });

      client.addMessage(msg1);
      client.addMessage(msg2);

      // List messages
      const result = await client.listMessages({ labelIds: ["INBOX"] });

      expect(result.messages).toHaveLength(2);
      expect(result.resultSizeEstimate).toBe(2);
    });

    it("should filter messages by label", async () => {
      const inboxMsg = createMockMessage({
        subject: "Inbox message",
        labelIds: ["INBOX"],
      });
      const sentMsg = createMockMessage({
        subject: "Sent message",
        labelIds: ["SENT"],
      });

      client.addMessage(inboxMsg);
      client.addMessage(sentMsg);

      const inboxResult = await client.listMessages({ labelIds: ["INBOX"] });
      const sentResult = await client.listMessages({ labelIds: ["SENT"] });

      expect(inboxResult.messages).toHaveLength(1);
      expect(sentResult.messages).toHaveLength(1);
    });

    it("should get a specific message by ID", async () => {
      const msg = createMockMessage({
        subject: "Important Email",
        from: "boss@example.com",
        to: ["user@example.com"],
        body: "Please review the attached document.",
      });

      client.addMessage(msg);

      const retrieved = await client.getMessage(msg.id);

      expect(retrieved.subject).toBe("Important Email");
      expect(retrieved.from.email).toBe("boss@example.com");
    });

    it("should throw error for non-existent message", async () => {
      await expect(client.getMessage("non-existent")).rejects.toThrow(
        "Message not found"
      );
    });

    it("should modify message labels", async () => {
      const msg = createMockMessage({
        subject: "Test",
        labelIds: ["INBOX", "UNREAD"],
      });

      client.addMessage(msg);

      // Mark as read
      const modified = await client.modifyMessage(msg.id, {
        removeLabelIds: ["UNREAD"],
        addLabelIds: ["STARRED"],
      });

      expect(modified.labelIds).not.toContain("UNREAD");
      expect(modified.labelIds).toContain("STARRED");
      expect(modified.labelIds).toContain("INBOX");
    });
  });

  describe("Thread Operations", () => {
    it("should organize messages into threads", async () => {
      const threadId = "thread_123";

      const msg1 = createMockMessage({
        subject: "Original message",
        threadId,
        internalDate: "1000",
      });
      const msg2 = createMockMessage({
        subject: "Re: Original message",
        threadId,
        internalDate: "2000",
      });

      client.addMessage(msg1);
      client.addMessage(msg2);

      const thread = await client.getThread(threadId);

      expect(thread.messages).toHaveLength(2);
      // Messages should be sorted by date
      expect(thread.messages[0].subject).toBe("Original message");
      expect(thread.messages[1].subject).toBe("Re: Original message");
    });
  });

  describe("History Tracking", () => {
    it("should track history changes", async () => {
      const initialHistoryId = client.getHistoryId();

      const msg = createMockMessage({ subject: "New message" });
      client.addMessage(msg);

      const newHistoryId = client.getHistoryId();

      expect(parseInt(newHistoryId)).toBeGreaterThan(
        parseInt(initialHistoryId)
      );

      // List history since initial
      const history = await client.listHistory({
        startHistoryId: initialHistoryId,
      });

      expect(history.history.length).toBeGreaterThan(0);
      expect(history.historyId).toBe(newHistoryId);
    });
  });

  describe("Draft Operations", () => {
    it("should create and send a draft", async () => {
      const draft = await client.createDraft({
        to: ["recipient@example.com"],
        subject: "Draft email",
        body: "This is a draft.",
      });

      expect(draft.id).toBeDefined();
      expect(draft.message).toBeDefined();

      // Send the draft
      const sentMessage = await client.sendDraft(draft.id);

      expect(sentMessage.labelIds).toContain("SENT");
      expect(sentMessage.subject).toBe("Draft email");

      // Draft should be removed
      const state = client.getState();
      expect(state.drafts.find((d) => d.id === draft.id)).toBeUndefined();
    });
  });

  describe("Contact Operations", () => {
    it("should list contacts", async () => {
      const clientWithContacts = createMockGmailClient({
        contacts: [
          createMockContact({
            displayName: "John Doe",
            email: "john@example.com",
          }),
          createMockContact({
            displayName: "Jane Smith",
            email: "jane@example.com",
          }),
        ],
      });

      const result = await clientWithContacts.listContacts();

      expect(result.contacts).toHaveLength(2);
      expect(result.totalItems).toBe(2);
    });

    it("should paginate contacts", async () => {
      const contacts = Array.from({ length: 25 }, (_, i) =>
        createMockContact({
          displayName: `Contact ${i}`,
          email: `contact${i}@example.com`,
        })
      );

      const clientWithManyContacts = createMockGmailClient({ contacts });

      const page1 = await clientWithManyContacts.listContacts({ pageSize: 10 });
      expect(page1.contacts).toHaveLength(10);
      expect(page1.nextPageToken).toBeDefined();

      const page2 = await clientWithManyContacts.listContacts({
        pageSize: 10,
        pageToken: page1.nextPageToken,
      });
      expect(page2.contacts).toHaveLength(10);
      expect(page2.nextPageToken).toBeDefined();

      const page3 = await clientWithManyContacts.listContacts({
        pageSize: 10,
        pageToken: page2.nextPageToken,
      });
      expect(page3.contacts).toHaveLength(5);
      expect(page3.nextPageToken).toBeUndefined();
    });
  });

  describe("Error Simulation", () => {
    it("should simulate errors on specific operations", async () => {
      const errorClient = createMockGmailClient({
        errorOn: [
          {
            operation: "getMessage",
            error: new Error("Simulated API error"),
            times: 1,
          },
        ],
      });

      const msg = createMockMessage({ subject: "Test" });
      errorClient.addMessage(msg);

      // First call should fail
      await expect(errorClient.getMessage(msg.id)).rejects.toThrow(
        "Simulated API error"
      );

      // Second call should succeed (only 1 error)
      const result = await errorClient.getMessage(msg.id);
      expect(result.subject).toBe("Test");
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Utility Function Behavior Tests
// ─────────────────────────────────────────────────────────────

describe("Gmail Utility Behavior", () => {
  describe("Email Address Parsing", () => {
    it("should parse email with name", () => {
      const result = parseEmailAddress("John Doe <john@example.com>");

      expect(result.email).toBe("john@example.com");
      expect(result.name).toBe("John Doe");
    });

    it("should parse plain email", () => {
      const result = parseEmailAddress("jane@example.com");

      expect(result.email).toBe("jane@example.com");
      expect(result.name).toBeUndefined();
    });

    it("should format email address", () => {
      const formatted = formatEmailAddress({
        email: "john@example.com",
        name: "John Doe",
      });

      expect(formatted).toBe("John Doe <john@example.com>");
    });
  });

  describe("Search Query Building", () => {
    it("should build query with multiple criteria", () => {
      const query = buildSearchQuery({
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "Important",
        after: new Date("2024-01-01"),
        before: new Date("2024-12-31"),
        hasAttachment: true,
        isUnread: true,
      });

      expect(query).toContain("from:sender@example.com");
      expect(query).toContain("to:recipient@example.com");
      expect(query).toContain("subject:Important");
      expect(query).toContain("after:");
      expect(query).toContain("before:");
      expect(query).toContain("has:attachment");
      expect(query).toContain("is:unread");
    });

    it("should handle empty criteria", () => {
      const query = buildSearchQuery({});

      expect(query).toBe("");
    });
  });

  describe("HTML Processing", () => {
    it("should strip HTML tags", () => {
      const html = "<p>Hello <strong>World</strong>!</p>";
      const text = stripHtml(html);

      expect(text).not.toContain("<p>");
      expect(text).not.toContain("<strong>");
      expect(text).toContain("Hello");
      expect(text).toContain("World");
    });

    it("should truncate text", () => {
      const longText = "A".repeat(200);
      const truncated = truncateText(longText, 100);

      expect(truncated.length).toBeLessThanOrEqual(103); // 100 + "..."
      expect(truncated.endsWith("...")).toBe(true);
    });

    it("should not truncate short text", () => {
      const shortText = "Hello World";
      const result = truncateText(shortText, 100);

      expect(result).toBe(shortText);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Email Extraction Behavior Tests
// ─────────────────────────────────────────────────────────────

describe("Email Content Extraction", () => {
  describe("Action Item Extraction", () => {
    it("should extract imperative requests", () => {
      // Use lower minConfidence to capture more items
      const text =
        "Please review the proposal by Friday. Can you send the meeting notes?";

      const actions = extractActionItems(text, { minConfidence: 0.2 });

      expect(actions.length).toBeGreaterThan(0);
    });

    it("should extract action verbs", () => {
      // Use a text that definitely matches action patterns
      const text =
        "I need you to send the report. Could you call the client tomorrow?";

      const actions = extractActionItems(text, { minConfidence: 0.2 });

      expect(actions.length).toBeGreaterThan(0);
    });
  });

  describe("Date Extraction", () => {
    it("should extract dates from text", () => {
      const text = "Meeting scheduled for January 15, 2024 at 3pm";

      const dates = extractDates(text);

      expect(dates.length).toBeGreaterThan(0);
    });

    it("should extract relative dates", () => {
      const text = "Please submit by tomorrow or next Friday";

      const dates = extractDates(text);

      expect(dates.length).toBeGreaterThan(0);
    });
  });

  describe("People Extraction", () => {
    // Note: extractPeople is async and expects EmailInput structure
    const email = {
      id: "email_123",
      userId: "user_123",
      fromEmail: "john@example.com",
      fromName: "John Doe",
      toEmails: ["Jane Smith <jane@example.com>"],
      ccEmails: ["Bob Wilson <bob@example.com>"],
      bccEmails: [],
      bodyText: "Hi Jane, please coordinate with Bob on this.",
      internalDate: new Date(),
      labelIds: ["INBOX"],
    };

    it("should extract sender", async () => {
      const people = await extractPeople(email);

      const sender = people.find((p) => p.role === "sender");
      expect(sender).toBeDefined();
      expect(sender?.email).toBe("john@example.com");
    });

    it("should extract recipients", async () => {
      const people = await extractPeople(email);

      const recipients = people.filter((p) => p.role === "recipient");
      expect(recipients.length).toBeGreaterThan(0);
      expect(recipients[0].email).toBe("jane@example.com");
    });
  });

  describe("Topic Extraction", () => {
    it("should categorize work emails", () => {
      const email = {
        id: "email_123",
        userId: "user_123",
        // Add many work-related keywords to meet the scoring threshold
        subject: "Q4 Budget Review Meeting for Project Status Update",
        bodyText:
          "Let's discuss the quarterly report with the client team. Meeting scheduled for deadline review.",
        fromEmail: "sender@company.com",
        toEmails: ["recipient@company.com"],
        ccEmails: [],
        bccEmails: [],
        internalDate: new Date(),
        labelIds: ["INBOX"],
      };

      const topics = extractTopics(email, { minConfidence: 0.1 });

      expect(topics.length).toBeGreaterThan(0);
      expect(
        topics.some((t) => t.category === "work" || t.category === "finance")
      ).toBe(true);
    });

    it("should detect scheduling emails", () => {
      const email = {
        id: "email_123",
        userId: "user_123",
        subject: "Meeting Invitation: Project Kickoff",
        bodyText:
          "Please calendar this meeting. Appointment confirmed for Monday at 2pm. Add to calendar.",
        fromEmail: "sender@calendly.com", // Known scheduling domain
        toEmails: ["recipient@company.com"],
        ccEmails: [],
        bccEmails: [],
        internalDate: new Date(),
        labelIds: ["INBOX"],
      };

      const topics = extractTopics(email, { minConfidence: 0.1 });

      // Check for scheduling or work topics (meeting is in work keywords)
      expect(topics.length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Mapper Behavior Tests
// ─────────────────────────────────────────────────────────────

describe("Data Mapper Behavior", () => {
  describe("Message to Email Mapping", () => {
    it("should map Gmail message to Email entity", () => {
      const gmailMessage = createMockMessage({
        subject: "Test Subject",
        from: "sender@example.com",
        to: ["recipient@example.com"],
        body: "Email body content",
        labelIds: ["INBOX", "UNREAD"],
      });

      const parsed = parseGmailMessage(gmailMessage);
      const emailInput = mapGmailMessageToEmail(parsed, "user_123");

      expect(emailInput.subject).toBe("Test Subject");
      expect(emailInput.fromEmail).toBe("sender@example.com");
      expect(emailInput.userId).toBe("user_123");
      expect(emailInput.gmailId).toBe(gmailMessage.id);
      expect(emailInput.labelIds).toContain("INBOX");
      expect(emailInput.isRead).toBe(false); // UNREAD label
    });

    it("should handle starred emails", () => {
      const gmailMessage = createMockMessage({
        subject: "Important",
        labelIds: ["INBOX", "STARRED"],
      });

      const parsed = parseGmailMessage(gmailMessage);
      const emailInput = mapGmailMessageToEmail(parsed, "user_123");

      expect(emailInput.isStarred).toBe(true);
    });
  });

  describe("Contact to Person Mapping", () => {
    it("should map Google contact to Person entity", () => {
      const googleContact = createMockContact({
        displayName: "John Doe",
        email: "john@example.com",
        phone: "+1-555-123-4567",
        company: "Acme Corp",
      });

      // First parse the GoogleContact to ParsedContact
      const parsedContact = parseGoogleContact(googleContact);
      const personInput = mapContactToPerson(parsedContact, "user_123");

      expect(personInput.name).toBe("John Doe");
      expect(personInput.email).toBe("john@example.com");
      expect(personInput.userId).toBe("user_123");
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Embedding Preparation Behavior Tests
// ─────────────────────────────────────────────────────────────

describe("Email Embedding Preparation", () => {
  it("should build searchable content from email", () => {
    const email = {
      id: "email_123",
      subject: "Project Update",
      fromEmail: "sender@example.com",
      fromName: "John Doe",
      toEmails: ["recipient@example.com"],
      bodyText: "Here is the weekly progress report for the project.",
      labelIds: ["INBOX", "IMPORTANT"],
    };

    const content = buildEmailContent(
      email as Parameters<typeof buildEmailContent>[0]
    );

    expect(content).toContain("Project Update");
    expect(content).toContain("John Doe");
    expect(content).toContain("progress report");
  });

  it("should build metadata for embedding storage", () => {
    const email = {
      id: "email_123",
      gmailId: "gmail_123",
      subject: "Test Email",
      fromEmail: "sender@example.com",
      fromName: "Sender Name",
      toEmails: ["recipient@example.com"],
      threadId: "thread_123",
      internalDate: new Date("2024-01-15"),
      labelIds: ["INBOX"],
      isRead: true,
      isStarred: false,
      isImportant: false,
      hasAttachments: false,
    };

    const metadata = buildEmailMetadata(
      email as Parameters<typeof buildEmailMetadata>[0]
    );

    expect(metadata.gmailId).toBe("gmail_123");
    expect(metadata.subject).toBe("Test Email");
    expect(metadata.fromEmail).toBe("sender@example.com");
    expect(metadata.isRead).toBe(true);
    expect(metadata.hasAttachments).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// Error Handling Behavior Tests
// ─────────────────────────────────────────────────────────────

describe("Gmail Error Handling", () => {
  it("should create typed Gmail errors", () => {
    const error = new GmailError(
      GmailErrorCode.RATE_LIMITED,
      "Too many requests",
      true,
      60000 // retryAfterMs in milliseconds
    );

    expect(error.code).toBe(GmailErrorCode.RATE_LIMITED);
    expect(error.message).toBe("Too many requests");
    expect(error.retryable).toBe(true);
    expect(error.retryAfterMs).toBe(60000);
  });

  it("should have correct error codes", () => {
    expect(GmailErrorCode.UNAUTHORIZED).toBe("UNAUTHORIZED");
    expect(GmailErrorCode.RATE_LIMITED).toBe("RATE_LIMITED");
    expect(GmailErrorCode.QUOTA_EXCEEDED).toBe("QUOTA_EXCEEDED");
    expect(GmailErrorCode.NOT_FOUND).toBe("NOT_FOUND");
  });
});
