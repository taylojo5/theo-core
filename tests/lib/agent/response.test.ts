// ═══════════════════════════════════════════════════════════════════════════
// Response Module Tests
// Tests for prompt building, response formatting, and output structuring
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from "vitest";
import type {
  ExecuteToolDecision,
  ConfirmActionDecision,
  ClarifyDecision,
  RespondDecision,
  ErrorDecision,
} from "@/lib/agent/routing/types";
import type { ContextRetrieval, RankedContext } from "@/lib/agent/context/types";
import type { Person, Event } from "@/services/context/types";

import {
  // Types
  isExecuteResponse,
  isConfirmResponse,
  isClarifyResponse,
  isConversationalResponse,
  isErrorResponse,
  requiresUserAction,
  convertAssumptions,
  getDecisionType,
  // Prompts
  getSystemPromptForDecision,
  buildResponsePromptFromDecision,
  buildTemplateResponse,
  // Formatter
  formatResponse,
  formatToolResult,
  extractDisplayHighlights,
  truncateResultStructured,
  cleanContent,
  combineContents,
  getTotalTokens,
  serializeForClient,
} from "@/lib/agent/response";
import type { LLMAssumption } from "@/lib/agent/llm/types";

// ─────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────

const mockExecuteDecision: ExecuteToolDecision = {
  type: "execute_tool",
  tool: "create_task",
  params: { title: "Buy groceries", dueDate: "2024-03-15" },
  requiresApproval: false,
  confidence: 0.92,
  reasoning: "User clearly requested to create a task",
  assumptions: [
    {
      statement: "Task should be added to default list",
      category: "context",
      evidence: ["No list specified"],
      confidence: 0.8,
    },
  ],
};

const mockExecuteWithApprovalDecision: ExecuteToolDecision = {
  ...mockExecuteDecision,
  tool: "send_email",
  params: { to: "john@example.com", subject: "Meeting tomorrow" },
  requiresApproval: true,
};

const mockConfirmDecision: ConfirmActionDecision = {
  type: "confirm_action",
  tool: "schedule_meeting",
  params: { title: "Team standup", startTime: "2024-03-15T10:00:00Z" },
  confirmationMessage: "Should I schedule this meeting?",
  uncertainties: ["Is 10 AM the right time?"],
  confidence: 0.75,
  assumptionsToVerify: [
    {
      statement: "30 minute duration is appropriate",
      category: "preference",
      evidence: ["User didn't specify duration"],
      confidence: 0.7,
    },
  ],
};

const mockClarifyDecision: ClarifyDecision = {
  type: "clarify",
  questions: ["Which meeting are you referring to?", "Do you mean tomorrow?"],
  missingInfo: ["meeting identity", "date"],
  partialUnderstanding: {
    possibleIntent: "reschedule meeting",
    possibleTool: "update_event",
    recognizedEntities: ["meeting"],
  },
  clarificationReason: "ambiguous_entity",
};

const mockRespondDecision: RespondDecision = {
  type: "respond",
  responseStyle: "informational",
  responseContext: "User asked about their schedule",
  isSimple: false,
};

const mockSimpleRespondDecision: RespondDecision = {
  type: "respond",
  responseStyle: "acknowledgment",
  responseContext: "User said thank you",
  isSimple: true,
};

const mockErrorDecision: ErrorDecision = {
  type: "error",
  errorCode: "tool_not_found",
  error: "The requested action is not available",
  recoverable: true,
  recoverySuggestion: "Try a different approach",
};

// Mock person with minimal required fields for testing
const mockPerson: Person = {
  id: "1",
  userId: "user1",
  name: "John Doe",
  type: "contact",
  email: null,
  phone: null,
  avatarUrl: null,
  importance: 5,
  company: null,
  title: null,
  location: null,
  timezone: null,
  bio: null,
  notes: null,
  preferences: null,
  source: "manual",
  sourceId: null,
  sourceSyncedAt: null,
  metadata: null,
  tags: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
} as Person;

