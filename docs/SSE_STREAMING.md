# SSE & Streaming Documentation

> **Status**: Complete  
> **Last Updated**: December 2024  
> **Related**: [services/CHAT_SERVICES.md](./services/CHAT_SERVICES.md), [API_REFERENCE.md](./API_REFERENCE.md)

---

## Overview

Theo uses **Server-Sent Events (SSE)** for real-time streaming of AI responses and updates. This provides a better user experience than waiting for complete responses.

---

## Quick Start

### Server

```typescript
import { createSSEStream, sseResponse } from "@/lib/sse";

export async function GET() {
  const { stream, send, close } = createSSEStream();

  // Send events
  send({ event: "message", data: { content: "Hello!" } });
  send({ event: "done", data: {} });
  close();

  return sseResponse(stream);
}
```

### Client

```typescript
import { useEventSource } from "@/hooks/use-event-source";

function ChatMessage() {
  const { data, error, isConnected } = useEventSource(
    "/api/chat/conversations/123/stream"
  );

  return <div>{data?.content}</div>;
}
```

---

## SSE Message Format

### Message Structure

```typescript
interface SSEMessage {
  event?: string; // Event type (e.g., "message", "done")
  data: unknown; // JSON-serializable data
  id?: string; // Optional message ID
  retry?: number; // Optional retry interval (ms)
}
```

### Wire Format

```
event: message
id: 1
data: {"content":"Hello, world!"}

event: done
data: {}

```

---

## Server-Side API

### Create SSE Stream

```typescript
import { createSSEStream, sseResponse } from "@/lib/sse";

export async function GET() {
  const { stream, send, close } = createSSEStream();

  // The stream is a ReadableStream<Uint8Array>
  // send() queues messages to the stream
  // close() ends the stream

  return sseResponse(stream);
}
```

### Send Messages

```typescript
// Simple data
send({ data: { status: "processing" } });

// With event type
send({ event: "progress", data: { percent: 50 } });

// With ID (for Last-Event-ID reconnection)
send({ event: "chunk", data: { text: "Hello" }, id: "msg-1" });

// Set retry interval
send({ retry: 3000 }); // Reconnect after 3s on disconnect
```

### Close Stream

```typescript
close(); // Ends the stream gracefully
```

---

## Connection Manager

For broadcasting to multiple clients:

### Register Connection

```typescript
import { registerConnection, unregisterConnection } from "@/lib/sse";

const key = `user:${userId}`;
registerConnection(key, send);

// Later...
unregisterConnection(key, send);
```

### Broadcast

```typescript
import { broadcast } from "@/lib/sse";

// Send to all connections with this key
broadcast(`user:${userId}`, "notification", {
  message: "New message received",
});
```

### Get Connection Info

```typescript
import { getConnectionCount, getConnectionKeys } from "@/lib/sse";

const count = getConnectionCount(`user:${userId}`);
const allKeys = getConnectionKeys(); // For debugging
```

---

## Client-Side Hook

### useEventSource

```typescript
import { useEventSource } from "@/hooks/use-event-source";

function Component() {
  const {
    data,           // Latest received data
    error,          // Error if any
    isConnected,    // Connection status
    close,          // Manual close function
  } = useEventSource("/api/stream", {
    onMessage: (event) => {
      console.log("Received:", event.data);
    },
    onError: (error) => {
      console.error("SSE Error:", error);
    },
  });

  return (
    <div>
      {isConnected ? "Connected" : "Disconnected"}
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}
```

### Options

```typescript
interface UseEventSourceOptions {
  onMessage?: (event: MessageEvent) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  onClose?: () => void;
  withCredentials?: boolean; // Send cookies
}
```

---

## Chat Streaming Example

### Server

