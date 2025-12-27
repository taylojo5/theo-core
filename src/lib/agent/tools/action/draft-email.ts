// ═══════════════════════════════════════════════════════════════════════════
// Draft Email Tool
// Action tool for creating email drafts (requires Gmail integration)
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import type { ToolDefinition } from "../types";
import { defineTool, objectSchema } from "../types";
import { createDraft, validateEmailAddresses } from "@/integrations/gmail/actions";
import { createGmailClient } from "@/integrations/gmail";
import { getValidAccessToken } from "@/lib/auth/token-refresh";

// ─────────────────────────────────────────────────────────────
// Input/Output Types
// ─────────────────────────────────────────────────────────────

/** Email address validation regex */
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Input schema for email draft */
const draftEmailInputSchema = z.object({
  to: z
    .array(z.string().regex(emailRegex, "Invalid email address"))
    .min(1, "At least one recipient is required")
    .max(50),
  cc: z.array(z.string().regex(emailRegex, "Invalid email address")).max(50).optional(),
  bcc: z.array(z.string().regex(emailRegex, "Invalid email address")).max(50).optional(),
  subject: z.string().min(1, "Subject is required").max(998), // RFC 5322 limit
  body: z.string().min(1, "Email body is required").max(100000),
  // Optional HTML body for rich formatting
  bodyHtml: z.string().max(500000).optional(),
  // Thread ID for reply drafts
  threadId: z.string().optional(),
  // In-Reply-To header for proper threading
  inReplyTo: z.string().optional(),
});

type DraftEmailInput = z.infer<typeof draftEmailInputSchema>;

/** Output type for email draft */
interface DraftEmailOutput {
  success: boolean;
  draft: {
    draftId: string;
    messageId?: string;
    threadId?: string;
  };
  recipients: {
    to: string[];
    cc?: string[];
    bcc?: string[];
  };
  subject: string;
  message: string;
}

// ─────────────────────────────────────────────────────────────
// Tool Definition
// ─────────────────────────────────────────────────────────────

export const draftEmailTool: ToolDefinition<DraftEmailInput, DraftEmailOutput> = defineTool({
  // ═══════════════════════════════════════════════════════════
  // LLM Interface
  // ═══════════════════════════════════════════════════════════
  name: "draft_email",
  description: "Create an email draft in Gmail (does not send)",

  whenToUse: `Use when the user wants to:
- Compose an email without sending: "Draft an email to...", "Write an email to..."
- Prepare a message for later: "Start an email to...", "Compose a message for..."
- Create a reply draft: "Draft a reply to...", "Prepare a response to..."

This creates a DRAFT only - the email is NOT sent.
User can review and edit before sending.
Use send_email tool if user explicitly wants to SEND immediately.`,

  examples: [
    'User: "Draft an email to john@example.com about the meeting" → draft_email({ to: ["john@example.com"], subject: "About the meeting", body: "Hi John,\\n\\n..." })',
    'User: "Write an email to sarah@company.com regarding the proposal" → draft_email({ to: ["sarah@company.com"], subject: "Regarding the proposal", body: "..." })',
    'User: "Compose a message to the team about Friday" → draft_email({ to: ["team@company.com"], subject: "Regarding Friday", body: "..." })',
    'User: "Start drafting a reply about the budget" → draft_email({ to: [...], subject: "Re: Budget", body: "...", threadId: "...", inReplyTo: "..." })',
  ],

  parametersSchema: objectSchema(
    {
      to: {
        type: "array",
        items: { type: "string", format: "email" },
        description: "Primary recipient email addresses",
      },
      cc: {
        type: "array",
        items: { type: "string", format: "email" },
        description: "CC recipient email addresses",
      },
      bcc: {
        type: "array",
        items: { type: "string", format: "email" },
        description: "BCC recipient email addresses",
      },
      subject: {
        type: "string",
        description: "Email subject line",
        minLength: 1,
        maxLength: 998,
      },
      body: {
        type: "string",
        description: "Email body (plain text)",
        minLength: 1,
      },
      bodyHtml: {
        type: "string",
        description: "Optional HTML body for rich formatting",
      },
      threadId: {
        type: "string",
        description: "Gmail thread ID (for replies)",
      },
      inReplyTo: {
        type: "string",
        description: "Message-ID header of email being replied to",
      },
    },
    ["to", "subject", "body"] // Required fields
  ),

  // ═══════════════════════════════════════════════════════════
  // Internal Configuration
  // ═══════════════════════════════════════════════════════════
  category: "draft",
  riskLevel: "low", // Draft only, no external effect until sent
  requiresApproval: false,
  requiredIntegrations: ["gmail"],

  // ═══════════════════════════════════════════════════════════
  // Validation & Execution
  // ═══════════════════════════════════════════════════════════
  inputValidator: draftEmailInputSchema,

  execute: async (input, context): Promise<DraftEmailOutput> => {
    const { to, cc, bcc, subject, body, bodyHtml, threadId, inReplyTo } = input;

    // Get OAuth access token from database
    const accessToken = await getValidAccessToken(context.userId);
    if (!accessToken) {
      throw new Error("Gmail not connected. Please connect Gmail in settings.");
    }

    // Validate all email addresses
    const allAddresses = [...to, ...(cc || []), ...(bcc || [])];
    const validation = validateEmailAddresses(allAddresses);
    if (!validation.valid) {
      throw new Error(`Invalid email addresses: ${validation.invalid.join(", ")}`);
    }

    // Create Gmail client
    const client = createGmailClient(accessToken, context.userId);

    // Create the draft
    const result = await createDraft(client, {
      to,
      cc,
      bcc,
      subject,
      body,
      bodyHtml,
      threadId,
      inReplyTo,
    });

    // Validate response before accessing properties
    if (!result || !result.draftId) {
      throw new Error("Failed to create email draft: Invalid response from Gmail API");
    }

    // Format recipient display
    const recipientDisplay = to.length === 1 ? to[0] : `${to.length} recipients`;

    return {
      success: true,
      draft: {
        draftId: result.draftId,
        messageId: result.messageId,
        threadId: result.threadId,
      },
      recipients: {
        to,
        cc: cc?.length ? cc : undefined,
        bcc: bcc?.length ? bcc : undefined,
      },
      subject,
      message: `Created email draft to ${recipientDisplay}: "${subject}"`,
    };
  },
});

