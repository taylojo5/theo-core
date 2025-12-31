// ═══════════════════════════════════════════════════════════════════════════
// OpenAPI Common Response Components
// Standard error and success response definitions
// ═══════════════════════════════════════════════════════════════════════════

import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

// ─────────────────────────────────────────────────────────────
// Register Responses (using plain OpenAPI objects, not Zod)
// ─────────────────────────────────────────────────────────────

export function registerCommonResponses(registry: OpenAPIRegistry) {
  // Error schema definition (reused across responses)
  const errorSchema = {
    type: "object" as const,
    properties: {
      error: {
        type: "string" as const,
        description: "Human-readable error message",
      },
      code: {
        type: "string" as const,
        description: "Machine-readable error code",
      },
      details: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            path: {
              type: "array" as const,
              items: { type: "string" as const },
            },
            message: { type: "string" as const },
          },
        },
        description: "Validation error details",
      },
    },
    required: ["error"],
  };

  // 400 Bad Request
  registry.registerComponent("responses", "BadRequest", {
    description: "Bad Request - Invalid input or parameters",
    content: {
      "application/json": {
        schema: errorSchema,
        example: {
          error: "Invalid request parameters",
          details: [{ path: ["name"], message: "Name is required" }],
        },
      },
    },
  });

  // 401 Unauthorized
  registry.registerComponent("responses", "Unauthorized", {
    description: "Unauthorized - Authentication required",
    content: {
      "application/json": {
        schema: errorSchema,
        example: {
          error: "Unauthorized",
        },
      },
    },
  });

  // 403 Forbidden
  registry.registerComponent("responses", "Forbidden", {
    description: "Forbidden - Insufficient permissions",
    content: {
      "application/json": {
        schema: errorSchema,
        example: {
          error: "You do not have permission to access this resource",
        },
      },
    },
  });

  // 404 Not Found
  registry.registerComponent("responses", "NotFound", {
    description: "Not Found - Resource does not exist",
    content: {
      "application/json": {
        schema: errorSchema,
        example: {
          error: "Person not found",
        },
      },
    },
  });

  // 409 Conflict
  registry.registerComponent("responses", "Conflict", {
    description: "Conflict - Resource already exists or state conflict",
    content: {
      "application/json": {
        schema: errorSchema,
        example: {
          error: "A person with this email already exists",
          code: "DUPLICATE_EMAIL",
        },
      },
    },
  });

  // 422 Validation Error
  registry.registerComponent("responses", "ValidationError", {
    description: "Validation Error - Request body failed validation",
    content: {
      "application/json": {
        schema: errorSchema,
        example: {
          error: "Validation failed",
          details: [
            { path: ["email"], message: "Invalid email format" },
            { path: ["importance"], message: "Must be between 1 and 10" },
          ],
        },
      },
    },
  });

  // 429 Rate Limited
  registry.registerComponent("responses", "RateLimited", {
    description: "Too Many Requests - Rate limit exceeded",
    headers: {
      "X-RateLimit-Limit": {
        description: "Maximum requests allowed per window",
        schema: { type: "integer" },
      },
      "X-RateLimit-Remaining": {
        description: "Requests remaining in current window",
        schema: { type: "integer" },
      },
      "X-RateLimit-Reset": {
        description: "Unix timestamp when rate limit resets",
        schema: { type: "integer" },
      },
      "Retry-After": {
        description: "Seconds until rate limit resets",
        schema: { type: "integer" },
      },
    },
    content: {
      "application/json": {
        schema: errorSchema,
        example: {
          error: "Rate limit exceeded. Please retry after 60 seconds.",
        },
      },
    },
  });

  // 500 Internal Server Error
  registry.registerComponent("responses", "InternalError", {
    description: "Internal Server Error",
    content: {
      "application/json": {
        schema: errorSchema,
        example: {
          error: "An unexpected error occurred",
        },
      },
    },
  });

  // 503 Service Unavailable
  registry.registerComponent("responses", "ServiceUnavailable", {
    description: "Service Unavailable - System is degraded or down",
    content: {
      "application/json": {
        schema: errorSchema,
        example: {
          error: "Service temporarily unavailable",
        },
      },
    },
  });
}
