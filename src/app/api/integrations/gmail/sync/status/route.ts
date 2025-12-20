// ═══════════════════════════════════════════════════════════════════════════
// Gmail Sync Status API
// Get sync status and statistics
// ═══════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  syncStateRepository,
  emailRepository,
  labelRepository,
} from "@/integrations/gmail/repository";
import {
  getPendingSyncJobs,
  hasRecurringSync,
} from "@/integrations/gmail/sync/scheduler";

// ─────────────────────────────────────────────────────────────
// GET /api/integrations/gmail/sync/status
// Get sync status and statistics
// ─────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get sync state
    const syncState = await syncStateRepository.get(userId);

    // Get real-time counts
    const [emailCount, labels, pendingJobs, isRecurring] = await Promise.all([
      emailRepository.count(userId),
      labelRepository.findAll(userId),
      getPendingSyncJobs(userId),
      hasRecurringSync(userId),
    ]);

    // Get unread count
    const unreadCount = await emailRepository.getUnreadCount(userId);

    // Format pending jobs info (check status asynchronously)
    const pendingJobsInfo = await Promise.all(
      pendingJobs.map(async (job) => {
        const [isActive, isDelayed] = await Promise.all([
          job.isActive(),
          job.isDelayed(),
        ]);
        return {
          id: job.id,
          name: job.name,
          status: isActive ? "active" : isDelayed ? "delayed" : "waiting",
          progress: job.progress,
          timestamp: job.timestamp,
        };
      })
    );

    return NextResponse.json({
      status: syncState.syncStatus,
      error: syncState.syncError,

      // Sync timing
      lastSyncAt: syncState.lastSyncAt,
      lastFullSyncAt: syncState.lastFullSyncAt,
      historyId: syncState.historyId,

      // Statistics
      stats: {
        emailCount,
        unreadCount,
        labelCount: labels.length,
        contactCount: syncState.contactCount,
      },

      // Labels
      labels: labels.map((label) => ({
        id: label.gmailId,
        name: label.name,
        type: label.type,
        messageCount: label.messageCount,
        unreadCount: label.unreadCount,
      })),

      // Sync configuration
      config: {
        syncLabels: syncState.syncLabels,
        excludeLabels: syncState.excludeLabels,
        maxEmailAgeDays: syncState.maxEmailAgeDays,
        syncAttachments: syncState.syncAttachments,
      },

      // Job status
      recurring: isRecurring,
      pendingJobs: pendingJobsInfo,
      hasActiveSyncs: pendingJobsInfo.some((j) => j.status === "active"),
    });
  } catch (error) {
    console.error("[Gmail Sync Status API] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to get sync status",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
