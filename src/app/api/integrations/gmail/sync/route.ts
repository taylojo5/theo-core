// ═══════════════════════════════════════════════════════════════════════════
// Gmail Sync API
// Trigger and manage email sync operations
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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

// ─────────────────────────────────────────────────────────────
// POST /api/integrations/gmail/sync
// Trigger an email sync
// ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    return NextResponse.json({
      success: true,
      message: job ? "Sync scheduled" : "Recurring sync updated",
      jobId: job?.id,
      syncType: syncType || null,
      recurring: isRecurring,
      currentStatus: syncState.syncStatus,
    });
  } catch (error) {
    console.error("[Gmail Sync API] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to schedule sync",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/integrations/gmail/sync
// Cancel pending syncs
// ─────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    // Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    return NextResponse.json({
      success: true,
      message: `Cancelled ${cancelled} pending sync jobs`,
      cancelled,
      recurringStopped: stopRecurring,
    });
  } catch (error) {
    console.error("[Gmail Sync API] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to cancel syncs",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
