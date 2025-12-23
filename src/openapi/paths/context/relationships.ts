// ═══════════════════════════════════════════════════════════════════════════
// Relationships API Path Definitions
// ═══════════════════════════════════════════════════════════════════════════

import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "../../components/schemas/common";
import {
  RelationshipSchema,
  RelationshipCreateSchema,
  RelationshipUpdateSchema,
  RelationshipListQuerySchema,
  PaginatedRelationshipsSchema,
  DeleteSuccessSchema,
  rateLimitHeaders,
} from "../../components";
import { protectedEndpoint } from "../../components/security";

export function registerRelationshipsPaths(registry: OpenAPIRegistry) {
  // GET /api/context/relationships
  registry.registerPath({
    method: "get",
    path: "/api/context/relationships",
    tags: ["Context - Relationships"],
    summary: "List relationships",
    description: "Retrieve relationships between entities. Filter by entity type/ID or relationship type.",
    security: protectedEndpoint,
    request: { query: RelationshipListQuerySchema },
    responses: {
      200: {
        description: "Paginated list of relationships",
        headers: rateLimitHeaders,
        content: { "application/json": { schema: PaginatedRelationshipsSchema } },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  // POST /api/context/relationships
  registry.registerPath({
    method: "post",
    path: "/api/context/relationships",
    tags: ["Context - Relationships"],
    summary: "Create relationship",
    description: "Create a relationship between two entities (e.g., person works_at place).",
    security: protectedEndpoint,
    request: {
      body: { required: true, content: { "application/json": { schema: RelationshipCreateSchema } } },
    },
    responses: {
      201: {
        description: "Relationship created",
        content: { "application/json": { schema: RelationshipSchema } },
      },
      400: { $ref: "#/components/responses/ValidationError" },
      401: { $ref: "#/components/responses/Unauthorized" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  // GET /api/context/relationships/{id}
  registry.registerPath({
    method: "get",
    path: "/api/context/relationships/{id}",
    tags: ["Context - Relationships"],
    summary: "Get relationship by ID",
    security: protectedEndpoint,
    request: {
      params: z.object({ id: z.string().openapi({ example: "clx1234567890abcdef" }) }),
    },
    responses: {
      200: { description: "Relationship details", content: { "application/json": { schema: RelationshipSchema } } },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
    },
  });

  // PATCH /api/context/relationships/{id}
  registry.registerPath({
    method: "patch",
    path: "/api/context/relationships/{id}",
    tags: ["Context - Relationships"],
    summary: "Update relationship",
    security: protectedEndpoint,
    request: {
      params: z.object({ id: z.string() }),
      body: { required: true, content: { "application/json": { schema: RelationshipUpdateSchema } } },
    },
    responses: {
      200: { description: "Relationship updated", content: { "application/json": { schema: RelationshipSchema } } },
      400: { $ref: "#/components/responses/ValidationError" },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
    },
  });

  // DELETE /api/context/relationships/{id}
  registry.registerPath({
    method: "delete",
    path: "/api/context/relationships/{id}",
    tags: ["Context - Relationships"],
    summary: "Delete relationship",
    description: "Permanently delete a relationship.",
    security: protectedEndpoint,
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: { description: "Relationship deleted", content: { "application/json": { schema: DeleteSuccessSchema } } },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
    },
  });
}

