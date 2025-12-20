// ═══════════════════════════════════════════════════════════════════════════
// Admin Queue Stats API
// GET /api/admin/queues - Get statistics for all queues
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { QUEUE_NAMES, getQueueStats } from "@/lib/queue";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // TODO: Add admin role check when roles are implemented
    // For now, any authenticated user can view queue stats

    const stats = await Promise.all(
      Object.values(QUEUE_NAMES).map(async (name) => ({
        name,
        ...(await getQueueStats(name)),
      }))
    );

    const totalStats = stats.reduce(
      (acc, queue) => ({
        waiting: acc.waiting + queue.waiting,
        active: acc.active + queue.active,
        completed: acc.completed + queue.completed,
        failed: acc.failed + queue.failed,
        delayed: acc.delayed + queue.delayed,
      }),
      { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }
    );

    return Response.json({
      queues: stats,
      totals: totalStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Admin Queues] Error fetching queue stats:", error);
    return Response.json(
      { error: "Failed to fetch queue stats" },
      { status: 500 }
    );
  }
}
