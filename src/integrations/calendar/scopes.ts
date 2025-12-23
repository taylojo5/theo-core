// ═══════════════════════════════════════════════════════════════════════════
// Calendar Scope Utilities
// Helper functions for Calendar OAuth scope detection and management
// ═══════════════════════════════════════════════════════════════════════════

import {
  CALENDAR_SCOPES,
  ALL_CALENDAR_SCOPES,
  CALENDAR_READ_SCOPES,
  CALENDAR_WRITE_SCOPES,
  hasCalendarReadAccess,
  hasCalendarWriteAccess,
  getRequiredCalendarScopes,
  hasScope,
  getMissingScopes,
} from "@/lib/auth/scopes";

// ─────────────────────────────────────────────────────────────
// Re-exports for convenience
// ─────────────────────────────────────────────────────────────

export {
  CALENDAR_SCOPES,
  ALL_CALENDAR_SCOPES,
  CALENDAR_READ_SCOPES,
  CALENDAR_WRITE_SCOPES,
  hasCalendarReadAccess,
  hasCalendarWriteAccess,
  getRequiredCalendarScopes,
};

// ─────────────────────────────────────────────────────────────
// Calendar-Specific Scope Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Check if user has read-only Calendar scope
 */
export function hasCalendarReadScope(scopes: string[]): boolean {
  return hasScope(scopes, CALENDAR_SCOPES.READONLY);
}

/**
 * Check if user has write (events) Calendar scope
 */
export function hasCalendarWriteScope(scopes: string[]): boolean {
  return hasScope(scopes, CALENDAR_SCOPES.EVENTS);
}

/**
 * Check if user has settings read scope
 */
export function hasCalendarSettingsScope(scopes: string[]): boolean {
  return hasScope(scopes, CALENDAR_SCOPES.SETTINGS_READONLY);
}

/**
 * Check if user can perform a specific Calendar action
 * Note: calendar.events scope includes read access for viewing
 */
export function canPerformCalendarAction(
  scopes: string[],
  action: "view" | "create" | "update" | "delete" | "respond"
): boolean {
  switch (action) {
    case "view":
      // Either READONLY or EVENTS scope allows viewing
      return hasCalendarReadAccess(scopes);
    case "create":
    case "update":
    case "delete":
    case "respond":
      return hasCalendarWriteScope(scopes);
    default:
      return false;
  }
}

/**
 * Get missing Calendar scopes for a specific action
 */
export function getMissingCalendarScopes(
  grantedScopes: string[],
  action: "read" | "write"
): string[] {
  const required = getRequiredCalendarScopes(action);
  return getMissingScopes(grantedScopes, required);
}

/**
 * Check if scope upgrade is needed for Calendar access
 */
export function needsCalendarScopeUpgrade(
  grantedScopes: string[],
  action: "read" | "write"
): boolean {
  return getMissingCalendarScopes(grantedScopes, action).length > 0;
}

/**
 * Calendar scope status for a user
 */
export interface CalendarScopeStatus {
  /** Has any Calendar access */
  hasAccess: boolean;
  /** Can read calendar events */
  canRead: boolean;
  /** Can modify calendar events */
  canWrite: boolean;
  /** Can read calendar settings */
  canReadSettings: boolean;
  /** Scopes needed for full access */
  missingForFullAccess: string[];
}

/**
 * Get Calendar scope status for a user
 */
export function getCalendarScopeStatus(
  grantedScopes: string[]
): CalendarScopeStatus {
  // canRead is true if user has READONLY or EVENTS scope (EVENTS includes read access)
  const canRead = hasCalendarReadAccess(grantedScopes);
  const canWrite = hasCalendarWriteScope(grantedScopes);
  const canReadSettings = hasCalendarSettingsScope(grantedScopes);

  return {
    hasAccess: canRead || canWrite,
    canRead,
    canWrite,
    canReadSettings,
    missingForFullAccess: getMissingScopes(grantedScopes, ALL_CALENDAR_SCOPES),
  };
}

