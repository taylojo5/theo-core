// ═══════════════════════════════════════════════════════════════════════════
// Mock Gmail API
// Provides vi.mock() compatible functions for mocking the googleapis module
// ═══════════════════════════════════════════════════════════════════════════

import { vi } from "vitest";
import type { MockClientOptions } from "./mock-client";
import { MockGmailClient } from "./mock-client";

// ─────────────────────────────────────────────────────────────
// Mock API State
// ─────────────────────────────────────────────────────────────

let mockClient: MockGmailClient | null = null;

/**
 * Get the current mock client instance
 */
export function getMockClient(): MockGmailClient | null {
  return mockClient;
}

/**
 * Set the mock client for the current test
 */
export function setMockClient(client: MockGmailClient): void {
  mockClient = client;
}

/**
 * Clear the mock client
 */
export function clearMockClient(): void {
  mockClient = null;
}

// ─────────────────────────────────────────────────────────────
// Mock Google API Responses
// ─────────────────────────────────────────────────────────────

/**
 * Create mock response wrappers that match googleapis response format
 */
function wrapResponse<T>(data: T): { data: T } {
  return { data };
}

/**
 * Mock implementation of the gmail_v1.Gmail interface
 */
export function createMockGmailApi(client: MockGmailClient) {
  return {
    users: {
      getProfile: vi.fn().mockImplementation(async () => {
        const profile = await client.getProfile();
        return wrapResponse(profile);
      }),
      messages: {
        list: vi
          .fn()
          .mockImplementation(
            async (params: {
              userId: string;
              q?: string;
              maxResults?: number;
              pageToken?: string;
              labelIds?: string[];
            }) => {
              const result = await client.listMessages({
                query: params.q,
                maxResults: params.maxResults,
                pageToken: params.pageToken,
                labelIds: params.labelIds,
              });
              return wrapResponse({
                messages: result.messages,
                nextPageToken: result.nextPageToken,
                resultSizeEstimate: result.resultSizeEstimate,
              });
            }
          ),
        get: vi
          .fn()
          .mockImplementation(
            async (params: { userId: string; id: string; format?: string }) => {
              // Return the raw message for the mock
              const state = client.getState();
              const message = state.messages.find((m) => m.id === params.id);
              if (!message) throw new Error(`Message not found: ${params.id}`);
              return wrapResponse(message);
            }
          ),
        modify: vi.fn().mockImplementation(
          async (params: {
            userId: string;
            id: string;
            requestBody: {
              addLabelIds?: string[];
              removeLabelIds?: string[];
            };
          }) => {
            const result = await client.modifyMessage(params.id, {
              addLabelIds: params.requestBody.addLabelIds,
              removeLabelIds: params.requestBody.removeLabelIds,
            });
            return wrapResponse(result);
          }
        ),
        send: vi
          .fn()
          .mockImplementation(
            async (params: {
              userId: string;
              requestBody: { raw: string; threadId?: string };
            }) => {
              // Decode the raw message (simplified)
              const result = await client.sendMessage({
                to: ["recipient@example.com"],
                subject: "Sent Message",
                body: "Message body",
                threadId: params.requestBody.threadId,
              });
              return wrapResponse({ id: result.id, threadId: result.threadId });
            }
          ),
        trash: vi
          .fn()
          .mockImplementation(
            async (params: { userId: string; id: string }) => {
              const result = await client.modifyMessage(params.id, {
                addLabelIds: ["TRASH"],
                removeLabelIds: ["INBOX"],
              });
              return wrapResponse(result);
            }
          ),
        untrash: vi
          .fn()
          .mockImplementation(
            async (params: { userId: string; id: string }) => {
              const result = await client.modifyMessage(params.id, {
                removeLabelIds: ["TRASH"],
                addLabelIds: ["INBOX"],
              });
              return wrapResponse(result);
            }
          ),
        delete: vi
          .fn()
          .mockImplementation(
            async (params: { userId: string; id: string }) => {
              client.removeMessage(params.id);
              return wrapResponse({});
            }
          ),
      },
      threads: {
        list: vi
          .fn()
          .mockImplementation(
            async (params: {
              userId: string;
              q?: string;
              maxResults?: number;
              pageToken?: string;
              labelIds?: string[];
            }) => {
              const result = await client.listThreads({
                query: params.q,
                maxResults: params.maxResults,
                pageToken: params.pageToken,
                labelIds: params.labelIds,
              });
              return wrapResponse({
                threads: result.threads,
                nextPageToken: result.nextPageToken,
                resultSizeEstimate: result.resultSizeEstimate,
              });
            }
          ),
        get: vi
          .fn()
          .mockImplementation(
            async (params: { userId: string; id: string; format?: string }) => {
              const state = client.getState();
              const thread = state.threads.find((t) => t.id === params.id);
              if (!thread) throw new Error(`Thread not found: ${params.id}`);
              return wrapResponse(thread);
            }
          ),
        trash: vi
          .fn()
          .mockImplementation(
            async (params: { userId: string; id: string }) => {
              const thread = await client.getThread(params.id);
              return wrapResponse(thread);
            }
          ),
        untrash: vi
          .fn()
          .mockImplementation(
            async (params: { userId: string; id: string }) => {
              const thread = await client.getThread(params.id);
              return wrapResponse(thread);
            }
          ),
      },
      labels: {
        list: vi.fn().mockImplementation(async () => {
          const labels = await client.listLabels();
          return wrapResponse({ labels });
        }),
        get: vi
          .fn()
          .mockImplementation(
            async (params: { userId: string; id: string }) => {
              const labels = await client.listLabels();
              const label = labels.find((l) => l.id === params.id);
              if (!label) throw new Error(`Label not found: ${params.id}`);
              return wrapResponse(label);
            }
          ),
        create: vi.fn().mockImplementation(
          async (params: {
            userId: string;
            requestBody: {
              name: string;
              color?: { backgroundColor?: string; textColor?: string };
            };
          }) => {
            const label = await client.createLabel(params.requestBody.name, {
              backgroundColor: params.requestBody.color?.backgroundColor,
              textColor: params.requestBody.color?.textColor,
            });
            return wrapResponse(label);
          }
        ),
        delete: vi.fn().mockImplementation(async () => {
          return wrapResponse({});
        }),
      },
      history: {
        list: vi
          .fn()
          .mockImplementation(
            async (params: {
              userId: string;
              startHistoryId: string;
              pageToken?: string;
              maxResults?: number;
              labelId?: string;
              historyTypes?: string[];
            }) => {
              const result = await client.listHistory({
                startHistoryId: params.startHistoryId,
                pageToken: params.pageToken,
                maxResults: params.maxResults,
                labelId: params.labelId,
                historyTypes: params.historyTypes as (
                  | "messageAdded"
                  | "messageDeleted"
                  | "labelAdded"
                  | "labelRemoved"
                )[],
              });
              return wrapResponse({
                history: result.history,
                historyId: result.historyId,
                nextPageToken: result.nextPageToken,
              });
            }
          ),
      },
      drafts: {
        list: vi.fn().mockImplementation(async () => {
          const state = client.getState();
          return wrapResponse({ drafts: state.drafts });
        }),
        get: vi
          .fn()
          .mockImplementation(
            async (params: { userId: string; id: string }) => {
              const state = client.getState();
              const draft = state.drafts.find((d) => d.id === params.id);
              if (!draft) throw new Error(`Draft not found: ${params.id}`);
              return wrapResponse(draft);
            }
          ),
        create: vi
          .fn()
          .mockImplementation(
            async (params: {
              userId: string;
              requestBody: { message: { raw: string; threadId?: string } };
            }) => {
              const draft = await client.createDraft({
                to: ["recipient@example.com"],
                subject: "Draft Subject",
                body: "Draft body",
                threadId: params.requestBody.message.threadId,
              });
              return wrapResponse(draft);
            }
          ),
        update: vi
          .fn()
          .mockImplementation(
            async (params: {
              userId: string;
              id: string;
              requestBody: { message: { raw: string; threadId?: string } };
            }) => {
              const draft = await client.updateDraft(params.id, {
                to: ["recipient@example.com"],
                subject: "Updated Draft",
                body: "Updated body",
                threadId: params.requestBody.message.threadId,
              });
              return wrapResponse(draft);
            }
          ),
        delete: vi
          .fn()
          .mockImplementation(
            async (params: { userId: string; id: string }) => {
              await client.deleteDraft(params.id);
              return wrapResponse({});
            }
          ),
        send: vi
          .fn()
          .mockImplementation(
            async (params: { userId: string; requestBody: { id: string } }) => {
              const result = await client.sendDraft(params.requestBody.id);
              return wrapResponse(result);
            }
          ),
      },
    },
  };
}

