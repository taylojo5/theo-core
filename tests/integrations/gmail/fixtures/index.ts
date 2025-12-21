// ═══════════════════════════════════════════════════════════════════════════
// Gmail Test Fixtures - Index
// Central export for all Gmail test fixtures
// ═══════════════════════════════════════════════════════════════════════════

// Message fixtures
export {
  simpleTextMessage,
  htmlMessage,
  attachmentMessage,
  draftMessage,
  actionableMessage,
  conversationThread,
  expectedParsedSimpleMessage,
  messageListResponse,
  historyListResponse,
  labelFixtures,
  profileFixture,
} from "./messages";

// Contact fixtures
export {
  fullContact,
  minimalContact,
  nameOnlyContact,
  orgOnlyContact,
  multipleEmailContact,
  contactListResponse,
  contactListPage2Response,
  expectedParsedFullContact,
  expectedParsedMinimalContact,
  syncTestContacts,
  expectedSyncWithEmailRequired,
} from "./contacts";

// Re-export mocks from the mocks directory
export * from "../mocks";
