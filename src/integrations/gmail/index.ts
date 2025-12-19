// ═══════════════════════════════════════════════════════════════════════════
// Gmail Integration
// Placeholder for Gmail API integration
// ═══════════════════════════════════════════════════════════════════════════

export const GMAIL_SCOPES = {
  // Read-only access
  readonly: ["https://www.googleapis.com/auth/gmail.readonly"],

  // With send capability
  send: [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
  ],

  // Full access
  full: [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.labels",
    "https://www.googleapis.com/auth/gmail.modify",
  ],

  // Contacts (separate API)
  contacts: ["https://www.googleapis.com/auth/contacts.readonly"],
} as const;

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string };
    }>;
  };
  internalDate: string;
}

export interface SendMessageParams {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  threadId?: string;
}

/**
 * Gmail client - to be implemented
 */
export class GmailClient {
  constructor(private accessToken: string) {}

  async listMessages(_options?: {
    query?: string;
    maxResults?: number;
    pageToken?: string;
  }): Promise<{ messages: GmailMessage[]; nextPageToken?: string }> {
    // TODO: Implement with Gmail API
    throw new Error("Not implemented");
  }

  async getMessage(_id: string): Promise<GmailMessage> {
    // TODO: Implement with Gmail API
    throw new Error("Not implemented");
  }

  async sendMessage(_params: SendMessageParams): Promise<{ id: string }> {
    // TODO: Implement with Gmail API
    throw new Error("Not implemented");
  }

  async createDraft(
    _params: SendMessageParams
  ): Promise<{ id: string; message: GmailMessage }> {
    // TODO: Implement with Gmail API
    throw new Error("Not implemented");
  }
}

export default GmailClient;

