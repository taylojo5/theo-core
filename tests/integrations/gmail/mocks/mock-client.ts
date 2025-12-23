// ═══════════════════════════════════════════════════════════════════════════
// Mock Gmail Client
// A testable mock implementation of GmailClient for integration tests
// ═══════════════════════════════════════════════════════════════════════════

import { vi } from "vitest";
import type {
  GmailMessage,
  GmailThread,
  GmailLabel,
  GmailDraft,
  GmailProfile,
  GmailHistoryList,
  GmailMessageList,
  GmailThreadList,
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
} from "@/integrations/gmail";
import {
  parseGmailMessage,
  parseGmailThread,
  parseGoogleContact,
} from "@/integrations/gmail/utils";
import {
  createMockMessage,
  createMockProfile,
  createMockLabel,
  createMockDraft,
  createMockContact,
  createMockHistoryEntry,
} from "./mock-factories";

// ─────────────────────────────────────────────────────────────
// Mock Client Options
// ─────────────────────────────────────────────────────────────

export interface MockClientOptions {
  /** User email for profile */
  userEmail?: string;
  /** Initial messages in the mailbox */
  messages?: GmailMessage[];
  /** Initial labels */
  labels?: GmailLabel[];
  /** Initial drafts */
  drafts?: GmailDraft[];
  /** Initial contacts */
  contacts?: ReturnType<typeof createMockContact>[];
  /** Initial history ID */
  historyId?: string;
  /** Simulate errors on specific operations */
  errorOn?: {
    operation: string;
    error: Error;
    times?: number;
  }[];
  /** Simulate rate limiting */
  simulateRateLimiting?: boolean;
  /** Latency in ms */
  latencyMs?: number;
}

export type MockApiOptions = MockClientOptions;

// ─────────────────────────────────────────────────────────────
// Mock Gmail Client
// ─────────────────────────────────────────────────────────────

/**
 * Mock Gmail Client for testing
 *
 * This provides a full mock implementation of the GmailClient interface
 * that can be used for integration testing without hitting the real API.
 */
export class MockGmailClient {
  private messages: Map<string, GmailMessage> = new Map();
  private threads: Map<string, GmailThread> = new Map();
  private labels: Map<string, GmailLabel> = new Map();
  private drafts: Map<string, GmailDraft> = new Map();
  private contacts: ReturnType<typeof createMockContact>[] = [];
  private profile: GmailProfile;
  private currentHistoryId: string;
  private historyEntries: Array<{
    id: string;
    entry: ReturnType<typeof createMockHistoryEntry>;
  }> = [];
  private errorConfig: NonNullable<MockClientOptions["errorOn"]> = [];
  private errorCounts: Map<string, number> = new Map();
  private latencyMs: number;

  // Spy functions for verification
  public readonly spies = {
    getProfile: vi.fn(),
    listMessages: vi.fn(),
    getMessage: vi.fn(),
    modifyMessage: vi.fn(),
    listThreads: vi.fn(),
    getThread: vi.fn(),
    listLabels: vi.fn(),
    createLabel: vi.fn(),
    listHistory: vi.fn(),
    sendMessage: vi.fn(),
    createDraft: vi.fn(),
    updateDraft: vi.fn(),
    deleteDraft: vi.fn(),
    sendDraft: vi.fn(),
    listContacts: vi.fn(),
  };

  constructor(options: MockClientOptions = {}) {
    this.profile = createMockProfile({
      emailAddress: options.userEmail || "test@example.com",
      historyId: options.historyId || "12345",
    });
    this.currentHistoryId = this.profile.historyId;
    this.latencyMs = options.latencyMs || 0;
    this.errorConfig = options.errorOn || [];

    // Initialize with system labels
    const systemLabels: GmailLabel[] = [
      { id: "INBOX", name: "INBOX", type: "system" },
      { id: "SENT", name: "SENT", type: "system" },
      { id: "DRAFT", name: "DRAFT", type: "system" },
      { id: "TRASH", name: "TRASH", type: "system" },
      { id: "SPAM", name: "SPAM", type: "system" },
      { id: "UNREAD", name: "UNREAD", type: "system" },
      { id: "STARRED", name: "STARRED", type: "system" },
      { id: "IMPORTANT", name: "IMPORTANT", type: "system" },
    ];

    systemLabels.forEach((l) => this.labels.set(l.id, l));

    // Add custom labels
    options.labels?.forEach((l) => this.labels.set(l.id, l));

    // Add messages
    options.messages?.forEach((m) => {
      this.messages.set(m.id, m);
      this.organizeIntoThread(m);
    });

    // Add drafts
    options.drafts?.forEach((d) => this.drafts.set(d.id, d));

    // Add contacts
    this.contacts = options.contacts || [];
  }

