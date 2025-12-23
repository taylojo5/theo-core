// ═══════════════════════════════════════════════════════════════════════════
// Integration Status API Path Definitions
// ═══════════════════════════════════════════════════════════════════════════

import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "../../components/schemas/common";
import { protectedEndpoint } from "../../components/security";

const IntegrationStatusSchema = z
  .object({
    authenticated: z.boolean(),
    google: z.object({
      connected: z.boolean(),
      email: z.string().optional(),
      tokenHealth: z
        .object({
          hasRefreshToken: z.boolean(),
          isExpired: z.boolean(),
          expiresIn: z.number().optional(),
          expiresInHuman: z.string().optional(),
        })
        .optional(),
    }),
    gmail: z.object({
      connected: z.boolean(),
      canRead: z.boolean(),
      canSend: z.boolean(),
      canManageLabels: z.boolean(),
      syncStatus: z.string().optional(),
      lastSyncAt: z.string().datetime().optional(),
      emailCount: z.number().optional(),
    }),
    contacts: z.object({
      connected: z.boolean(),
      contactCount: z.number().optional(),
    }),
    missingScopes: z.array(z.string()),
    upgradeRequired: z.boolean(),
  })
  .openapi("IntegrationStatus");

export function registerIntegrationStatusPaths(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/api/integrations/status",
    tags: ["Integrations"],
    summary: "Get integration status",
    description: `
Check the status of all connected integrations.

Returns information about:
- Google account connection and token health
- Gmail permissions and sync status
- Contacts sync status
- Missing OAuth scopes that need to be granted
    `.trim(),
    security: protectedEndpoint,
    responses: {
      200: {
        description: "Integration status",
        content: {
          "application/json": {
            schema: IntegrationStatusSchema,
            example: {
              authenticated: true,
              google: {
                connected: true,
                email: "user@example.com",
                tokenHealth: {
                  hasRefreshToken: true,
                  isExpired: false,
                  expiresIn: 3500,
                  expiresInHuman: "58 minutes",
                },
              },
              gmail: {
                connected: true,
                canRead: true,
                canSend: true,
                canManageLabels: true,
                syncStatus: "idle",
                lastSyncAt: "2024-01-15T10:30:00Z",
                emailCount: 1250,
              },
              contacts: {
                connected: true,
                contactCount: 42,
              },
              missingScopes: [],
              upgradeRequired: false,
            },
          },
        },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
    },
  });
}

