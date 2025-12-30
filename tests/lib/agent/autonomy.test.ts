// ═══════════════════════════════════════════════════════════════════════════
// Autonomy System Tests
// Tests for user autonomy preferences and approval requirement logic
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  autonomyRepository,
  autonomyService,
  requiresApproval,
  isInQuietHours,
  getDefaultAutonomySettings,
  getConservativeAutonomySettings,
  getPermissiveAutonomySettings,
  getAutonomyPreset,
  validateAutonomySettings,
  isValidApprovalMode,
  isFullAutonomy,
  isValidConfidence,
  type UserAutonomySettings,
  type ApprovalMode,
} from "@/lib/agent/autonomy";
import { RISK_LEVELS, TOOL_CATEGORIES } from "@/lib/agent/constants";
import type { ToolCategory, RiskLevel } from "@/lib/agent/constants";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const mockDbSettings = {
  id: "settings-123",
  userId: "user-123",
  settings: {
    "send_email": { mode: "review" },
    "confidenceThreshold": 0.85,
  },
  defaultApprovalLevel: "confirm",
  highRiskOverride: true,
  learningEnabled: true,
  notifyOnAutoApply: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock the database
vi.mock("@/lib/db", () => ({
  db: {
    userAutonomySettings: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

// Import the mocked modules after mocking
import { db } from "@/lib/db";

// ─────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────

function createTestSettings(
  overrides: Partial<UserAutonomySettings> = {}
): UserAutonomySettings {
  return {
    ...getDefaultAutonomySettings(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("Autonomy System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // Type Guard Tests
  // ─────────────────────────────────────────────────────────────

  describe("Type Guards", () => {
    describe("isValidApprovalMode", () => {
      it("should return true for valid modes", () => {
        expect(isValidApprovalMode("always_approve")).toBe(true);
        expect(isValidApprovalMode("high_risk_only")).toBe(true);
        expect(isValidApprovalMode("trust_confident")).toBe(true);
        expect(isValidApprovalMode("full_autonomy")).toBe(true);
      });

      it("should return false for invalid modes", () => {
        expect(isValidApprovalMode("invalid")).toBe(false);
        expect(isValidApprovalMode(null)).toBe(false);
        expect(isValidApprovalMode(123)).toBe(false);
      });
    });

    describe("isFullAutonomy", () => {
      it("should return true for full autonomy without high-risk override", () => {
        const settings = createTestSettings({
          defaultApprovalMode: "full_autonomy",
          highRiskOverride: false,
        });
        expect(isFullAutonomy(settings)).toBe(true);
      });

      it("should return false for full autonomy with high-risk override", () => {
        const settings = createTestSettings({
          defaultApprovalMode: "full_autonomy",
          highRiskOverride: true,
        });
        expect(isFullAutonomy(settings)).toBe(false);
      });

      it("should return false for other modes", () => {
        const settings = createTestSettings({
          defaultApprovalMode: "high_risk_only",
        });
        expect(isFullAutonomy(settings)).toBe(false);
      });
    });

    describe("isValidConfidence", () => {
      it("should return true for valid confidence values", () => {
        expect(isValidConfidence(0)).toBe(true);
        expect(isValidConfidence(0.5)).toBe(true);
        expect(isValidConfidence(1)).toBe(true);
      });

      it("should return false for invalid values", () => {
        expect(isValidConfidence(-0.1)).toBe(false);
        expect(isValidConfidence(1.1)).toBe(false);
        expect(isValidConfidence("0.5")).toBe(false);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Default Settings Tests
  // ─────────────────────────────────────────────────────────────

  describe("Default Settings", () => {
    describe("getDefaultAutonomySettings", () => {
      it("should return sensible defaults", () => {
        const defaults = getDefaultAutonomySettings();

        expect(defaults.defaultApprovalMode).toBe("high_risk_only");
        expect(defaults.confidenceThreshold).toBe(0.8);
        expect(defaults.highRiskOverride).toBe(true);
        expect(defaults.notifyOnAutoExecute).toBe(true);
      });

      it("should have category settings", () => {
        const defaults = getDefaultAutonomySettings();

        expect(defaults.categorySettings.query).toBeDefined();
        expect(defaults.categorySettings.external?.mode).toBe("always_approve");
      });
    });

    describe("getConservativeAutonomySettings", () => {
      it("should be more restrictive", () => {
        const conservative = getConservativeAutonomySettings();

        expect(conservative.defaultApprovalMode).toBe("always_approve");
        expect(conservative.confidenceThreshold).toBeGreaterThan(0.9);
      });
    });

    describe("getPermissiveAutonomySettings", () => {
      it("should be more permissive", () => {
        const permissive = getPermissiveAutonomySettings();

        expect(permissive.defaultApprovalMode).toBe("trust_confident");
        expect(permissive.confidenceThreshold).toBeLessThan(0.8);
      });
    });

    describe("getAutonomyPreset", () => {
      it("should return correct preset", () => {
        expect(getAutonomyPreset("default")).toEqual(getDefaultAutonomySettings());
        expect(getAutonomyPreset("conservative")).toEqual(getConservativeAutonomySettings());
        expect(getAutonomyPreset("permissive")).toEqual(getPermissiveAutonomySettings());
        expect(getAutonomyPreset("custom")).toBeNull();
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Validation Tests
  // ─────────────────────────────────────────────────────────────

  describe("validateAutonomySettings", () => {
    it("should pass valid settings", () => {
      const settings = getDefaultAutonomySettings();
      const errors = validateAutonomySettings(settings);

      expect(errors).toHaveLength(0);
    });

    it("should reject invalid confidence threshold", () => {
      const settings = createTestSettings({
        confidenceThreshold: 1.5,
      });

      const errors = validateAutonomySettings(settings);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes("Confidence threshold"))).toBe(true);
    });

    it("should warn about dangerous full autonomy settings", () => {
      const settings = createTestSettings({
        defaultApprovalMode: "full_autonomy",
        highRiskOverride: false,
      });

      const errors = validateAutonomySettings(settings);

      expect(errors.some((e) => e.includes("dangerous"))).toBe(true);
    });

    it("should validate quiet hours format", () => {
      const settings = createTestSettings({
        quietHours: {
          enabled: true,
          start: "25:00", // Invalid
          end: "08:00",
          timezone: "UTC",
          mode: "always_approve",
        },
      });

      const errors = validateAutonomySettings(settings);

      expect(errors.some((e) => e.includes("Quiet hours"))).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Quiet Hours Tests
  // ─────────────────────────────────────────────────────────────

  describe("isInQuietHours", () => {
    it("should return false when quiet hours disabled", () => {
      const settings = createTestSettings({
        quietHours: {
          enabled: false,
          start: "22:00",
          end: "08:00",
          timezone: "UTC",
          mode: "always_approve",
        },
      });

      expect(isInQuietHours(settings)).toBe(false);
    });

    it("should return true during overnight quiet hours", () => {
      const settings = createTestSettings({
        quietHours: {
          enabled: true,
          start: "22:00",
          end: "08:00",
          timezone: "UTC",
          mode: "always_approve",
        },
      });

      // 23:00 UTC is during quiet hours (22:00-08:00)
      const lateNight = new Date("2024-01-15T23:00:00Z");
      expect(isInQuietHours(settings, lateNight)).toBe(true);

      // 06:00 UTC is during quiet hours (22:00-08:00)
      const earlyMorning = new Date("2024-01-15T06:00:00Z");
      expect(isInQuietHours(settings, earlyMorning)).toBe(true);
    });

    it("should return false outside quiet hours", () => {
      const settings = createTestSettings({
        quietHours: {
          enabled: true,
          start: "22:00",
          end: "08:00",
          timezone: "UTC",
          mode: "always_approve",
        },
      });

      // 14:00 UTC is outside quiet hours
      const afternoon = new Date("2024-01-15T14:00:00Z");
      expect(isInQuietHours(settings, afternoon)).toBe(false);
    });

    it("should handle same-day quiet hours", () => {
      const settings = createTestSettings({
        quietHours: {
          enabled: true,
          start: "12:00",
          end: "14:00",
          timezone: "UTC",
          mode: "always_approve",
        },
      });

      // 13:00 UTC is during quiet hours (12:00-14:00)
      const duringQuiet = new Date("2024-01-15T13:00:00Z");
      expect(isInQuietHours(settings, duringQuiet)).toBe(true);

      // 15:00 UTC is outside quiet hours
      const afterQuiet = new Date("2024-01-15T15:00:00Z");
      expect(isInQuietHours(settings, afterQuiet)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Approval Requirement Tests
  // ─────────────────────────────────────────────────────────────

  describe("requiresApproval", () => {
    const toolName = "create_task";
    const toolCategory: ToolCategory = TOOL_CATEGORIES.CREATE;
    const lowRisk: RiskLevel = RISK_LEVELS.LOW;
    const highRisk: RiskLevel = RISK_LEVELS.HIGH;

    describe("Default Mode (high_risk_only)", () => {
      it("should not require approval for low-risk actions", () => {
        // Clear category settings to test pure default mode behavior
        const settings = createTestSettings({
          defaultApprovalMode: "high_risk_only",
          categorySettings: {}, // No category overrides
        });

        const result = requiresApproval(settings, toolName, toolCategory, lowRisk, 0.9);

        expect(result.required).toBe(false);
        expect(result.determinedBy).toBe("default");
      });

      it("should require approval for high-risk actions", () => {
        // Clear category settings to test pure default mode behavior
        const settings = createTestSettings({
          defaultApprovalMode: "high_risk_only",
          categorySettings: {}, // No category overrides
        });

        const result = requiresApproval(settings, toolName, toolCategory, highRisk, 0.9);

        expect(result.required).toBe(true);
        expect(result.reason).toContain("High-risk");
      });
    });

    describe("Always Approve Mode", () => {
      it("should always require approval", () => {
        // Clear category settings to test pure default mode
        const settings = createTestSettings({
          defaultApprovalMode: "always_approve",
          categorySettings: {}, // No category overrides
        });

        const result = requiresApproval(settings, toolName, toolCategory, lowRisk, 0.99);

        expect(result.required).toBe(true);
        expect(result.effectiveMode).toBe("always_approve");
      });
    });

    describe("Trust Confident Mode", () => {
      it("should not require approval when confidence exceeds threshold", () => {
        // Clear category settings to test pure trust_confident mode
        const settings = createTestSettings({
          defaultApprovalMode: "trust_confident",
          confidenceThreshold: 0.8,
          categorySettings: {}, // No category overrides
        });

        const result = requiresApproval(settings, toolName, toolCategory, lowRisk, 0.9);

        expect(result.required).toBe(false);
        // The reason may come from the default mode logic
        expect(result.determinedBy).toBe("default");
      });

      it("should require approval when confidence below threshold", () => {
        // Clear category settings to test pure threshold behavior
        const settings = createTestSettings({
          defaultApprovalMode: "trust_confident",
          confidenceThreshold: 0.8,
          categorySettings: {}, // No category overrides
        });

        const result = requiresApproval(settings, toolName, toolCategory, lowRisk, 0.7);

        expect(result.required).toBe(true);
        expect(result.determinedBy).toBe("low_confidence");
      });
    });

    describe("Full Autonomy Mode", () => {
      it("should not require approval when high-risk override is off", () => {
        // Clear category settings to test pure full_autonomy mode
        // Use confidence above threshold (0.8 default) to pass confidence check
        const settings = createTestSettings({
          defaultApprovalMode: "full_autonomy",
          highRiskOverride: false,
          categorySettings: {}, // No category overrides
        });

        const result = requiresApproval(settings, toolName, toolCategory, lowRisk, 0.9);

        expect(result.required).toBe(false);
        expect(result.effectiveMode).toBe("full_autonomy");
      });

      it("should still require approval for high-risk when override is on", () => {
        // Clear category settings to test pure high-risk override
        const settings = createTestSettings({
          defaultApprovalMode: "full_autonomy",
          highRiskOverride: true,
          categorySettings: {}, // No category overrides
        });

        const result = requiresApproval(settings, toolName, toolCategory, highRisk, 0.9);

        expect(result.required).toBe(true);
        expect(result.determinedBy).toBe("high_risk");
      });
    });

    describe("Tool-Level Overrides", () => {
      it("should use tool-specific settings when defined", () => {
        const settings = createTestSettings({
          defaultApprovalMode: "full_autonomy",
          toolOverrides: {
            create_task: {
              mode: "always_approve",
            },
          },
        });

        const result = requiresApproval(settings, "create_task", toolCategory, lowRisk, 0.9);

        expect(result.required).toBe(true);
        expect(result.determinedBy).toBe("tool");
      });

      it("should respect tool-specific confidence threshold", () => {
        const settings = createTestSettings({
          defaultApprovalMode: "trust_confident",
          confidenceThreshold: 0.7,
          toolOverrides: {
            create_task: {
              mode: "trust_confident",
              confidenceOverride: 0.95, // Higher threshold for this tool
            },
          },
        });

        const result = requiresApproval(settings, "create_task", toolCategory, lowRisk, 0.9);

        expect(result.required).toBe(true);
        expect(result.effectiveThreshold).toBe(0.95);
      });

      it("should block disabled tools", () => {
        const settings = createTestSettings({
          toolOverrides: {
            dangerous_tool: {
              mode: "always_approve",
              disabled: true,
            },
          },
        });

        const result = requiresApproval(
          settings,
          "dangerous_tool",
          toolCategory,
          lowRisk,
          0.99
        );

        expect(result.required).toBe(true);
        expect(result.reason).toContain("disabled");
      });
    });

    describe("Category-Level Settings", () => {
      it("should use category settings when no tool override", () => {
        const settings = createTestSettings({
          defaultApprovalMode: "full_autonomy",
          categorySettings: {
            external: {
              mode: "always_approve",
            },
          },
        });

        const result = requiresApproval(
          settings,
          "send_email",
          TOOL_CATEGORIES.EXTERNAL,
          highRisk,
          0.9
        );

        expect(result.required).toBe(true);
        expect(result.determinedBy).toBe("category");
      });
    });

    describe("Quiet Hours", () => {
      it("should apply quiet hours mode when in quiet hours", () => {
        // Clear category settings to ensure quiet hours take precedence
        const settings = createTestSettings({
          defaultApprovalMode: "full_autonomy",
          categorySettings: {}, // No category overrides
          quietHours: {
            enabled: true,
            start: "00:00", // Always in quiet hours for testing
            end: "23:59",
            timezone: "UTC",
            mode: "always_approve",
          },
        });

        const result = requiresApproval(settings, toolName, toolCategory, lowRisk, 0.99);

        expect(result.required).toBe(true);
        expect(result.determinedBy).toBe("quiet_hours");
        expect(result.shouldNotify).toBe(true);
      });
    });

    describe("Settings Hierarchy", () => {
      it("should prioritize tool > category > default", () => {
        const settings = createTestSettings({
          defaultApprovalMode: "full_autonomy",
          categorySettings: {
            create: {
              mode: "high_risk_only",
            },
          },
          toolOverrides: {
            create_task: {
              mode: "always_approve",
            },
          },
        });

        // Tool override should win
        const result = requiresApproval(settings, "create_task", toolCategory, lowRisk, 0.9);
        expect(result.required).toBe(true);
        expect(result.determinedBy).toBe("tool");

        // Category should apply for other tools in category
        const result2 = requiresApproval(
          settings,
          "create_event",
          toolCategory,
          lowRisk,
          0.9
        );
        expect(result2.required).toBe(false);
        expect(result2.determinedBy).toBe("category");
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Repository Tests
  // ─────────────────────────────────────────────────────────────

  describe("autonomyRepository", () => {
    describe("getByUserId", () => {
      it("should return defaults when no settings exist", async () => {
        vi.mocked(db.userAutonomySettings.findUnique).mockResolvedValue(null);

        const result = await autonomyRepository.getByUserId("user-123");

        expect(result).toEqual(getDefaultAutonomySettings());
      });

      it("should merge stored settings with defaults", async () => {
        vi.mocked(db.userAutonomySettings.findUnique).mockResolvedValue(mockDbSettings);

        const result = await autonomyRepository.getByUserId("user-123");

        expect(result.highRiskOverride).toBe(true);
        expect(result.notifyOnAutoExecute).toBe(true);
      });
    });

    describe("upsert", () => {
      it("should create settings when none exist", async () => {
        vi.mocked(db.userAutonomySettings.findUnique).mockResolvedValue(null);
        vi.mocked(db.userAutonomySettings.create).mockResolvedValue(mockDbSettings);

        await autonomyRepository.upsert("user-123", {
          defaultApprovalMode: "always_approve",
        });

        expect(db.userAutonomySettings.create).toHaveBeenCalled();
      });

      it("should update settings when they exist", async () => {
        vi.mocked(db.userAutonomySettings.findUnique).mockResolvedValue(mockDbSettings);
        vi.mocked(db.userAutonomySettings.update).mockResolvedValue(mockDbSettings);

        await autonomyRepository.upsert("user-123", {
          defaultApprovalMode: "trust_confident",
        });

        expect(db.userAutonomySettings.update).toHaveBeenCalled();
      });
    });

    describe("reset", () => {
      it("should delete settings and return defaults", async () => {
        vi.mocked(db.userAutonomySettings.deleteMany).mockResolvedValue({ count: 1 });

        const result = await autonomyRepository.reset("user-123");

        expect(db.userAutonomySettings.deleteMany).toHaveBeenCalledWith({
          where: { userId: "user-123" },
        });
        expect(result).toEqual(getDefaultAutonomySettings());
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Service Tests
  // ─────────────────────────────────────────────────────────────

  describe("autonomyService", () => {
    describe("getAutonomySettings", () => {
      it("should get settings for a user", async () => {
        vi.mocked(db.userAutonomySettings.findUnique).mockResolvedValue(mockDbSettings);

        const result = await autonomyService.getAutonomySettings("user-123");

        expect(result).toBeDefined();
        expect(result.highRiskOverride).toBe(true);
      });
    });

    describe("updateAutonomySettings", () => {
      it("should validate and update settings", async () => {
        vi.mocked(db.userAutonomySettings.findUnique).mockResolvedValue(mockDbSettings);
        vi.mocked(db.userAutonomySettings.update).mockResolvedValue(mockDbSettings);

        const result = await autonomyService.updateAutonomySettings("user-123", {
          confidenceThreshold: 0.9,
        });

        expect(result).toBeDefined();
      });

      it("should reject invalid settings", async () => {
        vi.mocked(db.userAutonomySettings.findUnique).mockResolvedValue(mockDbSettings);

        await expect(
          autonomyService.updateAutonomySettings("user-123", {
            confidenceThreshold: 1.5, // Invalid
          })
        ).rejects.toThrow("Invalid autonomy settings");
      });
    });

    describe("checkApprovalRequired", () => {
      it("should load settings and check approval", async () => {
        vi.mocked(db.userAutonomySettings.findUnique).mockResolvedValue(null);

        const result = await autonomyService.checkApprovalRequired(
          "user-123",
          "create_task",
          TOOL_CATEGORIES.CREATE,
          RISK_LEVELS.LOW,
          0.9
        );

        expect(result.required).toBeDefined();
        expect(result.reason).toBeDefined();
      });
    });
  });
});

