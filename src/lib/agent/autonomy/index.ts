// ═══════════════════════════════════════════════════════════════════════════
// Agent Autonomy Module
// User autonomy and approval preference management
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Core types
  ApprovalMode,
  UserAutonomySettings,
  PartialAutonomySettings,

  // Setting types
  CategoryApprovalSetting,
  ToolApprovalSetting,
  QuietHoursSettings,

  // Result types
  ApprovalRequirementResult,

  // Database types
  UserAutonomySettingsRecord,
} from "./types";

export {
  // Constants
  APPROVAL_MODE_DESCRIPTIONS,

  // Type guards
  isValidApprovalMode,
  isFullAutonomy,
  isValidConfidence,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────

export {
  // Default values
  DEFAULT_APPROVAL_MODE,
  DEFAULT_CONFIDENCE_THRESHOLD,
  DEFAULT_CATEGORY_SETTINGS,
  DEFAULT_QUIET_HOURS,

  // Preset factories
  getDefaultAutonomySettings,
  getConservativeAutonomySettings,
  getPermissiveAutonomySettings,
  getAutonomyPreset,

  // Preset types
  type AutonomyPreset,
  AUTONOMY_PRESET_DESCRIPTIONS,

  // Validation
  validateAutonomySettings,
} from "./defaults";

// ─────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────

export { autonomyRepository } from "./repository";

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

export {
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

  // Service object
  autonomyService,
} from "./service";

