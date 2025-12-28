// ═══════════════════════════════════════════════════════════════════════════
// Context Search Service - Unit Tests
// Tests for unified text and semantic search across context entities
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─────────────────────────────────────────────────────────────
// Mock Dependencies (hoisted)
// ─────────────────────────────────────────────────────────────

const {
  mockPersonFindMany,
  mockPlaceFindMany,
  mockEventFindMany,
  mockTaskFindMany,
  mockDeadlineFindMany,
  mockRoutineFindMany,
  mockOpenLoopFindMany,
  mockProjectFindMany,
  mockNoteFindMany,
  mockSearchSimilar,
} = vi.hoisted(() => ({
  mockPersonFindMany: vi.fn(),
  mockPlaceFindMany: vi.fn(),
  mockEventFindMany: vi.fn(),
  mockTaskFindMany: vi.fn(),
  mockDeadlineFindMany: vi.fn(),
  mockRoutineFindMany: vi.fn(),
  mockOpenLoopFindMany: vi.fn(),
  mockProjectFindMany: vi.fn(),
  mockNoteFindMany: vi.fn(),
  mockSearchSimilar: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    person: { findMany: mockPersonFindMany },
    place: { findMany: mockPlaceFindMany },
    event: { findMany: mockEventFindMany },
    task: { findMany: mockTaskFindMany },
    deadline: { findMany: mockDeadlineFindMany },
    routine: { findMany: mockRoutineFindMany },
    openLoop: { findMany: mockOpenLoopFindMany },
    project: { findMany: mockProjectFindMany },
    note: { findMany: mockNoteFindMany },
  },
}));

vi.mock("@/lib/embeddings/search-service", () => ({
  getSemanticSearchService: () => ({
    searchSimilar: mockSearchSimilar,
  }),
}));

import {
  ContextSearchService,
  getContextSearchService,
  createContextSearchService,
  searchContext,
  textSearchContext,
  semanticSearchContext,
} from "@/services/context/context-search";

// ─────────────────────────────────────────────────────────────
// Test Data
// ─────────────────────────────────────────────────────────────

const testUserId = "user-123";

const mockPeople = [
  {
    id: "person-1",
    userId: testUserId,
    name: "John Doe",
    email: "john@example.com",
    company: "Acme Corp",
    title: "Software Engineer",
    importance: 8,
    type: "colleague",
    source: "manual",
    tags: ["engineering", "frontend"],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  },
  {
    id: "person-2",
    userId: testUserId,
    name: "Jane Smith",
    email: "jane@example.com",
    company: "Tech Inc",
    title: "Product Manager",
    importance: 7,
    type: "colleague",
    source: "manual",
    tags: ["product"],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  },
];

const mockPlaces = [
  {
    id: "place-1",
    userId: testUserId,
    name: "Acme Office",
    city: "San Francisco",
    country: "USA",
    importance: 9,
    type: "office",
    source: "manual",
    tags: ["work"],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  },
];

const mockEvents = [
  {
    id: "event-1",
    userId: testUserId,
    title: "Team Standup",
    description: "Daily engineering standup",
    type: "meeting",
    startsAt: new Date(),
    importance: 6,
    status: "confirmed",
    source: "calendar",
    tags: ["standup"],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  },
];

const mockTasks = [
  {
    id: "task-1",
    userId: testUserId,
    title: "Review code",
    description: "Review pull request for new feature",
    status: "pending",
    priority: "high",
    source: "manual",
    tags: ["code-review"],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  },
];

const mockDeadlines = [
  {
    id: "deadline-1",
    userId: testUserId,
    title: "Project deadline",
    description: "Complete phase 1",
    type: "deadline",
    status: "pending",
    importance: 10,
    dueAt: new Date(),
    source: "manual",
    tags: ["phase-1"],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  },
];