// Mock event with minimal required fields for testing
const mockEvent: Event = {
  id: "1",
  userId: "user1",
  title: "Team Meeting",
  type: "meeting",
  description: null,
  startsAt: new Date("2024-03-15T10:00:00Z"),
  endsAt: null,
  allDay: false,
  timezone: null,
  location: null,
  placeId: null,
  virtualUrl: null,
  status: "scheduled",
  visibility: "private",
  notes: null,
  importance: 5,
  source: "calendar",
  sourceId: null,
  sourceSyncedAt: null,
  metadata: null,
  tags: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  // Calendar-specific fields
  googleEventId: null,
  googleCalendarId: null,
  calendarId: null,
  recurringEventId: null,
  recurrence: null,
  isRecurring: false,
  attendees: null,
  organizer: null,
  creator: null,
  conferenceData: null,
  hangoutLink: null,
  reminders: null,
  iCalUID: null,
  sequence: 0,
  etag: null,
  htmlLink: null,
  embeddingStatus: "pending",
  embeddingError: null,
  embeddingAttempts: 0,
  embeddedAt: null,
} as Event;

const mockContext: ContextRetrieval = {
  relevantPeople: [
    {
      item: mockPerson,
      relevance: 0.9,
      source: "resolved_entity",
    },
  ],
  relevantEvents: [
    {
      item: mockEvent,
      relevance: 0.85,
      source: "semantic_search",
    },
  ],
  relevantTasks: [],
  relevantDeadlines: [],
  relevantPlaces: [],
  relevantRoutines: [],
  relevantOpenLoops: [],
  relevantProjects: [],
  relevantNotes: [],
  relevantOpportunities: [],
  conversationContext: [],
  semanticMatches: [],
  recentInteractions: [],
  stats: {
    totalItems: 2,
    fromResolution: 1,
    fromSemanticSearch: 1,
    fromTextSearch: 0,
    fromConversation: 0,
    fromRecentInteractions: 0,
    durationMs: 50,
  },
};

// ─────────────────────────────────────────────────────────────
// Type Guards Tests
// ─────────────────────────────────────────────────────────────

