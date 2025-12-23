// ═══════════════════════════════════════════════════════════════════════════
// OpenAPI Document Generator
// Generates the complete OpenAPI 3.1 specification for Theo API
// ═══════════════════════════════════════════════════════════════════════════

import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { registerSecuritySchemes } from "./components/security";
import { registerCommonResponses } from "./components/responses";
import {
  registerHealthPaths,
  registerContextPaths,
  registerChatPaths,
  registerIntegrationPaths,
  registerSearchPaths,
  registerAdminPaths,
} from "./paths";

// ─────────────────────────────────────────────────────────────
// Generate OpenAPI Document
// ─────────────────────────────────────────────────────────────

export function generateOpenAPIDocument() {
  const registry = new OpenAPIRegistry();

  // Register reusable components
  registerSecuritySchemes(registry);
  registerCommonResponses(registry);

  // Register all API paths
  registerHealthPaths(registry);
  registerContextPaths(registry);
  registerChatPaths(registry);
  registerIntegrationPaths(registry);
  registerSearchPaths(registry);
  registerAdminPaths(registry);

  // Generate the document
  const generator = new OpenApiGeneratorV31(registry.definitions);

  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Theo API",
      version: "1.0.0",
      description: `
# Theo Core API

Personal AI assistant API for managing context, conversations, and integrations.

## Authentication

All endpoints (except \`/api/health\`) require authentication via session cookie or Bearer token.

### Session Authentication
After logging in via OAuth, a session cookie is automatically set:
- Development: \`next-auth.session-token\`
- Production: \`__Secure-next-auth.session-token\`

### Bearer Token
For programmatic access, include the token in the Authorization header:
\`\`\`
Authorization: Bearer <your-token>
\`\`\`

## Rate Limiting

API requests are rate-limited per user to ensure fair usage:

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Standard API | 60 req | 1 min |
| Search (semantic) | 30 req | 1 min |
| Gmail sync | 10 req | 1 min |
| Create operations | 30 req | 1 min |

Rate limit headers are included in all responses:
- \`X-RateLimit-Limit\`: Maximum requests allowed
- \`X-RateLimit-Remaining\`: Requests remaining in window
- \`X-RateLimit-Reset\`: Unix timestamp when limit resets

## Pagination

List endpoints use cursor-based pagination:

\`\`\`json
{
  "items": [...],
  "hasMore": true,
  "nextCursor": "clx9876543210"
}
\`\`\`

To fetch the next page, pass the cursor: \`?cursor=clx9876543210\`

## Error Handling

Errors return a consistent JSON structure:

\`\`\`json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "details": [{ "path": ["field"], "message": "Specific issue" }]
}
\`\`\`
      `.trim(),
      contact: {
        name: "Theo Support",
        url: "https://github.com/your-org/theo-core",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
      {
        url: "https://api.theo.app",
        description: "Production server",
      },
    ],
    tags: [
      {
        name: "Health",
        description: "System health and status endpoints",
      },
      {
        name: "Chat",
        description: "Conversation and message management with AI assistant",
      },
      {
        name: "Context - People",
        description: "Manage people and contacts in your personal knowledge graph",
      },
      {
        name: "Context - Places",
        description: "Manage locations and places",
      },
      {
        name: "Context - Events",
        description: "Manage events and calendar items",
      },
      {
        name: "Context - Tasks",
        description: "Task and todo management",
      },
      {
        name: "Context - Deadlines",
        description: "Track important deadlines and milestones",
      },
      {
        name: "Context - Relationships",
        description: "Manage connections between entities",
      },
      {
        name: "Context - Search",
        description: "Unified semantic and text search across all context",
      },
      {
        name: "Integrations",
        description: "Third-party integration status and management",
      },
      {
        name: "Gmail",
        description: "Gmail integration - sync, drafts, approvals, and sending",
      },
      {
        name: "Search",
        description: "Email and content search with semantic capabilities",
      },
      {
        name: "Admin",
        description: "Administrative endpoints for system management",
      },
    ],
    externalDocs: {
      description: "Full documentation",
      url: "https://docs.theo.app",
    },
  });
}

// Export for route handler
export type { OpenAPIRegistry };
