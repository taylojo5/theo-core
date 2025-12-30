// ═══════════════════════════════════════════════════════════════════════════
// Plan Executor Tests
// Tests for plan execution, output resolution, and event streaming
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { toolRegistry } from "@/lib/agent/tools/registry";
import { defineTool } from "@/lib/agent/tools/types";
import { z } from "zod";
import { PLAN_STATUS, STEP_STATUS } from "@/lib/agent/constants";
import type { StructuredPlan, StructuredStep } from "@/lib/agent/planning/types";
import type { PlanExecutionEvent } from "@/lib/agent/planning/events";

// ─────────────────────────────────────────────────────────────
// Mock Data
// ─────────────────────────────────────────────────────────────

// Mock tools for testing
const mockQueryTool = defineTool({
  name: "query_context",
  description: "Query user context",
  whenToUse: "When you need to find information",
  examples: ["Find my tasks"],
  parametersSchema: {
    type: "object" as const,
    properties: {
      query: { type: "string" as const, description: "Search query" },
    },
    required: ["query"],
  },
  category: "query",
  riskLevel: "low",
  requiresApproval: false,
  requiredIntegrations: [],
  inputValidator: z.object({
    query: z.string(),
  }),
  execute: async (params: { query: string }) => ({ results: [`Found: ${params.query}`] }),
});

const mockCreateTaskTool = defineTool({
  name: "create_task",
  description: "Create a new task",
  whenToUse: "When user wants to create a task",
  examples: ["Create a task"],
  parametersSchema: {
    type: "object" as const,
    properties: {
      title: { type: "string" as const, description: "Task title" },
      description: { type: "string" as const, description: "Task description" },
    },
    required: ["title"],
  },
  category: "create",
  riskLevel: "medium",
  requiresApproval: false,
  requiredIntegrations: [],
  inputValidator: z.object({
    title: z.string(),
    description: z.string().optional(),
  }),
  execute: async (params: { title: string }) => ({ taskId: "task-123", title: params.title }),
});

const mockSendEmailTool = defineTool({
  name: "send_email",
  description: "Send an email",
  whenToUse: "When user wants to send an email",
  examples: ["Send an email"],
  parametersSchema: {
    type: "object" as const,
    properties: {
      to: { type: "string" as const, description: "Recipient" },
      subject: { type: "string" as const, description: "Subject" },
      body: { type: "string" as const, description: "Body" },
    },
    required: ["to", "subject", "body"],
  },
  category: "external",
  riskLevel: "high",
  requiresApproval: true,
  requiredIntegrations: ["gmail"],
  inputValidator: z.object({
    to: z.string().email(),
    subject: z.string(),
    body: z.string(),
  }),
  execute: async () => ({ messageId: "msg-123" }),
});

const mockFailingTool = defineTool({
  name: "failing_tool",
  description: "A tool that always fails",
  whenToUse: "Testing failure scenarios",
  examples: ["Fail"],
  parametersSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
  category: "query",
  riskLevel: "low",
  requiresApproval: false,
  requiredIntegrations: [],
  inputValidator: z.object({}),
  execute: async () => {
    throw new Error("Tool execution failed intentionally");
  },
});

