# Chat Services Documentation

> **Status**: Complete  
> **Last Updated**: December 2024  
> **Related**: [API_REFERENCE.md](../API_REFERENCE.md), [SSE_STREAMING.md](../SSE_STREAMING.md)

---

## Overview

Chat Services manage conversations and messages in Theo. They provide CRUD operations with audit logging, automatic title generation, and support for streaming responses.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     CHAT ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    CONVERSATION                          │    │
│  │                                                          │    │
│  │  ┌────────────────────────────────────────────────┐     │    │
│  │  │ Messages (ordered by createdAt)                 │     │    │
│  │  │                                                 │     │    │
│  │  │  [system] System prompt                        │     │    │
│  │  │  [user] User message                           │     │    │
│  │  │  [assistant] AI response                       │     │    │
│  │  │  [tool] Tool call result                       │     │    │
│  │  │  ...                                           │     │    │
│  │  └────────────────────────────────────────────────┘     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  SERVICES                                                        │
│  ┌──────────────────────┐  ┌──────────────────────┐            │
│  │ Conversation Service │  │   Message Service    │            │
│  │                      │  │                      │            │
│  │ • Create/List/Update │  │ • Create/List       │            │
│  │ • Delete (cascade)   │  │ • Context Window    │            │
│  │ • Title Generation   │  │ • Pagination        │            │
│  └──────────────────────┘  └──────────────────────┘            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

```typescript
import {
  createConversation,
  listConversations,
  getConversation,
  deleteConversation,
  createMessage,
  listMessages,
  getMessagesForContext,
} from "@/services/chat";

// Create a conversation
const conversation = await createConversation(
  { userId: "user-123", title: "Project Discussion" },
  { userId: "user-123" }
);

// Add messages
await createMessage(
  {
    conversationId: conversation.id,
    role: "user",
    content: "Hello, Theo!",
  },
  { userId: "user-123" }
);

await createMessage(
  {
    conversationId: conversation.id,
    role: "assistant",
    content: "Hello! How can I help you today?",
  },
  { userId: "user-123" }
);

// Get messages for AI context
const messages = await getMessagesForContext(conversation.id, { limit: 50 });
```

---

## Conversation Service

### Create Conversation

```typescript
const conversation = await createConversation(
  {
    userId: "user-123",
    title: "Optional title",
  },
  { userId: "user-123", sessionId: "session-456" }
);
```

**Input:**

```typescript
interface CreateConversationInput {
  userId: string;
  title?: string;
}
```

**Response:**

```typescript
{
  id: string;
  userId: string;
  title: string | null;
  summary: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### Get Conversation

```typescript
const conversation = await getConversation(conversationId, userId, {
  includeMessages: true,
  messageLimit: 50,
});
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `includeMessages` | boolean | false | Include messages |
| `messageLimit` | number | - | Limit messages returned |

### List Conversations

```typescript
const result = await listConversations({
  userId: "user-123",
  limit: 20,
  cursor: "cursor-from-previous",
  includeMessages: true,
  messageLimit: 1, // For preview
});
```

**Options:**

```typescript
interface ConversationListOptions {
  userId: string;
  limit?: number; // Default: 20, max: 100
  cursor?: string; // Pagination cursor
  includeMessages?: boolean;
  messageLimit?: number; // Default: 1 for preview
}
```

**Response:**

```typescript
{
  conversations: Conversation[];
  nextCursor?: string;
  hasMore: boolean;
}
```

### Update Conversation

```typescript
await updateConversation(
  conversationId,
  userId,
  { title: "New Title", summary: "Updated summary" },
  context
);
```

### Delete Conversation

Deletes conversation and all its messages (cascade):

```typescript
await deleteConversation(conversationId, userId, context);
// Returns: { success: true }
```

### Auto-Title Generation

Titles are auto-generated from the first user message:

```typescript
const title = generateTitleFromContent("Hello, can you help me plan my week?");
// "Hello, can you help me plan my week?"  (if <= 50 chars)
// "Hello, can you help me plan..."        (if > 50 chars)
```

---

## Message Service

### Create Message

```typescript
const message = await createMessage(
  {
    conversationId: "conv-123",
    role: "user",
    content: "What's on my calendar today?",
  },
  { userId: "user-123" }
);
```

**Input:**

```typescript
interface CreateMessageInput {
  conversationId: string;
  role: MessageRole; // "user" | "assistant" | "system" | "tool"
  content: string;
  toolCalls?: ToolCallData[];
  toolCallId?: string; // For tool response messages
  metadata?: MessageMetadata;
}
```

**Tool Calls:**

```typescript
interface ToolCallData {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}
```

**Metadata:**

```typescript
interface MessageMetadata {
  model?: string; // e.g., "gpt-4"
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  latencyMs?: number;
  [key: string]: unknown;
}
```

### List Messages

```typescript
const result = await listMessages(
  {
    conversationId: "conv-123",
    limit: 50,
    beforeId: "msg-xyz", // For older messages
    // or
    afterId: "msg-abc", // For newer messages
  },
  { userId: "user-123" }
);
```

**Options:**

```typescript
interface MessageListOptions {
  conversationId: string;
  limit?: number; // Default: 50
  cursor?: string; // Pagination cursor
  beforeId?: string; // Get messages before this ID
  afterId?: string; // Get messages after this ID
}
```

**Response:**

```typescript
{
  messages: Message[];
  nextCursor?: string;
  hasMore: boolean;
}
```

### Get Messages for AI Context

Get recent messages in chronological order for LLM context:

