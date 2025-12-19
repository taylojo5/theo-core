// ═══════════════════════════════════════════════════════════════════════════
// Conversation Service
// CRUD operations for chat conversations with audit logging
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import { logAuditEntry } from "@/services/audit";
import type {
  CreateConversationInput,
  UpdateConversationInput,
  ConversationWithMessages,
  ConversationListOptions,
  ConversationListResult,
  ServiceContext,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Create Conversation
// ─────────────────────────────────────────────────────────────

export async function createConversation(
  input: CreateConversationInput,
  context?: ServiceContext
) {
  const conversation = await db.conversation.create({
    data: {
      userId: input.userId,
      title: input.title,
    },
  });

  // Log audit entry
  if (context) {
    await logAuditEntry({
      userId: context.userId,
      sessionId: context.sessionId,
      conversationId: conversation.id,
      actionType: "create",
      actionCategory: "user",
      entityType: "conversation",
      entityId: conversation.id,
      outputSummary: `Created conversation: ${conversation.title || "New conversation"}`,
    });
  }

  return conversation;
}

// ─────────────────────────────────────────────────────────────
// Get Conversation by ID
// ─────────────────────────────────────────────────────────────

export async function getConversation(
  id: string,
  userId: string,
  options?: { includeMessages?: boolean; messageLimit?: number }
): Promise<ConversationWithMessages | null> {
  const conversation = await db.conversation.findFirst({
    where: {
      id,
      userId, // Ensure user owns this conversation
    },
    include: options?.includeMessages
      ? {
          messages: {
            orderBy: { createdAt: "asc" },
            take: options.messageLimit,
          },
        }
      : undefined,
  });

  if (!conversation) {
    return null;
  }

  // Return with empty messages array if not included
  return {
    ...conversation,
    messages: (conversation as ConversationWithMessages).messages ?? [],
  };
}

// ─────────────────────────────────────────────────────────────
// List Conversations
// ─────────────────────────────────────────────────────────────

export async function listConversations(
  options: ConversationListOptions
): Promise<ConversationListResult> {
  const limit = options.limit ?? 20;

  const conversations = await db.conversation.findMany({
    where: {
      userId: options.userId,
      ...(options.cursor
        ? {
            updatedAt: {
              lt: new Date(options.cursor),
            },
          }
        : {}),
    },
    include: options.includeMessages
      ? {
          messages: {
            orderBy: { createdAt: "desc" },
            take: options.messageLimit ?? 1, // Get last message for preview
          },
        }
      : undefined,
    orderBy: { updatedAt: "desc" },
    take: limit + 1, // Fetch one extra to check if there are more
  });

  const hasMore = conversations.length > limit;
  const items = hasMore ? conversations.slice(0, -1) : conversations;
  const nextCursor = hasMore
    ? items[items.length - 1]?.updatedAt.toISOString()
    : undefined;

  return {
    conversations: items,
    nextCursor,
    hasMore,
  };
}

// ─────────────────────────────────────────────────────────────
// Update Conversation
// ─────────────────────────────────────────────────────────────

export async function updateConversation(
  id: string,
  userId: string,
  input: UpdateConversationInput,
  context?: ServiceContext
) {
  // Ensure conversation exists and user owns it
  const existing = await db.conversation.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    throw new Error("Conversation not found");
  }

  const conversation = await db.conversation.update({
    where: { id },
    data: {
      title: input.title,
      summary: input.summary,
    },
  });

  // Log audit entry
  if (context) {
    await logAuditEntry({
      userId: context.userId,
      sessionId: context.sessionId,
      conversationId: id,
      actionType: "update",
      actionCategory: "user",
      entityType: "conversation",
      entityId: id,
      outputSummary: `Updated conversation: ${input.title ?? input.summary ?? "changes"}`,
    });
  }

  return conversation;
}

// ─────────────────────────────────────────────────────────────
// Delete Conversation
// ─────────────────────────────────────────────────────────────

export async function deleteConversation(
  id: string,
  userId: string,
  context?: ServiceContext
) {
  // Ensure conversation exists and user owns it
  const existing = await db.conversation.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    throw new Error("Conversation not found");
  }

  // Messages will be cascade deleted via FK constraint
  await db.conversation.delete({
    where: { id },
  });

  // Log audit entry
  if (context) {
    await logAuditEntry({
      userId: context.userId,
      sessionId: context.sessionId,
      actionType: "delete",
      actionCategory: "user",
      entityType: "conversation",
      entityId: id,
      outputSummary: `Deleted conversation: ${existing.title || id}`,
    });
  }

  return { success: true };
}

// ─────────────────────────────────────────────────────────────
// Generate Conversation Title
// ─────────────────────────────────────────────────────────────

/**
 * Generate a title from the first user message if no title is set.
 * This is a simple implementation - can be enhanced with LLM later.
 */
export function generateTitleFromContent(content: string): string {
  // Clean up the content
  const cleaned = content
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);

  // If content is short enough, use it directly
  if (cleaned.length <= 50) {
    return cleaned;
  }

  // Otherwise, truncate at word boundary
  const truncated = cleaned.slice(0, 50);
  const lastSpace = truncated.lastIndexOf(" ");
  return lastSpace > 20 ? truncated.slice(0, lastSpace) + "..." : truncated + "...";
}