  private async simulateLatency(): Promise<void> {
    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    }
  }

  private checkForError(operation: string): void {
    const config = this.errorConfig.find((e) => e.operation === operation);
    if (config) {
      const count = this.errorCounts.get(operation) || 0;
      const times = config.times ?? Infinity;
      if (count < times) {
        this.errorCounts.set(operation, count + 1);
        throw config.error;
      }
    }
  }

  private organizeIntoThread(message: GmailMessage): void {
    const threadId = message.threadId;
    const existing = this.threads.get(threadId);

    if (existing) {
      const messages = [...(existing.messages || []), message];
      messages.sort(
        (a, b) =>
          parseInt(a.internalDate || "0") - parseInt(b.internalDate || "0")
      );
      this.threads.set(threadId, {
        ...existing,
        messages,
        historyId: message.historyId,
        snippet: message.snippet,
      });
    } else {
      this.threads.set(threadId, {
        id: threadId,
        historyId: message.historyId,
        snippet: message.snippet,
        messages: [message],
      });
    }
  }

  private incrementHistoryId(): string {
    const current = parseInt(this.currentHistoryId);
    this.currentHistoryId = (current + 1).toString();
    return this.currentHistoryId;
  }

  // ─────────────────────────────────────────────────────────────
  // Profile
  // ─────────────────────────────────────────────────────────────

  async getProfile(): Promise<GmailProfile> {
    this.spies.getProfile();
    await this.simulateLatency();
    this.checkForError("getProfile");
    return { ...this.profile, historyId: this.currentHistoryId };
  }

  // ─────────────────────────────────────────────────────────────
  // Messages
  // ─────────────────────────────────────────────────────────────

  async listMessages(
    options: ListMessagesOptions = {}
  ): Promise<GmailMessageList> {
    this.spies.listMessages(options);
    await this.simulateLatency();
    this.checkForError("listMessages");

    let messages = Array.from(this.messages.values());

    // Filter by labels
    if (options.labelIds?.length) {
      messages = messages.filter((m) =>
        options.labelIds!.some((l) => m.labelIds?.includes(l))
      );
    }

    // Apply pagination
    const maxResults = options.maxResults || 100;
    const startIndex = options.pageToken ? parseInt(options.pageToken) : 0;
    const endIndex = startIndex + maxResults;
    const paginatedMessages = messages.slice(startIndex, endIndex);

    return {
      messages: paginatedMessages.map((m) => ({
        id: m.id,
        threadId: m.threadId,
      })) as GmailMessage[],
      nextPageToken:
        endIndex < messages.length ? endIndex.toString() : undefined,
      resultSizeEstimate: messages.length,
    };
  }

  async getMessage(
    messageId: string,
    _options: GetMessageOptions = {}
  ): Promise<ParsedGmailMessage> {
    this.spies.getMessage(messageId);
    await this.simulateLatency();
    this.checkForError("getMessage");

    const message = this.messages.get(messageId);
    if (!message) {
      throw new Error(`Message not found: ${messageId}`);
    }

    return parseGmailMessage(message);
  }

  async modifyMessage(
    messageId: string,
    options: { addLabelIds?: string[]; removeLabelIds?: string[] }
  ): Promise<ParsedGmailMessage> {
    this.spies.modifyMessage(messageId, options);
    await this.simulateLatency();
    this.checkForError("modifyMessage");

    const message = this.messages.get(messageId);
    if (!message) {
      throw new Error(`Message not found: ${messageId}`);
    }

    let labelIds = [...(message.labelIds || [])];

    if (options.removeLabelIds) {
      labelIds = labelIds.filter((l) => !options.removeLabelIds!.includes(l));
    }

    if (options.addLabelIds) {
      options.addLabelIds.forEach((l) => {
        if (!labelIds.includes(l)) {
          labelIds.push(l);
        }
      });
    }

    const updatedMessage: GmailMessage = {
      ...message,
      labelIds,
      historyId: this.incrementHistoryId(),
    };

    this.messages.set(messageId, updatedMessage);

    // Record history
    this.historyEntries.push({
      id: this.currentHistoryId,
      entry: createMockHistoryEntry({
        id: this.currentHistoryId,
        labelsAdded: options.addLabelIds
          ? [{ id: messageId, labelIds: options.addLabelIds }]
          : undefined,
        labelsRemoved: options.removeLabelIds
          ? [{ id: messageId, labelIds: options.removeLabelIds }]
          : undefined,
      }),
    });

    return parseGmailMessage(updatedMessage);
  }

  // ─────────────────────────────────────────────────────────────
  // Threads
  // ─────────────────────────────────────────────────────────────

  async listThreads(
    options: ListThreadsOptions = {}
  ): Promise<GmailThreadList> {
    this.spies.listThreads(options);
    await this.simulateLatency();
    this.checkForError("listThreads");

    let threads = Array.from(this.threads.values());

    // Filter by labels
    if (options.labelIds?.length) {
      threads = threads.filter((t) =>
        t.messages?.some((m) =>
          options.labelIds!.some((l) => m.labelIds?.includes(l))
        )
      );
    }

    // Apply pagination
    const maxResults = options.maxResults || 100;
    const startIndex = options.pageToken ? parseInt(options.pageToken) : 0;
    const endIndex = startIndex + maxResults;
    const paginatedThreads = threads.slice(startIndex, endIndex);

    return {
      threads: paginatedThreads.map((t) => ({ id: t.id })) as GmailThread[],
      nextPageToken:
        endIndex < threads.length ? endIndex.toString() : undefined,
      resultSizeEstimate: threads.length,
    };
  }

  async getThread(
    threadId: string,
    _format: MessageFormat = "full"
  ): Promise<ParsedGmailThread> {
    this.spies.getThread(threadId);
    await this.simulateLatency();
    this.checkForError("getThread");

    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }

    return parseGmailThread(thread);
  }

  // ─────────────────────────────────────────────────────────────
  // Labels
  // ─────────────────────────────────────────────────────────────

  async listLabels(): Promise<GmailLabel[]> {
    this.spies.listLabels();
    await this.simulateLatency();
    this.checkForError("listLabels");
    return Array.from(this.labels.values());
  }

  async createLabel(
    name: string,
    options?: { backgroundColor?: string; textColor?: string }
  ): Promise<GmailLabel> {
    this.spies.createLabel(name, options);
    await this.simulateLatency();
    this.checkForError("createLabel");

    const label = createMockLabel({
      name,
      backgroundColor: options?.backgroundColor,
      textColor: options?.textColor,
    });

    this.labels.set(label.id, label);
    return label;
  }

  // ─────────────────────────────────────────────────────────────
  // History
  // ─────────────────────────────────────────────────────────────

  async listHistory(options: ListHistoryOptions): Promise<GmailHistoryList> {
    this.spies.listHistory(options);
    await this.simulateLatency();
    this.checkForError("listHistory");

    const startId = parseInt(options.startHistoryId);

    // Find history entries after startHistoryId
    const relevantEntries = this.historyEntries.filter(
      (h) => parseInt(h.id) > startId
    );

    return {
      history: relevantEntries.map((h) => h.entry),
      historyId: this.currentHistoryId,
      nextPageToken: undefined,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Send & Drafts
  // ─────────────────────────────────────────────────────────────

  async sendMessage(params: SendMessageParams): Promise<ParsedGmailMessage> {
    this.spies.sendMessage(params);
    await this.simulateLatency();
    this.checkForError("sendMessage");

    const message = createMockMessage({
      from: this.profile.emailAddress,
      to: params.to,
      cc: params.cc,
      subject: params.subject,
      body: params.body,
      bodyHtml: params.bodyHtml,
      labelIds: ["SENT"],
      threadId: params.threadId,
    });

    this.messages.set(message.id, message);
    this.organizeIntoThread(message);

    // Record history
    this.historyEntries.push({
      id: this.incrementHistoryId(),
      entry: createMockHistoryEntry({
        messagesAdded: [{ id: message.id, threadId: message.threadId }],
      }),
    });

    return parseGmailMessage(message);
  }

  async createDraft(params: CreateDraftParams): Promise<GmailDraft> {
    this.spies.createDraft(params);
    await this.simulateLatency();
    this.checkForError("createDraft");

    const message = createMockMessage({
      from: this.profile.emailAddress,
      to: params.to,
      cc: params.cc,
      subject: params.subject,
      body: params.body,
      bodyHtml: params.bodyHtml,
      labelIds: ["DRAFT"],
      threadId: params.threadId,
    });

    const draft = createMockDraft({ message });

    this.drafts.set(draft.id, draft);
    this.messages.set(message.id, message);

    return draft;
  }

  async updateDraft(
    draftId: string,
    params: CreateDraftParams
  ): Promise<GmailDraft> {
    this.spies.updateDraft(draftId, params);
    await this.simulateLatency();
    this.checkForError("updateDraft");

    const existing = this.drafts.get(draftId);
    if (!existing) {
      throw new Error(`Draft not found: ${draftId}`);
    }

    const message = createMockMessage({
      id: existing.message?.id,
      from: this.profile.emailAddress,
      to: params.to,
      cc: params.cc,
      subject: params.subject,
      body: params.body,
      bodyHtml: params.bodyHtml,
      labelIds: ["DRAFT"],
      threadId: params.threadId,
    });

    const draft: GmailDraft = { id: draftId, message };

    this.drafts.set(draftId, draft);
    this.messages.set(message.id, message);

    return draft;
  }

  async deleteDraft(draftId: string): Promise<void> {
    this.spies.deleteDraft(draftId);
    await this.simulateLatency();
    this.checkForError("deleteDraft");

    const draft = this.drafts.get(draftId);
    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }

    this.drafts.delete(draftId);
    if (draft.message) {
      this.messages.delete(draft.message.id);
    }
  }

  async sendDraft(draftId: string): Promise<ParsedGmailMessage> {
    this.spies.sendDraft(draftId);
    await this.simulateLatency();
    this.checkForError("sendDraft");

    const draft = this.drafts.get(draftId);
    if (!draft || !draft.message) {
      throw new Error(`Draft not found: ${draftId}`);
    }

    // Convert draft to sent message
    const sentMessage: GmailMessage = {
      ...draft.message,
      labelIds: ["SENT"],
      historyId: this.incrementHistoryId(),
    };

    this.messages.set(sentMessage.id, sentMessage);
    this.drafts.delete(draftId);

    // Record history
    this.historyEntries.push({
      id: this.currentHistoryId,
      entry: createMockHistoryEntry({
        messagesAdded: [{ id: sentMessage.id, threadId: sentMessage.threadId }],
      }),
    });

    return parseGmailMessage(sentMessage);
  }

  // ─────────────────────────────────────────────────────────────
  // Contacts
  // ─────────────────────────────────────────────────────────────

  async listContacts(
    options: ListContactsOptions = {}
  ): Promise<GoogleContactList> {
    this.spies.listContacts(options);
    await this.simulateLatency();
    this.checkForError("listContacts");

    const pageSize = options.pageSize || 100;
    const startIndex = options.pageToken ? parseInt(options.pageToken) : 0;
    const endIndex = startIndex + pageSize;
    const paginatedContacts = this.contacts.slice(startIndex, endIndex);

    return {
      contacts: paginatedContacts,
      nextPageToken:
        endIndex < this.contacts.length ? endIndex.toString() : undefined,
      totalItems: this.contacts.length,
    };
  }

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

  // ─────────────────────────────────────────────────────────────
  // Test Utilities
  // ─────────────────────────────────────────────────────────────

  /**
   * Add a message to the mock mailbox
   */
  addMessage(message: GmailMessage): void {
    this.messages.set(message.id, message);
    this.organizeIntoThread(message);
    this.historyEntries.push({
      id: this.incrementHistoryId(),
      entry: createMockHistoryEntry({
        messagesAdded: [{ id: message.id, threadId: message.threadId }],
      }),
    });
  }

  /**
   * Remove a message from the mock mailbox
   */
  removeMessage(messageId: string): void {
    const message = this.messages.get(messageId);
    if (message) {
      this.messages.delete(messageId);
      this.historyEntries.push({
        id: this.incrementHistoryId(),
        entry: createMockHistoryEntry({
          messagesDeleted: [{ id: messageId }],
        }),
      });
    }
  }

  /**
   * Add a contact to the mock contacts
   */
  addContact(contact: ReturnType<typeof createMockContact>): void {
    this.contacts.push(contact);
  }

  /**
   * Get the current history ID
   */
  getHistoryId(): string {
    return this.currentHistoryId;
  }

  /**
   * Get internal state for assertions
   */
  getState(): {
    messages: GmailMessage[];
    threads: GmailThread[];
    labels: GmailLabel[];
    drafts: GmailDraft[];
    historyId: string;
  } {
    return {
      messages: Array.from(this.messages.values()),
      threads: Array.from(this.threads.values()),
      labels: Array.from(this.labels.values()),
      drafts: Array.from(this.drafts.values()),
      historyId: this.currentHistoryId,
    };
  }

  /**
   * Clear all spies
   */
  clearSpies(): void {
    Object.values(this.spies).forEach((spy) => spy.mockClear());
  }
}

// ─────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────

/**
 * Create a mock Gmail client for testing
 */
export function createMockGmailClient(
  options: MockClientOptions = {}
): MockGmailClient {
  return new MockGmailClient(options);
}
