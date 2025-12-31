// ═══════════════════════════════════════════════════════════════════════════
// Chat Conversations API
// POST /api/chat/conversations - Create a new conversation
// GET /api/chat/conversations - List user's conversations
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createConversation,
  listConversations,
  type CreateConversationInput,
} from "@/services/chat";

// ─────────────────────────────────────────────────────────────
// POST - Create Conversation
// ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));

    // Create conversation
    const input: CreateConversationInput = {
      userId: session.user.id,
      title: body.title,
    };

    const conversation = await createConversation(input, {
      userId: session.user.id,
    });

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    console.error("Error creating conversation:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// GET - List Conversations
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const cursor = searchParams.get("cursor") || undefined;
    const includeMessages = searchParams.get("includeMessages") === "true";
    const messageLimit = parseInt(searchParams.get("messageLimit") || "1", 10);

    // List conversations
    const result = await listConversations({
      userId: session.user.id,
      limit: Math.min(limit, 100), // Cap at 100
      cursor,
      includeMessages,
      messageLimit,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error listing conversations:", error);
    return NextResponse.json(
      { error: "Failed to list conversations" },
      { status: 500 }
    );
  }
}
