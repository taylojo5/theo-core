// ═══════════════════════════════════════════════════════════════════════════
// Deadlines API Path Definitions
// ═══════════════════════════════════════════════════════════════════════════

import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "../../components/schemas/common";
import {
  DeadlineSchema,
  DeadlineCreateSchema,
  DeadlineUpdateSchema,
  DeadlineListQuerySchema,
  PaginatedDeadlinesSchema,
  DeleteSuccessSchema,
  rateLimitHeaders,
} from "../../components";
import { protectedEndpoint } from "../../components/security";

export function registerDeadlinesPaths(registry: OpenAPIRegistry) {
  // GET /api/context/deadlines
  registry.registerPath({
    method: "get",
    path: "/api/context/deadlines",
    tags: ["Context - Deadlines"],
    summary: "List deadlines",
    description: "Retrieve a paginated list of deadlines with status and date range filtering.",
    security: protectedEndpoint,
    request: { query: DeadlineListQuerySchema },
    responses: {
      200: {
        description: "Paginated list of deadlines",
        headers: rateLimitHeaders,
        content: { "application/json": { schema: PaginatedDeadlinesSchema } },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  // POST /api/context/deadlines
  registry.registerPath({
    method: "post",
    path: "/api/context/deadlines",
    tags: ["Context - Deadlines"],
    summary: "Create deadline",
    description: "Create a new deadline or milestone.",
    security: protectedEndpoint,
    request: {
      body: { required: true, content: { "application/json": { schema: DeadlineCreateSchema } } },
    },
    responses: {
      201: {
        description: "Deadline created",
        content: { "application/json": { schema: DeadlineSchema } },
      },
      400: { $ref: "#/components/responses/ValidationError" },
      401: { $ref: "#/components/responses/Unauthorized" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  // GET /api/context/deadlines/{id}
  registry.registerPath({
    method: "get",
    path: "/api/context/deadlines/{id}",
    tags: ["Context - Deadlines"],
    summary: "Get deadline by ID",
    security: protectedEndpoint,
    request: {
      params: z.object({ id: z.string().openapi({ example: "clx1234567890abcdef" }) }),
    },
    responses: {
      200: { description: "Deadline details", content: { "application/json": { schema: DeadlineSchema } } },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
    },
  });

  // PATCH /api/context/deadlines/{id}
  registry.registerPath({
    method: "patch",
    path: "/api/context/deadlines/{id}",
    tags: ["Context - Deadlines"],
    summary: "Update deadline",
    security: protectedEndpoint,
    request: {
      params: z.object({ id: z.string() }),
      body: { required: true, content: { "application/json": { schema: DeadlineUpdateSchema } } },
    },
    responses: {
      200: { description: "Deadline updated", content: { "application/json": { schema: DeadlineSchema } } },
      400: { $ref: "#/components/responses/ValidationError" },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
    },
  });

  // DELETE /api/context/deadlines/{id}
  registry.registerPath({
    method: "delete",
    path: "/api/context/deadlines/{id}",
    tags: ["Context - Deadlines"],
    summary: "Delete deadline",
    description: "Soft-delete a deadline. Can be restored via PATCH with `{ restore: true }`.",
    security: protectedEndpoint,
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: { description: "Deadline deleted", content: { "application/json": { schema: DeleteSuccessSchema } } },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
    },
  });
}

