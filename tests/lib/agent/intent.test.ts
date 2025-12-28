// ═══════════════════════════════════════════════════════════════════════════
// Intent Module Tests
// Tests for LLM-First intent analysis
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  IIntentAnalyzer,
  IntentAnalysisResult,
  AnalyzeIntentInput,
  AmbiguityAnalysis,
  ProcessedEntity,
  ProcessedAssumption,
  IntentAnalyzerConfig,
  ToolForLLM,
  ClassificationResponse,
} from "@/lib/agent/intent";
import {
  createIntentAnalyzer,
  getDefaultIntentAnalyzer,
  resetDefaultIntentAnalyzer,
  setDefaultIntentAnalyzer,
  analyzeIntent,
  analyzeAmbiguity,
  requiresClarification,
  getPrimaryClarificationQuestion,
  canProceedWithAssumptions,
  getAssumptionsToVerify,
  AMBIGUITY_THRESHOLDS,
  DEFAULT_INTENT_ANALYZER_CONFIG,
} from "@/lib/agent/intent";
import type { LLMClient } from "@/lib/agent/llm/types";
import { INTENT_CATEGORIES, ENTITY_TYPES, ASSUMPTION_CATEGORIES } from "@/lib/agent/constants";

// ─────────────────────────────────────────────────────────────
// Mock LLM Client
// ─────────────────────────────────────────────────────────────

function createMockLLMClient(
  classifyResponse?: Partial<ClassificationResponse>
): LLMClient {
  const defaultResponse: ClassificationResponse = {
    intent: {
      category: "query",
      action: "list_events",
      summary: "List calendar events",
    },
    entities: [],
    assumptions: [],
    confidence: 0.9,
    ...classifyResponse,
  };

  return {
    classify: vi.fn().mockResolvedValue(defaultResponse),
    generatePlan: vi.fn(),
    generateResponse: vi.fn(),
    decideRecovery: vi.fn(),
    complete: vi.fn(),
    streamComplete: vi.fn(),
    getProvider: vi.fn().mockReturnValue("openai"),
    getModel: vi.fn().mockReturnValue("gpt-4o-mini"),
  };
}

function createMockTools(): ToolForLLM[] {
  return [
    {
      name: "query_events",
      description: "Query calendar events",
      whenToUse: "When user asks about their schedule or events",
      examples: ["What's on my calendar?", "Show my meetings today"],
      parameters: { type: "object", properties: {} },
      requiresApproval: false,
    },
    {
      name: "create_task",
      description: "Create a new task",
      whenToUse: "When user wants to create a task",
      examples: ["Add a task to...", "Remind me to..."],
      parameters: { type: "object", properties: {} },
      requiresApproval: false,
    },
  ];
}

// ─────────────────────────────────────────────────────────────
// Intent Analyzer Factory Tests
// ─────────────────────────────────────────────────────────────

