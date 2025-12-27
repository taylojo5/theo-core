// ═══════════════════════════════════════════════════════════════════════════
// Query Tools Module
// Read-only query tools for the Agent Engine
// ═══════════════════════════════════════════════════════════════════════════

import { toolRegistry } from "../registry";

// ─────────────────────────────────────────────────────────────
// Tool Exports
// ─────────────────────────────────────────────────────────────

export { queryContextTool } from "./query-context";
export { searchEmailsTool } from "./search-emails";
export { listCalendarEventsTool } from "./list-calendar-events";
export { checkAvailabilityTool } from "./check-availability";
export { listTasksTool } from "./list-tasks";

// ─────────────────────────────────────────────────────────────
// All Query Tools Array
// ─────────────────────────────────────────────────────────────

import { queryContextTool } from "./query-context";
import { searchEmailsTool } from "./search-emails";
import { listCalendarEventsTool } from "./list-calendar-events";
import { checkAvailabilityTool } from "./check-availability";
import { listTasksTool } from "./list-tasks";
import type { AnyToolDefinition } from "../types";

/**
 * All query tools as an array
 * Use this for bulk registration or iteration
 */
export const queryTools: AnyToolDefinition[] = [
  queryContextTool,
  searchEmailsTool,
  listCalendarEventsTool,
  checkAvailabilityTool,
  listTasksTool,
];

// ─────────────────────────────────────────────────────────────
// Registration
// ─────────────────────────────────────────────────────────────

/**
 * Register all query tools with the global registry
 * Call this once during application initialization
 */
export function registerQueryTools(): void {
  toolRegistry.registerAll(queryTools);
}


