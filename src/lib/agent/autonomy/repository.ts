// ═══════════════════════════════════════════════════════════════════════════
// Agent Autonomy Repository
// Database operations for user autonomy settings
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import type { UserAutonomySettings as DbSettings, Prisma } from "@prisma/client";
import { agentLogger } from "../logger";
import type {
  UserAutonomySettings,
  PartialAutonomySettings,
  ApprovalMode,
  CategoryApprovalSetting,
  ToolApprovalSetting,
  QuietHoursSettings,
} from "./types";
import { getDefaultAutonomySettings } from "./defaults";
import type { ToolCategory } from "../constants";

const logger = agentLogger.child("autonomy-repository");

// ─────────────────────────────────────────────────────────────
// Database-Domain Conversion
// ─────────────────────────────────────────────────────────────

/**
 * Convert database record to domain model
 * Merges stored settings with defaults for missing fields
 */
function toDomainModel(record: DbSettings | null): UserAutonomySettings {
  const defaults = getDefaultAutonomySettings();

  if (!record) {
    return defaults;
  }

  // Parse the JSON settings field
  const storedSettings = (record.settings as Record<string, unknown>) ?? {};

  // Map database approval levels to our ApprovalMode
  const approvalModeMap: Record<string, ApprovalMode> = {
    auto: "trust_confident",
    confirm: "high_risk_only",
    review: "always_approve",
    never: "always_approve", // "never" execute = always need approval
  };

  const defaultMode =
    approvalModeMap[record.defaultApprovalLevel] ?? defaults.defaultApprovalMode;

  // Extract category settings from stored settings
  const categorySettings: Partial<Record<ToolCategory, CategoryApprovalSetting>> = {
    ...defaults.categorySettings,
  };

  // Extract tool overrides from stored settings
  const toolOverrides: Record<string, ToolApprovalSetting> = {};

  // Parse tool-specific settings (e.g., "email.send": "confirm")
  for (const [key, value] of Object.entries(storedSettings)) {
    if (typeof value === "string" && approvalModeMap[value]) {
      toolOverrides[key] = {
        mode: approvalModeMap[value],
      };
    } else if (typeof value === "object" && value !== null) {
      // More complex setting object
      const setting = value as Record<string, unknown>;
      toolOverrides[key] = {
        mode: approvalModeMap[setting.mode as string] ?? defaults.defaultApprovalMode,
        confidenceOverride:
          typeof setting.confidenceOverride === "number"
            ? setting.confidenceOverride
            : undefined,
        alwaysNotify:
          typeof setting.alwaysNotify === "boolean" ? setting.alwaysNotify : undefined,
        disabled: typeof setting.disabled === "boolean" ? setting.disabled : undefined,
      };
    }
  }

  // Extract quiet hours if present
  const quietHours: QuietHoursSettings | undefined =
    storedSettings.quietHours && typeof storedSettings.quietHours === "object"
      ? (storedSettings.quietHours as QuietHoursSettings)
      : defaults.quietHours;

  // Extract confidence threshold
  const confidenceThreshold =
    typeof storedSettings.confidenceThreshold === "number"
      ? storedSettings.confidenceThreshold
      : defaults.confidenceThreshold;

  return {
    defaultApprovalMode: defaultMode,
    confidenceThreshold,
    categorySettings,
    toolOverrides,
    quietHours,
    highRiskOverride: record.highRiskOverride,
    notifyOnAutoExecute: record.notifyOnAutoApply,
  };
}

/**
 * Convert domain model to database format
 */
