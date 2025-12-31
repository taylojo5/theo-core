// ═══════════════════════════════════════════════════════════════════════════
// People Service - Unit Tests
// Tests for Person entity CRUD operations
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// Mock the db module before importing the service
vi.mock("@/lib/db", () => ({
  db: {
    person: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
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
  createPerson,
  getPersonById,
  updatePerson,
  deletePerson,
  restorePerson,
  listPeople,
  findPersonByEmail,
  findPersonBySource,
  searchPeople,
  upsertPeopleFromSource,
  PeopleServiceError,
} from "@/services/context/people";
import type {
  CreatePersonInput,
  UpdatePersonInput,
  Person,
} from "@/services/context/people";

// ─────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────

const mockUserId = "user-123";
const mockPersonId = "person-456";

const mockPerson: Person = {
  id: mockPersonId,
  userId: mockUserId,
  name: "John Doe",
  email: "john@example.com",
  phone: "+1234567890",
  avatarUrl: null,
  type: "contact",
  importance: 5,
  company: "Acme Inc",
  title: "Engineer",
  location: "New York",
  timezone: "America/New_York",
  bio: "A software engineer",
  notes: "Met at conference",
  preferences: {},
  source: "manual",
  sourceId: null,
  sourceSyncedAt: null,
  metadata: {},
  tags: ["engineering", "conference"],
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  deletedAt: null,
};

const mockCreateInput: CreatePersonInput = {
  name: "John Doe",
  email: "john@example.com",
  phone: "+1234567890",
  company: "Acme Inc",
  title: "Engineer",
  source: "manual",
  tags: ["engineering"],
};

// ─────────────────────────────────────────────────────────────
// Create Person Tests
// ─────────────────────────────────────────────────────────────

describe("createPerson", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a person with valid input", async () => {
    vi.mocked(db.person.create).mockResolvedValue(mockPerson);

    const result = await createPerson(mockUserId, mockCreateInput);

    expect(result).toEqual(mockPerson);
    expect(db.person.create).toHaveBeenCalledTimes(1);
    expect(logAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockUserId,
        actionType: "create",
        actionCategory: "context",
        entityType: "person",
        entityId: mockPersonId,
      })
    );
  });

  it("normalizes email to lowercase", async () => {
    vi.mocked(db.person.create).mockResolvedValue(mockPerson);

    await createPerson(mockUserId, {
      ...mockCreateInput,
      email: "JOHN@EXAMPLE.COM",
    });

    expect(db.person.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "john@example.com",
        }),
      })
    );
  });

  it("normalizes tags", async () => {
    vi.mocked(db.person.create).mockResolvedValue(mockPerson);

    await createPerson(mockUserId, {
      ...mockCreateInput,
      tags: ["Engineering", "CONFERENCE", "engineering"],
    });

    expect(db.person.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tags: ["engineering", "conference"],
        }),
      })
    );
  });

  it("validates importance range", async () => {
    vi.mocked(db.person.create).mockResolvedValue(mockPerson);

    await createPerson(mockUserId, {
      ...mockCreateInput,
      importance: 15, // Over max
    });

    expect(db.person.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          importance: 10, // Clamped to max
        }),
      })
    );
  });

  it("throws error for invalid email format", async () => {
    await expect(
      createPerson(mockUserId, {
        ...mockCreateInput,
        email: "invalid-email",
      })
    ).rejects.toThrow(PeopleServiceError);

    await expect(
      createPerson(mockUserId, {
        ...mockCreateInput,
        email: "invalid-email",
      })
    ).rejects.toMatchObject({
      code: "INVALID_EMAIL",
    });
  });

  it("handles duplicate email constraint violation", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      {
        code: "P2002",
        clientVersion: "5.0.0",
        meta: { target: ["userId", "email"] },
      }
    );
    vi.mocked(db.person.create).mockRejectedValue(prismaError);

    await expect(createPerson(mockUserId, mockCreateInput)).rejects.toThrow(
      PeopleServiceError
    );
    await expect(
      createPerson(mockUserId, mockCreateInput)
    ).rejects.toMatchObject({
      code: "DUPLICATE_EMAIL",
    });
  });

  it("handles duplicate sourceId constraint violation", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      {
        code: "P2002",
        clientVersion: "5.0.0",
        meta: { target: ["userId", "source", "sourceId"] },
      }
    );
    vi.mocked(db.person.create).mockRejectedValue(prismaError);

    await expect(
      createPerson(mockUserId, {
        ...mockCreateInput,
        source: "gmail",
        sourceId: "123",
      })
    ).rejects.toMatchObject({
      code: "DUPLICATE_SOURCE_ID",
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Get Person By ID Tests
// ─────────────────────────────────────────────────────────────

describe("getPersonById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns person when found", async () => {
    vi.mocked(db.person.findFirst).mockResolvedValue(mockPerson);

    const result = await getPersonById(mockUserId, mockPersonId);

    expect(result).toEqual(mockPerson);
    expect(db.person.findFirst).toHaveBeenCalledWith({
      where: {
        id: mockPersonId,
        userId: mockUserId,
        deletedAt: null,
      },
    });
  });

  it("returns null when person not found", async () => {
    vi.mocked(db.person.findFirst).mockResolvedValue(null);

    const result = await getPersonById(mockUserId, "nonexistent");

    expect(result).toBeNull();
  });

  it("excludes soft-deleted persons", async () => {
    vi.mocked(db.person.findFirst).mockResolvedValue(null);

    await getPersonById(mockUserId, mockPersonId);

    expect(db.person.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
        }),
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────
// Update Person Tests
// ─────────────────────────────────────────────────────────────

describe("updatePerson", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates person with valid input", async () => {
    vi.mocked(db.person.findFirst).mockResolvedValue(mockPerson);
    const updatedPerson = { ...mockPerson, name: "Jane Doe" };
    vi.mocked(db.person.update).mockResolvedValue(updatedPerson);

    const updateInput: UpdatePersonInput = { name: "Jane Doe" };
    const result = await updatePerson(mockUserId, mockPersonId, updateInput);

    expect(result.name).toBe("Jane Doe");
    expect(logAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "update",
        entityType: "person",
      })
    );
  });

  it("throws error when person not found", async () => {
    vi.mocked(db.person.findFirst).mockResolvedValue(null);

    await expect(
      updatePerson(mockUserId, "nonexistent", { name: "Test" })
    ).rejects.toThrow(PeopleServiceError);
    await expect(
      updatePerson(mockUserId, "nonexistent", { name: "Test" })
    ).rejects.toMatchObject({
      code: "PERSON_NOT_FOUND",
    });
  });

  it("validates email on update", async () => {
    vi.mocked(db.person.findFirst).mockResolvedValue(mockPerson);

    await expect(
      updatePerson(mockUserId, mockPersonId, { email: "invalid" })
    ).rejects.toMatchObject({
      code: "INVALID_EMAIL",
    });
  });

  it("normalizes email on update", async () => {
    vi.mocked(db.person.findFirst).mockResolvedValue(mockPerson);
    vi.mocked(db.person.update).mockResolvedValue({
      ...mockPerson,
      email: "new@example.com",
    });

    await updatePerson(mockUserId, mockPersonId, { email: "NEW@EXAMPLE.COM" });

    expect(db.person.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "new@example.com",
        }),
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────
// Delete Person Tests
// ─────────────────────────────────────────────────────────────

describe("deletePerson", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("soft deletes person", async () => {
    vi.mocked(db.person.findFirst).mockResolvedValue(mockPerson);
    vi.mocked(db.person.update).mockResolvedValue({
      ...mockPerson,
      deletedAt: new Date(),
    });

    await deletePerson(mockUserId, mockPersonId);

    expect(db.person.update).toHaveBeenCalledWith({
      where: { id: mockPersonId },
      data: { deletedAt: expect.any(Date) },
    });
    expect(logAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "delete",
        entityType: "person",
      })
    );
  });

  it("throws error when person not found", async () => {
    vi.mocked(db.person.findFirst).mockResolvedValue(null);

    await expect(deletePerson(mockUserId, "nonexistent")).rejects.toMatchObject(
      {
        code: "PERSON_NOT_FOUND",
      }
    );
  });
});

