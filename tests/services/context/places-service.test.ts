// ═══════════════════════════════════════════════════════════════════════════
// Places Service - Unit Tests
// Tests for Place entity CRUD operations
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// Mock the db module before importing the service
vi.mock("@/lib/db", () => ({
  db: {
    place: {
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
  createPlace,
  getPlaceById,
  updatePlace,
  deletePlace,
  restorePlace,
  listPlaces,
  findPlaceBySource,
  searchPlaces,
  findPlacesByCity,
  findPlacesNearby,
  upsertPlacesFromSource,
  PlacesServiceError,
} from "@/services/context/places";
import type {
  CreatePlaceInput,
  UpdatePlaceInput,
  Place,
} from "@/services/context/places";

// ─────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────

const mockUserId = "user-123";
const mockPlaceId = "place-456";

const mockPlace: Place = {
  id: mockPlaceId,
  userId: mockUserId,
  name: "Acme Office",
  type: "office",
  address: "123 Main St",
  city: "New York",
  state: "NY",
  country: "USA",
  postalCode: "10001",
  latitude: new Prisma.Decimal(40.7128),
  longitude: new Prisma.Decimal(-74.006),
  timezone: "America/New_York",
  notes: "Main headquarters",
  importance: 8,
  source: "manual",
  sourceId: null,
  sourceSyncedAt: null,
  metadata: {},
  tags: ["headquarters", "office"],
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  deletedAt: null,
};

const mockCreateInput: CreatePlaceInput = {
  name: "Acme Office",
  type: "office",
  address: "123 Main St",
  city: "New York",
  state: "NY",
  country: "USA",
  source: "manual",
  tags: ["headquarters"],
};

// ─────────────────────────────────────────────────────────────
// Create Place Tests
// ─────────────────────────────────────────────────────────────

describe("createPlace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a place with valid input", async () => {
    vi.mocked(db.place.create).mockResolvedValue(mockPlace);

    const result = await createPlace(mockUserId, mockCreateInput);

    expect(result).toEqual(mockPlace);
    expect(db.place.create).toHaveBeenCalledTimes(1);
    expect(logAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockUserId,
        actionType: "create",
        actionCategory: "context",
        entityType: "place",
        entityId: mockPlaceId,
      })
    );
  });

  it("normalizes tags", async () => {
    vi.mocked(db.place.create).mockResolvedValue(mockPlace);

    await createPlace(mockUserId, {
      ...mockCreateInput,
      tags: ["Headquarters", "OFFICE", "headquarters"],
    });

    expect(db.place.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tags: ["headquarters", "office"],
        }),
      })
    );
  });

  it("validates importance range", async () => {
    vi.mocked(db.place.create).mockResolvedValue(mockPlace);

    await createPlace(mockUserId, {
      ...mockCreateInput,
      importance: 15,
    });

    expect(db.place.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          importance: 10,
        }),
      })
    );
  });

  it("throws error for invalid latitude", async () => {
    await expect(
      createPlace(mockUserId, {
        ...mockCreateInput,
        latitude: 100, // Invalid: > 90
      })
    ).rejects.toThrow(PlacesServiceError);

    await expect(
      createPlace(mockUserId, {
        ...mockCreateInput,
        latitude: 100,
      })
    ).rejects.toMatchObject({
      code: "INVALID_COORDINATES",
    });
  });

  it("throws error for invalid longitude", async () => {
    await expect(
      createPlace(mockUserId, {
        ...mockCreateInput,
        longitude: 200, // Invalid: > 180
      })
    ).rejects.toMatchObject({
      code: "INVALID_COORDINATES",
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
    vi.mocked(db.place.create).mockRejectedValue(prismaError);

    await expect(
      createPlace(mockUserId, {
        ...mockCreateInput,
        source: "calendar",
        sourceId: "123",
      })
    ).rejects.toMatchObject({
      code: "DUPLICATE_SOURCE_ID",
    });
  });

  it("stores coordinates as Decimal", async () => {
    vi.mocked(db.place.create).mockResolvedValue(mockPlace);

    await createPlace(mockUserId, {
      ...mockCreateInput,
      latitude: 40.7128,
      longitude: -74.006,
    });

    expect(db.place.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          latitude: expect.any(Prisma.Decimal),
          longitude: expect.any(Prisma.Decimal),
        }),
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────
// Get Place By ID Tests
// ─────────────────────────────────────────────────────────────

describe("getPlaceById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns place when found", async () => {
    vi.mocked(db.place.findFirst).mockResolvedValue(mockPlace);

    const result = await getPlaceById(mockUserId, mockPlaceId);

    expect(result).toEqual(mockPlace);
    expect(db.place.findFirst).toHaveBeenCalledWith({
      where: {
        id: mockPlaceId,
        userId: mockUserId,
        deletedAt: null,
      },
    });
  });

  it("returns null when place not found", async () => {
    vi.mocked(db.place.findFirst).mockResolvedValue(null);

    const result = await getPlaceById(mockUserId, "nonexistent");

    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// Update Place Tests
// ─────────────────────────────────────────────────────────────

describe("updatePlace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates place with valid input", async () => {
    vi.mocked(db.place.findFirst).mockResolvedValue(mockPlace);
    const updatedPlace = { ...mockPlace, name: "New Office" };
    vi.mocked(db.place.update).mockResolvedValue(updatedPlace);

    const updateInput: UpdatePlaceInput = { name: "New Office" };
    const result = await updatePlace(mockUserId, mockPlaceId, updateInput);

    expect(result.name).toBe("New Office");
    expect(logAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "update",
        entityType: "place",
      })
    );
  });

  it("throws error when place not found", async () => {
    vi.mocked(db.place.findFirst).mockResolvedValue(null);

    await expect(
      updatePlace(mockUserId, "nonexistent", { name: "Test" })
    ).rejects.toMatchObject({
      code: "PLACE_NOT_FOUND",
    });
  });

  it("validates coordinates on update", async () => {
    vi.mocked(db.place.findFirst).mockResolvedValue(mockPlace);

    await expect(
      updatePlace(mockUserId, mockPlaceId, { latitude: -100 })
    ).rejects.toMatchObject({
      code: "INVALID_COORDINATES",
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Delete Place Tests
// ─────────────────────────────────────────────────────────────

describe("deletePlace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("soft deletes place", async () => {
    vi.mocked(db.place.findFirst).mockResolvedValue(mockPlace);
    vi.mocked(db.place.update).mockResolvedValue({
      ...mockPlace,
      deletedAt: new Date(),
    });

    await deletePlace(mockUserId, mockPlaceId);

    expect(db.place.update).toHaveBeenCalledWith({
      where: { id: mockPlaceId },
      data: { deletedAt: expect.any(Date) },
    });
    expect(logAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "delete",
        entityType: "place",
      })
    );
  });

  it("throws error when place not found", async () => {
    vi.mocked(db.place.findFirst).mockResolvedValue(null);

    await expect(deletePlace(mockUserId, "nonexistent")).rejects.toMatchObject({
      code: "PLACE_NOT_FOUND",
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Restore Place Tests
// ─────────────────────────────────────────────────────────────

describe("restorePlace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restores soft-deleted place", async () => {
    const deletedPlace = { ...mockPlace, deletedAt: new Date() };
    vi.mocked(db.place.findFirst).mockResolvedValue(deletedPlace);
    vi.mocked(db.place.update).mockResolvedValue({
      ...mockPlace,
      deletedAt: null,
    });

    const result = await restorePlace(mockUserId, mockPlaceId);

    expect(result.deletedAt).toBeNull();
    expect(db.place.update).toHaveBeenCalledWith({
      where: { id: mockPlaceId },
      data: { deletedAt: null },
    });
  });

  it("throws error when deleted place not found", async () => {
    vi.mocked(db.place.findFirst).mockResolvedValue(null);

    await expect(restorePlace(mockUserId, "nonexistent")).rejects.toMatchObject(
      {
        code: "PLACE_NOT_FOUND",
      }
    );
  });
});

// ─────────────────────────────────────────────────────────────
// List Places Tests
// ─────────────────────────────────────────────────────────────

describe("listPlaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated results", async () => {
    const places = [mockPlace, { ...mockPlace, id: "place-789" }];
    vi.mocked(db.place.findMany).mockResolvedValue(places);

    const result = await listPlaces(mockUserId, { limit: 10 });

    expect(result.items).toHaveLength(2);
    expect(result.hasMore).toBe(false);
  });

  it("indicates more results when exceeds limit", async () => {
    const places = Array(11)
      .fill(null)
      .map((_, i) => ({ ...mockPlace, id: `place-${i}` }));
    vi.mocked(db.place.findMany).mockResolvedValue(places);

    const result = await listPlaces(mockUserId, { limit: 10 });

    expect(result.items).toHaveLength(10);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe("place-9");
  });

  it("filters by type", async () => {
    vi.mocked(db.place.findMany).mockResolvedValue([]);

    await listPlaces(mockUserId, { type: "office" });

    expect(db.place.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "office",
        }),
      })
    );
  });

  it("filters by city", async () => {
    vi.mocked(db.place.findMany).mockResolvedValue([]);

    await listPlaces(mockUserId, { city: "New York" });

    expect(db.place.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          city: { contains: "New York", mode: "insensitive" },
        }),
      })
    );
  });

  it("filters by country", async () => {
    vi.mocked(db.place.findMany).mockResolvedValue([]);

    await listPlaces(mockUserId, { country: "USA" });

    expect(db.place.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          country: { contains: "USA", mode: "insensitive" },
        }),
      })
    );
  });

  it("filters by tags", async () => {
    vi.mocked(db.place.findMany).mockResolvedValue([]);

    await listPlaces(mockUserId, { tags: ["headquarters", "office"] });

    expect(db.place.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tags: { hasSome: ["headquarters", "office"] },
        }),
      })
    );
  });

  it("searches across multiple fields", async () => {
    vi.mocked(db.place.findMany).mockResolvedValue([]);

    await listPlaces(mockUserId, { search: "acme" });

    expect(db.place.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: "acme", mode: "insensitive" } },
            { address: { contains: "acme", mode: "insensitive" } },
            { city: { contains: "acme", mode: "insensitive" } },
            { country: { contains: "acme", mode: "insensitive" } },
          ],
        }),
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────
// Find By Source Tests
// ─────────────────────────────────────────────────────────────

