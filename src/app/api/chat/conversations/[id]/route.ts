// ═══════════════════════════════════════════════════════════════════════════
// Single Conversation API
// GET /api/chat/conversations/[id] - Get conversation with messages
// PATCH /api/chat/conversations/[id] - Update conversation
// DELETE /api/chat/conversations/[id] - Delete conversation
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getConversation,
  updateConversation,
  deleteConversation,
} from "@/services/chat";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─────────────────────────────────────────────────────────────
// GET - Get Conversation with Messages
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const includeMessages = searchParams.get("includeMessages") !== "false";
    const messageLimit = parseInt(searchParams.get("messageLimit") || "100", 10);

    // Get conversation
    const conversation = await getConversation(id, session.user.id, {
      includeMessages,
      messageLimit: Math.min(messageLimit, 500), // Cap at 500
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(conversation);
  } catch (error) {
    console.error("Error fetching conversation:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversation" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH - Update Conversation
// ─────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { title, summary } = body;

    // Validate input
    if (!title && !summary) {
      return NextResponse.json(
        { error: "At least one of 'title' or 'summary' is required" },
        { status: 400 }
      );
    }

    // Update conversation
    const conversation = await updateConversation(
      id,
      session.user.id,
      { title, summary },
      { userId: session.user.id }
    );

    return NextResponse.json(conversation);
  } catch (error) {
    console.error("Error updating conversation:", error);
    
    if (error instanceof Error && error.message === "Conversation not found") {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update conversation" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE - Delete Conversation
// ─────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Delete conversation
    await deleteConversation(id, session.user.id, { userId: session.user.id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    
    if (error instanceof Error && error.message === "Conversation not found") {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete conversation" },
      { status: 500 }
    );
  }
}

