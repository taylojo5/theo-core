// ═══════════════════════════════════════════════════════════════════════════
// OAuth Token Refresh
// Utilities for refreshing Google OAuth tokens
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import { encrypt, decrypt, encryptIfPlain } from "@/lib/crypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// Buffer time before expiry (5 minutes)
const EXPIRY_BUFFER_SECONDS = 300;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface TokenRefreshResult {
  success: boolean;
  accessToken?: string;
  expiresAt?: number;
  error?: string;
}

export interface TokenHealthStatus {
  hasAccount: boolean;
  hasRefreshToken: boolean;
  hasAccessToken: boolean;
  isExpired: boolean;
  expiresIn?: number;
  expiresInHuman?: string;
}

// ─────────────────────────────────────────────────────────────
// Token Refresh
// ─────────────────────────────────────────────────────────────

/**
 * Refresh a Google OAuth access token using the refresh token
 */
export async function refreshGoogleToken(
  refreshToken: string
): Promise<TokenRefreshResult> {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return {
        success: false,
        error: "Missing Google OAuth credentials",
      };
    }

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error:
          errorData.error_description ||
          errorData.error ||
          `Token refresh failed with status ${response.status}`,
      };
    }

    const data = await response.json();

    return {
      success: true,
      accessToken: data.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get a valid access token for a user
 * Refreshes automatically if expired or expiring soon
 * Handles both encrypted and plain tokens (backward compatibility)
 */
export async function getValidAccessToken(
  userId: string
): Promise<string | null> {
  // Get the user's Google account
  const account = await db.account.findFirst({
    where: {
      userId,
      provider: "google",
    },
  });

  if (!account) {
    console.log("[TokenRefresh] No Google account found for user");
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = account.expires_at || 0;

  // If token is still valid (with buffer), return it (decrypted)
  if (expiresAt > now + EXPIRY_BUFFER_SECONDS && account.access_token) {
    // Decrypt if encrypted, otherwise return as-is (backward compatibility)
    return decrypt(account.access_token);
  }

  // Token expired or expiring soon - refresh it
  if (!account.refresh_token) {
    console.log("[TokenRefresh] No refresh token available");
    return null;
  }

  // Decrypt refresh token if encrypted
  const refreshToken = decrypt(account.refresh_token);

  console.log("[TokenRefresh] Refreshing expired token");
  const result = await refreshGoogleToken(refreshToken);

  if (!result.success) {
    console.error("[TokenRefresh] Refresh failed:", result.error);
    return null;
  }

  // Encrypt the new access token before storing
  const encryptedAccessToken = result.accessToken
    ? encrypt(result.accessToken)
    : null;

  // Also encrypt the existing refresh token if it's not already encrypted
  const encryptedRefreshToken = encryptIfPlain(account.refresh_token);
  const refreshTokenNeedsUpdate =
    encryptedRefreshToken !== account.refresh_token;

  // Update the account with new (encrypted) tokens
  await db.account.update({
    where: { id: account.id },
    data: {
      access_token: encryptedAccessToken,
      expires_at: result.expiresAt,
      // Encrypt refresh token if it wasn't already
      ...(refreshTokenNeedsUpdate && { refresh_token: encryptedRefreshToken }),
    },
  });

  console.log("[TokenRefresh] Token refreshed successfully");
  return result.accessToken || null;
}

/**
 * Check the health of a user's OAuth tokens
 */
export async function checkTokenHealth(
  userId: string
): Promise<TokenHealthStatus> {
  const account = await db.account.findFirst({
    where: { userId, provider: "google" },
    select: {
      access_token: true,
      refresh_token: true,
      expires_at: true,
    },
  });

  if (!account) {
    return {
      hasAccount: false,
      hasRefreshToken: false,
      hasAccessToken: false,
      isExpired: true,
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = account.expires_at || 0;
  const isExpired = expiresAt < now;
  const expiresIn = isExpired ? 0 : expiresAt - now;

  return {
    hasAccount: true,
    hasRefreshToken: !!account.refresh_token,
    hasAccessToken: !!account.access_token,
    isExpired,
    expiresIn,
    expiresInHuman: formatDuration(expiresIn),
  };
}

/**
 * Force refresh a user's tokens (for testing/manual refresh)
 */
export async function forceTokenRefresh(
  userId: string
): Promise<TokenRefreshResult> {
  const account = await db.account.findFirst({
    where: {
      userId,
      provider: "google",
    },
    select: {
      id: true,
      refresh_token: true,
    },
  });

  if (!account) {
    return {
      success: false,
      error: "No Google account found",
    };
  }

  if (!account.refresh_token) {
    return {
      success: false,
      error: "No refresh token available",
    };
  }

  // Decrypt refresh token if encrypted
  const refreshToken = decrypt(account.refresh_token);
  const result = await refreshGoogleToken(refreshToken);

  if (result.success) {
    // Encrypt the new access token before storing
    const encryptedAccessToken = result.accessToken
      ? encrypt(result.accessToken)
      : null;

    // Also encrypt the existing refresh token if it's not already encrypted
    const encryptedRefreshToken = encryptIfPlain(account.refresh_token);

    await db.account.update({
      where: { id: account.id },
      data: {
        access_token: encryptedAccessToken,
        expires_at: result.expiresAt,
        // Encrypt refresh token if it wasn't already
        ...(encryptedRefreshToken !== account.refresh_token && {
          refresh_token: encryptedRefreshToken,
        }),
      },
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Format seconds into human-readable duration
 */
function formatDuration(seconds: number): string {
  if (seconds <= 0) return "expired";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
