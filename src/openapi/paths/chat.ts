// ═══════════════════════════════════════════════════════════════════════════
// Chat API Path Definitions
// ═══════════════════════════════════════════════════════════════════════════

import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "../components/schemas/common";
import {
  ConversationSchema,
  ConversationCreateSchema,
  ConversationUpdateSchema,
  ConversationListQuerySchema,
  ConversationWithMessagesSchema,
  PaginatedConversationsSchema,
  MessageSchema,
  MessageCreateSchema,
  MessageListQuerySchema,
  PaginatedMessagesSchema,
  DeleteSuccessSchema,
  rateLimitHeaders,
} from "../components";
import { protectedEndpoint } from "../components/security";

export function registerChatPaths(registry: OpenAPIRegistry) {
  // ─────────────────────────────────────────────────────────────
  // Conversations
  // ─────────────────────────────────────────────────────────────

  // GET /api/chat/conversations
  registry.registerPath({
    method: "get",
    path: "/api/chat/conversations",
    tags: ["Chat"],
    summary: "List conversations",
    description: "Retrieve a paginated list of conversations. Optionally include recent messages.",
    security: protectedEndpoint,
    request: { query: ConversationListQuerySchema },
    responses: {
      200: {
        description: "List of conversations",
        headers: rateLimitHeaders,
        content: { "application/json": { schema: PaginatedConversationsSchema } },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
    },
  });

  // POST /api/chat/conversations
  registry.registerPath({
    method: "post",
    path: "/api/chat/conversations",
    tags: ["Chat"],
    summary: "Create conversation",
    description: "Start a new conversation. Title is auto-generated if not provided.",
    security: protectedEndpoint,
    request: {
      body: { required: false, content: { "application/json": { schema: ConversationCreateSchema } } },
    },
    responses: {
      201: {
        description: "Conversation created",
        content: { "application/json": { schema: ConversationSchema } },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
    },
  });

  // GET /api/chat/conversations/{id}
  registry.registerPath({
    method: "get",
    path: "/api/chat/conversations/{id}",
    tags: ["Chat"],
    summary: "Get conversation",
    description: "Get a conversation with its messages.",
    security: protectedEndpoint,
    request: {
      params: z.object({ id: z.string() }),
      query: z.object({
        includeMessages: z.string().optional().openapi({ description: "Include messages (default: true)" }),
        messageLimit: z.coerce.number().optional().openapi({ description: "Max messages to include" }),
      }),
    },
    responses: {
      200: {
        description: "Conversation with messages",
        content: { "application/json": { schema: ConversationWithMessagesSchema } },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
    },
  });

  // PATCH /api/chat/conversations/{id}
  registry.registerPath({
    method: "patch",
    path: "/api/chat/conversations/{id}",
    tags: ["Chat"],
    summary: "Update conversation",
    description: "Update conversation title or summary.",
    security: protectedEndpoint,
    request: {
      params: z.object({ id: z.string() }),
      body: { required: true, content: { "application/json": { schema: ConversationUpdateSchema } } },
    },
    responses: {
      200: { description: "Conversation updated", content: { "application/json": { schema: ConversationSchema } } },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
    },
  });

  // DELETE /api/chat/conversations/{id}
  registry.registerPath({
    method: "delete",
    path: "/api/chat/conversations/{id}",
    tags: ["Chat"],
    summary: "Delete conversation",
    description: "Delete a conversation and all its messages.",
    security: protectedEndpoint,
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: { description: "Conversation deleted", content: { "application/json": { schema: DeleteSuccessSchema } } },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
    },
  });

  // ─────────────────────────────────────────────────────────────
  // Messages
  // ─────────────────────────────────────────────────────────────

  // GET /api/chat/conversations/{id}/messages
  registry.registerPath({
    method: "get",
    path: "/api/chat/conversations/{id}/messages",
    tags: ["Chat"],
    summary: "List messages",
    description: "Get messages in a conversation with pagination.",
    security: protectedEndpoint,
    request: {
      params: z.object({ id: z.string().openapi({ description: "Conversation ID" }) }),
      query: MessageListQuerySchema,
    },
    responses: {
      200: {
        description: "List of messages",
        content: { "application/json": { schema: PaginatedMessagesSchema } },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
    },
  });

  // POST /api/chat/conversations/{id}/messages
  registry.registerPath({
    method: "post",
    path: "/api/chat/conversations/{id}/messages",
    tags: ["Chat"],
    summary: "Send message",
    description: "Send a message in a conversation. The AI assistant will respond automatically.",
    security: protectedEndpoint,
    request: {
      params: z.object({ id: z.string() }),
      body: { required: true, content: { "application/json": { schema: MessageCreateSchema } } },
    },
    responses: {
      201: {
        description: "Message sent",
        content: { "application/json": { schema: MessageSchema } },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
    },
  });

  // GET /api/chat/conversations/{id}/stream
  registry.registerPath({
    method: "get",
    path: "/api/chat/conversations/{id}/stream",
    tags: ["Chat"],
    summary: "Subscribe to conversation (SSE)",
    description: `
Subscribe to real-time updates for a conversation using Server-Sent Events.

**Event Types:**
- \`connected\` - Initial connection established
- \`message\` - New message added
- \`typing\` - Assistant is typing
- \`status\` - Processing status update
- \`stream\` - Streaming response chunk
- \`ping\` - Keep-alive (every 30s)
    `.trim(),
    security: protectedEndpoint,
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: "SSE stream established",
        content: {
          "text/event-stream": {
            schema: z.object({
              event: z.string(),
              data: z.unknown(),
            }),
          },
        },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
    },
  });
}

