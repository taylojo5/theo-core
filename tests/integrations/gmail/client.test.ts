// ═══════════════════════════════════════════════════════════════════════════
// Gmail Client Integration Tests
// Tests for GmailClient with mocked Gmail API
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  MockGmailClient,
  createMockGmailClient,
  createMockMessage,
  createMockThread,
  createMockContact,
  resetMockCounters,
} from "./mocks";

describe("MockGmailClient", () => {
  let client: MockGmailClient;

  beforeEach(() => {
    resetMockCounters();
    client = createMockGmailClient({
      userEmail: "test@example.com",
      historyId: "12345",
    });
  });

  afterEach(() => {
    client.clearSpies();
  });

  // ─────────────────────────────────────────────────────────────
  // Profile Operations
  // ─────────────────────────────────────────────────────────────

  describe("Profile", () => {
    it("should return user profile", async () => {
      const profile = await client.getProfile();

      expect(profile.emailAddress).toBe("test@example.com");
      expect(profile.historyId).toBe("12345");
      expect(profile.messagesTotal).toBeGreaterThanOrEqual(0);
      expect(client.spies.getProfile).toHaveBeenCalledTimes(1);
    });

    it("should update historyId as messages are added", async () => {
      const initialProfile = await client.getProfile();
      const initialHistoryId = initialProfile.historyId;

      // Add a message
      client.addMessage(createMockMessage());

      const updatedProfile = await client.getProfile();
      expect(parseInt(updatedProfile.historyId)).toBeGreaterThan(
        parseInt(initialHistoryId)
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Message Operations
  // ─────────────────────────────────────────────────────────────

  describe("Messages", () => {
    beforeEach(() => {
      // Add some test messages
      client.addMessage(
        createMockMessage({
          id: "msg_001",
          subject: "First Message",
          labelIds: ["INBOX", "UNREAD"],
        })
      );
      client.addMessage(
        createMockMessage({
          id: "msg_002",
          subject: "Second Message",
          labelIds: ["INBOX"],
        })
      );
      client.addMessage(
        createMockMessage({
          id: "msg_003",
          subject: "Starred Message",
          labelIds: ["INBOX", "STARRED"],
        })
      );
    });

    describe("listMessages", () => {
      it("should list all messages", async () => {
        const result = await client.listMessages();

        expect(result.messages.length).toBe(3);
        expect(result.resultSizeEstimate).toBe(3);
        expect(client.spies.listMessages).toHaveBeenCalledTimes(1);
      });

      it("should filter by label", async () => {
        const result = await client.listMessages({ labelIds: ["STARRED"] });

        expect(result.messages.length).toBe(1);
        expect(result.messages[0].id).toBe("msg_003");
      });

      it("should support pagination", async () => {
        const page1 = await client.listMessages({ maxResults: 2 });

        expect(page1.messages.length).toBe(2);
        expect(page1.nextPageToken).toBeDefined();

        const page2 = await client.listMessages({
          maxResults: 2,
          pageToken: page1.nextPageToken,
        });

        expect(page2.messages.length).toBe(1);
        expect(page2.nextPageToken).toBeUndefined();
      });
    });

    describe("getMessage", () => {
      it("should get a specific message", async () => {
        const message = await client.getMessage("msg_001");

        expect(message.id).toBe("msg_001");
        expect(message.subject).toBe("First Message");
        expect(client.spies.getMessage).toHaveBeenCalledWith("msg_001");
      });

      it("should throw for non-existent message", async () => {
        await expect(client.getMessage("non_existent")).rejects.toThrow(
          "Message not found"
        );
      });

      it("should parse message fields correctly", async () => {
        const message = await client.getMessage("msg_001");

        expect(message.labelIds).toContain("INBOX");
        expect(message.labelIds).toContain("UNREAD");
        expect(message.isRead).toBe(false);
        expect(message.subject).toBeDefined();
        expect(message.from).toBeDefined();
      });
    });

    describe("modifyMessage", () => {
      it("should add labels to a message", async () => {
        const result = await client.modifyMessage("msg_002", {
          addLabelIds: ["IMPORTANT"],
        });

        expect(result.labelIds).toContain("IMPORTANT");
        expect(result.labelIds).toContain("INBOX");
      });

      it("should remove labels from a message", async () => {
        const result = await client.modifyMessage("msg_001", {
          removeLabelIds: ["UNREAD"],
        });

        expect(result.labelIds).not.toContain("UNREAD");
        expect(result.labelIds).toContain("INBOX");
      });

      it("should handle combined add and remove", async () => {
        const result = await client.modifyMessage("msg_001", {
          addLabelIds: ["STARRED"],
          removeLabelIds: ["UNREAD"],
        });

        expect(result.labelIds).toContain("STARRED");
        expect(result.labelIds).not.toContain("UNREAD");
      });

      it("should update history when modifying", async () => {
        const beforeHistory = client.getHistoryId();
        await client.modifyMessage("msg_001", { addLabelIds: ["STARRED"] });
        const afterHistory = client.getHistoryId();

        expect(parseInt(afterHistory)).toBeGreaterThan(parseInt(beforeHistory));
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Thread Operations
  // ─────────────────────────────────────────────────────────────

  describe("Threads", () => {
    beforeEach(() => {
      // Add a thread with multiple messages
      const thread = createMockThread({
        id: "thread_001",
        messageCount: 3,
        subject: "Test Thread",
      });
      thread.messages?.forEach((m) => client.addMessage(m));
    });

    describe("listThreads", () => {
      it("should list threads", async () => {
        const result = await client.listThreads();

        expect(result.threads.length).toBeGreaterThanOrEqual(1);
        expect(client.spies.listThreads).toHaveBeenCalledTimes(1);
      });

      it("should filter by label", async () => {
        const result = await client.listThreads({ labelIds: ["INBOX"] });

        expect(result.threads.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe("getThread", () => {
      it("should get thread with all messages", async () => {
        const thread = await client.getThread("thread_001");

        expect(thread.id).toBe("thread_001");
        expect(thread.messages.length).toBe(3);
        expect(client.spies.getThread).toHaveBeenCalledWith("thread_001");
      });

      it("should throw for non-existent thread", async () => {
        await expect(client.getThread("non_existent")).rejects.toThrow(
          "Thread not found"
        );
      });

      it("should have messages in chronological order", async () => {
        const thread = await client.getThread("thread_001");

        for (let i = 1; i < thread.messages.length; i++) {
          const prevDate = new Date(thread.messages[i - 1].date);
          const currDate = new Date(thread.messages[i].date);
          expect(currDate.getTime()).toBeGreaterThanOrEqual(prevDate.getTime());
        }
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Label Operations
  // ─────────────────────────────────────────────────────────────

  describe("Labels", () => {
    describe("listLabels", () => {
      it("should include system labels", async () => {
        const labels = await client.listLabels();

        const labelIds = labels.map((l) => l.id);
        expect(labelIds).toContain("INBOX");
        expect(labelIds).toContain("SENT");
        expect(labelIds).toContain("DRAFT");
        expect(labelIds).toContain("TRASH");
        expect(client.spies.listLabels).toHaveBeenCalledTimes(1);
      });
    });

    describe("createLabel", () => {
      it("should create a new label", async () => {
        const label = await client.createLabel("My Custom Label");

        expect(label.name).toBe("My Custom Label");
        expect(label.id).toBeDefined();
        expect(label.type).toBe("user");
      });

      it("should support label colors", async () => {
        const label = await client.createLabel("Colored Label", {
          backgroundColor: "#ff0000",
          textColor: "#ffffff",
        });

        expect(label.color?.backgroundColor).toBe("#ff0000");
        expect(label.color?.textColor).toBe("#ffffff");
      });

      it("should persist created labels", async () => {
        await client.createLabel("Persistent Label");
        const labels = await client.listLabels();

        const found = labels.find((l) => l.name === "Persistent Label");
        expect(found).toBeDefined();
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // History Operations
  // ─────────────────────────────────────────────────────────────

  describe("History", () => {
    it("should track message additions", async () => {
      const startHistoryId = client.getHistoryId();

      client.addMessage(createMockMessage({ id: "new_msg" }));

      const history = await client.listHistory({
        startHistoryId,
      });

      expect(history.history?.length).toBeGreaterThan(0);
      const addedMessages =
        history.history?.flatMap((h) => h.messagesAdded || []) ?? [];
      expect(addedMessages.some((m) => m.message?.id === "new_msg")).toBe(true);
    });

    it("should track message deletions", async () => {
      client.addMessage(createMockMessage({ id: "to_delete" }));
      const startHistoryId = client.getHistoryId();

      client.removeMessage("to_delete");

      const history = await client.listHistory({
        startHistoryId,
      });

      const deletedMessages =
        history.history?.flatMap((h) => h.messagesDeleted || []) ?? [];
      expect(deletedMessages.some((m) => m.message?.id === "to_delete")).toBe(
        true
      );
    });

    it("should track label changes", async () => {
      client.addMessage(createMockMessage({ id: "label_test" }));
      const startHistoryId = client.getHistoryId();

      await client.modifyMessage("label_test", { addLabelIds: ["STARRED"] });

      const history = await client.listHistory({
        startHistoryId,
      });

      const labelAdded =
        history.history?.flatMap((h) => h.labelsAdded || []) ?? [];
      expect(labelAdded.length).toBeGreaterThan(0);
    });

    it("should return current historyId", async () => {
      const history = await client.listHistory({
        startHistoryId: "1",
      });

      expect(history.historyId).toBe(client.getHistoryId());
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Draft Operations
  // ─────────────────────────────────────────────────────────────

  describe("Drafts", () => {
    describe("createDraft", () => {
      it("should create a draft", async () => {
        const draft = await client.createDraft({
          to: ["recipient@example.com"],
          subject: "Draft Subject",
          body: "Draft body content",
        });

        expect(draft.id).toBeDefined();
        expect(draft.message).toBeDefined();
        expect(client.spies.createDraft).toHaveBeenCalledTimes(1);
      });

      it("should persist draft", async () => {
        await client.createDraft({
          to: ["recipient@example.com"],
          subject: "Persistent Draft",
          body: "Body",
        });

        const state = client.getState();
        expect(state.drafts.length).toBe(1);
      });
    });

    describe("updateDraft", () => {
      it("should update an existing draft", async () => {
        const draft = await client.createDraft({
          to: ["recipient@example.com"],
          subject: "Original Subject",
          body: "Original body",
        });

        const updated = await client.updateDraft(draft.id, {
          to: ["new-recipient@example.com"],
          subject: "Updated Subject",
          body: "Updated body",
        });

        expect(updated.id).toBe(draft.id);
      });

      it("should throw for non-existent draft", async () => {
        await expect(
          client.updateDraft("non_existent", {
            to: ["test@example.com"],
            subject: "Test",
            body: "Test",
          })
        ).rejects.toThrow("Draft not found");
      });
    });

    describe("deleteDraft", () => {
      it("should delete a draft", async () => {
        const draft = await client.createDraft({
          to: ["recipient@example.com"],
          subject: "To Delete",
          body: "Body",
        });

        await client.deleteDraft(draft.id);

        const state = client.getState();
        expect(state.drafts.find((d) => d.id === draft.id)).toBeUndefined();
      });
    });

    describe("sendDraft", () => {
      it("should send a draft and convert to sent message", async () => {
        const draft = await client.createDraft({
          to: ["recipient@example.com"],
          subject: "To Send",
          body: "Body",
        });

        const sentMessage = await client.sendDraft(draft.id);

        expect(sentMessage.labelIds).toContain("SENT");
        expect(sentMessage.labelIds).not.toContain("DRAFT");

        // Draft should be removed
        const state = client.getState();
        expect(state.drafts.find((d) => d.id === draft.id)).toBeUndefined();
      });

      it("should record history when sending", async () => {
        const draft = await client.createDraft({
          to: ["recipient@example.com"],
          subject: "To Send",
          body: "Body",
        });

        const startHistoryId = client.getHistoryId();
        await client.sendDraft(draft.id);

        const history = await client.listHistory({ startHistoryId });
        const addedMessages =
          history.history?.flatMap((h) => h.messagesAdded || []) ?? [];
        expect(addedMessages.length).toBeGreaterThan(0);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Contact Operations
  // ─────────────────────────────────────────────────────────────

  describe("Contacts", () => {
    beforeEach(() => {
      client.addContact(
        createMockContact({
          displayName: "John Doe",
          email: "john@example.com",
          company: "Acme Inc",
        })
      );
      client.addContact(
        createMockContact({
          displayName: "Jane Smith",
          email: "jane@example.com",
        })
      );
    });

    describe("listContacts", () => {
      it("should list contacts", async () => {
        const result = await client.listContacts();

        expect(result.contacts.length).toBe(2);
        expect(result.totalItems).toBe(2);
        expect(client.spies.listContacts).toHaveBeenCalledTimes(1);
      });

      it("should support pagination", async () => {
        const page1 = await client.listContacts({ pageSize: 1 });

        expect(page1.contacts.length).toBe(1);
        expect(page1.nextPageToken).toBeDefined();

        const page2 = await client.listContacts({
          pageSize: 1,
          pageToken: page1.nextPageToken,
        });

        expect(page2.contacts.length).toBe(1);
        expect(page2.nextPageToken).toBeUndefined();
      });
    });

    describe("listContactsParsed", () => {
      it("should return parsed contacts", async () => {
        const result = await client.listContactsParsed();

        expect(result.contacts.length).toBe(2);
        expect(result.contacts[0].name).toBe("John Doe");
        expect(result.contacts[0].email).toBe("john@example.com");
        expect(result.contacts[0].company).toBe("Acme Inc");
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Error Simulation
  // ─────────────────────────────────────────────────────────────

  describe("Error Simulation", () => {
    it("should simulate errors on specific operations", async () => {
      const errorClient = createMockGmailClient({
        errorOn: [
          {
            operation: "getProfile",
            error: new Error("Simulated API error"),
            times: 1,
          },
        ],
      });

      await expect(errorClient.getProfile()).rejects.toThrow(
        "Simulated API error"
      );

      // Second call should succeed
      const profile = await errorClient.getProfile();
      expect(profile).toBeDefined();
    });

    it("should simulate persistent errors", async () => {
      const errorClient = createMockGmailClient({
        errorOn: [
          {
            operation: "listMessages",
            error: new Error("Persistent error"),
          },
        ],
      });

      await expect(errorClient.listMessages()).rejects.toThrow(
        "Persistent error"
      );
      await expect(errorClient.listMessages()).rejects.toThrow(
        "Persistent error"
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Send Operations
  // ─────────────────────────────────────────────────────────────

  describe("sendMessage", () => {
    it("should send a message", async () => {
      const sent = await client.sendMessage({
        to: ["recipient@example.com"],
        subject: "Test Send",
        body: "Message body",
      });

      expect(sent.id).toBeDefined();
      expect(sent.labelIds).toContain("SENT");
      expect(client.spies.sendMessage).toHaveBeenCalledTimes(1);
    });

    it("should add message to history", async () => {
      const startHistoryId = client.getHistoryId();

      await client.sendMessage({
        to: ["recipient@example.com"],
        subject: "Test Send",
        body: "Body",
      });

      const history = await client.listHistory({ startHistoryId });
      const addedMessages =
        history.history?.flatMap((h) => h.messagesAdded || []) ?? [];
      expect(addedMessages.length).toBeGreaterThan(0);
    });

    it("should support thread replies", async () => {
      // Create initial thread
      const thread = createMockThread({ id: "reply_thread" });
      thread.messages?.forEach((m) => client.addMessage(m));

      const reply = await client.sendMessage({
        to: ["recipient@example.com"],
        subject: "Re: Test Thread",
        body: "Reply body",
        threadId: "reply_thread",
      });

      expect(reply.threadId).toBe("reply_thread");
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Factory Function Tests
// ─────────────────────────────────────────────────────────────

describe("Mock Factory Functions", () => {
  beforeEach(() => {
    resetMockCounters();
  });

  describe("createMockMessage", () => {
    it("should create a message with default values", () => {
      const message = createMockMessage();

      expect(message.id).toBeDefined();
      expect(message.threadId).toBeDefined();
      expect(message.labelIds).toContain("INBOX");
      expect(message.payload).toBeDefined();
      expect(message.payload?.headers).toBeDefined();
    });

    it("should respect provided options", () => {
      const message = createMockMessage({
        id: "custom_id",
        subject: "Custom Subject",
        from: "custom@example.com",
        labelIds: ["STARRED"],
      });

      expect(message.id).toBe("custom_id");
      const subjectHeader = message.payload?.headers?.find(
        (h) => h.name === "Subject"
      );
      expect(subjectHeader?.value).toBe("Custom Subject");
      expect(message.labelIds).toContain("STARRED");
    });

    it("should support attachments", () => {
      const message = createMockMessage({
        hasAttachments: true,
      });

      const parts = message.payload?.parts || [];
      const attachmentPart = parts.find(
        (p) => p.filename && p.body?.attachmentId
      );
      expect(attachmentPart).toBeDefined();
    });
  });

  describe("createMockThread", () => {
    it("should create a thread with messages", () => {
      const thread = createMockThread({ messageCount: 3 });

      expect(thread.id).toBeDefined();
      expect(thread.messages).toHaveLength(3);
      expect(thread.messages![0].threadId).toBe(thread.id);
    });
  });

  describe("createMockContact", () => {
    it("should create a contact with all fields", () => {
      const contact = createMockContact({
        displayName: "Test Contact",
        email: "test@example.com",
        company: "Test Corp",
        phone: "+1-555-1234",
      });

      expect(contact.names?.[0].displayName).toBe("Test Contact");
      expect(contact.emailAddresses?.[0].value).toBe("test@example.com");
      expect(contact.organizations?.[0].name).toBe("Test Corp");
      expect(contact.phoneNumbers?.[0].value).toBe("+1-555-1234");
    });
  });
});
