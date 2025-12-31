// ═══════════════════════════════════════════════════════════════════════════
// Relationships Service - Unit Tests
// Tests for EntityRelationship CRUD operations
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// Mock the db module before importing the service
vi.mock("@/lib/db", () => ({
  db: {
    entityRelationship: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    person: {
      findFirst: vi.fn(),
    },
    place: {
      findFirst: vi.fn(),
    },
    event: {
      findFirst: vi.fn(),
    },
    task: {
      findFirst: vi.fn(),
    },
    deadline: {
      findFirst: vi.fn(),
    },
  },
}));

// Mock the audit service
vi.mock("@/services/audit", () => ({
  logAuditEntry: vi.fn(),
}));

import { db } from "@/lib/db";
import { logAuditEntry } from "@/services/audit";
import {
  createRelationship,
  getRelationshipById,
  updateRelationship,
  deleteRelationship,
  restoreRelationship,
  listRelationships,
  getRelationshipsFor,
  getRelatedEntities,
  findRelationshipBetween,
  relationshipExists,
  syncRelationships,
  createManyRelationships,
  deleteRelationshipsForEntity,
  RelationshipsServiceError,
} from "@/services/context/relationships";
import type {
  EntityRelationship,
  CreateRelationshipInput,
} from "@/services/context/relationships";
import type { Person } from "@prisma/client";

// ─────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────

const mockUserId = "user-123";
const mockRelationshipId = "rel-456";
const mockPersonId1 = "person-1";
const mockPersonId2 = "person-2";
const mockPlaceId = "place-1";

const mockRelationship: EntityRelationship = {
  id: mockRelationshipId,
  userId: mockUserId,
  sourceType: "person",
  sourceId: mockPersonId1,
  targetType: "person",
  targetId: mockPersonId2,
  relationship: "works_with",
  strength: 5,
  bidirectional: true,
  notes: "Colleagues at Acme",
  metadata: {},
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  deletedAt: null,
};

const mockPerson1: Person = {
  id: mockPersonId1,
  userId: mockUserId,
  name: "John Doe",
  email: "john@example.com",
  phone: null,
  avatarUrl: null,
  type: "colleague",
  importance: 5,
  company: "Acme Inc",
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
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  deletedAt: null,
};

const mockPerson2: Person = {
  ...mockPerson1,
  id: mockPersonId2,
  name: "Jane Smith",
  email: "jane@example.com",
};

const mockCreateInput: CreateRelationshipInput = {
  sourceType: "person",
  sourceId: mockPersonId1,
  targetType: "person",
  targetId: mockPersonId2,
  relationship: "works_with",
  strength: 5,
  bidirectional: true,
};

// ─────────────────────────────────────────────────────────────
// Create Relationship Tests
// ─────────────────────────────────────────────────────────────

// Helper to setup person mocks
function setupPersonMocks() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (db.person.findFirst as any).mockImplementation(async (args: any) => {
    const where = args?.where as { id?: string } | undefined;
    if (where?.id === mockPersonId1) return mockPerson1;
    if (where?.id === mockPersonId2) return mockPerson2;
    return null;
  });
}

