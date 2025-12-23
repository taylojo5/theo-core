// ═══════════════════════════════════════════════════════════════════════════
// Gmail Integration API Path Definitions
// ═══════════════════════════════════════════════════════════════════════════

import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "../../components/schemas/common";
import {
  DraftSchema,
  DraftCreateSchema,
  DraftListResponseSchema,
  ApprovalSchema,
  ApprovalRequestSchema,
  ApprovalActionSchema,
  ApprovalListResponseSchema,
  ApprovalStatsSchema,
  SyncTriggerSchema,
  SyncConfigSchema,
  SyncStatusSchema,
  SendEmailSchema,
  SendFromDraftSchema,
  ThreadSchema,
  GmailConnectionStatusSchema,
  GmailConnectResponseSchema,
  DeleteSuccessSchema,
  rateLimitHeaders,
} from "../../components";
import { protectedEndpoint } from "../../components/security";

export function registerGmailPaths(registry: OpenAPIRegistry) {
  // ─────────────────────────────────────────────────────────────
  // Connection
  // ─────────────────────────────────────────────────────────────

  registry.registerPath({
    method: "get",
    path: "/api/integrations/gmail/connect",
    tags: ["Gmail"],
    summary: "Check Gmail connection status",
    security: protectedEndpoint,
    responses: {
      200: {
        description: "Connection status",
        content: { "application/json": { schema: GmailConnectionStatusSchema } },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/integrations/gmail/connect",
    tags: ["Gmail"],
    summary: "Initiate Gmail connection",
    description: "Start OAuth flow to connect Gmail. Returns params for client-side signIn().",
    security: protectedEndpoint,
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              force: z.boolean().optional().openapi({ description: "Force re-consent" }),
              redirectUrl: z.string().optional().openapi({ description: "Redirect after OAuth" }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Connection instructions",
        content: { "application/json": { schema: GmailConnectResponseSchema } },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/integrations/gmail/disconnect",
    tags: ["Gmail"],
    summary: "Disconnect Gmail",
    description: "Revoke Gmail permissions and delete synced data.",
    security: protectedEndpoint,
    responses: {
      200: { description: "Gmail disconnected", content: { "application/json": { schema: DeleteSuccessSchema } } },
      401: { $ref: "#/components/responses/Unauthorized" },
    },
  });

  // ─────────────────────────────────────────────────────────────
  // Sync
  // ─────────────────────────────────────────────────────────────

  registry.registerPath({
    method: "post",
    path: "/api/integrations/gmail/sync",
    tags: ["Gmail"],
    summary: "Trigger email sync",
    description: "Schedule an email sync job. Supports auto, full, or incremental sync.",
    security: protectedEndpoint,
    request: {
      body: { content: { "application/json": { schema: SyncTriggerSchema } } },
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
      401: { $ref: "#/components/responses/Unauthorized" },
      429: { $ref: "#/components/responses/RateLimited" },
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/api/integrations/gmail/sync",
    tags: ["Gmail"],
    summary: "Update sync configuration",
    security: protectedEndpoint,
    request: {
      body: { content: { "application/json": { schema: SyncConfigSchema } } },
    },
    responses: {
      200: {
        description: "Config updated",
        content: {
          "application/json": {
            schema: z.object({ success: z.boolean(), message: z.string(), config: SyncConfigSchema }),
          },
        },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/integrations/gmail/sync",
    tags: ["Gmail"],
    summary: "Cancel pending syncs",
    security: protectedEndpoint,
    request: {
      query: z.object({
        stopRecurring: z.string().optional().openapi({ description: "Also stop recurring sync" }),
      }),
    },
    responses: {
      200: {
        description: "Syncs cancelled",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              message: z.string(),
              cancelled: z.number(),
              recurringStopped: z.boolean(),
            }),
          },
        },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/integrations/gmail/sync/status",
    tags: ["Gmail"],
    summary: "Get sync status",
    security: protectedEndpoint,
    responses: {
      200: { description: "Sync status", content: { "application/json": { schema: SyncStatusSchema } } },
      401: { $ref: "#/components/responses/Unauthorized" },
    },
  });

  // ─────────────────────────────────────────────────────────────
  // Drafts
  // ─────────────────────────────────────────────────────────────

  registry.registerPath({
    method: "get",
    path: "/api/integrations/gmail/drafts",
    tags: ["Gmail"],
    summary: "List drafts",
    security: protectedEndpoint,
    request: {
      query: z.object({
        maxResults: z.coerce.number().optional(),
        pageToken: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: "List of drafts",
        headers: rateLimitHeaders,
        content: { "application/json": { schema: DraftListResponseSchema } },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/integrations/gmail/drafts",
    tags: ["Gmail"],
    summary: "Create draft",
    security: protectedEndpoint,
    request: {
      body: { required: true, content: { "application/json": { schema: DraftCreateSchema } } },
    },
    responses: {
      201: { description: "Draft created", content: { "application/json": { schema: DraftSchema } } },
      400: { $ref: "#/components/responses/ValidationError" },
      401: { $ref: "#/components/responses/Unauthorized" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/integrations/gmail/drafts/{id}",
    tags: ["Gmail"],
    summary: "Get draft",
    security: protectedEndpoint,
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: { description: "Draft details", content: { "application/json": { schema: DraftSchema } } },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/integrations/gmail/drafts/{id}",
    tags: ["Gmail"],
    summary: "Delete draft",
    security: protectedEndpoint,
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: { description: "Draft deleted", content: { "application/json": { schema: DeleteSuccessSchema } } },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
    },
  });

  // ─────────────────────────────────────────────────────────────
  // Approvals
  // ─────────────────────────────────────────────────────────────

  registry.registerPath({
    method: "get",
    path: "/api/integrations/gmail/approvals",
    tags: ["Gmail"],
    summary: "List approvals",
    description: "List email approval requests. Use `stats=true` to get counts only.",
    security: protectedEndpoint,
    request: {
      query: z.object({
        status: z.enum(["pending", "approved", "rejected", "expired", "sent"]).optional(),
        pending: z.string().optional().openapi({ description: "Only pending approvals" }),
        includeExpired: z.string().optional(),
        stats: z.string().optional().openapi({ description: "Return stats only" }),
        limit: z.coerce.number().optional(),
        offset: z.coerce.number().optional(),
      }),
    },
    responses: {
      200: {
        description: "Approvals or stats",
        content: {
          "application/json": {
            schema: z.union([ApprovalListResponseSchema, ApprovalStatsSchema]),
          },
        },
      },
      401: { $ref: "#/components/responses/Unauthorized" },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/integrations/gmail/approvals",
    tags: ["Gmail"],
    summary: "Request approval",
    description: "Create an email approval request (for AI-drafted emails).",
    security: protectedEndpoint,
    request: {
      body: { required: true, content: { "application/json": { schema: ApprovalRequestSchema } } },
    },
    responses: {
      201: {
        description: "Approval created",
        content: { "application/json": { schema: ApprovalSchema } },
      },
      400: { $ref: "#/components/responses/ValidationError" },
      401: { $ref: "#/components/responses/Unauthorized" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/integrations/gmail/approvals/{id}",
    tags: ["Gmail"],
    summary: "Get approval",
    security: protectedEndpoint,
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: { description: "Approval details", content: { "application/json": { schema: ApprovalSchema } } },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/api/integrations/gmail/approvals/{id}",
    tags: ["Gmail"],
    summary: "Approve or reject",
    description: "Approve or reject an email. Approved emails are sent automatically.",
    security: protectedEndpoint,
    request: {
      params: z.object({ id: z.string() }),
      body: { required: true, content: { "application/json": { schema: ApprovalActionSchema } } },
    },
    responses: {
      200: { description: "Action completed", content: { "application/json": { schema: ApprovalSchema } } },
      400: { $ref: "#/components/responses/ValidationError" },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
    },
  });

  // ─────────────────────────────────────────────────────────────
  // Send
  // ─────────────────────────────────────────────────────────────

  registry.registerPath({
    method: "post",
    path: "/api/integrations/gmail/send",
    tags: ["Gmail"],
    summary: "Send email",
    description: "Send an email directly or from a draft. Use `requireApproval=true` for approval flow.",
    security: protectedEndpoint,
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.union([SendEmailSchema, SendFromDraftSchema]),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Email sent or approval created",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              messageId: z.string().optional(),
              threadId: z.string().optional(),
              approval: ApprovalSchema.optional(),
            }),
          },
        },
      },
      400: { $ref: "#/components/responses/ValidationError" },
      401: { $ref: "#/components/responses/Unauthorized" },
    },
  });

  // ─────────────────────────────────────────────────────────────
  // Threads
  // ─────────────────────────────────────────────────────────────

  registry.registerPath({
    method: "get",
    path: "/api/integrations/gmail/threads/{id}",
    tags: ["Gmail"],
    summary: "Get email thread",
    description: "Get a thread with all its messages.",
    security: protectedEndpoint,
    request: { params: z.object({ id: z.string().openapi({ description: "Thread ID" }) }) },
    responses: {
      200: { description: "Thread with messages", content: { "application/json": { schema: ThreadSchema } } },
      401: { $ref: "#/components/responses/Unauthorized" },
      404: { $ref: "#/components/responses/NotFound" },
    },
  });
}