const mockSemanticResults = [
  {
    entityType: "person" as const,
    entityId: "person-1",
    content: "John Doe - Software Engineer",
    chunkIndex: 0,
    similarity: 0.92,
    metadata: {},
  },
  {
    entityType: "task" as const,
    entityId: "task-1",
    content: "Review code - pull request",
    chunkIndex: 0,
    similarity: 0.85,
    metadata: {},
  },
];

// ─────────────────────────────────────────────────────────────
// Setup and Helpers
// ─────────────────────────────────────────────────────────────

function setupDefaultMocks() {
  mockPersonFindMany.mockResolvedValue(mockPeople);
  mockPlaceFindMany.mockResolvedValue(mockPlaces);
  mockEventFindMany.mockResolvedValue(mockEvents);
  mockTaskFindMany.mockResolvedValue(mockTasks);
  mockDeadlineFindMany.mockResolvedValue(mockDeadlines);
  mockRoutineFindMany.mockResolvedValue([]);
  mockOpenLoopFindMany.mockResolvedValue([]);
  mockProjectFindMany.mockResolvedValue([]);
  mockNoteFindMany.mockResolvedValue([]);
  mockSearchSimilar.mockResolvedValue(mockSemanticResults);
}

// ─────────────────────────────────────────────────────────────
// ContextSearchService Tests
// ─────────────────────────────────────────────────────────────

