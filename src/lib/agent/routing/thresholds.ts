// ═══════════════════════════════════════════════════════════════════════════
// Confidence Thresholds
// Configuration for confidence-based action routing
// ═══════════════════════════════════════════════════════════════════════════

import type { ConfidenceThresholdConfig } from "./types";

// ─────────────────────────────────────────────────────────────
// Default Thresholds
// ─────────────────────────────────────────────────────────────

/**
 * Default confidence thresholds for action routing
 *
 * These thresholds determine how the agent routes based on LLM confidence:
 *
 * - **execute** (0.85): High confidence - proceed without asking
 * - **confirm** (0.65): Medium confidence - ask for confirmation
 * - **clarify** (0.40): Low confidence - ask clarifying questions
 * - Below clarify: Very uncertain - definitely need more information
 *
 * @example
 * ```
 * confidence >= 0.85 → Execute immediately
 * confidence >= 0.65 → Ask for confirmation
 * confidence >= 0.40 → Ask clarifying questions
 * confidence < 0.40  → Definitely clarify
 * ```
 */
export const DEFAULT_THRESHOLDS: ConfidenceThresholdConfig = {
  execute: 0.85,
  confirm: 0.65,
  clarify: 0.40,
};

// ─────────────────────────────────────────────────────────────
// Alternative Threshold Presets
// ─────────────────────────────────────────────────────────────

/**
 * Conservative thresholds - higher bars for automation
 * Good for users who want more control
 */
export const CONSERVATIVE_THRESHOLDS: ConfidenceThresholdConfig = {
  execute: 0.95,
  confirm: 0.80,
  clarify: 0.50,
};

/**
 * Aggressive thresholds - lower bars for automation
 * Good for users who trust the AI more
 */
export const AGGRESSIVE_THRESHOLDS: ConfidenceThresholdConfig = {
  execute: 0.75,
  confirm: 0.50,
  clarify: 0.30,
};

/**
 * Always confirm thresholds - never auto-execute
 * Forces confirmation for all actions
 */
export const ALWAYS_CONFIRM_THRESHOLDS: ConfidenceThresholdConfig = {
  execute: 1.01, // Impossible to reach
  confirm: 0.40,
  clarify: 0.20,
};

// ─────────────────────────────────────────────────────────────
// Threshold Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Threshold preset names
 */
export type ThresholdPreset =
  | "default"
  | "conservative"
  | "aggressive"
  | "always_confirm";

/**
 * Get threshold config from preset name
 */
export function getThresholdPreset(
  preset: ThresholdPreset
): ConfidenceThresholdConfig {
  switch (preset) {
    case "conservative":
      return CONSERVATIVE_THRESHOLDS;
    case "aggressive":
      return AGGRESSIVE_THRESHOLDS;
    case "always_confirm":
      return ALWAYS_CONFIRM_THRESHOLDS;
    case "default":
    default:
      return DEFAULT_THRESHOLDS;
  }
}

/**
 * Merge user overrides with default thresholds
 */
export function mergeThresholds(
  overrides?: Partial<ConfidenceThresholdConfig>
): ConfidenceThresholdConfig {
  if (!overrides) {
    return DEFAULT_THRESHOLDS;
  }

  return {
    execute: overrides.execute ?? DEFAULT_THRESHOLDS.execute,
    confirm: overrides.confirm ?? DEFAULT_THRESHOLDS.confirm,
    clarify: overrides.clarify ?? DEFAULT_THRESHOLDS.clarify,
  };
}

/**
 * Validate threshold configuration
 * Returns validation errors if any
 */
export function validateThresholds(
  thresholds: ConfidenceThresholdConfig
): string[] {
  const errors: string[] = [];

  // Check ranges
  if (thresholds.execute < 0 || thresholds.execute > 1.01) {
    errors.push(`execute threshold must be between 0 and 1, got ${thresholds.execute}`);
  }
  if (thresholds.confirm < 0 || thresholds.confirm > 1) {
    errors.push(`confirm threshold must be between 0 and 1, got ${thresholds.confirm}`);
  }
  if (thresholds.clarify < 0 || thresholds.clarify > 1) {
    errors.push(`clarify threshold must be between 0 and 1, got ${thresholds.clarify}`);
  }

  // Check ordering
  if (thresholds.execute <= thresholds.confirm) {
    errors.push(
      `execute threshold (${thresholds.execute}) must be greater than confirm threshold (${thresholds.confirm})`
    );
  }
  if (thresholds.confirm <= thresholds.clarify) {
    errors.push(
      `confirm threshold (${thresholds.confirm}) must be greater than clarify threshold (${thresholds.clarify})`
    );
  }

  return errors;
}

/**
 * Determine which threshold band a confidence score falls into
 */
export type ThresholdBand = "execute" | "confirm" | "clarify" | "uncertain";

/**
 * Get the threshold band for a confidence score
 */
export function getThresholdBand(
  confidence: number,
  thresholds: ConfidenceThresholdConfig = DEFAULT_THRESHOLDS
): ThresholdBand {
  if (confidence >= thresholds.execute) {
    return "execute";
  }
  if (confidence >= thresholds.confirm) {
    return "confirm";
  }
  if (confidence >= thresholds.clarify) {
    return "clarify";
  }
  return "uncertain";
}

/**
 * Get a human-readable description of what will happen at a confidence level
 */
export function describeConfidenceAction(
  confidence: number,
  thresholds: ConfidenceThresholdConfig = DEFAULT_THRESHOLDS
): string {
  const band = getThresholdBand(confidence, thresholds);

  switch (band) {
    case "execute":
      return "Will execute immediately without confirmation";
    case "confirm":
      return "Will ask for confirmation before executing";
    case "clarify":
      return "Will ask clarifying questions before proceeding";
    case "uncertain":
      return "Will definitely ask for more information";
  }
}


