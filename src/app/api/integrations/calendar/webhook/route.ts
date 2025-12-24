// ═══════════════════════════════════════════════════════════════════════════
// Calendar Webhook API
// Handle Google Calendar push notifications
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";
import {
  parseWebhookHeaders,
  processWebhookNotification,
  getCalendarQueue,
  scheduleIncrementalSync,
} from "@/integrations/calendar/sync";
import { calendarLogger } from "@/integrations/calendar/logger";

const logger = calendarLogger.child("api.webhook");

// Convert Next.js Headers to Record<string, string | string[] | undefined>
function headersToRecord(
  headers: Headers
): Record<string, string | string[] | undefined> {
  const result: Record<string, string | string[] | undefined> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

// ─────────────────────────────────────────────────────────────
// POST /api/integrations/calendar/webhook - Handle push notification
// ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Apply rate limiting (use IP-based since webhooks are unauthenticated)
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.calendarWebhook
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Parse webhook headers
    const headerRecord = headersToRecord(request.headers);
    const notification = parseWebhookHeaders(headerRecord);

    if (!notification) {
      logger.warn("Invalid webhook headers received", {
        headers: headerRecord,
      });
      // Return 200 to prevent Google from retrying
      return NextResponse.json(
        { error: "Invalid webhook headers" },
        { status: 200, headers }
      );
    }

    logger.info("Webhook notification received", {
      channelId: notification.channelId,
      resourceId: notification.resourceId,
      resourceState: notification.resourceState,
    });

    // Handle sync confirmation (initial webhook setup)
    if (notification.resourceState === "sync") {
      logger.info("Webhook sync confirmation received", {
        channelId: notification.channelId,
      });
      return NextResponse.json({ received: true }, { status: 200, headers });
    }

    // Process the notification (triggers incremental sync via job queue)
    const triggerSync = async (userId: string): Promise<void> => {
      try {
        const queue = getCalendarQueue();
        const { jobId } = await scheduleIncrementalSync(queue, userId);
        logger.info("Incremental sync job scheduled", { userId, jobId });
      } catch (error) {
        logger.error("Failed to schedule incremental sync", { userId }, error);
        throw error;
      }
    };
    const result = await processWebhookNotification(notification, triggerSync);

    if (!result.success) {
      logger.warn("Webhook processing failed", {
        channelId: notification.channelId,
        error: result.error,
      });
      // Still return 200 to prevent retries for known failures
      return NextResponse.json(
        { received: true, processed: false, error: result.error },
        { status: 200, headers }
      );
    }

    logger.info("Webhook processed successfully", {
      channelId: notification.channelId,
      syncTriggered: result.syncTriggered,
    });

    return NextResponse.json(
      {
        received: true,
        processed: true,
        syncTriggered: result.syncTriggered,
      },
      { status: 200, headers }
    );
  } catch (error) {
    logger.error("Webhook handler error", {}, error);
    // Return 200 to prevent Google from retrying on server errors
    // The sync will be retried on the next scheduled sync
    return NextResponse.json(
      {
        received: true,
        processed: false,
        error: error instanceof Error ? error.message : "Internal error",
      },
      { status: 200, headers }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/integrations/calendar/webhook - Health check
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.calendarWebhook
  );
  if (rateLimitResponse) return rateLimitResponse;

  return NextResponse.json(
    {
      status: "ok",
      service: "calendar-webhook",
      timestamp: new Date().toISOString(),
    },
    { headers }
  );
}
