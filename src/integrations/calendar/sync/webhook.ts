// ═══════════════════════════════════════════════════════════════════════════
// Calendar Webhook Management
// Registration, processing, and renewal of Google Calendar push notifications
// ═══════════════════════════════════════════════════════════════════════════

import { randomUUID } from "crypto";
import { createCalendarClient } from "../client";
import { calendarSyncStateRepository } from "../repository";
import { CalendarError, CalendarErrorCode } from "../errors";
import { webhookLogger } from "../logger";
import {
  WEBHOOK_MAX_LIFETIME_MS,
  WEBHOOK_RENEWAL_BUFFER_MS,
  WEBHOOK_DEBOUNCE_MS,
} from "../constants";
import type { WatchResponse } from "../types";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/**
 * Result of webhook registration
 */
export interface WebhookRegistration {
  /** Channel ID (for identifying our webhook) */
  channelId: string;
  /** Resource ID (from Google) */
  resourceId: string;
  /** Expiration timestamp */
  expiration: Date;
  /** Whether this is a new registration or renewal */
  isRenewal: boolean;
}

/**
 * Webhook notification from Google
 */
export interface WebhookNotification {
  /** Channel ID from X-Goog-Channel-ID header */
  channelId: string;
  /** Resource ID from X-Goog-Resource-ID header */
  resourceId: string;
  /** Resource state from X-Goog-Resource-State header */
  resourceState: "sync" | "exists" | "not_exists";
  /** Message number from X-Goog-Message-Number header */
  messageNumber?: number;
  /** Channel token from X-Goog-Channel-Token header */
  token?: string;
  /** Expiration from X-Goog-Channel-Expiration header */
  expiration?: string;
}

/**
 * Result of webhook notification processing
 */
export interface WebhookProcessResult {
  /** Whether processing was successful */
  success: boolean;
  /** Whether a sync was triggered */
  syncTriggered: boolean;
  /** User ID if found */
  userId?: string;
  /** Error message if failed */
  error?: string;
  /** Whether the notification was debounced */
  debounced?: boolean;
}

// ─────────────────────────────────────────────────────────────
// In-memory debounce tracking
// ─────────────────────────────────────────────────────────────

// Track last notification time per channel to debounce rapid-fire notifications
const lastNotificationTime = new Map<string, number>();

// Cleanup old entries periodically
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    const expiredThreshold = now - WEBHOOK_DEBOUNCE_MS * 2;
    for (const [key, time] of lastNotificationTime.entries()) {
      if (time < expiredThreshold) {
        lastNotificationTime.delete(key);
      }
    }
  }, 60000); // Clean up every minute
}

// ─────────────────────────────────────────────────────────────
// Webhook Registration
// ─────────────────────────────────────────────────────────────

/**
 * Register a webhook for calendar event notifications
 *
 * @param userId - User ID to register webhook for
 * @param accessToken - OAuth2 access token
 * @param webhookUrl - HTTPS URL to receive notifications
 * @param calendarId - Google Calendar ID to watch (default: "primary")
 * @returns Webhook registration details
 */