```typescript
const messages = await getMessagesForContext(conversationId, {
  limit: 50, // Most recent N messages
});

// Returns: Message[] in chronological order (oldest first)
```

---

## Message Roles

| Role        | Description         | Example                              |
| ----------- | ------------------- | ------------------------------------ |
| `system`    | System instructions | "You are Theo, a helpful assistant." |
| `user`      | User input          | "What's on my calendar?"             |
| `assistant` | AI response         | "Here are your events for today..."  |
| `tool`      | Tool call result    | Result from function call            |

### Tool Call Flow

```typescript
// 1. Assistant requests tool call
await createMessage({
  conversationId,
  role: "assistant",
  content: "", // Can be empty
  toolCalls: [
    {
      id: "call_123",
      name: "get_calendar",
      arguments: { date: "2024-12-20" },
    },
  ],
});

// 2. Tool returns result
await createMessage({
  conversationId,
  role: "tool",
  content: JSON.stringify(calendarEvents),
  toolCallId: "call_123",
});

// 3. Assistant provides final response
await createMessage({
  conversationId,
  role: "assistant",
  content: "You have 3 meetings today...",
});
```

---

## Audit Logging

All message creation is automatically logged:

**User Messages:**

```typescript
{
  actionType: "create",
  actionCategory: "user",
  entityType: "message",
  inputSummary: "First 200 chars of message...",
}
```

**Assistant Messages:**

```typescript
{
  actionType: "create",
  actionCategory: "agent",
  entityType: "message",
  outputSummary: "First 200 chars of response...",
  metadata: { model, tokens, latency },
}
```

---

## Streaming Support

For real-time streaming, use SSE:

```typescript
// Server: Create SSE stream
import { createSSEStream, sseResponse } from "@/lib/sse";

export async function GET() {
  const { stream, send, close } = createSSEStream();

  // Send chunks as they arrive
  for await (const chunk of llmStream) {
    send({ event: "chunk", data: { content: chunk } });
  }

  send({ event: "done", data: {} });
  close();

  return sseResponse(stream);
}
```

See [SSE_STREAMING.md](../SSE_STREAMING.md) for details.

---

## Error Handling

### Conversation Not Found

```typescript
try {
  await getConversation(id, userId);
} catch (error) {
  if (error.message === "Conversation not found") {
    // Handle missing conversation
  }
}
```

### Ownership Verification

All operations verify the user owns the conversation:

```typescript
const conversation = await db.conversation.findFirst({
  where: {
    id: conversationId,
    userId: context.userId, // Must match
  },
});

if (!conversation) {
  throw new Error("Conversation not found");
}
```

---

## API Endpoints

| Method | Endpoint                                | Description         |
| ------ | --------------------------------------- | ------------------- |
| POST   | `/api/chat/conversations`               | Create conversation |
| GET    | `/api/chat/conversations`               | List conversations  |
| GET    | `/api/chat/conversations/[id]`          | Get conversation    |
| PATCH  | `/api/chat/conversations/[id]`          | Update conversation |
| DELETE | `/api/chat/conversations/[id]`          | Delete conversation |
| POST   | `/api/chat/conversations/[id]/messages` | Add message         |
| GET    | `/api/chat/conversations/[id]/messages` | List messages       |
| GET    | `/api/chat/conversations/[id]/stream`   | SSE stream          |

See [API_REFERENCE.md](../API_REFERENCE.md) for full details.

---

## Best Practices

### 1. Always Pass Context

```typescript
// ✅ Good - enables audit logging
await createMessage(input, { userId: session.user.id });

// ❌ Missing context - no audit trail
await createMessage(input);
```

### 2. Include System Message

```typescript
// First message in conversation
await createMessage({
  conversationId,
  role: "system",
  content: "You are Theo, a thoughtful personal assistant...",
});
```

### 3. Store AI Metadata

```typescript
await createMessage({
  conversationId,
  role: "assistant",
  content: response.content,
  metadata: {
    model: "gpt-4",
    tokens: {
      prompt: response.usage.prompt_tokens,
      completion: response.usage.completion_tokens,
      total: response.usage.total_tokens,
    },
    latencyMs: Date.now() - startTime,
  },
});
```

### 4. Handle Long Conversations

```typescript
// Get only recent messages for context window
const messages = await getMessagesForContext(conversationId, {
  limit: 50,
  // Future: maxTokens for token-aware truncation
});
```

---

## Testing

### Mocking Chat Services

```typescript
import { vi } from "vitest";
import * as chatService from "@/services/chat";

vi.mock("@/services/chat", () => ({
  createConversation: vi.fn().mockResolvedValue({
    id: "test-conv",
    userId: "test-user",
    title: null,
  }),
  createMessage: vi.fn().mockResolvedValue({
    id: "test-msg",
    role: "user",
    content: "Test message",
  }),
}));
```

### Integration Tests

```typescript
describe("Chat Services", () => {
  it("should create conversation with auto-title", async () => {
    const conv = await createConversation({ userId: testUserId });

    await createMessage(
      {
        conversationId: conv.id,
        role: "user",
        content: "Help me plan my vacation",
      },
      { userId: testUserId }
    );

    const updated = await getConversation(conv.id, testUserId);
    expect(updated.title).toBe("Help me plan my vacation");
  });
});
```

---

## Related Documentation

- [API_REFERENCE.md](../API_REFERENCE.md) - Chat API endpoints
- [SSE_STREAMING.md](../SSE_STREAMING.md) - Real-time streaming
- [AUDIT_SERVICE.md](./AUDIT_SERVICE.md) - Audit logging
- [DATA_LAYER.md](../DATA_LAYER.md) - Database models
