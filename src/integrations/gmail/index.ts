// ═══════════════════════════════════════════════════════════════════════════
// Gmail Integration
// Gmail API client and utilities for email operations
// ═══════════════════════════════════════════════════════════════════════════

// Re-export centralized scope definitions from auth module
export {
  GMAIL_SCOPES,
  ALL_GMAIL_SCOPES,
  hasGmailReadAccess,
  hasGmailSendAccess,
  hasContactsAccess,
  getIntegrationStatus,
} from "@/lib/auth/scopes";

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