describe("findPlaceBySource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds place by source and sourceId", async () => {
    const calendarPlace = {
      ...mockPlace,
      source: "calendar",
      sourceId: "cal-123",
    };
    vi.mocked(db.place.findFirst).mockResolvedValue(calendarPlace);

    const result = await findPlaceBySource(mockUserId, "calendar", "cal-123");

    expect(result).toEqual(calendarPlace);
    expect(db.place.findFirst).toHaveBeenCalledWith({
      where: {
        userId: mockUserId,
        source: "calendar",
        sourceId: "cal-123",
        deletedAt: null,
      },
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Search Places Tests
// ─────────────────────────────────────────────────────────────

describe("searchPlaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("searches across multiple fields", async () => {
    vi.mocked(db.place.findMany).mockResolvedValue([mockPlace]);

    const result = await searchPlaces(mockUserId, "office");

    expect(result).toHaveLength(1);
    expect(db.place.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { name: { contains: "office", mode: "insensitive" } },
            { city: { contains: "office", mode: "insensitive" } },
          ]),
        }),
      })
    );
  });

  it("respects limit option", async () => {
    vi.mocked(db.place.findMany).mockResolvedValue([]);

    await searchPlaces(mockUserId, "test", { limit: 5 });

    expect(db.place.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────
// Find By City Tests
// ─────────────────────────────────────────────────────────────

describe("findPlacesByCity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds places by city name", async () => {
    vi.mocked(db.place.findMany).mockResolvedValue([mockPlace]);

    const result = await findPlacesByCity(mockUserId, "New York");

    expect(result).toHaveLength(1);
    expect(db.place.findMany).toHaveBeenCalledWith({
      where: {
        userId: mockUserId,
        city: { contains: "New York", mode: "insensitive" },
        deletedAt: null,
      },
      orderBy: { name: "asc" },
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Find Nearby Tests
// ─────────────────────────────────────────────────────────────

describe("findPlacesNearby", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds places within radius", async () => {
    vi.mocked(db.place.findMany).mockResolvedValue([mockPlace]);

    const result = await findPlacesNearby(mockUserId, 40.7128, -74.006, 10);

    expect(result).toHaveLength(1);
    expect(db.place.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          latitude: expect.objectContaining({
            gte: expect.any(Prisma.Decimal),
            lte: expect.any(Prisma.Decimal),
          }),
          longitude: expect.objectContaining({
            gte: expect.any(Prisma.Decimal),
            lte: expect.any(Prisma.Decimal),
          }),
        }),
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────
// Upsert From Source Tests
// ─────────────────────────────────────────────────────────────

describe("upsertPlacesFromSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates new places when not found", async () => {
    vi.mocked(db.place.findFirst).mockResolvedValue(null);
    vi.mocked(db.place.create).mockResolvedValue(mockPlace);

    const result = await upsertPlacesFromSource(mockUserId, "calendar", [
      {
        sourceId: "cal-123",
        data: { name: "Office", city: "New York" },
      },
    ]);

    expect(result.created).toHaveLength(1);
    expect(result.updated).toHaveLength(0);
    expect(result.unchanged).toBe(0);
  });

  it("updates existing places when data changed", async () => {
    const existingPlace = {
      ...mockPlace,
      source: "calendar",
      sourceId: "cal-123",
    };
    vi.mocked(db.place.findFirst).mockResolvedValue(existingPlace);
    vi.mocked(db.place.update).mockResolvedValue({
      ...existingPlace,
      name: "New Office",
    });

    const result = await upsertPlacesFromSource(mockUserId, "calendar", [
      {
        sourceId: "cal-123",
        data: { name: "New Office" },
      },
    ]);

    expect(result.created).toHaveLength(0);
    expect(result.updated).toHaveLength(1);
    expect(result.unchanged).toBe(0);
  });

  it("counts unchanged places", async () => {
    const existingPlace = {
      ...mockPlace,
      source: "calendar",
      sourceId: "cal-123",
      address: null,
      city: null,
      country: null,
    };
    vi.mocked(db.place.findFirst).mockResolvedValue(existingPlace);

    const result = await upsertPlacesFromSource(mockUserId, "calendar", [
      {
        sourceId: "cal-123",
        data: { name: "Acme Office" },
      },
    ]);

    expect(result.created).toHaveLength(0);
    expect(result.updated).toHaveLength(0);
    expect(result.unchanged).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────
// PlacesServiceError Tests
// ─────────────────────────────────────────────────────────────

describe("PlacesServiceError", () => {
  it("creates error with code and message", () => {
    const error = new PlacesServiceError("PLACE_NOT_FOUND", "Place not found");

    expect(error.code).toBe("PLACE_NOT_FOUND");
    expect(error.message).toBe("Place not found");
    expect(error.name).toBe("PlacesServiceError");
  });

  it("includes optional details", () => {
    const error = new PlacesServiceError("INVALID_COORDINATES", "Bad coords", {
      latitude: 100,
    });

    expect(error.details).toEqual({ latitude: 100 });
  });
});
