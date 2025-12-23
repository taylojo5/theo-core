// ═══════════════════════════════════════════════════════════════════════════
// Gmail Sync API
// Trigger and manage email sync operations
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";
import { unauthorized, validationError, handleApiError } from "@/lib/api";
import {
  triggerSync,
  triggerFullSync,
  triggerIncrementalSync,
  startRecurringSync,
  stopRecurringSync,
  hasRecurringSync,
  cancelPendingSyncs,
} from "@/integrations/gmail/sync/scheduler";
import { syncStateRepository } from "@/integrations/gmail/repository";
import { apiLogger } from "@/integrations/gmail";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// POST /api/integrations/gmail/sync
// Trigger an email sync
// ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Apply rate limiting first (outside try-catch so headers is accessible)
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    req,
    RATE_LIMITS.gmailSync
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers }
      );
    }

    const userId = session.user.id;

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const syncType = body.type as "auto" | "full" | "incremental" | undefined;
    const enableRecurring = body.enableRecurring as boolean | undefined;

    // Handle recurring sync toggle
    if (enableRecurring !== undefined) {
      if (enableRecurring) {
        await startRecurringSync(userId);
      } else {
        await stopRecurringSync(userId);
      }
    }

    // Schedule the appropriate sync type (only if explicitly requested)
    let job;
    if (syncType) {
      switch (syncType) {
        case "full":
          job = await triggerFullSync(userId);
          break;
        case "incremental":
          job = await triggerIncrementalSync(userId);
          break;
        case "auto":
          job = await triggerSync(userId);
          break;
      }
    }

    // Get current sync state
    const syncState = await syncStateRepository.get(userId);
    const isRecurring = await hasRecurringSync(userId);

    return NextResponse.json(
      {
        success: true,
        message: job ? "Sync scheduled" : "Recurring sync updated",
        jobId: job?.id,
        syncType: syncType || null,
        recurring: isRecurring,
        currentStatus: syncState.syncStatus,
      },
      { headers }
    );
  } catch (error) {
    apiLogger.error("Failed to schedule sync", {}, error);
    return NextResponse.json(
      {
        error: "Failed to schedule sync",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/integrations/gmail/sync
// Update sync configuration
// ─────────────────────────────────────────────────────────────

const SyncConfigSchema = z.object({
  syncLabels: z.array(z.string()).optional(),
  excludeLabels: z.array(z.string()).optional(),
  maxEmailAgeDays: z.number().min(1).max(365).optional(),
  syncAttachments: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  // Apply rate limiting
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    req,
    RATE_LIMITS.gmailSync
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return unauthorized("Authentication required", headers);
    }

    const userId = session.user.id;

    // Parse request body
    const body = await req.json().catch(() => ({}));

    // Validate config
    const parseResult = SyncConfigSchema.safeParse(body);
    if (!parseResult.success) {
      return validationError(
        "Invalid sync configuration",
        parseResult.error.issues,
        headers
      );
    }

    const config = parseResult.data;

    // Update sync state with new config
    const updatedState = await syncStateRepository.update(userId, config);

    apiLogger.info("Sync configuration updated", {
      userId,
      config,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Sync configuration updated",
        config: {
          syncLabels: updatedState.syncLabels,
          excludeLabels: updatedState.excludeLabels,
          maxEmailAgeDays: updatedState.maxEmailAgeDays,
          syncAttachments: updatedState.syncAttachments,
        },
      },
      { headers }
    );
  } catch (error) {
    apiLogger.error("Failed to update sync config", {}, error);
    return handleApiError(error, headers);
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/integrations/gmail/sync
// Cancel pending syncs
// ─────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  // Apply rate limiting first (outside try-catch so headers is accessible)
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    req,
    RATE_LIMITS.gmailSync
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers }
      );
    }

    const userId = session.user.id;

    // Parse query params
    const stopRecurring =
      req.nextUrl.searchParams.get("stopRecurring") === "true";

    // Stop recurring sync if requested
    if (stopRecurring) {
      await stopRecurringSync(userId);
    }

    // Cancel pending jobs
    const cancelled = await cancelPendingSyncs(userId);

    return NextResponse.json(
      {
        success: true,
        message: `Cancelled ${cancelled} pending sync jobs`,
        cancelled,
        recurringStopped: stopRecurring,
      },
      { headers }
    );
  } catch (error) {
    apiLogger.error("Failed to cancel syncs", {}, error);
    return NextResponse.json(
      {
        error: "Failed to cancel syncs",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers }
    );
  }
}
