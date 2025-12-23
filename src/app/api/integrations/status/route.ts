// ═══════════════════════════════════════════════════════════════════════════
// Integration Status API
// GET /api/integrations/status - Check connected integrations
// ═══════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseScopes, getIntegrationStatus } from "@/lib/auth/scopes";
import { checkTokenHealth } from "@/lib/auth/token-refresh";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface IntegrationStatusResponse {
  authenticated: boolean;
  google: {
    connected: boolean;
    email?: string;
    tokenHealth?: {
      hasRefreshToken: boolean;
      isExpired: boolean;
      expiresIn?: number;
      expiresInHuman?: string;
    };
  };
  gmail: {
    connected: boolean;
    canRead: boolean;
    canSend: boolean;
    canManageLabels: boolean;
    syncStatus?: string;
    lastSyncAt?: string;
    emailCount?: number;
  };
  contacts: {
    connected: boolean;
    contactCount?: number;
  };
  missingScopes: string[];
  upgradeRequired: boolean;
}

// ─────────────────────────────────────────────────────────────
// GET /api/integrations/status
// ─────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse<IntegrationStatusResponse>> {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      {
        authenticated: false,
        google: { connected: false },
        gmail: {
          connected: false,
          canRead: false,
          canSend: false,
          canManageLabels: false,
        },
        contacts: { connected: false },
        missingScopes: [],
        upgradeRequired: false,
      },
      { status: 401 }
    );
  }

  const userId = session.user.id;

  // Get Google account info
  const account = await db.account.findFirst({
    where: {
      userId,
      provider: "google",
    },
    select: {
      scope: true,
      providerAccountId: true,
    },
  });

  if (!account) {
    return NextResponse.json({
      authenticated: true,
      google: { connected: false },
      gmail: {
        connected: false,
        canRead: false,
        canSend: false,
        canManageLabels: false,
      },
      contacts: { connected: false },
      missingScopes: [],
      upgradeRequired: false,
    });
  }

  // Parse scopes and check integration status
  const grantedScopes = parseScopes(account.scope);
  const integrationStatus = getIntegrationStatus(grantedScopes);

  // Check token health
  const tokenHealth = await checkTokenHealth(userId);

  // Get Gmail sync state if connected
  let gmailSyncState = null;
  if (integrationStatus.gmail.connected) {
    gmailSyncState = await db.connectedAccount.findFirst({
      where: {
        userId,
        provider: "google",
      },
      select: {
        lastSyncAt: true,
        status: true,
        syncCursor: true,
      },
    });
  }

  // Get email and contact counts if available
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      _count: {
        select: {
          people: {
            where: { source: "gmail" },
          },
        },
      },
    },
  });

  return NextResponse.json({
    authenticated: true,
    google: {
      connected: true,
      email: user?.email || undefined,
      tokenHealth: {
        hasRefreshToken: tokenHealth.hasRefreshToken,
        isExpired: tokenHealth.isExpired,
        expiresIn: tokenHealth.expiresIn,
        expiresInHuman: tokenHealth.expiresInHuman,
      },
    },
    gmail: {
      connected: integrationStatus.gmail.connected,
      canRead: integrationStatus.gmail.canRead,
      canSend: integrationStatus.gmail.canSend,
      canManageLabels: integrationStatus.gmail.canManageLabels,
      syncStatus: gmailSyncState?.status || undefined,
      lastSyncAt: gmailSyncState?.lastSyncAt?.toISOString() || undefined,
    },
    contacts: {
      connected: integrationStatus.contacts.connected,
      contactCount: user?._count.people || 0,
    },
    missingScopes: integrationStatus.missingScopes,
    upgradeRequired: integrationStatus.missingScopes.length > 0,
  });
}
