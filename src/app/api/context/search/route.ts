// ═══════════════════════════════════════════════════════════════════════════
// Context Search API
// GET /api/context/search - Unified search across all context entities
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  searchPeople,
  searchPlaces,
  searchEvents,
  searchTasks,
  searchDeadlines,
  type EntityType,
  type Person,
  type Place,
  type Event,
  type Task,
  type Deadline,
} from "@/services/context";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface UnifiedSearchResult {
  entityType: EntityType;
  entityId: string;
  entity: Person | Place | Event | Task | Deadline;
  score: number;
  matchType: "text";
}

// Valid entity types for filtering
const VALID_ENTITY_TYPES: EntityType[] = ["person", "place", "event", "task", "deadline"];

// ─────────────────────────────────────────────────────────────
// GET - Unified Search
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
    if (!q || q.trim().length === 0) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required" },
        { status: 400 }
      );
    }

    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);

    // Parse entity types filter
    const typesParam = searchParams.get("types");
    let entityTypes: EntityType[] = VALID_ENTITY_TYPES;
    if (typesParam) {
      entityTypes = typesParam
        .split(",")
        .filter((t) => VALID_ENTITY_TYPES.includes(t as EntityType)) as EntityType[];
      
      if (entityTypes.length === 0) {
        return NextResponse.json(
          { error: `Invalid types. Valid types: ${VALID_ENTITY_TYPES.join(", ")}` },
          { status: 400 }
        );
      }
    }

    // Calculate per-type limit (distribute evenly, then merge and sort)
    const perTypeLimit = Math.ceil(limit / entityTypes.length) + 5; // Extra buffer for better ranking

    // Run searches in parallel for each requested entity type
    const searchPromises: Promise<UnifiedSearchResult[]>[] = [];

    if (entityTypes.includes("person")) {
      searchPromises.push(
        searchPeople(session.user.id, q, { limit: perTypeLimit })
          .then((results) =>
            results.map((entity, index) => ({
              entityType: "person" as EntityType,
              entityId: entity.id,
              entity,
              score: 1 - index * 0.01, // Simple positional scoring
              matchType: "text" as const,
            }))
          )
          .catch(() => [])
      );
    }

    if (entityTypes.includes("place")) {
      searchPromises.push(
        searchPlaces(session.user.id, q, { limit: perTypeLimit })
          .then((results) =>
            results.map((entity, index) => ({
              entityType: "place" as EntityType,
              entityId: entity.id,
              entity,
              score: 1 - index * 0.01,
              matchType: "text" as const,
            }))
          )
          .catch(() => [])
      );
    }

    if (entityTypes.includes("event")) {
      searchPromises.push(
        searchEvents(session.user.id, q, { limit: perTypeLimit })
          .then((results) =>
            results.map((entity, index) => ({
              entityType: "event" as EntityType,
              entityId: entity.id,
              entity,
              score: 1 - index * 0.01,
              matchType: "text" as const,
            }))
          )
          .catch(() => [])
      );
    }

    if (entityTypes.includes("task")) {
      searchPromises.push(
        searchTasks(session.user.id, q, { limit: perTypeLimit })
          .then((results) =>
            results.map((entity, index) => ({
              entityType: "task" as EntityType,
              entityId: entity.id,
              entity,
              score: 1 - index * 0.01,
              matchType: "text" as const,
            }))
          )
          .catch(() => [])
      );
    }

    if (entityTypes.includes("deadline")) {
      searchPromises.push(
        searchDeadlines(session.user.id, q, { limit: perTypeLimit })
          .then((results) =>
            results.map((entity, index) => ({
              entityType: "deadline" as EntityType,
              entityId: entity.id,
              entity,
              score: 1 - index * 0.01,
              matchType: "text" as const,
            }))
          )
          .catch(() => [])
      );
    }

    // Wait for all searches to complete
    const searchResults = await Promise.all(searchPromises);

    // Flatten and sort by score
    const allResults = searchResults
      .flat()
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Group results by type for summary
    const byType: Record<EntityType, number> = {
      person: 0,
      place: 0,
      event: 0,
      task: 0,
      deadline: 0,
    };

    for (const result of allResults) {
      byType[result.entityType]++;
    }

    return NextResponse.json({
      query: q,
      totalResults: allResults.length,
      resultsByType: byType,
      results: allResults,
    });
  } catch (error) {
    console.error("Error in context search:", error);
    return NextResponse.json(
      { error: "Failed to search context" },
      { status: 500 }
    );
  }
}

