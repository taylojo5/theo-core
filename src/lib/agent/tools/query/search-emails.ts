// ═══════════════════════════════════════════════════════════════════════════
// Search Emails Tool
// Search user's email archive with various filters
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import type { ToolDefinition } from "../types";
import { defineTool, objectSchema } from "../types";
import { emailRepository } from "@/integrations/gmail/repository";

// ─────────────────────────────────────────────────────────────
// Input/Output Types
// ─────────────────────────────────────────────────────────────

/** Input schema for email search */
const searchEmailsInputSchema = z.object({
  query: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  labelIds: z.array(z.string()).optional(),
  isRead: z.boolean().optional(),
  isStarred: z.boolean().optional(),
  isImportant: z.boolean().optional(),
  hasAttachments: z.boolean().optional(),
  startDate: z.string().refine(
    (val) => !val || !isNaN(new Date(val).getTime()),
    { message: "Invalid date format" }
  ).optional(),
  endDate: z.string().refine(
    (val) => !val || !isNaN(new Date(val).getTime()),
    { message: "Invalid date format" }
  ).optional(),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

type SearchEmailsInput = z.infer<typeof searchEmailsInputSchema>;

/** Output type for email search */
interface SearchEmailsOutput {
  emails: EmailResult[];
  totalCount: number;
  hasMore: boolean;
}

/** Individual email result */
interface EmailResult {
  id: string;
  threadId: string;
  subject: string;
  snippet: string;
  fromName: string | null;
  fromEmail: string;
  toEmails: string[];
  date: string;
  isRead: boolean;
  isStarred: boolean;
  isImportant: boolean;
  hasAttachments: boolean;
  labelIds: string[];
}

// ─────────────────────────────────────────────────────────────
// Tool Definition
// ─────────────────────────────────────────────────────────────

export const searchEmailsTool: ToolDefinition<SearchEmailsInput, SearchEmailsOutput> = defineTool({
  // ═══════════════════════════════════════════════════════════
  // LLM Interface
  // ═══════════════════════════════════════════════════════════
  name: "search_emails",
  description: "Search the user's synced emails with text search and filters",

  whenToUse: `Use when the user asks to:
- Find emails: "Find emails from John", "Search for emails about the project"
- Look up specific emails: "Show me receipts", "Find confirmation emails"
- Filter inbox: "Show unread emails", "Find starred messages"
- Search by date: "Emails from last week", "Find emails from January"

This searches the locally synced email archive, not Gmail directly.`,

  examples: [
    'User: "Find emails from John" → search_emails({ from: "john" })',
    'User: "Show me unread emails" → search_emails({ isRead: false })',
    'User: "Search for receipts" → search_emails({ query: "receipt" })',
    'User: "Find starred emails from last week" → search_emails({ isStarred: true, startDate: "2024-01-08" })',
    'User: "Emails about the budget proposal" → search_emails({ query: "budget proposal" })',
  ],

  parametersSchema: objectSchema(
    {
      query: {
        type: "string",
        description: "Text search query (searches subject, snippet, sender)",
      },
      from: {
        type: "string",
        description: "Filter by sender email or name",
      },
      to: {
        type: "string",
        description: "Filter by recipient email",
      },
      labelIds: {
        type: "array",
        items: { type: "string" },
        description: "Filter by Gmail label IDs",
      },
      isRead: {
        type: "boolean",
        description: "Filter by read status (true = read, false = unread)",
      },
      isStarred: {
        type: "boolean",
        description: "Filter by starred status",
      },
      isImportant: {
        type: "boolean",
        description: "Filter by important status",
      },
      hasAttachments: {
        type: "boolean",
        description: "Filter by attachment presence",
      },
      startDate: {
        type: "string",
        format: "date",
        description: "Start of date range (ISO format)",
      },
      endDate: {
        type: "string",
        format: "date",
        description: "End of date range (ISO format)",
      },
      limit: {
        type: "integer",
        description: "Maximum results to return (1-50, default 20)",
        minimum: 1,
        maximum: 50,
      },
    },
    [] // No required fields - at least one filter should be provided
  ),

  // ═══════════════════════════════════════════════════════════
  // Internal Configuration
  // ═══════════════════════════════════════════════════════════
  category: "query",
  riskLevel: "low",
  requiresApproval: false,
  requiredIntegrations: ["gmail"],

  // ═══════════════════════════════════════════════════════════
  // Validation & Execution
  // ═══════════════════════════════════════════════════════════
  inputValidator: searchEmailsInputSchema,

  execute: async (input, context) => {
    const {
      query,
      from,
      to,
      labelIds,
      isRead,
      isStarred,
      isImportant,
      hasAttachments,
      startDate,
      endDate,
      limit,
    } = input;

    // Execute the search
    const searchResult = await emailRepository.search(context.userId, {
      query,
      fromEmail: from,
      toEmail: to,
      labelIds,
      isRead,
      isStarred,
      isImportant,
      hasAttachments,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit,
      orderBy: "internalDate",
      orderDirection: "desc",
    });

    // Map results to output format
    const emails: EmailResult[] = searchResult.emails.map((email) => ({
      id: email.id,
      threadId: email.threadId,
      subject: email.subject || "(No subject)",
      snippet: email.snippet || "",
      fromName: email.fromName,
      fromEmail: email.fromEmail,
      toEmails: email.toEmails,
      date: email.internalDate.toISOString(),
      isRead: email.isRead,
      isStarred: email.isStarred,
      isImportant: email.isImportant,
      hasAttachments: email.hasAttachments,
      labelIds: email.labelIds,
    }));

    return {
      emails,
      totalCount: searchResult.total,
      hasMore: searchResult.hasMore,
    };
  },
});


