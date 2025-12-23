// ═══════════════════════════════════════════════════════════════════════════
// Context Search API Path Definitions
// ═══════════════════════════════════════════════════════════════════════════

import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import {
  ContextSearchQuerySchema,
  ContextSearchResponseSchema,
  rateLimitHeaders,
} from "../../components";
import { protectedEndpoint } from "../../components/security";

export function registerContextSearchPaths(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/api/context/search",
    tags: ["Context - Search"],
    summary: "Search across all context",
    description: `
Unified search across all context entities (people, places, events, tasks, deadlines).

**Search Modes:**
- **Text search** (default): Fast full-text search
- **Semantic search** (\`useSemanticSearch=true\`): AI-powered meaning-based search using embeddings

Semantic search is slower but more accurate for natural language queries.
Rate limited to 30 requests/minute due to AI costs.
    `.trim(),
    security: protectedEndpoint,
    request: { query: ContextSearchQuerySchema },
    responses: {
      200: {
        description: "Search results",
        headers: rateLimitHeaders,
        content: {
          "application/json": {
            schema: ContextSearchResponseSchema,
            example: {
              query: "meeting with John",
              totalResults: 5,
              resultsByType: { person: 1, event: 3, task: 1 },
              searchMode: "hybrid",
              results: [
                {
                  entityType: "person",
                  entityId: "clx123",
                  title: "John Smith",
                  snippet: "Senior Engineer at Acme Corp",
                  score: 0.95,
                },
                {
                  entityType: "event",
                  entityId: "clx456",
                  title: "Weekly Sync with John",
                  snippet: "Discuss project roadmap",
                  score: 0.88,
                },
              ],
            },
          },
        },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });
}