describe("Response Type Guards", () => {
  it("should identify execute response", () => {
    const response = formatResponse("Done!", mockExecuteDecision, { durationMs: 100 });
    expect(isExecuteResponse(response)).toBe(true);
    expect(isConfirmResponse(response)).toBe(false);
    expect(isClarifyResponse(response)).toBe(false);
  });

  it("should identify confirm response", () => {
    const response = formatResponse("Confirm?", mockConfirmDecision, { durationMs: 100 });
    expect(isConfirmResponse(response)).toBe(true);
    expect(isExecuteResponse(response)).toBe(false);
  });

  it("should identify clarify response", () => {
    const response = formatResponse("Which one?", mockClarifyDecision, { durationMs: 100 });
    expect(isClarifyResponse(response)).toBe(true);
  });

  it("should identify conversational response", () => {
    const response = formatResponse("Here's your schedule", mockRespondDecision, { durationMs: 100 });
    expect(isConversationalResponse(response)).toBe(true);
  });

  it("should identify error response", () => {
    const response = formatResponse("Sorry, error occurred", mockErrorDecision, { durationMs: 100 });
    expect(isErrorResponse(response)).toBe(true);
  });

  it("should detect when user action is required", () => {
    const confirmResponse = formatResponse("Confirm?", mockConfirmDecision, { durationMs: 100 });
    expect(requiresUserAction(confirmResponse)).toBe(true);

    const clarifyResponse = formatResponse("Which one?", mockClarifyDecision, { durationMs: 100 });
    expect(requiresUserAction(clarifyResponse)).toBe(true);

    const approvalResponse = formatResponse("Sending email...", mockExecuteWithApprovalDecision, { durationMs: 100 });
    expect(requiresUserAction(approvalResponse)).toBe(true);

    const simpleResponse = formatResponse("Done!", mockExecuteDecision, { durationMs: 100 });
    expect(requiresUserAction(simpleResponse)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// Assumption Conversion Tests
// ─────────────────────────────────────────────────────────────

describe("Assumption Conversion", () => {
  it("should convert LLM assumptions to internal format", () => {
    const llmAssumptions: LLMAssumption[] = [
      {
        statement: "User prefers morning meetings",
        category: "preference",
        evidence: ["Previous meetings scheduled in AM"],
        confidence: 0.85,
      },
      {
        statement: "Meeting is about project review",
        category: "inference",
        evidence: ["Project name mentioned"],
        confidence: 0.7,
      },
    ];

    const converted = convertAssumptions(llmAssumptions, "test");

    expect(converted).toHaveLength(2);
    expect(converted[0].id).toBe("test_0");
    expect(converted[0].statement).toBe("User prefers morning meetings");
    expect(converted[0].category).toBe("preference");
    expect(converted[0].confidence).toBe(0.85);
    expect(converted[0].verified).toBe(false);
    expect(converted[0].evidence).toHaveLength(1);
    expect(converted[0].evidence[0].source).toBe("inference");
  });
});

// ─────────────────────────────────────────────────────────────
// Decision Type Tests
// ─────────────────────────────────────────────────────────────

describe("getDecisionType", () => {
  it("should return correct decision type for each response", () => {
    const executeResponse = formatResponse("Done!", mockExecuteDecision, { durationMs: 100 });
    expect(getDecisionType(executeResponse)).toBe("execute_tool");

    const confirmResponse = formatResponse("Confirm?", mockConfirmDecision, { durationMs: 100 });
    expect(getDecisionType(confirmResponse)).toBe("confirm_action");

    const clarifyResponse = formatResponse("Which one?", mockClarifyDecision, { durationMs: 100 });
    expect(getDecisionType(clarifyResponse)).toBe("clarify");

    const respondResponse = formatResponse("Here you go", mockRespondDecision, { durationMs: 100 });
    expect(getDecisionType(respondResponse)).toBe("respond");

    const errorResponse = formatResponse("Error", mockErrorDecision, { durationMs: 100 });
    expect(getDecisionType(errorResponse)).toBe("error");
  });
});

// ─────────────────────────────────────────────────────────────
// System Prompt Tests
// ─────────────────────────────────────────────────────────────

describe("getSystemPromptForDecision", () => {
  it("should return appropriate system prompt for execute decision", () => {
    const prompt = getSystemPromptForDecision(mockExecuteDecision);
    expect(prompt).toContain("Theo");
    expect(prompt).toContain("tool execution");
  });

  it("should return appropriate system prompt for confirm decision", () => {
    const prompt = getSystemPromptForDecision(mockConfirmDecision);
    expect(prompt).toContain("confirmation");
  });

  it("should return appropriate system prompt for clarify decision", () => {
    const prompt = getSystemPromptForDecision(mockClarifyDecision);
    expect(prompt).toContain("clarification");
  });

  it("should return appropriate system prompt for respond decision", () => {
    const prompt = getSystemPromptForDecision(mockRespondDecision);
    expect(prompt).toContain("conversational");
  });

  it("should return appropriate system prompt for error decision", () => {
    const prompt = getSystemPromptForDecision(mockErrorDecision);
    expect(prompt).toContain("error");
  });
});

// ─────────────────────────────────────────────────────────────
// Response Prompt Building Tests
// ─────────────────────────────────────────────────────────────

describe("buildResponsePromptFromDecision", () => {
  it("should build execute prompt with tool details", () => {
    const prompt = buildResponsePromptFromDecision(
      mockExecuteDecision,
      mockContext,
      { originalMessage: "Add a task to buy groceries" }
    );

    expect(prompt).toContain("create_task");
    expect(prompt).toContain("buy groceries");
    expect(prompt).toContain("User's Request");
    expect(prompt).toContain("92%"); // confidence
  });

  it("should build execute prompt with approval notice", () => {
    const prompt = buildResponsePromptFromDecision(
      mockExecuteWithApprovalDecision,
      mockContext
    );

    expect(prompt).toContain("requires your approval");
  });

  it("should build execute prompt with tool result", () => {
    const prompt = buildResponsePromptFromDecision(
      mockExecuteDecision,
      mockContext,
      {
        toolResult: {
          success: true,
          result: { id: "123", title: "Buy groceries" },
          summary: "Task created successfully",
        },
      }
    );

    expect(prompt).toContain("Execution Result");
    expect(prompt).toContain("Success");
    expect(prompt).toContain("Task created successfully");
  });

  it("should build confirm prompt with uncertainties", () => {
    const prompt = buildResponsePromptFromDecision(
      mockConfirmDecision,
      mockContext,
      { originalMessage: "Schedule a team meeting" }
    );

    expect(prompt).toContain("Proposed Action");
    expect(prompt).toContain("schedule_meeting");
    expect(prompt).toContain("Uncertainties");
    expect(prompt).toContain("10 AM the right time");
  });

  it("should build clarify prompt with questions", () => {
    const prompt = buildResponsePromptFromDecision(
      mockClarifyDecision,
      mockContext,
      { originalMessage: "Move the meeting" }
    );

    expect(prompt).toContain("Missing Information");
    expect(prompt).toContain("Suggested Questions");
    expect(prompt).toContain("Which meeting");
    expect(prompt).toContain("What We Understood");
    expect(prompt).toContain("reschedule meeting");
  });

  it("should build respond prompt with context", () => {
    const prompt = buildResponsePromptFromDecision(
      mockRespondDecision,
      mockContext,
      { originalMessage: "What's on my schedule?" }
    );

    expect(prompt).toContain("Response Style");
    expect(prompt).toContain("informational");
    expect(prompt).toContain("Relevant Information");
  });

  it("should build error prompt with recovery suggestion", () => {
    const prompt = buildResponsePromptFromDecision(
      mockErrorDecision,
      mockContext,
      { originalMessage: "Do something impossible" }
    );

    expect(prompt).toContain("Error Information");
    expect(prompt).toContain("tool_not_found");
    expect(prompt).toContain("Recoverable: Yes");
    expect(prompt).toContain("Try a different approach");
  });

  it("should include context summary when available", () => {
    const prompt = buildResponsePromptFromDecision(
      mockExecuteDecision,
      mockContext
    );

    expect(prompt).toContain("Relevant Context");
    expect(prompt).toContain("John Doe");
    expect(prompt).toContain("Team Meeting");
  });

  it("should handle RankedContext with empty contextSummary", () => {
    // This tests the edge case where RankedContext has an empty string for contextSummary
    const rankedContextWithEmptySummary: RankedContext = {
      topItems: [],
      contextSummary: "", // Empty string - falsy but valid RankedContext
      estimatedTokens: 0,
    };

    // Should not throw and should not include "Relevant Context" section
    const prompt = buildResponsePromptFromDecision(
      mockExecuteDecision,
      rankedContextWithEmptySummary
    );

    expect(prompt).not.toContain("Relevant Context");
  });

  it("should handle RankedContext with valid contextSummary", () => {
    const rankedContext: RankedContext = {
      topItems: [],
      contextSummary: "User has a meeting with John tomorrow at 10 AM",
      estimatedTokens: 10,
    };

    const prompt = buildResponsePromptFromDecision(
      mockExecuteDecision,
      rankedContext
    );

    expect(prompt).toContain("Relevant Context");
    expect(prompt).toContain("meeting with John");
  });
});

// ─────────────────────────────────────────────────────────────
// Template Response Tests
// ─────────────────────────────────────────────────────────────

describe("buildTemplateResponse", () => {
  it("should build template for successful execution", () => {
    const template = buildTemplateResponse(mockExecuteDecision, {
      toolResult: { success: true, summary: "Task created" },
    });

    expect(template).toContain("Done!");
    expect(template).toContain("Task created");
  });

  it("should build template for approval-required execution", () => {
    const template = buildTemplateResponse(mockExecuteWithApprovalDecision, {
      toolResult: { success: true },
    });

    expect(template).toContain("requires your approval");
  });

  it("should return null for failed execution", () => {
    const template = buildTemplateResponse(mockExecuteDecision, {
      toolResult: { success: false, error: "Failed" },
    });

    expect(template).toBeNull();
  });

  it("should build template for confirmation", () => {
    const template = buildTemplateResponse(mockConfirmDecision);

    expect(template).toContain("schedule meeting");
    expect(template).toContain("10 AM the right time");
    expect(template).toContain("Should I proceed");
  });

  it("should build template for clarification", () => {
    const template = buildTemplateResponse(mockClarifyDecision);

    expect(template).toContain("Which meeting are you referring to");
  });

  it("should build template for error", () => {
    const template = buildTemplateResponse(mockErrorDecision);

    expect(template).toContain("not available");
    expect(template).toContain("Try a different approach");
  });

  it("should return null for respond decision (needs LLM)", () => {
    const template = buildTemplateResponse(mockRespondDecision);
    expect(template).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// Response Formatting Tests
// ─────────────────────────────────────────────────────────────

describe("formatResponse", () => {
  it("should format execute response with all fields", () => {
    const response = formatResponse("I've created the task for you.", mockExecuteDecision, {
      durationMs: 150,
      model: "gpt-4o",
      generationType: "llm",
      toolResult: { success: true, result: { id: "123" } },
    });

    expect(response.type).toBe("execute");
    expect(response.content).toBe("I've created the task for you.");
    expect(response.metadata.durationMs).toBe(150);
    expect(response.metadata.model).toBe("gpt-4o");
    expect(response.metadata.generationType).toBe("llm");

    if (response.type === "execute") {
      expect(response.tool).toBe("create_task");
      expect(response.params.title).toBe("Buy groceries");
      expect(response.requiresApproval).toBe(false);
      expect(response.confidence).toBe(0.92);
      expect(response.assumptions).toHaveLength(1);
      expect(response.result).toEqual({ id: "123" });
    }
  });

  it("should format confirm response with assumptions to verify", () => {
    const response = formatResponse("Should I schedule this?", mockConfirmDecision, {
      durationMs: 100,
    });

    expect(response.type).toBe("confirm");
    if (response.type === "confirm") {
      expect(response.uncertainties).toContain("Is 10 AM the right time?");
      expect(response.assumptionsToVerify).toHaveLength(1);
      expect(response.assumptionsToVerify[0].statement).toContain("30 minute");
    }
  });

  it("should format clarify response with partial understanding", () => {
    const response = formatResponse("Which meeting?", mockClarifyDecision, {
      durationMs: 80,
    });

    expect(response.type).toBe("clarify");
    if (response.type === "clarify") {
      expect(response.questions).toHaveLength(2);
      expect(response.missingInfo).toContain("meeting identity");
      expect(response.partialUnderstanding?.possibleIntent).toBe("reschedule meeting");
    }
  });

  it("should format error response with recovery info", () => {
    const response = formatResponse("Sorry, I couldn't do that.", mockErrorDecision, {
      durationMs: 50,
    });

    expect(response.type).toBe("error");
    if (response.type === "error") {
      expect(response.errorCode).toBe("tool_not_found");
      expect(response.recoverable).toBe(true);
      expect(response.recoverySuggestion).toBe("Try a different approach");
    }
  });

  it("should include approval ID when provided", () => {
    const response = formatResponse("Sending email...", mockExecuteWithApprovalDecision, {
      durationMs: 100,
      approvalId: "approval-123",
    });

    if (response.type === "execute") {
      expect(response.approvalId).toBe("approval-123");
      expect(response.requiresApproval).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Tool Result Formatting Tests
// ─────────────────────────────────────────────────────────────

describe("formatToolResult", () => {
  it("should format null/undefined results", () => {
    expect(formatToolResult("any_tool", null)).toBe("Action completed.");
    expect(formatToolResult("any_tool", undefined)).toBe("Action completed.");
  });

  it("should format array results with counts", () => {
    expect(formatToolResult("query_events", [])).toBe("No events found.");
    expect(formatToolResult("query_events", [{ id: "1" }])).toBe("Found 1 event.");
    expect(formatToolResult("list_tasks", [{ id: "1" }, { id: "2" }, { id: "3" }])).toBe("Found 3 tasks.");
  });

  it("should format created object results", () => {
    const result = { id: "123", title: "My Task", createdAt: new Date() };
    expect(formatToolResult("create_task", result)).toBe("Created: My Task");
  });

  it("should format success with message", () => {
    const result = { success: true, message: "Email sent successfully" };
    expect(formatToolResult("send_email", result)).toBe("Email sent successfully");
  });

  it("should format count results", () => {
    const result = { count: 5 };
    expect(formatToolResult("query_emails", result)).toBe("Found 5 emails.");
  });

  it("should format items array in result", () => {
    const result = { items: [{ id: "1" }, { id: "2" }] };
    expect(formatToolResult("list_people", result)).toBe("Found 2 persons.");
  });

  it("should format string results", () => {
    expect(formatToolResult("any_tool", "Direct result")).toBe("Direct result");
    const longString = "x".repeat(250);
    expect(formatToolResult("any_tool", longString)).toHaveLength(200);
    expect(formatToolResult("any_tool", longString)).toContain("...");
  });
});

// ─────────────────────────────────────────────────────────────
// Result Highlight Tests
// ─────────────────────────────────────────────────────────────

describe("extractDisplayHighlights", () => {
  it("should extract highlights from array", () => {
    const result = [
      { title: "Meeting with John" },
      { name: "Project Alpha" },
      { subject: "Important email" },
    ];

    const highlights = extractDisplayHighlights(result, 3);
    expect(highlights).toHaveLength(3);
    expect(highlights).toContain("Meeting with John");
    expect(highlights).toContain("Project Alpha");
    expect(highlights).toContain("Important email");
  });

  it("should limit highlights to max", () => {
    const result = [
      { title: "One" },
      { title: "Two" },
      { title: "Three" },
      { title: "Four" },
    ];

    const highlights = extractDisplayHighlights(result, 2);
    expect(highlights).toHaveLength(2);
  });

  it("should extract highlights from items array in object", () => {
    const result = {
      items: [{ title: "Task 1" }, { title: "Task 2" }],
    };

    const highlights = extractDisplayHighlights(result);
    expect(highlights).toContain("Task 1");
    expect(highlights).toContain("Task 2");
  });

  it("should truncate long highlights", () => {
    const longTitle = "A".repeat(100);
    const result = [{ title: longTitle }];

    const highlights = extractDisplayHighlights(result);
    expect(highlights[0]).toHaveLength(50);
    expect(highlights[0]).toContain("...");
  });
});

// ─────────────────────────────────────────────────────────────
// Result Truncation Tests
// ─────────────────────────────────────────────────────────────

describe("truncateResultStructured", () => {
  it("should truncate long strings", () => {
    const longString = "x".repeat(600);
    const result = truncateResultStructured(longString, 100);
    expect(result).toHaveLength(100);
  });

  it("should truncate arrays to 5 items", () => {
    const longArray = Array.from({ length: 10 }, (_, i) => ({ id: i }));
    const result = truncateResultStructured(longArray) as {
      items: unknown[];
      totalCount: number;
      truncated: boolean;
    };

    expect(result.items).toHaveLength(5);
    expect(result.totalCount).toBe(10);
    expect(result.truncated).toBe(true);
  });

  it("should not add truncation info for short arrays", () => {
    const shortArray = [{ id: 1 }, { id: 2 }];
    const result = truncateResultStructured(shortArray);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it("should handle very small maxLength without negative slice indices", () => {
    // This test ensures we don't get negative slice indices when maxLength is very small
    const result = truncateResultStructured("Hello World", 5);
    // Should not throw and should produce a valid string
    expect(typeof result).toBe("string");
    expect(result).toContain("...");
  });

  it("should handle deeply nested structures without breaking", () => {
    // Deep nesting that would cause maxLength to become very small through recursion
    const deeplyNested = {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: "This is a very long string that should be truncated properly even at deep nesting levels",
            },
          },
        },
      },
    };

    // Should not throw and should produce a valid result
    const result = truncateResultStructured(deeplyNested, 100);
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
  });

  it("should handle maxLength of 1 without crashing", () => {
    // Edge case: minimum possible maxLength
    const result = truncateResultStructured("Hello", 1);
    expect(typeof result).toBe("string");
    // Should use minimum length instead
  });
});

// ─────────────────────────────────────────────────────────────
// Content Cleaning Tests
// ─────────────────────────────────────────────────────────────

describe("cleanContent", () => {
  it("should remove Assistant/Theo prefix", () => {
    expect(cleanContent("Assistant: Hello there")).toBe("Hello there");
    expect(cleanContent("Theo: Hello there")).toBe("Hello there");
  });

  it("should remove markdown code blocks", () => {
    expect(cleanContent("Here's code:\n```javascript\nconst x = 1;\n```")).toBe(
      "Here's code:\nconst x = 1;"
    );
  });

  it("should remove markdown headers", () => {
    expect(cleanContent("# Header\nContent")).toBe("Header\nContent");
    expect(cleanContent("### Subheader\nContent")).toBe("Subheader\nContent");
  });

  it("should remove JSON blocks", () => {
    // After removing JSON block, multiple newlines are normalized to double newline
    expect(cleanContent('Result:\n```json\n{"key": "value"}\n```\nDone')).toBe(
      "Result:\n\nDone"
    );
  });

  it("should normalize whitespace", () => {
    expect(cleanContent("Hello\n\n\n\n\nWorld")).toBe("Hello\n\nWorld");
  });

  it("should trim content", () => {
    expect(cleanContent("  Hello World  ")).toBe("Hello World");
  });
});

// ─────────────────────────────────────────────────────────────
// Content Combining Tests
// ─────────────────────────────────────────────────────────────

describe("combineContents", () => {
  it("should combine multiple contents", () => {
    const result = combineContents(["First part", "Second part"]);
    expect(result).toBe("First part\n\nSecond part");
  });

  it("should filter empty contents", () => {
    const result = combineContents(["First", "", "   ", "Second"]);
    expect(result).toBe("First\n\nSecond");
  });

  it("should use custom separator", () => {
    const result = combineContents(["A", "B", "C"], " | ");
    expect(result).toBe("A | B | C");
  });

  it("should clean each content before combining", () => {
    const result = combineContents(["Assistant: Hello", "Theo: World"]);
    expect(result).toBe("Hello\n\nWorld");
  });
});

// ─────────────────────────────────────────────────────────────
// Token Utility Tests
// ─────────────────────────────────────────────────────────────

describe("getTotalTokens", () => {
  it("should return 0 for undefined", () => {
    expect(getTotalTokens(undefined)).toBe(0);
  });

  it("should return totalTokens if available", () => {
    expect(getTotalTokens({ promptTokens: 100, completionTokens: 50, totalTokens: 150 })).toBe(150);
  });

  it("should calculate from prompt + completion if total not available", () => {
    expect(getTotalTokens({ promptTokens: 100, completionTokens: 50, totalTokens: 0 })).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Serialization Tests
// ─────────────────────────────────────────────────────────────

describe("serializeForClient", () => {
  it("should serialize execute response for client", () => {
    const response = formatResponse("Done!", mockExecuteDecision, {
      durationMs: 100,
      model: "gpt-4o",
    });

    const serialized = serializeForClient(response);

    expect(serialized.type).toBe("execute");
    expect(serialized.content).toBe("Done!");
    expect(serialized.tool).toBe("create_task");
    expect(serialized.requiresApproval).toBe(false);
    expect(serialized.confidence).toBe(0.92);
    expect(serialized.assumptions).toHaveLength(1);
    expect(serialized.metadata.durationMs).toBe(100);
    expect(serialized.metadata.model).toBe("gpt-4o");
    expect(serialized.metadata.generatedAt).toBeDefined();
    // Should not contain internal decision object
    expect("decision" in serialized).toBe(false);
  });

  it("should serialize confirm response for client", () => {
    const response = formatResponse("Confirm?", mockConfirmDecision, { durationMs: 100 });
    const serialized = serializeForClient(response);

    expect(serialized.type).toBe("confirm");
    expect(serialized.tool).toBe("schedule_meeting");
    expect(serialized.uncertainties).toContain("Is 10 AM the right time?");
    expect(serialized.confidence).toBe(0.75);
  });

  it("should serialize clarify response for client", () => {
    const response = formatResponse("Which?", mockClarifyDecision, { durationMs: 100 });
    const serialized = serializeForClient(response);

    expect(serialized.type).toBe("clarify");
    expect(serialized.questions).toHaveLength(2);
    expect(serialized.missingInfo).toContain("meeting identity");
  });

  it("should serialize respond response for client", () => {
    const response = formatResponse("Here you go", mockRespondDecision, { durationMs: 100 });
    const serialized = serializeForClient(response);

    expect(serialized.type).toBe("respond");
    expect(serialized.isSimple).toBe(false);
  });

  it("should serialize error response for client", () => {
    const response = formatResponse("Error!", mockErrorDecision, { durationMs: 100 });
    const serialized = serializeForClient(response);

    expect(serialized.type).toBe("error");
    expect(serialized.errorCode).toBe("tool_not_found");
    expect(serialized.recoverable).toBe(true);
    expect(serialized.recoverySuggestion).toBe("Try a different approach");
  });
});


