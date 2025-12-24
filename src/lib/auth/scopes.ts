// ═══════════════════════════════════════════════════════════════════════════
// OAuth Scope Definitions & Utilities
// Centralized scope management for Google OAuth integrations
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Base Scopes (Always Required)
// ─────────────────────────────────────────────────────────────

export const BASE_SCOPES = ["openid", "email", "profile"] as const;

// ─────────────────────────────────────────────────────────────
// Gmail Scopes
// ─────────────────────────────────────────────────────────────

export const GMAIL_SCOPES = {
  /** Read-only access to Gmail messages and labels */
  READONLY: "https://www.googleapis.com/auth/gmail.readonly",
  /** Send emails on behalf of the user */
  SEND: "https://www.googleapis.com/auth/gmail.send",
  /** Manage labels */
  LABELS: "https://www.googleapis.com/auth/gmail.labels",
  /** Read-only access to Google Contacts */
  CONTACTS_READONLY: "https://www.googleapis.com/auth/contacts.readonly",
} as const;

/** All Gmail scopes required for full integration */
export const ALL_GMAIL_SCOPES = [
  GMAIL_SCOPES.READONLY,
  GMAIL_SCOPES.SEND,
  GMAIL_SCOPES.LABELS,
  GMAIL_SCOPES.CONTACTS_READONLY,
] as const;

// ─────────────────────────────────────────────────────────────
// Calendar Scopes
// ─────────────────────────────────────────────────────────────

export const CALENDAR_SCOPES = {
  /** Read-only access to Calendar events */
  READONLY: "https://www.googleapis.com/auth/calendar.readonly",
  /** Read/write access to Calendar events */
  EVENTS: "https://www.googleapis.com/auth/calendar.events",
  /** Read-only access to calendar settings */
  SETTINGS_READONLY: "https://www.googleapis.com/auth/calendar.settings.readonly",
} as const;

/** Calendar read-only scopes */
export const CALENDAR_READ_SCOPES = [
  CALENDAR_SCOPES.READONLY,
] as const;

/** Calendar write scopes (EVENTS scope provides full read/write access) */
export const CALENDAR_WRITE_SCOPES = [
  CALENDAR_SCOPES.EVENTS,
] as const;

/**
 * All Calendar scopes required for full integration
 * Note: EVENTS scope provides full read/write access, making READONLY redundant.
 * Only EVENTS is needed for complete calendar functionality.
 */
export const ALL_CALENDAR_SCOPES = [
  CALENDAR_SCOPES.EVENTS,
] as const;

// ─────────────────────────────────────────────────────────────
// Scope Sets (for different integration levels)
// ─────────────────────────────────────────────────────────────

export const SCOPE_SETS = {
  /** Basic authentication only */
  basic: [...BASE_SCOPES],

  /** Gmail read-only (view emails and contacts) */
  gmailReadOnly: [
    ...BASE_SCOPES,
    GMAIL_SCOPES.READONLY,
    GMAIL_SCOPES.LABELS,
    GMAIL_SCOPES.CONTACTS_READONLY,
  ],

  /** Full Gmail access (read, send, manage) */
  gmailFull: [...BASE_SCOPES, ...ALL_GMAIL_SCOPES],

  /** Calendar read-only (view events) */
  calendarReadOnly: [
    ...BASE_SCOPES,
    CALENDAR_SCOPES.READONLY,
  ],

  /** Full Calendar access (read, create, update, delete events) */
  calendarFull: [...BASE_SCOPES, ...ALL_CALENDAR_SCOPES],

  /** Full integration (Gmail + Calendar) */
  fullIntegration: [
    ...BASE_SCOPES,
    ...ALL_GMAIL_SCOPES,
    ...ALL_CALENDAR_SCOPES,
  ],
} as const;

// ─────────────────────────────────────────────────────────────
// Scope Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Parse scopes from a space-separated string (OAuth format)
 */
export function parseScopes(scopeString: string | null | undefined): string[] {
  if (!scopeString) return [];
  return scopeString.split(" ").filter(Boolean);
}

/**
 * Convert scope array to space-separated string (OAuth format)
 */
