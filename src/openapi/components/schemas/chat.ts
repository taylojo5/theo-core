// ═══════════════════════════════════════════════════════════════════════════
// Chat OpenAPI Schemas
// Schema definitions for conversations and messages
// ═══════════════════════════════════════════════════════════════════════════

import { z, BaseEntitySchema, MetadataSchema, createPaginatedSchema } from "./common";

// ─────────────────────────────────────────────────────────────
// Conversation Schemas
// ─────────────────────────────────────────────────────────────

export const ConversationCreateSchema = z
  .object({
    title: z.string().max(255).optional().openapi({
      description: "Conversation title (auto-generated if not provided)",
      example: "Help with quarterly report",
    }),
  })
  .openapi("ConversationCreate");

export const ConversationUpdateSchema = z
  .object({
    title: z.string().max(255).optional(),
    summary: z.string().optional().openapi({
      description: "AI-generated conversation summary",
    }),
  })
  .openapi("ConversationUpdate");

export const ConversationSchema = BaseEntitySchema.extend({
  userId: z.string(),
  title: z.string().nullable(),
  summary: z.string().nullable(),
  messageCount: z.number().openapi({
    description: "Total number of messages in this conversation",
  }),
  lastMessageAt: z.string().datetime().nullable().openapi({
    description: "Timestamp of the last message",
  }),
}).openapi("Conversation");

export const ConversationListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().optional(),
    includeMessages: z
      .string()
      .optional()
      .transform((val) => val === "true")
      .openapi({
        description: "Include recent messages in response",
      }),
    messageLimit: z.coerce.number().int().min(1).max(10).default(1).openapi({
      description: "Number of recent messages to include (if includeMessages=true)",
    }),
  })
  .openapi("ConversationListQuery");

export const PaginatedConversationsSchema = createPaginatedSchema(
  ConversationSchema,
  "Conversations"
);

// ─────────────────────────────────────────────────────────────
// Message Schemas
// ─────────────────────────────────────────────────────────────

export const MessageCreateSchema = z
  .object({
    content: z.string().min(1).openapi({
      description: "Message content",
      example: "Can you help me draft an email to John about the project update?",
    }),
    role: z.enum(["user", "assistant", "system", "tool"]).default("user").openapi({
      description: "Message role",
    }),
    toolCalls: z.array(z.unknown()).optional().openapi({
      description: "Tool calls made by the assistant",
    }),
    toolCallId: z.string().optional().openapi({
      description: "ID of the tool call this message responds to",
    }),
    metadata: MetadataSchema.default({}),
  })
  .openapi("MessageCreate");

export const MessageSchema = BaseEntitySchema.extend({
  conversationId: z.string(),
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string(),
  toolCalls: z.array(z.unknown()).nullable(),
  toolCallId: z.string().nullable(),
  metadata: MetadataSchema,
}).openapi("Message");

export const MessageListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(500).default(100),
    cursor: z.string().optional(),
    direction: z.enum(["asc", "desc"]).default("asc").openapi({
      description: "Sort direction by creation time",
    }),
  })
  .openapi("MessageListQuery");

export const PaginatedMessagesSchema = createPaginatedSchema(MessageSchema, "Messages");

// ─────────────────────────────────────────────────────────────
// Conversation with Messages (detailed view)
// ─────────────────────────────────────────────────────────────

export const ConversationWithMessagesSchema = ConversationSchema.extend({
  messages: z.array(MessageSchema).openapi({
    description: "Messages in this conversation",
  }),
}).openapi("ConversationWithMessages");