describe("IntentAnalyzer", () => {
  beforeEach(() => {
    resetDefaultIntentAnalyzer();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createIntentAnalyzer", () => {
    it("should create analyzer with default config", () => {
      const mockClient = createMockLLMClient();
      const analyzer = createIntentAnalyzer(undefined, mockClient);

      expect(analyzer).toBeDefined();
      expect(analyzer.getConfig()).toEqual({
        minToolConfidence: 0.7,
        minActionConfidence: 0.7,
        includeRawResponse: false,
        timezone: "UTC",
        maxHistoryMessages: 10,
      });
    });

    it("should create analyzer with custom config", () => {
      const mockClient = createMockLLMClient();
      const config: IntentAnalyzerConfig = {
        minToolConfidence: 0.8,
        minActionConfidence: 0.6,
        includeRawResponse: true,
        timezone: "America/New_York",
        maxHistoryMessages: 5,
      };

      const analyzer = createIntentAnalyzer(config, mockClient);
      expect(analyzer.getConfig()).toEqual(config);
    });
  });

  describe("singleton management", () => {
    it("should return same instance from getDefaultIntentAnalyzer", () => {
      const analyzer1 = getDefaultIntentAnalyzer();
      const analyzer2 = getDefaultIntentAnalyzer();
      expect(analyzer1).toBe(analyzer2);
    });

    it("should reset singleton with resetDefaultIntentAnalyzer", () => {
      const analyzer1 = getDefaultIntentAnalyzer();
      resetDefaultIntentAnalyzer();
      const analyzer2 = getDefaultIntentAnalyzer();
      expect(analyzer1).not.toBe(analyzer2);
    });

    it("should allow setting custom analyzer", () => {
      const mockClient = createMockLLMClient();
      const customAnalyzer = createIntentAnalyzer({ timezone: "UTC" }, mockClient);
      setDefaultIntentAnalyzer(customAnalyzer);
      expect(getDefaultIntentAnalyzer()).toBe(customAnalyzer);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Intent Analysis Tests
// ─────────────────────────────────────────────────────────────

describe("analyzeIntent", () => {
  beforeEach(() => {
    resetDefaultIntentAnalyzer();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should analyze a simple query intent", async () => {
    const mockClient = createMockLLMClient({
      intent: {
        category: "query",
        action: "list_events",
        summary: "Show today's calendar events",
      },
      entities: [
        {
          type: "datetime",
          text: "today",
          value: "2024-01-15",
          needsResolution: false,
        },
      ],
      assumptions: [
        {
          statement: "User wants events for today, not tomorrow",
          category: "intent",
          evidence: ['User said "today"'],
          confidence: 0.95,
        },
      ],
      confidence: 0.92,
    });

    const analyzer = createIntentAnalyzer(undefined, mockClient);
    const input: AnalyzeIntentInput = {
      message: "What's on my calendar today?",
      availableTools: createMockTools(),
    };

    const result = await analyzer.analyzeIntent(input);

    expect(result.category).toBe(INTENT_CATEGORIES.QUERY);
    expect(result.action).toBe("list_events");
    expect(result.summary).toBe("Show today's calendar events");
    expect(result.confidence).toBe(0.92);
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].type).toBe("datetime");
    expect(result.assumptions).toHaveLength(1);
    expect(result.assumptions[0].category).toBe(ASSUMPTION_CATEGORIES.INTENT);
  });

  it("should handle action intents", async () => {
    const mockClient = createMockLLMClient({
      intent: {
        category: "action",
        action: "create_task",
        summary: "Create a new task",
      },
      suggestedTool: {
        name: "create_task",
        parameters: { title: "Buy groceries", priority: "medium" },
        confidence: 0.88,
        reasoning: "User wants to create a task to buy groceries",
      },
      confidence: 0.88,
    });

    const analyzer = createIntentAnalyzer(undefined, mockClient);
    const input: AnalyzeIntentInput = {
      message: "Add a task to buy groceries",
      availableTools: createMockTools(),
    };

    const result = await analyzer.analyzeIntent(input);

    expect(result.category).toBe(INTENT_CATEGORIES.TASK); // action maps to task
    expect(result.suggestedTool).toBeDefined();
    expect(result.suggestedTool?.name).toBe("create_task");
    expect(result.suggestedTool?.parameters).toEqual({
      title: "Buy groceries",
      priority: "medium",
    });
    expect(result.suggestedTool?.confidence).toBe(0.88);
  });

  it("should filter out low-confidence tool suggestions", async () => {
    const mockClient = createMockLLMClient({
      intent: {
        category: "action",
        action: "create_task",
        summary: "Maybe create a task",
      },
      suggestedTool: {
        name: "create_task",
        parameters: { title: "Something" },
        confidence: 0.5, // Below threshold
        reasoning: "Not sure if this is a task request",
      },
      confidence: 0.6,
    });

    const analyzer = createIntentAnalyzer({ minToolConfidence: 0.7 }, mockClient);
    const input: AnalyzeIntentInput = {
      message: "Something about tasks maybe",
      availableTools: createMockTools(),
    };

    const result = await analyzer.analyzeIntent(input);

    expect(result.suggestedTool).toBeUndefined();
  });

  it("should handle clarification requirements", async () => {
    const mockClient = createMockLLMClient({
      intent: {
        category: "action",
        summary: "Schedule a meeting",
      },
      clarificationNeeded: {
        required: true,
        questions: ["When would you like to schedule the meeting?"],
        missingInfo: ["meeting time", "attendees"],
      },
      confidence: 0.4,
    });

    const analyzer = createIntentAnalyzer(undefined, mockClient);
    const input: AnalyzeIntentInput = {
      message: "Schedule a meeting",
      availableTools: createMockTools(),
    };

    const result = await analyzer.analyzeIntent(input);

    expect(result.clarification).toBeDefined();
    expect(result.clarification?.required).toBe(true);
    expect(result.clarification?.questions).toContain(
      "When would you like to schedule the meeting?"
    );
    expect(result.clarification?.missingInfo).toContain("meeting time");
  });

  it("should add clarification for low confidence even without explicit clarificationNeeded", async () => {
    // Bug fix test: low confidence results without explicit clarificationNeeded
    // should still get clarification requirements
    const mockClient = createMockLLMClient({
      intent: {
        category: "action",
        action: "maybe_task",
        summary: "Possibly create a task",
      },
      // No clarificationNeeded field at all
      confidence: 0.5, // Below minActionConfidence (0.7)
    });

    const analyzer = createIntentAnalyzer({ minActionConfidence: 0.7 }, mockClient);
    const result = await analyzer.analyzeIntent({
      message: "Something vague",
      availableTools: createMockTools(),
    });

    // Should have clarification even though LLM didn't explicitly request it
    expect(result.clarification).toBeDefined();
    expect(result.clarification?.required).toBe(true);
    expect(result.clarification?.questions.length).toBeGreaterThan(0);
  });

  it("should include raw response when configured", async () => {
    const mockClient = createMockLLMClient({
      intent: { category: "query", summary: "Test" },
      confidence: 0.9,
    });

    const analyzer = createIntentAnalyzer({ includeRawResponse: true }, mockClient);
    const result = await analyzer.analyzeIntent({
      message: "Test",
      availableTools: [],
    });

    expect(result.rawResponse).toBeDefined();
    expect(result.rawResponse?.intent.category).toBe("query");
  });

  it("should handle LLM errors gracefully", async () => {
    const mockClient = createMockLLMClient();
    (mockClient.classify as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("LLM unavailable")
    );

    const analyzer = createIntentAnalyzer(undefined, mockClient);
    const result = await analyzer.analyzeIntent({
      message: "Test",
      availableTools: [],
    });

    expect(result.category).toBe(INTENT_CATEGORIES.UNKNOWN);
    expect(result.confidence).toBe(0);
    expect(result.clarification?.required).toBe(true);
  });

  it("should pass conversation history to LLM", async () => {
    const mockClient = createMockLLMClient();
    const analyzer = createIntentAnalyzer({ maxHistoryMessages: 3 }, mockClient);

    await analyzer.analyzeIntent({
      message: "What about tomorrow?",
      availableTools: createMockTools(),
      conversationHistory: [
        { role: "user", content: "What's on my calendar today?" },
        { role: "assistant", content: "You have 3 meetings today." },
        { role: "user", content: "And what about yesterday?" },
        { role: "assistant", content: "You had 2 meetings yesterday." },
      ],
    });

    expect(mockClient.classify).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationHistory: expect.arrayContaining([
          expect.objectContaining({ role: "assistant", content: "You had 2 meetings yesterday." }),
        ]),
      })
    );

    // Should only include last 3 messages
    const callArg = (mockClient.classify as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.conversationHistory).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────────
// Ambiguity Detection Tests
// ─────────────────────────────────────────────────────────────

describe("analyzeAmbiguity", () => {
  it("should detect low confidence ambiguity", () => {
    const result: IntentAnalysisResult = {
      category: INTENT_CATEGORIES.QUERY,
      summary: "Some query",
      confidence: 0.3, // Below threshold
      entities: [],
      assumptions: [],
    };

    const analysis = analyzeAmbiguity(result);

    expect(analysis.isAmbiguous).toBe(true);
    expect(analysis.ambiguityTypes).toContain("low_confidence");
    expect(analysis.clarificationQuestions.length).toBeGreaterThan(0);
  });

  it("should detect entity resolution needs", () => {
    const result: IntentAnalysisResult = {
      category: INTENT_CATEGORIES.SCHEDULE,
      summary: "Schedule with Sarah",
      confidence: 0.9,
      entities: [
        {
          type: ENTITY_TYPES.PERSON,
          text: "Sarah",
          value: "Sarah",
          confidence: 0.8,
          needsResolution: true,
        },
      ],
      assumptions: [],
    };

    const analysis = analyzeAmbiguity(result);

    expect(analysis.isAmbiguous).toBe(true);
    expect(analysis.ambiguityTypes).toContain("entity_resolution");
    expect(analysis.clarificationQuestions).toContainEqual(
      expect.stringContaining("Sarah")
    );
  });

  it("should detect missing info from LLM clarification", () => {
    const result: IntentAnalysisResult = {
      category: INTENT_CATEGORIES.SCHEDULE,
      summary: "Schedule a meeting",
      confidence: 0.7,
      entities: [],
      assumptions: [],
      clarification: {
        required: true,
        questions: ["When should I schedule the meeting?"],
        missingInfo: ["date", "time"],
      },
    };

    const analysis = analyzeAmbiguity(result);

    expect(analysis.isAmbiguous).toBe(true);
    expect(analysis.ambiguityTypes).toContain("missing_info");
    expect(analysis.clarificationQuestions).toContain(
      "When should I schedule the meeting?"
    );
  });

  it("should detect unclear intent", () => {
    const result: IntentAnalysisResult = {
      category: INTENT_CATEGORIES.UNKNOWN,
      summary: "Unknown intent",
      confidence: 0.2,
      entities: [],
      assumptions: [],
    };

    const analysis = analyzeAmbiguity(result);

    expect(analysis.isAmbiguous).toBe(true);
    expect(analysis.ambiguityTypes).toContain("unclear_intent");
    expect(analysis.ambiguityTypes).toContain("low_confidence");
  });

  it("should detect multiple actions ambiguity", () => {
    const result: IntentAnalysisResult = {
      category: INTENT_CATEGORIES.TASK,
      summary: "Do something with tasks",
      confidence: 0.8,
      entities: [],
      assumptions: [],
      suggestedTool: {
        name: "create_task",
        parameters: {},
        confidence: 0.5, // Low tool confidence
        reasoning: "Could be create or update",
      },
    };

    const analysis = analyzeAmbiguity(result);

    expect(analysis.isAmbiguous).toBe(true);
    expect(analysis.ambiguityTypes).toContain("multiple_actions");
  });

  it("should not flag high-confidence results as ambiguous", () => {
    const result: IntentAnalysisResult = {
      category: INTENT_CATEGORIES.QUERY,
      summary: "Show my tasks",
      confidence: 0.95,
      entities: [],
      assumptions: [],
      suggestedTool: {
        name: "query_tasks",
        parameters: {},
        confidence: 0.92,
        reasoning: "User clearly wants to see tasks",
      },
    };

    const analysis = analyzeAmbiguity(result);

    expect(analysis.isAmbiguous).toBe(false);
    expect(analysis.ambiguityTypes).toHaveLength(0);
  });

  it("should add clarification for low-confidence assumptions", () => {
    const result: IntentAnalysisResult = {
      category: INTENT_CATEGORIES.SCHEDULE,
      summary: "Schedule meeting",
      confidence: 0.85,
      entities: [],
      assumptions: [
        {
          id: "1",
          statement: "Meeting is 30 minutes long",
          category: ASSUMPTION_CATEGORIES.PREFERENCE,
          evidence: ["Default duration"],
          confidence: 0.4, // Low confidence assumption
        },
      ],
    };

    const analysis = analyzeAmbiguity(result);

    expect(analysis.clarificationQuestions).toContainEqual(
      expect.stringContaining("Meeting is 30 minutes long")
    );
  });
});

// ─────────────────────────────────────────────────────────────
// Utility Function Tests
// ─────────────────────────────────────────────────────────────

describe("requiresClarification", () => {
  it("should return true for low confidence", () => {
    const result: IntentAnalysisResult = {
      category: INTENT_CATEGORIES.QUERY,
      summary: "Test",
      confidence: 0.3,
      entities: [],
      assumptions: [],
    };

    expect(requiresClarification(result)).toBe(true);
  });

  it("should return false for high confidence", () => {
    const result: IntentAnalysisResult = {
      category: INTENT_CATEGORIES.QUERY,
      summary: "Test",
      confidence: 0.95,
      entities: [],
      assumptions: [],
    };

    expect(requiresClarification(result)).toBe(false);
  });
});

describe("getPrimaryClarificationQuestion", () => {
  it("should return first question for ambiguous result", () => {
    const result: IntentAnalysisResult = {
      category: INTENT_CATEGORIES.UNKNOWN,
      summary: "Unknown",
      confidence: 0.2,
      entities: [],
      assumptions: [],
    };

    const question = getPrimaryClarificationQuestion(result);
    expect(question).toBeDefined();
    expect(typeof question).toBe("string");
  });

  it("should return undefined for clear result", () => {
    const result: IntentAnalysisResult = {
      category: INTENT_CATEGORIES.QUERY,
      summary: "Clear query",
      confidence: 0.95,
      entities: [],
      assumptions: [],
    };

    expect(getPrimaryClarificationQuestion(result)).toBeUndefined();
  });
});

describe("canProceedWithAssumptions", () => {
  it("should return true for high confidence with no critical issues", () => {
    const result: IntentAnalysisResult = {
      category: INTENT_CATEGORIES.TASK,
      summary: "Create task",
      confidence: 0.85,
      entities: [],
      assumptions: [
        {
          id: "1",
          statement: "Priority is medium",
          category: ASSUMPTION_CATEGORIES.PREFERENCE,
          evidence: ["Default"],
          confidence: 0.7,
        },
      ],
    };

    expect(canProceedWithAssumptions(result)).toBe(true);
  });

  it("should return false for unknown intent", () => {
    const result: IntentAnalysisResult = {
      category: INTENT_CATEGORIES.UNKNOWN,
      summary: "Unknown",
      confidence: 0.8,
      entities: [],
      assumptions: [],
    };

    expect(canProceedWithAssumptions(result)).toBe(false);
  });

  it("should return false for missing required info", () => {
    const result: IntentAnalysisResult = {
      category: INTENT_CATEGORIES.SCHEDULE,
      summary: "Schedule meeting",
      confidence: 0.8,
      entities: [],
      assumptions: [],
      clarification: {
        required: true,
        questions: ["When?"],
        missingInfo: ["date"],
      },
    };

    expect(canProceedWithAssumptions(result)).toBe(false);
  });

  it("should return false for low confidence", () => {
    const result: IntentAnalysisResult = {
      category: INTENT_CATEGORIES.TASK,
      summary: "Maybe task",
      confidence: 0.5,
      entities: [],
      assumptions: [],
    };

    expect(canProceedWithAssumptions(result)).toBe(false);
  });
});

describe("getAssumptionsToVerify", () => {
  it("should return low-confidence assumptions", () => {
    const result: IntentAnalysisResult = {
      category: INTENT_CATEGORIES.SCHEDULE,
      summary: "Schedule meeting",
      confidence: 0.9,
      entities: [],
      assumptions: [
        {
          id: "1",
          statement: "Meeting with John",
          category: ASSUMPTION_CATEGORIES.CONTEXT,
          evidence: [],
          confidence: 0.9,
        },
        {
          id: "2",
          statement: "30 minute duration",
          category: ASSUMPTION_CATEGORIES.PREFERENCE,
          evidence: [],
          confidence: 0.4, // Low confidence
        },
        {
          id: "3",
          statement: "In person meeting",
          category: ASSUMPTION_CATEGORIES.INFERENCE,
          evidence: [],
          confidence: 0.5, // Low confidence
        },
      ],
    };

    const toVerify = getAssumptionsToVerify(result, 0.6);

    expect(toVerify).toHaveLength(2);
    expect(toVerify.map((a) => a.id)).toContain("2");
    expect(toVerify.map((a) => a.id)).toContain("3");
  });

  it("should return empty array when all assumptions are confident", () => {
    const result: IntentAnalysisResult = {
      category: INTENT_CATEGORIES.QUERY,
      summary: "Test",
      confidence: 0.9,
      entities: [],
      assumptions: [
        {
          id: "1",
          statement: "High confidence",
          category: ASSUMPTION_CATEGORIES.INTENT,
          evidence: [],
          confidence: 0.95,
        },
      ],
    };

    expect(getAssumptionsToVerify(result)).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Constants Tests
// ─────────────────────────────────────────────────────────────

describe("Constants", () => {
  it("should export AMBIGUITY_THRESHOLDS", () => {
    expect(AMBIGUITY_THRESHOLDS).toBeDefined();
    expect(AMBIGUITY_THRESHOLDS.LOW_CONFIDENCE).toBe(0.5);
    expect(AMBIGUITY_THRESHOLDS.LOW_TOOL_CONFIDENCE).toBe(0.6);
  });

  it("should export DEFAULT_INTENT_ANALYZER_CONFIG", () => {
    expect(DEFAULT_INTENT_ANALYZER_CONFIG).toBeDefined();
    expect(DEFAULT_INTENT_ANALYZER_CONFIG.minToolConfidence).toBe(0.7);
    expect(DEFAULT_INTENT_ANALYZER_CONFIG.timezone).toBe("UTC");
  });
});

// ─────────────────────────────────────────────────────────────
// Integration-like Tests
// ─────────────────────────────────────────────────────────────

describe("Intent Analysis Flow", () => {
  it("should handle complete analysis flow", async () => {
    const mockClient = createMockLLMClient({
      intent: {
        category: "schedule",
        action: "create_event",
        summary: "Schedule a meeting with Sarah tomorrow at 2pm",
      },
      entities: [
        {
          type: "person",
          text: "Sarah",
          value: "Sarah",
          needsResolution: true,
        },
        {
          type: "datetime",
          text: "tomorrow at 2pm",
          value: "2024-01-16T14:00:00",
          needsResolution: false,
        },
      ],
      suggestedTool: {
        name: "create_event",
        parameters: {
          title: "Meeting with Sarah",
          startTime: "2024-01-16T14:00:00",
          attendees: ["sarah"],
        },
        confidence: 0.85,
        reasoning: "User wants to schedule a meeting",
      },
      assumptions: [
        {
          statement: "Meeting is 1 hour long (default duration)",
          category: "preference",
          evidence: ["No duration specified"],
          confidence: 0.7,
        },
      ],
      confidence: 0.88,
    });

    const analyzer = createIntentAnalyzer(undefined, mockClient);

    // Step 1: Analyze intent
    const result = await analyzer.analyzeIntent({
      message: "Schedule a meeting with Sarah tomorrow at 2pm",
      availableTools: createMockTools(),
      timezone: "America/New_York",
    });

    expect(result.category).toBe(INTENT_CATEGORIES.SCHEDULE);
    expect(result.suggestedTool?.name).toBe("create_event");

    // Step 2: Check ambiguity
    const ambiguity = analyzer.detectAmbiguity(result);
    expect(ambiguity.isAmbiguous).toBe(true);
    expect(ambiguity.ambiguityTypes).toContain("entity_resolution");

    // Step 3: Get assumptions to verify
    const assumptions = getAssumptionsToVerify(result, 0.75);
    expect(assumptions).toHaveLength(1);
    expect(assumptions[0].statement).toContain("1 hour");

    // Step 4: Check if we can proceed
    expect(canProceedWithAssumptions(result)).toBe(false); // Entity needs resolution
  });

  it("should handle clear, actionable intents", async () => {
    const mockClient = createMockLLMClient({
      intent: {
        category: "query",
        action: "list_tasks",
        summary: "List all my tasks",
      },
      suggestedTool: {
        name: "query_tasks",
        parameters: { status: "all" },
        confidence: 0.95,
        reasoning: "User wants to see all tasks",
      },
      assumptions: [],
      confidence: 0.97,
    });

    const analyzer = createIntentAnalyzer(undefined, mockClient);
    const result = await analyzer.analyzeIntent({
      message: "Show me all my tasks",
      availableTools: createMockTools(),
    });

    const ambiguity = analyzer.detectAmbiguity(result);
    expect(ambiguity.isAmbiguous).toBe(false);
    expect(canProceedWithAssumptions(result)).toBe(true);
  });
});
