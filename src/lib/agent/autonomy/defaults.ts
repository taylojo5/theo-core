// ═══════════════════════════════════════════════════════════════════════════
// Agent Autonomy Defaults
// Sensible default settings for user autonomy preferences
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolCategory } from "../constants";
import type {
  UserAutonomySettings,
  ApprovalMode,
  CategoryApprovalSetting,
  QuietHoursSettings,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Default Values
// ─────────────────────────────────────────────────────────────

/**
 * Default approval mode - balance between safety and convenience
 */
export const DEFAULT_APPROVAL_MODE: ApprovalMode = "high_risk_only";

/**
 * Default confidence threshold
 * Below this, always require approval regardless of mode
 * 0.8 = 80% confidence minimum for auto-execution
 */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.8;

/**
 * Default category-specific settings
 * More restrictive for external actions, more permissive for queries
 */
export const DEFAULT_CATEGORY_SETTINGS: Partial<Record<ToolCategory, CategoryApprovalSetting>> = {
  // Queries are safe - just reading data
  query: {
    mode: "trust_confident",
    confidenceOverride: 0.7, // Lower threshold for reads
  },

  // Creating new items is moderate risk
  create: {
    mode: "high_risk_only",
  },

  // Updating existing items is moderate risk
  update: {
    mode: "high_risk_only",
  },

  // Deleting is high risk - always confirm
  delete: {
    mode: "always_approve",
  },

  // External actions (email, calendar) need extra care
  external: {
    mode: "always_approve", // Sending emails always needs approval
    confidenceOverride: 0.95, // Very high threshold
  },
};

/**
 * Default quiet hours settings
 * Disabled by default, user must opt-in
 */
export const DEFAULT_QUIET_HOURS: QuietHoursSettings = {
  enabled: false,
  start: "22:00",
  end: "08:00",
  timezone: "UTC",
  mode: "always_approve", // Very restrictive during quiet hours
};

// ─────────────────────────────────────────────────────────────
// Default Settings Factory
// ─────────────────────────────────────────────────────────────

/**
 * Get default autonomy settings for a new user
 *
 * These defaults prioritize safety:
 * - High-risk actions always need approval
 * - External actions (emails) always need approval
 * - Queries can auto-execute with high confidence
 * - Quiet hours are off by default
 */
export function getDefaultAutonomySettings(): UserAutonomySettings {
  return {
    defaultApprovalMode: DEFAULT_APPROVAL_MODE,
    confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
    categorySettings: { ...DEFAULT_CATEGORY_SETTINGS },
    toolOverrides: {},
    quietHours: { ...DEFAULT_QUIET_HOURS },
    highRiskOverride: true, // Always require approval for high-risk
    notifyOnAutoExecute: true, // Keep users informed
  };
}

/**
 * Get conservative settings (maximum safety)
 * For users who want full control
 */
export function getConservativeAutonomySettings(): UserAutonomySettings {
  return {
    defaultApprovalMode: "always_approve",
    confidenceThreshold: 0.95, // Very high threshold
    categorySettings: {
      query: { mode: "trust_confident", confidenceOverride: 0.9 },
      create: { mode: "always_approve" },
      update: { mode: "always_approve" },
      delete: { mode: "always_approve" },
      external: { mode: "always_approve" },
    },
    toolOverrides: {},
    quietHours: {
      enabled: true,
      start: "20:00",
      end: "09:00",
      timezone: "UTC",
      mode: "always_approve",
    },
    highRiskOverride: true,
    notifyOnAutoExecute: true,
  };
}

/**
 * Get permissive settings (maximum convenience)
 * For power users who trust the AI
 * WARNING: This can lead to unintended actions
 */
export function getPermissiveAutonomySettings(): UserAutonomySettings {
  return {
    defaultApprovalMode: "trust_confident",
    confidenceThreshold: 0.7, // Lower threshold
    categorySettings: {
      query: { mode: "full_autonomy" }, // Queries just run
      create: { mode: "trust_confident", confidenceOverride: 0.8 },
      update: { mode: "trust_confident", confidenceOverride: 0.85 },
      delete: { mode: "high_risk_only" }, // Still careful with deletions
      external: { mode: "high_risk_only" }, // Still careful with emails
    },
    toolOverrides: {},
    quietHours: undefined,
    highRiskOverride: true, // Still protect high-risk
    notifyOnAutoExecute: true,
  };
}

// ─────────────────────────────────────────────────────────────
// Preset Names
// ─────────────────────────────────────────────────────────────

/**
 * Autonomy preset names for UI
 */
export type AutonomyPreset = "default" | "conservative" | "permissive" | "custom";

/**
 * Get settings by preset name
 */
export function getAutonomyPreset(preset: AutonomyPreset): UserAutonomySettings | null {
  switch (preset) {
    case "default":
      return getDefaultAutonomySettings();
    case "conservative":
      return getConservativeAutonomySettings();
    case "permissive":
      return getPermissiveAutonomySettings();
    case "custom":
      return null; // Custom means use stored settings
  }
}

/**
 * Preset descriptions for UI
 */
export const AUTONOMY_PRESET_DESCRIPTIONS: Record<AutonomyPreset, string> = {
  default: "Balanced settings - approve risky actions, auto-execute safe ones",
  conservative: "Maximum control - approve most actions before execution",
  permissive: "Maximum convenience - trust the AI for confident decisions",
  custom: "Your custom settings",
};

// ─────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────

/**
 * Validate autonomy settings
 * Returns list of validation errors (empty if valid)
 */
export function validateAutonomySettings(settings: UserAutonomySettings): string[] {
  const errors: string[] = [];

  // Validate confidence threshold
  if (settings.confidenceThreshold < 0 || settings.confidenceThreshold > 1) {
    errors.push(`Confidence threshold must be between 0 and 1, got ${settings.confidenceThreshold}`);
  }

  // Validate category confidence overrides
  for (const [category, setting] of Object.entries(settings.categorySettings)) {
    if (setting?.confidenceOverride !== undefined) {
      if (setting.confidenceOverride < 0 || setting.confidenceOverride > 1) {
        errors.push(
          `Category ${category} confidence override must be between 0 and 1, got ${setting.confidenceOverride}`
        );
      }
    }
  }

  // Validate tool confidence overrides
  for (const [tool, setting] of Object.entries(settings.toolOverrides)) {
    if (setting?.confidenceOverride !== undefined) {
      if (setting.confidenceOverride < 0 || setting.confidenceOverride > 1) {
        errors.push(
          `Tool ${tool} confidence override must be between 0 and 1, got ${setting.confidenceOverride}`
        );
      }
    }
  }

  // Validate quiet hours
  if (settings.quietHours?.enabled) {
    const { start, end } = settings.quietHours;

    // Basic time format validation (HH:MM)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(start)) {
      errors.push(`Quiet hours start time must be in HH:MM format, got ${start}`);
    }
    if (!timeRegex.test(end)) {
      errors.push(`Quiet hours end time must be in HH:MM format, got ${end}`);
    }
  }

  // Warn about dangerous settings (not blocking)
  if (settings.defaultApprovalMode === "full_autonomy" && !settings.highRiskOverride) {
    errors.push("Full autonomy without high-risk override is extremely dangerous");
  }

  return errors;
}