```typescript
// /api/chat/conversations/[id]/stream/route.ts
import { createSSEStream, sseResponse } from "@/lib/sse";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { stream, send, close } = createSSEStream();

  // Start async processing
  (async () => {
    try {
      // Get conversation
      const messages = await getMessagesForContext(params.id);

      // Stream LLM response
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
      });

      for await (const chunk of completion) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          send({ event: "chunk", data: { content } });
        }
      }

      send({ event: "done", data: {} });
    } catch (error) {
      send({ event: "error", data: { message: error.message } });
    } finally {
      close();
    }
  })();

  return sseResponse(stream);
}
```

### Client

```typescript
function ChatStream({ conversationId }: { conversationId: string }) {
  const [content, setContent] = useState("");

  useEventSource(`/api/chat/conversations/${conversationId}/stream`, {
    onMessage: (event) => {
      const data = JSON.parse(event.data);

      if (event.type === "chunk") {
        setContent(prev => prev + data.content);
      } else if (event.type === "done") {
        // Stream complete
      } else if (event.type === "error") {
        console.error(data.message);
      }
    },
  });

  return <div>{content}</div>;
}
```

---

## Response Headers

SSE responses include specific headers:

```typescript
export function sseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
```

---

## Event Types

### Common Events

| Event      | Description      |
| ---------- | ---------------- |
| `chunk`    | Partial content  |
| `message`  | Complete message |
| `typing`   | Typing indicator |
| `done`     | Stream complete  |
| `error`    | Error occurred   |
| `progress` | Progress update  |

### Example Flow

```
event: typing
data: {"isTyping": true}

event: chunk
data: {"content": "Hello, "}

event: chunk
data: {"content": "how can I help?"}

event: message
data: {"id": "msg-123", "role": "assistant", "content": "Hello, how can I help?"}

event: done
data: {}
```

---

## Error Handling

### Server-Side

```typescript
const { stream, send, close } = createSSEStream();

(async () => {
  try {
    // ... processing
  } catch (error) {
    send({
      event: "error",
      data: {
        code: "PROCESSING_ERROR",
        message: error.message,
      },
    });
  } finally {
    close();
  }
})();
```

### Client-Side

```typescript
useEventSource(url, {
  onError: (error) => {
    // Handle connection error
    setError("Connection lost. Reconnecting...");
  },
  onMessage: (event) => {
    if (event.type === "error") {
      const data = JSON.parse(event.data);
      setError(data.message);
    }
  },
});
```

---

## Reconnection

EventSource automatically reconnects on disconnect:

```typescript
// Server: Set retry interval
send({ retry: 3000 }); // 3 seconds

// Server: Set message IDs for recovery
send({ event: "chunk", data: { ... }, id: "123" });

// Client: Browser sends Last-Event-ID header on reconnect
```

---

## Best Practices

### 1. Clean Up Connections

```typescript
export async function GET() {
  const { stream, send, close } = createSSEStream();

  // Stream cleanup on client disconnect
  const reader = stream.getReader();
  request.signal.addEventListener("abort", () => {
    close();
  });

  // ...
}
```

### 2. Handle Backpressure

```typescript
// Don't queue too many messages
try {
  send({ event: "chunk", data: chunk });
} catch {
  // Stream closed
}
```

### 3. Send Heartbeats

```typescript
// Prevent connection timeout
const heartbeat = setInterval(() => {
  send({ event: "heartbeat", data: {} });
}, 30000);

// Clean up on close
```

### 4. Validate Authentication

```typescript
export async function GET() {
  const session = await auth();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Continue with authenticated stream...
}
```

---

## Testing

### Mock SSE Stream

```typescript
import { vi } from "vitest";

const mockSend = vi.fn();
const mockClose = vi.fn();

vi.mock("@/lib/sse", () => ({
  createSSEStream: () => ({
    stream: new ReadableStream(),
    send: mockSend,
    close: mockClose,
  }),
  sseResponse: (stream) => new Response(stream),
}));
```

---

## Related Documentation

- [services/CHAT_SERVICES.md](./services/CHAT_SERVICES.md) - Chat streaming
- [API_REFERENCE.md](./API_REFERENCE.md) - Stream endpoints
- [AGENTIC_FRAMEWORK.md](./AGENTIC_FRAMEWORK.md) - Agent streaming
