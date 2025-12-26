// ═══════════════════════════════════════════════════════════════════════════
// Agent Config Service Tests
// Tests for per-user agent configuration with DB + defaults merging
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getDefaultRateLimits,
  getDefaultTokenLimits,
  getDefaultContentFilterConfig,
  getDefaultFeatureFlags,
  getDefaultConfidenceThresholds,
  getDefaultAgentConfig,
} from "@/lib/agent/config/service";

// ─────────────────────────────────────────────────────────────
// Mock Database Module (must be at module level for hoisting)
// ─────────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  db: {
    agentUserConfig: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// ─────────────────────────────────────────────────────────────
// Default Config Tests
// ─────────────────────────────────────────────────────────────

describe("Agent Config Defaults", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant env vars before each test
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith("AGENT_")) {
        delete process.env[key];
      }
    });
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe("getDefaultRateLimits", () => {
    it("returns hardcoded defaults when no env vars set", () => {
      const limits = getDefaultRateLimits();

      expect(limits.CHAT_PER_MINUTE).toBe(20);
      expect(limits.ACTIONS_PER_MINUTE).toBe(10);
      expect(limits.EXTERNAL_CALLS_PER_HOUR).toBe(50);
      expect(limits.LLM_TOKENS_PER_HOUR).toBe(100000);
      expect(limits.MAX_CONCURRENT_PLANS).toBe(3);
      expect(limits.MAX_PLAN_STEPS).toBe(10);
    });

    it("uses env var overrides when set", () => {
      process.env.AGENT_RATE_CHAT_PER_MINUTE = "50";
      process.env.AGENT_RATE_ACTIONS_PER_MINUTE = "25";

      const limits = getDefaultRateLimits();

      expect(limits.CHAT_PER_MINUTE).toBe(50);
      expect(limits.ACTIONS_PER_MINUTE).toBe(25);
      // Others should use defaults
      expect(limits.EXTERNAL_CALLS_PER_HOUR).toBe(50);
    });
  });

  describe("getDefaultTokenLimits", () => {
    it("returns hardcoded defaults when no env vars set", () => {
      const limits = getDefaultTokenLimits();

      expect(limits.MAX_CONVERSATION_CONTEXT).toBe(4000);
      expect(limits.MAX_RETRIEVED_CONTEXT).toBe(2000);
      expect(limits.MAX_SYSTEM_PROMPT).toBe(1500);
      expect(limits.MAX_TOOL_DESCRIPTIONS).toBe(2000);
      expect(limits.MAX_RESPONSE_TOKENS).toBe(2000);
      expect(limits.TARGET_REQUEST_BUDGET).toBe(8000);
    });

    it("uses env var overrides when set", () => {
      process.env.AGENT_TOKEN_MAX_CONVERSATION_CONTEXT = "8000";

      const limits = getDefaultTokenLimits();

      expect(limits.MAX_CONVERSATION_CONTEXT).toBe(8000);
      // Others should use defaults
      expect(limits.MAX_RETRIEVED_CONTEXT).toBe(2000);
    });
  });

  describe("getDefaultContentFilterConfig", () => {
    it("returns hardcoded defaults when no env vars set", () => {
      const config = getDefaultContentFilterConfig();

      expect(config.SANITIZE_INPUT).toBe(true);
      expect(config.FILTER_OUTPUT).toBe(true);
      expect(config.MAX_MESSAGE_LENGTH).toBe(10000);
      expect(config.MAX_PROMPT_LENGTH).toBe(50000);
      expect(config.DETECT_INJECTION).toBe(true);
    });

    it("uses env var overrides when set", () => {
      process.env.AGENT_FILTER_SANITIZE_INPUT = "false";
      process.env.AGENT_FILTER_MAX_MESSAGE_LENGTH = "20000";

      const config = getDefaultContentFilterConfig();

      expect(config.SANITIZE_INPUT).toBe(false);
      expect(config.MAX_MESSAGE_LENGTH).toBe(20000);
    });
  });

  describe("getDefaultFeatureFlags", () => {
    it("returns expected defaults when no env vars set", () => {
      const flags = getDefaultFeatureFlags();

      expect(flags.enablePlanning).toBe(true);
      expect(flags.enableProactive).toBe(false);
      expect(flags.enableLearning).toBe(false);
      expect(flags.enableToolExecution).toBe(true);
      expect(flags.enableAuditLogging).toBe(true);
      expect(flags.enableStreaming).toBe(true);
    });

    it("uses env var overrides when set", () => {
      process.env.AGENT_ENABLE_PLANNING = "false";
      process.env.AGENT_ENABLE_PROACTIVE = "true";

      const flags = getDefaultFeatureFlags();

      expect(flags.enablePlanning).toBe(false);
      expect(flags.enableProactive).toBe(true);
    });
  });

  describe("getDefaultConfidenceThresholds", () => {
    it("returns hardcoded defaults when no env vars set", () => {
      const thresholds = getDefaultConfidenceThresholds();

      expect(thresholds.ACTION).toBe(0.7);
      expect(thresholds.STATEMENT).toBe(0.5);
      expect(thresholds.ASSUMPTION).toBe(0.3);
      expect(thresholds.HIGH_RISK).toBe(0.9);
      expect(thresholds.ENTITY_RESOLUTION).toBe(0.8);
    });

    it("uses env var overrides when set", () => {
      process.env.AGENT_CONFIDENCE_ACTION = "0.85";
      process.env.AGENT_CONFIDENCE_HIGH_RISK = "0.95";

      const thresholds = getDefaultConfidenceThresholds();

      expect(thresholds.ACTION).toBe(0.85);
      expect(thresholds.HIGH_RISK).toBe(0.95);
      // Others should use defaults
      expect(thresholds.STATEMENT).toBe(0.5);
    });
  });

  describe("getDefaultAgentConfig", () => {
    it("returns complete default config", () => {
      const config = getDefaultAgentConfig();

      expect(config.rateLimits).toBeDefined();
      expect(config.tokenLimits).toBeDefined();
      expect(config.contentFilterConfig).toBeDefined();
      expect(config.featureFlags).toBeDefined();
      expect(config.confidenceThresholds).toBeDefined();
    });

    it("all required fields are present", () => {
      const config = getDefaultAgentConfig();

      // Rate limits
      expect(typeof config.rateLimits.CHAT_PER_MINUTE).toBe("number");
      expect(typeof config.rateLimits.ACTIONS_PER_MINUTE).toBe("number");

      // Token limits
      expect(typeof config.tokenLimits.MAX_CONVERSATION_CONTEXT).toBe("number");
      expect(typeof config.tokenLimits.MAX_RESPONSE_TOKENS).toBe("number");

      // Content filter
      expect(typeof config.contentFilterConfig.SANITIZE_INPUT).toBe("boolean");
      expect(typeof config.contentFilterConfig.DETECT_INJECTION).toBe("boolean");

      // Feature flags
      expect(typeof config.featureFlags.enablePlanning).toBe("boolean");
      expect(typeof config.featureFlags.enableStreaming).toBe("boolean");

      // Confidence thresholds
      expect(typeof config.confidenceThresholds.ACTION).toBe("number");
      expect(typeof config.confidenceThresholds.HIGH_RISK).toBe("number");
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Config Service Tests (with mocked DB)
// ─────────────────────────────────────────────────────────────

describe("AgentConfigService", () => {
  // These tests verify the service behavior with mocked DB responses
  // Integration tests would test with actual DB

  beforeEach(async () => {
    // Reset all mocks and clear cache before each test
    vi.clearAllMocks();
    const { agentConfigService } = await import("@/lib/agent/config/service");
    agentConfigService.clearCache();
  });

  describe("getConfig", () => {
    it("returns defaults when no DB config exists", async () => {
      const { agentConfigService } = await import("@/lib/agent/config/service");
      const { db } = await import("@/lib/db");

      // Mock no config in DB
      vi.mocked(db.agentUserConfig.findUnique).mockResolvedValue(null);

      const config = await agentConfigService.getConfig("test-user-id");

      expect(config.rateLimits.CHAT_PER_MINUTE).toBe(20);
      expect(config.featureFlags.enablePlanning).toBe(true);
    });

    it("merges DB config with defaults", async () => {
      const { agentConfigService } = await import("@/lib/agent/config/service");
      const { db } = await import("@/lib/db");

      // Mock partial config in DB
      vi.mocked(db.agentUserConfig.findUnique).mockResolvedValue({
        id: "config-id",
        userId: "test-user-id",
        rateLimits: { CHAT_PER_MINUTE: 50 },
        tokenLimits: {},
        contentFilterConfig: { SANITIZE_INPUT: false },
        featureFlags: { enableProactive: true },
        confidenceThresholds: { ACTION: 0.85 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const config = await agentConfigService.getConfig("test-user-id");

      // User overrides
      expect(config.rateLimits.CHAT_PER_MINUTE).toBe(50);
      expect(config.contentFilterConfig.SANITIZE_INPUT).toBe(false);
      expect(config.featureFlags.enableProactive).toBe(true);
      expect(config.confidenceThresholds.ACTION).toBe(0.85);

      // Defaults
      expect(config.rateLimits.ACTIONS_PER_MINUTE).toBe(10);
      expect(config.contentFilterConfig.FILTER_OUTPUT).toBe(true);
      expect(config.featureFlags.enablePlanning).toBe(true);
      expect(config.confidenceThresholds.STATEMENT).toBe(0.5);
    });

    it("uses cached config on subsequent calls", async () => {
      const { agentConfigService } = await import("@/lib/agent/config/service");
      const { db } = await import("@/lib/db");

      vi.mocked(db.agentUserConfig.findUnique).mockResolvedValue(null);

      // First call - should hit DB
      await agentConfigService.getConfig("cached-user-unique");
      const callsAfterFirst = vi.mocked(db.agentUserConfig.findUnique).mock.calls.length;

      // Second call - should use cache (no new DB calls)
      await agentConfigService.getConfig("cached-user-unique");
      const callsAfterSecond = vi.mocked(db.agentUserConfig.findUnique).mock.calls.length;

      expect(callsAfterSecond).toBe(callsAfterFirst);
    });
  });

  describe("helper methods", () => {
    it("getRateLimit returns specific rate limit", async () => {
      const { agentConfigService } = await import("@/lib/agent/config/service");
      const { db } = await import("@/lib/db");

      vi.mocked(db.agentUserConfig.findUnique).mockResolvedValue(null);

      const limit = await agentConfigService.getRateLimit(
        "test-user-rate",
        "CHAT_PER_MINUTE"
      );
      expect(limit).toBe(20);
    });

    it("getTokenLimit returns specific token limit", async () => {
      const { agentConfigService } = await import("@/lib/agent/config/service");
      const { db } = await import("@/lib/db");

      vi.mocked(db.agentUserConfig.findUnique).mockResolvedValue(null);

      const limit = await agentConfigService.getTokenLimit(
        "test-user-token",
        "MAX_RESPONSE_TOKENS"
      );
      expect(limit).toBe(2000);
    });

    it("isFeatureEnabled returns correct boolean", async () => {
      const { agentConfigService } = await import("@/lib/agent/config/service");
      const { db } = await import("@/lib/db");

      vi.mocked(db.agentUserConfig.findUnique).mockResolvedValue({
        id: "config-id",
        userId: "test-user-feature",
        rateLimits: {},
        tokenLimits: {},
        contentFilterConfig: {},
        featureFlags: { enableProactive: true },
        confidenceThresholds: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const enabled = await agentConfigService.isFeatureEnabled(
        "test-user-feature",
        "enableProactive"
      );
      expect(enabled).toBe(true);
    });

    it("getConfidenceThreshold returns correct value", async () => {
      const { agentConfigService } = await import("@/lib/agent/config/service");
      const { db } = await import("@/lib/db");

      vi.mocked(db.agentUserConfig.findUnique).mockResolvedValue({
        id: "config-id",
        userId: "test-user-confidence",
        rateLimits: {},
        tokenLimits: {},
        contentFilterConfig: {},
        featureFlags: {},
        confidenceThresholds: { HIGH_RISK: 0.95 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const threshold = await agentConfigService.getConfidenceThreshold(
        "test-user-confidence",
        "HIGH_RISK"
      );
      expect(threshold).toBe(0.95);
    });
  });

  describe("cache management", () => {
    it("invalidateCache clears specific user cache", async () => {
      const { agentConfigService } = await import("@/lib/agent/config/service");
      const { db } = await import("@/lib/db");

      vi.mocked(db.agentUserConfig.findUnique).mockResolvedValue(null);

      // Populate cache
      await agentConfigService.getConfig("user-invalidate-1");
      const callsAfterFirst = vi.mocked(db.agentUserConfig.findUnique).mock.calls.length;

      // Verify cached (no new call)
      await agentConfigService.getConfig("user-invalidate-1");
      expect(vi.mocked(db.agentUserConfig.findUnique).mock.calls.length).toBe(callsAfterFirst);

      // Invalidate specific user
      agentConfigService.invalidateCache("user-invalidate-1");

      // Next call should hit DB (new call)
      await agentConfigService.getConfig("user-invalidate-1");
      expect(vi.mocked(db.agentUserConfig.findUnique).mock.calls.length).toBe(callsAfterFirst + 1);
    });

    it("clearCache clears all cached configs", async () => {
      const { agentConfigService } = await import("@/lib/agent/config/service");
      const { db } = await import("@/lib/db");

      vi.mocked(db.agentUserConfig.findUnique).mockResolvedValue(null);

      // Populate cache with multiple users
      await agentConfigService.getConfig("user-clear-1");
      await agentConfigService.getConfig("user-clear-2");
      const callsAfterPopulate = vi.mocked(db.agentUserConfig.findUnique).mock.calls.length;

      // Clear all
      agentConfigService.clearCache();

      // Both calls should hit DB
      await agentConfigService.getConfig("user-clear-1");
      await agentConfigService.getConfig("user-clear-2");
      expect(vi.mocked(db.agentUserConfig.findUnique).mock.calls.length).toBe(callsAfterPopulate + 2);
    });
  });
});