export function formatScopes(scopes: readonly string[] | string[]): string {
  return scopes.join(" ");
}

/**
 * Check if a user has a specific scope
 */
export function hasScope(
  grantedScopes: string[],
  requiredScope: string
): boolean {
  return grantedScopes.includes(requiredScope);
}

/**
 * Check if a user has all required scopes
 */
export function hasAllScopes(
  grantedScopes: string[],
  requiredScopes: readonly string[] | string[]
): boolean {
  return requiredScopes.every((scope) => grantedScopes.includes(scope));
}

/**
 * Get the missing scopes a user needs to grant
 */
export function getMissingScopes(
  grantedScopes: string[],
  requiredScopes: readonly string[] | string[]
): string[] {
  return requiredScopes.filter((scope) => !grantedScopes.includes(scope));
}

/**
 * Check if Gmail integration is enabled (has required read scopes)
 */
export function hasGmailReadAccess(grantedScopes: string[]): boolean {
  return hasAllScopes(grantedScopes, [
    GMAIL_SCOPES.READONLY,
    GMAIL_SCOPES.LABELS,
  ]);
}

/**
 * Check if Gmail send is enabled
 */
export function hasGmailSendAccess(grantedScopes: string[]): boolean {
  return hasScope(grantedScopes, GMAIL_SCOPES.SEND);
}

/**
 * Check if Contacts integration is enabled
 */
export function hasContactsAccess(grantedScopes: string[]): boolean {
  return hasScope(grantedScopes, GMAIL_SCOPES.CONTACTS_READONLY);
}

/**
 * Check if Calendar read access is enabled
 * Note: calendar.events scope includes read access, so we check for either scope
 */
export function hasCalendarReadAccess(grantedScopes: string[]): boolean {
  return (
    hasScope(grantedScopes, CALENDAR_SCOPES.READONLY) ||
    hasScope(grantedScopes, CALENDAR_SCOPES.EVENTS)
  );
}

/**
 * Check if Calendar write access is enabled (can create/update/delete events)
 */
export function hasCalendarWriteAccess(grantedScopes: string[]): boolean {
  return hasScope(grantedScopes, CALENDAR_SCOPES.EVENTS);
}

/**
 * Get required Calendar scopes for a specific action
 * Note: The EVENTS scope provides full read/write access,
 * so write operations only require EVENTS, not READONLY.
 * 
 * For "read" action, returns READONLY but note that EVENTS also satisfies
 * read requirements. Use hasMissingCalendarScopes() to properly check.
 */
export function getRequiredCalendarScopes(
  action: "read" | "write"
): readonly string[] {
  switch (action) {
    case "read":
      return CALENDAR_READ_SCOPES;
    case "write":
      // EVENTS scope alone grants full read/write access
      return CALENDAR_WRITE_SCOPES;
    default:
      return CALENDAR_READ_SCOPES;
  }
}

/**
 * Check if scopes are missing for a Calendar action, considering alternative scopes
 * 
 * Unlike getMissingScopes(), this properly handles cases where:
 * - EVENTS scope satisfies read requirements (READONLY not needed)
 * - Either READONLY or EVENTS satisfies read access
 */
export function hasMissingCalendarScopes(
  grantedScopes: string[],
  action: "read" | "write"
): boolean {
  switch (action) {
    case "read":
      // Either READONLY or EVENTS grants read access
      return !hasCalendarReadAccess(grantedScopes);
    case "write":
      // Only EVENTS grants write access
      return !hasCalendarWriteAccess(grantedScopes);
    default:
      return !hasCalendarReadAccess(grantedScopes);
  }
}

/**
 * Get missing Calendar scopes for a specific action, considering alternative scopes
 * 
 * Returns empty array if:
 * - For "read": user has READONLY or EVENTS (either satisfies read)
 * - For "write": user has EVENTS
 */
