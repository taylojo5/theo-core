// ═══════════════════════════════════════════════════════════════════════════
// Email Search API
// GET /api/search/emails - Semantic and text search across emails
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { validateQuery } from "@/lib/validation";
import {
  emailSearchQuerySchema,
  findSimilarEmailsSchema,
} from "@/lib/validation/schemas";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";
import {
  searchEmails,
  findSimilarEmails,
  type EmailSearchResult,
} from "@/services/search";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface EmailSearchAPIResponse {
  query: string;
  totalResults: number;
  usedSemanticSearch: boolean;
  results: EmailSearchResult[];
}

interface SimilarEmailsAPIResponse {
  sourceEmailId: string;
  totalResults: number;
  results: EmailSearchResult[];
}

// ─────────────────────────────────────────────────────────────
// GET - Search Emails
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

    // Parse URL to determine action
    const { searchParams } = new URL(request.url);

    // Check if this is a "find similar" request
    const similarTo = searchParams.get("similarTo");
    if (similarTo) {
      return handleFindSimilar(userId, searchParams, headers);
    }

    // Standard search
    return handleSearch(userId, searchParams, headers);
  } catch (error) {
    console.error("Error in email search:", error);
    return NextResponse.json(
      { error: "Failed to search emails" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Search Handler
// ─────────────────────────────────────────────────────────────

async function handleSearch(
  userId: string,
  searchParams: URLSearchParams,
  headers: HeadersInit
): Promise<NextResponse> {
  // Validate query parameters
  const validation = validateQuery(searchParams, emailSearchQuerySchema);
  if (!validation.success) {
    return validation.error as NextResponse;
  }

  const {
    q,
    limit,
    useSemanticSearch,
    minSimilarity,
    semanticWeight,
    labelIds,
    startDate,
    endDate,
    fromEmail,
    isRead,
    isStarred,
    hasAttachments,
  } = validation.data;

  // Build search options
  const searchResult = await searchEmails(userId, q, {
    limit,
    useSemanticSearch,
    minSimilarity,
    semanticWeight,
    labelIds: labelIds?.split(",").filter(Boolean),
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    fromEmail,
    isRead,
    isStarred,
    hasAttachments,
  });

  const response: EmailSearchAPIResponse = {
    query: q,
    totalResults: searchResult.total,
    usedSemanticSearch: searchResult.usedSemanticSearch,
    results: searchResult.results,
  };

  return NextResponse.json(response, { headers });
}

// ─────────────────────────────────────────────────────────────
// Find Similar Handler
// ─────────────────────────────────────────────────────────────

async function handleFindSimilar(
  userId: string,
  searchParams: URLSearchParams,
  headers: HeadersInit
): Promise<NextResponse> {
  // Map similarTo to emailId for validation
  const emailId = searchParams.get("similarTo");
  if (!emailId) {
    return NextResponse.json(
      { error: "similarTo parameter is required" },
      { status: 400 }
    );
  }

  // Create a new params object for validation
  const paramsForValidation = new URLSearchParams();
  paramsForValidation.set("emailId", emailId);
  if (searchParams.has("limit")) {
    paramsForValidation.set("limit", searchParams.get("limit")!);
  }
  if (searchParams.has("minSimilarity")) {
    paramsForValidation.set(
      "minSimilarity",
      searchParams.get("minSimilarity")!
    );
  }

  const validation = validateQuery(
    paramsForValidation,
    findSimilarEmailsSchema
  );
  if (!validation.success) {
    return validation.error as NextResponse;
  }

  const { limit, minSimilarity } = validation.data;

  const results = await findSimilarEmails(userId, emailId, {
    limit,
    minSimilarity,
  });

  const response: SimilarEmailsAPIResponse = {
    sourceEmailId: emailId,
    totalResults: results.length,
    results,
  };

  return NextResponse.json(response, { headers });
}
