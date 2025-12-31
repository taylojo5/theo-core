// ═══════════════════════════════════════════════════════════════════════════
// Embedding Integration Tests
// Tests for entity content builders and embedding lifecycle hooks
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  buildPersonContent,
  buildPlaceContent,
  buildEventContent,
  buildTaskContent,
  buildDeadlineContent,
  buildEntityContent,
  storeEntityEmbedding,
  removeEntityEmbedding,
  afterEntityCreate,
  afterEntityUpdate,
  afterEntityDelete,
} from "@/services/context/embedding-integration";
import type { Person, Place, Event, Task, Deadline } from "@prisma/client";

// ─────────────────────────────────────────────────────────────
// Mock Setup
// ─────────────────────────────────────────────────────────────

// Mock the embedding service
vi.mock("@/lib/embeddings", () => ({
  getEmbeddingService: vi.fn(() => ({
    storeEntityEmbedding: vi.fn().mockResolvedValue([]),
  })),
  deleteEmbeddings: vi.fn().mockResolvedValue(undefined),
}));

import { getEmbeddingService, deleteEmbeddings } from "@/lib/embeddings";

// ─────────────────────────────────────────────────────────────
// Test Data Factories
// ─────────────────────────────────────────────────────────────

function createMockPerson(overrides: Partial<Person> = {}): Person {
  return {
    id: "person-1",
    userId: "user-1",
    name: "John Doe",
    email: "john@example.com",
    phone: "+1234567890",
    avatarUrl: null,
    type: "contact",
    importance: 5,
    company: "Acme Corp",
    title: "Software Engineer",
    location: "San Francisco",
    timezone: "America/Los_Angeles",
    bio: "A software engineer passionate about building great products",
    notes: "Met at conference",
    preferences: {},
    source: null,
    sourceId: null,
    metadata: {},
    tags: ["engineering", "conference"],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as Person;
}

function createMockPlace(overrides: Partial<Place> = {}): Place {
  return {
    id: "place-1",
    userId: "user-1",
    name: "Acme Headquarters",
    type: "office",
    address: "123 Main St",
    city: "San Francisco",
    state: "CA",
    country: "USA",
    postalCode: "94102",
    latitude: null,
    longitude: null,
    timezone: "America/Los_Angeles",
    notes: "Main office building",
    importance: 7,
    source: null,
    sourceId: null,
    metadata: {},
    tags: ["office", "headquarters"],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as Place;
}

function createMockEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "event-1",
    userId: "user-1",
    title: "Team Meeting",
    description: "Weekly sync with the team",
    type: "meeting",
    startsAt: new Date("2024-12-20T10:00:00Z"),
    endsAt: new Date("2024-12-20T11:00:00Z"),
    allDay: false,
    timezone: "America/Los_Angeles",
    location: "Conference Room A",
    placeId: null,
    virtualUrl: null,
    status: "confirmed",
    visibility: "private",
    notes: "Bring your laptop",
    importance: 6,
    source: null,
    sourceId: null,
    metadata: {},
    tags: ["team", "weekly"],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as Event;
}

function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    userId: "user-1",
    title: "Complete project proposal",
    description: "Write and submit the Q1 project proposal",
    parentId: null,
    position: 0,
    status: "in_progress",
    priority: "high",
    dueDate: new Date("2024-12-25"),
    startDate: null,
    completedAt: null,
    estimatedMinutes: 120,
    actualMinutes: null,
    notes: "Need to include budget estimates",
    assignedToId: null,
    source: null,
    sourceId: null,
    metadata: {},
    tags: ["q1", "proposal"],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as Task;
}

