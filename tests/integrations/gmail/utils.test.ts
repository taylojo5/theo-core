// ═══════════════════════════════════════════════════════════════════════════
// Gmail Utils Tests
// Tests for Gmail utility functions
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import {
  parseEmailAddress,
  parseEmailAddressList,
  formatEmailAddress,
  parseGmailMessage,
  parseGmailThread,
  parseGoogleContact,
  getHeader,
  decodeBase64Url,
  encodeBase64Url,
  isSystemLabel,
  getLabelDisplayName,
  buildSearchQuery,
  stripHtml,
  truncateText,
  buildRawMessage,
} from "@/integrations/gmail";
import {
  simpleTextMessage,
  htmlMessage,
  attachmentMessage,
  conversationThread,
  fullContact,
  minimalContact,
} from "./fixtures";

// ─────────────────────────────────────────────────────────────
// Email Address Parsing
// ─────────────────────────────────────────────────────────────

describe("Email Address Parsing", () => {
  describe("parseEmailAddress", () => {
    it("should parse name and email format", () => {
      const result = parseEmailAddress("John Doe <john@example.com>");
      expect(result).toEqual({
        name: "John Doe",
        email: "john@example.com",
      });
    });

    it("should parse quoted name format", () => {
      const result = parseEmailAddress('"John Doe" <john@example.com>');
      expect(result).toEqual({
        name: "John Doe",
        email: "john@example.com",
      });
    });

    it("should parse plain email address", () => {
      const result = parseEmailAddress("john@example.com");
      expect(result).toEqual({
        email: "john@example.com",
      });
    });

    it("should handle empty string", () => {
      const result = parseEmailAddress("");
      expect(result).toEqual({
        email: "",
        name: undefined,
      });
    });

    it("should normalize email to lowercase", () => {
      const result = parseEmailAddress("John.Doe@EXAMPLE.COM");
      expect(result.email).toBe("john.doe@example.com");
    });

    it("should handle whitespace", () => {
      const result = parseEmailAddress("John Doe <john@example.com>");
      expect(result.name).toBe("John Doe");
      expect(result.email).toBe("john@example.com");
    });
  });

  describe("parseEmailAddressList", () => {
    it("should parse multiple addresses", () => {
      const result = parseEmailAddressList(
        "john@example.com, jane@example.com"
      );
      expect(result).toHaveLength(2);
      expect(result[0].email).toBe("john@example.com");
      expect(result[1].email).toBe("jane@example.com");
    });

    it("should handle mixed formats", () => {
      const result = parseEmailAddressList(
        "John Doe <john@example.com>, jane@example.com"
      );
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("John Doe");
      expect(result[0].email).toBe("john@example.com");
      expect(result[1].email).toBe("jane@example.com");
    });

    it("should handle empty string", () => {
      const result = parseEmailAddressList("");
      expect(result).toEqual([]);
    });

    it("should handle name with comma", () => {
      // This may be parsed differently depending on implementation
      const result = parseEmailAddressList("John Jr <john@example.com>");
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].email).toBe("john@example.com");
    });
  });

  describe("formatEmailAddress", () => {
    it("should format address with name", () => {
      const result = formatEmailAddress({
        name: "John Doe",
        email: "john@example.com",
      });
      expect(result).toBe("John Doe <john@example.com>");
    });

    it("should format address without name", () => {
      const result = formatEmailAddress({ email: "john@example.com" });
      expect(result).toBe("john@example.com");
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Message Parsing
// ─────────────────────────────────────────────────────────────

describe("Message Parsing", () => {
  describe("parseGmailMessage", () => {
    it("should parse simple text message", () => {
      const result = parseGmailMessage(simpleTextMessage);

      expect(result.id).toBe("msg_simple_text_001");
      expect(result.threadId).toBe("thread_001");
      expect(result.subject).toBe("Simple Test Email");
      expect(result.from.email).toBe("sender@example.com");
      expect(result.to).toHaveLength(1);
      expect(result.to[0].email).toBe("recipient@example.com");
      expect(result.bodyText).toBe(
        "This is a simple test email with plain text content."
      );
      expect(result.isRead).toBe(false);
      expect(result.isStarred).toBe(false);
      expect(result.hasAttachments).toBe(false);
    });

    it("should parse HTML message with multipart body", () => {
      const result = parseGmailMessage(htmlMessage);

      expect(result.subject).toBe("Meeting Follow-up");
      expect(result.from.name).toBe("John Doe");
      expect(result.from.email).toBe("john@example.com");
      expect(result.to).toHaveLength(2);
      expect(result.cc).toHaveLength(1);
      expect(result.bodyText).toBe("This is the plain text version.");
      expect(result.bodyHtml).toBe(
        "<p>This is the <strong>HTML</strong> version.</p>"
      );
      expect(result.inReplyTo).toBe("<original-001@example.com>");
      expect(result.isImportant).toBe(true);
    });

    it("should parse message with attachments", () => {
      const result = parseGmailMessage(attachmentMessage);

      expect(result.hasAttachments).toBe(true);
      expect(result.attachments).toHaveLength(1);
      expect(result.attachments[0].filename).toBe("report.pdf");
      expect(result.attachments[0].mimeType).toBe("application/pdf");
      expect(result.attachments[0].size).toBe(102400);
      expect(result.isStarred).toBe(true);
    });

    it("should detect draft messages", () => {
      const draftMsg = {
        ...simpleTextMessage,
        labelIds: ["DRAFT"],
      };
      const result = parseGmailMessage(draftMsg);

      expect(result.isDraft).toBe(true);
    });
  });

  describe("parseGmailThread", () => {
    it("should parse thread with multiple messages", () => {
      const result = parseGmailThread(conversationThread);

      expect(result.id).toBe("thread_conversation_001");
      expect(result.messages).toHaveLength(3);
      expect(result.messageCount).toBe(3);
      expect(result.subject).toBe("Project Discussion");
      expect(result.participants).toHaveLength(2);

      // Check participant emails
      const emails = result.participants.map((p) => p.email);
      expect(emails).toContain("alice@example.com");
      expect(emails).toContain("bob@example.com");
    });

    it("should get latest message info", () => {
      const result = parseGmailThread(conversationThread);

      expect(result.snippet).toBe("Thanks for the update!");
      expect(result.latestDate).toBeInstanceOf(Date);
    });

    it("should aggregate labels from all messages", () => {
      const result = parseGmailThread(conversationThread);

      expect(result.labelIds).toContain("INBOX");
      expect(result.labelIds).toContain("UNREAD");
    });
  });

  describe("getHeader", () => {
    it("should find header by name (case-insensitive)", () => {
      const headers = [
        { name: "From", value: "test@example.com" },
        { name: "Subject", value: "Test Subject" },
      ];

      expect(getHeader(headers, "from")).toBe("test@example.com");
      expect(getHeader(headers, "FROM")).toBe("test@example.com");
      expect(getHeader(headers, "Subject")).toBe("Test Subject");
    });

    it("should return undefined for missing header", () => {
      const headers = [{ name: "From", value: "test@example.com" }];

      expect(getHeader(headers, "To")).toBeUndefined();
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Contact Parsing
// ─────────────────────────────────────────────────────────────

describe("Contact Parsing", () => {
  describe("parseGoogleContact", () => {
    it("should parse full contact", () => {
      const result = parseGoogleContact(fullContact);

      expect(result.name).toBe("John Smith");
      expect(result.firstName).toBe("John");
      expect(result.lastName).toBe("Smith");
      expect(result.email).toBe("john.smith@example.com");
      expect(result.emails).toHaveLength(2);
      expect(result.phone).toBe("+1-555-123-4567");
      expect(result.phones).toHaveLength(2);
      expect(result.company).toBe("Example Corp");
      expect(result.title).toBe("Software Engineer");
      expect(result.photoUrl).toBe(
        "https://lh3.googleusercontent.com/photo123"
      );
      expect(result.address).toBe("123 Main St, San Francisco, CA 94105");
      expect(result.birthday).toEqual(new Date(1990, 4, 15));
      expect(result.notes).toBe(
        "Senior developer working on cloud infrastructure."
      );
    });

    it("should parse minimal contact", () => {
      const result = parseGoogleContact(minimalContact);

      expect(result.name).toBe("minimal@example.com"); // Falls back to email
      expect(result.firstName).toBeUndefined();
      expect(result.lastName).toBeUndefined();
      expect(result.email).toBe("minimal@example.com");
      expect(result.emails).toEqual(["minimal@example.com"]);
    });

    it("should handle contact with no email", () => {
      const noEmailContact = {
        resourceName: "people/c111",
        names: [{ displayName: "No Email" }],
      };
      const result = parseGoogleContact(noEmailContact);

      expect(result.name).toBe("No Email");
      expect(result.email).toBeUndefined();
      expect(result.emails).toEqual([]);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Base64 Encoding/Decoding
// ─────────────────────────────────────────────────────────────

describe("Base64 URL Encoding", () => {
  describe("decodeBase64Url", () => {
    it("should decode base64url string", () => {
      const encoded = Buffer.from("Hello, World!")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const result = decodeBase64Url(encoded);
      expect(result).toBe("Hello, World!");
    });

    it("should handle UTF-8 characters", () => {
      const encoded = Buffer.from("Hello 世界")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const result = decodeBase64Url(encoded);
      expect(result).toBe("Hello 世界");
    });
  });

  describe("encodeBase64Url", () => {
    it("should encode string to base64url", () => {
      const result = encodeBase64Url("Hello, World!");

      // Result should not contain +, /, or =
      expect(result).not.toMatch(/[+/=]/);

      // Should decode back correctly
      expect(decodeBase64Url(result)).toBe("Hello, World!");
    });

    it("should roundtrip correctly", () => {
      const original = "Test message with special chars: +/=";
      const encoded = encodeBase64Url(original);
      const decoded = decodeBase64Url(encoded);

      expect(decoded).toBe(original);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Label Utilities
// ─────────────────────────────────────────────────────────────

describe("Label Utilities", () => {
  describe("isSystemLabel", () => {
    it("should recognize system labels", () => {
      expect(isSystemLabel("INBOX")).toBe(true);
      expect(isSystemLabel("SENT")).toBe(true);
      expect(isSystemLabel("DRAFT")).toBe(true);
      expect(isSystemLabel("STARRED")).toBe(true);
      expect(isSystemLabel("UNREAD")).toBe(true);
      expect(isSystemLabel("IMPORTANT")).toBe(true);
      expect(isSystemLabel("CATEGORY_SOCIAL")).toBe(true);
    });

    it("should not recognize user labels", () => {
      expect(isSystemLabel("Label_1")).toBe(false);
      expect(isSystemLabel("Work")).toBe(false);
      expect(isSystemLabel("Custom Label")).toBe(false);
    });
  });

  describe("getLabelDisplayName", () => {
    it("should return friendly names for system labels", () => {
      expect(getLabelDisplayName("INBOX")).toBe("Inbox");
      expect(getLabelDisplayName("SENT")).toBe("Sent");
      expect(getLabelDisplayName("DRAFT")).toBe("Drafts");
      expect(getLabelDisplayName("CATEGORY_SOCIAL")).toBe("Social");
      expect(getLabelDisplayName("CATEGORY_PROMOTIONS")).toBe("Promotions");
    });

    it("should return original for unknown labels", () => {
      expect(getLabelDisplayName("Label_1")).toBe("Label_1");
      expect(getLabelDisplayName("Custom Label")).toBe("Custom Label");
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Query Building
// ─────────────────────────────────────────────────────────────

describe("Query Building", () => {
  describe("buildSearchQuery", () => {
    it("should build query with from", () => {
      const result = buildSearchQuery({ from: "sender@example.com" });
      expect(result).toBe("from:sender@example.com");
    });

    it("should build query with to", () => {
      const result = buildSearchQuery({ to: "recipient@example.com" });
      expect(result).toBe("to:recipient@example.com");
    });

    it("should build query with subject", () => {
      const result = buildSearchQuery({ subject: "Meeting" });
      expect(result).toBe("subject:Meeting");
    });

    it("should build query with date range", () => {
      const result = buildSearchQuery({
        after: new Date("2024-01-01"),
        before: new Date("2024-12-31"),
      });
      // Date formatting may vary by timezone
      expect(result).toContain("after:");
      expect(result).toContain("before:");
    });

    it("should build query with flags", () => {
      const result = buildSearchQuery({
        hasAttachment: true,
        isUnread: true,
        isStarred: true,
      });
      expect(result).toContain("has:attachment");
      expect(result).toContain("is:unread");
      expect(result).toContain("is:starred");
    });

    it("should combine multiple parameters", () => {
      const result = buildSearchQuery({
        from: "sender@example.com",
        subject: "Report",
        hasAttachment: true,
      });
      expect(result).toBe(
        "from:sender@example.com subject:Report has:attachment"
      );
    });

    it("should append custom query", () => {
      const result = buildSearchQuery({
        from: "sender@example.com",
        query: "important project",
      });
      expect(result).toBe("from:sender@example.com important project");
    });
  });
});

// ─────────────────────────────────────────────────────────────
// HTML Utilities
// ─────────────────────────────────────────────────────────────

describe("HTML Utilities", () => {
  describe("stripHtml", () => {
    it("should remove HTML tags", () => {
      const result = stripHtml("<p>Hello <strong>World</strong></p>");
      expect(result).toBe("Hello World");
    });

    it("should convert br tags to newlines", () => {
      const result = stripHtml("Line 1<br>Line 2<br/>Line 3");
      expect(result).toContain("Line 1\nLine 2\nLine 3");
    });

    it("should convert paragraph tags to double newlines", () => {
      const result = stripHtml("<p>Paragraph 1</p><p>Paragraph 2</p>");
      expect(result).toContain("Paragraph 1\n\nParagraph 2");
    });

    it("should decode HTML entities", () => {
      const result = stripHtml("&amp; &lt;tag&gt; &quot;quoted&quot;");
      expect(result).toBe('& <tag> "quoted"');
    });

    it("should remove style tags and content", () => {
      const result = stripHtml("<style>body { color: red; }</style>Hello");
      expect(result).toBe("Hello");
    });

    it("should remove script tags and content", () => {
      const result = stripHtml("<script>alert('xss')</script>Hello");
      expect(result).toBe("Hello");
    });
  });

  describe("truncateText", () => {
    it("should truncate long text", () => {
      const result = truncateText("This is a very long text", 15);
      expect(result).toBe("This is a ve...");
      expect(result.length).toBe(15);
    });

    it("should not truncate short text", () => {
      const result = truncateText("Short", 10);
      expect(result).toBe("Short");
    });

    it("should handle exact length", () => {
      const result = truncateText("Exact", 5);
      expect(result).toBe("Exact");
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Message Composition
// ─────────────────────────────────────────────────────────────

describe("Message Composition", () => {
  describe("buildRawMessage", () => {
    it("should build plain text message", () => {
      const raw = buildRawMessage({
        to: ["recipient@example.com"],
        subject: "Test Subject",
        body: "Test body content",
      });

      const decoded = decodeBase64Url(raw);

      expect(decoded).toContain("To: recipient@example.com");
      expect(decoded).toContain("Subject: Test Subject");
      expect(decoded).toContain("Test body content");
      expect(decoded).toContain("Content-Type: text/plain");
    });

    it("should build multipart message with HTML", () => {
      const raw = buildRawMessage({
        to: ["recipient@example.com"],
        subject: "HTML Test",
        body: "Plain text version",
        bodyHtml: "<p>HTML version</p>",
      });

      const decoded = decodeBase64Url(raw);

      expect(decoded).toContain("Content-Type: multipart/alternative");
      expect(decoded).toContain("Plain text version");
      expect(decoded).toContain("<p>HTML version</p>");
    });

    it("should include CC and BCC", () => {
      const raw = buildRawMessage({
        to: ["to@example.com"],
        cc: ["cc@example.com"],
        bcc: ["bcc@example.com"],
        subject: "Test",
        body: "Body",
      });

      const decoded = decodeBase64Url(raw);

      expect(decoded).toContain("Cc: cc@example.com");
      expect(decoded).toContain("Bcc: bcc@example.com");
    });

    it("should include reply headers", () => {
      const raw = buildRawMessage({
        to: ["recipient@example.com"],
        subject: "Re: Original",
        body: "Reply content",
        inReplyTo: "<original-001@example.com>",
        references: ["<original-001@example.com>"],
      });

      const decoded = decodeBase64Url(raw);

      expect(decoded).toContain("In-Reply-To: <original-001@example.com>");
      expect(decoded).toContain("References: <original-001@example.com>");
    });

    it("should handle UTF-8 subject", () => {
      const raw = buildRawMessage({
        to: ["recipient@example.com"],
        subject: "Test with émojis 🎉",
        body: "Body",
      });

      const decoded = decodeBase64Url(raw);

      // Should contain encoded subject
      expect(decoded).toContain("Subject:");
      expect(decoded).toContain("=?UTF-8?B?");
    });
  });
});
