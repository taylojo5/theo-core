// ═══════════════════════════════════════════════════════════════════════════
// Calendar Integration API Path Definitions
// ═══════════════════════════════════════════════════════════════════════════

import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "../../components/schemas/common";
import {
  CalendarSchema,
  CalendarListResponseSchema,
  CalendarUpdateSchema,
  CalendarEventSchema,
  CalendarEventListResponseSchema,
  CalendarEventCreateSchema,
  CalendarEventUpdateSchema,
  EventResponseSchema,
  CalendarApprovalSchema,
  CalendarApprovalListResponseSchema,
  CalendarApprovalActionSchema,
  CalendarSyncTriggerSchema,
  CalendarSyncStatusSchema,
  CalendarWebhookResponseSchema,
  CalendarActionResultSchema,
  CalendarApprovalResultSchema,
  DeleteSuccessSchema,
  rateLimitHeaders,
} from "../../components";
import { protectedEndpoint } from "../../components/security";

export function registerCalendarPaths(registry: OpenAPIRegistry) {
  // ─────────────────────────────────────────────────────────────
  // Connection Management
  // ─────────────────────────────────────────────────────────────

  registry.registerPath({
    method: "get",
    path: "/api/integrations/calendar/connect",
    tags: ["Calendar"],
    summary: "Get Calendar connection status",
    description:
      "Check if the user has connected their Google Calendar and what permissions are granted.",
    security: protectedEndpoint,
    responses: {
      200: {
        description: "Connection status",
        headers: rateLimitHeaders,
        content: {
          "application/json": {
            schema: z.object({
              connected: z.boolean().openapi({
                description: "Whether Calendar is connected (has read access)",
              }),
              hasRequiredScopes: z.boolean().openapi({
                description: "Whether all required scopes are granted",
              }),
              canRead: z.boolean().openapi({
                description: "Whether read access is granted",
              }),
              canWrite: z.boolean().openapi({
                description: "Whether write access is granted",
              }),
              missingScopes: z.array(z.string()).openapi({
                description: "List of scopes that are not yet granted",
              }),
            }),
          },
        },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/integrations/calendar/connect",
    tags: ["Calendar"],
    summary: "Initiate Calendar connection",
    description:
      "Start the OAuth flow to connect Google Calendar. Returns authorization parameters for the client to use with NextAuth signIn().",
    security: protectedEndpoint,
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              force: z.boolean().optional().openapi({
                description: "Force re-consent even if already connected",
              }),
              redirectUrl: z.string().optional().openapi({
                description: "URL to redirect to after successful connection",
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Connection initiated or already connected",
        headers: rateLimitHeaders,
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              alreadyConnected: z.boolean().optional().openapi({
                description: "True if already connected with required scopes",
              }),
              signInRequired: z.boolean().optional().openapi({
                description: "True if client should initiate OAuth flow",
              }),
              authorizationParams: z
                .object({
                  scope: z.string(),
                  prompt: z.string(),
                  access_type: z.string(),
                  include_granted_scopes: z.string(),
                })
                .optional()
                .openapi({
                  description:
                    "Parameters to pass to signIn() if signInRequired",
                }),
              callbackUrl: z.string().optional().openapi({
                description: "URL for after OAuth completes",
              }),
              message: z.string().optional(),
              error: z.string().optional(),
            }),
          },
        },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/integrations/calendar/disconnect",
    tags: ["Calendar"],
    summary: "Disconnect Calendar integration",
    description:
      "Disconnect the user's Google Calendar. Stops sync, removes webhooks, and clears stored calendar data.",
    security: protectedEndpoint,
    responses: {
      200: {
        description: "Calendar disconnected",
        headers: rateLimitHeaders,
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              message: z.string().optional(),
              calendarsRemoved: z.number().optional().openapi({
                description: "Number of calendars removed from database",
              }),
              eventsRemoved: z.number().optional().openapi({
                description: "Number of events removed from database",
              }),
            }),
          },
        },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  // ─────────────────────────────────────────────────────────────
  // Calendars
  // ─────────────────────────────────────────────────────────────

  registry.registerPath({
    method: "get",
    path: "/api/integrations/calendar/calendars",
    tags: ["Calendar"],
    summary: "List user's calendars",
    description: "Get all calendars synced for the authenticated user.",
    security: protectedEndpoint,
    request: {
      query: z.object({
        includeHidden: z.string().optional().openapi({
          description: "Include hidden calendars",
        }),
        selectedOnly: z.string().optional().openapi({
          description: "Only return selected calendars",
        }),
      }),
    },
    responses: {
      200: {
        description: "List of calendars",
        headers: rateLimitHeaders,
        content: { "application/json": { schema: CalendarListResponseSchema } },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/integrations/calendar/calendars/{id}",
    tags: ["Calendar"],
    summary: "Get calendar details",
    security: protectedEndpoint,
    request: {
      params: z.object({
        id: z.string().openapi({ description: "Calendar ID" }),
      }),
    },
    responses: {
      200: {
        description: "Calendar details",
        headers: rateLimitHeaders,
        content: {
          "application/json": {
            schema: z.object({ calendar: CalendarSchema }),
          },
        },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/api/integrations/calendar/calendars/{id}",
    tags: ["Calendar"],
    summary: "Update calendar settings",
    description: "Update calendar selection and visibility settings.",
    security: protectedEndpoint,
    request: {
      params: z.object({
        id: z.string().openapi({ description: "Calendar ID" }),
      }),
      body: {
        content: { "application/json": { schema: CalendarUpdateSchema } },
      },
    },
    responses: {
      200: {
        description: "Updated calendar",
        headers: rateLimitHeaders,
        content: {
          "application/json": {
            schema: z.object({ calendar: CalendarSchema }),
          },
        },
      },
      400: { $ref: "#/components/responses/ValidationError" },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  // ─────────────────────────────────────────────────────────────
  // Sync
  // ─────────────────────────────────────────────────────────────

  registry.registerPath({
    method: "get",
    path: "/api/integrations/calendar/sync",
    tags: ["Calendar"],
    summary: "Get sync status",
    description: "Get the current calendar sync status and statistics.",
    security: protectedEndpoint,
    responses: {
      200: {
        description: "Sync status",
        headers: rateLimitHeaders,
        content: { "application/json": { schema: CalendarSyncStatusSchema } },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/integrations/calendar/sync",
    tags: ["Calendar"],
    summary: "Trigger calendar sync",
    description:
      "Schedule a calendar sync job. Supports auto, full, or incremental sync.",
    security: protectedEndpoint,
    request: {
      body: {
        content: { "application/json": { schema: CalendarSyncTriggerSchema } },
      },
    },
    responses: {
      200: {
        description: "Sync scheduled",
        headers: rateLimitHeaders,
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              message: z.string(),
              jobId: z.string().optional(),
              syncType: z.string().nullable(),
              recurring: z.boolean(),
              currentStatus: z.string(),
            }),
          },
        },
      },
      400: { $ref: "#/components/responses/ValidationError" },
      401: { $ref: "#/components/responses/Unauthorized" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/integrations/calendar/sync",
    tags: ["Calendar"],
    summary: "Stop sync",
    description: "Stop recurring sync and clear error state.",
    security: protectedEndpoint,
    responses: {
      200: {
        description: "Sync stopped",
        headers: rateLimitHeaders,
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              message: z.string(),
            }),
          },
        },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  // ─────────────────────────────────────────────────────────────
  // Events
  // ─────────────────────────────────────────────────────────────

  registry.registerPath({
    method: "get",
    path: "/api/integrations/calendar/events",
    tags: ["Calendar"],
    summary: "List events",
    description:
      "Get calendar events with optional filtering by date, calendar, and search query.",
    security: protectedEndpoint,
    request: {
      query: z.object({
        query: z.string().optional().openapi({
          description: "Search query for event title/description",
        }),
        calendarId: z.string().optional().openapi({
          description: "Filter by calendar ID",
        }),
        startDate: z.string().optional().openapi({
          description: "Filter events starting after this date (ISO 8601)",
        }),
        endDate: z.string().optional().openapi({
          description: "Filter events ending before this date (ISO 8601)",
        }),
        today: z.string().optional().openapi({
          description: "Get today's events only",
        }),
        thisWeek: z.string().optional().openapi({
          description: "Get this week's events only",
        }),
        limit: z.string().optional().openapi({
          description: "Maximum number of events to return",
        }),
        offset: z.string().optional().openapi({
          description: "Number of events to skip",
        }),
        orderBy: z.string().optional().openapi({
          description: "Field to order by",
        }),
        order: z.string().optional().openapi({
          description: "Order direction (asc/desc)",
        }),
      }),
    },
    responses: {
      200: {
        description: "List of events",
        headers: rateLimitHeaders,
        content: {
          "application/json": { schema: CalendarEventListResponseSchema },
        },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/integrations/calendar/events",
    tags: ["Calendar"],
    summary: "Request event creation",
    description:
      "Request creation of a new calendar event. Goes through approval workflow.",
    security: protectedEndpoint,
    request: {
      body: {
        content: { "application/json": { schema: CalendarEventCreateSchema } },
      },
    },
    responses: {
      201: {
        description: "Approval request created",
        headers: rateLimitHeaders,
        content: { "application/json": { schema: CalendarActionResultSchema } },
      },
      400: { $ref: "#/components/responses/ValidationError" },
      401: { $ref: "#/components/responses/Unauthorized" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/integrations/calendar/events/{id}",
    tags: ["Calendar"],
    summary: "Get event details",
    security: protectedEndpoint,
    request: {
      params: z.object({
        id: z.string().openapi({ description: "Event ID" }),
      }),
    },
    responses: {
      200: {
        description: "Event details",
        headers: rateLimitHeaders,
        content: {
          "application/json": {
            schema: z.object({ event: CalendarEventSchema }),
          },
        },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/api/integrations/calendar/events/{id}",
    tags: ["Calendar"],
    summary: "Request event update",
    description:
      "Request update of an existing calendar event. Goes through approval workflow.",
    security: protectedEndpoint,
    request: {
      params: z.object({
        id: z.string().openapi({ description: "Event ID" }),
      }),
      body: {
        content: { "application/json": { schema: CalendarEventUpdateSchema } },
      },
    },
    responses: {
      200: {
        description: "Approval request created",
        headers: rateLimitHeaders,
        content: { "application/json": { schema: CalendarActionResultSchema } },
      },
      400: { $ref: "#/components/responses/ValidationError" },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/integrations/calendar/events/{id}",
    tags: ["Calendar"],
    summary: "Request event deletion",
    description:
      "Request deletion of a calendar event. Goes through approval workflow.",
    security: protectedEndpoint,
    request: {
      params: z.object({
        id: z.string().openapi({ description: "Event ID" }),
      }),
      query: z.object({
        reason: z.string().optional().openapi({
          description: "Reason for deletion",
        }),
        sendUpdates: z.string().optional().openapi({
          description: "Who to send cancellation notifications to",
        }),
      }),
    },
    responses: {
      200: {
        description: "Approval request created",
        headers: rateLimitHeaders,
        content: { "application/json": { schema: CalendarActionResultSchema } },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/integrations/calendar/events/{id}",
    tags: ["Calendar"],
    summary: "Respond to event (RSVP)",
    description:
      "Submit an RSVP response to an event invitation. Goes through approval workflow.",
    security: protectedEndpoint,
    request: {
      params: z.object({
        id: z.string().openapi({ description: "Event ID" }),
      }),
      body: {
        content: { "application/json": { schema: EventResponseSchema } },
      },
    },
    responses: {
      200: {
        description: "Approval request created",
        headers: rateLimitHeaders,
        content: { "application/json": { schema: CalendarActionResultSchema } },
      },
      400: { $ref: "#/components/responses/ValidationError" },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  // ─────────────────────────────────────────────────────────────
  // Approvals
  // ─────────────────────────────────────────────────────────────

  registry.registerPath({
    method: "get",
    path: "/api/integrations/calendar/approvals",
    tags: ["Calendar"],
    summary: "List calendar approvals",
    description: "Get pending and historical calendar action approvals.",
    security: protectedEndpoint,
    request: {
      query: z.object({
        status: z.string().optional().openapi({
          description: "Filter by approval status",
        }),
        pending: z.string().optional().openapi({
          description: "Get pending approvals only",
        }),
        limit: z.string().optional(),
        offset: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: "List of approvals",
        headers: rateLimitHeaders,
        content: {
          "application/json": { schema: CalendarApprovalListResponseSchema },
        },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/integrations/calendar/approvals/{id}",
    tags: ["Calendar"],
    summary: "Get approval details",
    security: protectedEndpoint,
    request: {
      params: z.object({
        id: z.string().openapi({ description: "Approval ID" }),
      }),
    },
    responses: {
      200: {
        description: "Approval details",
        headers: rateLimitHeaders,
        content: {
          "application/json": {
            schema: z.object({ approval: CalendarApprovalSchema }),
          },
        },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/integrations/calendar/approvals/{id}",
    tags: ["Calendar"],
    summary: "Approve, reject, or cancel approval",
    description:
      "Take action on a pending calendar approval. Approving auto-executes the action.",
    security: protectedEndpoint,
    request: {
      params: z.object({
        id: z.string().openapi({ description: "Approval ID" }),
      }),
      body: {
        content: {
          "application/json": { schema: CalendarApprovalActionSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Action result",
        headers: rateLimitHeaders,
        content: {
          "application/json": { schema: CalendarApprovalResultSchema },
        },
      },
      400: { $ref: "#/components/responses/ValidationError" },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  // ─────────────────────────────────────────────────────────────
  // Webhook
  // ─────────────────────────────────────────────────────────────

  registry.registerPath({
    method: "post",
    path: "/api/integrations/calendar/webhook",
    tags: ["Calendar"],
    summary: "Handle Google Calendar push notification",
    description:
      "Endpoint for Google Calendar push notifications. Triggers incremental sync.",
    responses: {
      200: {
        description: "Notification processed",
        headers: rateLimitHeaders,
        content: {
          "application/json": { schema: CalendarWebhookResponseSchema },
        },
      },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/integrations/calendar/webhook",
    tags: ["Calendar"],
    summary: "Webhook health check",
    description: "Health check endpoint for the webhook handler.",
    responses: {
      200: {
        description: "Webhook service status",
        headers: rateLimitHeaders,
        content: {
          "application/json": {
            schema: z.object({
              status: z.string(),
              service: z.string(),
              timestamp: z.string().datetime(),
            }),
          },
        },
      },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });
}
