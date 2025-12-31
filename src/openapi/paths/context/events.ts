// ═══════════════════════════════════════════════════════════════════════════
// Events API Path Definitions
// ═══════════════════════════════════════════════════════════════════════════

import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "../../components/schemas/common";
import {
  EventSchema,
  EventCreateSchema,
  EventUpdateSchema,
  EventListQuerySchema,
  PaginatedEventsSchema,
  DeleteSuccessSchema,
  rateLimitHeaders,
} from "../../components";
import { protectedEndpoint } from "../../components/security";

export function registerEventsPaths(registry: OpenAPIRegistry) {
  // GET /api/context/events
  registry.registerPath({
    method: "get",
    path: "/api/context/events",
    tags: ["Context - Events"],
    summary: "List events",
    description:
      "Retrieve a paginated list of events with date range and status filtering.",
    security: protectedEndpoint,
    request: { query: EventListQuerySchema },
    responses: {
      200: {
        description: "Paginated list of events",
        headers: rateLimitHeaders,
        content: { "application/json": { schema: PaginatedEventsSchema } },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  // POST /api/context/events
  registry.registerPath({
    method: "post",
    path: "/api/context/events",
    tags: ["Context - Events"],
    summary: "Create event",
    description: "Create a new event/calendar item.",
    security: protectedEndpoint,
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: EventCreateSchema } },
      },
    },
    responses: {
      201: {
        description: "Event created",
        content: { "application/json": { schema: EventSchema } },
      },
      400: { $ref: "#/components/responses/ValidationError" },
      401: { $ref: "#/components/responses/Unauthorized" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  // GET /api/context/events/{id}
  registry.registerPath({
    method: "get",
    path: "/api/context/events/{id}",
    tags: ["Context - Events"],
    summary: "Get event by ID",
    security: protectedEndpoint,
    request: {
      params: z.object({
        id: z.string().openapi({ example: "clx1234567890abcdef" }),
      }),
    },
    responses: {
      200: {
        description: "Event details",
        content: { "application/json": { schema: EventSchema } },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
    },
  });

  // PATCH /api/context/events/{id}
  registry.registerPath({
    method: "patch",
    path: "/api/context/events/{id}",
    tags: ["Context - Events"],
    summary: "Update event",
    security: protectedEndpoint,
    request: {
      params: z.object({ id: z.string() }),
      body: {
        required: true,
        content: { "application/json": { schema: EventUpdateSchema } },
      },
    },
    responses: {
      200: {
        description: "Event updated",
        content: { "application/json": { schema: EventSchema } },
      },
      400: { $ref: "#/components/responses/ValidationError" },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
    },
  });

  // DELETE /api/context/events/{id}
  registry.registerPath({
    method: "delete",
    path: "/api/context/events/{id}",
    tags: ["Context - Events"],
    summary: "Delete event",
    description:
      "Soft-delete an event. Can be restored via PATCH with `{ restore: true }`.",
    security: protectedEndpoint,
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: "Event deleted",
        content: { "application/json": { schema: DeleteSuccessSchema } },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
    },
  });
}
