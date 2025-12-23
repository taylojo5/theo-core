// ═══════════════════════════════════════════════════════════════════════════
// Places API Path Definitions
// ═══════════════════════════════════════════════════════════════════════════

import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "../../components/schemas/common";
import {
  PlaceSchema,
  PlaceCreateSchema,
  PlaceUpdateSchema,
  PlaceListQuerySchema,
  PaginatedPlacesSchema,
  DeleteSuccessSchema,
  rateLimitHeaders,
} from "../../components";
import { protectedEndpoint } from "../../components/security";

export function registerPlacesPaths(registry: OpenAPIRegistry) {
  // GET /api/context/places
  registry.registerPath({
    method: "get",
    path: "/api/context/places",
    tags: ["Context - Places"],
    summary: "List places",
    description: "Retrieve a paginated list of places/locations with optional filtering.",
    security: protectedEndpoint,
    request: { query: PlaceListQuerySchema },
    responses: {
      200: {
        description: "Paginated list of places",
        headers: rateLimitHeaders,
        content: { "application/json": { schema: PaginatedPlacesSchema } },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  // POST /api/context/places
  registry.registerPath({
    method: "post",
    path: "/api/context/places",
    tags: ["Context - Places"],
    summary: "Create place",
    description: "Create a new place in the context system.",
    security: protectedEndpoint,
    request: {
      body: { required: true, content: { "application/json": { schema: PlaceCreateSchema } } },
    },
    responses: {
      201: {
        description: "Place created",
        content: { "application/json": { schema: PlaceSchema } },
      },
      400: { $ref: "#/components/responses/ValidationError" },
      401: { $ref: "#/components/responses/Unauthorized" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  // GET /api/context/places/{id}
  registry.registerPath({
    method: "get",
    path: "/api/context/places/{id}",
    tags: ["Context - Places"],
    summary: "Get place by ID",
    security: protectedEndpoint,
    request: {
      params: z.object({ id: z.string().openapi({ example: "clx1234567890abcdef" }) }),
    },
    responses: {
      200: { description: "Place details", content: { "application/json": { schema: PlaceSchema } } },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
    },
  });

  // PATCH /api/context/places/{id}
  registry.registerPath({
    method: "patch",
    path: "/api/context/places/{id}",
    tags: ["Context - Places"],
    summary: "Update place",
    security: protectedEndpoint,
    request: {
      params: z.object({ id: z.string() }),
      body: { required: true, content: { "application/json": { schema: PlaceUpdateSchema } } },
    },
    responses: {
      200: { description: "Place updated", content: { "application/json": { schema: PlaceSchema } } },
      400: { $ref: "#/components/responses/ValidationError" },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
    },
  });

  // DELETE /api/context/places/{id}
  registry.registerPath({
    method: "delete",
    path: "/api/context/places/{id}",
    tags: ["Context - Places"],
    summary: "Delete place",
    description: "Soft-delete a place. Can be restored via PATCH with `{ restore: true }`.",
    security: protectedEndpoint,
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: { description: "Place deleted", content: { "application/json": { schema: DeleteSuccessSchema } } },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
    },
  });
}