describe("createRelationship", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // By default, entities exist
    setupPersonMocks();
  });

  it("creates a relationship with valid input", async () => {
    vi.mocked(db.entityRelationship.create).mockResolvedValue(mockRelationship);

    const result = await createRelationship(mockUserId, mockCreateInput);

    expect(result).toEqual(mockRelationship);
    expect(db.entityRelationship.create).toHaveBeenCalledTimes(1);
    expect(logAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockUserId,
        actionType: "create",
        actionCategory: "context",
        entityType: "relationship",
        entityId: mockRelationshipId,
      })
    );
  });

  it("validates entity types", async () => {
    await expect(
      createRelationship(mockUserId, {
        ...mockCreateInput,
        sourceType: "invalid" as "person",
      })
    ).rejects.toThrow(RelationshipsServiceError);

    await expect(
      createRelationship(mockUserId, {
        ...mockCreateInput,
        sourceType: "invalid" as "person",
      })
    ).rejects.toMatchObject({
      code: "INVALID_ENTITY_TYPE",
    });
  });

  it("prevents self-referential relationships", async () => {
    await expect(
      createRelationship(mockUserId, {
        ...mockCreateInput,
        targetId: mockPersonId1, // Same as sourceId
      })
    ).rejects.toThrow(RelationshipsServiceError);

    await expect(
      createRelationship(mockUserId, {
        ...mockCreateInput,
        targetId: mockPersonId1,
      })
    ).rejects.toMatchObject({
      code: "SELF_RELATIONSHIP",
    });
  });

  it("verifies source entity exists", async () => {
    vi.mocked(db.person.findFirst).mockResolvedValue(null);

    await expect(
      createRelationship(mockUserId, mockCreateInput)
    ).rejects.toMatchObject({
      code: "ENTITY_NOT_FOUND",
    });
  });

  it("verifies target entity exists", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db.person.findFirst as any).mockImplementation(async (args: any) => {
      const where = args?.where as { id?: string } | undefined;
      if (where?.id === mockPersonId1) return mockPerson1;
      return null; // Target not found
    });

    await expect(
      createRelationship(mockUserId, mockCreateInput)
    ).rejects.toMatchObject({
      code: "ENTITY_NOT_FOUND",
    });
  });

  it("validates strength range", async () => {
    vi.mocked(db.entityRelationship.create).mockResolvedValue({
      ...mockRelationship,
      strength: 10,
    });

    await createRelationship(mockUserId, {
      ...mockCreateInput,
      strength: 15, // Over max
    });

    expect(db.entityRelationship.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          strength: 10, // Clamped to max
        }),
      })
    );
  });

  it("handles duplicate relationship constraint violation", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      {
        code: "P2002",
        clientVersion: "5.0.0",
        meta: {
          target: [
            "userId",
            "sourceType",
            "sourceId",
            "targetType",
            "targetId",
            "relationship",
          ],
        },
      }
    );
    vi.mocked(db.entityRelationship.create).mockRejectedValue(prismaError);

    await expect(
      createRelationship(mockUserId, mockCreateInput)
    ).rejects.toThrow(RelationshipsServiceError);
    await expect(
      createRelationship(mockUserId, mockCreateInput)
    ).rejects.toMatchObject({
      code: "RELATIONSHIP_ALREADY_EXISTS",
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Get Relationship By ID Tests
// ─────────────────────────────────────────────────────────────

describe("getRelationshipById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns relationship when found", async () => {
    vi.mocked(db.entityRelationship.findFirst).mockResolvedValue(
      mockRelationship
    );

    const result = await getRelationshipById(mockUserId, mockRelationshipId);

    expect(result).toEqual(mockRelationship);
    expect(db.entityRelationship.findFirst).toHaveBeenCalledWith({
      where: {
        id: mockRelationshipId,
        userId: mockUserId,
        deletedAt: null,
      },
    });
  });

  it("returns null when relationship not found", async () => {
    vi.mocked(db.entityRelationship.findFirst).mockResolvedValue(null);

    const result = await getRelationshipById(mockUserId, "nonexistent");

    expect(result).toBeNull();
  });

  it("excludes soft-deleted relationships", async () => {
    vi.mocked(db.entityRelationship.findFirst).mockResolvedValue(null);

    await getRelationshipById(mockUserId, mockRelationshipId);

    expect(db.entityRelationship.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
        }),
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────
// Update Relationship Tests
// ─────────────────────────────────────────────────────────────

describe("updateRelationship", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates relationship with valid input", async () => {
    vi.mocked(db.entityRelationship.findFirst).mockResolvedValue(
      mockRelationship
    );
    const updatedRelationship = {
      ...mockRelationship,
      relationship: "manages",
      strength: 8,
    };
    vi.mocked(db.entityRelationship.update).mockResolvedValue(
      updatedRelationship
    );

    const result = await updateRelationship(mockUserId, mockRelationshipId, {
      relationship: "manages",
      strength: 8,
    });

    expect(result.relationship).toBe("manages");
    expect(result.strength).toBe(8);
    expect(logAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "update",
        entityType: "relationship",
      })
    );
  });

  it("throws error when relationship not found", async () => {
    vi.mocked(db.entityRelationship.findFirst).mockResolvedValue(null);

    await expect(
      updateRelationship(mockUserId, "nonexistent", { strength: 5 })
    ).rejects.toThrow(RelationshipsServiceError);
    await expect(
      updateRelationship(mockUserId, "nonexistent", { strength: 5 })
    ).rejects.toMatchObject({
      code: "RELATIONSHIP_NOT_FOUND",
    });
  });

  it("validates strength on update", async () => {
    vi.mocked(db.entityRelationship.findFirst).mockResolvedValue(
      mockRelationship
    );
    vi.mocked(db.entityRelationship.update).mockResolvedValue({
      ...mockRelationship,
      strength: 1,
    });

    await updateRelationship(mockUserId, mockRelationshipId, {
      strength: -5, // Below min
    });

    expect(db.entityRelationship.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          strength: 1, // Clamped to min
        }),
      })
    );
  });

  it("updates bidirectional flag", async () => {
    vi.mocked(db.entityRelationship.findFirst).mockResolvedValue(
      mockRelationship
    );
    vi.mocked(db.entityRelationship.update).mockResolvedValue({
      ...mockRelationship,
      bidirectional: false,
    });

    const result = await updateRelationship(mockUserId, mockRelationshipId, {
      bidirectional: false,
    });

    expect(result.bidirectional).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// Delete Relationship Tests
// ─────────────────────────────────────────────────────────────

describe("deleteRelationship", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("soft deletes relationship", async () => {
    vi.mocked(db.entityRelationship.findFirst).mockResolvedValue(
      mockRelationship
    );
    vi.mocked(db.entityRelationship.update).mockResolvedValue({
      ...mockRelationship,
      deletedAt: new Date(),
    });

    await deleteRelationship(mockUserId, mockRelationshipId);

    expect(db.entityRelationship.update).toHaveBeenCalledWith({
      where: { id: mockRelationshipId },
      data: { deletedAt: expect.any(Date) },
    });
    expect(logAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "delete",
        entityType: "relationship",
      })
    );
  });

  it("throws error when relationship not found", async () => {
    vi.mocked(db.entityRelationship.findFirst).mockResolvedValue(null);

    await expect(
      deleteRelationship(mockUserId, "nonexistent")
    ).rejects.toMatchObject({
      code: "RELATIONSHIP_NOT_FOUND",
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Restore Relationship Tests
// ─────────────────────────────────────────────────────────────

describe("restoreRelationship", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restores soft-deleted relationship", async () => {
    const deletedRelationship = {
      ...mockRelationship,
      deletedAt: new Date(),
    };
    vi.mocked(db.entityRelationship.findFirst).mockResolvedValue(
      deletedRelationship
    );
    vi.mocked(db.entityRelationship.update).mockResolvedValue({
      ...mockRelationship,
      deletedAt: null,
    });

    const result = await restoreRelationship(mockUserId, mockRelationshipId);

    expect(result.deletedAt).toBeNull();
    expect(db.entityRelationship.update).toHaveBeenCalledWith({
      where: { id: mockRelationshipId },
      data: { deletedAt: null },
    });
  });

  it("throws error when deleted relationship not found", async () => {
    vi.mocked(db.entityRelationship.findFirst).mockResolvedValue(null);

    await expect(
      restoreRelationship(mockUserId, "nonexistent")
    ).rejects.toMatchObject({
      code: "RELATIONSHIP_NOT_FOUND",
    });
  });
});

// ─────────────────────────────────────────────────────────────
// List Relationships Tests
// ─────────────────────────────────────────────────────────────

describe("listRelationships", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated results", async () => {
    const relationships = [
      mockRelationship,
      { ...mockRelationship, id: "rel-789" },
    ];
    vi.mocked(db.entityRelationship.findMany).mockResolvedValue(relationships);

    const result = await listRelationships(mockUserId, { limit: 10 });

    expect(result.items).toHaveLength(2);
    expect(result.hasMore).toBe(false);
  });

  it("indicates more results when exceeds limit", async () => {
    const relationships = Array(11)
      .fill(null)
      .map((_, i) => ({ ...mockRelationship, id: `rel-${i}` }));
    vi.mocked(db.entityRelationship.findMany).mockResolvedValue(relationships);

    const result = await listRelationships(mockUserId, { limit: 10 });

    expect(result.items).toHaveLength(10);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe("rel-9");
  });

  it("filters by source type and ID", async () => {
    vi.mocked(db.entityRelationship.findMany).mockResolvedValue([]);

    await listRelationships(mockUserId, {
      sourceType: "person",
      sourceId: mockPersonId1,
    });

    expect(db.entityRelationship.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sourceType: "person",
          sourceId: mockPersonId1,
        }),
      })
    );
  });

  it("filters by target type and ID", async () => {
    vi.mocked(db.entityRelationship.findMany).mockResolvedValue([]);

    await listRelationships(mockUserId, {
      targetType: "person",
      targetId: mockPersonId2,
    });

    expect(db.entityRelationship.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          targetType: "person",
          targetId: mockPersonId2,
        }),
      })
    );
  });

  it("filters by relationship type", async () => {
    vi.mocked(db.entityRelationship.findMany).mockResolvedValue([]);

    await listRelationships(mockUserId, { relationship: "works_with" });

    expect(db.entityRelationship.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          relationship: "works_with",
        }),
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────
// Get Relationships For Entity Tests
// ─────────────────────────────────────────────────────────────

describe("getRelationshipsFor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all relationships for an entity", async () => {
    const relationships = [
      mockRelationship,
      {
        ...mockRelationship,
        id: "rel-2",
        targetType: "place",
        targetId: mockPlaceId,
      },
    ];
    vi.mocked(db.entityRelationship.findMany).mockResolvedValue(relationships);

    const result = await getRelationshipsFor(
      mockUserId,
      "person",
      mockPersonId1
    );

    expect(result).toHaveLength(2);
  });

  it("filters by relationship types", async () => {
    vi.mocked(db.entityRelationship.findMany).mockResolvedValue([]);

    await getRelationshipsFor(mockUserId, "person", mockPersonId1, {
      relationshipTypes: ["works_with", "manages"],
    });

    expect(db.entityRelationship.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          relationship: { in: ["works_with", "manages"] },
        }),
      })
    );
  });

  it("filters by minimum strength", async () => {
    vi.mocked(db.entityRelationship.findMany).mockResolvedValue([]);

    await getRelationshipsFor(mockUserId, "person", mockPersonId1, {
      minStrength: 7,
    });

    expect(db.entityRelationship.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          strength: { gte: 7 },
        }),
      })
    );
  });

  it("validates entity type", async () => {
    await expect(
      getRelationshipsFor(mockUserId, "invalid" as "person", mockPersonId1)
    ).rejects.toMatchObject({
      code: "INVALID_ENTITY_TYPE",
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Get Related Entities Tests
// ─────────────────────────────────────────────────────────────

describe("getRelatedEntities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupPersonMocks();
  });

  it("returns related entities with relationship info", async () => {
    vi.mocked(db.entityRelationship.findMany).mockResolvedValue([
      mockRelationship,
    ]);

    const result = await getRelatedEntities<Person>(
      mockUserId,
      "person",
      mockPersonId1,
      "person"
    );

    expect(result).toHaveLength(1);
    expect(result[0].entity.id).toBe(mockPersonId2);
    expect(result[0].relationship.id).toBe(mockRelationshipId);
    expect(result[0].direction).toBe("outgoing");
  });

  it("handles incoming relationships correctly", async () => {
    const incomingRelationship = {
      ...mockRelationship,
      sourceType: "person",
      sourceId: mockPersonId2,
      targetType: "person",
      targetId: mockPersonId1,
      bidirectional: true,
    };
    vi.mocked(db.entityRelationship.findMany).mockResolvedValue([
      incomingRelationship,
    ]);

    const result = await getRelatedEntities<Person>(
      mockUserId,
      "person",
      mockPersonId1,
      "person"
    );

    expect(result).toHaveLength(1);
    expect(result[0].entity.id).toBe(mockPersonId2);
    expect(result[0].direction).toBe("incoming");
  });

  it("filters out relationships with missing entities", async () => {
    vi.mocked(db.entityRelationship.findMany).mockResolvedValue([
      mockRelationship,
    ]);
    vi.mocked(db.person.findFirst).mockResolvedValue(null);

    const result = await getRelatedEntities<Person>(
      mockUserId,
      "person",
      mockPersonId1,
      "person"
    );

    expect(result).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Find Relationship Between Tests
// ─────────────────────────────────────────────────────────────

describe("findRelationshipBetween", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds relationship between two entities", async () => {
    vi.mocked(db.entityRelationship.findFirst).mockResolvedValue(
      mockRelationship
    );

    const result = await findRelationshipBetween(
      mockUserId,
      "person",
      mockPersonId1,
      "person",
      mockPersonId2
    );

    expect(result).toEqual(mockRelationship);
  });

  it("finds relationship with specific type", async () => {
    vi.mocked(db.entityRelationship.findFirst).mockResolvedValue(
      mockRelationship
    );

    await findRelationshipBetween(
      mockUserId,
      "person",
      mockPersonId1,
      "person",
      mockPersonId2,
      "works_with"
    );

    expect(db.entityRelationship.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              relationship: "works_with",
            }),
          ]),
        }),
      })
    );
  });

  it("returns null when no relationship found", async () => {
    vi.mocked(db.entityRelationship.findFirst).mockResolvedValue(null);

    const result = await findRelationshipBetween(
      mockUserId,
      "person",
      mockPersonId1,
      "person",
      "nonexistent"
    );

    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// Relationship Exists Tests
// ─────────────────────────────────────────────────────────────

describe("relationshipExists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when relationship exists", async () => {
    vi.mocked(db.entityRelationship.findFirst).mockResolvedValue(
      mockRelationship
    );

    const result = await relationshipExists(
      mockUserId,
      "person",
      mockPersonId1,
      "person",
      mockPersonId2
    );

    expect(result).toBe(true);
  });

  it("returns false when relationship does not exist", async () => {
    vi.mocked(db.entityRelationship.findFirst).mockResolvedValue(null);

    const result = await relationshipExists(
      mockUserId,
      "person",
      mockPersonId1,
      "person",
      "nonexistent"
    );

    expect(result).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// Sync Relationships Tests
// ─────────────────────────────────────────────────────────────

describe("syncRelationships", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupPersonMocks();
  });

  it("creates new relationships and deletes removed ones", async () => {
    // Existing relationships
    vi.mocked(db.entityRelationship.findMany).mockResolvedValue([
      mockRelationship,
    ]);
    vi.mocked(db.entityRelationship.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(db.entityRelationship.create).mockResolvedValue({
      ...mockRelationship,
      id: "rel-new",
      relationship: "manages",
    });

    const result = await syncRelationships(mockUserId, {
      sourceType: "person",
      sourceId: mockPersonId1,
      relationships: [
        {
          targetType: "person",
          targetId: mockPersonId2,
          relationship: "manages", // Different relationship type = new
        },
      ],
    });

    expect(result.created).toBe(1);
    expect(result.deleted).toBe(1);
  });

  it("skips creating relationships for missing entities", async () => {
    vi.mocked(db.entityRelationship.findMany).mockResolvedValue([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db.person.findFirst as any).mockImplementation(async (args: any) => {
      const where = args?.where as { id?: string } | undefined;
      if (where?.id === mockPersonId1) return mockPerson1;
      return null; // Target not found
    });

    const result = await syncRelationships(mockUserId, {
      sourceType: "person",
      sourceId: mockPersonId1,
      relationships: [
        {
          targetType: "person",
          targetId: "nonexistent",
          relationship: "works_with",
        },
      ],
    });

    expect(result.created).toBe(0);
    expect(result.deleted).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Create Many Relationships Tests
// ─────────────────────────────────────────────────────────────

describe("createManyRelationships", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupPersonMocks();
  });

  it("creates multiple relationships", async () => {
    vi.mocked(db.entityRelationship.create)
      .mockResolvedValueOnce(mockRelationship)
      .mockResolvedValueOnce({ ...mockRelationship, id: "rel-2" });

    const result = await createManyRelationships(mockUserId, [
      mockCreateInput,
      { ...mockCreateInput, relationship: "manages" },
    ]);

    expect(result).toHaveLength(2);
  });

  it("skips duplicates silently", async () => {
    vi.mocked(db.entityRelationship.create)
      .mockResolvedValueOnce(mockRelationship)
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "5.0.0",
          meta: { target: [] },
        })
      );

    const result = await createManyRelationships(mockUserId, [
      mockCreateInput,
      mockCreateInput, // Duplicate
    ]);

    expect(result).toHaveLength(1);
  });

  it("skips missing entities silently", async () => {
    vi.mocked(db.person.findFirst).mockResolvedValue(null);

    const result = await createManyRelationships(mockUserId, [mockCreateInput]);

    expect(result).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Delete Relationships For Entity Tests
// ─────────────────────────────────────────────────────────────

describe("deleteRelationshipsForEntity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes all relationships for an entity", async () => {
    const relationships = [
      mockRelationship,
      { ...mockRelationship, id: "rel-2" },
    ];
    vi.mocked(db.entityRelationship.findMany).mockResolvedValue(relationships);
    vi.mocked(db.entityRelationship.updateMany).mockResolvedValue({ count: 2 });

    const result = await deleteRelationshipsForEntity(
      mockUserId,
      "person",
      mockPersonId1
    );

    expect(result).toBe(2);
    expect(db.entityRelationship.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["rel-456", "rel-2"] },
      },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it("returns 0 when no relationships found", async () => {
    vi.mocked(db.entityRelationship.findMany).mockResolvedValue([]);

    const result = await deleteRelationshipsForEntity(
      mockUserId,
      "person",
      "nonexistent"
    );

    expect(result).toBe(0);
    expect(db.entityRelationship.updateMany).not.toHaveBeenCalled();
  });

  it("validates entity type", async () => {
    await expect(
      deleteRelationshipsForEntity(mockUserId, "invalid" as "person", "123")
    ).rejects.toMatchObject({
      code: "INVALID_ENTITY_TYPE",
    });
  });
});

// ─────────────────────────────────────────────────────────────
// RelationshipsServiceError Tests
// ─────────────────────────────────────────────────────────────

describe("RelationshipsServiceError", () => {
  it("creates error with code and message", () => {
    const error = new RelationshipsServiceError(
      "RELATIONSHIP_NOT_FOUND",
      "Relationship not found"
    );

    expect(error.code).toBe("RELATIONSHIP_NOT_FOUND");
    expect(error.message).toBe("Relationship not found");
    expect(error.name).toBe("RelationshipsServiceError");
  });

  it("includes optional details", () => {
    const error = new RelationshipsServiceError(
      "ENTITY_NOT_FOUND",
      "Entity not found",
      { entityType: "person", entityId: "123" }
    );

    expect(error.details).toEqual({ entityType: "person", entityId: "123" });
  });
});
