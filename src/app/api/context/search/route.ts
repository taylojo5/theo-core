// ═══════════════════════════════════════════════════════════════════════════
// Context Search API
// GET /api/context/search - Unified search across all context entities
// Supports both text-based and semantic (vector) search
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { validateQuery, searchQuerySchema } from "@/lib/validation";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";
import {
  searchContext,
  type EntityType,
  type ContextSearchResult,
} from "@/services/context";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface SearchResponse {
  query: string;
  totalResults: number;
  resultsByType: Record<EntityType, number>;
  searchMode: "text" | "semantic" | "hybrid";
  results: ContextSearchResult[];
}

// Valid entity types for filtering
const VALID_ENTITY_TYPES: EntityType[] = [
  "person",
  "place",
  "event",
  "task",
  "deadline",
];

// ─────────────────────────────────────────────────────────────
// GET - Unified Search
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting (uses search limits - 30/min due to OpenAI cost)
    const {
      response: rateLimitResponse,
      userId,
      headers,
    } = await applyRateLimit(request, RATE_LIMITS.search);

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Check authentication
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate query parameters
    const { searchParams } = new URL(request.url);
    const validation = validateQuery(searchParams, searchQuerySchema);
    if (!validation.success) {
      return validation.error;
    }

    const { q, types, limit, useSemanticSearch } = validation.data;

    // Parse entity types filter
    let entityTypes: EntityType[] = VALID_ENTITY_TYPES;
    if (types) {
      entityTypes = types
        .split(",")
        .filter((t) =>
          VALID_ENTITY_TYPES.includes(t as EntityType)
        ) as EntityType[];

      if (entityTypes.length === 0) {
        return NextResponse.json(
          {
            error: `Invalid types. Valid types: ${VALID_ENTITY_TYPES.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    // Parse additional semantic search options
    const minSimilarity = parseFloat(
      searchParams.get("minSimilarity") || "0.5"
    );
    const semanticWeight = parseFloat(
      searchParams.get("semanticWeight") || "0.7"
    );

    // Determine search mode for response
    const searchMode: "text" | "semantic" | "hybrid" = useSemanticSearch
      ? "hybrid"
      : "text";

    // Perform unified search
    const results = await searchContext(userId, q, {
      entityTypes,
      limit,
      useSemanticSearch,
      minSimilarity: isNaN(minSimilarity)
        ? 0.5
        : Math.min(1, Math.max(0, minSimilarity)),
      semanticWeight: isNaN(semanticWeight)
        ? 0.7
        : Math.min(1, Math.max(0, semanticWeight)),
      includeSnippets: true,
    });

    // Group results by type for summary
    const byType: Record<EntityType, number> = {
      person: 0,
      place: 0,
      event: 0,
      task: 0,
      deadline: 0,
    };

    for (const result of results) {
      byType[result.entityType]++;
    }

    const response: SearchResponse = {
      query: q,
      totalResults: results.length,
      resultsByType: byType,
      searchMode,
      results,
    };

    return NextResponse.json(response, { headers });
  } catch (error) {
    console.error("Error in context search:", error);
    return NextResponse.json(
      { error: "Failed to search context" },
      { status: 500 }
    );
  }
}
