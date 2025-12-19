// ═══════════════════════════════════════════════════════════════════════════
// Message Service
// CRUD operations for chat messages with audit logging
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import { logAuditEntry } from "@/services/audit";
import type { Prisma } from "@prisma/client";
import type {
  CreateMessageInput,
  MessageListOptions,
  MessageListResult,
  ServiceContext,
} from "./types";
import { generateTitleFromContent, updateConversation } from "./conversation";

// ─────────────────────────────────────────────────────────────
// Create Message
// ─────────────────────────────────────────────────────────────

export async function createMessage(
  input: CreateMessageInput,
  context?: ServiceContext
) {
  // Verify conversation exists and user owns it (if context provided)
  if (context) {
    const conversation = await db.conversation.findFirst({
      where: {
        id: input.conversationId,
        userId: context.userId,
      },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Auto-generate title from first user message if not set
    if (!conversation.title && input.role === "user" && conversation.messages.length === 0) {
      const title = generateTitleFromContent(input.content);
      await updateConversation(
        input.conversationId,
        context.userId,
        { title },
        context
      );
    }
  }

  const message = await db.message.create({
    data: {
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      toolCalls: input.toolCalls as unknown as Prisma.InputJsonValue,
      toolCallId: input.toolCallId,
      metadata: (input.metadata as Prisma.InputJsonValue) ?? {},
    },
  });

  // Update conversation's updatedAt timestamp
  await db.conversation.update({
    where: { id: input.conversationId },
    data: { updatedAt: new Date() },
  });

  // Log audit entry for user messages
  if (context && input.role === "user") {
    await logAuditEntry({
      userId: context.userId,
      sessionId: context.sessionId,
      conversationId: input.conversationId,
      actionType: "create",
      actionCategory: "user",
      entityType: "message",
      entityId: message.id,
      inputSummary: truncateContent(input.content),
    });
  }

  // Log audit entry for assistant messages
  if (context && input.role === "assistant") {
    await logAuditEntry({
      userId: context.userId,
      sessionId: context.sessionId,
      conversationId: input.conversationId,
      actionType: "create",
      actionCategory: "agent",
      entityType: "message",
      entityId: message.id,
      outputSummary: truncateContent(input.content),
      metadata: input.metadata,
    });
  }

  return message;
}

// ─────────────────────────────────────────────────────────────
// List Messages
// ─────────────────────────────────────────────────────────────

export async function listMessages(
  options: MessageListOptions,
  context?: ServiceContext
): Promise<MessageListResult> {
  // Verify user owns the conversation
  if (context) {
    const conversation = await db.conversation.findFirst({
      where: {
        id: options.conversationId,
        userId: context.userId,
      },
    });

    if (!conversation) {
      throw new Error("Conversation not found");
    }
  }

  const limit = options.limit ?? 50;

  // Build where clause for pagination
  const where: Prisma.MessageWhereInput = {
    conversationId: options.conversationId,
  };

  if (options.cursor) {
    where.createdAt = {
      lt: new Date(options.cursor),
    };
  }

  if (options.beforeId) {
    const beforeMessage = await db.message.findUnique({
      where: { id: options.beforeId },
      select: { createdAt: true },
    });
    if (beforeMessage) {
      where.createdAt = {
        lt: beforeMessage.createdAt,
      };
    }
  }

  if (options.afterId) {
    const afterMessage = await db.message.findUnique({
      where: { id: options.afterId },
      select: { createdAt: true },
    });
    if (afterMessage) {
      where.createdAt = {
        gt: afterMessage.createdAt,
      };
    }
  }

  const messages = await db.message.findMany({
    where,
    orderBy: { createdAt: options.afterId ? "asc" : "desc" },
    take: limit + 1,
  });

  const hasMore = messages.length > limit;
  const items = hasMore ? messages.slice(0, -1) : messages;

  // Reverse if fetching in descending order (for proper display order)
  if (!options.afterId) {
    items.reverse();
  }

  const nextCursor = hasMore
    ? items[items.length - 1]?.createdAt.toISOString()
    : undefined;

  return {
    messages: items,
    nextCursor,
    hasMore,
  };
}

// ─────────────────────────────────────────────────────────────
// Get Messages for Context Window
// ─────────────────────────────────────────────────────────────

/**
 * Get the most recent messages for an AI context window.
 * Returns messages in chronological order (oldest first).
 */
export async function getMessagesForContext(
  conversationId: string,
  options?: {
    limit?: number;
    maxTokens?: number; // Future: implement token counting
  }
) {
  const limit = options?.limit ?? 50;

  const messages = await db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      role: true,
      content: true,
      toolCalls: true,
      toolCallId: true,
      createdAt: true,
    },
  });

  // Return in chronological order
  return messages.reverse();
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function truncateContent(content: string, maxLength: number = 200): string {
  if (content.length <= maxLength) {
    return content;
  }
  return content.slice(0, maxLength) + "...";
}

