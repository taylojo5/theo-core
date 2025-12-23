// ═══════════════════════════════════════════════════════════════════════════
// Gmail OpenAPI Schemas
// Schema definitions for Gmail integration endpoints
// ═══════════════════════════════════════════════════════════════════════════

import { z, MetadataSchema, createPaginatedSchema } from "./common";

// ─────────────────────────────────────────────────────────────
// Draft Schemas
// ─────────────────────────────────────────────────────────────

export const DraftCreateSchema = z
  .object({
    to: z.array(z.string().email()).min(1).openapi({
      description: "Recipient email addresses",
      example: ["john@example.com"],
    }),
    cc: z.array(z.string().email()).optional().openapi({
      description: "CC email addresses",
    }),
    bcc: z.array(z.string().email()).optional().openapi({
      description: "BCC email addresses",
    }),
    subject: z.string().min(1).openapi({
      description: "Email subject",
      example: "Project Update",
    }),
    body: z.string().min(1).openapi({
      description: "Plain text email body",
      example: "Hi John, here's the latest update...",
    }),
    bodyHtml: z.string().optional().openapi({
      description: "HTML email body (optional)",
    }),
    threadId: z.string().optional().openapi({
      description: "Gmail thread ID for replies",
    }),
    inReplyTo: z.string().optional().openapi({
      description: "Message-ID header for threading",
    }),
    references: z.array(z.string()).optional().openapi({
      description: "References header for threading",
    }),
  })
  .openapi("DraftCreate");

