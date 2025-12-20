// ═══════════════════════════════════════════════════════════════════════════
// Gmail Client
// Type-safe Gmail API client with retry logic and rate limiting
// ═══════════════════════════════════════════════════════════════════════════

import { google, gmail_v1, people_v1 } from "googleapis";
import { GmailError, GmailErrorCode, parseGoogleApiError } from "./errors";
import { GmailRateLimiter, createRateLimiter } from "./rate-limiter";
import {
  parseGmailMessage,
  parseGmailThread,
  parseGoogleContact,
  buildRawMessage,
} from "./utils";
import type {
  GmailMessage,
  GmailMessageList,
  GmailThread,
  GmailThreadList,
  GmailLabel,
  GmailDraft,
  GmailProfile,
  GmailHistoryList,
  GoogleContact,
  GoogleContactList,
  ParsedGmailMessage,
  ParsedGmailThread,
  ParsedContact,
  ListMessagesOptions,
  ListThreadsOptions,
  GetMessageOptions,
  ListContactsOptions,
  ListHistoryOptions,
  SendMessageParams,
  CreateDraftParams,
  MessageFormat,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Client Configuration
// ─────────────────────────────────────────────────────────────

export interface GmailClientConfig {
  /** OAuth2 access token */
  accessToken: string;
  /** User ID for rate limiting */
  userId: string;
  /** Enable rate limiting (default: true) */
  enableRateLimiting?: boolean;
  /** Maximum retry attempts for retryable errors (default: 3) */
  maxRetries?: number;
  /** Request timeout in ms (default: 30000) */
  timeoutMs?: number;
}

const DEFAULT_CONFIG = {
  enableRateLimiting: true,
  maxRetries: 3,
  timeoutMs: 30000,
} as const;

// Default fields for contacts
const DEFAULT_PERSON_FIELDS = [
  "names",
  "emailAddresses",
  "phoneNumbers",
  "organizations",
  "photos",
  "addresses",
  "birthdays",
  "biographies",
];

// ─────────────────────────────────────────────────────────────
// Gmail Client Class
// ─────────────────────────────────────────────────────────────

/**
 * Gmail API client with rate limiting, retry logic, and type safety
 */
export class GmailClient {
  private gmail: gmail_v1.Gmail;
  private people: people_v1.People;
  private rateLimiter: GmailRateLimiter | null;
  private config: Required<GmailClientConfig>;

  constructor(config: GmailClientConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Create OAuth2 client with access token
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: config.accessToken });

    // Initialize Gmail API client
    this.gmail = google.gmail({ version: "v1", auth });

    // Initialize People API client (for contacts)
    this.people = google.people({ version: "v1", auth });

    // Initialize rate limiter
    this.rateLimiter = this.config.enableRateLimiting
      ? createRateLimiter(config.userId)
      : null;
  }

  // ─────────────────────────────────────────────────────────────
  // Profile
  // ─────────────────────────────────────────────────────────────

  /**
   * Get the authenticated user's Gmail profile
   */
  async getProfile(): Promise<GmailProfile> {
    return this.execute("users.getProfile", async () => {
      const response = await this.gmail.users.getProfile({ userId: "me" });
      return {
        emailAddress: response.data.emailAddress!,
        messagesTotal: response.data.messagesTotal || 0,
        threadsTotal: response.data.threadsTotal || 0,
        historyId: response.data.historyId || "",
      };
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Messages
  // ─────────────────────────────────────────────────────────────

  /**
   * List messages matching the given criteria
   */
  async listMessages(
    options: ListMessagesOptions = {}
  ): Promise<GmailMessageList> {
    return this.execute("messages.list", async () => {
      const response = await this.gmail.users.messages.list({
        userId: "me",
        q: options.query,
        maxResults: options.maxResults || 100,
        pageToken: options.pageToken,
        labelIds: options.labelIds,
        includeSpamTrash: options.includeSpamTrash || false,
      });

      // The list only returns minimal info (id, threadId)
      // We need to fetch full details for each message
      const messages = (response.data.messages || []) as GmailMessage[];

      return {
        messages,
        nextPageToken: response.data.nextPageToken || undefined,
        resultSizeEstimate: response.data.resultSizeEstimate || 0,
      };
    });
  }

  /**
   * List messages with full details (fetches each message)
   */
  async listMessagesFull(
    options: ListMessagesOptions = {}
  ): Promise<{ messages: ParsedGmailMessage[]; nextPageToken?: string }> {
    const list = await this.listMessages(options);

    // Fetch full details for each message
    const messages = await Promise.all(
      list.messages.map((m) => this.getMessage(m.id, { format: "full" }))
    );

    return {
      messages,
      nextPageToken: list.nextPageToken,
    };
  }

  /**
   * Get a single message by ID
   */
  async getMessage(
    messageId: string,
    options: GetMessageOptions = {}
  ): Promise<ParsedGmailMessage> {
    return this.execute("messages.get", async () => {
      const response = await this.gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: options.format || "full",
        metadataHeaders: options.metadataHeaders,
      });

      return parseGmailMessage(response.data as GmailMessage);
    });
  }

  /**
   * Get a raw message (for downloading/forwarding)
   */
  async getMessageRaw(messageId: string): Promise<string> {
    return this.execute("messages.get", async () => {
      const response = await this.gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "raw",
      });

      return response.data.raw || "";
    });
  }

  /**
   * Modify message labels
   */
  async modifyMessage(
    messageId: string,
    options: {
      addLabelIds?: string[];
      removeLabelIds?: string[];
    }
  ): Promise<ParsedGmailMessage> {
    return this.execute("messages.modify", async () => {
      const response = await this.gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
          addLabelIds: options.addLabelIds,
          removeLabelIds: options.removeLabelIds,
        },
      });

      return parseGmailMessage(response.data as GmailMessage);
    });
  }

  /**
   * Mark a message as read
   */
  async markAsRead(messageId: string): Promise<ParsedGmailMessage> {
    return this.modifyMessage(messageId, { removeLabelIds: ["UNREAD"] });
  }

  /**
   * Mark a message as unread
   */
  async markAsUnread(messageId: string): Promise<ParsedGmailMessage> {
    return this.modifyMessage(messageId, { addLabelIds: ["UNREAD"] });
  }

  /**
   * Star a message
   */
  async starMessage(messageId: string): Promise<ParsedGmailMessage> {
    return this.modifyMessage(messageId, { addLabelIds: ["STARRED"] });
  }

  /**
   * Unstar a message
   */
  async unstarMessage(messageId: string): Promise<ParsedGmailMessage> {
    return this.modifyMessage(messageId, { removeLabelIds: ["STARRED"] });
  }

  /**
   * Move message to trash
   */
  async trashMessage(messageId: string): Promise<ParsedGmailMessage> {
    return this.execute("messages.trash", async () => {
      const response = await this.gmail.users.messages.trash({
        userId: "me",
        id: messageId,
      });

      return parseGmailMessage(response.data as GmailMessage);
    });
  }

  /**
   * Remove message from trash
   */
  async untrashMessage(messageId: string): Promise<ParsedGmailMessage> {
    return this.execute("messages.untrash", async () => {
      const response = await this.gmail.users.messages.untrash({
        userId: "me",
        id: messageId,
      });

      return parseGmailMessage(response.data as GmailMessage);
    });
  }

  /**
   * Permanently delete a message (DANGER!)
   */
  async deleteMessage(messageId: string): Promise<void> {
    return this.execute("messages.delete", async () => {
      await this.gmail.users.messages.delete({
        userId: "me",
        id: messageId,
      });
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Threads
  // ─────────────────────────────────────────────────────────────

  /**
   * List threads
   */
  async listThreads(
    options: ListThreadsOptions = {}
  ): Promise<GmailThreadList> {
    return this.execute("threads.list", async () => {
      const response = await this.gmail.users.threads.list({
        userId: "me",
        q: options.query,
        maxResults: options.maxResults || 100,
        pageToken: options.pageToken,
        labelIds: options.labelIds,
        includeSpamTrash: options.includeSpamTrash || false,
      });

      const threads = (response.data.threads || []) as GmailThread[];

      return {
        threads,
        nextPageToken: response.data.nextPageToken || undefined,
        resultSizeEstimate: response.data.resultSizeEstimate || 0,
      };
    });
  }

  /**
   * Get a thread with all messages
   */
  async getThread(
    threadId: string,
    format: MessageFormat = "full"
  ): Promise<ParsedGmailThread> {
    return this.execute("threads.get", async () => {
      const response = await this.gmail.users.threads.get({
        userId: "me",
        id: threadId,
        format,
      });

      return parseGmailThread(response.data as GmailThread);
    });
  }

  /**
   * Move thread to trash
   */
  async trashThread(threadId: string): Promise<GmailThread> {
    return this.execute("threads.trash", async () => {
      const response = await this.gmail.users.threads.trash({
        userId: "me",
        id: threadId,
      });

      return response.data as GmailThread;
    });
  }

  /**
   * Remove thread from trash
   */
  async untrashThread(threadId: string): Promise<GmailThread> {
    return this.execute("threads.untrash", async () => {
      const response = await this.gmail.users.threads.untrash({
        userId: "me",
        id: threadId,
      });

      return response.data as GmailThread;
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Labels
  // ─────────────────────────────────────────────────────────────

  /**
   * List all labels
   */
  async listLabels(): Promise<GmailLabel[]> {
    return this.execute("labels.list", async () => {
      const response = await this.gmail.users.labels.list({ userId: "me" });
      return (response.data.labels || []) as GmailLabel[];
    });
  }

  /**
   * Get a specific label
   */
  async getLabel(labelId: string): Promise<GmailLabel> {
    return this.execute("labels.get", async () => {
      const response = await this.gmail.users.labels.get({
        userId: "me",
        id: labelId,
      });
      return response.data as GmailLabel;
    });
  }

  /**
   * Create a new label
   */
  async createLabel(
    name: string,
    options?: {
      messageListVisibility?: "show" | "hide";
      labelListVisibility?: "labelShow" | "labelShowIfUnread" | "labelHide";
      backgroundColor?: string;
      textColor?: string;
    }
  ): Promise<GmailLabel> {
    return this.execute("labels.create", async () => {
      const response = await this.gmail.users.labels.create({
        userId: "me",
        requestBody: {
          name,
          messageListVisibility: options?.messageListVisibility,
          labelListVisibility: options?.labelListVisibility,
          color: options?.backgroundColor
            ? {
                backgroundColor: options.backgroundColor,
                textColor: options.textColor,
              }
            : undefined,
        },
      });
      return response.data as GmailLabel;
    });
  }

  /**
   * Delete a label
   */
  async deleteLabel(labelId: string): Promise<void> {
    return this.execute("labels.delete", async () => {
      await this.gmail.users.labels.delete({
        userId: "me",
        id: labelId,
      });
    });
  }

  // ─────────────────────────────────────────────────────────────
  // History (Sync)
  // ─────────────────────────────────────────────────────────────

  /**
   * Get the current history ID
   */
  async getHistoryId(): Promise<string> {
    const profile = await this.getProfile();
    return profile.historyId;
  }

  /**
   * List history (changes since a history ID)
   */
  async listHistory(options: ListHistoryOptions): Promise<GmailHistoryList> {
    return this.execute("history.list", async () => {
      const response = await this.gmail.users.history.list({
        userId: "me",
        startHistoryId: options.startHistoryId,
        pageToken: options.pageToken,
        maxResults: options.maxResults,
        labelId: options.labelId,
        historyTypes: options.historyTypes,
      });

      return {
        history: response.data.history || [],
        nextPageToken: response.data.nextPageToken || undefined,
        historyId: response.data.historyId || undefined,
      } as GmailHistoryList;
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Send & Drafts
  // ─────────────────────────────────────────────────────────────

  /**
   * Send an email
   */
  async sendMessage(params: SendMessageParams): Promise<ParsedGmailMessage> {
    return this.execute("messages.send", async () => {
      const raw = buildRawMessage(params);

      const response = await this.gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw,
          threadId: params.threadId,
        },
      });

      // Fetch the full message details
      return this.getMessage(response.data.id!);
    });
  }

  /**
   * Create a draft
   */
  async createDraft(params: CreateDraftParams): Promise<GmailDraft> {
    return this.execute("drafts.create", async () => {
      const raw = buildRawMessage(params);

      const response = await this.gmail.users.drafts.create({
        userId: "me",
        requestBody: {
          message: {
            raw,
            threadId: params.threadId,
          },
        },
      });

      return response.data as GmailDraft;
    });
  }

  /**
   * Update a draft
   */
  async updateDraft(
    draftId: string,
    params: CreateDraftParams
  ): Promise<GmailDraft> {
    return this.execute("drafts.update", async () => {
      const raw = buildRawMessage(params);

      const response = await this.gmail.users.drafts.update({
        userId: "me",
        id: draftId,
        requestBody: {
          message: {
            raw,
            threadId: params.threadId,
          },
        },
      });

      return response.data as GmailDraft;
    });
  }

  /**
   * Delete a draft
   */
  async deleteDraft(draftId: string): Promise<void> {
    return this.execute("drafts.delete", async () => {
      await this.gmail.users.drafts.delete({
        userId: "me",
        id: draftId,
      });
    });
  }

  /**
   * Send a draft
   */
  async sendDraft(draftId: string): Promise<ParsedGmailMessage> {
    return this.execute("drafts.send", async () => {
      const response = await this.gmail.users.drafts.send({
        userId: "me",
        requestBody: { id: draftId },
      });

      return parseGmailMessage(response.data as GmailMessage);
    });
  }

  /**
   * List drafts
   */
  async listDrafts(options?: {
    maxResults?: number;
    pageToken?: string;
  }): Promise<{
    drafts: GmailDraft[];
    nextPageToken?: string;
  }> {
    return this.execute("drafts.list", async () => {
      const response = await this.gmail.users.drafts.list({
        userId: "me",
        maxResults: options?.maxResults || 100,
        pageToken: options?.pageToken,
      });

      return {
        drafts: (response.data.drafts || []) as GmailDraft[],
        nextPageToken: response.data.nextPageToken || undefined,
      };
    });
  }

  /**
   * Get a draft
   */
  async getDraft(draftId: string): Promise<GmailDraft> {
    return this.execute("drafts.get", async () => {
      const response = await this.gmail.users.drafts.get({
        userId: "me",
        id: draftId,
        format: "full",
      });

      return response.data as GmailDraft;
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Contacts (via People API)
  // ─────────────────────────────────────────────────────────────

  /**
   * List contacts
   */
  async listContacts(
    options: ListContactsOptions = {}
  ): Promise<GoogleContactList> {
    return this.execute("contacts.list", async () => {
      const response = await this.people.people.connections.list({
        resourceName: "people/me",
        pageSize: options.pageSize || 100,
        pageToken: options.pageToken,
        personFields: (options.personFields || DEFAULT_PERSON_FIELDS).join(","),
        sources: options.sources,
        sortOrder: options.sortOrder,
      });

      const contacts = (response.data.connections || []) as GoogleContact[];

      return {
        contacts,
        nextPageToken: response.data.nextPageToken || undefined,
        totalItems: response.data.totalItems || 0,
      };
    });
  }

  /**
   * List contacts with parsed format
   */
  async listContactsParsed(options: ListContactsOptions = {}): Promise<{
    contacts: ParsedContact[];
    nextPageToken?: string;
  }> {
    const result = await this.listContacts(options);

    return {
      contacts: result.contacts.map(parseGoogleContact),
      nextPageToken: result.nextPageToken,
    };
  }

  /**
   * Get a contact by resource name
   */
  async getContact(resourceName: string): Promise<ParsedContact> {
    return this.execute("contacts.get", async () => {
      const response = await this.people.people.get({
        resourceName,
        personFields: DEFAULT_PERSON_FIELDS.join(","),
      });

      return parseGoogleContact(response.data as GoogleContact);
    });
  }

  /**
   * Search contacts (other contacts, not just connections)
   */
  async searchContacts(query: string, pageSize = 10): Promise<ParsedContact[]> {
    return this.execute("contacts.search", async () => {
      const response = await this.people.people.searchContacts({
        query,
        pageSize,
        readMask: DEFAULT_PERSON_FIELDS.join(","),
      });

      const results = response.data.results || [];
      return results
        .map((r) => r.person)
        .filter((p): p is GoogleContact => !!p)
        .map(parseGoogleContact);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Execution & Retry Logic
  // ─────────────────────────────────────────────────────────────

  /**
   * Execute an API call with rate limiting and retry logic
   */
  private async execute<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    // Rate limit check
    if (this.rateLimiter) {
      try {
        await this.rateLimiter.waitForQuota(
          operation as Parameters<GmailRateLimiter["check"]>[0],
          this.config.timeoutMs
        );
      } catch (error) {
        // Rate limiter error - re-throw as Gmail error
        if (error instanceof GmailError) throw error;
        throw new GmailError(
          GmailErrorCode.RATE_LIMITED,
          "Rate limit check failed",
          true,
          1000
        );
      }
    }

    let lastError: GmailError | undefined;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await fn();
        return result;
      } catch (error) {
        const gmailError = parseGoogleApiError(error);
        lastError = gmailError;

        // Don't retry non-retryable errors
        if (!gmailError.retryable) {
          throw gmailError;
        }

        // Don't retry on last attempt
        if (attempt === this.config.maxRetries) {
          throw gmailError;
        }

        // Calculate backoff delay
        const baseDelay = gmailError.retryAfterMs || 1000;
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 30000);

        console.warn(
          `[GmailClient] Retrying ${operation} (attempt ${attempt}/${this.config.maxRetries}) after ${delay}ms: ${gmailError.message}`
        );

        await this.sleep(delay);
      }
    }

    // Should not reach here, but TypeScript needs this
    throw (
      lastError ||
      new GmailError(GmailErrorCode.UNKNOWN, "Unknown error", false)
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ─────────────────────────────────────────────────────────────
// Factory Functions
// ─────────────────────────────────────────────────────────────

/**
 * Create a Gmail client from an access token
 */
export function createGmailClient(
  accessToken: string,
  userId: string,
  options?: Partial<GmailClientConfig>
): GmailClient {
  return new GmailClient({
    accessToken,
    userId,
    ...options,
  });
}

export default GmailClient;
