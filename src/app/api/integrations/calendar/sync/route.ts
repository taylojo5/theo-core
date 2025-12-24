// ═══════════════════════════════════════════════════════════════════════════
// Calendar Sync API
// Trigger and manage calendar sync operations
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";
import { calendarSyncStateRepository } from "@/integrations/calendar/repository";
import { calendarLogger } from "@/integrations/calendar/logger";
import {
  getCalendarQueue,
  scheduleFullSync,
  scheduleIncrementalSync,
  startRecurringSync,
  stopRecurringSync,
  hasRecurringSyncActive,
} from "@/integrations/calendar/sync";
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

    // Check if recurring sync is active
    const queue = getCalendarQueue();
    const isRecurring = await hasRecurringSyncActive(queue, userId);

    return NextResponse.json(
      {
        status: syncState.syncStatus,
        lastSyncAt: syncState.lastSyncAt,
        lastFullSyncAt: syncState.lastFullSyncAt,
        syncToken: syncState.syncToken ? "present" : null,
        recurring: isRecurring,
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

    const { type: syncType, enableRecurring } = parseResult.data;

    // Get queue adapter
    const queue = getCalendarQueue();

    // Handle recurring sync toggle
    if (enableRecurring !== undefined) {
      if (enableRecurring) {
        await startRecurringSync(queue, userId);
        logger.info("Started recurring sync", { userId });
      } else {
        await stopRecurringSync(queue, userId);
        logger.info("Stopped recurring sync", { userId });
      }
    }

    // Schedule the appropriate sync type (only if explicitly requested)
    let jobId: string | undefined;
    if (syncType) {
      switch (syncType) {
        case "full":
          const fullJob = await scheduleFullSync(queue, userId);
          jobId = fullJob.jobId;
          break;
        case "incremental":
          const incJob = await scheduleIncrementalSync(queue, userId);
          jobId = incJob.jobId;
          break;
        case "auto":
          // Auto mode: use incremental if we have a sync token, otherwise full
          const syncState = await calendarSyncStateRepository.get(userId);
          if (syncState?.syncToken) {
            const autoIncJob = await scheduleIncrementalSync(queue, userId);
            jobId = autoIncJob.jobId;
          } else {
            const autoFullJob = await scheduleFullSync(queue, userId);
            jobId = autoFullJob.jobId;
          }
          break;
      }
    }

    // Get current sync state
    const currentSyncState = await calendarSyncStateRepository.get(userId);
    const isRecurring = await hasRecurringSyncActive(queue, userId);

    logger.info("Sync triggered via API", { userId, syncType, jobId });

    return NextResponse.json(
      {
        success: true,
        message: jobId ? "Sync scheduled" : "Recurring sync updated",
        jobId,
        syncType: syncType || null,
        recurring: isRecurring,
        currentStatus: currentSyncState?.syncStatus || "idle",
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

    // Parse query params
    const stopRecurring =
      request.nextUrl.searchParams.get("stopRecurring") === "true";

    // Get queue adapter
    const queue = getCalendarQueue();

    // Stop recurring sync if requested
    if (stopRecurring) {
      await stopRecurringSync(queue, userId);
      logger.info("Stopped recurring sync", { userId });
    }

    // Clear sync error state and reset to idle
    await calendarSyncStateRepository.update(userId, {
      syncStatus: "idle",
      syncError: null,
    });

    return NextResponse.json(
      {
        success: true,
        message: stopRecurring ? "Sync stopped and recurring disabled" : "Sync stopped",
        recurringStopped: stopRecurring,
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