export function getMissingCalendarScopesForAction(
  grantedScopes: string[],
  action: "read" | "write"
): string[] {
  switch (action) {
    case "read":
      // If user has either scope, no missing scopes for read
      if (hasCalendarReadAccess(grantedScopes)) {
        return [];
      }
      // Suggest READONLY as the minimal scope for read access
      return [CALENDAR_SCOPES.READONLY];
    case "write":
      // EVENTS is required for write
      if (hasCalendarWriteAccess(grantedScopes)) {
        return [];
      }
      return [CALENDAR_SCOPES.EVENTS];
    default:
      return hasCalendarReadAccess(grantedScopes) ? [] : [CALENDAR_SCOPES.READONLY];
  }
}

/**
 * Get a human-readable description of a scope
 */
export function getScopeDescription(scope: string): string {
  const descriptions: Record<string, string> = {
    // Gmail scopes
    [GMAIL_SCOPES.READONLY]: "Read your emails",
    [GMAIL_SCOPES.SEND]: "Send emails on your behalf",
    [GMAIL_SCOPES.LABELS]: "View and manage your email labels",
    [GMAIL_SCOPES.CONTACTS_READONLY]: "View your contacts",
    // Calendar scopes
    [CALENDAR_SCOPES.READONLY]: "View your calendar events",
    [CALENDAR_SCOPES.EVENTS]: "Create, update, and delete calendar events",
    [CALENDAR_SCOPES.SETTINGS_READONLY]: "View your calendar settings",
    // Base scopes
    openid: "Verify your identity",
    email: "View your email address",
    profile: "View your basic profile info",
  };

  return descriptions[scope] || scope;
}

/**
 * Get integration status from granted scopes
 */
export interface IntegrationStatus {
  gmail: {
    connected: boolean;
    canRead: boolean;
    canSend: boolean;
    canManageLabels: boolean;
    /** Missing scopes for full Gmail access */
    missingScopes: string[];
  };
  contacts: {
    connected: boolean;
  };
  calendar: {
    connected: boolean;
    canRead: boolean;
    canWrite: boolean;
    /** Missing scopes for full Calendar access */
    missingScopes: string[];
  };
  /**
   * Missing Gmail scopes only (for backward compatibility)
   * @deprecated Use gmail.missingScopes or calendar.missingScopes instead
   */
  missingScopes: string[];
}

export function getIntegrationStatus(
  grantedScopes: string[]
): IntegrationStatus {
  // Gmail status
  const canReadGmail = hasGmailReadAccess(grantedScopes);
  const canSend = hasGmailSendAccess(grantedScopes);
  const canManageLabels = hasScope(grantedScopes, GMAIL_SCOPES.LABELS);
  const hasContacts = hasContactsAccess(grantedScopes);

  // Calendar status
  const canReadCalendar = hasCalendarReadAccess(grantedScopes);
  const canWriteCalendar = hasCalendarWriteAccess(grantedScopes);

  // Calculate missing scopes per integration
  const missingGmailScopes = getMissingScopes(grantedScopes, ALL_GMAIL_SCOPES);
  
  // For Calendar, use capability-aware missing scope calculation:
  // - If user has write access (EVENTS), no scopes are missing
  // - If user has read-only access (READONLY), report EVENTS as missing for full access
  // - If user has no access, report EVENTS (which provides both read and write)
  // Note: We don't report READONLY as missing since EVENTS supersedes it
  const missingCalendarScopes = getMissingCalendarScopesForAction(grantedScopes, "write");

  return {
    gmail: {
      connected: canReadGmail,
      canRead: canReadGmail,
      canSend,
      canManageLabels,
      missingScopes: missingGmailScopes,
    },
    contacts: {
      connected: hasContacts,
    },
    calendar: {
      connected: canReadCalendar,
      canRead: canReadCalendar,
      canWrite: canWriteCalendar,
      missingScopes: missingCalendarScopes,
    },
    // Keep backward compatibility - only Gmail scopes as before
    missingScopes: missingGmailScopes,
  };
}

// ─────────────────────────────────────────────────────────────
// Type Exports
// ─────────────────────────────────────────────────────────────

export type GmailScope = (typeof GMAIL_SCOPES)[keyof typeof GMAIL_SCOPES];
export type CalendarScope = (typeof CALENDAR_SCOPES)[keyof typeof CALENDAR_SCOPES];
export type ScopeSet = keyof typeof SCOPE_SETS;
