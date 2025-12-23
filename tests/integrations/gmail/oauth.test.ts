// ═══════════════════════════════════════════════════════════════════════════
// Gmail OAuth Flow Tests
// Tests for OAuth authentication and token management
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import {
  GMAIL_SCOPES,
  ALL_GMAIL_SCOPES,
  hasGmailReadAccess,
  hasGmailSendAccess,
  hasContactsAccess,
  getIntegrationStatus,
} from "@/lib/auth/scopes";
import {
  parseGoogleApiError,
  GmailError,
  GmailErrorCode,
  isGmailError,
  isRetryableError,
  needsTokenRefresh,
  needsScopeUpgrade,
} from "@/integrations/gmail/errors";

// ─────────────────────────────────────────────────────────────
// Scope Verification Tests
// ─────────────────────────────────────────────────────────────

describe("Gmail Scopes", () => {
  describe("GMAIL_SCOPES constants", () => {
    it("should have readonly scope", () => {
      expect(GMAIL_SCOPES.READONLY).toBe(
        "https://www.googleapis.com/auth/gmail.readonly"
      );
    });

    it("should have send scope", () => {
      expect(GMAIL_SCOPES.SEND).toBe(
        "https://www.googleapis.com/auth/gmail.send"
      );
    });

    it("should have labels scope", () => {
      expect(GMAIL_SCOPES.LABELS).toBe(
        "https://www.googleapis.com/auth/gmail.labels"
      );
    });

    it("should have contacts readonly scope", () => {
      expect(GMAIL_SCOPES.CONTACTS_READONLY).toBe(
        "https://www.googleapis.com/auth/contacts.readonly"
      );
    });
  });

  describe("ALL_GMAIL_SCOPES", () => {
    it("should include all required scopes", () => {
      expect(ALL_GMAIL_SCOPES).toContain(GMAIL_SCOPES.READONLY);
      expect(ALL_GMAIL_SCOPES).toContain(GMAIL_SCOPES.SEND);
      expect(ALL_GMAIL_SCOPES).toContain(GMAIL_SCOPES.LABELS);
      expect(ALL_GMAIL_SCOPES).toContain(GMAIL_SCOPES.CONTACTS_READONLY);
    });

    it("should be a readonly array", () => {
      expect(Array.isArray(ALL_GMAIL_SCOPES)).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Scope Check Functions
// ─────────────────────────────────────────────────────────────

describe("Scope Check Functions", () => {
  describe("hasGmailReadAccess", () => {
    it("should return true when read and label scopes are present", () => {
      const scopes = [GMAIL_SCOPES.READONLY, GMAIL_SCOPES.LABELS];
      expect(hasGmailReadAccess(scopes)).toBe(true);
    });

    it("should return false when only read scope is present", () => {
      const scopes = [GMAIL_SCOPES.READONLY];
      expect(hasGmailReadAccess(scopes)).toBe(false);
    });

    it("should return false when no relevant scopes", () => {
      const scopes = ["https://www.googleapis.com/auth/calendar"];
      expect(hasGmailReadAccess(scopes)).toBe(false);
    });

    it("should return false for empty scopes", () => {
      expect(hasGmailReadAccess([])).toBe(false);
    });
  });

  describe("hasGmailSendAccess", () => {
    it("should return true when send scope is present", () => {
      const scopes = [GMAIL_SCOPES.SEND];
      expect(hasGmailSendAccess(scopes)).toBe(true);
    });

    it("should return false for read-only scope", () => {
      const scopes = [GMAIL_SCOPES.READONLY];
      expect(hasGmailSendAccess(scopes)).toBe(false);
    });
  });

  describe("hasContactsAccess", () => {
    it("should return true when contacts scope is present", () => {
      const scopes = [GMAIL_SCOPES.CONTACTS_READONLY];
      expect(hasContactsAccess(scopes)).toBe(true);
    });

    it("should return false without contacts scope", () => {
      const scopes = [GMAIL_SCOPES.READONLY, GMAIL_SCOPES.SEND];
      expect(hasContactsAccess(scopes)).toBe(false);
    });
  });

  describe("getIntegrationStatus", () => {
    it("should return full status with all scopes", () => {
      const status = getIntegrationStatus([...ALL_GMAIL_SCOPES]);

      expect(status.gmail.connected).toBe(true);
      expect(status.gmail.canRead).toBe(true);
      expect(status.gmail.canSend).toBe(true);
      expect(status.contacts.connected).toBe(true);
      expect(status.missingScopes).toHaveLength(0);
    });

    it("should return partial status with read-only scopes", () => {
      const status = getIntegrationStatus([
        GMAIL_SCOPES.READONLY,
        GMAIL_SCOPES.LABELS,
      ]);

      expect(status.gmail.connected).toBe(true);
      expect(status.gmail.canRead).toBe(true);
      expect(status.gmail.canSend).toBe(false);
      expect(status.contacts.connected).toBe(false);
    });

    it("should return disconnected status with no scopes", () => {
      const status = getIntegrationStatus([]);

      expect(status.gmail.connected).toBe(false);
      expect(status.gmail.canRead).toBe(false);
      expect(status.gmail.canSend).toBe(false);
      expect(status.contacts.connected).toBe(false);
    });

    it("should handle mixed scopes", () => {
      const status = getIntegrationStatus([
        GMAIL_SCOPES.READONLY,
        GMAIL_SCOPES.LABELS,
        GMAIL_SCOPES.CONTACTS_READONLY,
      ]);

      expect(status.gmail.connected).toBe(true);
      expect(status.gmail.canRead).toBe(true);
      expect(status.gmail.canSend).toBe(false);
      expect(status.contacts.connected).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// OAuth Error Handling
// ─────────────────────────────────────────────────────────────

describe("OAuth Error Handling", () => {
  // Helper to create GaxiosError-like objects
  function createGaxiosError(
    status: number,
    message: string,
    data?: { error?: { message?: string } },
    headers?: Record<string, string>
  ) {
    const error = new Error(message) as Error & {
      response?: {
        status: number;
        data?: unknown;
        headers?: Record<string, string>;
      };
    };
    error.response = { status, data, headers };
    return error;
  }

  describe("parseGoogleApiError", () => {
    it("should parse 401 Unauthorized as token expired", () => {
      const error = createGaxiosError(401, "Invalid Credentials");

      const parsed = parseGoogleApiError(error);

      expect(parsed).toBeInstanceOf(GmailError);
      expect(parsed.code).toBe(GmailErrorCode.UNAUTHORIZED);
      expect(parsed.retryable).toBe(true); // Retryable after token refresh
    });

    it("should parse 403 Forbidden for insufficient permissions", () => {
      const error = createGaxiosError(403, "Insufficient permissions", {
        error: { message: "Insufficient permissions" },
      });

      const parsed = parseGoogleApiError(error);

      expect(parsed.code).toBe(GmailErrorCode.INSUFFICIENT_PERMISSION);
    });

    it("should parse 403 with rate limit message", () => {
      const error = createGaxiosError(403, "Rate limit exceeded", {
        error: { message: "rate limit exceeded" },
      });

      const parsed = parseGoogleApiError(error);

      expect(parsed.code).toBe(GmailErrorCode.RATE_LIMITED);
      expect(parsed.retryable).toBe(true);
    });

    it("should parse 404 Not Found", () => {
      const error = createGaxiosError(404, "Message not found");

      const parsed = parseGoogleApiError(error);

      expect(parsed.code).toBe(GmailErrorCode.NOT_FOUND);
      expect(parsed.retryable).toBe(false);
    });

    it("should parse 429 Rate Limited", () => {
      const error = createGaxiosError(429, "Rate Limit Exceeded");

      const parsed = parseGoogleApiError(error);

      expect(parsed.code).toBe(GmailErrorCode.RATE_LIMITED);
      expect(parsed.retryable).toBe(true);
    });

    it("should parse 500 Server Error as retryable", () => {
      const error = createGaxiosError(500, "Internal Server Error");

      const parsed = parseGoogleApiError(error);

      expect(parsed.code).toBe(GmailErrorCode.SERVER_ERROR);
      expect(parsed.retryable).toBe(true);
    });

    it("should parse 503 Service Unavailable as retryable", () => {
      const error = createGaxiosError(503, "Service Unavailable");

      const parsed = parseGoogleApiError(error);

      expect(parsed.code).toBe(GmailErrorCode.SERVER_ERROR);
      expect(parsed.retryable).toBe(true);
    });

    it("should handle network errors", () => {
      const error = new Error("network error - ECONNREFUSED");

      const parsed = parseGoogleApiError(error);

      expect(parsed.code).toBe(GmailErrorCode.NETWORK_ERROR);
      expect(parsed.retryable).toBe(true);
    });

    it("should handle timeout errors", () => {
      const error = new Error("Request timeout");

      const parsed = parseGoogleApiError(error);

      expect(parsed.code).toBe(GmailErrorCode.TIMEOUT);
      expect(parsed.retryable).toBe(true);
    });

    it("should handle unknown errors", () => {
      const error = new Error("Something unexpected");

      const parsed = parseGoogleApiError(error);

      expect(parsed).toBeInstanceOf(GmailError);
      expect(parsed.code).toBe(GmailErrorCode.UNKNOWN);
    });

    it("should handle null/undefined errors", () => {
      const parsed = parseGoogleApiError(null);

      expect(parsed).toBeInstanceOf(GmailError);
      expect(parsed.code).toBe(GmailErrorCode.UNKNOWN);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Error Checking Utilities
// ─────────────────────────────────────────────────────────────

describe("Error Checking Utilities", () => {
  describe("isGmailError", () => {
    it("should return true for GmailError", () => {
      const error = new GmailError(GmailErrorCode.NOT_FOUND, "Not found");
      expect(isGmailError(error)).toBe(true);
    });

    it("should return false for regular Error", () => {
      const error = new Error("Regular error");
      expect(isGmailError(error)).toBe(false);
    });
  });

  describe("isRetryableError", () => {
    it("should return true for retryable GmailError", () => {
      const error = new GmailError(
        GmailErrorCode.RATE_LIMITED,
        "Rate limited",
        true
      );
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return false for non-retryable GmailError", () => {
      const error = new GmailError(
        GmailErrorCode.NOT_FOUND,
        "Not found",
        false
      );
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe("needsTokenRefresh", () => {
    it("should return true for UNAUTHORIZED", () => {
      const error = new GmailError(GmailErrorCode.UNAUTHORIZED, "Unauthorized");
      expect(needsTokenRefresh(error)).toBe(true);
    });

    it("should return false for other codes", () => {
      const error = new GmailError(GmailErrorCode.NOT_FOUND, "Not found");
      expect(needsTokenRefresh(error)).toBe(false);
    });
  });

  describe("needsScopeUpgrade", () => {
    it("should return true for INSUFFICIENT_PERMISSION", () => {
      const error = new GmailError(
        GmailErrorCode.INSUFFICIENT_PERMISSION,
        "Need more permissions"
      );
      expect(needsScopeUpgrade(error)).toBe(true);
    });

    it("should return false for other codes", () => {
      const error = new GmailError(GmailErrorCode.NOT_FOUND, "Not found");
      expect(needsScopeUpgrade(error)).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Integration Status Checks
// ─────────────────────────────────────────────────────────────

describe("Integration Status", () => {
  describe("Scope Combinations", () => {
    const testCases = [
      {
        name: "Full access",
        scopes: [...ALL_GMAIL_SCOPES],
        expected: {
          gmailConnected: true,
          canRead: true,
          canSend: true,
          contactsConnected: true,
        },
      },
      {
        name: "Read only with labels",
        scopes: [GMAIL_SCOPES.READONLY, GMAIL_SCOPES.LABELS],
        expected: {
          gmailConnected: true,
          canRead: true,
          canSend: false,
          contactsConnected: false,
        },
      },
      {
        name: "Read, labels and send",
        scopes: [GMAIL_SCOPES.READONLY, GMAIL_SCOPES.LABELS, GMAIL_SCOPES.SEND],
        expected: {
          gmailConnected: true,
          canRead: true,
          canSend: true,
          contactsConnected: false,
        },
      },
      {
        name: "Contacts only (no Gmail access)",
        scopes: [GMAIL_SCOPES.CONTACTS_READONLY],
        expected: {
          gmailConnected: false,
          canRead: false,
          canSend: false,
          contactsConnected: true,
        },
      },
      {
        name: "No scopes",
        scopes: [],
        expected: {
          gmailConnected: false,
          canRead: false,
          canSend: false,
          contactsConnected: false,
        },
      },
    ];

    testCases.forEach(({ name, scopes, expected }) => {
      it(`should handle ${name}`, () => {
        const status = getIntegrationStatus(scopes);

        expect(status.gmail.connected).toBe(expected.gmailConnected);
        expect(status.gmail.canRead).toBe(expected.canRead);
        expect(status.gmail.canSend).toBe(expected.canSend);
        expect(status.contacts.connected).toBe(expected.contactsConnected);
      });
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Error Code Constants
// ─────────────────────────────────────────────────────────────

describe("GmailErrorCode", () => {
  it("should have all expected error codes", () => {
    expect(GmailErrorCode.UNAUTHORIZED).toBe("UNAUTHORIZED");
    expect(GmailErrorCode.INSUFFICIENT_PERMISSION).toBe(
      "INSUFFICIENT_PERMISSION"
    );
    expect(GmailErrorCode.NOT_FOUND).toBe("NOT_FOUND");
    expect(GmailErrorCode.RATE_LIMITED).toBe("RATE_LIMITED");
    expect(GmailErrorCode.SERVER_ERROR).toBe("SERVER_ERROR");
    expect(GmailErrorCode.UNKNOWN).toBe("UNKNOWN");
    expect(GmailErrorCode.NETWORK_ERROR).toBe("NETWORK_ERROR");
    expect(GmailErrorCode.TIMEOUT).toBe("TIMEOUT");
    expect(GmailErrorCode.QUOTA_EXCEEDED).toBe("QUOTA_EXCEEDED");
  });
});
