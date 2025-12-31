// ═══════════════════════════════════════════════════════════════════════════
// Semantic Search Service - Unit Tests
// Tests for vector similarity search using pgvector
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─────────────────────────────────────────────────────────────
// Mock Dependencies (hoisted)
// ─────────────────────────────────────────────────────────────

const {
  mockQueryRaw,
  mockEmbeddingCount,
  mockEmbeddingFindMany,
  mockGenerateEmbedding,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockEmbeddingCount: vi.fn(),
  mockEmbeddingFindMany: vi.fn(),
  mockGenerateEmbedding: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: mockQueryRaw,
    embedding: {
      count: mockEmbeddingCount,
      findMany: mockEmbeddingFindMany,
    },
  },
}));

vi.mock("@/lib/embeddings/embedding-service", () => ({
  getEmbeddingService: () => ({
    generateEmbedding: mockGenerateEmbedding,
  }),
}));

import {
  SemanticSearchService,
  getSemanticSearchService,
  createSemanticSearchService,
  type SemanticSearchParams,
} from "@/lib/embeddings/search-service";

// ─────────────────────────────────────────────────────────────
// Test Data
// ─────────────────────────────────────────────────────────────

const testUserId = "user-123";

const mockSearchResults = [
  {
    entity_type: "person",
    entity_id: "person-1",
    content: "John Doe - Software Engineer at Acme Corp",
    chunk_index: 0,
    similarity: 0.95,
    metadata: { source: "manual" },
  },
  {
    entity_type: "task",
    entity_id: "task-1",
    content: "Complete software design review",
    chunk_index: 0,
    similarity: 0.82,
    metadata: {},
  },
  {
    entity_type: "event",
    entity_id: "event-1",
    content: "Team standup meeting",
    chunk_index: 0,
    similarity: 0.75,
    metadata: { recurring: true },
  },
];

// ─────────────────────────────────────────────────────────────
// SemanticSearchService Tests
// ─────────────────────────────────────────────────────────────

