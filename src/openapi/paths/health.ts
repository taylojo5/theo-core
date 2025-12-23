// ═══════════════════════════════════════════════════════════════════════════
// Health Check Path Definitions
// ═══════════════════════════════════════════════════════════════════════════

import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "../components/schemas/common";

// ─────────────────────────────────────────────────────────────
// Response Schemas
// ─────────────────────────────────────────────────────────────

const HealthResponseSchema = z
  .object({
    status: z.enum(["healthy", "degraded", "unhealthy"]).openapi({
      description: "Overall system health status",
      example: "healthy",
    }),
    checks: z.object({
      database: z.boolean().openapi({
        description: "PostgreSQL database connectivity",
      }),
      redis: z.boolean().openapi({
        description: "Redis cache connectivity",
      }),
    }),
    timestamp: z.string().datetime().openapi({
      example: "2024-01-15T10:30:00.000Z",
    }),
    version: z.string().openapi({
      description: "Application version",
      example: "0.1.0",
    }),
    environment: z.string().openapi({
      description: "Runtime environment",
      example: "development",
    }),
  })
  .openapi("HealthResponse");

// ─────────────────────────────────────────────────────────────
// Path Registration
// ─────────────────────────────────────────────────────────────

export function registerHealthPaths(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/api/health",
    tags: ["Health"],
    summary: "System health check",
    description: `
Check the health status of the API and its dependencies.

**Status Values:**
- \`healthy\` - All systems operational
- \`degraded\` - Database up but Redis unavailable (rate limiting uses fallback)
- \`unhealthy\` - Critical systems down

This endpoint does not require authentication and is suitable for 
load balancer health checks and monitoring systems.
    `.trim(),
    responses: {
      200: {
        description: "System is healthy or degraded",
        content: {
          "application/json": {
            schema: HealthResponseSchema,
            examples: {
              healthy: {
                summary: "Fully operational",
                value: {
                  status: "healthy",
                  checks: { database: true, redis: true },
                  timestamp: "2024-01-15T10:30:00.000Z",
                  version: "0.1.0",
                  environment: "production",
                },
              },
              degraded: {
                summary: "Redis unavailable",
                value: {
                  status: "degraded",
                  checks: { database: true, redis: false },
                  timestamp: "2024-01-15T10:30:00.000Z",
                  version: "0.1.0",
                  environment: "production",
                },
              },
            },
          },
        },
      },
      503: {
        description: "System is unhealthy",
        content: {
          "application/json": {
            schema: HealthResponseSchema,
            example: {
              status: "unhealthy",
              checks: { database: false, redis: false },
              timestamp: "2024-01-15T10:30:00.000Z",
              version: "0.1.0",
              environment: "production",
            },
          },
        },
      },
    },
  });
}
