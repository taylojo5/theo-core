// ═══════════════════════════════════════════════════════════════════════════
// People API
// POST /api/context/people - Create a new person
// GET /api/context/people - List user's people (paginated, filterable)
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  parseAndValidateBody,
  validateQuery,
  createPersonSchema,
  listPeopleQuerySchema,
} from "@/lib/validation";
import {
  createPerson,
  listPeople,
  searchPeople,
  PeopleServiceError,
  type CreatePersonInput,
  type ListPeopleOptions,
  type Source,
  type PersonType,
} from "@/services/context";

// ─────────────────────────────────────────────────────────────
// POST - Create Person
// ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate request body
    const validation = await parseAndValidateBody(request, createPersonSchema);
    if (!validation.success) {
      return validation.error;
    }

    const person = await createPerson(
      session.user.id,
      validation.data as CreatePersonInput,
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate query parameters
    const { searchParams } = new URL(request.url);
    const validation = validateQuery(searchParams, listPeopleQuerySchema);
    if (!validation.success) {
      return validation.error;
    }

    const { limit, cursor, type, source, search, tags, includeDeleted } =
      validation.data;

    // If search query provided, use search function
    if (search) {
      const results = await searchPeople(session.user.id, search, { limit });
      return NextResponse.json({
        items: results,
        hasMore: false,
      });
    }

    // Otherwise use list with filters
    const options: ListPeopleOptions = {
      limit,
      cursor,
      type: type as PersonType,
      source: source as Source,
      tags: tags?.split(",").filter(Boolean),
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