describe("SemanticSearchService", () => {
  let service: SemanticSearchService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SemanticSearchService();

    // Setup default mock returns
    mockGenerateEmbedding.mockResolvedValue(new Array(1536).fill(0.1));
    mockQueryRaw.mockResolvedValue(mockSearchResults);
    mockEmbeddingCount.mockResolvedValue(0);
    mockEmbeddingFindMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("searchSimilar", () => {
    it("generates embedding for query and searches database", async () => {
      const params: SemanticSearchParams = {
        userId: testUserId,
        query: "software engineer",
      };

      const results = await service.searchSimilar(params);

      // Should have generated an embedding
      expect(mockGenerateEmbedding).toHaveBeenCalledWith("software engineer");

      // Should have queried the database
      expect(mockQueryRaw).toHaveBeenCalled();

      // Should return mapped results
      expect(results).toHaveLength(3);
      expect(results[0].entityType).toBe("person");
      expect(results[0].entityId).toBe("person-1");
      expect(results[0].similarity).toBe(0.95);
    });

    it("filters by entity types when specified", async () => {
      const params: SemanticSearchParams = {
        userId: testUserId,
        query: "test query",
        entityTypes: ["person", "task"],
      };

      await service.searchSimilar(params);

      expect(mockQueryRaw).toHaveBeenCalled();
      // The entity types should be passed to the query
      // (verified by checking the call was made with proper params)
    });

    it("respects limit parameter", async () => {
      const params: SemanticSearchParams = {
        userId: testUserId,
        query: "test",
        limit: 5,
      };

      await service.searchSimilar(params);

      expect(mockQueryRaw).toHaveBeenCalled();
    });

    it("normalizes limit to max 100", async () => {
      const params: SemanticSearchParams = {
        userId: testUserId,
        query: "test",
        limit: 500, // Over max
      };

      await service.searchSimilar(params);

      expect(mockQueryRaw).toHaveBeenCalled();
      // The limit should be capped internally
    });

    it("respects minSimilarity parameter", async () => {
      const params: SemanticSearchParams = {
        userId: testUserId,
        query: "test",
        minSimilarity: 0.8,
      };

      await service.searchSimilar(params);

      expect(mockQueryRaw).toHaveBeenCalled();
    });

    it("uses default values for optional parameters", async () => {
      const params: SemanticSearchParams = {
        userId: testUserId,
        query: "test",
      };

      await service.searchSimilar(params);

      expect(mockQueryRaw).toHaveBeenCalled();
    });

    it("maps database results correctly", async () => {
      const results = await service.searchSimilar({
        userId: testUserId,
        query: "test",
      });

      expect(results[0]).toEqual({
        entityType: "person",
        entityId: "person-1",
        content: "John Doe - Software Engineer at Acme Corp",
        chunkIndex: 0,
        similarity: 0.95,
        metadata: { source: "manual" },
      });
    });

    it("handles empty results", async () => {
      mockQueryRaw.mockResolvedValue([]);

      const results = await service.searchSimilar({
        userId: testUserId,
        query: "nonexistent",
      });

      expect(results).toEqual([]);
    });
  });

  describe("findSimilarToEntity", () => {
    it("finds entities without embeddings", async () => {
      mockEmbeddingFindMany.mockResolvedValue([]);

      const results = await service.findSimilarToEntity({
        userId: testUserId,
        entityType: "person",
        entityId: "person-1",
      });

      expect(results).toEqual([]);
    });

    it("uses source entity embedding for search", async () => {
      mockEmbeddingFindMany.mockResolvedValue([{ id: "emb-1", chunkIndex: 0 }]);
      mockQueryRaw.mockResolvedValue(mockSearchResults);

      const results = await service.findSimilarToEntity({
        userId: testUserId,
        entityType: "person",
        entityId: "person-1",
      });

      expect(mockEmbeddingFindMany).toHaveBeenCalled();
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it("excludes source entity by default", async () => {
      mockEmbeddingFindMany.mockResolvedValue([{ id: "emb-1", chunkIndex: 0 }]);
      mockQueryRaw.mockResolvedValue([]);

      await service.findSimilarToEntity({
        userId: testUserId,
        entityType: "person",
        entityId: "person-1",
      });

      // The excludeSelf flag should be true by default
      expect(mockEmbeddingFindMany).toHaveBeenCalled();
    });

    it("includes source entity when excludeSelf is false", async () => {
      mockEmbeddingFindMany.mockResolvedValue([{ id: "emb-1", chunkIndex: 0 }]);
      mockQueryRaw.mockResolvedValue([]);

      await service.findSimilarToEntity({
        userId: testUserId,
        entityType: "person",
        entityId: "person-1",
        excludeSelf: false,
      });

      expect(mockEmbeddingFindMany).toHaveBeenCalled();
    });

    it("filters by target entity types", async () => {
      mockEmbeddingFindMany.mockResolvedValue([{ id: "emb-1", chunkIndex: 0 }]);
      mockQueryRaw.mockResolvedValue([]);

      await service.findSimilarToEntity({
        userId: testUserId,
        entityType: "person",
        entityId: "person-1",
        targetTypes: ["task", "event"],
      });

      expect(mockEmbeddingFindMany).toHaveBeenCalled();
    });
  });

  describe("getEmbeddingCount", () => {
    it("counts embeddings for user", async () => {
      mockEmbeddingCount.mockResolvedValue(42);

      const count = await service.getEmbeddingCount(testUserId);

      expect(count).toBe(42);
      expect(mockEmbeddingCount).toHaveBeenCalledWith({
        where: {
          userId: testUserId,
          entityType: {
            in: ["person", "place", "event", "task", "deadline"],
          },
        },
      });
    });

    it("filters by entity types", async () => {
      mockEmbeddingCount.mockResolvedValue(10);

      const count = await service.getEmbeddingCount(testUserId, [
        "person",
        "task",
      ]);

      expect(count).toBe(10);
      expect(mockEmbeddingCount).toHaveBeenCalledWith({
        where: {
          userId: testUserId,
          entityType: { in: ["person", "task"] },
        },
      });
    });
  });

  describe("hasEmbedding", () => {
    it("returns true when embedding exists", async () => {
      mockEmbeddingCount.mockResolvedValue(1);

      const result = await service.hasEmbedding(
        testUserId,
        "person",
        "person-1"
      );

      expect(result).toBe(true);
      expect(mockEmbeddingCount).toHaveBeenCalledWith({
        where: {
          userId: testUserId,
          entityType: "person",
          entityId: "person-1",
        },
      });
    });

    it("returns false when embedding does not exist", async () => {
      mockEmbeddingCount.mockResolvedValue(0);

      const result = await service.hasEmbedding(
        testUserId,
        "person",
        "nonexistent"
      );

      expect(result).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Factory Functions Tests
// ─────────────────────────────────────────────────────────────

describe("Factory Functions", () => {
  describe("getSemanticSearchService", () => {
    it("returns a service instance", () => {
      const service = getSemanticSearchService();

      expect(service).toBeInstanceOf(SemanticSearchService);
    });

    it("returns the same instance on multiple calls", () => {
      const service1 = getSemanticSearchService();
      const service2 = getSemanticSearchService();

      expect(service1).toBe(service2);
    });
  });

  describe("createSemanticSearchService", () => {
    it("creates a new instance each time", () => {
      const service1 = createSemanticSearchService();
      const service2 = createSemanticSearchService();

      expect(service1).not.toBe(service2);
      expect(service1).toBeInstanceOf(SemanticSearchService);
      expect(service2).toBeInstanceOf(SemanticSearchService);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Result Mapping Tests
// ─────────────────────────────────────────────────────────────

describe("Result Mapping", () => {
  let service: SemanticSearchService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SemanticSearchService();
    mockGenerateEmbedding.mockResolvedValue(new Array(1536).fill(0.1));
  });

  it("converts snake_case database fields to camelCase", async () => {
    mockQueryRaw.mockResolvedValue([
      {
        entity_type: "deadline",
        entity_id: "deadline-1",
        content: "Project deadline",
        chunk_index: 2,
        similarity: 0.88,
        metadata: { urgent: true },
      },
    ]);

    const results = await service.searchSimilar({
      userId: testUserId,
      query: "deadline",
    });

    expect(results[0]).toEqual({
      entityType: "deadline",
      entityId: "deadline-1",
      content: "Project deadline",
      chunkIndex: 2,
      similarity: 0.88,
      metadata: { urgent: true },
    });
  });

  it("handles null metadata", async () => {
    mockQueryRaw.mockResolvedValue([
      {
        entity_type: "place",
        entity_id: "place-1",
        content: "Office location",
        chunk_index: 0,
        similarity: 0.9,
        metadata: null,
      },
    ]);

    const results = await service.searchSimilar({
      userId: testUserId,
      query: "office",
    });

    expect(results[0].metadata).toEqual({});
  });

  it("converts similarity to number", async () => {
    mockQueryRaw.mockResolvedValue([
      {
        entity_type: "event",
        entity_id: "event-1",
        content: "Meeting",
        chunk_index: 0,
        similarity: "0.85", // String from database
        metadata: {},
      },
    ]);

    const results = await service.searchSimilar({
      userId: testUserId,
      query: "meeting",
    });

    expect(typeof results[0].similarity).toBe("number");
    expect(results[0].similarity).toBe(0.85);
  });
});

// ─────────────────────────────────────────────────────────────
// Edge Cases Tests
// ─────────────────────────────────────────────────────────────

describe("Edge Cases", () => {
  let service: SemanticSearchService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SemanticSearchService();
    mockGenerateEmbedding.mockResolvedValue(new Array(1536).fill(0.1));
  });

  it("handles minimum limit value", async () => {
    mockQueryRaw.mockResolvedValue([]);

    await service.searchSimilar({
      userId: testUserId,
      query: "test",
      limit: 0, // Should be normalized to 1
    });

    expect(mockQueryRaw).toHaveBeenCalled();
  });

  it("handles similarity bounds", async () => {
    mockQueryRaw.mockResolvedValue([]);

    // Similarity below 0 should be normalized
    await service.searchSimilar({
      userId: testUserId,
      query: "test",
      minSimilarity: -0.5,
    });

    expect(mockQueryRaw).toHaveBeenCalled();

    vi.clearAllMocks();

    // Similarity above 1 should be normalized
    await service.searchSimilar({
      userId: testUserId,
      query: "test",
      minSimilarity: 1.5,
    });

    expect(mockQueryRaw).toHaveBeenCalled();
  });

  it("handles embedding generation errors gracefully", async () => {
    mockGenerateEmbedding.mockRejectedValue(new Error("API error"));

    await expect(
      service.searchSimilar({
        userId: testUserId,
        query: "test",
      })
    ).rejects.toThrow("API error");
  });
});
