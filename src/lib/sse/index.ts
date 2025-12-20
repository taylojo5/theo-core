// ═══════════════════════════════════════════════════════════════════════════
// Server-Sent Events (SSE) Utilities
// Functions for creating and managing SSE streams
// ═══════════════════════════════════════════════════════════════════════════

export interface SSEMessage {
  event?: string;
  data: unknown;
  id?: string;
  retry?: number;
}

export interface SSEStream {
  stream: ReadableStream<Uint8Array>;
  send: (message: SSEMessage) => void;
  close: () => void;
}

/**
 * Create an SSE stream for sending real-time updates
 */
export function createSSEStream(): SSEStream {
  let controller: ReadableStreamDefaultController<Uint8Array>;
  let isClosed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      isClosed = true;
    },
  });

  const encoder = new TextEncoder();

  function send(message: SSEMessage): void {
    if (isClosed) return;

    let text = "";

    if (message.event) {
      text += `event: ${message.event}\n`;
    }
    if (message.id) {
      text += `id: ${message.id}\n`;
    }
    if (message.retry !== undefined) {
      text += `retry: ${message.retry}\n`;
    }

    text += `data: ${JSON.stringify(message.data)}\n\n`;

    try {
      controller.enqueue(encoder.encode(text));
    } catch {
      // Stream closed
      isClosed = true;
    }
  }

  function close(): void {
    if (isClosed) return;

    try {
      controller.close();
    } catch {
      // Already closed
    }
    isClosed = true;
  }

  return { stream, send, close };
}

/**
 * Create an SSE Response with proper headers
 */
export function sseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable buffering in nginx
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Connection Manager
// Manages active SSE connections for broadcasting
// ─────────────────────────────────────────────────────────────

type SendFunction = (message: SSEMessage) => void;

const connections = new Map<string, Set<SendFunction>>();

/**
 * Register an SSE connection
 */
export function registerConnection(key: string, send: SendFunction): void {
  if (!connections.has(key)) {
    connections.set(key, new Set());
  }
  connections.get(key)!.add(send);
}

/**
 * Unregister an SSE connection
 */
export function unregisterConnection(key: string, send: SendFunction): void {
  const senders = connections.get(key);
  if (senders) {
    senders.delete(send);
    if (senders.size === 0) {
      connections.delete(key);
    }
  }
}

/**
 * Broadcast a message to all connections with a given key
 */
export function broadcast(key: string, event: string, data: unknown): void {
  const senders = connections.get(key);
  if (senders) {
    const message: SSEMessage = { event, data };
    for (const send of senders) {
      try {
        send(message);
      } catch {
        // Connection closed, will be cleaned up by the connection handler
      }
    }
  }
}

/**
 * Get the number of active connections for a key
 */
export function getConnectionCount(key: string): number {
  return connections.get(key)?.size ?? 0;
}

/**
 * Get all connection keys (for debugging/admin)
 */
export function getConnectionKeys(): string[] {
  return Array.from(connections.keys());
}