function createMockDeadline(overrides: Partial<Deadline> = {}): Deadline {
  return {
    id: "deadline-1",
    userId: "user-1",
    title: "Project Submission",
    description: "Final submission deadline for the project",
    type: "deadline",
    dueAt: new Date("2024-12-31T23:59:59Z"),
    reminderAt: new Date("2024-12-30T09:00:00Z"),
    status: "pending",
    importance: 9,
    taskId: null,
    eventId: null,
    notes: "No extensions possible",
    consequences: "Project will be rejected if missed",
    source: null,
    sourceId: null,
    metadata: {},
    tags: ["critical", "project"],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as Deadline;
}

// ─────────────────────────────────────────────────────────────
// Content Builder Tests
// ─────────────────────────────────────────────────────────────

describe("Content Builders", () => {
  describe("buildPersonContent", () => {
    it("should build searchable content from person fields", () => {
      const person = createMockPerson();
      const content = buildPersonContent(person);

      expect(content).toContain("John Doe");
      expect(content).toContain("john@example.com");
      expect(content).toContain("Acme Corp");
      expect(content).toContain("Software Engineer");
      expect(content).toContain("San Francisco");
      expect(content).toContain("passionate about building");
      expect(content).toContain("conference");
      expect(content).toContain("Tags:");
    });

    it("should handle person with minimal fields", () => {
      const person = createMockPerson({
        email: null,
        phone: null,
        company: null,
        title: null,
        bio: null,
        notes: null,
        location: null,
        tags: [],
      });
      const content = buildPersonContent(person);

      expect(content).toContain("John Doe");
      expect(content).toContain("Type: contact");
      expect(content).not.toContain("Tags:");
    });
  });

  describe("buildPlaceContent", () => {
    it("should build searchable content from place fields", () => {
      const place = createMockPlace();
      const content = buildPlaceContent(place);

      expect(content).toContain("Acme Headquarters");
      expect(content).toContain("Type: office");
      expect(content).toContain("123 Main St");
      expect(content).toContain("San Francisco");
      expect(content).toContain("CA");
      expect(content).toContain("USA");
      expect(content).toContain("Main office building");
      expect(content).toContain("Tags:");
    });

    it("should handle place with minimal location info", () => {
      const place = createMockPlace({
        address: null,
        state: null,
        postalCode: null,
        notes: null,
        tags: [],
      });
      const content = buildPlaceContent(place);

      expect(content).toContain("Acme Headquarters");
      expect(content).toContain("San Francisco");
      expect(content).toContain("USA");
    });
  });

  describe("buildEventContent", () => {
    it("should build searchable content from event fields", () => {
      const event = createMockEvent();
      const content = buildEventContent(event);

      expect(content).toContain("Team Meeting");
      expect(content).toContain("Weekly sync with the team");
      expect(content).toContain("Type: meeting");
      expect(content).toContain("Conference Room A");
      expect(content).toContain("Scheduled:");
      expect(content).toContain("Tags:");
    });

    it("should handle event without location or notes", () => {
      const event = createMockEvent({
        location: null,
        notes: null,
        tags: [],
      });
      const content = buildEventContent(event);

      expect(content).toContain("Team Meeting");
      expect(content).toContain("Scheduled:");
      expect(content).not.toContain("Tags:");
    });
  });

  describe("buildTaskContent", () => {
    it("should build searchable content from task fields", () => {
      const task = createMockTask();
      const content = buildTaskContent(task);

      expect(content).toContain("Complete project proposal");
      expect(content).toContain("Q1 project proposal");
      expect(content).toContain("Status: in_progress");
      expect(content).toContain("Priority: high");
      expect(content).toContain("Due:");
      expect(content).toContain("budget estimates");
      expect(content).toContain("Tags:");
    });

    it("should handle task without due date", () => {
      const task = createMockTask({
        dueDate: null,
        notes: null,
        tags: [],
      });
      const content = buildTaskContent(task);

      expect(content).toContain("Complete project proposal");
      expect(content).not.toContain("Due:");
      expect(content).not.toContain("Tags:");
    });
  });

  describe("buildDeadlineContent", () => {
    it("should build searchable content from deadline fields", () => {
      const deadline = createMockDeadline();
      const content = buildDeadlineContent(deadline);

      expect(content).toContain("Project Submission");
      expect(content).toContain("Final submission deadline");
      expect(content).toContain("Type: deadline");
      expect(content).toContain("Due:");
      expect(content).toContain("rejected if missed");
      expect(content).toContain("No extensions possible");
      expect(content).toContain("Tags:");
    });

    it("should handle deadline without consequences or notes", () => {
      const deadline = createMockDeadline({
        consequences: null,
        notes: null,
        tags: [],
      });
      const content = buildDeadlineContent(deadline);

      expect(content).toContain("Project Submission");
      expect(content).toContain("Due:");
      expect(content).not.toContain("Tags:");
    });
  });

  describe("buildEntityContent", () => {
    it("should dispatch to correct content builder based on entity type", () => {
      const person = createMockPerson();
      const place = createMockPlace();
      const event = createMockEvent();
      const task = createMockTask();
      const deadline = createMockDeadline();

      expect(buildEntityContent("person", person)).toContain("John Doe");
      expect(buildEntityContent("place", place)).toContain("Acme Headquarters");
      expect(buildEntityContent("event", event)).toContain("Team Meeting");
      expect(buildEntityContent("task", task)).toContain(
        "Complete project proposal"
      );
      expect(buildEntityContent("deadline", deadline)).toContain(
        "Project Submission"
      );
    });

    it("should throw for unknown entity type", () => {
      const person = createMockPerson();
      expect(() =>
        buildEntityContent("unknown" as unknown as "person", person)
      ).toThrow("Unknown entity type");
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Embedding Operation Tests
// ─────────────────────────────────────────────────────────────

describe("Embedding Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("storeEntityEmbedding", () => {
    it("should store embedding successfully", async () => {
      const mockStoreEntityEmbedding = vi.fn().mockResolvedValue([]);
      (getEmbeddingService as Mock).mockReturnValue({
        storeEntityEmbedding: mockStoreEntityEmbedding,
      });

      const result = await storeEntityEmbedding(
        "user-1",
        "person",
        "person-1",
        "John Doe | john@example.com"
      );

      expect(result.success).toBe(true);
      expect(mockStoreEntityEmbedding).toHaveBeenCalledWith(
        "user-1",
        "person",
        "person-1",
        "John Doe | john@example.com"
      );
    });

    it("should fail gracefully on error", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      (getEmbeddingService as Mock).mockReturnValue({
        storeEntityEmbedding: vi.fn().mockRejectedValue(new Error("API error")),
      });

      const result = await storeEntityEmbedding(
        "user-1",
        "person",
        "person-1",
        "content"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe("API error");
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("removeEntityEmbedding", () => {
    it("should remove embedding successfully", async () => {
      (deleteEmbeddings as Mock).mockResolvedValue(undefined);

      const result = await removeEntityEmbedding(
        "user-1",
        "person",
        "person-1"
      );

      expect(result.success).toBe(true);
      expect(deleteEmbeddings).toHaveBeenCalledWith(
        "user-1",
        "person",
        "person-1"
      );
    });

    it("should fail gracefully on error", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      (deleteEmbeddings as Mock).mockRejectedValue(new Error("Delete error"));

      const result = await removeEntityEmbedding(
        "user-1",
        "person",
        "person-1"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);

      consoleSpy.mockRestore();
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Lifecycle Hook Tests
// ─────────────────────────────────────────────────────────────

describe("Entity Lifecycle Hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("afterEntityCreate", () => {
    it("should generate embedding after entity creation", async () => {
      const mockStoreEntityEmbedding = vi.fn().mockResolvedValue([]);
      (getEmbeddingService as Mock).mockReturnValue({
        storeEntityEmbedding: mockStoreEntityEmbedding,
      });

      const person = createMockPerson();
      const result = await afterEntityCreate(
        "person",
        person,
        buildPersonContent
      );

      expect(result.success).toBe(true);
      expect(mockStoreEntityEmbedding).toHaveBeenCalled();
    });

    it("should skip embedding when skipEmbedding is true", async () => {
      const mockStoreEntityEmbedding = vi.fn();
      (getEmbeddingService as Mock).mockReturnValue({
        storeEntityEmbedding: mockStoreEntityEmbedding,
      });

      const person = createMockPerson();
      const result = await afterEntityCreate(
        "person",
        person,
        buildPersonContent,
        { skipEmbedding: true }
      );

      expect(result.success).toBe(true);
      expect(mockStoreEntityEmbedding).not.toHaveBeenCalled();
    });
  });

  describe("afterEntityUpdate", () => {
    it("should update embedding after entity update", async () => {
      const mockStoreEntityEmbedding = vi.fn().mockResolvedValue([]);
      (getEmbeddingService as Mock).mockReturnValue({
        storeEntityEmbedding: mockStoreEntityEmbedding,
      });

      const person = createMockPerson({ name: "Updated Name" });
      const result = await afterEntityUpdate(
        "person",
        person,
        buildPersonContent
      );

      expect(result.success).toBe(true);
      expect(mockStoreEntityEmbedding).toHaveBeenCalled();
    });
  });

  describe("afterEntityDelete", () => {
    it("should remove embedding after entity deletion", async () => {
      (deleteEmbeddings as Mock).mockResolvedValue(undefined);

      const result = await afterEntityDelete("person", "user-1", "person-1");

      expect(result.success).toBe(true);
      expect(deleteEmbeddings).toHaveBeenCalledWith(
        "user-1",
        "person",
        "person-1"
      );
    });

    it("should skip deletion when skipEmbedding is true", async () => {
      const result = await afterEntityDelete("person", "user-1", "person-1", {
        skipEmbedding: true,
      });

      expect(result.success).toBe(true);
      expect(deleteEmbeddings).not.toHaveBeenCalled();
    });
  });
});
