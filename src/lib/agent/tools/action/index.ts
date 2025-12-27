// ═══════════════════════════════════════════════════════════════════════════
// Action Tools Module
// Write/modify action tools for the Agent Engine
// ═══════════════════════════════════════════════════════════════════════════

import { toolRegistry } from "../registry";

// ─────────────────────────────────────────────────────────────
// Tool Exports
// ─────────────────────────────────────────────────────────────

export { createTaskTool } from "./create-task";
export { updateTaskTool } from "./update-task";
export { draftEmailTool } from "./draft-email";
export { sendEmailTool } from "./send-email";
export { createCalendarEventTool } from "./create-calendar-event";
export { updateCalendarEventTool } from "./update-calendar-event";

// ─────────────────────────────────────────────────────────────
// All Action Tools Array
// ─────────────────────────────────────────────────────────────

import { createTaskTool } from "./create-task";
import { updateTaskTool } from "./update-task";
import { draftEmailTool } from "./draft-email";
import { sendEmailTool } from "./send-email";
import { createCalendarEventTool } from "./create-calendar-event";
import { updateCalendarEventTool } from "./update-calendar-event";
import type { AnyToolDefinition } from "../types";

/**
 * All action tools as an array
 * Use this for bulk registration or iteration
 */
export const actionTools: AnyToolDefinition[] = [
  createTaskTool,
  updateTaskTool,
  draftEmailTool,
  sendEmailTool,
  createCalendarEventTool,
  updateCalendarEventTool,
];

/**
 * Low-risk action tools (drafts, internal data)
 * These can be auto-executed with confirmation
 */
export const lowRiskActionTools: AnyToolDefinition[] = [
  createTaskTool,
  updateTaskTool,
  draftEmailTool,
];

/**
 * High-risk action tools (external communication, schedule changes)
 * These require explicit user approval before execution
 */
export const highRiskActionTools: AnyToolDefinition[] = [
  sendEmailTool,
  createCalendarEventTool,
  updateCalendarEventTool,
];

// ─────────────────────────────────────────────────────────────
// Registration
// ─────────────────────────────────────────────────────────────

/**
 * Register all action tools with the global registry
 * Call this once during application initialization
 */
export function registerActionTools(): void {
  toolRegistry.registerAll(actionTools);
}


