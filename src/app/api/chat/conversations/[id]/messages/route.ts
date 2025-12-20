// ═══════════════════════════════════════════════════════════════════════════
// Conversation Messages API
// POST /api/chat/conversations/[id]/messages - Create a new message
// GET /api/chat/conversations/[id]/messages - List messages with pagination
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";
import { createMessage, listMessages, type MessageRole } from "@/services/chat";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─────────────────────────────────────────────────────────────
// POST - Create Message (with assistant response)
// ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Apply rate limiting (chat limits - 20/min due to LLM cost)
    const {
      response: rateLimitResponse,
      userId,
      headers,
    } = await applyRateLimit(request, RATE_LIMITS.chat);

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: conversationId } = await params;

    // Parse request body
    const body = await request.json();
    const { content, role = "user", toolCalls, toolCallId, metadata } = body;

    // Validate input
    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles: MessageRole[] = ["user", "assistant", "system", "tool"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(", ")}` },
        { status: 400 }
      );
    }

    // Create user message
    const userMessage = await createMessage(
      {
        conversationId,
        role,
        content,
        toolCalls,
        toolCallId,
        metadata,
      },
      { userId }
    );

    // For user messages, generate an assistant response
    // TODO: Replace with actual AI agent call
    let assistantMessage = null;
    if (role === "user") {
      // Placeholder response - will be replaced with LLM integration
      const assistantContent = generatePlaceholderResponse(content);

      assistantMessage = await createMessage(
        {
          conversationId,
          role: "assistant",
          content: assistantContent,
          metadata: {
            model: "placeholder",
            note: "Replace with actual LLM response",
          },
        },
        { userId }
      );
    }

    // Get updated conversation (for title)
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, title: true, updatedAt: true },
    });

    return NextResponse.json(
      {
        userMessage,
        assistantMessage,
        conversation,
      },
      { status: 201, headers }
    );
  } catch (error) {
    console.error("Error creating message:", error);

    if (error instanceof Error && error.message === "Conversation not found") {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create message" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Placeholder Response Generator
// TODO: Replace with actual AI agent
// ─────────────────────────────────────────────────────────────

function generatePlaceholderResponse(userMessage: string): string {
  const lowered = userMessage.toLowerCase();

  // Simple pattern matching for demo purposes
  if (
    lowered.includes("hello") ||
    lowered.includes("hi ") ||
    lowered === "hi"
  ) {
    return "Hello! I'm Theo, your personal AI assistant. I can help you manage your schedule, remember important details about people and places, and keep track of your tasks. What can I help you with today?";
  }

  if (lowered.includes("help")) {
    return "I'm here to help! Here are some things I can assist with:\n\n• **Scheduling** - Managing your calendar and appointments\n• **Contacts** - Remembering details about people you know\n• **Tasks** - Keeping track of your to-do items and deadlines\n• **Notes** - Storing important information for later\n\nJust ask me anything!";
  }

  if (lowered.includes("thank")) {
    return "You're welcome! Let me know if there's anything else I can help with.";
  }

  // Default response
  return `I received your message: "${userMessage.slice(0, 50)}${userMessage.length > 50 ? "..." : ""}"\n\nI'm currently in development mode with placeholder responses. Soon I'll be connected to an AI model that can provide real assistance with your schedule, contacts, tasks, and more!`;
}

// ─────────────────────────────────────────────────────────────
// GET - List Messages
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Apply rate limiting (standard API limits)
    const {
      response: rateLimitResponse,
      userId,
      headers,
    } = await applyRateLimit(request, RATE_LIMITS.api);

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: conversationId } = await params;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const cursor = searchParams.get("cursor") || undefined;
    const beforeId = searchParams.get("beforeId") || undefined;
    const afterId = searchParams.get("afterId") || undefined;

    // List messages
    const result = await listMessages(
      {
        conversationId,
        limit: Math.min(limit, 200), // Cap at 200
        cursor,
        beforeId,
        afterId,
      },
      { userId }
    );

    return NextResponse.json(result, { headers });
  } catch (error) {
    console.error("Error listing messages:", error);

    if (error instanceof Error && error.message === "Conversation not found") {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to list messages" },
      { status: 500 }
    );
  }
}
