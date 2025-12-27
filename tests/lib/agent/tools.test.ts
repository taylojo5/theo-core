// ═══════════════════════════════════════════════════════════════════════════
// Tool Registry Tests
// Tests for Tool Registry, validation, and context utilities
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import {
  // Types and utilities
  ToolDefinition,
  toToolForLLM,
  isToolAvailable,
  defineTool,
  objectSchema,

  // Registry
  ToolRegistry,
  toolRegistry,

  // Validation
  validateToolParams,
  validateWithSchema,
  formatZodErrors,
  formatErrorsForLLM,
  formatValidationError,
  commonSchemas,
  paginatedQuerySchema,
  dateRangeSchema,

  // Context
  createExecutionContext,
  createExtendedContext,
  createSystemContext,
  withPlanContext,
  withConversationContext,
  withSessionContext,
  isValidContext,
  hasPlanContext,
  hasConversationContext,
  createTokenProvider,
} from "@/lib/agent/tools";

// ─────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────

// Input and output types for test tools
interface QueryEventsInput {
  startDate: string;
  endDate?: string;
  limit?: number;
}

interface QueryEventsOutput {
  events: Array<{ id: string; title: string }>;
  total: number;
}

interface CreateTaskInput {
  title: string;
  description?: string;
  priority: "low" | "medium" | "high";
  dueDate?: string;
}

interface CreateTaskOutput {
  taskId: string;
  title: string;
}

// Create test tool definitions
function createQueryEventsTool(): ToolDefinition<QueryEventsInput, QueryEventsOutput> {
  return defineTool({
    name: "query_events",
    description: "Query calendar events within a date range",
    whenToUse: "When the user wants to see their calendar events or check their schedule",
    examples: [
      "Show me my meetings today",
      "What do I have scheduled this week?",
      "List my events for tomorrow",
    ],
    parametersSchema: objectSchema(
      {
        startDate: { type: "string", format: "date", description: "Start date (ISO format)" },
        endDate: { type: "string", format: "date", description: "End date (ISO format)" },
        limit: { type: "integer", minimum: 1, maximum: 100, description: "Max events to return" },
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
      limit: z.number().int().min(1).max(100).optional(),
    }),
    execute: async (input) => {
      return {
        events: [{ id: "1", title: "Meeting" }],
        total: 1,
      };
    },
  });
}

function createCreateTaskTool(): ToolDefinition<CreateTaskInput, CreateTaskOutput> {
  return defineTool({
    name: "create_task",
    description: "Create a new task",
    whenToUse: "When the user wants to create a new task or todo item",
    examples: [
      "Create a task to review the proposal",
      "Add a reminder to call John",
      "Make a todo for the meeting prep",
    ],
    parametersSchema: objectSchema(
      {
        title: { type: "string", minLength: 1, description: "Task title" },
        description: { type: "string", description: "Task description" },
        priority: { type: "string", enum: ["low", "medium", "high"], description: "Task priority" },
        dueDate: { type: "string", format: "date", description: "Due date" },
      },
      ["title", "priority"]
    ),
    category: "create",
    riskLevel: "medium",
    requiresApproval: false,
    requiredIntegrations: [],
    inputValidator: z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      priority: z.enum(["low", "medium", "high"]),
      dueDate: z.string().optional(),
    }),
    execute: async (input) => {
      return {
        taskId: "task-123",
        title: input.title,
      };
    },
  });
}

