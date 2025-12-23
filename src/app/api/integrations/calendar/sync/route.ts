// ═══════════════════════════════════════════════════════════════════════════
// Calendar Sync API
// Trigger and manage calendar sync operations
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";
import { calendarSyncStateRepository } from "@/integrations/calendar/repository";
import { calendarLogger } from "@/integrations/calendar/logger";
import { z } from "zod";

const logger = calendarLogger.child("api.sync");

// ─────────────────────────────────────────────────────────────
// Validation Schema
// ─────────────────────────────────────────────────────────────

const TriggerSyncSchema = z.object({
  type: z.enum(["auto", "full", "incremental"]).optional(),
  enableRecurring: z.boolean().optional(),
});

// ─────────────────────────────────────────────────────────────
// GET /api/integrations/calendar/sync - Get sync status
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.calendarSync
  );
  if (rateLimitResponse) return rateLimitResponse;

  let userId: string | undefined;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers }
      );
    }

    userId = session.user.id;

    // Get sync state
    const syncState = await calendarSyncStateRepository.getOrCreate(userId);

    return NextResponse.json(
      {
        status: syncState.syncStatus,
        lastSyncAt: syncState.lastSyncAt,
        lastFullSyncAt: syncState.lastFullSyncAt,
        syncToken: syncState.syncToken ? "present" : null,
        recurring: false, // TODO: Implement recurring sync status check
        stats: {
          eventCount: syncState.eventCount,
          calendarCount: syncState.calendarCount,
          embeddingsPending: syncState.embeddingsPending,
          embeddingsCompleted: syncState.embeddingsCompleted,
          embeddingsFailed: syncState.embeddingsFailed,
        },
        error: syncState.syncError,
        webhook: {
          active: !!syncState.webhookChannelId,
          expiresAt: syncState.webhookExpiration,
        },
      },
      { headers }
    );
  } catch (error) {
    logger.error("Failed to get sync status", { userId }, error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get sync status",
      },
      { status: 500, headers }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/integrations/calendar/sync - Trigger sync
// ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.calendarSync
  );
  if (rateLimitResponse) return rateLimitResponse;

  let userId: string | undefined;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers }
      );
    }

    userId = session.user.id;

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const parseResult = TriggerSyncSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.issues,
        },
        { status: 400, headers }
      );
    }

    const { type: syncType } = parseResult.data;

    // Update sync status to indicate sync is starting
    await calendarSyncStateRepository.update(userId, {
      syncStatus: syncType === "full" ? "full_sync" : "incremental_sync",
    });

    // Get updated sync state
    const syncState = await calendarSyncStateRepository.get(userId);

    logger.info("Sync triggered via API", { userId, syncType });

    // Note: Full sync scheduling requires BullMQ queue which should be
    // initialized by the application. For now, we just update the status.
    // The actual sync will be handled by a background worker.

    return NextResponse.json(
      {
        success: true,
        message: syncType
          ? `${syncType} sync initiated`
          : "Sync status checked",
        syncType: syncType || null,
        currentStatus: syncState?.syncStatus || "idle",
      },
      { headers }
    );
  } catch (error) {
    logger.error("Failed to trigger sync", { userId }, error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to trigger sync",
      },
      { status: 500, headers }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/integrations/calendar/sync - Stop sync
// ─────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.calendarSync
  );
  if (rateLimitResponse) return rateLimitResponse;

  let userId: string | undefined;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers }
      );
    }

    userId = session.user.id;

    // Clear sync error state and reset to idle
    await calendarSyncStateRepository.update(userId, {
      syncStatus: "idle",
      syncError: null,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Sync stopped",
      },
      { headers }
    );
  } catch (error) {
    logger.error("Failed to stop sync", { userId }, error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to stop sync",
      },
      { status: 500, headers }
    );
  }
}