export const DraftSchema = z
  .object({
    id: z.string().openapi({ description: "Draft ID" }),
    gmailDraftId: z.string().openapi({ description: "Gmail's draft ID" }),
    gmailMessageId: z.string().nullable(),
    to: z.array(z.string()),
    cc: z.array(z.string()).nullable(),
    bcc: z.array(z.string()).nullable(),
    subject: z.string(),
    snippet: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Draft");

export const DraftListResponseSchema = z
  .object({
    drafts: z.array(DraftSchema),
    nextPageToken: z.string().nullable().openapi({
      description: "Token for fetching next page",
    }),
  })
  .openapi("DraftListResponse");

// ─────────────────────────────────────────────────────────────
// Approval Schemas
// ─────────────────────────────────────────────────────────────

export const ApprovalRequestSchema = z
  .object({
    to: z.array(z.string().email()).min(1),
    cc: z.array(z.string().email()).optional(),
    bcc: z.array(z.string().email()).optional(),
    subject: z.string().min(1),
    body: z.string().min(1),
    bodyHtml: z.string().optional(),
    threadId: z.string().optional(),
    inReplyTo: z.string().optional(),
    references: z.array(z.string()).optional(),
    requestedBy: z.string().optional().openapi({
      description: "Who requested this approval (e.g., AI agent)",
    }),
    expiresInMinutes: z.number().positive().optional().openapi({
      description: "Minutes until approval expires",
      example: 60,
    }),
    metadata: MetadataSchema.optional(),
  })
  .openapi("ApprovalRequest");

export const ApprovalSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    draftId: z.string().nullable(),
    gmailDraftId: z.string().nullable(),
    to: z.array(z.string()),
    cc: z.array(z.string()).nullable(),
    bcc: z.array(z.string()).nullable(),
    subject: z.string(),
    body: z.string(),
    bodyHtml: z.string().nullable(),
    status: z.enum(["pending", "approved", "rejected", "expired", "sent"]),
    requestedBy: z.string().nullable(),
    approvedAt: z.string().datetime().nullable(),
    rejectedAt: z.string().datetime().nullable(),
    expiresAt: z.string().datetime().nullable(),
    sentAt: z.string().datetime().nullable(),
    notes: z.string().nullable(),
    metadata: MetadataSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Approval");

export const ApprovalActionSchema = z
  .object({
    action: z.enum(["approve", "reject"]).openapi({
      description: "Action to take on the approval",
    }),
    notes: z.string().optional().openapi({
      description: "Optional notes about the decision",
    }),
  })
  .openapi("ApprovalAction");

export const ApprovalListResponseSchema = z
  .object({
    approvals: z.array(ApprovalSchema),
    count: z.number(),
    offset: z.number(),
    limit: z.number(),
  })
  .openapi("ApprovalListResponse");

export const ApprovalStatsSchema = z
  .object({
    pending: z.number(),
    approved: z.number(),
    rejected: z.number(),
    expired: z.number(),
    sent: z.number(),
    total: z.number(),
  })
  .openapi("ApprovalStats");

// ─────────────────────────────────────────────────────────────
// Sync Schemas
// ─────────────────────────────────────────────────────────────

export const SyncTriggerSchema = z
  .object({
    type: z.enum(["auto", "full", "incremental"]).optional().openapi({
      description: "Type of sync to trigger",
    }),
    enableRecurring: z.boolean().optional().openapi({
      description: "Enable/disable recurring sync",
    }),
  })
  .openapi("SyncTrigger");

export const SyncConfigSchema = z
  .object({
    syncLabels: z.array(z.string()).optional().openapi({
      description: "Labels to include in sync",
    }),
    excludeLabels: z.array(z.string()).optional().openapi({
      description: "Labels to exclude from sync",
    }),
    maxEmailAgeDays: z.number().min(1).max(365).optional().openapi({
      description: "Maximum age of emails to sync (in days)",
      example: 90,
    }),
    syncAttachments: z.boolean().optional().openapi({
      description: "Whether to sync attachment metadata",
    }),
  })
  .openapi("SyncConfig");

export const SyncStatusSchema = z
  .object({
    status: z.enum(["idle", "syncing", "error"]),
    lastSyncAt: z.string().datetime().nullable(),
    lastFullSyncAt: z.string().datetime().nullable(),
    emailCount: z.number(),
    syncedEmailCount: z.number(),
    errorMessage: z.string().nullable(),
    recurring: z.boolean(),
    nextSyncAt: z.string().datetime().nullable(),
  })
  .openapi("SyncStatus");

// ─────────────────────────────────────────────────────────────
// Send Email Schema
// ─────────────────────────────────────────────────────────────

export const SendEmailSchema = z
  .object({
    to: z.array(z.string().email()).min(1),
    cc: z.array(z.string().email()).optional(),
    bcc: z.array(z.string().email()).optional(),
    subject: z.string().min(1),
    body: z.string().min(1),
    bodyHtml: z.string().optional(),
    threadId: z.string().optional(),
    inReplyTo: z.string().optional(),
    references: z.array(z.string()).optional(),
    requireApproval: z.boolean().openapi({
      description: "If true, creates an approval request instead of sending immediately",
    }),
    requestedBy: z.string().optional(),
    expiresInMinutes: z.number().positive().optional(),
  })
  .openapi("SendEmail");

export const SendFromDraftSchema = z
  .object({
    draftId: z.string().openapi({
      description: "ID of the draft to send",
    }),
  })
  .openapi("SendFromDraft");

// ─────────────────────────────────────────────────────────────
// Thread Schema
// ─────────────────────────────────────────────────────────────

export const EmailMessageSchema = z
  .object({
    id: z.string(),
    gmailMessageId: z.string(),
    threadId: z.string(),
    from: z.string(),
    to: z.array(z.string()),
    cc: z.array(z.string()).nullable(),
    subject: z.string(),
    snippet: z.string(),
    bodyText: z.string().nullable(),
    bodyHtml: z.string().nullable(),
    receivedAt: z.string().datetime(),
    isRead: z.boolean(),
    isStarred: z.boolean(),
    labels: z.array(z.string()),
  })
  .openapi("EmailMessage");

export const ThreadSchema = z
  .object({
    id: z.string(),
    gmailThreadId: z.string(),
    subject: z.string(),
    snippet: z.string(),
    messageCount: z.number(),
    participants: z.array(z.string()),
    messages: z.array(EmailMessageSchema),
    lastMessageAt: z.string().datetime(),
  })
  .openapi("Thread");

// ─────────────────────────────────────────────────────────────
// Connection Status Schema
// ─────────────────────────────────────────────────────────────

export const GmailConnectionStatusSchema = z
  .object({
    connected: z.boolean(),
    hasRequiredScopes: z.boolean(),
    missingScopes: z.array(z.string()),
  })
  .openapi("GmailConnectionStatus");

export const GmailConnectResponseSchema = z
  .object({
    success: z.boolean(),
    alreadyConnected: z.boolean().optional(),
    signInRequired: z.boolean().optional(),
    authorizationParams: z
      .object({
        scope: z.string(),
        prompt: z.string(),
        access_type: z.string(),
        include_granted_scopes: z.string(),
      })
      .optional(),
    callbackUrl: z.string().optional(),
    message: z.string().optional(),
    error: z.string().optional(),
  })
  .openapi("GmailConnectResponse");

