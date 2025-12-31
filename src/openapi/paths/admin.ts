// ═══════════════════════════════════════════════════════════════════════════
// Admin API Path Definitions
// ═══════════════════════════════════════════════════════════════════════════

import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "../components/schemas/common";
import { protectedEndpoint } from "../components/security";

const QueueStatsSchema = z
  .object({
    name: z.string().openapi({ example: "embeddings" }),
    waiting: z.number(),
    active: z.number(),
    completed: z.number(),
    failed: z.number(),
    delayed: z.number(),
  })
  .openapi("QueueStats");

const QueueStatsResponseSchema = z
  .object({
    queues: z.array(QueueStatsSchema),
    totals: z.object({
      waiting: z.number(),
      active: z.number(),
      completed: z.number(),
      failed: z.number(),
      delayed: z.number(),
    }),
    timestamp: z.string().datetime(),
  })
  .openapi("QueueStatsResponse");

export function registerAdminPaths(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/api/admin/queues",
    tags: ["Admin"],
    summary: "Get queue statistics",
    description: `
Get statistics for all background job queues.

**Queues:**
- \`embeddings\` - AI embedding generation jobs
- \`gmail-sync\` - Email synchronization jobs

Requires authentication. Admin role check coming in future release.
    `.trim(),
    security: protectedEndpoint,
    responses: {
      200: {
        description: "Queue statistics",
        content: {
          "application/json": {
            schema: QueueStatsResponseSchema,
            example: {
              queues: [
                {
                  name: "embeddings",
                  waiting: 5,
                  active: 2,
                  completed: 1000,
                  failed: 3,
                  delayed: 0,
                },
                {
                  name: "gmail-sync",
                  waiting: 0,
                  active: 1,
                  completed: 50,
                  failed: 0,
                  delayed: 0,
                },
              ],
              totals: {
                waiting: 5,
                active: 3,
                completed: 1050,
                failed: 3,
                delayed: 0,
              },
              timestamp: "2024-01-15T10:30:00Z",
            },
          },
        },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
    },
  });
}
