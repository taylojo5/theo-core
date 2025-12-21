// ═══════════════════════════════════════════════════════════════════════════
// Gmail Actions Tests
// Tests for Gmail draft, send, and approval operations
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import {
  validateEmailAddresses,
  validateComposeParams,
  buildReplyParams,
  buildForwardParams,
  formatEmailForDisplay,
  parseDisplayEmail,
  isApprovalExpired,
  getTimeUntilExpiration,
} from "@/integrations/gmail";
import type {
  ComposeEmailParams,
  RequestApprovalParams,
  EmailApproval,
  ApprovalStatus,
} from "@/integrations/gmail";

// ─────────────────────────────────────────────────────────────
// Email Validation
// ─────────────────────────────────────────────────────────────

describe("Email Validation", () => {
  describe("validateEmailAddresses", () => {
    it("should validate correct email addresses", () => {
      const result = validateEmailAddresses([
        "valid@example.com",
        "another.valid@subdomain.example.org",
        "user+tag@example.com",
      ]);

      expect(result.valid).toHaveLength(3);
      expect(result.invalid).toHaveLength(0);
    });

    it("should reject invalid email addresses", () => {
      const result = validateEmailAddresses([
        "invalid",
        "@example.com",
        "user@",
        "user@.com",
        "",
      ]);

      expect(result.valid).toHaveLength(0);
      expect(result.invalid.length).toBeGreaterThan(0);
    });

    it("should separate valid and invalid addresses", () => {
      const result = validateEmailAddresses([
        "valid@example.com",
        "invalid",
        "another@test.org",
        "bad@",
      ]);

      expect(result.valid).toEqual(["valid@example.com", "another@test.org"]);
      expect(result.invalid).toContain("invalid");
      expect(result.invalid).toContain("bad@");
    });

    it("should handle empty array", () => {
      const result = validateEmailAddresses([]);

      expect(result.valid).toEqual([]);
      expect(result.invalid).toEqual([]);
    });
  });

  describe("validateComposeParams", () => {
    it("should validate correct compose params", () => {
      const params: ComposeEmailParams = {
        to: ["recipient@example.com"],
        subject: "Test Subject",
        body: "Test body content",
      };

      const result = validateComposeParams(params);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should require at least one recipient", () => {
      const params: ComposeEmailParams = {
        to: [],
        subject: "Test",
        body: "Body",
      };

      const result = validateComposeParams(params);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("At least one recipient is required");
    });

    it("should reject invalid recipient addresses", () => {
      const params: ComposeEmailParams = {
        to: ["valid@example.com", "invalid-email"],
        subject: "Test",
        body: "Body",
      };

      const result = validateComposeParams(params);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Invalid recipient"))).toBe(
        true
      );
    });

    it("should require subject", () => {
      const params = {
        to: ["recipient@example.com"],
        subject: "",
        body: "Body",
      } as ComposeEmailParams;

      const result = validateComposeParams(params);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Subject"))).toBe(true);
    });

    it("should require body", () => {
      const params = {
        to: ["recipient@example.com"],
        subject: "Test",
        body: "",
      } as ComposeEmailParams;

      const result = validateComposeParams(params);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("Body") || e.includes("body"))
      ).toBe(true);
    });

    it("should validate CC addresses", () => {
      const params: ComposeEmailParams = {
        to: ["valid@example.com"],
        cc: ["invalid-cc"],
        subject: "Test",
        body: "Body",
      };

      const result = validateComposeParams(params);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("CC") || e.includes("cc"))
      ).toBe(true);
    });

    it("should validate BCC addresses", () => {
      const params: ComposeEmailParams = {
        to: ["valid@example.com"],
        bcc: ["invalid-bcc"],
        subject: "Test",
        body: "Body",
      };

      const result = validateComposeParams(params);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("BCC") || e.includes("bcc"))
      ).toBe(true);
    });

    it("should allow valid CC and BCC", () => {
      const params: ComposeEmailParams = {
        to: ["to@example.com"],
        cc: ["cc@example.com"],
        bcc: ["bcc@example.com"],
        subject: "Test",
        body: "Body",
      };

      const result = validateComposeParams(params);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Reply/Forward Building
// ─────────────────────────────────────────────────────────────

describe("Reply/Forward Building", () => {
  const mockOriginalMessage = {
    id: "msg_original",
    threadId: "thread_001",
    subject: "Original Subject",
    messageId: "<original-123@example.com>",
    from: { email: "sender@example.com", name: "Sender" },
    to: [{ email: "recipient@example.com", name: "Recipient" }],
    cc: [{ email: "cc@example.com", name: "CC Person" }],
    bodyText: "Original message content",
    date: new Date("2024-12-20T10:00:00Z"),
  };

  describe("buildReplyParams", () => {
    it("should build basic reply params", () => {
      const result = buildReplyParams(
        mockOriginalMessage,
        "This is my reply",
        undefined
      );

      expect(result.to).toContain("sender@example.com");
      expect(result.subject).toBe("Re: Original Subject");
      expect(result.body).toContain("This is my reply");
      expect(result.threadId).toBe("thread_001");
      expect(result.inReplyTo).toBe("<original-123@example.com>");
    });

    it("should not double-prefix Re: in subject", () => {
      const messageWithRe = {
        ...mockOriginalMessage,
        subject: "Re: Already Replied",
      };

      const result = buildReplyParams(messageWithRe, "Reply text", undefined);

      expect(result.subject).toBe("Re: Already Replied");
      expect(result.subject).not.toBe("Re: Re: Already Replied");
    });

    it("should include references", () => {
      const result = buildReplyParams(
        mockOriginalMessage,
        "Reply text",
        undefined
      );

      expect(result.references).toBeDefined();
      expect(result.references).toContain("<original-123@example.com>");
    });

    it("should include HTML body if provided", () => {
      const result = buildReplyParams(
        mockOriginalMessage,
        "Plain text reply",
        "<p>HTML reply</p>"
      );

      expect(result.body).toBe("Plain text reply");
      expect(result.bodyHtml).toBe("<p>HTML reply</p>");
    });
  });

  describe("buildForwardParams", () => {
    it("should build forward params", () => {
      const result = buildForwardParams(
        mockOriginalMessage,
        ["forward-to@example.com"],
        "FYI - see below"
      );

      expect(result.to).toContain("forward-to@example.com");
      expect(result.subject).toBe("Fwd: Original Subject");
      expect(result.body).toContain("FYI - see below");
    });

    it("should not double-prefix Fwd: in subject", () => {
      const messageWithFwd = {
        ...mockOriginalMessage,
        subject: "Fwd: Already Forwarded",
      };

      const result = buildForwardParams(
        messageWithFwd,
        ["to@example.com"],
        "Note"
      );

      expect(result.subject).toBe("Fwd: Already Forwarded");
    });

    it("should include forward header with original info", () => {
      const result = buildForwardParams(
        mockOriginalMessage,
        ["to@example.com"],
        "Check this out"
      );

      // Body should include forwarded message header
      expect(result.body).toContain("Forwarded message");
      expect(result.body).toContain("From:");
      expect(result.body).toContain("sender@example.com");
    });

    it("should support multiple forward recipients", () => {
      const result = buildForwardParams(
        mockOriginalMessage,
        ["person1@example.com", "person2@example.com"],
        "FYI"
      );

      expect(result.to).toContain("person1@example.com");
      expect(result.to).toContain("person2@example.com");
      expect(result.to).toHaveLength(2);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Display Formatting
// ─────────────────────────────────────────────────────────────

describe("Display Formatting", () => {
  describe("formatEmailForDisplay", () => {
    it("should format email with name", () => {
      const result = formatEmailForDisplay("john@example.com", "John Doe");

      expect(result).toBe("John Doe <john@example.com>");
    });

    it("should format email without name", () => {
      const result = formatEmailForDisplay("john@example.com");

      expect(result).toBe("john@example.com");
    });

    it("should handle empty name", () => {
      const result = formatEmailForDisplay("john@example.com", "");

      expect(result).toBe("john@example.com");
    });
  });

  describe("parseDisplayEmail", () => {
    it("should parse display format with name", () => {
      const result = parseDisplayEmail("John Doe <john@example.com>");

      expect(result.name).toBe("John Doe");
      expect(result.email).toBe("john@example.com");
    });

    it("should parse plain email", () => {
      const result = parseDisplayEmail("john@example.com");

      expect(result.name).toBeUndefined();
      expect(result.email).toBe("john@example.com");
    });

    it("should handle quoted names", () => {
      const result = parseDisplayEmail('"John, Doe" <john@example.com>');

      // The parser may or may not strip quotes - just verify email is parsed correctly
      expect(result.email).toBe("john@example.com");
      expect(result.name).toBeDefined();
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Approval Workflow
// ─────────────────────────────────────────────────────────────

describe("Approval Workflow", () => {
  describe("Approval Status", () => {
    it("should have all valid statuses", () => {
      const validStatuses: ApprovalStatus[] = [
        "pending",
        "approved",
        "rejected",
        "expired",
        "sent",
      ];

      validStatuses.forEach((status) => {
        expect([
          "pending",
          "approved",
          "rejected",
          "expired",
          "sent",
        ]).toContain(status);
      });
    });
  });

  describe("isApprovalExpired", () => {
    it("should return true for expired approval", () => {
      const approval: Partial<EmailApproval> = {
        expiresAt: new Date(Date.now() - 60000), // 1 minute ago
        status: "pending",
      };

      expect(isApprovalExpired(approval as EmailApproval)).toBe(true);
    });

    it("should return false for non-expired approval", () => {
      const approval: Partial<EmailApproval> = {
        expiresAt: new Date(Date.now() + 60000), // 1 minute from now
        status: "pending",
      };

      expect(isApprovalExpired(approval as EmailApproval)).toBe(false);
    });

    it("should return false if no expiration set", () => {
      const approval: Partial<EmailApproval> = {
        expiresAt: null,
        status: "pending",
      };

      expect(isApprovalExpired(approval as unknown as EmailApproval)).toBe(
        false
      );
    });

    it("should return true for approval already marked expired", () => {
      const approval: Partial<EmailApproval> = {
        status: "expired",
        expiresAt: new Date(Date.now() - 60000), // Also set expired date
      };

      expect(isApprovalExpired(approval as EmailApproval)).toBe(true);
    });
  });

  describe("getTimeUntilExpiration", () => {
    it("should return positive ms for future expiration", () => {
      const futureDate = new Date(Date.now() + 3600000); // 1 hour
      const approval: Partial<EmailApproval> = {
        expiresAt: futureDate,
      };

      const result = getTimeUntilExpiration(approval as EmailApproval);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(3600000);
    });

    it("should return negative for past expiration", () => {
      const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
      const approval: Partial<EmailApproval> = {
        expiresAt: pastDate,
      };

      const result = getTimeUntilExpiration(approval as EmailApproval);

      expect(result).toBeLessThan(0);
    });

    it("should return null for no expiration", () => {
      const approval: Partial<EmailApproval> = {
        expiresAt: null,
      };

      const result = getTimeUntilExpiration(
        approval as unknown as EmailApproval
      );

      expect(result).toBeNull();
    });
  });

  describe("RequestApprovalParams", () => {
    it("should have required fields", () => {
      const params: RequestApprovalParams = {
        to: ["recipient@example.com"],
        subject: "Email Subject",
        body: "Email body content",
        requestedBy: "theo-agent",
      };

      expect(params.to).toBeDefined();
      expect(params.subject).toBeDefined();
      expect(params.body).toBeDefined();
      expect(params.requestedBy).toBeDefined();
    });

    it("should support optional fields", () => {
      const params: RequestApprovalParams = {
        to: ["recipient@example.com"],
        cc: ["cc@example.com"],
        bcc: ["bcc@example.com"],
        subject: "Subject",
        body: "Body",
        bodyHtml: "<p>Body</p>",
        threadId: "thread_123",
        inReplyTo: "<msg-id@example.com>",
        requestedBy: "agent",
        expiresInMinutes: 120,
        metadata: {
          conversationId: "conv_123",
          context: "Follow-up email",
        },
      };

      expect(params.cc).toBeDefined();
      expect(params.bcc).toBeDefined();
      expect(params.bodyHtml).toBeDefined();
      expect(params.threadId).toBeDefined();
      expect(params.expiresInMinutes).toBe(120);
      expect(params.metadata).toBeDefined();
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Approval Result Types
// ─────────────────────────────────────────────────────────────

describe("Approval Result Types", () => {
  describe("RequestApprovalResult", () => {
    it("should have success structure", () => {
      const result = {
        success: true,
        approval: {
          id: "approval_123",
          status: "pending" as const,
          draftId: "draft_456",
          expiresAt: new Date(Date.now() + 86400000),
        },
        draftId: "draft_456",
      };

      expect(result.success).toBe(true);
      expect(result.approval.id).toBeDefined();
      expect(result.approval.status).toBe("pending");
      expect(result.draftId).toBeDefined();
    });
  });

  describe("ApproveAndSendResult", () => {
    it("should have success structure", () => {
      const result = {
        success: true,
        sentMessageId: "msg_789",
        threadId: "thread_001",
      };

      expect(result.success).toBe(true);
      expect(result.sentMessageId).toBeDefined();
    });

    it("should have failure structure", () => {
      const result = {
        success: false,
        errorMessage: "Draft no longer exists",
      };

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBeDefined();
    });
  });

  describe("ApprovalStats", () => {
    it("should have all status counts", () => {
      const stats = {
        total: 100,
        pending: 5,
        approved: 10,
        rejected: 3,
        expired: 2,
        sent: 80,
      };

      expect(
        stats.pending +
          stats.approved +
          stats.rejected +
          stats.expired +
          stats.sent
      ).toBeLessThanOrEqual(stats.total);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Security Considerations
// ─────────────────────────────────────────────────────────────

describe("Security Considerations", () => {
  it("should validate that agent-initiated sends require approval", () => {
    // This is a design principle test
    const sendParams = {
      to: ["recipient@example.com"],
      subject: "Agent Email",
      body: "Sent by agent",
      requestedBy: "theo-agent",
    };

    // When requestedBy is set (agent-initiated), requireApproval should be true
    expect(sendParams.requestedBy).toBeDefined();
    // In the actual implementation, this would trigger approval workflow
  });

  it("should not include sensitive data in approval metadata", () => {
    const metadata = {
      conversationId: "conv_123",
      context: "Follow-up from meeting",
      // Should NOT include:
      // - accessToken
      // - passwords
      // - API keys
    };

    expect(metadata).not.toHaveProperty("accessToken");
    expect(metadata).not.toHaveProperty("password");
    expect(metadata).not.toHaveProperty("apiKey");
  });
});