// ─────────────────────────────────────────────────────────────
// Restore Person Tests
// ─────────────────────────────────────────────────────────────

describe("restorePerson", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restores soft-deleted person", async () => {
    const deletedPerson = { ...mockPerson, deletedAt: new Date() };
    vi.mocked(db.person.findFirst).mockResolvedValue(deletedPerson);
    vi.mocked(db.person.update).mockResolvedValue({
      ...mockPerson,
      deletedAt: null,
    });

    const result = await restorePerson(mockUserId, mockPersonId);

    expect(result.deletedAt).toBeNull();
    expect(db.person.update).toHaveBeenCalledWith({
      where: { id: mockPersonId },
      data: { deletedAt: null },
    });
  });

  it("throws error when deleted person not found", async () => {
    vi.mocked(db.person.findFirst).mockResolvedValue(null);

    await expect(
      restorePerson(mockUserId, "nonexistent")
    ).rejects.toMatchObject({
      code: "PERSON_NOT_FOUND",
    });
  });
});

// ─────────────────────────────────────────────────────────────
// List People Tests
// ─────────────────────────────────────────────────────────────

describe("listPeople", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated results", async () => {
    const people = [mockPerson, { ...mockPerson, id: "person-789" }];
    vi.mocked(db.person.findMany).mockResolvedValue(people);

    const result = await listPeople(mockUserId, { limit: 10 });

    expect(result.items).toHaveLength(2);
    expect(result.hasMore).toBe(false);
  });

  it("indicates more results when exceeds limit", async () => {
    const people = Array(11)
      .fill(null)
      .map((_, i) => ({ ...mockPerson, id: `person-${i}` }));
    vi.mocked(db.person.findMany).mockResolvedValue(people);

    const result = await listPeople(mockUserId, { limit: 10 });

    expect(result.items).toHaveLength(10);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe("person-9");
  });

  it("filters by type", async () => {
    vi.mocked(db.person.findMany).mockResolvedValue([]);

    await listPeople(mockUserId, { type: "colleague" });

    expect(db.person.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "colleague",
        }),
      })
    );
  });

  it("filters by company", async () => {
    vi.mocked(db.person.findMany).mockResolvedValue([]);

    await listPeople(mockUserId, { company: "Acme" });

    expect(db.person.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          company: { contains: "Acme", mode: "insensitive" },
        }),
      })
    );
  });

  it("filters by minimum importance", async () => {
    vi.mocked(db.person.findMany).mockResolvedValue([]);

    await listPeople(mockUserId, { minImportance: 7 });

    expect(db.person.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          importance: { gte: 7 },
        }),
      })
    );
  });

  it("filters by tags", async () => {
    vi.mocked(db.person.findMany).mockResolvedValue([]);

    await listPeople(mockUserId, { tags: ["engineering", "lead"] });

    expect(db.person.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tags: { hasSome: ["engineering", "lead"] },
        }),
      })
    );
  });

  it("searches across multiple fields", async () => {
    vi.mocked(db.person.findMany).mockResolvedValue([]);

    await listPeople(mockUserId, { search: "john" });

    expect(db.person.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: "john", mode: "insensitive" } },
            { email: { contains: "john", mode: "insensitive" } },
            { company: { contains: "john", mode: "insensitive" } },
            { title: { contains: "john", mode: "insensitive" } },
          ],
        }),
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────
// Find By Email Tests
// ─────────────────────────────────────────────────────────────

