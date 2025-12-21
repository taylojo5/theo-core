// ═══════════════════════════════════════════════════════════════════════════
// Gmail Errors Tests
// Tests for Gmail error handling utilities
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import {
  GmailError,
  GmailErrorCode,
  parseGoogleApiError,
  isGmailError,
  isRetryableError,
  needsTokenRefresh,
  needsScopeUpgrade,
} from "@/integrations/gmail";

// ─────────────────────────────────────────────────────────────
// GmailError Class
// ─────────────────────────────────────────────────────────────

describe("GmailError", () => {
  it("should create error with all properties", () => {
    const error = new GmailError(
      GmailErrorCode.RATE_LIMITED,
      "Rate limit exceeded",
      true,
      60000
    );

    expect(error.code).toBe(GmailErrorCode.RATE_LIMITED);
    expect(error.message).toBe("Rate limit exceeded");
    expect(error.retryable).toBe(true);
    expect(error.retryAfterMs).toBe(60000);
    expect(error.name).toBe("GmailError");
  });

  it("should be instanceof Error", () => {
    const error = new GmailError(GmailErrorCode.NOT_FOUND, "Not found", false);
    expect(error instanceof Error).toBe(true);
    expect(error instanceof GmailError).toBe(true);
  });

  it("should have proper toString output", () => {
    const error = new GmailError(
      GmailErrorCode.RATE_LIMITED,
      "Too many requests",
      true,
      5000
    );

    const str = error.toString();
    expect(str).toContain("GmailError");
    expect(str).toContain("RATE_LIMITED");
    expect(str).toContain("Too many requests");
    expect(str).toContain("retryable");
    expect(str).toContain("5000ms");
  });

  it("should serialize to JSON safely", () => {
    const originalError = new Error("Original error");
    const error = new GmailError(
      GmailErrorCode.NETWORK_ERROR,
      "Network failed",
      true,
      1000,
      originalError
    );

    const json = error.toJSON();

    expect(json.code).toBe(GmailErrorCode.NETWORK_ERROR);
    expect(json.message).toBe("Network failed");
    expect(json.retryable).toBe(true);
    expect(json.retryAfterMs).toBe(1000);
    // Original error should not be in JSON (could contain sensitive data)
    expect(json).not.toHaveProperty("originalError");
  });

  it("should default retryable to false", () => {
    const error = new GmailError(GmailErrorCode.NOT_FOUND, "Not found");
    expect(error.retryable).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// parseGoogleApiError
// ─────────────────────────────────────────────────────────────

describe("parseGoogleApiError", () => {
  // Helper to create mock Gaxios errors
  function createMockGaxiosError(
    status: number,
    message: string,
    additionalData: Record<string, unknown> = {}
  ) {
    const error = new Error(message) as Error & {
      response: {
        status: number;
        data: unknown;
        headers: Record<string, string>;
      };
    };
    error.response = {
      status,
      data: {
        error: {
          code: status,
          message,
          ...additionalData,
        },
      },
      headers: {},
    };
    return error;
  }

  describe("401 Unauthorized", () => {
    it("should parse as UNAUTHORIZED and retryable", () => {
      const mockError = createMockGaxiosError(401, "Invalid credentials");
      const error = parseGoogleApiError(mockError);

      expect(error.code).toBe(GmailErrorCode.UNAUTHORIZED);
      expect(error.retryable).toBe(true);
      expect(error.message).toContain("invalid or expired");
    });
  });

  describe("403 Forbidden", () => {
    it("should parse rate limit as RATE_LIMITED", () => {
      const mockError = createMockGaxiosError(403, "User rate limit exceeded");
      const error = parseGoogleApiError(mockError);

      expect(error.code).toBe(GmailErrorCode.RATE_LIMITED);
      expect(error.retryable).toBe(true);
    });

    it("should parse quota exceeded as QUOTA_EXCEEDED", () => {
      const mockError = createMockGaxiosError(403, "Daily quota exceeded");
      const error = parseGoogleApiError(mockError);

      expect(error.code).toBe(GmailErrorCode.QUOTA_EXCEEDED);
      expect(error.retryable).toBe(true);
      expect(error.retryAfterMs).toBe(60 * 60 * 1000); // 1 hour
    });

    it("should parse other 403 as INSUFFICIENT_PERMISSION", () => {
      const mockError = createMockGaxiosError(403, "Access denied");
      const error = parseGoogleApiError(mockError);

      expect(error.code).toBe(GmailErrorCode.INSUFFICIENT_PERMISSION);
      expect(error.retryable).toBe(false);
    });
  });

  describe("404 Not Found", () => {
    it("should parse as NOT_FOUND and not retryable", () => {
      const mockError = createMockGaxiosError(404, "Message not found");
      const error = parseGoogleApiError(mockError);

      expect(error.code).toBe(GmailErrorCode.NOT_FOUND);
      expect(error.retryable).toBe(false);
    });
  });

  describe("400 Bad Request", () => {
    it("should parse as INVALID_REQUEST", () => {
      const mockError = createMockGaxiosError(400, "Invalid query");
      const error = parseGoogleApiError(mockError);

      expect(error.code).toBe(GmailErrorCode.INVALID_REQUEST);
      expect(error.retryable).toBe(false);
    });
  });

  describe("429 Too Many Requests", () => {
    it("should parse as RATE_LIMITED with default retry", () => {
      const mockError = createMockGaxiosError(429, "Too many requests");
      const error = parseGoogleApiError(mockError);

      expect(error.code).toBe(GmailErrorCode.RATE_LIMITED);
      expect(error.retryable).toBe(true);
      expect(error.retryAfterMs).toBe(60 * 1000); // 1 minute default
    });

    it("should respect Retry-After header", () => {
      const mockError = createMockGaxiosError(429, "Too many requests");
      mockError.response.headers = { "retry-after": "120" };
      const error = parseGoogleApiError(mockError);

      expect(error.retryAfterMs).toBe(120000); // 120 seconds in ms
    });
  });

  describe("5xx Server Errors", () => {
    it("should parse 500 as SERVER_ERROR and retryable", () => {
      const mockError = createMockGaxiosError(500, "Internal server error");
      const error = parseGoogleApiError(mockError);

      expect(error.code).toBe(GmailErrorCode.SERVER_ERROR);
      expect(error.retryable).toBe(true);
    });

    it("should parse 502 as SERVER_ERROR", () => {
      const mockError = createMockGaxiosError(502, "Bad gateway");
      const error = parseGoogleApiError(mockError);

      expect(error.code).toBe(GmailErrorCode.SERVER_ERROR);
      expect(error.retryable).toBe(true);
    });

    it("should parse 503 as SERVER_ERROR", () => {
      const mockError = createMockGaxiosError(503, "Service unavailable");
      const error = parseGoogleApiError(mockError);

      expect(error.code).toBe(GmailErrorCode.SERVER_ERROR);
      expect(error.retryable).toBe(true);
      expect(error.retryAfterMs).toBe(5000); // 5 seconds default
    });
  });

  describe("Network errors", () => {
    it("should parse ECONNREFUSED as NETWORK_ERROR", () => {
      const error = new Error("connect ECONNREFUSED") as NodeJS.ErrnoException;
      error.code = "ECONNREFUSED";
      const result = parseGoogleApiError(error);

      expect(result.code).toBe(GmailErrorCode.NETWORK_ERROR);
      expect(result.retryable).toBe(true);
    });

    it("should parse ENOTFOUND as NETWORK_ERROR", () => {
      const error = new Error("getaddrinfo ENOTFOUND") as NodeJS.ErrnoException;
      error.code = "ENOTFOUND";
      const result = parseGoogleApiError(error);

      expect(result.code).toBe(GmailErrorCode.NETWORK_ERROR);
      expect(result.retryable).toBe(true);
    });

    it("should parse network keyword as NETWORK_ERROR", () => {
      const error = new Error("network connection failed");
      const result = parseGoogleApiError(error);

      expect(result.code).toBe(GmailErrorCode.NETWORK_ERROR);
      expect(result.retryable).toBe(true);
    });
  });

  describe("Timeout errors", () => {
    it("should parse timeout message as TIMEOUT", () => {
      const error = new Error("Request timeout");
      const result = parseGoogleApiError(error);

      expect(result.code).toBe(GmailErrorCode.TIMEOUT);
      expect(result.retryable).toBe(true);
    });

    it("should parse ETIMEDOUT as retryable", () => {
      const error = new Error("ETIMEDOUT") as NodeJS.ErrnoException;
      error.code = "ETIMEDOUT";
      const result = parseGoogleApiError(error);

      // ETIMEDOUT may be classified as NETWORK_ERROR or TIMEOUT
      expect([GmailErrorCode.TIMEOUT, GmailErrorCode.NETWORK_ERROR]).toContain(
        result.code
      );
      expect(result.retryable).toBe(true);
    });
  });

  describe("Unknown errors", () => {
    it("should parse unknown Error as UNKNOWN", () => {
      const error = new Error("Something went wrong");
      const result = parseGoogleApiError(error);

      expect(result.code).toBe(GmailErrorCode.UNKNOWN);
      expect(result.message).toBe("Something went wrong");
    });

    it("should handle non-Error objects", () => {
      const result = parseGoogleApiError("string error");

      expect(result.code).toBe(GmailErrorCode.UNKNOWN);
      expect(result.retryable).toBe(false);
    });

    it("should handle null/undefined", () => {
      const result1 = parseGoogleApiError(null);
      const result2 = parseGoogleApiError(undefined);

      expect(result1.code).toBe(GmailErrorCode.UNKNOWN);
      expect(result2.code).toBe(GmailErrorCode.UNKNOWN);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Error Checking Utilities
// ─────────────────────────────────────────────────────────────

describe("Error Checking Utilities", () => {
  describe("isGmailError", () => {
    it("should return true for GmailError", () => {
      const error = new GmailError(
        GmailErrorCode.NOT_FOUND,
        "Not found",
        false
      );
      expect(isGmailError(error)).toBe(true);
    });

    it("should return false for regular Error", () => {
      const error = new Error("Regular error");
      expect(isGmailError(error)).toBe(false);
    });

    it("should return false for non-Error", () => {
      expect(isGmailError("string")).toBe(false);
      expect(isGmailError(null)).toBe(false);
      expect(isGmailError(undefined)).toBe(false);
    });
  });

  describe("isRetryableError", () => {
    it("should return true for retryable GmailError", () => {
      const error = new GmailError(
        GmailErrorCode.RATE_LIMITED,
        "Rate limit",
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

    it("should return false for non-GmailError", () => {
      const error = new Error("Regular error");
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe("needsTokenRefresh", () => {
    it("should return true for UNAUTHORIZED", () => {
      const error = new GmailError(
        GmailErrorCode.UNAUTHORIZED,
        "Token expired",
        true
      );
      expect(needsTokenRefresh(error)).toBe(true);
    });

    it("should return false for other codes", () => {
      const rateLimited = new GmailError(
        GmailErrorCode.RATE_LIMITED,
        "Rate limit",
        true
      );
      const notFound = new GmailError(
        GmailErrorCode.NOT_FOUND,
        "Not found",
        false
      );

      expect(needsTokenRefresh(rateLimited)).toBe(false);
      expect(needsTokenRefresh(notFound)).toBe(false);
    });

    it("should return false for non-GmailError", () => {
      expect(needsTokenRefresh(new Error("Token expired"))).toBe(false);
    });
  });

  describe("needsScopeUpgrade", () => {
    it("should return true for INSUFFICIENT_PERMISSION", () => {
      const error = new GmailError(
        GmailErrorCode.INSUFFICIENT_PERMISSION,
        "Missing scope",
        false
      );
      expect(needsScopeUpgrade(error)).toBe(true);
    });

    it("should return false for other codes", () => {
      const unauthorized = new GmailError(
        GmailErrorCode.UNAUTHORIZED,
        "Unauthorized",
        true
      );
      expect(needsScopeUpgrade(unauthorized)).toBe(false);
    });

    it("should return false for non-GmailError", () => {
      expect(needsScopeUpgrade(new Error("Permission denied"))).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Error Codes Completeness
// ─────────────────────────────────────────────────────────────

describe("GmailErrorCode", () => {
  it("should have all expected error codes", () => {
    expect(GmailErrorCode.UNAUTHORIZED).toBe("UNAUTHORIZED");
    expect(GmailErrorCode.RATE_LIMITED).toBe("RATE_LIMITED");
    expect(GmailErrorCode.QUOTA_EXCEEDED).toBe("QUOTA_EXCEEDED");
    expect(GmailErrorCode.NOT_FOUND).toBe("NOT_FOUND");
    expect(GmailErrorCode.INVALID_REQUEST).toBe("INVALID_REQUEST");
    expect(GmailErrorCode.NETWORK_ERROR).toBe("NETWORK_ERROR");
    expect(GmailErrorCode.INSUFFICIENT_PERMISSION).toBe(
      "INSUFFICIENT_PERMISSION"
    );
    expect(GmailErrorCode.UNKNOWN).toBe("UNKNOWN");
    expect(GmailErrorCode.TIMEOUT).toBe("TIMEOUT");
    expect(GmailErrorCode.SERVER_ERROR).toBe("SERVER_ERROR");
    expect(GmailErrorCode.ACCOUNT_NOT_FOUND).toBe("ACCOUNT_NOT_FOUND");
  });
});
