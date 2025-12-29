// ═══════════════════════════════════════════════════════════════════════════
// Context Retrieval Service Tests
// Tests for multi-source context retrieval
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { IntentAnalysisResult, ProcessedEntity } from "@/lib/agent/intent/types";
import type { ResolutionResult, ResolvedEntity } from "@/lib/agent/entities/types";
import type {
  ContextRetrieval,
  RetrievalOptions,
  SemanticMatch,
  RankedContextItem,
  WithRelevance,
} from "@/lib/agent/context/types";
import {
  DEFAULT_RETRIEVAL_OPTIONS,
  ContextRetrievalError,
  SOURCE_WEIGHTS,
  INTENT_ENTITY_WEIGHTS,
  getEntityDisplayName,
  summarizeEntity,
  calculateRelevanceScore,
  rankContextRelevance,
  mergeAndRank,
  buildContextSummary,
  rankSemanticMatches,
  calculateTimeRelevance,
  calculateRecencyRelevance,
} from "@/lib/agent/context";
import type { Person, Event, Task, EntityType } from "@/services/context/types";

// ─────────────────────────────────────────────────────────────
// Mock Data
// ─────────────────────────────────────────────────────────────

const mockPerson: Person = {
  id: "person-1",
  userId: "user-1",
  name: "John Doe",
  email: "john@example.com",
  phone: null,
  avatarUrl: null,
  type: "contact",
  importance: 5,
  company: "Acme Corp",
  title: "Engineer",
  location: null,
  timezone: null,
  bio: null,
  notes: null,
  preferences: {},
  source: "manual",
  sourceId: null,
  sourceSyncedAt: null,
  metadata: {},
  tags: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const mockEvent: Event = {
  id: "event-1",
  userId: "user-1",
  title: "Team Meeting",
  description: "Weekly sync",
  location: "Conference Room A",
  type: "meeting",
  status: "confirmed",
  startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
  endsAt: new Date(Date.now() + 25 * 60 * 60 * 1000),
  allDay: false,
  timezone: null,
  placeId: null,
  virtualUrl: null,
  visibility: "private",
  importance: 5,
  source: "calendar",
  sourceId: null,
  sourceSyncedAt: null,
  notes: null,
  metadata: {},
  tags: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  googleEventId: null,
  googleCalendarId: null,
  calendarId: null,
  recurringEventId: null,
  recurrence: null,
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
};

const mockTask: Task = {
  id: "task-1",
  userId: "user-1",
  title: "Review PR",
  description: "Review pull request #123",
  status: "pending",
  priority: "high",
  dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
  startDate: null,
  parentId: null,
  position: 0,
  source: "manual",
  sourceId: null,
  sourceSyncedAt: null,
  notes: null,
  assignedToId: null,
  metadata: {},
  tags: [],
  completedAt: null,
  estimatedMinutes: null,
  actualMinutes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const mockIntentResult: IntentAnalysisResult = {
  category: "schedule",
  action: "schedule_meeting",
  summary: "Schedule a meeting with John about the project",
  confidence: 0.85,
  entities: [
    {
      type: "person",
      text: "John",
      value: "John",
      confidence: 0.9,
      needsResolution: true,
    },
  ] as ProcessedEntity[],
  suggestedTool: {
    name: "create_calendar_event",
    parameters: { attendee: "John" },
    confidence: 0.8,
    reasoning: "User wants to schedule a meeting",
  },
  assumptions: [],
};

// ─────────────────────────────────────────────────────────────
// Types Tests
// ─────────────────────────────────────────────────────────────

describe("Context Retrieval Types", () => {
  describe("DEFAULT_RETRIEVAL_OPTIONS", () => {
    it("should have sensible default values", () => {
      expect(DEFAULT_RETRIEVAL_OPTIONS.maxPeople).toBe(5);
      expect(DEFAULT_RETRIEVAL_OPTIONS.maxEvents).toBe(5);
      expect(DEFAULT_RETRIEVAL_OPTIONS.maxTasks).toBe(10);
      expect(DEFAULT_RETRIEVAL_OPTIONS.maxSemanticMatches).toBe(10);
      expect(DEFAULT_RETRIEVAL_OPTIONS.maxConversationMessages).toBe(10);
      expect(DEFAULT_RETRIEVAL_OPTIONS.useSemanticSearch).toBe(true);
      expect(DEFAULT_RETRIEVAL_OPTIONS.minSimilarity).toBe(0.5);
      expect(DEFAULT_RETRIEVAL_OPTIONS.includeRelated).toBe(true);
    });
  });

  describe("ContextRetrievalError", () => {
    it("should create error with code and message", () => {
      const error = new ContextRetrievalError(
        "RETRIEVAL_FAILED",
        "Failed to retrieve context"
      );

      expect(error.name).toBe("ContextRetrievalError");
      expect(error.code).toBe("RETRIEVAL_FAILED");
      expect(error.message).toBe("Failed to retrieve context");
    });

    it("should include optional details", () => {
      const error = new ContextRetrievalError(
        "DATABASE_ERROR",
        "Query failed",
        { table: "Person", userId: "user-1" }
      );

      expect(error.details).toEqual({ table: "Person", userId: "user-1" });
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Ranking Tests
// ─────────────────────────────────────────────────────────────

describe("Context Ranking", () => {
  describe("SOURCE_WEIGHTS", () => {
    it("should have highest weight for resolved entities", () => {
      expect(SOURCE_WEIGHTS.resolved_entity).toBe(1.0);
      expect(SOURCE_WEIGHTS.semantic_search).toBe(0.8);
      expect(SOURCE_WEIGHTS.text_search).toBe(0.7);
      expect(SOURCE_WEIGHTS.conversation).toBe(0.6);
      expect(SOURCE_WEIGHTS.related_entity).toBe(0.5);
      expect(SOURCE_WEIGHTS.recent_interaction).toBe(0.4);
      expect(SOURCE_WEIGHTS.time_based).toBe(0.3);
    });
  });

  describe("INTENT_ENTITY_WEIGHTS", () => {
    it("should boost events for schedule intent", () => {
      const scheduleWeights = INTENT_ENTITY_WEIGHTS.schedule;
      expect(scheduleWeights?.event).toBe(1.2);
      expect(scheduleWeights?.person).toBe(1.1);
    });

    it("should boost tasks for task intent", () => {
      const taskWeights = INTENT_ENTITY_WEIGHTS.task;
      expect(taskWeights?.task).toBe(1.3);
      expect(taskWeights?.deadline).toBe(1.2);
    });
  });

  describe("getEntityDisplayName", () => {
    it("should return name for person", () => {
      expect(getEntityDisplayName(mockPerson, "person")).toBe("John Doe");
    });

    it("should return title for event", () => {
      expect(getEntityDisplayName(mockEvent, "event")).toBe("Team Meeting");
    });

    it("should return title for task", () => {
      expect(getEntityDisplayName(mockTask, "task")).toBe("Review PR");
    });
  });

  describe("summarizeEntity", () => {
    it("should summarize person with title and company", () => {
      const summary = summarizeEntity(mockPerson, "person");
      expect(summary).toContain("John Doe");
      expect(summary).toContain("Engineer");
      expect(summary).toContain("Acme Corp");
      expect(summary).toContain("john@example.com");
    });

    it("should summarize event with date and location", () => {
      const summary = summarizeEntity(mockEvent, "event");
      expect(summary).toContain("Team Meeting");
      expect(summary).toContain("Conference Room A");
    });

    it("should summarize task with status and due date", () => {
      const summary = summarizeEntity(mockTask, "task");
      expect(summary).toContain("Review PR");
      expect(summary).toContain("[pending]");
    });
  });

  describe("calculateRelevanceScore", () => {
    it("should apply source weight to base relevance", () => {
      const item: WithRelevance<Person> = {
        item: mockPerson,
        relevance: 0.8,
        source: "semantic_search",
      };

      const score = calculateRelevanceScore(item, "person", mockIntentResult);

      // Base 0.8 * semantic_search weight 0.8 * scheduling person boost 1.1 * mentioned boost 1.2
      // (person entity is in mockIntentResult.entities)
      expect(score).toBeCloseTo(0.8 * 0.8 * 1.1 * 1.2, 2);
    });

    it("should boost for mentioned entities", () => {
      const intentWithPerson: IntentAnalysisResult = {
        ...mockIntentResult,
        entities: [
          { type: "person", text: "John", value: "John", confidence: 0.9, needsResolution: true },
        ],
      };

      const item: WithRelevance<Person> = {
        item: mockPerson,
        relevance: 0.8,
        source: "resolved_entity",
      };

      const score = calculateRelevanceScore(item, "person", intentWithPerson);

      // Should include 1.2x boost for mentioned entity
      expect(score).toBeGreaterThan(0.8);
    });

    it("should cap score at 1.0", () => {
      const item: WithRelevance<Event> = {
        item: mockEvent,
        relevance: 1.0,
        source: "resolved_entity",
      };

      // With all boosts, should still be capped at 1.0
      const score = calculateRelevanceScore(item, "event", mockIntentResult);
      expect(score).toBeLessThanOrEqual(1.0);
    });
  });

  describe("rankContextRelevance", () => {
    it("should rank items by relevance score", () => {
      const items = [
        {
          entityType: "person" as EntityType,
          entityId: "p1",
          entity: { ...mockPerson, id: "p1" },
          source: "semantic_search" as const,
          relevance: 0.5,
        },
        {
          entityType: "person" as EntityType,
          entityId: "p2",
          entity: { ...mockPerson, id: "p2", name: "Jane" },
          source: "resolved_entity" as const,
          relevance: 0.9,
        },
      ];

      const ranked = rankContextRelevance(items, mockIntentResult);

      expect(ranked.length).toBe(2);
      expect(ranked[0].entityId).toBe("p2"); // Higher relevance
      expect(ranked[1].entityId).toBe("p1");
    });

    it("should merge duplicate entities from different sources", () => {
      const items = [
        {
          entityType: "person" as EntityType,
          entityId: "p1",
          entity: mockPerson,
          source: "semantic_search" as const,
          relevance: 0.6,
          relevanceReason: "Semantic match",
        },
        {
          entityType: "person" as EntityType,
          entityId: "p1",
          entity: mockPerson,
          source: "resolved_entity" as const,
          relevance: 0.9,
          relevanceReason: "Directly mentioned",
        },
      ];

      const ranked = rankContextRelevance(items, mockIntentResult);

      expect(ranked.length).toBe(1); // Merged to one
      expect(ranked[0].sources).toContain("semantic_search");
      expect(ranked[0].sources).toContain("resolved_entity");
      expect(ranked[0].relevanceReasons).toContain("Semantic match");
      expect(ranked[0].relevanceReasons).toContain("Directly mentioned");
    });
  });

  describe("rankSemanticMatches", () => {
    it("should apply intent-based boost to matches", () => {
      const matches: SemanticMatch[] = [
        { entityType: "event", entityId: "e1", similarity: 0.7, content: "Meeting" },
        { entityType: "person", entityId: "p1", similarity: 0.7, content: "John" },
      ];

      const ranked = rankSemanticMatches(matches, mockIntentResult);

      // Event should be boosted more for scheduling intent
      const eventMatch = ranked.find((m) => m.entityType === "event");
      const personMatch = ranked.find((m) => m.entityType === "person");

      expect(eventMatch!.similarity).toBeGreaterThan(personMatch!.similarity);
    });

    it("should sort by similarity descending", () => {
      const matches: SemanticMatch[] = [
        { entityType: "task", entityId: "t1", similarity: 0.5, content: "Task 1" },
        { entityType: "task", entityId: "t2", similarity: 0.9, content: "Task 2" },
      ];

      const ranked = rankSemanticMatches(matches, mockIntentResult);

      expect(ranked[0].entityId).toBe("t2");
      expect(ranked[1].entityId).toBe("t1");
    });
  });

  describe("calculateTimeRelevance", () => {
    it("should return 1.0 for today/tomorrow", () => {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 12 * 60 * 60 * 1000);

      expect(calculateTimeRelevance(tomorrow, now)).toBe(1.0);
    });

    it("should return 0.8 for this week", () => {
      const now = new Date();
      const inFiveDays = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

      expect(calculateTimeRelevance(inFiveDays, now)).toBe(0.8);
    });

    it("should return lower scores for further events", () => {
      const now = new Date();
      const inTwoMonths = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

      expect(calculateTimeRelevance(inTwoMonths, now)).toBe(0.4);
    });
  });

  describe("calculateRecencyRelevance", () => {
    it("should return 1.0 for last hour", () => {
      const now = new Date();
      const thirtyMinsAgo = new Date(now.getTime() - 30 * 60 * 1000);

      expect(calculateRecencyRelevance(thirtyMinsAgo, now)).toBe(1.0);
    });

    it("should return 0.8 for last day", () => {
      const now = new Date();
      const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);

      expect(calculateRecencyRelevance(twelveHoursAgo, now)).toBe(0.8);
    });

    it("should return lower scores for older interactions", () => {
      const now = new Date();
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      // 14 days = 336 hours > 168 (1 week) but < 720 (30 days), so returns 0.4
      expect(calculateRecencyRelevance(twoWeeksAgo, now)).toBe(0.4);
    });
  });

  describe("buildContextSummary", () => {
    it("should build summary with high-relevance items", () => {
      const items: RankedContextItem[] = [
        {
          entityType: "person",
          entityId: "p1",
          displayName: "John Doe",
          relevance: 0.9,
          relevanceReasons: ["Mentioned"],
          sources: ["resolved_entity"],
          summary: "John Doe Engineer at Acme Corp",
          entity: mockPerson,
        },
      ];

      const { summary, tokens } = buildContextSummary(items, [], [], 1000);

      expect(summary).toContain("Relevant Context");
      expect(summary).toContain("person: John Doe");
      expect(tokens).toBeGreaterThan(0);
    });

    it("should include conversation history", () => {
      const conversations = [
        {
          id: "m1",
          role: "user" as const,
          content: "What meetings do I have tomorrow?",
          createdAt: new Date(),
        },
      ];

      const { summary } = buildContextSummary([], conversations, [], 1000);

      expect(summary).toContain("Recent Conversation");
      expect(summary).toContain("meetings");
    });

    it("should respect token limit", () => {
      const items: RankedContextItem[] = Array.from({ length: 50 }, (_, i) => ({
        entityType: "person" as EntityType,
        entityId: `p${i}`,
        displayName: `Person ${i}`,
        relevance: 0.9,
        relevanceReasons: [],
        sources: ["resolved_entity" as const],
        summary: `Person ${i} with a very long description that takes up tokens`,
        entity: mockPerson,
      }));

      // Very small token limit
      const { tokens } = buildContextSummary(items, [], [], 100);

      expect(tokens).toBeLessThanOrEqual(100);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Integration Tests
// ─────────────────────────────────────────────────────────────

describe("Context Retrieval Integration", () => {
  describe("mergeAndRank", () => {
    it("should merge all context sources and rank", () => {
      const context: ContextRetrieval = {
        relevantPeople: [
          {
            item: mockPerson,
            relevance: 0.9,
            source: "resolved_entity",
            relevanceReason: "Mentioned",
          },
        ],
        relevantEvents: [
          {
            item: mockEvent,
            relevance: 0.7,
            source: "time_based",
            relevanceReason: "Upcoming",
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
          fromSemanticSearch: 0,
          fromTextSearch: 0,
          fromConversation: 0,
          fromRecentInteractions: 0,
          durationMs: 10,
        },
      };

      const ranked = mergeAndRank(context, mockIntentResult);

      expect(ranked.topItems.length).toBe(2);
      expect(ranked.contextSummary.length).toBeGreaterThan(0);
      expect(ranked.estimatedTokens).toBeGreaterThan(0);
    });

    it("should sort by calculated relevance", () => {
      const highRelevanceEvent = {
        ...mockEvent,
        id: "event-high",
      };

      const context: ContextRetrieval = {
        relevantPeople: [
          {
            item: mockPerson,
            relevance: 0.5,
            source: "semantic_search" as const,
          },
        ],
        relevantEvents: [
          {
            item: highRelevanceEvent,
            relevance: 0.95,
            source: "resolved_entity" as const,
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
          durationMs: 10,
        },
      };

      const ranked = mergeAndRank(context, mockIntentResult);

      // Event should be first (higher relevance for scheduling intent)
      expect(ranked.topItems[0].entityType).toBe("event");
    });
  });
});


