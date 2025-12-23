// ═══════════════════════════════════════════════════════════════════════════
// People API Path Definitions
// ═══════════════════════════════════════════════════════════════════════════

import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "../../components/schemas/common";
import {
  PersonSchema,
  PersonCreateSchema,
  PersonUpdateSchema,
  PersonListQuerySchema,
  PaginatedPeopleSchema,
  DeleteSuccessSchema,
  rateLimitHeaders,
} from "../../components";
import { protectedEndpoint } from "../../components/security";

// ─────────────────────────────────────────────────────────────
// Path Registration
// ─────────────────────────────────────────────────────────────

export function registerPeoplePaths(registry: OpenAPIRegistry) {
  // ─────────────────────────────────────────────────────────────
  // GET /api/context/people - List people
  // ─────────────────────────────────────────────────────────────
  registry.registerPath({
    method: "get",
    path: "/api/context/people",
    tags: ["Context - People"],
    summary: "List people",
    description: `
Retrieve a paginated list of people/contacts.

**Features:**
- Cursor-based pagination for efficient large result sets
- Filter by type, source, or tags
- Text search across name, email, and company fields
- Option to include soft-deleted records
    `.trim(),
    security: protectedEndpoint,
    request: {
      query: PersonListQuerySchema,
    },
    responses: {
      200: {
        description: "Paginated list of people",
        headers: rateLimitHeaders,
        content: {
          "application/json": {
            schema: PaginatedPeopleSchema,
            example: {
              items: [
                {
                  id: "clx1234567890abcdef",
                  name: "John Smith",
                  email: "john@example.com",
                  phone: "+1 555-123-4567",
                  type: "colleague",
                  importance: 7,
                  company: "Acme Corp",
                  title: "Senior Engineer",
                  source: "gmail",
                  tags: ["work", "engineering"],
                  createdAt: "2024-01-15T10:30:00Z",
                  updatedAt: "2024-01-15T10:30:00Z",
                },
              ],
              hasMore: true,
              nextCursor: "clx9876543210fedcba",
            },
          },
        },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
      429: { $ref: "#/components/responses/RateLimited" },
      500: { $ref: "#/components/responses/InternalError" },
    },
  });

  // ─────────────────────────────────────────────────────────────
  // POST /api/context/people - Create person
  // ─────────────────────────────────────────────────────────────
  registry.registerPath({
    method: "post",
    path: "/api/context/people",
    tags: ["Context - People"],
    summary: "Create person",
    description: `
Create a new person in the context system.

**Duplicate Handling:**
- If a person with the same email already exists, returns 409 Conflict
- Use PATCH to update existing records
    `.trim(),
    security: protectedEndpoint,
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: PersonCreateSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Person created successfully",
        headers: rateLimitHeaders,
        content: {
          "application/json": {
            schema: PersonSchema,
          },
        },
      },
      400: { $ref: "#/components/responses/ValidationError" },
      401: { $ref: "#/components/responses/Unauthorized" },
      409: { $ref: "#/components/responses/Conflict" },
      429: { $ref: "#/components/responses/RateLimited" },
      500: { $ref: "#/components/responses/InternalError" },
    },
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/context/people/{id} - Get person
  // ─────────────────────────────────────────────────────────────
  registry.registerPath({
    method: "get",
    path: "/api/context/people/{id}",
    tags: ["Context - People"],
    summary: "Get person by ID",
    description: "Retrieve a single person by their unique identifier.",
    security: protectedEndpoint,
    request: {
      params: z.object({
        id: z.string().openapi({
          description: "Person ID (CUID)",
          example: "clx1234567890abcdef",
        }),
      }),
    },
    responses: {
      200: {
        description: "Person details",
        content: {
          "application/json": {
            schema: PersonSchema,
          },
        },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
      500: { $ref: "#/components/responses/InternalError" },
    },
  });

  // ─────────────────────────────────────────────────────────────
  // PATCH /api/context/people/{id} - Update person
  // ─────────────────────────────────────────────────────────────
  registry.registerPath({
    method: "patch",
    path: "/api/context/people/{id}",
    tags: ["Context - People"],
    summary: "Update person",
    description: `
Update an existing person's information.

**Restore Deleted:**
To restore a soft-deleted person, send \`{ "restore": true }\`
    `.trim(),
    security: protectedEndpoint,
    request: {
      params: z.object({
        id: z.string().openapi({
          description: "Person ID (CUID)",
          example: "clx1234567890abcdef",
        }),
      }),
      body: {
        required: true,
        content: {
          "application/json": {
            schema: PersonUpdateSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Person updated successfully",
        content: {
          "application/json": {
            schema: PersonSchema,
          },
        },
      },
      400: { $ref: "#/components/responses/ValidationError" },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
      500: { $ref: "#/components/responses/InternalError" },
    },
  });

  // ─────────────────────────────────────────────────────────────
  // DELETE /api/context/people/{id} - Delete person
  // ─────────────────────────────────────────────────────────────
  registry.registerPath({
    method: "delete",
    path: "/api/context/people/{id}",
    tags: ["Context - People"],
    summary: "Delete person",
    description: `
Soft-delete a person. The record is not permanently removed and can be
restored using PATCH with \`{ "restore": true }\`.

To include soft-deleted records in list queries, use \`?includeDeleted=true\`.
    `.trim(),
    security: protectedEndpoint,
    request: {
      params: z.object({
        id: z.string().openapi({
          description: "Person ID (CUID)",
          example: "clx1234567890abcdef",
        }),
      }),
    },
    responses: {
      200: {
        description: "Person deleted successfully",
        content: {
          "application/json": {
            schema: DeleteSuccessSchema,
          },
        },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
      500: { $ref: "#/components/responses/InternalError" },
    },
  });
}
