// ═══════════════════════════════════════════════════════════════════════════
// Tasks API Path Definitions
// ═══════════════════════════════════════════════════════════════════════════

import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "../../components/schemas/common";
import {
  TaskSchema,
  TaskCreateSchema,
  TaskUpdateSchema,
  TaskListQuerySchema,
  PaginatedTasksSchema,
  DeleteSuccessSchema,
  rateLimitHeaders,
} from "../../components";
import { protectedEndpoint } from "../../components/security";

export function registerTasksPaths(registry: OpenAPIRegistry) {
  // GET /api/context/tasks
  registry.registerPath({
    method: "get",
    path: "/api/context/tasks",
    tags: ["Context - Tasks"],
    summary: "List tasks",
    description: "Retrieve a paginated list of tasks with status, priority, and due date filtering.",
    security: protectedEndpoint,
    request: { query: TaskListQuerySchema },
    responses: {
      200: {
        description: "Paginated list of tasks",
        headers: rateLimitHeaders,
        content: { "application/json": { schema: PaginatedTasksSchema } },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  // POST /api/context/tasks
  registry.registerPath({
    method: "post",
    path: "/api/context/tasks",
    tags: ["Context - Tasks"],
    summary: "Create task",
    description: "Create a new task. Supports subtasks via parentId.",
    security: protectedEndpoint,
    request: {
      body: { required: true, content: { "application/json": { schema: TaskCreateSchema } } },
    },
    responses: {
      201: {
        description: "Task created",
        content: { "application/json": { schema: TaskSchema } },
      },
      400: { $ref: "#/components/responses/ValidationError" },
      401: { $ref: "#/components/responses/Unauthorized" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  // GET /api/context/tasks/{id}
  registry.registerPath({
    method: "get",
    path: "/api/context/tasks/{id}",
    tags: ["Context - Tasks"],
    summary: "Get task by ID",
    security: protectedEndpoint,
    request: {
      params: z.object({ id: z.string().openapi({ example: "clx1234567890abcdef" }) }),
    },
    responses: {
      200: { description: "Task details", content: { "application/json": { schema: TaskSchema } } },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
    },
  });

  // PATCH /api/context/tasks/{id}
  registry.registerPath({
    method: "patch",
    path: "/api/context/tasks/{id}",
    tags: ["Context - Tasks"],
    summary: "Update task",
    description: "Update task fields including status changes.",
    security: protectedEndpoint,
    request: {
      params: z.object({ id: z.string() }),
      body: { required: true, content: { "application/json": { schema: TaskUpdateSchema } } },
    },
    responses: {
      200: { description: "Task updated", content: { "application/json": { schema: TaskSchema } } },
      400: { $ref: "#/components/responses/ValidationError" },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
    },
  });

  // DELETE /api/context/tasks/{id}
  registry.registerPath({
    method: "delete",
    path: "/api/context/tasks/{id}",
    tags: ["Context - Tasks"],
    summary: "Delete task",
    description: "Soft-delete a task. Can be restored via PATCH with `{ restore: true }`.",
    security: protectedEndpoint,
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: { description: "Task deleted", content: { "application/json": { schema: DeleteSuccessSchema } } },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
    },
  });
}

