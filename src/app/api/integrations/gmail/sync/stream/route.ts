// ═══════════════════════════════════════════════════════════════════════════
// Gmail Sync Progress Stream API
// Server-Sent Events endpoint for real-time sync progress updates
// ═══════════════════════════════════════════════════════════════════════════

import { auth } from "@/lib/auth";
import {
  createSSEStream,
  sseResponse,
  registerConnection,
  unregisterConnection,
} from "@/lib/sse";
import { syncStateRepository } from "@/integrations/gmail/repository";
import { getEmbeddingStats } from "@/integrations/gmail/sync/embedding-retry";
import { getCheckpoint } from "@/integrations/gmail/sync/full-sync";
import { apiLogger } from "@/integrations/gmail";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface SyncProgressEvent {
  type: "status" | "progress" | "complete" | "error";
  syncStatus: string;
  syncType?: "full" | "incremental";
  progress?: {
    phase: string;
    emailsProcessed: number;
    currentPage?: number;
  };
  checkpoint?: {
    hasCheckpoint: boolean;
    progress?: number;
    startedAt?: string;
  };
  embeddings?: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
  };
  stats?: {
    emailCount: number;
    labelCount: number;
    contactCount: number;
  };
  error?: string;
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────
// SSE Connection Key
// ─────────────────────────────────────────────────────────────

function getSyncStreamKey(userId: string): string {
  return `gmail-sync:${userId}`;
}

// ─────────────────────────────────────────────────────────────
// GET /api/integrations/gmail/sync/stream
// SSE endpoint for sync progress
// ─────────────────────────────────────────────────────────────

export async function GET() {
  // Authenticate
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const streamKey = getSyncStreamKey(userId);

  // Create SSE stream
  const { stream, send, close } = createSSEStream();

  // Register connection for broadcasts
  registerConnection(streamKey, send);

  // Send initial state
  try {
    const initialState = await buildSyncProgressEvent(userId);
    send({ event: "status", data: initialState });
  } catch (error) {
    apiLogger.error("Error sending initial state", { userId }, error);
  }

  // Start polling for updates (every 2 seconds while connected)
  const pollInterval = setInterval(async () => {
    try {
      const state = await buildSyncProgressEvent(userId);
      send({ event: "progress", data: state });

      // If sync is complete or errored, send final event and close
      if (state.syncStatus === "idle" || state.syncStatus === "error") {
        send({
          event: state.syncStatus === "error" ? "error" : "complete",
          data: state,
        });
      }
    } catch (error) {
      apiLogger.error("Polling error", { userId }, error);
    }
  }, 2000);

  // Clean up on stream close
  const cleanup = () => {
    clearInterval(pollInterval);
    unregisterConnection(streamKey, send);
    close();
  };

  // Handle stream abort via AbortSignal or connection close
  // Note: We can't use stream.getReader() here as it locks the stream,
  // preventing the HTTP response from consuming it.
  // The cleanup is handled when the client disconnects and the stream closes.
  const controller = new AbortController();
  const signal = controller.signal;

  // Use a timeout-based check that self-cleans when connection closes
  const _checkConnection = () => {
    if (signal.aborted) {
      cleanup();
    }
  };

  // The stream's cancel method will be called when client disconnects
  const originalStream = stream;
  const wrappedStream = new ReadableStream({
    start(controller) {
      const reader = originalStream.getReader();
      const pump = async () => {
        try {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            cleanup();
            return;
          }
          controller.enqueue(value);
          pump();
        } catch {
          controller.close();
          cleanup();
        }
      };
      pump();
    },
    cancel() {
      cleanup();
    },
  });

  return sseResponse(wrappedStream);
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Build a sync progress event from current state
 */
async function buildSyncProgressEvent(
  userId: string
): Promise<SyncProgressEvent> {
  const [syncState, embeddingStats, checkpoint] = await Promise.all([
    syncStateRepository.get(userId),
    getEmbeddingStats(userId).catch(() => ({
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      total: 0,
    })),
    getCheckpoint(userId).catch(() => null),
  ]);

  const event: SyncProgressEvent = {
    type:
      syncState.syncStatus === "syncing"
        ? "progress"
        : syncState.syncStatus === "error"
          ? "error"
          : "status",
    syncStatus: syncState.syncStatus,
    embeddings: embeddingStats,
    stats: {
      emailCount: syncState.emailCount,
      labelCount: syncState.labelCount,
      contactCount: syncState.contactCount,
    },
    timestamp: new Date().toISOString(),
  };

  // Add checkpoint info if available
  if (checkpoint) {
    event.checkpoint = {
      hasCheckpoint: !!checkpoint.pageToken,
      progress: checkpoint.progress,
      startedAt: checkpoint.startedAt.toISOString(),
    };
  }

  // Add error if present
  if (syncState.syncError) {
    event.error = syncState.syncError;
  }

  return event;
}

// ─────────────────────────────────────────────────────────────
// Broadcast Helpers (for use by sync workers)
// ─────────────────────────────────────────────────────────────

/**
 * Broadcast sync progress to connected clients
 * Called by sync workers to push updates
 */
export async function broadcastSyncProgress(
  userId: string,
  progress: Partial<SyncProgressEvent>
): Promise<void> {
  const { broadcast } = await import("@/lib/sse");
  const streamKey = getSyncStreamKey(userId);

  broadcast(streamKey, "progress", {
    ...progress,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast sync completion
 */
export async function broadcastSyncComplete(
  userId: string,
  stats: { added: number; updated: number; deleted: number; total: number }
): Promise<void> {
  const { broadcast } = await import("@/lib/sse");
  const streamKey = getSyncStreamKey(userId);

  broadcast(streamKey, "complete", {
    type: "complete",
    syncStatus: "idle",
    stats,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast sync error
 */
export async function broadcastSyncError(
  userId: string,
  error: string
): Promise<void> {
  const { broadcast } = await import("@/lib/sse");
  const streamKey = getSyncStreamKey(userId);

  broadcast(streamKey, "error", {
    type: "error",
    syncStatus: "error",
    error,
    timestamp: new Date().toISOString(),
  });
}