/**
 * Mock implementation of the people_v1.People interface
 */
export function createMockPeopleApi(client: MockGmailClient) {
  return {
    people: {
      connections: {
        list: vi
          .fn()
          .mockImplementation(
            async (params: {
              resourceName: string;
              pageSize?: number;
              pageToken?: string;
            }) => {
              const result = await client.listContacts({
                pageSize: params.pageSize,
                pageToken: params.pageToken,
              });
              return wrapResponse({
                connections: result.contacts,
                nextPageToken: result.nextPageToken,
                totalItems: result.totalItems,
              });
            }
          ),
      },
      get: vi
        .fn()
        .mockImplementation(async (params: { resourceName: string }) => {
          const result = await client.listContacts();
          const contact = result.contacts.find(
            (c) => c.resourceName === params.resourceName
          );
          if (!contact)
            throw new Error(`Contact not found: ${params.resourceName}`);
          return wrapResponse(contact);
        }),
      searchContacts: vi
        .fn()
        .mockImplementation(
          async (params: { query: string; pageSize?: number }) => {
            const result = await client.listContacts({
              pageSize: params.pageSize,
            });
            // Simple search implementation
            const filtered = result.contacts.filter(
              (c) =>
                c.names?.some((n) =>
                  n.displayName
                    ?.toLowerCase()
                    .includes(params.query.toLowerCase())
                ) ||
                c.emailAddresses?.some((e) =>
                  e.value?.toLowerCase().includes(params.query.toLowerCase())
                )
            );
            return wrapResponse({
              results: filtered.map((person) => ({ person })),
            });
          }
        ),
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Mock API Factory
// ─────────────────────────────────────────────────────────────

export interface MockApiResult {
  client: MockGmailClient;
  gmail: ReturnType<typeof createMockGmailApi>;
  people: ReturnType<typeof createMockPeopleApi>;
}

/**
 * Create a complete mock Gmail API setup for testing
 */
export function createMockGmailApiSetup(
  options: MockClientOptions = {}
): MockApiResult {
  const client = new MockGmailClient(options);
  setMockClient(client);

  return {
    client,
    gmail: createMockGmailApi(client),
    people: createMockPeopleApi(client),
  };
}

export { MockGmailClient };
