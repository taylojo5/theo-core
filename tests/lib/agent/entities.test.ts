// ═══════════════════════════════════════════════════════════════════════════
// Entity Resolution Tests
// Tests for entity matching, disambiguation, and resolution
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  // Matchers
  normalizeString,
  normalizeName,
  extractNameParts,
  levenshteinDistance,
  levenshteinSimilarity,
  jaroWinklerSimilarity,
  containsMatch,
  partialMatchScore,
  nameSimilarity,
  couldBeNickname,
  extractEmailUsername,
  nameMatchesEmail,
  textSimilarity,
  rankCandidates,
  generateDisambiguationQuestion,
  generateNotFoundMessage,
  // Resolver
  EntityResolver,
  createEntityResolver,
  DEFAULT_RESOLVER_CONFIG,
  // Types
  type ResolutionCandidate,
} from "@/lib/agent/entities";

// ─────────────────────────────────────────────────────────────
// String Normalization Tests
// ─────────────────────────────────────────────────────────────

describe("String Normalization", () => {
  describe("normalizeString", () => {
    it("should lowercase and trim", () => {
      expect(normalizeString("  Hello World  ")).toBe("hello world");
    });

    it("should collapse multiple spaces", () => {
      expect(normalizeString("hello   world")).toBe("hello world");
    });

    it("should remove diacritics", () => {
      expect(normalizeString("café")).toBe("cafe");
      expect(normalizeString("naïve")).toBe("naive");
      expect(normalizeString("Müller")).toBe("muller");
    });

    it("should handle empty strings", () => {
      expect(normalizeString("")).toBe("");
      expect(normalizeString("   ")).toBe("");
    });
  });

  describe("normalizeName", () => {
    it("should remove common titles", () => {
      expect(normalizeName("Dr. John Smith")).toBe("john smith");
      expect(normalizeName("Mr. James Bond")).toBe("james bond");
      expect(normalizeName("Prof. Einstein")).toBe("einstein");
    });

    it("should handle names without titles", () => {
      expect(normalizeName("Alice Johnson")).toBe("alice johnson");
    });

    it("should handle case variations", () => {
      expect(normalizeName("DR. JOHN SMITH")).toBe("john smith");
    });
  });

  describe("extractNameParts", () => {
    it("should extract first and last name", () => {
      const result = extractNameParts("John Smith");
      expect(result.first).toBe("john");
      expect(result.last).toBe("smith");
      expect(result.middle).toEqual([]);
    });

    it("should extract middle names", () => {
      const result = extractNameParts("John Paul Smith");
      expect(result.first).toBe("john");
      expect(result.middle).toEqual(["paul"]);
      expect(result.last).toBe("smith");
    });

    it("should handle single name", () => {
      const result = extractNameParts("Madonna");
      expect(result.first).toBe("madonna");
      expect(result.last).toBe("");
      expect(result.middle).toEqual([]);
    });

    it("should handle empty string", () => {
      const result = extractNameParts("");
      expect(result.first).toBe("");
      expect(result.last).toBe("");
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Similarity Algorithm Tests
// ─────────────────────────────────────────────────────────────

describe("Similarity Algorithms", () => {
  describe("levenshteinDistance", () => {
    it("should return 0 for identical strings", () => {
      expect(levenshteinDistance("hello", "hello")).toBe(0);
    });

    it("should calculate single character difference", () => {
      expect(levenshteinDistance("hello", "hallo")).toBe(1);
      expect(levenshteinDistance("cat", "bat")).toBe(1);
    });

    it("should calculate insertions/deletions", () => {
      expect(levenshteinDistance("hello", "ello")).toBe(1);
      expect(levenshteinDistance("hello", "helloo")).toBe(1);
    });

    it("should handle empty strings", () => {
      expect(levenshteinDistance("", "hello")).toBe(5);
      expect(levenshteinDistance("hello", "")).toBe(5);
      expect(levenshteinDistance("", "")).toBe(0);
    });
  });

  describe("levenshteinSimilarity", () => {
    it("should return 1 for identical strings", () => {
      expect(levenshteinSimilarity("hello", "hello")).toBe(1);
    });

    it("should return high similarity for similar strings", () => {
      expect(levenshteinSimilarity("hello", "hallo")).toBeGreaterThanOrEqual(0.8);
    });

    it("should return low similarity for different strings", () => {
      expect(levenshteinSimilarity("hello", "world")).toBeLessThan(0.4);
    });

    it("should be case-insensitive", () => {
      expect(levenshteinSimilarity("Hello", "HELLO")).toBe(1);
    });
  });

  describe("jaroWinklerSimilarity", () => {
    it("should return 1 for identical strings", () => {
      expect(jaroWinklerSimilarity("hello", "hello")).toBe(1);
    });

    it("should boost common prefix", () => {
      // Jaro-Winkler boosts similarity when strings share common prefix
      const jw1 = jaroWinklerSimilarity("hello", "helpo");
      const jw2 = jaroWinklerSimilarity("hello", "xelpo");
      expect(jw1).toBeGreaterThan(jw2);
    });

    it("should handle transpositions", () => {
      expect(jaroWinklerSimilarity("martha", "marhta")).toBeGreaterThan(0.9);
    });

    it("should be case-insensitive", () => {
      expect(jaroWinklerSimilarity("John", "JOHN")).toBe(1);
    });
  });

  describe("containsMatch", () => {
    it("should find substring matches", () => {
      expect(containsMatch("john", "john smith")).toBe(true);
      expect(containsMatch("smith", "john smith")).toBe(true);
    });

    it("should be case-insensitive", () => {
      expect(containsMatch("JOHN", "john smith")).toBe(true);
    });

    it("should return false for non-matches", () => {
      expect(containsMatch("jane", "john smith")).toBe(false);
    });
  });

  describe("partialMatchScore", () => {
    it("should return higher score for more complete matches", () => {
      const score1 = partialMatchScore("john", "john");
      const score2 = partialMatchScore("john", "john smith");
      expect(score1).toBeGreaterThan(score2);
    });

    it("should return 0 for no match", () => {
      expect(partialMatchScore("jane", "john")).toBe(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Name Matching Tests
// ─────────────────────────────────────────────────────────────

describe("Name Matching", () => {
  describe("nameSimilarity", () => {
    it("should return 1 for exact matches", () => {
      expect(nameSimilarity("John Smith", "john smith")).toBe(1);
    });

    it("should match first name only", () => {
      const score = nameSimilarity("John", "John Smith");
      expect(score).toBeGreaterThan(0.8);
    });

    it("should match last name only", () => {
      // When a single-word query matches the target's last name exactly
      const score = nameSimilarity("Smith", "John Smith");
      expect(score).toBe(0.8);
    });

    it("should handle fuzzy matches", () => {
      const score = nameSimilarity("Jon", "John Smith");
      expect(score).toBeGreaterThan(0.6);
    });
  });

  describe("couldBeNickname", () => {
    it("should recognize common nicknames", () => {
      expect(couldBeNickname("will", "William")).toBe(true);
      expect(couldBeNickname("bill", "William")).toBe(true);
      expect(couldBeNickname("bob", "Robert")).toBe(true);
      expect(couldBeNickname("mike", "Michael")).toBe(true);
    });

    it("should recognize first name abbreviations", () => {
      expect(couldBeNickname("jo", "Joanna")).toBe(true);
      expect(couldBeNickname("al", "Alexander")).toBe(true);
    });

    it("should not match unrelated names", () => {
      expect(couldBeNickname("sarah", "John")).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Email Matching Tests
// ─────────────────────────────────────────────────────────────

describe("Email Matching", () => {
  describe("extractEmailUsername", () => {
    it("should extract username before @", () => {
      expect(extractEmailUsername("john.smith@example.com")).toBe("john.smith");
    });

    it("should handle no @ symbol", () => {
      expect(extractEmailUsername("johnsmith")).toBe("johnsmith");
    });
  });

  describe("nameMatchesEmail", () => {
    it("should match firstname.lastname pattern", () => {
      expect(nameMatchesEmail("John Smith", "john.smith@example.com")).toBe(true);
    });

    it("should match firstnamelastname pattern", () => {
      expect(nameMatchesEmail("John Smith", "johnsmith@example.com")).toBe(true);
    });

    it("should match first initial pattern", () => {
      expect(nameMatchesEmail("John Smith", "j.smith@example.com")).toBe(true);
    });

    it("should match firstname only", () => {
      expect(nameMatchesEmail("John Smith", "john@example.com")).toBe(true);
    });

    it("should not match unrelated emails", () => {
      expect(nameMatchesEmail("John Smith", "jane.doe@example.com")).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Text Similarity Tests
// ─────────────────────────────────────────────────────────────

describe("Text Similarity", () => {
  describe("textSimilarity", () => {
    it("should return 1 for identical text", () => {
      expect(textSimilarity("team meeting", "team meeting")).toBe(1);
    });

    it("should score word overlap", () => {
      const score = textSimilarity("team meeting", "meeting with team");
      expect(score).toBeGreaterThan(0.7);
    });

    it("should handle partial matches", () => {
      const score = textSimilarity("budget", "budget review meeting");
      expect(score).toBeGreaterThan(0.3);
    });

    it("should return low score for unrelated text", () => {
      expect(textSimilarity("team meeting", "dentist appointment")).toBeLessThan(0.3);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Disambiguation Tests
// ─────────────────────────────────────────────────────────────

describe("Disambiguation", () => {
  describe("rankCandidates", () => {
    it("should sort candidates by confidence descending", () => {
      const candidates: ResolutionCandidate[] = [
        { id: "1", label: "John A", confidence: 0.7 },
        { id: "2", label: "John B", confidence: 0.9 },
        { id: "3", label: "John C", confidence: 0.8 },
      ];

      const ranked = rankCandidates(candidates);
      expect(ranked[0].id).toBe("2");
      expect(ranked[1].id).toBe("3");
      expect(ranked[2].id).toBe("1");
    });
  });

  describe("generateDisambiguationQuestion", () => {
    it("should generate question for person", () => {
      const candidates: ResolutionCandidate[] = [
        { id: "1", label: "John Smith (john@example.com)", confidence: 0.9 },
        { id: "2", label: "John Doe (johnd@example.com)", confidence: 0.8 },
      ];

      const question = generateDisambiguationQuestion("person", "John", candidates);
      expect(question).toContain("multiple people");
      expect(question).toContain("John Smith");
      expect(question).toContain("John Doe");
    });

    it("should generate question for event", () => {
      const candidates: ResolutionCandidate[] = [
        { id: "1", label: "Team Meeting (Monday)", confidence: 0.9 },
        { id: "2", label: "Team Meeting (Friday)", confidence: 0.8 },
      ];

      const question = generateDisambiguationQuestion("event", "team meeting", candidates);
      expect(question).toContain("multiple events");
    });
  });

  describe("generateNotFoundMessage", () => {
    it("should generate message for person", () => {
      const message = generateNotFoundMessage("person", "Sarah");
      expect(message).toContain("Sarah");
      expect(message).toContain("couldn't find");
    });

    it("should generate message for event", () => {
      const message = generateNotFoundMessage("event", "budget meeting");
      expect(message).toContain("event");
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Entity Resolver Tests
// ─────────────────────────────────────────────────────────────

describe("EntityResolver", () => {
  describe("constructor", () => {
    it("should use default config when none provided", () => {
      const resolver = createEntityResolver();
      const config = resolver.getConfig();
      expect(config).toEqual(DEFAULT_RESOLVER_CONFIG);
    });

    it("should merge custom config with defaults", () => {
      const resolver = createEntityResolver({
        exactMatchThreshold: 0.9,
        fuzzyMatchThreshold: 0.6,
      });
      const config = resolver.getConfig();
      expect(config.exactMatchThreshold).toBe(0.9);
      expect(config.fuzzyMatchThreshold).toBe(0.6);
      expect(config.maxCandidates).toBe(DEFAULT_RESOLVER_CONFIG.maxCandidates);
    });
  });

  describe("resolveEntities", () => {
    // Mock database for integration tests
    beforeEach(() => {
      vi.mock("@/lib/db", () => ({
        db: {
          person: {
            findFirst: vi.fn().mockResolvedValue(null),
            findMany: vi.fn().mockResolvedValue([]),
          },
          event: {
            findMany: vi.fn().mockResolvedValue([]),
          },
          task: {
            findMany: vi.fn().mockResolvedValue([]),
          },
          email: {
            findMany: vi.fn().mockResolvedValue([]),
          },
          routine: {
            findMany: vi.fn().mockResolvedValue([]),
          },
          openLoop: {
            findMany: vi.fn().mockResolvedValue([]),
          },
          project: {
            findMany: vi.fn().mockResolvedValue([]),
          },
          note: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        },
      }));

      vi.mock("@/services/context/context-search", () => ({
        searchContext: vi.fn().mockResolvedValue([]),
      }));

      vi.mock("@/services/context/people", () => ({
        searchPeople: vi.fn().mockResolvedValue([]),
      }));

      vi.mock("@/services/context/routines", () => ({
        searchRoutines: vi.fn().mockResolvedValue([]),
      }));

      vi.mock("@/services/context/open-loops", () => ({
        searchOpenLoops: vi.fn().mockResolvedValue([]),
      }));

      vi.mock("@/services/context/projects", () => ({
        searchProjects: vi.fn().mockResolvedValue([]),
      }));

      vi.mock("@/services/context/notes", () => ({
        searchNotes: vi.fn().mockResolvedValue([]),
      }));
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should filter entities that need resolution", async () => {
      const resolver = createEntityResolver();
      const entities = [
        { type: "person", text: "John", value: "John", needsResolution: true },
        { type: "datetime", text: "tomorrow", value: new Date(), needsResolution: false },
      ];

      const result = await resolver.resolveEntities("user-123", entities);
      // Only person entity should be in results
      expect(result.entities.length).toBe(1);
      expect(result.entities[0].extracted.type).toBe("person");
    });

    it("should categorize results by status", async () => {
      const resolver = createEntityResolver();
      const entities = [
        { type: "person", text: "Unknown Person", value: "Unknown Person", needsResolution: true },
      ];

      const result = await resolver.resolveEntities("user-123", entities);
      expect(result.notFound.length).toBe(1);
      expect(result.resolved.length).toBe(0);
      expect(result.ambiguous.length).toBe(0);
    });

    it("should generate clarification questions for ambiguous entities", async () => {
      const resolver = createEntityResolver();
      // This test verifies the structure - actual ambiguity would require
      // mocked database responses returning multiple candidates
      const result = await resolver.resolveEntities("user-123", []);
      expect(result.needsClarification).toBe(false);
      expect(result.clarificationQuestions).toEqual([]);
    });

    it("should handle routine entity resolution", async () => {
      const resolver = createEntityResolver();
      const entities = [
        { type: "routine", text: "morning standup", value: "morning standup", needsResolution: true },
      ];

      const result = await resolver.resolveEntities("user-123", entities);
      expect(result.entities.length).toBe(1);
      expect(result.entities[0].extracted.type).toBe("routine");
      // With no matching routines in the mock, it should be not found
      expect(result.notFound.length).toBe(1);
    });

    it("should handle open_loop entity resolution", async () => {
      const resolver = createEntityResolver();
      const entities = [
        { type: "open_loop", text: "follow up with client", value: "follow up with client", needsResolution: true },
      ];

      const result = await resolver.resolveEntities("user-123", entities);
      expect(result.entities.length).toBe(1);
      expect(result.entities[0].extracted.type).toBe("open_loop");
      expect(result.notFound.length).toBe(1);
    });

    it("should handle project entity resolution", async () => {
      const resolver = createEntityResolver();
      const entities = [
        { type: "project", text: "website redesign", value: "website redesign", needsResolution: true },
      ];

      const result = await resolver.resolveEntities("user-123", entities);
      expect(result.entities.length).toBe(1);
      expect(result.entities[0].extracted.type).toBe("project");
      expect(result.notFound.length).toBe(1);
    });

    it("should handle note entity resolution", async () => {
      const resolver = createEntityResolver();
      const entities = [
        { type: "note", text: "meeting notes", value: "meeting notes", needsResolution: true },
      ];

      const result = await resolver.resolveEntities("user-123", entities);
      expect(result.entities.length).toBe(1);
      expect(result.entities[0].extracted.type).toBe("note");
      expect(result.notFound.length).toBe(1);
    });

    it("should handle multiple new entity types in one batch", async () => {
      const resolver = createEntityResolver();
      const entities = [
        { type: "routine", text: "daily standup", value: "daily standup", needsResolution: true },
        { type: "open_loop", text: "pending invoice", value: "pending invoice", needsResolution: true },
        { type: "project", text: "Q1 launch", value: "Q1 launch", needsResolution: true },
        { type: "note", text: "brainstorm ideas", value: "brainstorm ideas", needsResolution: true },
      ];

      const result = await resolver.resolveEntities("user-123", entities);
      expect(result.entities.length).toBe(4);
      expect(result.notFound.length).toBe(4);
      
      // Verify each entity type was processed
      const types = result.entities.map(e => e.extracted.type);
      expect(types).toContain("routine");
      expect(types).toContain("open_loop");
      expect(types).toContain("project");
      expect(types).toContain("note");
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Edge Cases and Error Handling
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// Place Resolution Tests
// ─────────────────────────────────────────────────────────────

describe("Place Resolution", () => {
  describe("generateDisambiguationQuestion for places", () => {
    it("should generate question for place", () => {
      const candidates: ResolutionCandidate[] = [
        { id: "1", label: "Main Office (123 Main St)", confidence: 0.9 },
        { id: "2", label: "Branch Office (456 Oak Ave)", confidence: 0.8 },
      ];

      const question = generateDisambiguationQuestion("place", "office", candidates);
      expect(question).toContain("multiple places");
      expect(question).toContain("Main Office");
    });
  });

  describe("generateNotFoundMessage for places", () => {
    it("should generate message for place", () => {
      const message = generateNotFoundMessage("place", "downtown office");
      expect(message).toContain("downtown office");
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Deadline Resolution Tests
// ─────────────────────────────────────────────────────────────

describe("Deadline Resolution", () => {
  describe("generateDisambiguationQuestion for deadlines", () => {
    it("should generate question for deadline", () => {
      const candidates: ResolutionCandidate[] = [
        { id: "1", label: "Q4 Report (deadline, due 12/31)", confidence: 0.9 },
        { id: "2", label: "Budget Review (milestone, due 12/15)", confidence: 0.8 },
      ];

      const question = generateDisambiguationQuestion("deadline", "report deadline", candidates);
      expect(question).toContain("multiple deadlines");
    });
  });

  describe("generateNotFoundMessage for deadlines", () => {
    it("should generate message for deadline", () => {
      const message = generateNotFoundMessage("deadline", "tax filing");
      expect(message).toContain("tax filing");
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Routine Resolution Tests
// ─────────────────────────────────────────────────────────────

describe("Routine Resolution", () => {
  describe("generateDisambiguationQuestion for routines", () => {
    it("should generate question for routine", () => {
      const candidates: ResolutionCandidate[] = [
        { id: "1", label: "Morning Standup (daily, 9:00 AM)", confidence: 0.9 },
        { id: "2", label: "Morning Workout (daily, 7:00 AM)", confidence: 0.8 },
      ];

      const question = generateDisambiguationQuestion("routine", "morning routine", candidates);
      expect(question).toContain("multiple routines");
      expect(question).toContain("Morning Standup");
      expect(question).toContain("Morning Workout");
    });

    it("should limit candidates to top 5", () => {
      const candidates: ResolutionCandidate[] = Array.from({ length: 10 }, (_, i) => ({
        id: `${i + 1}`,
        label: `Routine ${i + 1}`,
        confidence: 0.9 - i * 0.05,
      }));

      const question = generateDisambiguationQuestion("routine", "test", candidates);
      // Should only include first 5 candidates
      expect(question).toContain("Routine 1");
      expect(question).toContain("Routine 5");
      expect(question).not.toContain("Routine 6");
    });
  });

  describe("generateNotFoundMessage for routines", () => {
    it("should generate message for routine", () => {
      const message = generateNotFoundMessage("routine", "morning exercise");
      expect(message).toContain("morning exercise");
      expect(message).toContain("routine");
      expect(message).toContain("create");
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Open Loop Resolution Tests
// ─────────────────────────────────────────────────────────────

describe("Open Loop Resolution", () => {
  describe("generateDisambiguationQuestion for open loops", () => {
    it("should generate question for open loop", () => {
      const candidates: ResolutionCandidate[] = [
        { id: "1", label: "Follow up with client (high priority)", confidence: 0.9 },
        { id: "2", label: "Follow up on invoice (medium priority)", confidence: 0.8 },
      ];

      const question = generateDisambiguationQuestion("open_loop", "follow up", candidates);
      expect(question).toContain("multiple open loops");
      expect(question).toContain("Follow up with client");
      expect(question).toContain("Follow up on invoice");
    });
  });

  describe("generateNotFoundMessage for open loops", () => {
    it("should generate message for open loop", () => {
      const message = generateNotFoundMessage("open_loop", "pending review");
      expect(message).toContain("pending review");
      expect(message).toContain("open loop");
      expect(message).toContain("create");
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Project Resolution Tests
// ─────────────────────────────────────────────────────────────

describe("Project Resolution", () => {
  describe("generateDisambiguationQuestion for projects", () => {
    it("should generate question for project", () => {
      const candidates: ResolutionCandidate[] = [
        { id: "1", label: "Website Redesign (active)", confidence: 0.9 },
        { id: "2", label: "Website Migration (on hold)", confidence: 0.8 },
      ];

      const question = generateDisambiguationQuestion("project", "website project", candidates);
      expect(question).toContain("multiple projects");
      expect(question).toContain("Website Redesign");
      expect(question).toContain("Website Migration");
    });
  });

  describe("generateNotFoundMessage for projects", () => {
    it("should generate message for project", () => {
      const message = generateNotFoundMessage("project", "Q1 launch");
      expect(message).toContain("Q1 launch");
      expect(message).toContain("project");
      expect(message).toContain("create");
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Note Resolution Tests
// ─────────────────────────────────────────────────────────────

describe("Note Resolution", () => {
  describe("generateDisambiguationQuestion for notes", () => {
    it("should generate question for note", () => {
      const candidates: ResolutionCandidate[] = [
        { id: "1", label: "Meeting Notes - Q4 Planning", confidence: 0.9 },
        { id: "2", label: "Meeting Notes - Budget Review", confidence: 0.8 },
      ];

      const question = generateDisambiguationQuestion("note", "meeting notes", candidates);
      expect(question).toContain("multiple notes");
      expect(question).toContain("Meeting Notes - Q4 Planning");
      expect(question).toContain("Meeting Notes - Budget Review");
    });
  });

  describe("generateNotFoundMessage for notes", () => {
    it("should generate message for note", () => {
      const message = generateNotFoundMessage("note", "project ideas");
      expect(message).toContain("project ideas");
      expect(message).toContain("note");
      expect(message).toContain("create");
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Edge Cases and Error Handling
// ─────────────────────────────────────────────────────────────

describe("Edge Cases", () => {
  describe("empty inputs", () => {
    it("should handle empty string for name similarity", () => {
      expect(nameSimilarity("", "John Smith")).toBe(0);
      expect(nameSimilarity("John Smith", "")).toBe(0);
    });

    it("should handle empty candidates array", () => {
      const ranked = rankCandidates([]);
      expect(ranked).toEqual([]);
    });
  });

  describe("special characters", () => {
    it("should handle names with hyphens", () => {
      const score = nameSimilarity("Mary-Jane", "Mary Jane Watson");
      expect(score).toBeGreaterThan(0.5);
    });

    it("should handle names with apostrophes", () => {
      const normalized = normalizeName("O'Brien");
      expect(normalized).toBe("o'brien");
    });
  });

  describe("unicode handling", () => {
    it("should normalize unicode names", () => {
      const score = nameSimilarity("José García", "Jose Garcia");
      expect(score).toBe(1);
    });
  });
});

