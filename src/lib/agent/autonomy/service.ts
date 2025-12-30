// ═══════════════════════════════════════════════════════════════════════════
// Agent Autonomy Service
// Business logic for determining approval requirements
// ═══════════════════════════════════════════════════════════════════════════

import { DateTime } from "luxon";
import { agentLogger } from "../logger";
import { autonomyRepository } from "./repository";
import { getDefaultAutonomySettings, validateAutonomySettings } from "./defaults";
import type {
  UserAutonomySettings,
  PartialAutonomySettings,
  ApprovalRequirementResult,
  ApprovalMode,
  ToolApprovalSetting,
  CategoryApprovalSetting,
} from "./types";
import type { RiskLevel, ToolCategory } from "../constants";
import { RISK_LEVELS } from "../constants";

const logger = agentLogger.child("autonomy-service");

// ─────────────────────────────────────────────────────────────
// Settings Retrieval
// ─────────────────────────────────────────────────────────────

/**
 * Get effective autonomy settings for a user
 * Merges stored settings with defaults
 */
export async function getAutonomySettings(userId: string): Promise<UserAutonomySettings> {
  return autonomyRepository.getByUserId(userId);
}

/**
 * Update user's autonomy settings
 */
export async function updateAutonomySettings(
  userId: string,
  update: PartialAutonomySettings
): Promise<UserAutonomySettings> {
  // Validate settings
  const currentSettings = await getAutonomySettings(userId);
  const mergedSettings: UserAutonomySettings = {
    ...currentSettings,
    ...update,
    categorySettings: {
      ...currentSettings.categorySettings,
      ...update.categorySettings,
    },
    toolOverrides: {
      ...currentSettings.toolOverrides,
      ...update.toolOverrides,
    },
  };

  const errors = validateAutonomySettings(mergedSettings);
  if (errors.length > 0) {
    throw new Error(`Invalid autonomy settings: ${errors.join(", ")}`);
  }

  return autonomyRepository.upsert(userId, update);
}

/**
 * Reset settings to defaults
 */
export async function resetAutonomySettings(userId: string): Promise<UserAutonomySettings> {
  return autonomyRepository.reset(userId);
}

// ─────────────────────────────────────────────────────────────
// Quiet Hours Logic
// ─────────────────────────────────────────────────────────────

/**
 * Check if currently in quiet hours
 */
