// ═══════════════════════════════════════════════════════════════════════════
// Single Person API
// GET /api/context/people/[id] - Get person by ID
// PATCH /api/context/people/[id] - Update person
// DELETE /api/context/people/[id] - Soft delete person
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  validateParams,
  validateObject,
  updatePersonSchema,
  idParamSchema,
} from "@/lib/validation";
import {
  getPersonById,
  updatePerson,
  deletePerson,
  restorePerson,
  PeopleServiceError,
  type UpdatePersonInput,
} from "@/services/context";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─────────────────────────────────────────────────────────────
// GET - Get Person by ID
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const resolvedParams = await params;

    // Validate params
    const paramValidation = validateParams(resolvedParams, idParamSchema);
    if (!paramValidation.success) {
      return paramValidation.error;
    }

    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const person = await getPersonById(
      session.user.id,
      paramValidation.data.id
    );

    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
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
    const resolvedParams = await params;

    // Validate params
    const paramValidation = validateParams(resolvedParams, idParamSchema);
    if (!paramValidation.success) {
      return paramValidation.error;
    }

    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and check for restore operation first
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Check if this is a restore operation
    if (body.restore === true) {
      const person = await restorePerson(
        session.user.id,
        paramValidation.data.id,
        { userId: session.user.id }
      );
      return NextResponse.json(person);
    }

    // Validate update body
    const validation = validateObject(body, updatePersonSchema);
    if (!validation.success) {
      return validation.error;
    }

    // Ensure at least one field is being updated
    const hasUpdate = Object.keys(validation.data).length > 0;
    if (!hasUpdate) {
      return NextResponse.json(
        { error: "At least one field must be provided for update" },
        { status: 400 }
      );
    }

    const person = await updatePerson(
      session.user.id,
      paramValidation.data.id,
      validation.data as UpdatePersonInput,
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
    const resolvedParams = await params;

    // Validate params
    const paramValidation = validateParams(resolvedParams, idParamSchema);
    if (!paramValidation.success) {
      return paramValidation.error;
    }

    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await deletePerson(session.user.id, paramValidation.data.id, {
      userId: session.user.id,
    });

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
