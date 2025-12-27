// ═══════════════════════════════════════════════════════════════════════════
// Action Tools Tests
// Tests for all action tools in the Agent Engine
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  // Individual tools
  createTaskTool,
  updateTaskTool,
  draftEmailTool,
  sendEmailTool,
  createCalendarEventTool,
  updateCalendarEventTool,

  // All tools array
  actionTools,
  lowRiskActionTools,
  highRiskActionTools,

  // Utilities
  toToolForLLM,
  validateToolParams,
  ToolRegistry,
  registerActionTools,
} from "@/lib/agent/tools";
import type { ExecutionContext } from "@/lib/agent/types";

// ─────────────────────────────────────────────────────────────
// Mock Dependencies
// ─────────────────────────────────────────────────────────────

// Mock the tasks service
vi.mock("@/services/context", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/services/context")>();
  return {
    ...original,
    createTask: vi.fn().mockImplementation((userId, data) =>
      Promise.resolve({
        id: "task-new-1",
        userId,
        title: data.title,
        description: data.description || null,
        status: data.status || "pending",
        priority: data.priority || "medium",
        dueDate: data.dueDate || null,
        startDate: null,
        completedAt: null,
        estimatedMinutes: data.estimatedMinutes || null,
        actualMinutes: null,
        notes: data.notes || null,
        tags: data.tags || [],
        parentId: null,
        position: 0,
        assignedToId: null,
        source: data.source || "manual",
        sourceId: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      })
    ),
    updateTask: vi.fn().mockImplementation((userId, id, data) =>
      Promise.resolve({
        id,
        userId,
        title: data.title || "Existing Task",
        description: data.description,
        status: data.status || "pending",
        priority: data.priority || "medium",
        dueDate: data.dueDate || null,
        startDate: null,
        completedAt: data.status === "completed" ? new Date() : null,
        estimatedMinutes: data.estimatedMinutes || null,
        actualMinutes: data.actualMinutes || null,
        notes: data.notes || null,
        tags: data.tags || [],
        parentId: null,
        position: 0,
        assignedToId: null,
        source: "manual",
        sourceId: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      })
    ),
    getTaskById: vi.fn().mockImplementation((userId, id) =>
      Promise.resolve({
        id,
        userId,
        title: "Existing Task",
        description: "Task description",
        status: "pending",
        priority: "medium",
        dueDate: null,
        startDate: null,
        completedAt: null,
        estimatedMinutes: null,
        actualMinutes: null,
        notes: null,
        tags: ["work"],
        parentId: null,
        position: 0,
        assignedToId: null,
        source: "manual",
        sourceId: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      })
    ),
    completeTask: vi.fn().mockImplementation((userId, id) =>
      Promise.resolve({
        id,
        userId,
        title: "Existing Task",
        description: "Task description",
        status: "completed",
        priority: "medium",
        dueDate: null,
        startDate: null,
        completedAt: new Date(),
        estimatedMinutes: null,
        actualMinutes: null,
        notes: null,
        tags: ["work"],
        parentId: null,
        position: 0,
        assignedToId: null,
        source: "manual",
        sourceId: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      })
    ),
  };
});

