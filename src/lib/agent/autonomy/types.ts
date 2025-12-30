// ═══════════════════════════════════════════════════════════════════════════
// Agent Autonomy Types
// Type definitions for user autonomy and approval preferences
// ═══════════════════════════════════════════════════════════════════════════

import type { RiskLevel, ToolCategory } from "../constants";

// ─────────────────────────────────────────────────────────────
// Approval Mode Types
// ─────────────────────────────────────────────────────────────

/**
 * Approval mode determines when the agent requires user confirmation
 *
 * - `always_approve`: Every action needs explicit user approval
 * - `high_risk_only`: Only high/critical risk actions need approval
 * - `trust_confident`: Auto-execute if LLM confidence > threshold
 * - `full_autonomy`: Never require approval (use with caution!)
 */
export type ApprovalMode =
  | "always_approve"
  | "high_risk_only"
  | "trust_confident"
  | "full_autonomy";

/**
 * Approval mode descriptions for UI display
 */
export const APPROVAL_MODE_DESCRIPTIONS: Record<ApprovalMode, string> = {
  always_approve: "Ask for approval before every action",
  high_risk_only: "Only ask for high-risk actions (emails, deletions, etc.)",
  trust_confident: "Auto-execute when the AI is highly confident",
  full_autonomy: "Never ask for approval (not recommended)",
};

// ─────────────────────────────────────────────────────────────
// Autonomy Settings Types
// ─────────────────────────────────────────────────────────────

/**
 * Complete user autonomy settings
 *
 * This controls how much the user trusts the agent to act independently.
 * Settings are hierarchical: Tool > Category > Default
 */
export interface UserAutonomySettings {
  // ─────────────────────────────────────────────────────────────
  // Global Settings
  // ─────────────────────────────────────────────────────────────

  /** Default approval mode for all actions */
  defaultApprovalMode: ApprovalMode;

  /**
   * Global confidence threshold (0.0-1.0)
   * Below this threshold, always require approval regardless of mode
   */
  confidenceThreshold: number;

  // ─────────────────────────────────────────────────────────────
  // Category-Level Overrides
  // ─────────────────────────────────────────────────────────────

  /**
   * Per-category approval settings
   * Overrides the default mode for specific tool categories
   */
  categorySettings: Partial<Record<ToolCategory, CategoryApprovalSetting>>;

  // ─────────────────────────────────────────────────────────────
  // Tool-Level Overrides (Most Specific)
  // ─────────────────────────────────────────────────────────────

  /**
   * Per-tool approval settings
   * Overrides both default and category settings
   * Key is tool name (e.g., "send_email", "create_task")
   */
  toolOverrides: Record<string, ToolApprovalSetting>;

  // ─────────────────────────────────────────────────────────────
  // Time-Based Settings
  // ─────────────────────────────────────────────────────────────

  /** Quiet hours configuration */
  quietHours?: QuietHoursSettings;

  // ─────────────────────────────────────────────────────────────
  // Safety Settings
  // ─────────────────────────────────────────────────────────────

  /**
   * Always require approval for high-risk actions
   * Even in full_autonomy mode, high-risk actions will need approval
   * Default: true (recommended)
   */
  highRiskOverride: boolean;

  /**
   * Notify user when actions are auto-executed
   * Shows a notification even when approval wasn't required
   * Default: true
   */
  notifyOnAutoExecute: boolean;
}

/**
 * Category-level approval settings
 */
export interface CategoryApprovalSetting {
  /** Approval mode for this category */
  mode: ApprovalMode;

  /** Category-specific confidence threshold (overrides global) */
  confidenceOverride?: number;
}

/**
 * Tool-level approval settings (most specific)
 */
export interface ToolApprovalSetting {
  /** Approval mode for this specific tool */
  mode: ApprovalMode;

  /** Tool-specific confidence threshold */
  confidenceOverride?: number;

  /** Always notify user even if auto-executed */
  alwaysNotify?: boolean;

  /** Completely disable this tool (never execute) */
  disabled?: boolean;
}

/**
 * Quiet hours configuration
 * During quiet hours, a more restrictive approval mode is applied
 */
export interface QuietHoursSettings {
  /** Whether quiet hours are enabled */
  enabled: boolean;

  /** Start time in 24h format (e.g., "22:00") */
  start: string;

  /** End time in 24h format (e.g., "08:00") */
  end: string;

  /** User's timezone (e.g., "America/New_York") */
  timezone: string;

  /** Approval mode during quiet hours (usually more restrictive) */
  mode: ApprovalMode;
}

// ─────────────────────────────────────────────────────────────
// Input/Output Types
// ─────────────────────────────────────────────────────────────

/**
 * Partial settings for updates
 * All fields are optional - missing fields keep existing values
 */
export type PartialAutonomySettings = Partial<UserAutonomySettings>;

/**
 * Result of approval requirement check
 */
export interface ApprovalRequirementResult {
  /** Whether approval is required */
  required: boolean;

  /** Human-readable reason for the decision */
  reason: string;

  /** Which setting level determined this (default, category, tool, quiet_hours) */
  determinedBy: "default" | "category" | "tool" | "quiet_hours" | "high_risk" | "low_confidence";

  /** The effective approval mode that was applied */
  effectiveMode: ApprovalMode;

  /** The effective confidence threshold that was applied */
  effectiveThreshold: number;

  /** Whether user should be notified even if auto-executed */
  shouldNotify: boolean;
}

// ─────────────────────────────────────────────────────────────
// Database-Mapped Types
// ─────────────────────────────────────────────────────────────

/**
 * Raw database record for user autonomy settings
 * Maps to the UserAutonomySettings Prisma model
 */
export interface UserAutonomySettingsRecord {
  id: string;
  userId: string;
  settings: Record<string, unknown>;
  defaultApprovalLevel: string;
  highRiskOverride: boolean;
  learningEnabled: boolean;
  notifyOnAutoApply: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────
// Type Guards
// ─────────────────────────────────────────────────────────────

/**
 * Check if a value is a valid ApprovalMode
 */
export function isValidApprovalMode(value: unknown): value is ApprovalMode {
  return (
    typeof value === "string" &&
    ["always_approve", "high_risk_only", "trust_confident", "full_autonomy"].includes(value)
  );
}

/**
 * Check if settings represent full autonomy (dangerous)
 */
export function isFullAutonomy(settings: UserAutonomySettings): boolean {
  return settings.defaultApprovalMode === "full_autonomy" && !settings.highRiskOverride;
}

/**
 * Check if a confidence value is valid (0.0-1.0)
 */
export function isValidConfidence(value: unknown): value is number {
  return typeof value === "number" && value >= 0 && value <= 1;
}

