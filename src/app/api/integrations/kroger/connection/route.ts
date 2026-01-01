import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getKrogerConnection } from "@/integrations/kroger/auth/connection";

// ─────────────────────────────────────────────────────────────
// GET /api/integrations/kroger/connection - Get Kroger connection
// ─────────────────────────────────────────────────────────────
export async function GET(): Promise<NextResponse> {
  // Get the user ID from the request auth context
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the Kroger connection
  const connection = await getKrogerConnection(userId);
  if (!connection) {
    return NextResponse.json(
      { error: "Kroger connection not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(connection);
}
