import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import KrogerClient from "@/integrations/kroger/client";
import { RouteParams } from "@/lib/api/types";

// ─────────────────────────────────────────────────────────────
// GET /api/integrations/kroger/stores/[id] - Get Kroger store by ID
// ─────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  // Get the user ID from the request auth context
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Create the Kroger client
  const client = new KrogerClient({
    userId: userId,
  });

  // Get the store
  const store = await client.getStore(id);
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  return NextResponse.json(store);
}

// ─────────────────────────────────────────────────────────────
// POST /api/integrations/kroger/stores/[id] - Set store as default
// ─────────────────────────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const client = new KrogerClient({
    userId: userId,
  });
  // @todo - update user product preferences
  const preferences = {};
  return NextResponse.json(preferences);
}