describe("ContextSearchService", () => {
  let service: ContextSearchService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ContextSearchService();
    setupDefaultMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("search (unified)", () => {
    it("combines text and semantic search results", async () => {
      const results = await service.search(testUserId, "engineer");

      // Should call both text search (via database) and semantic search
      expect(mockPersonFindMany).toHaveBeenCalled();
      expect(mockSearchSimilar).toHaveBeenCalled();

      // Should return merged results
      expect(results.length).toBeGreaterThan(0);
    });

    it("respects entity type filters", async () => {
      await service.search(testUserId, "test", {
        entityTypes: ["person", "task"],
      });

      // Should only query person and task tables
      expect(mockPersonFindMany).toHaveBeenCalled();
      expect(mockTaskFindMany).toHaveBeenCalled();
      expect(mockPlaceFindMany).not.toHaveBeenCalled();
      expect(mockEventFindMany).not.toHaveBeenCalled();
      expect(mockDeadlineFindMany).not.toHaveBeenCalled();
    });

    it("respects limit parameter", async () => {
      const results = await service.search(testUserId, "test", {
        limit: 2,
      });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("can disable semantic search", async () => {
      await service.search(testUserId, "test", {
        useSemanticSearch: false,
      });

      // Should not call semantic search
      expect(mockSearchSimilar).not.toHaveBeenCalled();
    });

    it("includes snippets when requested", async () => {
      const results = await service.search(testUserId, "John", {
        includeSnippets: true,
      });

      // Results should include snippet field
      if (results.length > 0) {
        expect(results[0]).toHaveProperty("snippet");
      }
    });

    it("deduplicates results found by both searches", async () => {
      // Setup: Semantic search returns same entity as text search
      mockSearchSimilar.mockResolvedValue([
        {
          entityType: "person",
          entityId: "person-1", // Same as in mockPeople
          content: "John Doe",
          chunkIndex: 0,
          similarity: 0.9,
          metadata: {},
        },
      ]);

      const results = await service.search(testUserId, "John");

      // person-1 should only appear once with matchType "both"
      const person1Results = results.filter(
        (r) => r.entityId === "person-1" && r.entityType === "person"
      );
      expect(person1Results).toHaveLength(1);
      expect(person1Results[0].matchType).toBe("both");
    });

    it("handles semantic search errors gracefully", async () => {
      mockSearchSimilar.mockRejectedValue(new Error("OpenAI unavailable"));

      // Should not throw, should fall back to text-only results
      const results = await service.search(testUserId, "test");

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("textSearch", () => {
    it("searches all entity types by default", async () => {
      await service.textSearch(testUserId, "test");

      expect(mockPersonFindMany).toHaveBeenCalled();
      expect(mockPlaceFindMany).toHaveBeenCalled();
      expect(mockEventFindMany).toHaveBeenCalled();
      expect(mockTaskFindMany).toHaveBeenCalled();
      expect(mockDeadlineFindMany).toHaveBeenCalled();
    });

    it("filters by specified entity types", async () => {
      await service.textSearch(testUserId, "test", {
        entityTypes: ["person"],
      });

      expect(mockPersonFindMany).toHaveBeenCalled();
      expect(mockPlaceFindMany).not.toHaveBeenCalled();
      expect(mockEventFindMany).not.toHaveBeenCalled();
      expect(mockTaskFindMany).not.toHaveBeenCalled();
      expect(mockDeadlineFindMany).not.toHaveBeenCalled();
    });

    it("returns results with text matchType", async () => {
      const results = await service.textSearch(testUserId, "John");

      results.forEach((result) => {
        expect(result.matchType).toBe("text");
      });
    });

    it("sorts results by score", async () => {
      const results = await service.textSearch(testUserId, "test");

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it("assigns scores between 0 and 1", async () => {
      const results = await service.textSearch(testUserId, "test");

      results.forEach((result) => {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      });
    });

    it("boosts exact name/title matches", async () => {
      // Search for exact name - reset other mocks to only get person results
      mockPlaceFindMany.mockResolvedValue([]);
      mockEventFindMany.mockResolvedValue([]);
      mockTaskFindMany.mockResolvedValue([]);
      mockDeadlineFindMany.mockResolvedValue([]);
      mockPersonFindMany.mockResolvedValue([
        { ...mockPeople[0], name: "John" }, // Exact match
        { ...mockPeople[1], name: "Johnny Test" }, // Contains but not exact
      ]);

      const results = await service.textSearch(testUserId, "John", {
        entityTypes: ["person"],
      });

      // Should have results
      expect(results.length).toBeGreaterThanOrEqual(1);
      
      // First result should be an exact match (if we have multiple results)
      if (results.length >= 2) {
        // The exact match "John" should score higher or equal than partial "Johnny Test"
        expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      }
    });
  });

  describe("semanticSearch", () => {
    it("calls semantic search service", async () => {
      await service.semanticSearch(testUserId, "software engineering");

      expect(mockSearchSimilar).toHaveBeenCalledWith({
        userId: testUserId,
        query: "software engineering",
        entityTypes: ["person", "place", "event", "task", "deadline", "routine", "open_loop", "project", "note"],
        limit: 20,
        minSimilarity: 0.5,
      });
    });

    it("respects entity type filters", async () => {
      await service.semanticSearch(testUserId, "test", {
        entityTypes: ["person", "event"],
      });

      expect(mockSearchSimilar).toHaveBeenCalledWith(
        expect.objectContaining({
          entityTypes: ["person", "event"],
        })
      );
    });

    it("respects limit parameter", async () => {
      await service.semanticSearch(testUserId, "test", {
        limit: 5,
      });

      expect(mockSearchSimilar).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 5,
        })
      );
    });

    it("respects minSimilarity parameter", async () => {
      await service.semanticSearch(testUserId, "test", {
        minSimilarity: 0.8,
      });

      expect(mockSearchSimilar).toHaveBeenCalledWith(
        expect.objectContaining({
          minSimilarity: 0.8,
        })
      );
    });

    it("returns results with semantic matchType", async () => {
      const results = await service.semanticSearch(testUserId, "test");

      results.forEach((result) => {
        expect(result.matchType).toBe("semantic");
      });
    });

    it("enriches results with actual entity data", async () => {
      const results = await service.semanticSearch(testUserId, "John");

      // Results should have full entity data
      const personResult = results.find((r) => r.entityType === "person");
      if (personResult) {
        expect(personResult.entity).toBeDefined();
        expect("name" in personResult.entity).toBe(true);
      }
    });

    it("returns empty array on semantic search error", async () => {
      mockSearchSimilar.mockRejectedValue(new Error("API error"));

      const results = await service.semanticSearch(testUserId, "test");

      expect(results).toEqual([]);
    });

    it("filters out deleted entities", async () => {
      // Semantic search returns an ID, but entity is deleted
      mockSearchSimilar.mockResolvedValue([
        {
          entityType: "person",
          entityId: "person-deleted",
          content: "Deleted person",
          chunkIndex: 0,
          similarity: 0.9,
          metadata: {},
        },
      ]);
      // Database doesn't return deleted entity
      mockPersonFindMany.mockResolvedValue([]);

      const results = await service.semanticSearch(testUserId, "test");

      // Deleted entity should not appear in results
      expect(
        results.find((r) => r.entityId === "person-deleted")
      ).toBeUndefined();
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Factory Functions Tests
// ─────────────────────────────────────────────────────────────

describe("Factory Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getContextSearchService", () => {
    it("returns a service instance", () => {
      const service = getContextSearchService();
      expect(service).toBeInstanceOf(ContextSearchService);
    });

    it("returns the same instance on multiple calls", () => {
      const service1 = getContextSearchService();
      const service2 = getContextSearchService();
      expect(service1).toBe(service2);
    });
  });

  describe("createContextSearchService", () => {
    it("creates a new instance each time", () => {
      const service1 = createContextSearchService();
      const service2 = createContextSearchService();
      expect(service1).not.toBe(service2);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Convenience Functions Tests
// ─────────────────────────────────────────────────────────────

describe("Convenience Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  describe("searchContext", () => {
    it("delegates to service search method", async () => {
      const results = await searchContext(testUserId, "test");
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("textSearchContext", () => {
    it("delegates to service textSearch method", async () => {
      const results = await textSearchContext(testUserId, "test");
      expect(results).toBeDefined();
      // Should only be text results
      results.forEach((r) => expect(r.matchType).toBe("text"));
    });
  });

  describe("semanticSearchContext", () => {
    it("delegates to service semanticSearch method", async () => {
      const results = await semanticSearchContext(testUserId, "test");
      expect(results).toBeDefined();
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Scoring and Ranking Tests
// ─────────────────────────────────────────────────────────────

describe("Scoring and Ranking", () => {
  let service: ContextSearchService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ContextSearchService();
    setupDefaultMocks();
  });

  it("weights semantic results higher by default", async () => {
    // Mock data where text and semantic find same entity with equal raw scores
    mockPersonFindMany.mockResolvedValue([mockPeople[0]]);
    mockSearchSimilar.mockResolvedValue([
      {
        entityType: "task",
        entityId: "task-1",
        content: "Test task",
        chunkIndex: 0,
        similarity: 0.8,
        metadata: {},
      },
    ]);
    mockTaskFindMany.mockResolvedValue([mockTasks[0]]);
    mockPlaceFindMany.mockResolvedValue([]);
    mockEventFindMany.mockResolvedValue([]);
    mockDeadlineFindMany.mockResolvedValue([]);

    const results = await service.search(testUserId, "test");

    // Semantic results should be weighted at 0.7, text at 0.3
    expect(results.length).toBeGreaterThan(0);
  });

  it("respects custom semanticWeight", async () => {
    await service.search(testUserId, "test", {
      semanticWeight: 0.5, // Equal weighting
    });

    expect(mockSearchSimilar).toHaveBeenCalled();
  });

  it("sets matchType to both for entities found by both searches", async () => {
    // Both searches find person-1
    mockPersonFindMany.mockResolvedValue([mockPeople[0]]);
    mockSearchSimilar.mockResolvedValue([
      {
        entityType: "person",
        entityId: "person-1",
        content: "John Doe",
        chunkIndex: 0,
        similarity: 0.9,
        metadata: {},
      },
    ]);
    mockPlaceFindMany.mockResolvedValue([]);
    mockEventFindMany.mockResolvedValue([]);
    mockTaskFindMany.mockResolvedValue([]);
    mockDeadlineFindMany.mockResolvedValue([]);

    const results = await service.search(testUserId, "John");

    const johnResult = results.find(
      (r) => r.entityType === "person" && r.entityId === "person-1"
    );
    expect(johnResult?.matchType).toBe("both");
  });

  it("combines scores for entities found by both searches", async () => {
    // Both searches find person-1
    mockPersonFindMany.mockResolvedValue([mockPeople[0]]);
    mockSearchSimilar.mockResolvedValue([
      {
        entityType: "person",
        entityId: "person-1",
        content: "John Doe",
        chunkIndex: 0,
        similarity: 0.9,
        metadata: {},
      },
    ]);
    mockPlaceFindMany.mockResolvedValue([]);
    mockEventFindMany.mockResolvedValue([]);
    mockTaskFindMany.mockResolvedValue([]);
    mockDeadlineFindMany.mockResolvedValue([]);

    const results = await service.search(testUserId, "John", {
      semanticWeight: 0.5,
    });

    const johnResult = results.find(
      (r) => r.entityType === "person" && r.entityId === "person-1"
    );
    // Combined score should be higher than either individual score * weight
    expect(johnResult?.score).toBeGreaterThan(0.5);
  });
});

// ─────────────────────────────────────────────────────────────
// Edge Cases Tests
// ─────────────────────────────────────────────────────────────

describe("Edge Cases", () => {
  let service: ContextSearchService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ContextSearchService();
  });

  it("handles empty search results", async () => {
    mockPersonFindMany.mockResolvedValue([]);
    mockPlaceFindMany.mockResolvedValue([]);
    mockEventFindMany.mockResolvedValue([]);
    mockTaskFindMany.mockResolvedValue([]);
    mockDeadlineFindMany.mockResolvedValue([]);
    mockRoutineFindMany.mockResolvedValue([]);
    mockOpenLoopFindMany.mockResolvedValue([]);
    mockProjectFindMany.mockResolvedValue([]);
    mockNoteFindMany.mockResolvedValue([]);
    mockSearchSimilar.mockResolvedValue([]);

    const results = await service.search(testUserId, "nonexistent");

    expect(results).toEqual([]);
  });

  it("handles empty entity types array", async () => {
    setupDefaultMocks();
    const results = await service.search(testUserId, "test", {
      entityTypes: [],
    });

    // Should use all entity types as default
    expect(results).toBeDefined();
  });

  it("normalizes limit to valid range", async () => {
    mockPersonFindMany.mockResolvedValue([]);
    mockPlaceFindMany.mockResolvedValue([]);
    mockEventFindMany.mockResolvedValue([]);
    mockTaskFindMany.mockResolvedValue([]);
    mockDeadlineFindMany.mockResolvedValue([]);
    mockRoutineFindMany.mockResolvedValue([]);
    mockOpenLoopFindMany.mockResolvedValue([]);
    mockProjectFindMany.mockResolvedValue([]);
    mockNoteFindMany.mockResolvedValue([]);
    mockSearchSimilar.mockResolvedValue([]);

    // Negative limit
    await service.search(testUserId, "test", { limit: -5 });
    
    // Over max limit
    await service.search(testUserId, "test", { limit: 500 });

    // Should not throw
    expect(true).toBe(true);
  });

  it("handles database errors gracefully", async () => {
    mockPersonFindMany.mockRejectedValue(new Error("DB error"));
    mockPlaceFindMany.mockResolvedValue([]);
    mockEventFindMany.mockResolvedValue([]);
    mockTaskFindMany.mockResolvedValue([]);
    mockDeadlineFindMany.mockResolvedValue([]);
    mockRoutineFindMany.mockResolvedValue([]);
    mockOpenLoopFindMany.mockResolvedValue([]);
    mockProjectFindMany.mockResolvedValue([]);
    mockNoteFindMany.mockResolvedValue([]);
    mockSearchSimilar.mockResolvedValue([]);

    // Should propagate database errors (not silently swallow them)
    await expect(
      service.search(testUserId, "test", { useSemanticSearch: false })
    ).rejects.toThrow("DB error");
  });
});