// Mock Gmail actions
vi.mock("@/integrations/gmail/actions", () => ({
  createDraft: vi.fn().mockResolvedValue({
    draftId: "draft-123",
    messageId: "msg-456",
    threadId: "thread-789",
  }),
  validateEmailAddresses: vi.fn().mockReturnValue({
    valid: true,
    invalid: [],
  }),
  requestApproval: vi.fn().mockResolvedValue({
    // RequestApprovalResult structure
    approval: {
      id: "approval-123",
      draftId: "draft-123",
      status: "pending",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    draftId: "draft-123",
    gmailDraftId: "gmail-draft-123",
  }),
}));

// Mock Gmail client
vi.mock("@/integrations/gmail", () => ({
  createGmailClient: vi.fn().mockReturnValue({
    createDraft: vi.fn(),
    sendDraft: vi.fn(),
  }),
}));

// Mock Calendar actions
vi.mock("@/integrations/calendar/actions", () => ({
  requestEventCreation: vi.fn().mockResolvedValue({
    success: true,
    approval: {
      id: "approval-event-123",
      status: "pending",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    approvalId: "approval-event-123",
    conflicts: [],
  }),
  requestEventUpdate: vi.fn().mockResolvedValue({
    success: true,
    approval: {
      id: "approval-update-123",
      status: "pending",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    approvalId: "approval-update-123",
    conflicts: [],
  }),
}));

// Mock auth token refresh
// getValidAccessToken returns string | null, not an object
vi.mock("@/lib/auth/token-refresh", () => ({
  getValidAccessToken: vi.fn().mockResolvedValue("test-access-token"),
}));

// ─────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────

const TEST_USER_ID = "user-test-123";
const TEST_SESSION_ID = "session-test-456";

function createTestContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    userId: TEST_USER_ID,
    sessionId: TEST_SESSION_ID,
    conversationId: "conv-test-789",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Tool Definition Tests
// ─────────────────────────────────────────────────────────────

describe("Action Tools - Tool Definitions", () => {
  describe("createTaskTool", () => {
    it("has correct LLM interface", () => {
      expect(createTaskTool.name).toBe("create_task");
      expect(createTaskTool.description).toContain("task");
      expect(createTaskTool.whenToUse).toBeTruthy();
      expect(createTaskTool.examples.length).toBeGreaterThan(0);
      expect(createTaskTool.parametersSchema).toBeDefined();
    });

    it("has correct internal configuration", () => {
      expect(createTaskTool.category).toBe("create");
      expect(createTaskTool.riskLevel).toBe("medium");
      expect(createTaskTool.requiresApproval).toBe(false);
      expect(createTaskTool.requiredIntegrations).toEqual([]);
    });

    it("converts to ToolForLLM correctly", () => {
      const toolForLLM = toToolForLLM(createTaskTool);
      expect(toolForLLM.name).toBe("create_task");
      expect(toolForLLM.description).toBe(createTaskTool.description);
      expect(toolForLLM.whenToUse).toBe(createTaskTool.whenToUse);
      expect(toolForLLM.examples).toEqual(createTaskTool.examples);
      expect(toolForLLM.requiresApproval).toBe(false);
    });
  });

  describe("updateTaskTool", () => {
    it("has correct LLM interface", () => {
      expect(updateTaskTool.name).toBe("update_task");
      expect(updateTaskTool.description).toContain("Update");
      expect(updateTaskTool.whenToUse).toContain("Complete");
      expect(updateTaskTool.examples.length).toBeGreaterThan(0);
    });

    it("has correct internal configuration", () => {
      expect(updateTaskTool.category).toBe("update");
      expect(updateTaskTool.riskLevel).toBe("medium");
      expect(updateTaskTool.requiresApproval).toBe(false);
    });
  });

  describe("draftEmailTool", () => {
    it("has correct LLM interface", () => {
      expect(draftEmailTool.name).toBe("draft_email");
      expect(draftEmailTool.description).toContain("draft");
      expect(draftEmailTool.whenToUse).toContain("Draft");
    });

    it("has correct internal configuration", () => {
      expect(draftEmailTool.category).toBe("draft");
      expect(draftEmailTool.riskLevel).toBe("low");
      expect(draftEmailTool.requiresApproval).toBe(false);
      expect(draftEmailTool.requiredIntegrations).toEqual(["gmail"]);
    });
  });

  describe("sendEmailTool", () => {
    it("has correct LLM interface", () => {
      expect(sendEmailTool.name).toBe("send_email");
      expect(sendEmailTool.description).toContain("Send");
      expect(sendEmailTool.whenToUse).toContain("SEND");
    });

    it("has correct internal configuration", () => {
      expect(sendEmailTool.category).toBe("external");
      expect(sendEmailTool.riskLevel).toBe("high");
      expect(sendEmailTool.requiresApproval).toBe(true);
      expect(sendEmailTool.requiredIntegrations).toEqual(["gmail"]);
    });
  });

  describe("createCalendarEventTool", () => {
    it("has correct LLM interface", () => {
      expect(createCalendarEventTool.name).toBe("create_calendar_event");
      expect(createCalendarEventTool.description).toContain("calendar event");
    });

    it("has correct internal configuration", () => {
      expect(createCalendarEventTool.category).toBe("external");
      expect(createCalendarEventTool.riskLevel).toBe("high");
      expect(createCalendarEventTool.requiresApproval).toBe(true);
      expect(createCalendarEventTool.requiredIntegrations).toEqual(["calendar"]);
    });
  });

  describe("updateCalendarEventTool", () => {
    it("has correct LLM interface", () => {
      expect(updateCalendarEventTool.name).toBe("update_calendar_event");
      expect(updateCalendarEventTool.description).toContain("Modify");
    });

    it("has correct internal configuration", () => {
      expect(updateCalendarEventTool.category).toBe("external");
      expect(updateCalendarEventTool.riskLevel).toBe("high");
      expect(updateCalendarEventTool.requiresApproval).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Input Validation Tests
// ─────────────────────────────────────────────────────────────

describe("Action Tools - Input Validation", () => {
  describe("createTaskTool validation", () => {
    it("validates valid input", () => {
      const result = validateToolParams(createTaskTool, {
        title: "Buy groceries",
        priority: "high",
        dueDate: "2024-01-15",
      });
      expect(result.success).toBe(true);
      expect(result.data?.title).toBe("Buy groceries");
    });

    it("requires title", () => {
      const result = validateToolParams(createTaskTool, {
        priority: "high",
      });
      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.path.includes("title"))).toBe(true);
    });

    it("validates priority enum", () => {
      const result = validateToolParams(createTaskTool, {
        title: "Test",
        priority: "invalid",
      });
      expect(result.success).toBe(false);
    });

    it("validates date format", () => {
      const result = validateToolParams(createTaskTool, {
        title: "Test",
        dueDate: "not-a-date",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateTaskTool validation", () => {
    it("validates valid input", () => {
      const result = validateToolParams(updateTaskTool, {
        taskId: "123e4567-e89b-12d3-a456-426614174000",
        status: "completed",
      });
      expect(result.success).toBe(true);
    });

    it("requires taskId", () => {
      const result = validateToolParams(updateTaskTool, {
        status: "completed",
      });
      expect(result.success).toBe(false);
    });

    it("validates taskId format", () => {
      const result = validateToolParams(updateTaskTool, {
        taskId: "invalid-uuid",
        status: "completed",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("draftEmailTool validation", () => {
    it("validates valid input", () => {
      const result = validateToolParams(draftEmailTool, {
        to: ["john@example.com"],
        subject: "Hello",
        body: "This is a test email",
      });
      expect(result.success).toBe(true);
    });

    it("requires at least one recipient", () => {
      const result = validateToolParams(draftEmailTool, {
        to: [],
        subject: "Hello",
        body: "Test",
      });
      expect(result.success).toBe(false);
    });

    it("validates email format", () => {
      const result = validateToolParams(draftEmailTool, {
        to: ["not-an-email"],
        subject: "Hello",
        body: "Test",
      });
      expect(result.success).toBe(false);
    });

    it("requires subject and body", () => {
      const result = validateToolParams(draftEmailTool, {
        to: ["john@example.com"],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createCalendarEventTool validation", () => {
    it("validates valid input", () => {
      const result = validateToolParams(createCalendarEventTool, {
        summary: "Team Meeting",
        startTime: "2024-01-15T14:00:00",
        endTime: "2024-01-15T15:00:00",
      });
      expect(result.success).toBe(true);
    });

    it("requires summary, startTime, endTime", () => {
      const result = validateToolParams(createCalendarEventTool, {
        summary: "Meeting",
      });
      expect(result.success).toBe(false);
    });

    it("validates datetime format", () => {
      const result = validateToolParams(createCalendarEventTool, {
        summary: "Meeting",
        startTime: "not-a-datetime",
        endTime: "2024-01-15T15:00:00",
      });
      expect(result.success).toBe(false);
    });

    it("validates attendee email format", () => {
      const result = validateToolParams(createCalendarEventTool, {
        summary: "Meeting",
        startTime: "2024-01-15T14:00:00",
        endTime: "2024-01-15T15:00:00",
        attendees: [{ email: "not-valid" }],
      });
      expect(result.success).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Execution Tests
// ─────────────────────────────────────────────────────────────

describe("Action Tools - Execution", () => {
  const testContext = createTestContext();

  describe("createTaskTool execution", () => {
    it("creates a task successfully", async () => {
      const result = await createTaskTool.execute(
        {
          title: "Test Task",
          priority: "high",
        },
        testContext
      );

      expect(result.success).toBe(true);
      expect(result.task.title).toBe("Test Task");
      expect(result.message).toContain("Created task");
    });

    it("includes due date in message", async () => {
      const result = await createTaskTool.execute(
        {
          title: "Due Task",
          dueDate: "2024-01-20",
        },
        testContext
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain("due");
    });
  });

  describe("updateTaskTool execution", () => {
    it("updates a task successfully", async () => {
      const result = await updateTaskTool.execute(
        {
          taskId: "123e4567-e89b-12d3-a456-426614174000",
          priority: "urgent",
        },
        testContext
      );

      expect(result.success).toBe(true);
      expect(result.changes.length).toBeGreaterThan(0);
    });

    it("completes a task", async () => {
      const result = await updateTaskTool.execute(
        {
          taskId: "123e4567-e89b-12d3-a456-426614174000",
          status: "completed",
        },
        testContext
      );

      expect(result.success).toBe(true);
      expect(result.task.status).toBe("completed");
      expect(result.message).toContain("Completed");
    });
  });

  describe("draftEmailTool execution", () => {
    it("creates a draft successfully", async () => {
      const result = await draftEmailTool.execute(
        {
          to: ["john@example.com"],
          subject: "Test Subject",
          body: "Test body content",
        },
        testContext
      );

      expect(result.success).toBe(true);
      expect(result.draft.draftId).toBeDefined();
      expect(result.message).toContain("draft");
    });

    it("throws when Gmail not connected", async () => {
      // Mock getValidAccessToken to return null for this test
      const { getValidAccessToken } = await import("@/lib/auth/token-refresh");
      vi.mocked(getValidAccessToken).mockResolvedValueOnce(null);

      await expect(
        draftEmailTool.execute(
          {
            to: ["john@example.com"],
            subject: "Test",
            body: "Test",
          },
          testContext
        )
      ).rejects.toThrow("Gmail not connected");
    });
  });

  describe("sendEmailTool execution", () => {
    it("creates approval request successfully", async () => {
      const result = await sendEmailTool.execute(
        {
          to: ["john@example.com"],
          subject: "Test Subject",
          body: "Test body content",
        },
        testContext
      );

      expect(result.success).toBe(true);
      expect(result.requiresApproval).toBe(true);
      expect(result.approval.id).toBeDefined();
      expect(result.message).toContain("approval");
    });
  });

  describe("createCalendarEventTool execution", () => {
    it("creates approval request for event", async () => {
      const result = await createCalendarEventTool.execute(
        {
          summary: "Team Meeting",
          startTime: "2024-01-15T14:00:00",
          endTime: "2024-01-15T15:00:00",
        },
        testContext
      );

      expect(result.success).toBe(true);
      expect(result.requiresApproval).toBe(true);
      expect(result.approval.id).toBeDefined();
      expect(result.eventPreview.summary).toBe("Team Meeting");
    });

    it("validates end after start", async () => {
      await expect(
        createCalendarEventTool.execute(
          {
            summary: "Invalid Meeting",
            startTime: "2024-01-15T15:00:00",
            endTime: "2024-01-15T14:00:00",
          },
          testContext
        )
      ).rejects.toThrow("End time must be after start time");
    });
  });

  describe("updateCalendarEventTool execution", () => {
    it("creates approval request for update", async () => {
      const result = await updateCalendarEventTool.execute(
        {
          eventId: "event-123",
          summary: "Updated Meeting Title",
        },
        testContext
      );

      expect(result.success).toBe(true);
      expect(result.requiresApproval).toBe(true);
      expect(result.changes).toContain('title → "Updated Meeting Title"');
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Tool Arrays Tests
// ─────────────────────────────────────────────────────────────

describe("Action Tools - Tool Arrays", () => {
  it("actionTools contains all action tools", () => {
    expect(actionTools).toHaveLength(6);
    expect(actionTools.map((t) => t.name)).toEqual([
      "create_task",
      "update_task",
      "draft_email",
      "send_email",
      "create_calendar_event",
      "update_calendar_event",
    ]);
  });

  it("lowRiskActionTools contains only low/medium risk tools", () => {
    expect(lowRiskActionTools).toHaveLength(3);
    lowRiskActionTools.forEach((tool) => {
      expect(["low", "medium"]).toContain(tool.riskLevel);
      expect(tool.requiresApproval).toBe(false);
    });
  });

  it("highRiskActionTools contains only high risk tools", () => {
    expect(highRiskActionTools).toHaveLength(3);
    highRiskActionTools.forEach((tool) => {
      expect(tool.riskLevel).toBe("high");
      expect(tool.requiresApproval).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Registry Tests
// ─────────────────────────────────────────────────────────────

describe("Action Tools - Registry", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it("registerActionTools registers all tools", () => {
    // Register to the new registry (not the global one)
    registry.registerAll(actionTools);

    const summary = registry.getSummary();
    expect(summary.totalTools).toBe(6);
    expect(summary.byCategory.create).toBe(1);
    expect(summary.byCategory.update).toBe(1);
    expect(summary.byCategory.draft).toBe(1);
    expect(summary.byCategory.external).toBe(3);
  });

  it("filters by risk level", () => {
    registry.registerAll(actionTools);

    const highRiskTools = registry.list({ riskLevel: "high" });
    expect(highRiskTools).toHaveLength(3);
    highRiskTools.forEach((tool) => {
      expect(tool.riskLevel).toBe("high");
    });
  });

  it("filters by required integration", () => {
    registry.registerAll(actionTools);

    const gmailTools = registry.list({ integration: "gmail" });
    expect(gmailTools).toHaveLength(2);
    expect(gmailTools.map((t) => t.name)).toContain("draft_email");
    expect(gmailTools.map((t) => t.name)).toContain("send_email");
  });

  it("filters tools requiring approval", () => {
    registry.registerAll(actionTools);

    const approvalTools = registry.list({ requiresApproval: true });
    expect(approvalTools).toHaveLength(3);
    approvalTools.forEach((tool) => {
      expect(tool.requiresApproval).toBe(true);
    });
  });
});


