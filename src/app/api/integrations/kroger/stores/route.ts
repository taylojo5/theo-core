import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getKrogerTokenSet } from "@/integrations/kroger/auth/connection";
import KrogerClient from "@/integrations/kroger/client";
import { searchKrogerStoresSchema } from "@/lib/validation/schemas";
import { validateParams } from "@/lib/validation";

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Get the user ID from the request auth context
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;

  // Validate the request body
  const validation = validateParams(
    {
      zipCode: searchParams.get("zipCode") ?? undefined,
      radiusMiles: searchParams.get("radiusMiles") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    },
    searchKrogerStoresSchema
  );
  if (!validation.success) {
    return validation.error;
  }

  // Get the Kroger connection
  const tokenSet = await getKrogerTokenSet(userId);
  if (!tokenSet) {
    return NextResponse.json(
      { error: "Kroger connection not found" },
      { status: 404 }
    );
  }

  // Create the Kroger client
  const client = new KrogerClient({
    userId: userId,
    radiusMiles: validation.data.radiusMiles ?? 10,
    limit: validation.data.limit ?? 10,
  });

  // Search for stores
  const stores = await client.searchStores({
    zipCode: validation.data.zipCode!,
  });

  return NextResponse.json({ success: true, data: stores });
}
