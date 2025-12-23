// ═══════════════════════════════════════════════════════════════════════════
// Gmail Test Mocks - Index
// Central export for all Gmail test mocks and utilities
// ═══════════════════════════════════════════════════════════════════════════

export { MockGmailClient, createMockGmailClient } from "./mock-client";
export type { MockClientOptions, MockApiOptions } from "./mock-client";
export { createMockGmailApi, createMockGmailApiSetup } from "./mock-api";
export {
  createMockMessage,
  createMockThread,
  createMockHistoryEntry,
  createMockProfile,
  createMockLabel,
  createMockDraft,
  createMockContact,
  resetMockCounters,
} from "./mock-factories";
