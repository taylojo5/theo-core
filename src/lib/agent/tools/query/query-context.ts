// ═══════════════════════════════════════════════════════════════════════════
// Query Context Tool
// Search user context for people, events, tasks, and other information
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import type { ToolDefinition } from "../types";
import { defineTool, objectSchema } from "../types";
import { getContextSearchService } from "@/services/context";
import type { EntityType as ContextEntityType, ContextSearchResult as ServiceSearchResult } from "@/services/context/types";

// ─────────────────────────────────────────────────────────────
// Input/Output Types
// ─────────────────────────────────────────────────────────────

/** Valid entity types for context query */
const ENTITY_TYPES = ["person", "event", "task", "place", "deadline", "any"] as const;
type QueryEntityType = (typeof ENTITY_TYPES)[number];

/** Input schema for context query */
const queryContextInputSchema = z.object({
  query: z.string().min(1, "Query cannot be empty"),
  entityType: z.enum(ENTITY_TYPES).optional().default("any"),
  limit: z.number().int().min(1).max(20).optional().default(10),
  useSemanticSearch: z.boolean().optional().default(true),
});

type QueryContextInput = z.infer<typeof queryContextInputSchema>;

/** Output type for context query */
interface QueryContextOutput {
  results: ContextResult[];
  totalCount: number;
  searchType: "semantic" | "text" | "hybrid";
}

/** Individual search result */
interface ContextResult {
  id: string;
  entityType: string;
  title: string;
  snippet?: string;
  score: number;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// Tool Definition
// ─────────────────────────────────────────────────────────────

export const queryContextTool: ToolDefinition<QueryContextInput, QueryContextOutput> = defineTool({
  // ═══════════════════════════════════════════════════════════
  // LLM Interface
  // ═══════════════════════════════════════════════════════════
  name: "query_context",
  description: "Search user context for relevant information about people, events, tasks, places, and deadlines",

  whenToUse: `Use when the user asks about:
- People they know: "Who is Sarah?", "Tell me about John from Acme"
- Past or upcoming events: "What meetings did I have?", "When did I meet with X?"
- Tasks and to-dos: "What tasks are related to the project?"
- Places: "What do I know about the conference venue?"
- Deadlines: "What deadlines are coming up for X?"
- General context: "What do I know about...", "Find information about..."

This tool searches across all stored context using semantic and text search.`,

  examples: [
    'User: "Who is Sarah?" → query_context({ query: "Sarah", entityType: "person" })',
    'User: "What do I know about the Acme project?" → query_context({ query: "Acme project" })',
    'User: "Tell me about my meetings last week" → query_context({ query: "meetings last week", entityType: "event" })',
    'User: "What tasks are related to the Q4 report?" → query_context({ query: "Q4 report", entityType: "task" })',
    'User: "Find anything about the Chicago office" → query_context({ query: "Chicago office" })',
  ],

  parametersSchema: objectSchema(
    {
      query: {
        type: "string",
        description: "Search query text describing what to find",
        minLength: 1,
      },
      entityType: {
        type: "string",
        enum: [...ENTITY_TYPES],
        description: "Filter by entity type (person, event, task, place, deadline, or any)",
      },
      limit: {
        type: "integer",
        description: "Maximum results to return (1-20, default 10)",
        minimum: 1,
        maximum: 20,
      },
      useSemanticSearch: {
        type: "boolean",
        description: "Whether to use semantic search for better results (default true)",
      },
    },
    ["query"]
  ),

  // ═══════════════════════════════════════════════════════════
  // Internal Configuration
  // ═══════════════════════════════════════════════════════════
  category: "query",
  riskLevel: "low",
  requiresApproval: false,
  requiredIntegrations: [], // Works with built-in context

  // ═══════════════════════════════════════════════════════════
  // Validation & Execution
  // ═══════════════════════════════════════════════════════════
  inputValidator: queryContextInputSchema,

  execute: async (input, context) => {
    const { query, entityType, limit, useSemanticSearch } = input;

    // Map "any" to all entity types
    const entityTypes: ContextEntityType[] =
      entityType === "any"
        ? ["person", "event", "task", "place", "deadline"]
        : [entityType as ContextEntityType];

    // Get the search service singleton
    const searchService = getContextSearchService();

    // Execute the search
    const searchResults = await searchService.search(context.userId, query, {
      entityTypes,
      limit,
      useSemanticSearch,
      includeSnippets: true,
    });

    // Map results to output format
    const results: ContextResult[] = searchResults.map((result) => ({
      id: result.entityId,
      entityType: result.entityType,
      title: getResultTitle(result),
      snippet: result.snippet,
      score: result.score,
      metadata: extractMetadata(result),
    }));

    return {
      results,
      totalCount: results.length,
      searchType: useSemanticSearch ? "hybrid" : "text",
    } as QueryContextOutput;
  },
});

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Extract the title/name from a search result based on entity type
 */
function getResultTitle(result: ServiceSearchResult): string {
  const entity = result.entity as Record<string, unknown> | undefined;
  if (!entity) return "Unknown";

  switch (result.entityType) {
    case "person":
      return String(entity.name || entity.email || "Unknown Person");
    case "event":
    case "task":
    case "deadline":
    case "place":
      return String(entity.title || entity.name || "Untitled");
    default:
      return String(entity.name || entity.title || "Unknown");
  }
}

/**
 * Extract relevant metadata from a search result
 */
function extractMetadata(result: ServiceSearchResult): Record<string, unknown> | undefined {
  const entity = result.entity as Record<string, unknown> | undefined;
  if (!entity) return undefined;

  switch (result.entityType) {
    case "person":
      return {
        email: entity.email,
        company: entity.company,
        title: entity.title,
      };
    case "event":
      return {
        startsAt: entity.startsAt,
        endsAt: entity.endsAt,
        location: entity.location,
        allDay: entity.allDay,
      };
    case "task":
      return {
        status: entity.status,
        priority: entity.priority,
        dueDate: entity.dueDate,
      };
    case "deadline":
      return {
        dueAt: entity.dueAt,
        status: entity.status,
        type: entity.type,
      };
    case "place":
      return {
        address: entity.address,
        type: entity.type,
      };
    default:
      return undefined;
  }
}


