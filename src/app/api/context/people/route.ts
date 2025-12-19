// ═══════════════════════════════════════════════════════════════════════════
// People API
// POST /api/context/people - Create a new person
// GET /api/context/people - List user's people (paginated, filterable)
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createPerson,
  listPeople,
  searchPeople,
  PeopleServiceError,
  type CreatePersonInput,
  type ListPeopleOptions,
  type Source,
  type PersonType,
  type SortOrder,
} from "@/services/context";

// ─────────────────────────────────────────────────────────────
// POST - Create Person
// ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json(
        { error: "Name is required and must be a string" },
        { status: 400 }
      );
    }

    // Build input
    const input: CreatePersonInput = {
      name: body.name,
      email: body.email,
      phone: body.phone,
      avatarUrl: body.avatarUrl,
      type: body.type,
      importance: body.importance,
      company: body.company,
      title: body.title,
      location: body.location,
      timezone: body.timezone,
      bio: body.bio,
      notes: body.notes,
      preferences: body.preferences,
      source: body.source ?? "manual",
      sourceId: body.sourceId,
      metadata: body.metadata,
      tags: body.tags,
    };

    const person = await createPerson(
      session.user.id,
      input,
      { userId: session.user.id }
    );

    return NextResponse.json(person, { status: 201 });
  } catch (error) {
    console.error("Error creating person:", error);

    if (error instanceof PeopleServiceError) {
      const status = error.code === "DUPLICATE_EMAIL" ? 409 : 400;
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status }
      );
    }

    return NextResponse.json(
      { error: "Failed to create person" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// GET - List/Search People
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
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

    const q = searchParams.get("q");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const cursor = searchParams.get("cursor") || undefined;
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = (searchParams.get("sortOrder") || "desc") as SortOrder;
    const type = searchParams.get("type") as PersonType | undefined;
    const company = searchParams.get("company") || undefined;
    const source = searchParams.get("source") as Source | undefined;
    const tags = searchParams.get("tags")?.split(",").filter(Boolean) || undefined;
    const minImportance = searchParams.get("minImportance")
      ? parseInt(searchParams.get("minImportance")!, 10)
      : undefined;
    const includeDeleted = searchParams.get("includeDeleted") === "true";

    // If search query provided, use search function
    if (q) {
      const results = await searchPeople(session.user.id, q, { limit });
      return NextResponse.json({
        items: results,
        hasMore: false,
      });
    }

    // Otherwise use list with filters
    const options: ListPeopleOptions = {
      limit,
      cursor,
      sortBy,
      sortOrder,
      type,
      company,
      source,
      tags,
      minImportance,
      includeDeleted,
    };

    const result = await listPeople(session.user.id, options);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error listing people:", error);
    return NextResponse.json(
      { error: "Failed to list people" },
      { status: 500 }
    );
  }
}

