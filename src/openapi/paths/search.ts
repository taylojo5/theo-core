// ═══════════════════════════════════════════════════════════════════════════
// Search API Path Definitions
// ═══════════════════════════════════════════════════════════════════════════

import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import {
  EmailSearchQuerySchema,
  EmailSearchResponseSchema,
  SimilarEmailsQuerySchema,
  SimilarEmailsResponseSchema,
  rateLimitHeaders,
} from "../components";
import { protectedEndpoint } from "../components/security";

export function registerSearchPaths(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/api/search/emails",
    tags: ["Search"],
    summary: "Search emails",
    description: `
Search synced emails with text or semantic search.

**Search Modes:**
- **Text search** (default): Fast keyword-based search
- **Semantic search** (\`useSemanticSearch=true\`): AI-powered meaning-based search

**Find Similar:**
Use \`similarTo={emailId}\` to find emails similar to a specific email.

Rate limited to 30 requests/minute due to AI costs when using semantic search.
    `.trim(),
    security: protectedEndpoint,
    request: { query: EmailSearchQuerySchema },
    responses: {
      200: {
        description: "Search results",
        headers: rateLimitHeaders,
        content: {
          "application/json": {
            schema: EmailSearchResponseSchema,
            example: {
              query: "invoice from Acme",
              totalResults: 3,
              usedSemanticSearch: true,
              results: [
                {
                  id: "clx123",
                  gmailMessageId: "msg123",
                  threadId: "thread123",
                  from: "billing@acme.com",
                  to: ["user@example.com"],
                  subject: "Invoice #1234",
                  snippet: "Please find attached invoice for...",
                  receivedAt: "2024-01-15T10:30:00Z",
                  isRead: true,
                  isStarred: false,
                  score: 0.92,
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