export function isInQuietHours(
  settings: UserAutonomySettings,
  currentTime: Date = new Date()
): boolean {
  const { quietHours } = settings;

  if (!quietHours?.enabled) {
    return false;
  }

  try {
    // Parse current time in user's timezone
    const now = DateTime.fromJSDate(currentTime).setZone(quietHours.timezone);

    // Parse start and end times
    const [startHour, startMin] = quietHours.start.split(":").map(Number);
    const [endHour, endMin] = quietHours.end.split(":").map(Number);

    const currentMinutes = now.hour * 60 + now.minute;
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Handle overnight quiet hours (e.g., 22:00 - 08:00)
    if (startMinutes > endMinutes) {
      // Overnight: quiet if after start OR before end
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    } else {
      // Same day: quiet if between start and end
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
  } catch (error) {
    logger.warn("Failed to check quiet hours", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Approval Requirement Logic
// ─────────────────────────────────────────────────────────────

/**
 * Determine if an action requires approval based on user settings
 *
 * This is the main function called by the decision/routing logic.
 * It considers:
 * 1. Tool-specific overrides (most specific)
 * 2. Category settings
 * 3. Default approval mode
 * 4. Quiet hours (if enabled)
 * 5. High-risk override (if enabled)
 * 6. LLM confidence vs threshold
 *
 * @param settings - User's autonomy settings
 * @param toolName - Name of the tool to execute
 * @param toolCategory - Category of the tool
 * @param toolRiskLevel - Risk level of the tool
 * @param llmConfidence - LLM's confidence in this action (0.0-1.0)
 * @returns Detailed result including whether approval is required and why
 */
export function requiresApproval(
  settings: UserAutonomySettings,
  toolName: string,
  toolCategory: ToolCategory,
  toolRiskLevel: RiskLevel,
  llmConfidence: number
): ApprovalRequirementResult {
  // 1. Check for tool-specific override (most specific)
  const toolSetting = settings.toolOverrides[toolName];
  if (toolSetting) {
    // Tool is disabled - always require approval (or block)
    if (toolSetting.disabled) {
      return {
        required: true,
        reason: `Tool "${toolName}" is disabled`,
        determinedBy: "tool",
        effectiveMode: "always_approve",
        effectiveThreshold: 1.0,
        shouldNotify: true,
      };
    }

    const effectiveThreshold = toolSetting.confidenceOverride ?? settings.confidenceThreshold;
    const result = evaluateMode(
      toolSetting.mode,
      toolRiskLevel,
      llmConfidence,
      effectiveThreshold
    );

    return {
      ...result,
      determinedBy: "tool",
      effectiveThreshold,
      shouldNotify: toolSetting.alwaysNotify ?? settings.notifyOnAutoExecute,
    };
  }

  // 2. Check category settings
  const categorySetting = settings.categorySettings[toolCategory];
  if (categorySetting) {
    const effectiveThreshold = categorySetting.confidenceOverride ?? settings.confidenceThreshold;
    const result = evaluateMode(
      categorySetting.mode,
      toolRiskLevel,
      llmConfidence,
      effectiveThreshold
    );

    return {
      ...result,
      determinedBy: "category",
      effectiveThreshold,
      shouldNotify: settings.notifyOnAutoExecute,
    };
  }

  // 3. Check quiet hours (before default mode, as it may override)
  if (isInQuietHours(settings)) {
    const quietMode = settings.quietHours?.mode ?? "always_approve";
    const result = evaluateMode(
      quietMode,
      toolRiskLevel,
      llmConfidence,
      settings.confidenceThreshold
    );

    return {
      ...result,
      determinedBy: "quiet_hours",
      effectiveThreshold: settings.confidenceThreshold,
      shouldNotify: true, // Always notify during quiet hours
    };
  }

  // 4. Check high-risk override
  if (settings.highRiskOverride && isHighRisk(toolRiskLevel)) {
    return {
      required: true,
      reason: `High-risk action (${toolRiskLevel}) always requires approval`,
      determinedBy: "high_risk",
      effectiveMode: "always_approve",
      effectiveThreshold: settings.confidenceThreshold,
      shouldNotify: true,
    };
  }

  // 5. Check confidence threshold
  if (llmConfidence < settings.confidenceThreshold) {
    return {
      required: true,
      reason: `Confidence (${Math.round(llmConfidence * 100)}%) below threshold (${Math.round(settings.confidenceThreshold * 100)}%)`,
      determinedBy: "low_confidence",
      effectiveMode: settings.defaultApprovalMode,
      effectiveThreshold: settings.confidenceThreshold,
      shouldNotify: settings.notifyOnAutoExecute,
    };
  }

  // 6. Apply default mode
  const result = evaluateMode(
    settings.defaultApprovalMode,
    toolRiskLevel,
    llmConfidence,
    settings.confidenceThreshold
  );

  return {
    ...result,
    determinedBy: "default",
    effectiveThreshold: settings.confidenceThreshold,
    shouldNotify: settings.notifyOnAutoExecute,
  };
}

/**
 * Evaluate an approval mode to determine if approval is required
 */
function evaluateMode(
  mode: ApprovalMode,
  riskLevel: RiskLevel,
  confidence: number,
  threshold: number
): Pick<ApprovalRequirementResult, "required" | "reason" | "effectiveMode"> {
  switch (mode) {
    case "always_approve":
      return {
        required: true,
        reason: "Approval mode requires confirmation for all actions",
        effectiveMode: mode,
      };

    case "high_risk_only":
      if (isHighRisk(riskLevel)) {
        return {
          required: true,
          reason: `High-risk action (${riskLevel}) requires approval`,
          effectiveMode: mode,
        };
      }
      return {
        required: false,
        reason: `Low/medium risk action (${riskLevel}) can auto-execute`,
        effectiveMode: mode,
      };

    case "trust_confident":
      if (confidence >= threshold) {
        return {
          required: false,
          reason: `Confidence (${Math.round(confidence * 100)}%) meets threshold`,
          effectiveMode: mode,
        };
      }
      return {
        required: true,
        reason: `Confidence (${Math.round(confidence * 100)}%) below threshold (${Math.round(threshold * 100)}%)`,
        effectiveMode: mode,
      };

    case "full_autonomy":
      return {
        required: false,
        reason: "Full autonomy mode - no approval required",
        effectiveMode: mode,
      };

    default:
      // Unknown mode, default to requiring approval
      return {
        required: true,
        reason: `Unknown approval mode: ${mode}`,
        effectiveMode: "always_approve",
      };
  }
}

/**
 * Check if a risk level is considered "high" (high or critical)
 */
function isHighRisk(riskLevel: RiskLevel): boolean {
  return riskLevel === RISK_LEVELS.HIGH || riskLevel === RISK_LEVELS.CRITICAL;
}

// ─────────────────────────────────────────────────────────────
// Convenience Functions
// ─────────────────────────────────────────────────────────────

/**
 * Check if approval is required for a specific action (convenience function)
 * Loads settings and checks in one call
 */
export async function checkApprovalRequired(
  userId: string,
  toolName: string,
  toolCategory: ToolCategory,
  toolRiskLevel: RiskLevel,
  llmConfidence: number
): Promise<ApprovalRequirementResult> {
  const settings = await getAutonomySettings(userId);
  return requiresApproval(settings, toolName, toolCategory, toolRiskLevel, llmConfidence);
}

/**
 * Set a tool to always require approval
 */
export async function setToolAlwaysApprove(
  userId: string,
  toolName: string
): Promise<UserAutonomySettings> {
  return autonomyRepository.setToolOverride(userId, toolName, {
    mode: "always_approve",
  });
}

/**
 * Set a tool to never require approval (full autonomy)
 */
export async function setToolFullAutonomy(
  userId: string,
  toolName: string
): Promise<UserAutonomySettings> {
  return autonomyRepository.setToolOverride(userId, toolName, {
    mode: "full_autonomy",
  });
}

/**
 * Disable a tool (it will always require approval and show as disabled)
 */
export async function disableTool(
  userId: string,
  toolName: string
): Promise<UserAutonomySettings> {
  return autonomyRepository.setToolOverride(userId, toolName, {
    mode: "always_approve",
    disabled: true,
  });
}

/**
 * Enable a tool (remove disabled flag, revert to default behavior)
 */
export async function enableTool(
  userId: string,
  toolName: string
): Promise<UserAutonomySettings> {
  return autonomyRepository.removeToolOverride(userId, toolName);
}

// ─────────────────────────────────────────────────────────────
// Export Service Object
// ─────────────────────────────────────────────────────────────

export const autonomyService = {
  // Settings management
  getAutonomySettings,
  updateAutonomySettings,
  resetAutonomySettings,

  // Approval logic
  requiresApproval,
  checkApprovalRequired,
  isInQuietHours,

  // Tool management
  setToolAlwaysApprove,
  setToolFullAutonomy,
  disableTool,
  enableTool,
};