// Create mock structured plan
function createMockPlan(overrides?: Partial<StructuredPlan>): StructuredPlan {
  const now = new Date();
  return {
    id: "plan-123",
    userId: "user-123",
    goal: "Create a task and query context",
    goalType: "task_management",
    status: PLAN_STATUS.PLANNED,
    steps: [
      createMockStep({
        id: "step-0",
        planId: "plan-123",
        index: 0,
        toolName: "create_task",
        parameters: { title: "Test Task" },
        dependsOn: [],
        dependsOnIndices: [],
        description: "Create a new task",
        requiresApproval: false,
      }),
      createMockStep({
        id: "step-1",
        planId: "plan-123",
        index: 1,
        toolName: "query_context",
        parameters: { query: "Find related items" },
        dependsOn: ["step-0"],
        dependsOnIndices: [0],
        description: "Query for related context",
        requiresApproval: false,
      }),
    ],
    currentStepIndex: 0,
    requiresApproval: false,
    reasoning: "Create task first, then query for related items",
    assumptions: [],
    confidence: 0.9,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createMockStep(overrides?: Partial<StructuredStep>): StructuredStep {
  const now = new Date();
  return {
    id: "step-0",
    planId: "plan-123",
    index: 0,
    toolName: "create_task",
    parameters: { title: "Test Task" },
    dependsOn: [],
    dependsOnIndices: [],
    description: "Create a new task",
    status: STEP_STATUS.PENDING,
    requiresApproval: false,
    createdAt: now,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Output Resolver Tests
// ─────────────────────────────────────────────────────────────

describe("Output Resolver", () => {
  describe("resolveStepOutputs", () => {
    it("should resolve {{step.X.output}} references", async () => {
      const { resolveStepOutputs } = await import("@/lib/agent/planning/output-resolver");

      // Create plan with step 0 completed
      const plan = createMockPlan();
      plan.steps[0].status = STEP_STATUS.COMPLETED;
      plan.steps[0].result = { taskId: "task-123", title: "Test Task" };

      // Step 1 references step 0's output
      plan.steps[1].parameters = {
        query: "{{step.0.output}}",
      };

      const result = resolveStepOutputs(plan.steps[1], plan);

      expect(result.success).toBe(true);
      expect(result.resolvedParams.query).toEqual({ taskId: "task-123", title: "Test Task" });
      expect(result.resolvedReferences).toHaveLength(1);
      expect(result.resolvedReferences[0].stepIndex).toBe(0);
    });

    it("should resolve nested path references", async () => {
      const { resolveStepOutputs } = await import("@/lib/agent/planning/output-resolver");

      const plan = createMockPlan();
      plan.steps[0].status = STEP_STATUS.COMPLETED;
      plan.steps[0].result = { taskId: "task-123", meta: { createdBy: "user-1" } };

      plan.steps[1].parameters = {
        query: "Created by {{step.0.output.meta.createdBy}}",
      };

      const result = resolveStepOutputs(plan.steps[1], plan);

      expect(result.success).toBe(true);
      expect(result.resolvedParams.query).toBe("Created by user-1");
    });

    it("should fail when referenced step is not completed", async () => {
      const { resolveStepOutputs } = await import("@/lib/agent/planning/output-resolver");

      const plan = createMockPlan();
      // step 0 is still pending
      plan.steps[0].status = STEP_STATUS.PENDING;

      plan.steps[1].parameters = {
        query: "{{step.0.output}}",
      };

      const result = resolveStepOutputs(plan.steps[1], plan);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("step_not_completed");
    });

    it("should fail when referenced step does not exist", async () => {
      const { resolveStepOutputs } = await import("@/lib/agent/planning/output-resolver");

      const plan = createMockPlan();
      plan.steps[1].parameters = {
        query: "{{step.99.output}}",
      };

      const result = resolveStepOutputs(plan.steps[1], plan);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("step_not_found");
    });

    it("should fail when path does not exist in output", async () => {
      const { resolveStepOutputs } = await import("@/lib/agent/planning/output-resolver");

      const plan = createMockPlan();
      plan.steps[0].status = STEP_STATUS.COMPLETED;
      plan.steps[0].result = { taskId: "task-123" };

      plan.steps[1].parameters = {
        query: "{{step.0.output.nonexistent.path}}",
      };

      const result = resolveStepOutputs(plan.steps[1], plan);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("path_not_found");
    });

    it("should handle parameters without references", async () => {
      const { resolveStepOutputs } = await import("@/lib/agent/planning/output-resolver");

      const plan = createMockPlan();
      plan.steps[1].parameters = {
        query: "Simple query without references",
        count: 5,
        active: true,
      };

      const result = resolveStepOutputs(plan.steps[1], plan);

      expect(result.success).toBe(true);
      expect(result.resolvedParams).toEqual({
        query: "Simple query without references",
        count: 5,
        active: true,
      });
      expect(result.resolvedReferences).toHaveLength(0);
    });

    it("should handle nested objects with references", async () => {
      const { resolveStepOutputs } = await import("@/lib/agent/planning/output-resolver");

      const plan = createMockPlan();
      plan.steps[0].status = STEP_STATUS.COMPLETED;
      plan.steps[0].result = { taskId: "task-123" };

      plan.steps[1].parameters = {
        nested: {
          ref: "{{step.0.output.taskId}}",
          static: "unchanged",
        },
      };

      const result = resolveStepOutputs(plan.steps[1], plan);

      expect(result.success).toBe(true);
      expect(result.resolvedParams).toEqual({
        nested: {
          ref: "task-123",
          static: "unchanged",
        },
      });
    });

    it("should handle arrays with references", async () => {
      const { resolveStepOutputs } = await import("@/lib/agent/planning/output-resolver");

      const plan = createMockPlan();
      plan.steps[0].status = STEP_STATUS.COMPLETED;
      plan.steps[0].result = { items: ["a", "b", "c"] };

      plan.steps[1].parameters = {
        firstItem: "{{step.0.output.items.0}}",
      };

      const result = resolveStepOutputs(plan.steps[1], plan);

      expect(result.success).toBe(true);
      expect(result.resolvedParams.firstItem).toBe("a");
    });
  });

  describe("hasOutputReferences", () => {
    it("should detect references in parameters", async () => {
      const { hasOutputReferences } = await import("@/lib/agent/planning/output-resolver");

      expect(hasOutputReferences({ query: "{{step.0.output}}" })).toBe(true);
      expect(hasOutputReferences({ query: "No references here" })).toBe(false);
      expect(hasOutputReferences({ nested: { ref: "{{step.1.output.field}}" } })).toBe(true);
    });
  });

  describe("getReferencedStepIndices", () => {
    it("should extract all referenced step indices", async () => {
      const { getReferencedStepIndices } = await import("@/lib/agent/planning/output-resolver");

      const params = {
        ref1: "{{step.0.output}}",
        ref2: "{{step.2.output.field}}",
        nested: {
          ref3: "{{step.1.output}}",
        },
      };

      const indices = getReferencedStepIndices(params);

      expect(indices).toEqual([0, 1, 2]);
    });
  });

  describe("validateOutputReferences", () => {
    it("should validate references point to earlier steps", async () => {
      const { validateOutputReferences } = await import("@/lib/agent/planning/output-resolver");

      const plan = createMockPlan();
      // Step 0 references step 1 (invalid - can't reference later step)
      plan.steps[0].parameters = { query: "{{step.1.output}}" };

      const errors = validateOutputReferences(plan.steps[0], plan);

      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe("invalid_reference");
    });

    it("should allow references to earlier steps", async () => {
      const { validateOutputReferences } = await import("@/lib/agent/planning/output-resolver");

      const plan = createMockPlan();
      plan.steps[1].parameters = { query: "{{step.0.output}}" };

      const errors = validateOutputReferences(plan.steps[1], plan);

      expect(errors).toHaveLength(0);
    });
  });

  describe("createOutputReference", () => {
    it("should create valid reference strings", async () => {
      const { createOutputReference } = await import("@/lib/agent/planning/output-resolver");

      expect(createOutputReference(0)).toBe("{{step.0.output}}");
      expect(createOutputReference(1, "field")).toBe("{{step.1.output.field}}");
      expect(createOutputReference(2, "nested.path")).toBe("{{step.2.output.nested.path}}");
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Event Emitter Tests
// ─────────────────────────────────────────────────────────────

describe("Plan Event Emitter", () => {
  describe("PlanEventEmitter", () => {
    it("should emit events to subscribers", async () => {
      const { PlanEventEmitter, createPlanStartedEvent } = await import("@/lib/agent/planning/events");

      const emitter = new PlanEventEmitter("plan-123");
      const events: PlanExecutionEvent[] = [];

      emitter.subscribe((event) => events.push(event));

      await emitter.emit(createPlanStartedEvent("Test goal", 3, false));

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("plan_started");
      expect(events[0].planId).toBe("plan-123");
    });

    it("should support async subscribers", async () => {
      const { PlanEventEmitter, createStepCompletedEvent } = await import("@/lib/agent/planning/events");

      const emitter = new PlanEventEmitter("plan-123");
      const events: PlanExecutionEvent[] = [];

      emitter.subscribeAsync(async (event) => {
        await new Promise((r) => setTimeout(r, 10));
        events.push(event);
      });

      await emitter.emit(createStepCompletedEvent(0, "create_task", "Create task", 100, "Task created"));

      expect(events).toHaveLength(1);
    });

    it("should allow unsubscribing", async () => {
      const { PlanEventEmitter, createPlanCompletedEvent } = await import("@/lib/agent/planning/events");

      const emitter = new PlanEventEmitter("plan-123");
      const events: PlanExecutionEvent[] = [];

      const unsubscribe = emitter.subscribe((event) => events.push(event));

      await emitter.emit(createPlanCompletedEvent("Goal", 2, 2, 1000));
      unsubscribe();
      await emitter.emit(createPlanCompletedEvent("Goal", 2, 2, 1000));

      expect(events).toHaveLength(1);
    });

    it("should track event history", async () => {
      const { PlanEventEmitter, createStepStartingEvent, createStepCompletedEvent } = await import("@/lib/agent/planning/events");

      const emitter = new PlanEventEmitter("plan-123");

      await emitter.emit(createStepStartingEvent(0, "create_task", "Create task", false));
      await emitter.emit(createStepCompletedEvent(0, "create_task", "Create task", 100));

      const history = emitter.getHistory();

      expect(history).toHaveLength(2);
      expect(history[0].type).toBe("step_starting");
      expect(history[1].type).toBe("step_completed");
    });

    it("should find last event of type", async () => {
      const { PlanEventEmitter, createStepStartingEvent, createStepCompletedEvent, createStepFailedEvent } = await import("@/lib/agent/planning/events");

      const emitter = new PlanEventEmitter("plan-123");

      await emitter.emit(createStepStartingEvent(0, "tool1", "Step 1", false));
      await emitter.emit(createStepCompletedEvent(0, "tool1", "Step 1", 100));
      await emitter.emit(createStepStartingEvent(1, "tool2", "Step 2", false));
      await emitter.emit(createStepFailedEvent(1, "tool2", "Step 2", "Error", false, 50));

      const lastFailed = emitter.getLastEvent("step_failed");

      expect(lastFailed).toBeDefined();
      expect(lastFailed!.stepIndex).toBe(1);
    });
  });

  describe("Event Factory Functions", () => {
    it("should create properly typed events", async () => {
      const events = await import("@/lib/agent/planning/events");

      const started = events.createPlanStartedEvent("Test", 3, true);
      expect(started.type).toBe("plan_started");
      expect(started.goal).toBe("Test");
      expect(started.totalSteps).toBe(3);

      const stepStarting = events.createStepStartingEvent(0, "tool", "desc", false);
      expect(stepStarting.type).toBe("step_starting");
      expect(stepStarting.stepIndex).toBe(0);

      const stepCompleted = events.createStepCompletedEvent(0, "tool", "desc", 100, "summary");
      expect(stepCompleted.type).toBe("step_completed");
      expect(stepCompleted.durationMs).toBe(100);

      const stepFailed = events.createStepFailedEvent(1, "tool", "desc", "error", true, 50);
      expect(stepFailed.type).toBe("step_failed");
      expect(stepFailed.retryable).toBe(true);

      const skipped = events.createStepSkippedEvent(2, "tool", "desc", "dependency_failed");
      expect(skipped.type).toBe("step_skipped");
      expect(skipped.reason).toBe("dependency_failed");

      const paused = events.createPlanPausedEvent(1, "approval_needed", { approvalId: "a-1" });
      expect(paused.type).toBe("plan_paused");
      expect(paused.approvalId).toBe("a-1");

      const resumed = events.createPlanResumedEvent(1, "approval_granted");
      expect(resumed.type).toBe("plan_resumed");

      const completed = events.createPlanCompletedEvent("goal", 5, 5, 5000);
      expect(completed.type).toBe("plan_completed");
      expect(completed.successfulSteps).toBe(5);

      const failed = events.createPlanFailedEvent("goal", 2, "error", 2, 5);
      expect(failed.type).toBe("plan_failed");
      expect(failed.failedStepIndex).toBe(2);

      const cancelled = events.createPlanCancelledEvent("goal", 3, 2, 5, "user");
      expect(cancelled.type).toBe("plan_cancelled");
      expect(cancelled.cancelledBy).toBe("user");

      const approvalReq = events.createApprovalRequestedEvent(
        1, "a-1", "send_email", "Send email", "high", new Date()
      );
      expect(approvalReq.type).toBe("approval_requested");

      const approvalRec = events.createApprovalReceivedEvent(1, "a-1", "approved", "user-1");
      expect(approvalRec.type).toBe("approval_received");
      expect(approvalRec.decision).toBe("approved");
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Executor Interface Tests
// ─────────────────────────────────────────────────────────────

describe("Plan Executor Interface", () => {
  beforeEach(() => {
    toolRegistry.clear();
    toolRegistry.register(mockQueryTool);
    toolRegistry.register(mockCreateTaskTool);
    toolRegistry.register(mockSendEmailTool);
    toolRegistry.register(mockFailingTool);
  });

  afterEach(() => {
    toolRegistry.clear();
  });

  describe("module exports", () => {
    it("should export expected functions", async () => {
      const executor = await import("@/lib/agent/planning/executor");

      expect(typeof executor.executePlan).toBe("function");
      expect(typeof executor.resumePlan).toBe("function");
      expect(typeof executor.resumePlanAfterRejection).toBe("function");
      expect(typeof executor.cancelPlan).toBe("function");
      expect(typeof executor.getPendingPlans).toBe("function");
      expect(typeof executor.getInterruptedPlans).toBe("function");
      expect(typeof executor.getPlanEventEmitter).toBe("function");
    });
  });

  describe("executePlan validation", () => {
    it("should throw for non-existent plan", async () => {
      const { executePlan } = await import("@/lib/agent/planning/executor");

      // Mock planRepository to return null
      vi.mock("@/lib/agent/planning/repository", () => ({
        planRepository: {
          getById: vi.fn().mockResolvedValue(null),
        },
      }));

      await expect(
        executePlan("nonexistent", {
          context: { userId: "user-1" },
        })
      ).rejects.toThrow("not found");
    });
  });

  describe("cancelPlan validation", () => {
    it("should throw for already completed plan", async () => {
      const { cancelPlan } = await import("@/lib/agent/planning/executor");
      const { planRepository } = await import("@/lib/agent/planning/repository");

      // Mock a completed plan
      vi.spyOn(planRepository, "getById").mockResolvedValue({
        ...createMockPlan(),
        status: PLAN_STATUS.COMPLETED,
      });

      await expect(cancelPlan("plan-123")).rejects.toThrow("Cannot cancel");
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Planning Module Export Tests
// ─────────────────────────────────────────────────────────────

describe("Planning Module Exports", () => {
  it("should export all executor functions", async () => {
    const planning = await import("@/lib/agent/planning");

    // Executor functions
    expect(typeof planning.executePlan).toBe("function");
    expect(typeof planning.resumePlan).toBe("function");
    expect(typeof planning.resumePlanAfterRejection).toBe("function");
    expect(typeof planning.cancelPlan).toBe("function");
    expect(typeof planning.getPendingPlans).toBe("function");
    expect(typeof planning.getInterruptedPlans).toBe("function");
    expect(typeof planning.getPlanEventEmitter).toBe("function");
  });

  it("should export all output resolver functions", async () => {
    const planning = await import("@/lib/agent/planning");

    // Output resolver functions
    expect(typeof planning.resolveStepOutputs).toBe("function");
    expect(typeof planning.hasOutputReferences).toBe("function");
    expect(typeof planning.getReferencedStepIndices).toBe("function");
    expect(typeof planning.validateOutputReferences).toBe("function");
    expect(typeof planning.formatOutputReferences).toBe("function");
    expect(typeof planning.createOutputReference).toBe("function");
  });

  it("should export event emitter and factory functions", async () => {
    const planning = await import("@/lib/agent/planning");

    // Event emitter
    expect(planning.PlanEventEmitter).toBeDefined();

    // Event factories
    expect(typeof planning.createPlanStartedEvent).toBe("function");
    expect(typeof planning.createStepStartingEvent).toBe("function");
    expect(typeof planning.createStepCompletedEvent).toBe("function");
    expect(typeof planning.createStepFailedEvent).toBe("function");
    expect(typeof planning.createStepSkippedEvent).toBe("function");
    expect(typeof planning.createPlanPausedEvent).toBe("function");
    expect(typeof planning.createPlanResumedEvent).toBe("function");
    expect(typeof planning.createPlanCompletedEvent).toBe("function");
    expect(typeof planning.createPlanFailedEvent).toBe("function");
    expect(typeof planning.createPlanCancelledEvent).toBe("function");
    expect(typeof planning.createApprovalRequestedEvent).toBe("function");
    expect(typeof planning.createApprovalReceivedEvent).toBe("function");
  });
});

// ─────────────────────────────────────────────────────────────
// Integration-style Tests (without database)
// ─────────────────────────────────────────────────────────────

describe("Output Resolution with Real Data", () => {
  it("should handle complex multi-step data flow", async () => {
    const { resolveStepOutputs, createOutputReference } = await import("@/lib/agent/planning/output-resolver");

    // Simulate a 3-step plan:
    // 1. Create a project -> returns { projectId, name }
    // 2. Create tasks for project -> uses projectId from step 0
    // 3. Generate summary -> uses both project name and task count

    const plan = createMockPlan({
      steps: [
        createMockStep({
          id: "step-0",
          index: 0,
          toolName: "create_project",
          parameters: { name: "My Project" },
          dependsOn: [],
          dependsOnIndices: [],
          status: STEP_STATUS.COMPLETED,
          result: { projectId: "proj-1", name: "My Project" },
        }),
        createMockStep({
          id: "step-1",
          index: 1,
          toolName: "create_tasks",
          parameters: {
            projectId: createOutputReference(0, "projectId"),
            tasks: ["Task 1", "Task 2"],
          },
          dependsOn: ["step-0"],
          dependsOnIndices: [0],
          status: STEP_STATUS.COMPLETED,
          result: { created: 2, taskIds: ["t-1", "t-2"] },
        }),
        createMockStep({
          id: "step-2",
          index: 2,
          toolName: "generate_summary",
          parameters: {
            projectName: createOutputReference(0, "name"),
            taskCount: createOutputReference(1, "created"),
          },
          dependsOn: ["step-0", "step-1"],
          dependsOnIndices: [0, 1],
          status: STEP_STATUS.PENDING,
        }),
      ],
    });

    const result = resolveStepOutputs(plan.steps[2], plan);

    expect(result.success).toBe(true);
    expect(result.resolvedParams).toEqual({
      projectName: "My Project",
      taskCount: 2,
    });
    expect(result.resolvedReferences).toHaveLength(2);
  });
});