function toDbFormat(settings: PartialAutonomySettings): {
  settings?: Prisma.InputJsonValue;
  defaultApprovalLevel?: string;
  highRiskOverride?: boolean;
  notifyOnAutoApply?: boolean;
} {
  // Map ApprovalMode to database approval levels
  const approvalLevelMap: Record<ApprovalMode, string> = {
    trust_confident: "auto",
    high_risk_only: "confirm",
    always_approve: "review",
    full_autonomy: "auto",
  };

  const result: {
    settings?: Prisma.InputJsonValue;
    defaultApprovalLevel?: string;
    highRiskOverride?: boolean;
    notifyOnAutoApply?: boolean;
  } = {};

  // Build the settings JSON
  const settingsJson: Record<string, unknown> = {};

  // Add confidence threshold
  if (settings.confidenceThreshold !== undefined) {
    settingsJson.confidenceThreshold = settings.confidenceThreshold;
  }

  // Add quiet hours
  if (settings.quietHours !== undefined) {
    settingsJson.quietHours = settings.quietHours;
  }

  // Add category settings
  if (settings.categorySettings) {
    for (const [category, setting] of Object.entries(settings.categorySettings)) {
      if (setting) {
        settingsJson[`category.${category}`] = {
          mode: approvalLevelMap[setting.mode],
          confidenceOverride: setting.confidenceOverride,
        };
      }
    }
  }

  // Add tool overrides
  if (settings.toolOverrides) {
    for (const [tool, setting] of Object.entries(settings.toolOverrides)) {
      settingsJson[tool] = {
        mode: approvalLevelMap[setting.mode],
        confidenceOverride: setting.confidenceOverride,
        alwaysNotify: setting.alwaysNotify,
        disabled: setting.disabled,
      };
    }
  }

  result.settings = settingsJson as Prisma.InputJsonValue;

  // Map default approval mode
  if (settings.defaultApprovalMode !== undefined) {
    result.defaultApprovalLevel = approvalLevelMap[settings.defaultApprovalMode];
  }

  // Map boolean fields
  if (settings.highRiskOverride !== undefined) {
    result.highRiskOverride = settings.highRiskOverride;
  }
  if (settings.notifyOnAutoExecute !== undefined) {
    result.notifyOnAutoApply = settings.notifyOnAutoExecute;
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// Repository Functions
// ─────────────────────────────────────────────────────────────

/**
 * Get autonomy settings for a user
 * Returns merged settings with defaults if not found
 */
export async function getByUserId(userId: string): Promise<UserAutonomySettings> {
  try {
    const record = await db.userAutonomySettings.findUnique({
      where: { userId },
    });

    return toDomainModel(record);
  } catch (error) {
    logger.error("Failed to get autonomy settings", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });

    // Return defaults on error
    return getDefaultAutonomySettings();
  }
}

/**
 * Check if user has custom autonomy settings
 */
export async function hasSettings(userId: string): Promise<boolean> {
  try {
    const count = await db.userAutonomySettings.count({
      where: { userId },
    });
    return count > 0;
  } catch (error) {
    logger.error("Failed to check autonomy settings", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Create or update autonomy settings for a user
 */
export async function upsert(
  userId: string,
  settings: PartialAutonomySettings
): Promise<UserAutonomySettings> {
  try {
    const dbFormat = toDbFormat(settings);

    // Get existing settings to merge
    const existing = await db.userAutonomySettings.findUnique({
      where: { userId },
    });

    let record: DbSettings;

    if (existing) {
      // Merge settings JSON
      const existingSettings = (existing.settings as Record<string, unknown>) ?? {};
      const mergedSettings = {
        ...existingSettings,
        ...(dbFormat.settings as Record<string, unknown>),
      };

      record = await db.userAutonomySettings.update({
        where: { userId },
        data: {
          settings: mergedSettings as Prisma.InputJsonValue,
          defaultApprovalLevel:
            dbFormat.defaultApprovalLevel ?? existing.defaultApprovalLevel,
          highRiskOverride: dbFormat.highRiskOverride ?? existing.highRiskOverride,
          notifyOnAutoApply: dbFormat.notifyOnAutoApply ?? existing.notifyOnAutoApply,
        },
      });

      logger.info("Updated autonomy settings", { userId });
    } else {
      // Create new settings
      record = await db.userAutonomySettings.create({
        data: {
          userId,
          settings: (dbFormat.settings ?? {}) as Prisma.InputJsonValue,
          defaultApprovalLevel: dbFormat.defaultApprovalLevel ?? "confirm",
          highRiskOverride: dbFormat.highRiskOverride ?? true,
          notifyOnAutoApply: dbFormat.notifyOnAutoApply ?? true,
        },
      });

      logger.info("Created autonomy settings", { userId });
    }

    return toDomainModel(record);
  } catch (error) {
    logger.error("Failed to upsert autonomy settings", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

/**
 * Update specific tool override
 */
export async function setToolOverride(
  userId: string,
  toolName: string,
  setting: ToolApprovalSetting
): Promise<UserAutonomySettings> {
  return upsert(userId, {
    toolOverrides: {
      [toolName]: setting,
    },
  });
}

/**
 * Remove a tool override (revert to category/default)
 */
export async function removeToolOverride(
  userId: string,
  toolName: string
): Promise<UserAutonomySettings> {
  try {
    const existing = await db.userAutonomySettings.findUnique({
      where: { userId },
    });

    if (!existing) {
      return getDefaultAutonomySettings();
    }

    const settings = (existing.settings as Record<string, unknown>) ?? {};
    delete settings[toolName];

    const record = await db.userAutonomySettings.update({
      where: { userId },
      data: {
        settings: settings as Prisma.InputJsonValue,
      },
    });

    logger.info("Removed tool override", { userId, toolName });
    return toDomainModel(record);
  } catch (error) {
    logger.error("Failed to remove tool override", {
      userId,
      toolName,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Reset settings to defaults
 */
export async function reset(userId: string): Promise<UserAutonomySettings> {
  try {
    await db.userAutonomySettings.deleteMany({
      where: { userId },
    });

    logger.info("Reset autonomy settings to defaults", { userId });
    return getDefaultAutonomySettings();
  } catch (error) {
    logger.error("Failed to reset autonomy settings", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// Export Repository Object
// ─────────────────────────────────────────────────────────────

export const autonomyRepository = {
  getByUserId,
  hasSettings,
  upsert,
  setToolOverride,
  removeToolOverride,
  reset,
};

