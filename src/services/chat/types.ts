// ═══════════════════════════════════════════════════════════════════════════
// Chat Service Types
// ═══════════════════════════════════════════════════════════════════════════

import type { Conversation, Message } from "@prisma/client";

// ─────────────────────────────────────────────────────────────
// Message Types
// ─────────────────────────────────────────────────────────────

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface ToolCallData {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface MessageMetadata {
  model?: string;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  latencyMs?: number;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────
// Conversation DTOs
// ─────────────────────────────────────────────────────────────

export interface CreateConversationInput {
  userId: string;
  title?: string;
}

export interface UpdateConversationInput {
  title?: string;
  summary?: string;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

export interface ConversationListOptions {
  userId: string;
  limit?: number;
  cursor?: string;
  includeMessages?: boolean;
  messageLimit?: number;
}

export interface ConversationListResult {
  conversations: Conversation[];
  nextCursor?: string;
  hasMore: boolean;
}

// ─────────────────────────────────────────────────────────────
// Message DTOs
// ─────────────────────────────────────────────────────────────

export interface CreateMessageInput {
  conversationId: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCallData[];
  toolCallId?: string;
  metadata?: MessageMetadata;
}

export interface MessageListOptions {
  conversationId: string;
  limit?: number;
  cursor?: string;
  beforeId?: string;
  afterId?: string;
}

export interface MessageListResult {
  messages: Message[];
  nextCursor?: string;
  hasMore: boolean;
}

// ─────────────────────────────────────────────────────────────
// Service Context (for audit logging)
// ─────────────────────────────────────────────────────────────

export interface ServiceContext {
  userId: string;
  sessionId?: string;
}
