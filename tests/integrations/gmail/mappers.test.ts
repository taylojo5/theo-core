// ═══════════════════════════════════════════════════════════════════════════
// Gmail Mappers Tests
// Tests for mapping Gmail data to database entities
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import {
  mapContactToPerson,
  mapContactsToPersons,
  mapGmailLabelToEmailLabel,
  prepareEmailForEmbedding,
  prepareEmailEmbeddingMetadata,
  extractEmailParticipants,
  parseGmailMessage,
  parseGoogleContact,
} from "@/integrations/gmail";
import {
  fullContact,
  minimalContact,
  simpleTextMessage,
  htmlMessage,
} from "./fixtures";

// ─────────────────────────────────────────────────────────────
// Contact to Person Mapping
// ─────────────────────────────────────────────────────────────

describe("Contact to Person Mapping", () => {
  describe("mapContactToPerson", () => {
    it("should map full contact to person input", () => {
      const userId = "user_123";
      // mapContactToPerson takes ParsedContact, so we parse first
      const parsedContact = parseGoogleContact(fullContact);
      const result = mapContactToPerson(parsedContact, userId);

      expect(result.userId).toBe(userId);
      expect(result.name).toBe("John Smith");
      expect(result.email).toBe("john.smith@example.com");
      expect(result.phone).toBe("+1-555-123-4567");
      expect(result.company).toBe("Example Corp");
      expect(result.title).toBe("Software Engineer");
      expect(result.source).toBe("gmail");
      expect(result.sourceId).toBe("people/c123456789");
    });

    it("should map minimal contact", () => {
      const userId = "user_123";
      const parsedContact = parseGoogleContact(minimalContact);
      const result = mapContactToPerson(parsedContact, userId);

      expect(result.userId).toBe(userId);
      expect(result.name).toBe("minimal@example.com");
      expect(result.email).toBe("minimal@example.com");
      expect(result.source).toBe("gmail");
    });

    it("should include photo URL if available", () => {
      const userId = "user_123";
      const parsedContact = parseGoogleContact(fullContact);
      const result = mapContactToPerson(parsedContact, userId);

      expect(result.avatarUrl).toBe(
        "https://lh3.googleusercontent.com/photo123"
      );
    });

    it("should store full contact data in metadata", () => {
      const userId = "user_123";
      const parsedContact = parseGoogleContact(fullContact);
      const result = mapContactToPerson(parsedContact, userId);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.googleContact).toBeDefined();
      expect(result.metadata.googleContact.resourceName).toBe(
        "people/c123456789"
      );
      expect(result.metadata.googleContact.etag).toBe("%EgMBBgkQLDg=");
    });
  });

  describe("mapContactsToPersons", () => {
    it("should map multiple contacts", () => {
      const userId = "user_123";
      const parsedContacts = [fullContact, minimalContact].map(
        parseGoogleContact
      );
      const results = mapContactsToPersons(parsedContacts, userId);

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe("John Smith");
      expect(results[1].name).toBe("minimal@example.com");
    });

    it("should handle empty array", () => {
      const results = mapContactsToPersons([], "user_123");
      expect(results).toEqual([]);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Label Mapping
// ─────────────────────────────────────────────────────────────

describe("Label Mapping", () => {
  describe("mapGmailLabelToEmailLabel", () => {
    it("should map system label", () => {
      const userId = "user_123";
      const gmailLabel = {
        id: "INBOX",
        name: "INBOX",
        type: "system",
        messagesTotal: 100,
        messagesUnread: 5,
      };

      const result = mapGmailLabelToEmailLabel(gmailLabel, userId);

      expect(result.userId).toBe(userId);
      expect(result.gmailId).toBe("INBOX");
      expect(result.name).toBe("INBOX");
      expect(result.type).toBe("system");
      expect(result.messageCount).toBe(100);
    });

    it("should map user label", () => {
      const userId = "user_123";
      const gmailLabel = {
        id: "Label_1",
        name: "Work Projects",
        type: "user",
        messagesTotal: 50,
      };

      const result = mapGmailLabelToEmailLabel(gmailLabel, userId);

      expect(result.name).toBe("Work Projects");
      expect(result.type).toBe("user");
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Email Embedding Preparation
// ─────────────────────────────────────────────────────────────

describe("Email Embedding Preparation", () => {
  describe("prepareEmailForEmbedding", () => {
    it("should create searchable text from email", () => {
      const message = parseGmailMessage(simpleTextMessage);
      // prepareEmailForEmbedding expects specific fields
      const emailInput = {
        subject: message.subject,
        fromName: message.from.name || null,
        fromEmail: message.from.email,
        snippet: message.snippet,
        bodyText: message.bodyText,
      };
      const text = prepareEmailForEmbedding(emailInput);

      expect(text).toContain("Simple Test Email"); // Subject
      expect(text).toContain("sender@example.com"); // From
    });

    it("should handle HTML messages", () => {
      const message = parseGmailMessage(htmlMessage);
      const emailInput = {
        subject: message.subject,
        fromName: message.from.name || null,
        fromEmail: message.from.email,
        snippet: message.snippet,
        bodyText: message.bodyText,
      };
      const text = prepareEmailForEmbedding(emailInput);

      expect(text).toContain("Meeting Follow-up");
      expect(text).toContain("John Doe");
    });

    it("should truncate long content", () => {
      const longBody = "A".repeat(10000);
      const emailInput = {
        subject: "Test",
        fromName: null,
        fromEmail: "test@example.com",
        snippet: null,
        bodyText: longBody,
      };

      const text = prepareEmailForEmbedding(emailInput);

      // Should be truncated to a reasonable length
      expect(text.length).toBeLessThan(3000); // subject + from + truncated body
    });

    it("should include relevant metadata", () => {
      const message = parseGmailMessage(htmlMessage);
      const emailInput = {
        subject: message.subject,
        fromName: message.from.name || null,
        fromEmail: message.from.email,
        snippet: message.snippet,
        bodyText: message.bodyText,
      };
      const text = prepareEmailForEmbedding(emailInput);

      // Should include from name
      expect(text).toContain("John Doe");
    });
  });

  describe("prepareEmailEmbeddingMetadata", () => {
    it("should create structured metadata", () => {
      const message = parseGmailMessage(simpleTextMessage);
      // prepareEmailEmbeddingMetadata expects specific fields
      const emailInput = {
        id: "email_123", // Database ID
        gmailId: message.id,
        threadId: message.threadId,
        subject: message.subject,
        fromEmail: message.from.email,
        internalDate: message.internalDate,
        labelIds: message.labelIds,
      };
      const metadata = prepareEmailEmbeddingMetadata(emailInput);

      expect(metadata.subject).toBe("Simple Test Email");
      expect(metadata.from).toBe("sender@example.com");
      expect(metadata.threadId).toBe("thread_001");
    });

    it("should include label IDs", () => {
      const message = parseGmailMessage(simpleTextMessage);
      const emailInput = {
        id: "email_123",
        gmailId: message.id,
        threadId: message.threadId,
        subject: message.subject,
        fromEmail: message.from.email,
        internalDate: message.internalDate,
        labelIds: message.labelIds,
      };
      const metadata = prepareEmailEmbeddingMetadata(emailInput);

      expect(metadata.labels).toContain("INBOX");
      expect(metadata.labels).toContain("UNREAD");
    });

    it("should include date as ISO string", () => {
      const message = parseGmailMessage(simpleTextMessage);
      const emailInput = {
        id: "email_123",
        gmailId: message.id,
        threadId: message.threadId,
        subject: message.subject,
        fromEmail: message.from.email,
        internalDate: message.internalDate,
        labelIds: message.labelIds,
      };
      const metadata = prepareEmailEmbeddingMetadata(emailInput);

      expect(typeof metadata.date).toBe("string");
      expect(metadata.date).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO format
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Participant Extraction
// ─────────────────────────────────────────────────────────────

describe("Participant Extraction", () => {
  describe("extractEmailParticipants", () => {
    it("should extract all participants from messages", () => {
      const message = parseGmailMessage(htmlMessage);
      // extractEmailParticipants takes an array of messages
      const participants = extractEmailParticipants([message]);

      // Returns a Map of email -> name
      expect(participants.has("john@example.com")).toBe(true);
      expect(participants.size).toBeGreaterThan(0);
    });

    it("should include all recipient types", () => {
      const message = parseGmailMessage(htmlMessage);
      const participants = extractEmailParticipants([message]);

      // Check that CC is captured
      expect(participants.has("manager@example.com")).toBe(true);
    });

    it("should get unique participants", () => {
      const message = parseGmailMessage(htmlMessage);
      const participants = extractEmailParticipants([message]);

      // Map automatically deduplicates by key
      const allEmails = Array.from(participants.keys());
      const uniqueEmails = new Set(allEmails);
      expect(uniqueEmails.size).toBe(allEmails.length);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────

describe("Mapper Edge Cases", () => {
  it("should handle contact with no name", () => {
    const noNameContact = {
      resourceName: "people/c111",
      emailAddresses: [{ value: "only-email@example.com" }],
    };

    // Parse first, then map
    const parsed = parseGoogleContact(noNameContact);
    const result = mapContactToPerson(parsed, "user_123");

    expect(result.name).toBe("only-email@example.com");
    expect(result.email).toBe("only-email@example.com");
  });

  it("should handle contact with no email", () => {
    const noEmailContact = {
      resourceName: "people/c222",
      names: [{ displayName: "No Email Person" }],
    };

    const parsed = parseGoogleContact(noEmailContact);
    const result = mapContactToPerson(parsed, "user_123");

    expect(result.name).toBe("No Email Person");
    expect(result.email).toBeUndefined();
  });

  it("should handle completely empty contact", () => {
    const emptyContact = {
      resourceName: "people/c333",
    };

    const parsed = parseGoogleContact(emptyContact);
    const result = mapContactToPerson(parsed, "user_123");

    expect(result.name).toBe("Unknown");
    expect(result.source).toBe("gmail");
  });

  it("should handle message with no body", () => {
    const noBodyMessage = {
      id: "msg_no_body",
      threadId: "thread_001",
      labelIds: ["INBOX"],
      snippet: "Email snippet here",
      historyId: "12345",
      internalDate: "1703145600000",
      payload: {
        mimeType: "text/plain",
        headers: [
          { name: "From", value: "sender@example.com" },
          { name: "Subject", value: "No Body Email" },
        ],
      },
    };

    const message = parseGmailMessage(noBodyMessage);
    const emailInput = {
      subject: message.subject,
      fromName: message.from.name || null,
      fromEmail: message.from.email,
      snippet: message.snippet,
      bodyText: message.bodyText,
    };
    const text = prepareEmailForEmbedding(emailInput);

    // Should still have subject and snippet
    expect(text).toContain("No Body Email");
    expect(text.length).toBeGreaterThan(0);
  });

  it("should handle label with no message count", () => {
    const label = {
      id: "Label_X",
      name: "Empty Label",
      type: "user",
    };

    const result = mapGmailLabelToEmailLabel(label, "user_123");

    expect(result.messageCount).toBe(0);
  });
});