describe("findPersonByEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds person by normalized email", async () => {
    vi.mocked(db.person.findFirst).mockResolvedValue(mockPerson);

    const result = await findPersonByEmail(mockUserId, "JOHN@EXAMPLE.COM");

    expect(result).toEqual(mockPerson);
    expect(db.person.findFirst).toHaveBeenCalledWith({
      where: {
        userId: mockUserId,
        email: "john@example.com",
        deletedAt: null,
      },
    });
  });

  it("returns null when not found", async () => {
    vi.mocked(db.person.findFirst).mockResolvedValue(null);

    const result = await findPersonByEmail(mockUserId, "notfound@example.com");

    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// Find By Source Tests
// ─────────────────────────────────────────────────────────────

describe("findPersonBySource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds person by source and sourceId", async () => {
    const gmailPerson = {
      ...mockPerson,
      source: "gmail",
      sourceId: "gmail-123",
    };
    vi.mocked(db.person.findFirst).mockResolvedValue(gmailPerson);

    const result = await findPersonBySource(mockUserId, "gmail", "gmail-123");

    expect(result).toEqual(gmailPerson);
    expect(db.person.findFirst).toHaveBeenCalledWith({
      where: {
        userId: mockUserId,
        source: "gmail",
        sourceId: "gmail-123",
        deletedAt: null,
      },
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Search People Tests
// ─────────────────────────────────────────────────────────────

describe("searchPeople", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("searches across multiple fields", async () => {
    vi.mocked(db.person.findMany).mockResolvedValue([mockPerson]);

    const result = await searchPeople(mockUserId, "john");

    expect(result).toHaveLength(1);
    expect(db.person.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { name: { contains: "john", mode: "insensitive" } },
            { email: { contains: "john", mode: "insensitive" } },
          ]),
        }),
      })
    );
  });

  it("respects limit option", async () => {
    vi.mocked(db.person.findMany).mockResolvedValue([]);

    await searchPeople(mockUserId, "test", { limit: 5 });

    expect(db.person.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
      })
    );
  });

  it("can include deleted persons", async () => {
    vi.mocked(db.person.findMany).mockResolvedValue([]);

    await searchPeople(mockUserId, "test", { includeDeleted: true });

    expect(db.person.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({
          deletedAt: null,
        }),
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────
// Upsert From Source Tests
// ─────────────────────────────────────────────────────────────

describe("upsertPeopleFromSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates new persons when not found", async () => {
    vi.mocked(db.person.findFirst).mockResolvedValue(null);
    vi.mocked(db.person.create).mockResolvedValue(mockPerson);

    const result = await upsertPeopleFromSource(mockUserId, "gmail", [
      {
        sourceId: "gmail-123",
        data: { name: "John Doe", email: "john@example.com" },
      },
    ]);

    expect(result.created).toHaveLength(1);
    expect(result.updated).toHaveLength(0);
    expect(result.unchanged).toBe(0);
  });

  it("updates existing persons when data changed", async () => {
    const existingPerson = {
      ...mockPerson,
      source: "gmail",
      sourceId: "gmail-123",
    };
    vi.mocked(db.person.findFirst).mockResolvedValue(existingPerson);
    vi.mocked(db.person.update).mockResolvedValue({
      ...existingPerson,
      name: "Jane Doe",
    });

    const result = await upsertPeopleFromSource(mockUserId, "gmail", [
      {
        sourceId: "gmail-123",
        data: { name: "Jane Doe", email: "john@example.com" }, // Name changed
      },
    ]);

    expect(result.created).toHaveLength(0);
    expect(result.updated).toHaveLength(1);
    expect(result.unchanged).toBe(0);
  });

  it("counts unchanged persons", async () => {
    // Create a person that exactly matches what will be compared
    const existingPerson = {
      ...mockPerson,
      source: "gmail",
      sourceId: "gmail-123",
      phone: null, // Must match the undefined in data (normalized to null)
      company: null, // Must match the undefined in data (normalized to null)
      title: null, // Must match the undefined in data (normalized to null)
    };
    vi.mocked(db.person.findFirst).mockResolvedValue(existingPerson);

    const result = await upsertPeopleFromSource(mockUserId, "gmail", [
      {
        sourceId: "gmail-123",
        // Data matches existingPerson exactly (undefined fields normalize to null)
        data: { name: "John Doe", email: "john@example.com" },
      },
    ]);

    expect(result.created).toHaveLength(0);
    expect(result.updated).toHaveLength(0);
    expect(result.unchanged).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────
// PeopleServiceError Tests
// ─────────────────────────────────────────────────────────────

describe("PeopleServiceError", () => {
  it("creates error with code and message", () => {
    const error = new PeopleServiceError(
      "PERSON_NOT_FOUND",
      "Person not found"
    );

    expect(error.code).toBe("PERSON_NOT_FOUND");
    expect(error.message).toBe("Person not found");
    expect(error.name).toBe("PeopleServiceError");
  });

  it("includes optional details", () => {
    const error = new PeopleServiceError("DUPLICATE_EMAIL", "Email exists", {
      email: "test@example.com",
    });

    expect(error.details).toEqual({ email: "test@example.com" });
  });
});
