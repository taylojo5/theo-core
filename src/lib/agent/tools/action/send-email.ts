// ═══════════════════════════════════════════════════════════════════════════
// Send Email Tool
// Action tool for sending emails (requires Gmail integration + approval)
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import type { ToolDefinition } from "../types";
import { defineTool, objectSchema } from "../types";
import { requestApproval } from "@/integrations/gmail/actions";
import { createGmailClient } from "@/integrations/gmail";
import { getValidAccessToken } from "@/lib/auth/token-refresh";

// ─────────────────────────────────────────────────────────────
// Input/Output Types
// ─────────────────────────────────────────────────────────────

/** Email address validation regex */
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Input schema for sending email */
const sendEmailInputSchema = z.object({
  to: z
    .array(z.string().regex(emailRegex, "Invalid email address"))
    .min(1, "At least one recipient is required")
    .max(50),
  cc: z.array(z.string().regex(emailRegex, "Invalid email address")).max(50).optional(),
  bcc: z.array(z.string().regex(emailRegex, "Invalid email address")).max(50).optional(),
  subject: z.string().min(1, "Subject is required").max(998),
  body: z.string().min(1, "Email body is required").max(100000),
  bodyHtml: z.string().max(500000).optional(),
  // Thread ID for reply emails
  threadId: z.string().optional(),
  // In-Reply-To header for proper threading
  inReplyTo: z.string().optional(),
  // References header for threading
  references: z.array(z.string()).optional(),
  // Agent's reasoning for why this should be sent
  sendReason: z.string().max(1000).optional(),
});

type SendEmailInput = z.infer<typeof sendEmailInputSchema>;

/** Output type for send email request */
interface SendEmailOutput {
  success: boolean;
  requiresApproval: boolean;
  approval: {
    id: string;
    draftId: string;
    expiresAt: string;
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

export const sendEmailTool: ToolDefinition<SendEmailInput, SendEmailOutput> = defineTool({
  // ═══════════════════════════════════════════════════════════
  // LLM Interface
  // ═══════════════════════════════════════════════════════════
  name: "send_email",
  description: "Send an email (requires user approval before sending)",

  whenToUse: `Use ONLY when the user explicitly wants to SEND an email, not just draft it.
Listen for explicit send language:
- "Send an email to...", "Email John saying...", "Send a message to..."
- "Send this to...", "Go ahead and send it"
- "Message Sarah about..." (implies sending)

Do NOT use for:
- Just drafting/composing (use draft_email instead)
- When user says "write" or "compose" without "send"
- When user wants to review before sending

This creates a draft and requests user approval before sending.
The email is NOT sent until the user approves it.`,

  examples: [
    'User: "Send an email to john@example.com saying I\'ll be late" → send_email({ to: ["john@example.com"], subject: "Running late", body: "Hi John,\\n\\nI\'ll be about 15 minutes late..." })',
    'User: "Email the team that the meeting is cancelled" → send_email({ to: ["team@company.com"], subject: "Meeting Cancelled", body: "..." })',
    'User: "Send a quick message to sarah@company.com about the deadline" → send_email({ to: ["sarah@company.com"], subject: "Regarding the deadline", body: "..." })',
    'User: "Message John that I got the files" → send_email({ to: ["john@example.com"], subject: "Files received", body: "Hi John,\\n\\nI received the files..." })',
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
      references: {
        type: "array",
        items: { type: "string" },
        description: "Message-ID references for threading",
      },
      sendReason: {
        type: "string",
        description: "Brief explanation of why this email should be sent",
        maxLength: 1000,
      },
    },
    ["to", "subject", "body"] // Required fields
  ),

  // ═══════════════════════════════════════════════════════════
  // Internal Configuration
  // ═══════════════════════════════════════════════════════════
  category: "external",
  riskLevel: "high", // Sends external communication
  requiresApproval: true, // Always requires user approval
  requiredIntegrations: ["gmail"],

  // ═══════════════════════════════════════════════════════════
  // Validation & Execution
  // ═══════════════════════════════════════════════════════════
  inputValidator: sendEmailInputSchema,

  execute: async (input, context): Promise<SendEmailOutput> => {
    const { to, cc, bcc, subject, body, bodyHtml, threadId, inReplyTo, references, sendReason } =
      input;

    // Get OAuth access token from database
    const accessToken = await getValidAccessToken(context.userId);
    if (!accessToken) {
      throw new Error("Gmail not connected. Please connect Gmail in settings.");
    }

    // Create Gmail client
    const client = createGmailClient(accessToken, context.userId);

    // Request approval (creates draft + approval record)
    const result = await requestApproval(client, context.userId, {
      to,
      cc,
      bcc,
      subject,
      body,
      bodyHtml,
      threadId,
      inReplyTo,
      references,
      metadata: {
        sendReason,
        requestedBy: "agent",
        conversationId: context.conversationId,
        sessionId: context.sessionId,
      },
    });

    // Validate response before accessing properties
    if (!result || !result.approval || !result.draftId) {
      throw new Error("Failed to create email approval request: Invalid response from Gmail API");
    }

    const approval = result.approval;

    // Validate approval has required fields
    if (!approval.id || !approval.draftId) {
      throw new Error("Failed to create email approval: Missing approval ID or draft ID");
    }

    // Format recipient display
    const recipientDisplay = to.length === 1 ? to[0] : `${to.length} recipients`;

    // Handle potentially null expiresAt
    const expiresAtDate = approval.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000);

    return {
      success: true,
      requiresApproval: true,
      approval: {
        id: approval.id,
        draftId: approval.draftId,
        expiresAt: expiresAtDate.toISOString(),
      },
      recipients: {
        to,
        cc: cc?.length ? cc : undefined,
        bcc: bcc?.length ? bcc : undefined,
      },
      subject,
      message: `Created email to ${recipientDisplay} for your approval: "${subject}". Please review and approve to send.`,
    };
  },
});

