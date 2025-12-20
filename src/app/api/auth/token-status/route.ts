// ═══════════════════════════════════════════════════════════════════════════
// Token Status API
// GET /api/auth/token-status - Check OAuth token health
// POST /api/auth/token-status - Force token refresh
// ═══════════════════════════════════════════════════════════════════════════

import { auth } from "@/lib/auth";
import { checkTokenHealth, forceTokenRefresh } from "@/lib/auth/token-refresh";

// ─────────────────────────────────────────────────────────────
// GET - Check Token Status
// ─────────────────────────────────────────────────────────────

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const health = await checkTokenHealth(session.user.id);

  return Response.json({
    ...health,
    recommendations: getRecommendations(health),
  });
}

// ─────────────────────────────────────────────────────────────
// POST - Force Token Refresh
// ─────────────────────────────────────────────────────────────

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await forceTokenRefresh(session.user.id);

  if (!result.success) {
    return Response.json(
      {
        error: result.error,
        action: "Please re-authenticate with Google",
      },
      { status: 500 }
    );
  }

  // Get updated status
  const health = await checkTokenHealth(session.user.id);

  return Response.json({
    success: true,
    message: "Token refreshed successfully",
    ...health,
  });
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

interface TokenHealth {
  hasAccount: boolean;
  hasRefreshToken: boolean;
  hasAccessToken: boolean;
  isExpired: boolean;
}

function getRecommendations(health: TokenHealth): string[] {
  const recommendations: string[] = [];

  if (!health.hasAccount) {
    recommendations.push(
      "Connect your Google account to enable Gmail integration"
    );
  } else if (!health.hasRefreshToken) {
    recommendations.push(
      "Re-authenticate with Google to enable automatic token refresh"
    );
    recommendations.push(
      "Your current session will expire and require manual re-login"
    );
  } else if (health.isExpired) {
    recommendations.push("Token is expired but can be automatically refreshed");
  }

  return recommendations;
}
