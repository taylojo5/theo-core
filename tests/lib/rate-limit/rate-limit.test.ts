// ═══════════════════════════════════════════════════════════════════════════
// Rate Limiting - Unit Tests
// Tests for rate limit checking and middleware
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Redis module
vi.mock("@/lib/redis", () => ({
  redis: {
    multi: vi.fn(() => ({
      incr: vi.fn().mockReturnThis(),
      pttl: vi.fn().mockReturnThis(),
      exec: vi.fn(),
    })),
    pexpire: vi.fn(),
    del: vi.fn(),
  },
  ensureRedisConnection: vi.fn(),
  isRedisConnected: vi.fn(() => false), // Default to memory fallback
}));

// Import after mocking
import {
  checkRateLimit,
  checkRateLimitAsync,
  resetRateLimit,
  clearAllRateLimits,
  RATE_LIMITS,
  type RateLimitConfig,
} from "@/lib/rate-limit";

// ─────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────

const testConfig: RateLimitConfig = {
  windowMs: 60000, // 1 minute
  maxRequests: 5,
  keyPrefix: "test",
};

// ─────────────────────────────────────────────────────────────
// Rate Limit Tests (Memory Fallback)
// ─────────────────────────────────────────────────────────────

describe("Rate Limiting (Memory)", () => {
  beforeEach(() => {
    clearAllRateLimits();
  });

  describe("checkRateLimit", () => {
    it("should allow requests under the limit", () => {
      const result = checkRateLimit("user-1", testConfig);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.resetAt).toBeInstanceOf(Date);
      expect(result.retryAfterMs).toBeUndefined();
    });

    it("should track requests per user", () => {
      checkRateLimit("user-1", testConfig);
      checkRateLimit("user-1", testConfig);
      const result = checkRateLimit("user-1", testConfig);

      expect(result.remaining).toBe(2);
    });

    it("should isolate different users", () => {
      checkRateLimit("user-1", testConfig);
      checkRateLimit("user-1", testConfig);
      checkRateLimit("user-1", testConfig);

      const result = checkRateLimit("user-2", testConfig);

      expect(result.remaining).toBe(4); // User 2 starts fresh
    });

    it("should block requests over the limit", () => {
      // Make 5 requests (the limit)
      for (let i = 0; i < 5; i++) {
        checkRateLimit("user-1", testConfig);
      }

      // 6th request should be blocked
      const result = checkRateLimit("user-1", testConfig);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfterMs).toBeDefined();
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it("should use different key prefixes", () => {
      const config1 = { ...testConfig, keyPrefix: "api" };
      const config2 = { ...testConfig, keyPrefix: "search" };

      // Max out api limit
      for (let i = 0; i < 5; i++) {
        checkRateLimit("user-1", config1);
      }
      const apiResult = checkRateLimit("user-1", config1);

      // Search should still be available
      const searchResult = checkRateLimit("user-1", config2);

      expect(apiResult.allowed).toBe(false);
      expect(searchResult.allowed).toBe(true);
    });
  });

  describe("resetRateLimit", () => {
    it("should reset rate limit for a key", async () => {
      // Use up some requests
      checkRateLimit("user-1", testConfig);
      checkRateLimit("user-1", testConfig);
      checkRateLimit("user-1", testConfig);

      // Reset
      await resetRateLimit("user-1", testConfig.keyPrefix);

      // Should be back to full
      const result = checkRateLimit("user-1", testConfig);
      expect(result.remaining).toBe(4);
    });
  });

  describe("clearAllRateLimits", () => {
    it("should clear all rate limits", () => {
      checkRateLimit("user-1", testConfig);
      checkRateLimit("user-2", testConfig);
      checkRateLimit("user-3", testConfig);

      clearAllRateLimits();

      const result1 = checkRateLimit("user-1", testConfig);
      const result2 = checkRateLimit("user-2", testConfig);

      expect(result1.remaining).toBe(4);
      expect(result2.remaining).toBe(4);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Pre-defined Rate Limits
// ─────────────────────────────────────────────────────────────

describe("RATE_LIMITS Configurations", () => {
  it("should have api config", () => {
    expect(RATE_LIMITS.api).toBeDefined();
    expect(RATE_LIMITS.api.maxRequests).toBe(100);
    expect(RATE_LIMITS.api.windowMs).toBe(60000);
    expect(RATE_LIMITS.api.keyPrefix).toBe("api");
  });

  it("should have search config with lower limit", () => {
    expect(RATE_LIMITS.search).toBeDefined();
    expect(RATE_LIMITS.search.maxRequests).toBe(30);
    expect(RATE_LIMITS.search.keyPrefix).toBe("search");
  });

  it("should have auth config with strict limit", () => {
    expect(RATE_LIMITS.auth).toBeDefined();
    expect(RATE_LIMITS.auth.maxRequests).toBe(10);
    expect(RATE_LIMITS.auth.keyPrefix).toBe("auth");
  });

  it("should have create config", () => {
    expect(RATE_LIMITS.create).toBeDefined();
    expect(RATE_LIMITS.create.maxRequests).toBe(50);
    expect(RATE_LIMITS.create.keyPrefix).toBe("create");
  });

  it("should have chat config", () => {
    expect(RATE_LIMITS.chat).toBeDefined();
    expect(RATE_LIMITS.chat.maxRequests).toBe(20);
    expect(RATE_LIMITS.chat.keyPrefix).toBe("chat");
  });
});

// ─────────────────────────────────────────────────────────────
// Rate Limit Result Structure
// ─────────────────────────────────────────────────────────────

describe("RateLimitResult", () => {
  beforeEach(() => {
    clearAllRateLimits();
  });

  it("should return correct structure when allowed", () => {
    const result = checkRateLimit("user-1", testConfig);

    expect(result).toHaveProperty("allowed");
    expect(result).toHaveProperty("remaining");
    expect(result).toHaveProperty("resetAt");
    expect(typeof result.allowed).toBe("boolean");
    expect(typeof result.remaining).toBe("number");
    expect(result.resetAt).toBeInstanceOf(Date);
  });

  it("should include retryAfterMs when blocked", () => {
    // Exhaust limit
    for (let i = 0; i <= 5; i++) {
      checkRateLimit("user-1", testConfig);
    }

    const result = checkRateLimit("user-1", testConfig);

    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeDefined();
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(result.retryAfterMs).toBeLessThanOrEqual(testConfig.windowMs);
  });

  it("should set resetAt to future time", () => {
    const before = Date.now();
    const result = checkRateLimit("user-1", testConfig);
    const after = Date.now();

    expect(result.resetAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.resetAt.getTime()).toBeLessThanOrEqual(
      after + testConfig.windowMs
    );
  });
});