function createSendEmailTool() {
  return defineTool({
    name: "send_email",
    description: "Send an email",
    whenToUse: "When the user wants to send an email",
    examples: ["Send an email to John about the meeting"],
    parametersSchema: objectSchema(
      {
        to: { type: "array", items: { type: "string" }, description: "Recipients" },
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
      to: z.array(z.string().email()),
      subject: z.string(),
      body: z.string(),
    }),
    execute: async () => {
      return { sent: true };
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Tool Definition Tests
// ─────────────────────────────────────────────────────────────

describe("ToolDefinition", () => {
  describe("toToolForLLM", () => {
    it("should convert ToolDefinition to ToolForLLM format", () => {
      const tool = createQueryEventsTool();
      const llmTool = toToolForLLM(tool);

      expect(llmTool).toEqual({
        name: "query_events",
        description: "Query calendar events within a date range",
        whenToUse: "When the user wants to see their calendar events or check their schedule",
        examples: [
          "Show me my meetings today",
          "What do I have scheduled this week?",
          "List my events for tomorrow",
        ],
        parameters: tool.parametersSchema,
        requiresApproval: false,
      });
    });

    it("should include requiresApproval flag", () => {
      const tool = createSendEmailTool();
      const llmTool = toToolForLLM(tool);

      expect(llmTool.requiresApproval).toBe(true);
    });
  });

  describe("isToolAvailable", () => {
    it("should return true when all required integrations are connected", () => {
      const tool = createQueryEventsTool();
      expect(isToolAvailable(tool, ["calendar", "gmail"])).toBe(true);
    });

    it("should return false when required integration is missing", () => {
      const tool = createQueryEventsTool();
      expect(isToolAvailable(tool, ["gmail"])).toBe(false);
    });

    it("should return true when tool has no required integrations", () => {
      const tool = createCreateTaskTool();
      expect(isToolAvailable(tool, [])).toBe(true);
    });

    it("should require all integrations when multiple are required", () => {
      const tool = defineTool({
        name: "multi_integration",
        description: "Needs multiple integrations",
        whenToUse: "Test",
        examples: [],
        parametersSchema: objectSchema({}, []),
        category: "query",
        riskLevel: "low",
        requiresApproval: false,
        requiredIntegrations: ["gmail", "calendar", "slack"],
        inputValidator: z.object({}),
        execute: async () => ({}),
      });

      expect(isToolAvailable(tool, ["gmail", "calendar"])).toBe(false);
      expect(isToolAvailable(tool, ["gmail", "calendar", "slack"])).toBe(true);
    });
  });

  describe("defineTool", () => {
    it("should preserve type inference for input and output", () => {
      const tool = createQueryEventsTool();
      
      // TypeScript should infer these types correctly
      expect(tool.name).toBe("query_events");
      expect(tool.category).toBe("query");
    });
  });

  describe("objectSchema", () => {
    it("should create valid JSON Schema", () => {
      const schema = objectSchema(
        {
          name: { type: "string", description: "Name" },
          age: { type: "integer", minimum: 0 },
        },
        ["name"]
      );

      expect(schema.type).toBe("object");
      expect(schema.required).toEqual(["name"]);
      expect(schema.properties.name).toEqual({ type: "string", description: "Name" });
      expect(schema.properties.age).toEqual({ type: "integer", minimum: 0 });
      expect(schema.additionalProperties).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Tool Registry Tests
// ─────────────────────────────────────────────────────────────

describe("ToolRegistry", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe("registration", () => {
    it("should register a tool", () => {
      const tool = createQueryEventsTool();
      registry.register(tool);

      expect(registry.has("query_events")).toBe(true);
      expect(registry.size).toBe(1);
    });

    it("should throw when registering duplicate tool name", () => {
      const tool = createQueryEventsTool();
      registry.register(tool);

      expect(() => registry.register(tool)).toThrow('Tool "query_events" is already registered');
    });

    it("should register multiple tools", () => {
      registry.registerAll([
        createQueryEventsTool(),
        createCreateTaskTool(),
        createSendEmailTool(),
      ]);

      expect(registry.size).toBe(3);
    });

    it("should unregister a tool", () => {
      registry.register(createQueryEventsTool());
      expect(registry.has("query_events")).toBe(true);

      const removed = registry.unregister("query_events");
      expect(removed).toBe(true);
      expect(registry.has("query_events")).toBe(false);
    });

    it("should return false when unregistering non-existent tool", () => {
      expect(registry.unregister("nonexistent")).toBe(false);
    });

    it("should clear all tools", () => {
      registry.registerAll([createQueryEventsTool(), createCreateTaskTool()]);
      expect(registry.size).toBe(2);

      registry.clear();
      expect(registry.size).toBe(0);
    });
  });

  describe("retrieval", () => {
    beforeEach(() => {
      registry.registerAll([
        createQueryEventsTool(),
        createCreateTaskTool(),
        createSendEmailTool(),
      ]);
    });

    it("should get tool by name", () => {
      const tool = registry.get("query_events");
      expect(tool).toBeDefined();
      expect(tool?.name).toBe("query_events");
    });

    it("should return undefined for unknown tool", () => {
      expect(registry.get("unknown")).toBeUndefined();
    });

    it("should list all tool names", () => {
      const names = registry.names();
      expect(names).toHaveLength(3);
      expect(names).toContain("query_events");
      expect(names).toContain("create_task");
      expect(names).toContain("send_email");
    });
  });

  describe("filtering", () => {
    beforeEach(() => {
      registry.registerAll([
        createQueryEventsTool(),
        createCreateTaskTool(),
        createSendEmailTool(),
      ]);
    });

    it("should list all tools without filter", () => {
      const tools = registry.list();
      expect(tools).toHaveLength(3);
    });

    it("should filter by category", () => {
      const queryTools = registry.listByCategory("query");
      expect(queryTools).toHaveLength(1);
      expect(queryTools[0].name).toBe("query_events");

      const createTools = registry.listByCategory("create");
      expect(createTools).toHaveLength(1);
      expect(createTools[0].name).toBe("create_task");
    });

    it("should filter by integration", () => {
      const calendarTools = registry.listByIntegration("calendar");
      expect(calendarTools).toHaveLength(1);
      expect(calendarTools[0].name).toBe("query_events");

      const gmailTools = registry.listByIntegration("gmail");
      expect(gmailTools).toHaveLength(1);
      expect(gmailTools[0].name).toBe("send_email");
    });

    it("should filter by risk level", () => {
      const lowRiskTools = registry.listByRiskLevel("low");
      expect(lowRiskTools).toHaveLength(1);

      const highRiskTools = registry.listByRiskLevel("high");
      expect(highRiskTools).toHaveLength(1);
      expect(highRiskTools[0].name).toBe("send_email");
    });

    it("should filter by requiresApproval", () => {
      const needsApproval = registry.list({ requiresApproval: true });
      expect(needsApproval).toHaveLength(1);
      expect(needsApproval[0].name).toBe("send_email");

      const noApproval = registry.list({ requiresApproval: false });
      expect(noApproval).toHaveLength(2);
    });

    it("should combine multiple filters", () => {
      const tools = registry.list({
        category: "external",
        riskLevel: "high",
        requiresApproval: true,
      });
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("send_email");
    });
  });

  describe("LLM interface", () => {
    beforeEach(() => {
      registry.registerAll([
        createQueryEventsTool(),
        createCreateTaskTool(),
        createSendEmailTool(),
      ]);
    });

    it("should get all tools in LLM format", () => {
      const llmTools = registry.getToolsForLLM();
      expect(llmTools).toHaveLength(3);

      // Verify structure
      for (const tool of llmTools) {
        expect(tool).toHaveProperty("name");
        expect(tool).toHaveProperty("description");
        expect(tool).toHaveProperty("whenToUse");
        expect(tool).toHaveProperty("parameters");
        expect(tool).toHaveProperty("requiresApproval");
      }
    });

    it("should filter available tools by connected integrations", () => {
      // No integrations connected
      const noIntegrations = registry.getAvailableTools([]);
      expect(noIntegrations).toHaveLength(1);
      expect(noIntegrations[0].name).toBe("create_task");

      // Only calendar connected
      const calendarOnly = registry.getAvailableTools(["calendar"]);
      expect(calendarOnly).toHaveLength(2);
      expect(calendarOnly.map((t) => t.name)).toContain("query_events");
      expect(calendarOnly.map((t) => t.name)).toContain("create_task");

      // All integrations connected
      const allConnected = registry.getAvailableTools(["calendar", "gmail"]);
      expect(allConnected).toHaveLength(3);
    });

    it("should get tools by category in LLM format", () => {
      const queryTools = registry.getToolsForLLMByCategory("query");
      expect(queryTools).toHaveLength(1);
      expect(queryTools[0].name).toBe("query_events");
    });
  });

  describe("validation", () => {
    beforeEach(() => {
      registry.register(createCreateTaskTool());
    });

    it("should validate valid parameters", () => {
      const result = registry.validateParams("create_task", {
        title: "Test task",
        priority: "high",
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        title: "Test task",
        priority: "high",
      });
    });

    it("should return error for invalid parameters", () => {
      const result = registry.validateParams("create_task", {
        title: "",
        priority: "invalid",
      });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it("should return error for unknown tool", () => {
      const result = registry.validateParams("unknown_tool", {});

      expect(result.success).toBe(false);
      expect(result.errors![0].message).toBe('Tool "unknown_tool" not found');
    });
  });

  describe("introspection", () => {
    beforeEach(() => {
      registry.registerAll([
        createQueryEventsTool(),
        createCreateTaskTool(),
        createSendEmailTool(),
      ]);
    });

    it("should provide registry summary", () => {
      const summary = registry.getSummary();

      expect(summary.totalTools).toBe(3);
      expect(summary.byCategory.query).toBe(1);
      expect(summary.byCategory.create).toBe(1);
      expect(summary.byCategory.external).toBe(1);
      expect(summary.byRiskLevel.low).toBe(1);
      expect(summary.byRiskLevel.medium).toBe(1);
      expect(summary.byRiskLevel.high).toBe(1);
      expect(summary.integrations).toContain("calendar");
      expect(summary.integrations).toContain("gmail");
      expect(summary.requiresApproval).toBe(1);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Validation Tests
// ─────────────────────────────────────────────────────────────

describe("Validation", () => {
  describe("validateToolParams", () => {
    it("should validate parameters against tool schema", () => {
      const tool = createQueryEventsTool();
      const result = validateToolParams(tool, {
        startDate: "2024-01-01",
        limit: 10,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        startDate: "2024-01-01",
        limit: 10,
      });
    });

    it("should return errors for invalid parameters", () => {
      const tool = createQueryEventsTool();
      const result = validateToolParams(tool, {
        startDate: "2024-01-01",
        limit: 200, // Too high
      });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe("validateWithSchema", () => {
    it("should validate data against any Zod schema", () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().min(0),
      });

      const result = validateWithSchema(schema, { name: "John", age: 30 });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: "John", age: 30 });
    });
  });

  describe("formatZodErrors", () => {
    it("should format Zod errors", () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const result = schema.safeParse({ name: 123, age: "thirty" });
      expect(result.success).toBe(false);

      if (!result.success) {
        const errors = formatZodErrors(result.error);
        expect(errors.length).toBe(2);
        expect(errors[0].path).toBe("name");
        expect(errors[1].path).toBe("age");
      }
    });
  });

  describe("formatErrorsForLLM", () => {
    it("should format errors for LLM retry", () => {
      const errors = [
        { path: "title", message: "Cannot be empty", expected: "string", received: "" },
        { path: "priority", message: "Invalid enum value" },
      ];

      const message = formatErrorsForLLM(errors, "create_task");
      expect(message).toContain('Parameter validation failed for tool "create_task"');
      expect(message).toContain("title: Cannot be empty");
      expect(message).toContain("priority: Invalid enum value");
    });
  });

  describe("formatValidationError", () => {
    it("should format single error with expected/received", () => {
      const error = {
        path: "age",
        message: "Expected number",
        expected: "number",
        received: "string",
      };

      const message = formatValidationError(error);
      expect(message).toBe("age: Expected number (expected number, got string)");
    });
  });

  describe("commonSchemas", () => {
    it("should validate non-empty string", () => {
      expect(commonSchemas.nonEmptyString.safeParse("hello").success).toBe(true);
      expect(commonSchemas.nonEmptyString.safeParse("").success).toBe(false);
    });

    it("should validate email", () => {
      expect(commonSchemas.email.safeParse("test@example.com").success).toBe(true);
      expect(commonSchemas.email.safeParse("invalid").success).toBe(false);
    });

    it("should validate date string", () => {
      expect(commonSchemas.dateString.safeParse("2024-01-01").success).toBe(true);
      expect(commonSchemas.dateString.safeParse("not-a-date").success).toBe(false);
    });

    it("should validate priority enum", () => {
      expect(commonSchemas.priority.safeParse("high").success).toBe(true);
      expect(commonSchemas.priority.safeParse("invalid").success).toBe(false);
    });
  });

  describe("paginatedQuerySchema", () => {
    it("should create schema with pagination defaults", () => {
      const schema = paginatedQuerySchema({
        query: z.string(),
      });

      const result = schema.parse({ query: "test" });
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });
  });

  describe("dateRangeSchema", () => {
    it("should create schema with optional date range", () => {
      const schema = dateRangeSchema({
        category: z.string(),
      });

      const result = schema.parse({ category: "work" });
      expect(result.startDate).toBeUndefined();
      expect(result.endDate).toBeUndefined();
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Context Tests
// ─────────────────────────────────────────────────────────────

describe("ExecutionContext", () => {
  describe("createExecutionContext", () => {
    it("should create basic context", () => {
      const context = createExecutionContext({
        userId: "user-123",
        sessionId: "session-456",
      });

      expect(context.userId).toBe("user-123");
      expect(context.sessionId).toBe("session-456");
    });

    it("should include optional fields", () => {
      const context = createExecutionContext({
        userId: "user-123",
        conversationId: "conv-789",
        planId: "plan-abc",
        stepIndex: 2,
      });

      expect(context.conversationId).toBe("conv-789");
      expect(context.planId).toBe("plan-abc");
      expect(context.stepIndex).toBe(2);
    });
  });

  describe("createExtendedContext", () => {
    it("should create extended context with token provider", () => {
      const tokenFetcher = async (integration: string) => `token-${integration}`;
      
      const context = createExtendedContext(
        { userId: "user-123", timezone: "America/New_York" },
        tokenFetcher
      );

      expect(context.userId).toBe("user-123");
      expect(context.timezone).toBe("America/New_York");
      expect(context.currentTime).toBeInstanceOf(Date);
      expect(context.getAccessToken).toBeDefined();
    });
  });

  describe("createSystemContext", () => {
    it("should create minimal system context", () => {
      const context = createSystemContext("user-123");

      expect(context.userId).toBe("user-123");
      expect(context.sessionId).toBe("system");
    });
  });

  describe("context composition", () => {
    it("should add plan context", () => {
      const base = createExecutionContext({ userId: "user-123" });
      const withPlan = withPlanContext(base, "plan-456", 3);

      expect(withPlan.planId).toBe("plan-456");
      expect(withPlan.stepIndex).toBe(3);
      expect(withPlan.userId).toBe("user-123");
    });

    it("should add conversation context", () => {
      const base = createExecutionContext({ userId: "user-123" });
      const withConv = withConversationContext(base, "conv-789");

      expect(withConv.conversationId).toBe("conv-789");
    });

    it("should add session context", () => {
      const base = createExecutionContext({ userId: "user-123" });
      const withSess = withSessionContext(base, "session-abc");

      expect(withSess.sessionId).toBe("session-abc");
    });
  });

  describe("context validation", () => {
    it("should validate basic context", () => {
      expect(isValidContext({ userId: "user-123" })).toBe(true);
      expect(isValidContext({ userId: "" })).toBe(false);
    });

    it("should check for plan context", () => {
      const withPlan = { userId: "u", planId: "p", stepIndex: 0 };
      const withoutPlan = { userId: "u" };
      const withEmptyPlanId = { userId: "u", planId: "", stepIndex: 0 };
      const withMissingStepIndex = { userId: "u", planId: "p" };

      expect(hasPlanContext(withPlan)).toBe(true);
      expect(hasPlanContext(withoutPlan)).toBe(false);
      expect(hasPlanContext(withEmptyPlanId)).toBe(false);
      expect(hasPlanContext(withMissingStepIndex)).toBe(false);
    });

    it("should check for conversation context", () => {
      const withConv = { userId: "u", conversationId: "c" };
      const withoutConv = { userId: "u" };
      const withEmptyConvId = { userId: "u", conversationId: "" };

      expect(hasConversationContext(withConv)).toBe(true);
      expect(hasConversationContext(withoutConv)).toBe(false);
      expect(hasConversationContext(withEmptyConvId)).toBe(false);
    });
  });

  describe("createTokenProvider", () => {
    it("should cache tokens", async () => {
      let callCount = 0;
      const fetcher = async (userId: string, integration: string) => {
        callCount++;
        return `token-${integration}`;
      };

      const provider = createTokenProvider(fetcher, "user-123");

      // First call should fetch
      const token1 = await provider("gmail");
      expect(token1).toBe("token-gmail");
      expect(callCount).toBe(1);

      // Second call should use cache
      const token2 = await provider("gmail");
      expect(token2).toBe("token-gmail");
      expect(callCount).toBe(1);

      // Different integration should fetch again
      const token3 = await provider("calendar");
      expect(token3).toBe("token-calendar");
      expect(callCount).toBe(2);
    });

    it("should cache null tokens", async () => {
      let callCount = 0;
      const fetcher = async () => {
        callCount++;
        return null;
      };

      const provider = createTokenProvider(fetcher, "user-123");

      const token1 = await provider("unknown");
      expect(token1).toBeNull();
      expect(callCount).toBe(1);

      const token2 = await provider("unknown");
      expect(token2).toBeNull();
      expect(callCount).toBe(1);
    });

    it("should handle concurrent calls without duplicate fetches", async () => {
      let callCount = 0;
      const fetcher = async (userId: string, integration: string) => {
        callCount++;
        // Simulate async delay
        await new Promise((resolve) => setTimeout(resolve, 10));
        return `token-${integration}`;
      };

      const provider = createTokenProvider(fetcher, "user-123");

      // Make concurrent calls for the same integration
      const [token1, token2, token3] = await Promise.all([
        provider("gmail"),
        provider("gmail"),
        provider("gmail"),
      ]);

      // All should get the same token
      expect(token1).toBe("token-gmail");
      expect(token2).toBe("token-gmail");
      expect(token3).toBe("token-gmail");

      // But fetcher should only be called once
      expect(callCount).toBe(1);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Global Registry Tests
// ─────────────────────────────────────────────────────────────

describe("Global toolRegistry", () => {
  afterEach(() => {
    // Clean up after each test
    toolRegistry.clear();
  });

  it("should be a singleton instance", () => {
    expect(toolRegistry).toBeInstanceOf(ToolRegistry);
  });

  it("should persist tools across calls", () => {
    toolRegistry.register(createQueryEventsTool());
    expect(toolRegistry.has("query_events")).toBe(true);
  });
});

