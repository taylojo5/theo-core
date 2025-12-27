// ═══════════════════════════════════════════════════════════════════════════
// Agent Tools Module
// Tool registry and definitions for the Agent Engine
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Tool definition
  ToolDefinition,
  AnyToolDefinition,
  ToolFilterOptions,
  UserToolsOptions,

  // JSON Schema types
  JSONSchema,
  JSONSchemaProperty,
  JSONSchemaString,
  JSONSchemaNumber,
  JSONSchemaBoolean,
  JSONSchemaArray,
  JSONSchemaObject,
  JSONSchemaEnum,

  // Result types
  ValidationResult,
  ValidationError,
  ToolExecutionResult,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Type Utilities
// ─────────────────────────────────────────────────────────────

export {
  // Conversion functions
  toToolForLLM,
  isToolAvailable,

  // Builder helpers
  defineTool,
  objectSchema,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────

export {
  // Registry class (for creating new instances)
  ToolRegistry,
  type ToolRegistrySummary,

  // Singleton instance
  toolRegistry,
} from "./registry";

// ─────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────

export {
  // Validation functions
  validateToolParams,
  validateWithSchema,

  // Error formatting
  formatZodErrors,
  formatErrorsForLLM,
  formatValidationError,

  // Common schemas
  commonSchemas,
  paginatedQuerySchema,
  dateRangeSchema,
} from "./validation";

// ─────────────────────────────────────────────────────────────
// Execution Context
// ─────────────────────────────────────────────────────────────

export type {
  ExtendedExecutionContext,
  CreateContextOptions,
} from "./context";

export {
  // Context creation
  createExecutionContext,
  createExtendedContext,
  createSystemContext,

  // Context composition
  withPlanContext,
  withConversationContext,
  withSessionContext,

  // Context validation
  isValidContext,
  hasPlanContext,
  hasConversationContext,

  // Token provider
  createTokenProvider,
} from "./context";

// ─────────────────────────────────────────────────────────────
// Query Tools
// ─────────────────────────────────────────────────────────────

export {
  // Individual query tools
  queryContextTool,
  searchEmailsTool,
  listCalendarEventsTool,
  checkAvailabilityTool,
  listTasksTool,

  // All query tools array
  queryTools,

  // Registration function
  registerQueryTools,
} from "./query";

// ─────────────────────────────────────────────────────────────
// Action Tools
// ─────────────────────────────────────────────────────────────

export {
  // Individual action tools
  createTaskTool,
  updateTaskTool,
  draftEmailTool,
  sendEmailTool,
  createCalendarEventTool,
  updateCalendarEventTool,

  // All action tools array
  actionTools,

  // Risk-categorized arrays
  lowRiskActionTools,
  highRiskActionTools,

  // Registration function
  registerActionTools,
} from "./action";

// ─────────────────────────────────────────────────────────────
// Combined Tool Registration
// ─────────────────────────────────────────────────────────────

import { registerQueryTools } from "./query";
import { registerActionTools } from "./action";

/**
 * Register all tools with the global registry
 * Call this once during application initialization
 */
export function registerAllTools(): void {
  registerQueryTools();
  registerActionTools();
}

