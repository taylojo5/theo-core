// ═══════════════════════════════════════════════════════════════════════════
// Single Person API
// GET /api/context/people/[id] - Get person by ID
// PATCH /api/context/people/[id] - Update person
// DELETE /api/context/people/[id] - Soft delete person
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getPersonById,
  updatePerson,
  deletePerson,
  restorePerson,
  PeopleServiceError,
} from "@/services/context";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─────────────────────────────────────────────────────────────
// GET - Get Person by ID
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

    const person = await getPersonById(session.user.id, id);

    if (!person) {
      return NextResponse.json(
        { error: "Person not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(person);
  } catch (error) {
    console.error("Error fetching person:", error);
    return NextResponse.json(
      { error: "Failed to fetch person" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH - Update Person
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
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Check if this is a restore operation
    if (body.restore === true) {
      const person = await restorePerson(session.user.id, id, {
        userId: session.user.id,
      });
      return NextResponse.json(person);
    }

    // Validate at least one field is being updated
    const updateFields = [
      "name", "email", "phone", "avatarUrl", "type", "importance",
      "company", "title", "location", "timezone", "bio", "notes",
      "preferences", "metadata", "tags"
    ];
    const hasUpdate = updateFields.some((field) => body[field] !== undefined);

    if (!hasUpdate) {
      return NextResponse.json(
        { error: "At least one field must be provided for update" },
        { status: 400 }
      );
    }

    const person = await updatePerson(
      session.user.id,
      id,
      {
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
        metadata: body.metadata,
        tags: body.tags,
      },
      { userId: session.user.id }
    );

    return NextResponse.json(person);
  } catch (error) {
    console.error("Error updating person:", error);

    if (error instanceof PeopleServiceError) {
      if (error.code === "PERSON_NOT_FOUND") {
        return NextResponse.json(
          { error: "Person not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update person" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE - Soft Delete Person
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

    await deletePerson(session.user.id, id, { userId: session.user.id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting person:", error);

    if (error instanceof PeopleServiceError) {
      if (error.code === "PERSON_NOT_FOUND") {
        return NextResponse.json(
          { error: "Person not found" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to delete person" },
      { status: 500 }
    );
  }
}

