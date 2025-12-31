// ═══════════════════════════════════════════════════════════════════════════
// Calendar Sync Configuration API
// GET/PUT sync configuration and calendar selection
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getValidAccessToken } from "@/lib/auth/token-refresh";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";
import {
  calendarRepository,
  calendarSyncStateRepository,
} from "@/integrations/calendar/repository";
import { calendarLogger } from "@/integrations/calendar/logger";
import {
  syncCalendarMetadata,
  getCalendarsWithSyncEligibility,
  canSyncEventDetails,
  getCalendarQueue,
  scheduleFullSync,
  startRecurringSync,
  stopRecurringSync,
  hasRecurringSyncActive,
} from "@/integrations/calendar/sync";
import { z } from "zod";

const logger = calendarLogger.child("api.sync.config");

// ─────────────────────────────────────────────────────────────
// Validation Schemas
// ─────────────────────────────────────────────────────────────

const UpdateConfigSchema = z.object({
  // Calendar selection - array of calendar IDs to enable sync for
  enabledCalendarIds: z.array(z.string()).optional(),
  // Enable/disable recurring sync
  enableRecurring: z.boolean().optional(),
});

// ─────────────────────────────────────────────────────────────
// GET /api/integrations/calendar/sync/config
// Returns sync configuration and available calendars
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

    // Get or create sync state
    const syncState = await calendarSyncStateRepository.getOrCreate(userId);

    // Check if we need to sync calendar metadata first
    const hasCalendars = syncState.calendarCount > 0;

    if (!hasCalendars) {
      // Try to sync calendar metadata
      try {
        const accessToken = await getValidAccessToken(userId);
        if (accessToken) {
          await syncCalendarMetadata(userId, accessToken);
        }
      } catch (error) {
        logger.warn("Failed to sync calendar metadata", { userId }, error);
        // Continue - we'll return empty calendars
      }
    }

    // Get calendars with sync eligibility information
    const calendars = await getCalendarsWithSyncEligibility(userId);

    // Check if recurring sync is active
    const queue = getCalendarQueue();
    const isRecurring = await hasRecurringSyncActive(queue, userId);

    // Get enabled calendar IDs (isSelected = true)
    const enabledCalendarIds = calendars
      .filter((c) => c.isSelected)
      .map((c) => c.id);

    return NextResponse.json(
      {
        config: {
          syncConfigured: syncState.syncConfigured,
          recurringEnabled: isRecurring,
          enabledCalendarIds,
        },
        availableCalendars: calendars.map((cal) => ({
          id: cal.id,
          googleCalendarId: cal.googleCalendarId,
          name: cal.name,
          description: cal.description,
          isPrimary: cal.isPrimary,
          isOwner: cal.isOwner,
          accessRole: cal.accessRole,
          backgroundColor: cal.backgroundColor,
          foregroundColor: cal.foregroundColor,
          isSelected: cal.isSelected,
          isHidden: cal.isHidden,
          canSyncEvents: cal.canSyncEvents,
        })),
        calendarCount: calendars.length,
        syncableCount: calendars.filter((c) => c.canSyncEvents).length,
        metadataSynced: calendars.length > 0,
      },
      { headers }
    );
  } catch (error) {
    logger.error("Failed to get sync config", { userId }, error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get sync config",
      },
      { status: 500, headers }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// PUT /api/integrations/calendar/sync/config
// Update sync configuration
// ─────────────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
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

    // Parse and validate request body
    const body = await request.json().catch(() => ({}));
    const parseResult = UpdateConfigSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.issues,
        },
        { status: 400, headers }
      );
    }

    const { enabledCalendarIds, enableRecurring } = parseResult.data;
    const queue = getCalendarQueue();
    let syncStarted = false;

    // Handle calendar selection updates
    if (enabledCalendarIds !== undefined) {
      // Get all user calendars
      const allCalendars = await calendarRepository.findByUser(userId);

      // Validate that all enabled calendars can sync events
      for (const calId of enabledCalendarIds) {
        const calendar = allCalendars.find((c) => c.id === calId);
        if (!calendar) {
          return NextResponse.json(
            { error: `Calendar not found: ${calId}` },
            { status: 400, headers }
          );
        }
        if (!canSyncEventDetails(calendar.accessRole)) {
          return NextResponse.json(
            {
              error: `Cannot enable sync for calendar "${calendar.name}" - requires reader or owner access`,
              calendarId: calId,
              accessRole: calendar.accessRole,
            },
            { status: 400, headers }
          );
        }
      }

      // Disable all calendars first
      const allIds = allCalendars.map((c) => c.id);
      await calendarRepository.updateSelectionMany(userId, allIds, false);

      // Enable selected calendars
      if (enabledCalendarIds.length > 0) {
        await calendarRepository.updateSelectionMany(
          userId,
          enabledCalendarIds,
          true
        );
      }

      // Mark sync as configured and trigger full sync if calendars selected
      const wasConfigured = (await calendarSyncStateRepository.get(userId))
        ?.syncConfigured;

      await calendarSyncStateRepository.update(userId, {
        syncConfigured: true,
      });

      // If this is the first time configuring OR calendars changed, trigger full sync
      if (enabledCalendarIds.length > 0) {
        if (!wasConfigured) {
          // First time setup - trigger full sync
          await scheduleFullSync(queue, userId);
          syncStarted = true;
          logger.info("Started initial full sync after configuration", {
            userId,
          });
        }
      }
    }

    // Handle recurring sync toggle
    if (enableRecurring !== undefined) {
      if (enableRecurring) {
        await startRecurringSync(queue, userId);
        await calendarSyncStateRepository.update(userId, {
          recurringEnabled: true,
        });
        logger.info("Started recurring sync", { userId });
      } else {
        await stopRecurringSync(queue, userId);
        await calendarSyncStateRepository.update(userId, {
          recurringEnabled: false,
        });
        logger.info("Stopped recurring sync", { userId });
      }
    }

    // Get updated config
    const syncState = await calendarSyncStateRepository.get(userId);
    const calendars = await getCalendarsWithSyncEligibility(userId);
    const isRecurring = await hasRecurringSyncActive(queue, userId);
    const updatedEnabledIds = calendars
      .filter((c) => c.isSelected)
      .map((c) => c.id);

    return NextResponse.json(
      {
        success: true,
        syncStarted,
        config: {
          syncConfigured: syncState?.syncConfigured ?? false,
          recurringEnabled: isRecurring,
          enabledCalendarIds: updatedEnabledIds,
        },
      },
      { headers }
    );
  } catch (error) {
    logger.error("Failed to update sync config", { userId }, error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update sync config",
      },
      { status: 500, headers }
    );
  }
}
