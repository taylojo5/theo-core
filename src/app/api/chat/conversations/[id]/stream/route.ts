// ═══════════════════════════════════════════════════════════════════════════
// Chat Conversation SSE Stream
// GET /api/chat/conversations/[id]/stream - Subscribe to real-time updates
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  createSSEStream,
  sseResponse,
  registerConnection,
  unregisterConnection,
  broadcast,
} from "@/lib/sse";
import { getConversation } from "@/services/chat";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Verify conversation ownership
  const conversation = await getConversation(userId, conversationId);
  if (!conversation) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { stream, send, close } = createSSEStream();

  // Send initial connection message
  send({
    event: "connected",
    data: { conversationId, timestamp: Date.now() },
  });

  // Register this connection
  const connectionKey = `${userId}:${conversationId}`;
  registerConnection(connectionKey, send);

  // Handle disconnect
  request.signal.addEventListener("abort", () => {
    unregisterConnection(connectionKey, send);
    clearInterval(keepAlive);
    close();
  });

  // Keep-alive ping every 30 seconds to prevent timeout
  const keepAlive = setInterval(() => {
    try {
      send({ event: "ping", data: { timestamp: Date.now() } });
    } catch {
      clearInterval(keepAlive);
    }
  }, 30000);

  return sseResponse(stream);
}

// ─────────────────────────────────────────────────────────────
// Broadcast Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Send a new message event to all subscribers of a conversation
 */
export function broadcastNewMessage(
  userId: string,
  conversationId: string,
  message: {
    id: string;
    role: string;
    content: string;
    createdAt: Date;
  }
) {
  const connectionKey = `${userId}:${conversationId}`;
  broadcast(connectionKey, "message", message);
}

/**
 * Send a typing indicator to all subscribers
 */
export function broadcastTyping(
  userId: string,
  conversationId: string,
  isTyping: boolean
) {
  const connectionKey = `${userId}:${conversationId}`;
  broadcast(connectionKey, "typing", { isTyping, timestamp: Date.now() });
}

/**
 * Send a processing status update
 */
export function broadcastStatus(
  userId: string,
  conversationId: string,
  status: "processing" | "searching" | "thinking" | "complete" | "error",
  details?: string
) {
  const connectionKey = `${userId}:${conversationId}`;
  broadcast(connectionKey, "status", {
    status,
    details,
    timestamp: Date.now(),
  });
}

/**
 * Send a chunk of a streaming response
 */
export function broadcastStreamChunk(
  userId: string,
  conversationId: string,
  messageId: string,
  chunk: string,
  done: boolean = false
) {
  const connectionKey = `${userId}:${conversationId}`;
  broadcast(connectionKey, "stream", {
    messageId,
    chunk,
    done,
    timestamp: Date.now(),
  });
}