export async function registerWebhook(
  userId: string,
  accessToken: string,
  webhookUrl: string,
  calendarId: string = "primary"
): Promise<WebhookRegistration> {
  // Validate webhook URL
  if (!webhookUrl.startsWith("https://")) {
    throw new CalendarError(
      CalendarErrorCode.INVALID_REQUEST,
      "Webhook URL must use HTTPS",
      false
    );
  }

  const client = createCalendarClient(accessToken, userId);

  // Check for existing webhook
  const syncState = await calendarSyncStateRepository.get(userId);
  const existingChannelId = syncState?.webhookChannelId;
  const existingResourceId = syncState?.webhookResourceId;

  // Stop existing webhook if present
  if (existingChannelId && existingResourceId) {
    try {
      await client.stopWatching(existingChannelId, existingResourceId);
      webhookLogger.debug("Stopped existing webhook", {
        userId,
        channelId: existingChannelId,
      });
    } catch (error) {
      // Log but continue - the old webhook may have already expired
      webhookLogger.warn("Failed to stop existing webhook", {
        userId,
        channelId: existingChannelId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Generate new channel ID
  const channelId = generateChannelId();

  // Calculate expiration (max 7 days)
  const expiration = new Date(Date.now() + WEBHOOK_MAX_LIFETIME_MS);

  // Register the watch
  const response: WatchResponse = await client.watchEvents(
    calendarId,
    channelId,
    webhookUrl,
    {
      token: userId, // Include userId in token for verification
      expiration,
    }
  );

  // Calculate actual expiration from response
  const actualExpiration = new Date(parseInt(response.expiration, 10));

  // Store webhook info in sync state
  await calendarSyncStateRepository.updateWebhook(
    userId,
    response.id,
    response.resourceId,
    actualExpiration
  );

  webhookLogger.info("Registered webhook", {
    userId,
    channelId: response.id,
    resourceId: response.resourceId,
    expiration: actualExpiration.toISOString(),
  });

  return {
    channelId: response.id,
    resourceId: response.resourceId,
    expiration: actualExpiration,
    isRenewal: !!existingChannelId,
  };
}

/**
 * Stop receiving webhook notifications
 *
 * @param userId - User ID to stop webhook for
 * @param accessToken - OAuth2 access token
 */
export async function stopWebhook(
  userId: string,
  accessToken: string
): Promise<void> {
  const syncState = await calendarSyncStateRepository.get(userId);

  if (!syncState?.webhookChannelId || !syncState?.webhookResourceId) {
    webhookLogger.debug("No webhook to stop", { userId });
    return;
  }

  const client = createCalendarClient(accessToken, userId);

  try {
    await client.stopWatching(
      syncState.webhookChannelId,
      syncState.webhookResourceId
    );

    webhookLogger.info("Stopped webhook", {
      userId,
      channelId: syncState.webhookChannelId,
    });
  } catch (error) {
    webhookLogger.warn("Failed to stop webhook", {
      userId,
      channelId: syncState.webhookChannelId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Clear webhook info from sync state regardless of stop result
  await calendarSyncStateRepository.clearWebhook(userId);
}

// ─────────────────────────────────────────────────────────────
// Webhook Notification Processing
// ─────────────────────────────────────────────────────────────

/**
 * Process a webhook notification from Google
 *
 * This function:
 * 1. Validates the notification
 * 2. Looks up the user by channel ID
 * 3. Triggers an incremental sync if appropriate
 *
 * @param notification - Webhook notification data
 * @param triggerSync - Callback to trigger sync (decoupled for flexibility)
 * @returns Processing result
 */
export async function processWebhookNotification(
  notification: WebhookNotification,
  triggerSync: (userId: string) => Promise<void>
): Promise<WebhookProcessResult> {
  const { channelId, resourceId, resourceState, token } = notification;

  try {
    // Initial sync notification - just acknowledge
    if (resourceState === "sync") {
      webhookLogger.debug("Received sync notification", { channelId });
      return {
        success: true,
        syncTriggered: false,
      };
    }

    // Look up user by channel ID
    const syncState = await calendarSyncStateRepository.findByWebhookChannel(channelId);

    if (!syncState) {
      webhookLogger.warn("Unknown webhook channel", { channelId });
      return {
        success: false,
        syncTriggered: false,
        error: "Unknown webhook channel",
      };
    }

    // Verify resource ID matches
    if (syncState.webhookResourceId !== resourceId) {
      webhookLogger.warn("Resource ID mismatch", {
        channelId,
        expected: syncState.webhookResourceId,
        received: resourceId,
      });
      return {
        success: false,
        syncTriggered: false,
        error: "Resource ID mismatch",
      };
    }

    // Verify token (contains userId for webhook verification)
    // Token is set during webhook registration and MUST match the userId.
    // All webhooks registered with this codebase include a token.
    // Webhooks expire after 7 days max, so any legacy tokenless webhooks would have expired.
    if (!token) {
      webhookLogger.warn("Webhook notification missing token - rejecting for security", {
        channelId,
        userId: syncState.userId,
      });
      return {
        success: false,
        syncTriggered: false,
        error: "Missing verification token",
      };
    }

    if (token !== syncState.userId) {
      webhookLogger.warn("Token mismatch - rejecting notification", {
        channelId,
        userId: syncState.userId,
      });
      return {
        success: false,
        syncTriggered: false,
        error: "Token mismatch",
      };
    }

    const userId = syncState.userId;

    // Debounce: skip if we processed a notification for this channel recently
    const now = Date.now();
    const lastTime = lastNotificationTime.get(channelId);
    if (lastTime && now - lastTime < WEBHOOK_DEBOUNCE_MS) {
      webhookLogger.debug("Debouncing notification", {
        userId,
        channelId,
        timeSinceLast: now - lastTime,
      });
      return {
        success: true,
        syncTriggered: false,
        userId,
        debounced: true,
      };
    }

    // Update last notification time
    lastNotificationTime.set(channelId, now);

    // Handle based on resource state
    if (resourceState === "exists") {
      // Events changed - trigger incremental sync
      webhookLogger.info("Triggering incremental sync from webhook", {
        userId,
        channelId,
      });

      await triggerSync(userId);

      return {
        success: true,
        syncTriggered: true,
        userId,
      };
    }

    if (resourceState === "not_exists") {
      // Resource deleted - this shouldn't happen for calendar events watch
      // but we log it for debugging
      webhookLogger.warn("Received not_exists notification", {
        userId,
        channelId,
      });

      return {
        success: true,
        syncTriggered: false,
        userId,
      };
    }

    return {
      success: true,
      syncTriggered: false,
      userId,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    webhookLogger.error("Failed to process webhook notification", {
      channelId,
      error: errorMessage,
    });

    return {
      success: false,
      syncTriggered: false,
      error: errorMessage,
    };
  }
}

/**
 * Parse webhook notification from HTTP headers
 *
 * @param headers - HTTP headers from the webhook request
 * @returns Parsed notification or null if invalid
 */
export function parseWebhookHeaders(
  headers: Record<string, string | string[] | undefined>
): WebhookNotification | null {
  const getHeader = (name: string): string | undefined => {
    const value = headers[name] || headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  };

  const channelId = getHeader("X-Goog-Channel-ID");
  const resourceId = getHeader("X-Goog-Resource-ID");
  const resourceState = getHeader("X-Goog-Resource-State");

  if (!channelId || !resourceId || !resourceState) {
    return null;
  }

  // Validate resource state
  if (!["sync", "exists", "not_exists"].includes(resourceState)) {
    return null;
  }

  return {
    channelId,
    resourceId,
    resourceState: resourceState as "sync" | "exists" | "not_exists",
    messageNumber: parseInt(getHeader("X-Goog-Message-Number") || "0", 10) || undefined,
    token: getHeader("X-Goog-Channel-Token"),
    expiration: getHeader("X-Goog-Channel-Expiration"),
  };
}

// ─────────────────────────────────────────────────────────────
// Webhook Renewal
// ─────────────────────────────────────────────────────────────

/**
 * Renew webhooks that are about to expire
 *
 * @param getAccessToken - Callback to get access token for a user
 * @param webhookUrl - HTTPS URL to receive notifications
 * @returns Number of webhooks renewed
 */
export async function renewExpiringWebhooks(
  getAccessToken: (userId: string) => Promise<string | null>,
  webhookUrl: string
): Promise<number> {
  // Find webhooks expiring within the buffer period
  const expiringSyncStates = await calendarSyncStateRepository.findExpiringWebhooks(
    WEBHOOK_RENEWAL_BUFFER_MS
  );

  if (expiringSyncStates.length === 0) {
    webhookLogger.debug("No webhooks to renew");
    return 0;
  }

  webhookLogger.info("Found expiring webhooks", {
    count: expiringSyncStates.length,
  });

  let renewed = 0;

  for (const syncState of expiringSyncStates) {
    try {
      const accessToken = await getAccessToken(syncState.userId);

      if (!accessToken) {
        webhookLogger.warn("No access token for user", {
          userId: syncState.userId,
        });
        continue;
      }

      await registerWebhook(
        syncState.userId,
        accessToken,
        webhookUrl,
        "primary"
      );

      renewed++;

      webhookLogger.info("Renewed webhook", {
        userId: syncState.userId,
      });

    } catch (error) {
      webhookLogger.error("Failed to renew webhook", {
        userId: syncState.userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return renewed;
}

/**
 * Check if a webhook needs renewal
 *
 * @param expiration - Webhook expiration date
 * @returns Whether the webhook should be renewed
 */
export function needsRenewal(expiration: Date | null): boolean {
  if (!expiration) return false;
  return expiration.getTime() - Date.now() < WEBHOOK_RENEWAL_BUFFER_MS;
}

// ─────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────

/**
 * Generate a unique channel ID for webhook registration
 */
function generateChannelId(): string {
  // Use UUID v4 for unpredictable channel IDs
  return `calendar-${randomUUID()}`;
}

