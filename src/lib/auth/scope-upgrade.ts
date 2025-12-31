// ═══════════════════════════════════════════════════════════════════════════
// OAuth Scope Upgrade Flow
// Handles upgrading user permissions for Gmail integration
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import {
  parseScopes,
  formatScopes,
  hasAllScopes,
  getMissingScopes,
  ALL_GMAIL_SCOPES,
  ALL_CALENDAR_SCOPES,
  hasCalendarReadAccess,
  hasCalendarWriteAccess,
  getMissingCalendarScopesForAction,
} from "./scopes";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ScopeCheckResult {
  hasRequiredScopes: boolean;
  grantedScopes: string[];
  missingScopes: string[];
}

export interface ScopeUpgradeResult {
  success: boolean;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// Scope Checking
// ─────────────────────────────────────────────────────────────

/**
 * Get the current scopes granted to a user's Google account
 */
export async function getUserGrantedScopes(
  userId: string
): Promise<string[] | null> {
  const account = await db.account.findFirst({
    where: {
      userId,
      provider: "google",
    },
    select: {
      scope: true,
    },
  });

  if (!account) {
    return null;
  }

  return parseScopes(account.scope);
}

/**
 * Check if a user has the required scopes for a specific integration
 */
export async function checkUserScopes(
  userId: string,
  requiredScopes: readonly string[] | string[]
): Promise<ScopeCheckResult> {
  const grantedScopes = await getUserGrantedScopes(userId);

  if (!grantedScopes) {
    return {
      hasRequiredScopes: false,
      grantedScopes: [],
      missingScopes: [...requiredScopes],
    };
  }

  const hasRequired = hasAllScopes(grantedScopes, requiredScopes);
  const missing = getMissingScopes(grantedScopes, requiredScopes);

  return {
    hasRequiredScopes: hasRequired,
    grantedScopes,
    missingScopes: missing,
  };
}

/**
 * Check if a user has Gmail integration scopes
 */
export async function checkGmailScopes(
  userId: string
): Promise<ScopeCheckResult> {
  return checkUserScopes(userId, ALL_GMAIL_SCOPES);
}

// ─────────────────────────────────────────────────────────────
// Scope Update (After OAuth Callback)
// ─────────────────────────────────────────────────────────────

/**
 * Update the stored scopes for a user after a scope upgrade
 * This is called from the OAuth callback when new scopes are granted
 */
export async function updateUserScopes(
  userId: string,
  newScopes: string[]
): Promise<ScopeUpgradeResult> {
  try {
    const account = await db.account.findFirst({
      where: {
        userId,
        provider: "google",
      },
    });

    if (!account) {
      return {
        success: false,
        error: "No Google account found for user",
      };
    }

    // Merge new scopes with existing ones
    const existingScopes = parseScopes(account.scope);
    const mergedScopes = [...new Set([...existingScopes, ...newScopes])];

    await db.account.update({
      where: { id: account.id },
      data: {
        scope: formatScopes(mergedScopes),
      },
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update scopes",
    };
  }
}

/**
 * Revoke specific scopes for a user (removes from stored scopes)
 * Note: This doesn't revoke at Google - use revokeGmailAccess for that
 */
export async function removeUserScopes(
  userId: string,
  scopesToRemove: string[]
): Promise<ScopeUpgradeResult> {
  try {
    const account = await db.account.findFirst({
      where: {
        userId,
        provider: "google",
      },
    });

    if (!account) {
      return {
        success: false,
        error: "No Google account found for user",
      };
    }

    const existingScopes = parseScopes(account.scope);
    const remainingScopes = existingScopes.filter(
      (scope) => !scopesToRemove.includes(scope)
    );

    await db.account.update({
      where: { id: account.id },
      data: {
        scope: formatScopes(remainingScopes),
      },
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to remove scopes",
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Gmail Connection Management
// ─────────────────────────────────────────────────────────────

/**
 * Revoke Gmail access at Google and update local state
 */
export async function revokeGmailAccess(
  userId: string
): Promise<ScopeUpgradeResult> {
  try {
    const account = await db.account.findFirst({
      where: {
        userId,
        provider: "google",
      },
      select: {
        id: true,
        access_token: true,
        scope: true,
      },
    });

    if (!account) {
      return {
        success: false,
        error: "No Google account found for user",
      };
    }

    // Revoke the token at Google (this revokes ALL scopes for this app)
    if (account.access_token) {
      try {
        // Decrypt the token before using it for revocation
        const decryptedToken = decrypt(account.access_token);
        await fetch(
          `https://oauth2.googleapis.com/revoke?token=${decryptedToken}`,
          { method: "POST" }
        );
      } catch {
        // Token revocation failed - it may already be invalid
        console.warn("[ScopeUpgrade] Token revocation at Google failed");
      }
    }

    // Remove Gmail scopes from stored scopes
    const existingScopes = parseScopes(account.scope);
    const remainingScopes = existingScopes.filter(
      (scope) =>
        !ALL_GMAIL_SCOPES.includes(scope as (typeof ALL_GMAIL_SCOPES)[number])
    );

    await db.account.update({
      where: { id: account.id },
      data: {
        scope: formatScopes(remainingScopes),
      },
    });

    // Also clean up any ConnectedAccount record for Gmail
    await db.connectedAccount.deleteMany({
      where: {
        userId,
        provider: "google",
      },
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to revoke access",
    };
  }
}

/**
 * Check if Gmail is currently connected for a user
 */
export async function isGmailConnected(userId: string): Promise<boolean> {
  const result = await checkGmailScopes(userId);
  return result.hasRequiredScopes;
}

// ─────────────────────────────────────────────────────────────
// Calendar Connection Management
// ─────────────────────────────────────────────────────────────

/**
 * Calendar-specific scope check result with read/write capabilities
 */
export interface CalendarScopeCheckResult extends ScopeCheckResult {
  canRead: boolean;
  canWrite: boolean;
}

/**
 * Check if a user has Calendar integration scopes
 */
export async function checkCalendarScopes(
  userId: string
): Promise<CalendarScopeCheckResult> {
  const grantedScopes = await getUserGrantedScopes(userId);

  if (!grantedScopes) {
    return {
      hasRequiredScopes: false,
      grantedScopes: [],
      missingScopes: [...ALL_CALENDAR_SCOPES],
      canRead: false,
      canWrite: false,
    };
  }

  // Calendar has nuanced scope requirements:
  // - calendar.events provides both read AND write access
  // - calendar.readonly provides only read access
  const canRead = hasCalendarReadAccess(grantedScopes);
  const canWrite = hasCalendarWriteAccess(grantedScopes);

  // For "required scopes", we check if user has write access (full functionality)
  const hasRequired = canWrite;
  const missing = getMissingCalendarScopesForAction(grantedScopes, "write");

  return {
    hasRequiredScopes: hasRequired,
    grantedScopes,
    missingScopes: missing,
    canRead,
    canWrite,
  };
}

/**
 * Check if Calendar is currently connected for a user
 * Considers "connected" as having at least read access
 */
export async function isCalendarConnected(userId: string): Promise<boolean> {
  const result = await checkCalendarScopes(userId);
  return result.canRead;
}

/**
 * Revoke Calendar access at Google and update local state
 */
export async function revokeCalendarAccess(
  userId: string
): Promise<ScopeUpgradeResult> {
  try {
    const account = await db.account.findFirst({
      where: {
        userId,
        provider: "google",
      },
      select: {
        id: true,
        access_token: true,
        scope: true,
      },
    });

    if (!account) {
      return {
        success: false,
        error: "No Google account found for user",
      };
    }

    // Note: We can't selectively revoke scopes at Google.
    // Revoking the token revokes ALL scopes.
    // Instead, we'll just remove Calendar scopes from our stored scopes
    // and delete calendar-related sync data.
    // The user will need to re-authorize if they want Calendar again.

    // Remove Calendar scopes from stored scopes
    const existingScopes = parseScopes(account.scope);
    const remainingScopes = existingScopes.filter(
      (scope) =>
        !ALL_CALENDAR_SCOPES.includes(
          scope as (typeof ALL_CALENDAR_SCOPES)[number]
        )
    );

    await db.account.update({
      where: { id: account.id },
      data: {
        scope: formatScopes(remainingScopes),
      },
    });

    // Clean up Calendar-specific sync data
    await db.calendarSyncState.deleteMany({
      where: { userId },
    });

    // Clean up calendar events (optional - you may want to keep history)
    // await db.calendarEvent.deleteMany({ where: { userId } });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to revoke Calendar access",
    };
  }
}
