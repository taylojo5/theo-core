// ═══════════════════════════════════════════════════════════════════════════
// Tool Execution Engine Tests
// Tests for parameter validation, integration checks, and execution
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import {
  executeToolCall,
  validateParameters,
  checkIntegrations,
  formatExecutionResult,
  formatErrorResult,
  isSuccessfulExecution,
  isFailedExecution,
  isPendingApproval,
  isValidationError,
  type ToolExecutionRequest,
  type ExecutionOutcome,
} from "@/lib/agent/execution";
import { defineTool, objectSchema } from "@/lib/agent/tools/types";
import type { ExecutionContext } from "@/lib/agent/types";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

// Mock the database
vi.mock("@/lib/db", () => ({
  db: {
    account: {
      findFirst: vi.fn(),
    },
    actionApproval: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

// Mock auth scopes
vi.mock("@/lib/auth/scopes", () => ({
  parseScopes: vi.fn((scope: string) => scope?.split(" ") || []),
  getIntegrationStatus: vi.fn((scopes: string[]) => ({
    gmail: {
      connected: scopes.includes("gmail.readonly"),
      canRead: scopes.includes("gmail.readonly"),
      canSend: scopes.includes("gmail.send"),
      canManageLabels: false,
      missingScopes: [],
    },
    calendar: {
      connected: scopes.includes("calendar.readonly"),
      canRead: scopes.includes("calendar.readonly"),
      canWrite: scopes.includes("calendar.events"),
      missingScopes: [],
    },
    contacts: {
      connected: scopes.includes("contacts.readonly"),
    },
    missingScopes: [],
  })),
}));

// Mock audit service
vi.mock("@/lib/agent/audit/service", () => ({
  logAgentAction: vi.fn().mockResolvedValue({
    id: "audit-123",
    userId: "user-123",
    status: "completed",
  }),
}));

// Mock tool registry - we'll use a real registry with test tools
vi.mock("@/lib/agent/tools/registry", async () => {
  const actual = await vi.importActual<typeof import("@/lib/agent/tools/registry")>(
    "@/lib/agent/tools/registry"
  );
  return {
    ...actual,
    toolRegistry: new actual.ToolRegistry(),
  };
});

// Import the mocked registry after mocking
import { toolRegistry } from "@/lib/agent/tools/registry";
import { db } from "@/lib/db";

// ─────────────────────────────────────────────────────────────
// Test Tools
// ─────────────────────────────────────────────────────────────

const queryEventsTool = defineTool({
  name: "query_events",
  description: "Query calendar events",
  whenToUse: "When user asks about their calendar or schedule",
  examples: ["Show my events tomorrow", "What meetings do I have?"],
  parametersSchema: objectSchema(
    {
      startDate: { type: "string", description: "Start date (ISO format)" },
      endDate: { type: "string", description: "End date (ISO format)" },
      limit: { type: "integer", description: "Max events to return" },
    },
    ["startDate"]
  ),
  category: "query",
  riskLevel: "low",
  requiresApproval: false,
  requiredIntegrations: ["calendar"],
  inputValidator: z.object({
    startDate: z.string(),
    endDate: z.string().optional(),
    limit: z.number().int().positive().optional(),
  }),
  execute: vi.fn().mockResolvedValue([
    { id: "event-1", title: "Team Meeting", startTime: "2024-01-01T10:00:00Z" },
    { id: "event-2", title: "Lunch", startTime: "2024-01-01T12:00:00Z" },
  ]),
});

const sendEmailTool = defineTool({
  name: "send_email",
  description: "Send an email",
  whenToUse: "When user wants to send an email",
  examples: ["Send an email to John", "Email the team about the meeting"],
  parametersSchema: objectSchema(
    {
      to: { type: "string", description: "Recipient email" },
      subject: { type: "string", description: "Email subject" },
      body: { type: "string", description: "Email body" },
    },
    ["to", "subject", "body"]
  ),
  category: "external",
  riskLevel: "high",
  requiresApproval: true,
  requiredIntegrations: ["gmail"],
  inputValidator: z.object({
    to: z.string().email(),
    subject: z.string().min(1),
    body: z.string().min(1),
  }),
  execute: vi.fn().mockResolvedValue({ messageId: "msg-123", sent: true }),
});

const createTaskTool = defineTool({
  name: "create_task",
  description: "Create a new task",
  whenToUse: "When user wants to create a task",
  examples: ["Create a task", "Add a todo"],
  parametersSchema: objectSchema(
    {
      title: { type: "string", description: "Task title" },
      description: { type: "string", description: "Task description" },
    },
    ["title"]
  ),
  category: "create",
  riskLevel: "low",
  requiresApproval: false,
  requiredIntegrations: [], // No external integrations required
  inputValidator: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
  }),
  execute: vi.fn().mockResolvedValue({ id: "task-123", title: "Test Task" }),
});

// ─────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────

function createTestContext(): ExecutionContext {
  return {
    userId: "user-123",
    sessionId: "session-123",
    conversationId: "conv-123",
  };
}

function createTestRequest(
  overrides: Partial<ToolExecutionRequest> = {}
): ToolExecutionRequest {
  return {
    toolName: "query_events",
    parameters: { startDate: "2024-01-01" },
    context: createTestContext(),
    decision: {
      action: "execute",
      confidence: 0.9,
      reasoning: "User asked about their schedule",
    },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("Tool Execution Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toolRegistry.clear();
    toolRegistry.registerAll([queryEventsTool, sendEmailTool, createTaskTool]);
  });

  afterEach(() => {
    toolRegistry.clear();
  });

  // ─────────────────────────────────────────────────────────────
  // Parameter Validation Tests
  // ─────────────────────────────────────────────────────────────

  describe("validateParameters", () => {
    it("should validate valid parameters", () => {
      const result = validateParameters(queryEventsTool, {
        startDate: "2024-01-01",
        limit: 10,
      });

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.parsed).toEqual({
          startDate: "2024-01-01",
          limit: 10,
        });
      }
    });

    it("should reject missing required parameters", () => {
      const result = validateParameters(queryEventsTool, {
        limit: 10,
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].path).toContain("startDate");
      }
    });

    it("should reject invalid parameter types", () => {
      const result = validateParameters(queryEventsTool, {
        startDate: "2024-01-01",
        limit: "not a number",
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it("should validate email format for send_email", () => {
      const result = validateParameters(sendEmailTool, {
        to: "not-an-email",
        subject: "Test",
        body: "Hello",
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path.includes("to"))).toBe(true);
      }
    });

    it("should accept valid email for send_email", () => {
      const result = validateParameters(sendEmailTool, {
        to: "test@example.com",
        subject: "Test",
        body: "Hello",
      });

      expect(result.valid).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Integration Check Tests
  // ─────────────────────────────────────────────────────────────

  describe("checkIntegrations", () => {
    it("should return available for empty requirements", async () => {
      const result = await checkIntegrations([], "user-123");

      expect(result.available).toBe(true);
    });

    it("should return available when integrations are connected", async () => {
      vi.mocked(db.account.findFirst).mockResolvedValue({
        scope: "calendar.readonly calendar.events",
        id: "acc-123",
        userId: "user-123",
        type: "oauth",
        provider: "google",
        providerAccountId: "123",
        refresh_token: null,
        access_token: null,
        expires_at: null,
        token_type: null,
        id_token: null,
        session_state: null,
      });

      const result = await checkIntegrations(["calendar"], "user-123");

      expect(result.available).toBe(true);
    });

    it("should return missing when integrations are not connected", async () => {
      vi.mocked(db.account.findFirst).mockResolvedValue({
        scope: "profile email",
        id: "acc-123",
        userId: "user-123",
        type: "oauth",
        provider: "google",
        providerAccountId: "123",
        refresh_token: null,
        access_token: null,
        expires_at: null,
        token_type: null,
        id_token: null,
        session_state: null,
      });

      const result = await checkIntegrations(["calendar"], "user-123");

      expect(result.available).toBe(false);
      if (!result.available) {
        expect(result.missing).toContain("calendar");
      }
    });

    it("should return missing when no account exists", async () => {
      vi.mocked(db.account.findFirst).mockResolvedValue(null);

      const result = await checkIntegrations(["gmail", "calendar"], "user-123");

      expect(result.available).toBe(false);
      if (!result.available) {
        expect(result.missing).toContain("gmail");
        expect(result.missing).toContain("calendar");
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Execution Tests
  // ─────────────────────────────────────────────────────────────

  describe("executeToolCall", () => {
    beforeEach(() => {
      // Set up connected integrations by default
      vi.mocked(db.account.findFirst).mockResolvedValue({
        scope: "calendar.readonly gmail.readonly gmail.send",
        id: "acc-123",
        userId: "user-123",
        type: "oauth",
        provider: "google",
        providerAccountId: "123",
        refresh_token: null,
        access_token: null,
        expires_at: null,
        token_type: null,
        id_token: null,
        session_state: null,
      });
    });

    it("should return tool_not_found for unknown tools", async () => {
      const request = createTestRequest({
        toolName: "unknown_tool",
      });

      const result = await executeToolCall(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("tool_not_found");
      }
    });

    it("should return validation_failed for invalid parameters", async () => {
      const request = createTestRequest({
        toolName: "query_events",
        parameters: { limit: "invalid" }, // Missing required startDate
      });

      const result = await executeToolCall(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("validation_failed");
        expect(result.error.retryable).toBe(true);
      }
    });

    it("should return integration_missing when required integration not connected", async () => {
      vi.mocked(db.account.findFirst).mockResolvedValue(null);

      const request = createTestRequest({
        toolName: "query_events",
        parameters: { startDate: "2024-01-01" },
      });

      const result = await executeToolCall(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("integration_missing");
        expect(result.error.retryable).toBe(false);
      }
    });

    it("should execute tool successfully when all checks pass", async () => {
      const request = createTestRequest({
        toolName: "query_events",
        parameters: { startDate: "2024-01-01" },
      });

      const result = await executeToolCall(request);

      expect(result.success).toBe(true);
      if (isSuccessfulExecution(result)) {
        expect(Array.isArray(result.result)).toBe(true);
        expect(result.auditLogId).toBe("audit-123");
      }
    });

    it("should execute tools without required integrations", async () => {
      const request = createTestRequest({
        toolName: "create_task",
        parameters: { title: "Test Task" },
      });

      const result = await executeToolCall(request);

      expect(result.success).toBe(true);
      if (isSuccessfulExecution(result)) {
        expect(result.result).toEqual({ id: "task-123", title: "Test Task" });
      }
    });

    it("should create approval for high-risk actions when decision is request_approval", async () => {
      vi.mocked(db.actionApproval.create).mockResolvedValue({
        id: "approval-123",
        userId: "user-123",
        toolName: "send_email",
        parameters: { to: "test@example.com", subject: "Test", body: "Hello" },
        actionType: "external",
        riskLevel: "high",
        reasoning: "User wants to send email",
        status: "pending",
        conversationId: "conv-123",
        planId: null,
        stepIndex: null,
        requestedAt: new Date(),
        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
        decidedAt: null,
        result: null,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = createTestRequest({
        toolName: "send_email",
        parameters: { to: "test@example.com", subject: "Test", body: "Hello" },
        decision: {
          action: "request_approval",
          confidence: 0.9,
          reasoning: "User wants to send email",
        },
      });

      const result = await executeToolCall(request);

      expect(result.success).toBe(true);
      if (isPendingApproval(result)) {
        expect(result.approvalRequired).toBe(true);
        expect(result.approvalId).toBe("approval-123");
        expect(result.approvalSummary.riskLevel).toBe("high");
      }
    });

    it("should handle execution failures gracefully", async () => {
      const failingTool = defineTool({
        ...queryEventsTool,
        name: "failing_tool",
        execute: vi.fn().mockRejectedValue(new Error("Network timeout")),
      });
      toolRegistry.register(failingTool);

      const request = createTestRequest({
        toolName: "failing_tool",
        parameters: { startDate: "2024-01-01" },
      });

      const result = await executeToolCall(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("execution_failed");
        expect(result.error.message).toBe("Network timeout");
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Type Guard Tests
  // ─────────────────────────────────────────────────────────────

  describe("Type Guards", () => {
    it("isSuccessfulExecution should identify successful executions", () => {
      const success: ExecutionOutcome = {
        success: true,
        result: { data: "test" },
        approvalRequired: false,
        auditLogId: "audit-123",
        durationMs: 100,
      };

      expect(isSuccessfulExecution(success)).toBe(true);
      expect(isFailedExecution(success)).toBe(false);
      expect(isPendingApproval(success)).toBe(false);
    });

    it("isFailedExecution should identify failed executions", () => {
      const failure: ExecutionOutcome = {
        success: false,
        error: {
          code: "execution_failed",
          message: "Something went wrong",
          retryable: false,
        },
        auditLogId: "audit-123",
        durationMs: 100,
      };

      expect(isSuccessfulExecution(failure)).toBe(false);
      expect(isFailedExecution(failure)).toBe(true);
      expect(isPendingApproval(failure)).toBe(false);
    });

    it("isPendingApproval should identify pending approvals", () => {
      const pending: ExecutionOutcome = {
        success: true,
        approvalRequired: true,
        approvalId: "approval-123",
        expiresAt: new Date(),
        approvalSummary: {
          toolName: "send_email",
          actionDescription: "Send an email",
          riskLevel: "high",
          reasoning: "User wants to send email",
          keyParameters: { to: "test@example.com" },
        },
        auditLogId: "audit-123",
        durationMs: 100,
      };

      expect(isSuccessfulExecution(pending)).toBe(false);
      expect(isFailedExecution(pending)).toBe(false);
      expect(isPendingApproval(pending)).toBe(true);
    });

    it("isValidationError should identify validation error details", () => {
      const validationDetails = {
        type: "validation" as const,
        fieldErrors: [{ path: "email", message: "Invalid email" }],
        llmFriendlyMessage: "Please provide a valid email",
      };

      const integrationDetails = {
        type: "integration" as const,
        missingIntegrations: ["gmail"],
        connectionInstructions: "Connect Gmail",
      };

      expect(isValidationError(validationDetails)).toBe(true);
      expect(isValidationError(integrationDetails)).toBe(false);
      expect(isValidationError(undefined)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Result Formatting Tests
  // ─────────────────────────────────────────────────────────────

  describe("formatExecutionResult", () => {
    it("should format successful query results", () => {
      const outcome: ExecutionOutcome = {
        success: true,
        result: [
          { id: "1", title: "Event 1" },
          { id: "2", title: "Event 2" },
        ],
        approvalRequired: false,
        auditLogId: "audit-123",
        durationMs: 50,
      };

      const formatted = formatExecutionResult(outcome, "query_events");

      expect(formatted.success).toBe(true);
      expect(formatted.summary).toContain("2");
      expect(formatted.summary).toContain("event");
      expect(formatted.metadata.toolName).toBe("query_events");
      expect(formatted.metadata.toolCategory).toBe("query");
    });

    it("should format empty query results", () => {
      const outcome: ExecutionOutcome = {
        success: true,
        result: [],
        approvalRequired: false,
        auditLogId: "audit-123",
        durationMs: 50,
      };

      const formatted = formatExecutionResult(outcome, "query_events");

      expect(formatted.success).toBe(true);
      expect(formatted.summary.toLowerCase()).toContain("no");
    });

    it("should format approval required results", () => {
      const outcome: ExecutionOutcome = {
        success: true,
        approvalRequired: true,
        approvalId: "approval-123",
        expiresAt: new Date(Date.now() + 3600000),
        approvalSummary: {
          toolName: "send_email",
          actionDescription: "Send an email",
          riskLevel: "high",
          reasoning: "User wants to send email",
          keyParameters: { to: "test@example.com" },
        },
        auditLogId: "audit-123",
        durationMs: 50,
      };

      const formatted = formatExecutionResult(outcome, "send_email");

      expect(formatted.success).toBe(true);
      expect(formatted.summary.toLowerCase()).toContain("approval");
      expect(formatted.userNotification).toBeDefined();
      expect(formatted.metadata.requiredApproval).toBe(true);
      expect(formatted.metadata.approvalId).toBe("approval-123");
    });

    it("should format error results with suggestions", () => {
      const outcome: ExecutionOutcome = {
        success: false,
        error: {
          code: "integration_missing",
          message: "Gmail not connected",
          details: {
            type: "integration",
            missingIntegrations: ["gmail"],
            connectionInstructions: "Go to settings",
          },
          retryable: false,
        },
        auditLogId: "audit-123",
        durationMs: 10,
      };

      const formatted = formatExecutionResult(outcome, "send_email");

      expect(formatted.success).toBe(false);
      expect(formatted.summary.toLowerCase()).toContain("integration");
      expect(formatted.suggestedFollowUps).toBeDefined();
      expect(formatted.suggestedFollowUps?.length).toBeGreaterThan(0);
    });
  });

  describe("formatErrorResult", () => {
    it("should format pre-execution errors", () => {
      const formatted = formatErrorResult(
        "unknown_tool",
        "tool_not_found",
        "Tool not registered",
        "audit-123"
      );

      expect(formatted.success).toBe(false);
      expect(formatted.summary).toContain("unknown_tool");
      expect(formatted.metadata.auditLogId).toBe("audit-123");
    });
  });
});

