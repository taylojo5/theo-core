// ═══════════════════════════════════════════════════════════════════════════
// Gmail Sync Configuration API
// GET/PUT /api/integrations/gmail/sync/config - Manage sync configuration
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";
import {
  syncStateRepository,
  labelRepository,
  apiLogger,
  startRecurringSync,
  triggerFullSync,
  hasRecurringSync,
  triggerMetadataSync,
} from "@/integrations/gmail";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface SyncConfigResponse {
  success: boolean;
  config?: {
    syncConfigured: boolean;
    syncLabels: string[];
    excludeLabels: string[];
    maxEmailAgeDays: number | null;
    syncAttachments: boolean;
  };
  availableLabels?: Array<{
    id: string;
    gmailId: string;
    name: string;
    type: string;
    messageCount: number;
    unreadCount: number;
  }>;
  /** True if metadata sync is currently in progress */
  metadataSyncing?: boolean;
  message?: string;
  error?: string;
}

// Validation schema for updating sync config
const updateConfigSchema = z.object({
  syncLabels: z.array(z.string()).min(1, "At least one label must be selected"),
  excludeLabels: z.array(z.string()).optional().default([]),
  maxEmailAgeDays: z.number().min(1).max(3650).nullable().optional(),
  syncAttachments: z.boolean().optional().default(false),
});

// ─────────────────────────────────────────────────────────────
// GET /api/integrations/gmail/sync/config
// Get current sync configuration and available labels
// ─────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest
): Promise<NextResponse<SyncConfigResponse>> {
  // Apply rate limiting
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.gmailSync
  );
  if (rateLimitResponse)
    return rateLimitResponse as NextResponse<SyncConfigResponse>;

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      { status: 401, headers }
    );
  }

  const userId = session.user.id;

  try {
    // Get current sync state
    const syncState = await syncStateRepository.get(userId);

    // Get available labels
    const labels = await labelRepository.findAll(userId);

    // If labels are empty and sync is not configured, trigger metadata sync
    // This handles the case after OAuth callback when no metadata has been synced yet
    let metadataSyncing = false;
    if (labels.length === 0 && !syncState.syncConfigured) {
      try {
        // Check if sync is not already in progress
        if (syncState.syncStatus !== "syncing") {
          await triggerMetadataSync(userId);
          metadataSyncing = true;
          apiLogger.info("Triggered metadata sync from config endpoint", {
            userId,
          });
        } else {
          // Sync is already in progress
          metadataSyncing = true;
        }
      } catch (syncError) {
        apiLogger.error(
          "Failed to trigger metadata sync",
          { userId },
          syncError
        );
        // Don't fail the request - just log and continue
      }
    }

    return NextResponse.json(
      {
        success: true,
        metadataSyncing,
        config: {
          syncConfigured: syncState.syncConfigured,
          syncLabels: syncState.syncLabels,
          excludeLabels: syncState.excludeLabels,
          maxEmailAgeDays: syncState.maxEmailAgeDays,
          syncAttachments: syncState.syncAttachments,
        },
        availableLabels: labels.map((label) => ({
          id: label.id,
          gmailId: label.gmailId,
          name: label.name,
          type: label.type,
          messageCount: label.messageCount,
          unreadCount: label.unreadCount,
        })),
      },
      { headers }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    apiLogger.error(
      "Failed to get sync config",
      { userId, errorMessage },
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: `Failed to retrieve sync configuration: ${errorMessage}`,
      },
      { status: 500, headers }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// PUT /api/integrations/gmail/sync/config
// Update sync configuration and optionally trigger full sync
// ─────────────────────────────────────────────────────────────

export async function PUT(
  request: NextRequest
): Promise<NextResponse<SyncConfigResponse & { syncStarted?: boolean }>> {
  // Apply rate limiting
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.gmailSync
  );
  if (rateLimitResponse)
    return rateLimitResponse as NextResponse<
      SyncConfigResponse & { syncStarted?: boolean }
    >;

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      { status: 401, headers }
    );
  }

  const userId = session.user.id;

  try {
    // Parse and validate request body
    const body = await request.json();
    const validation = updateConfigSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.issues[0].message,
        },
        { status: 400, headers }
      );
    }

    const { syncLabels, excludeLabels, maxEmailAgeDays, syncAttachments } =
      validation.data;

    // Validate that selected labels exist
    const availableLabels = await labelRepository.findAll(userId);
    const availableLabelIds = availableLabels.map((l) => l.gmailId);

    const invalidLabels = syncLabels.filter(
      (l) => !availableLabelIds.includes(l)
    );
    if (invalidLabels.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid label IDs: ${invalidLabels.join(", ")}`,
        },
        { status: 400, headers }
      );
    }

    // Get current state to check if this is initial configuration
    const currentState = await syncStateRepository.get(userId);
    const isInitialConfig = !currentState.syncConfigured;

    // Update sync configuration
    const updatedState = await syncStateRepository.update(userId, {
      syncConfigured: true,
      syncLabels,
      excludeLabels: excludeLabels || [],
      maxEmailAgeDays: maxEmailAgeDays ?? null,
      syncAttachments: syncAttachments ?? false,
    });

    let syncStarted = false;

    // If this is initial configuration, start the sync process
    if (isInitialConfig) {
      try {
        // Start recurring sync
        await startRecurringSync(userId);

        // Trigger initial full sync
        await triggerFullSync(userId);

        syncStarted = true;
        apiLogger.info("Started email sync after initial configuration", {
          userId,
          labelCount: syncLabels.length,
          maxEmailAgeDays,
        });
      } catch (syncError) {
        apiLogger.error(
          "Failed to start sync after configuration",
          { userId },
          syncError
        );
        // Don't fail the request - config was saved successfully
      }
    } else {
      // Check if we need to trigger a new full sync due to config changes
      // Use spread operator to avoid mutating original arrays
      const labelsChanged =
        JSON.stringify([...currentState.syncLabels].sort()) !==
        JSON.stringify([...syncLabels].sort());
      const ageChanged = currentState.maxEmailAgeDays !== maxEmailAgeDays;

      if (labelsChanged || ageChanged) {
        try {
          // Ensure recurring sync is running
          const hasRecurring = await hasRecurringSync(userId);
          if (!hasRecurring) {
            await startRecurringSync(userId);
          }

          // Trigger a new full sync to pick up emails from new labels
          await triggerFullSync(userId);
          syncStarted = true;

          apiLogger.info("Triggered full sync due to config changes", {
            userId,
            labelsChanged,
            ageChanged,
          });
        } catch (syncError) {
          apiLogger.error(
            "Failed to trigger sync after config update",
            { userId },
            syncError
          );
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        syncStarted,
        config: {
          syncConfigured: updatedState.syncConfigured,
          syncLabels: updatedState.syncLabels,
          excludeLabels: updatedState.excludeLabels,
          maxEmailAgeDays: updatedState.maxEmailAgeDays,
          syncAttachments: updatedState.syncAttachments,
        },
        message: syncStarted
          ? "Sync configuration saved. Email sync has started."
          : "Sync configuration saved.",
      },
      { headers }
    );
  } catch (error) {
    apiLogger.error("Failed to update sync config", { userId }, error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update sync configuration",
      },
      { status: 500, headers }
    );
  }
}
