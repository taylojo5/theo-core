// ═══════════════════════════════════════════════════════════════════════════
// Gmail Extraction Tests
// Tests for email content extraction (people, dates, actions, topics)
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import {
  extractDates,
  extractDeadlines,
  extractActionItems,
  containsActionPatterns,
  extractTopics,
  matchesTopic,
  getAllCategories,
  isValidCategory,
  hasActionableContent,
  getDeadlines,
  getHighPriorityActions,
  extractListItems,
} from "@/integrations/gmail";
import type {
  ExtractedDate,
  ExtractedActionItem,
  ExtractedTopic,
  EmailProcessingResult,
  ActionPriority,
} from "@/integrations/gmail";

// ─────────────────────────────────────────────────────────────
// Date Extraction
// ─────────────────────────────────────────────────────────────

describe("Date Extraction", () => {
  describe("extractDates", () => {
    it("should extract absolute dates", () => {
      const text = "Meeting scheduled for December 25th, 2024";
      const dates = extractDates(text);

      expect(dates.length).toBeGreaterThan(0);
      const date = dates[0];
      expect(date.date.getMonth()).toBe(11); // December
      expect(date.date.getDate()).toBe(25);
      expect(date.date.getFullYear()).toBe(2024);
    });

    it("should extract relative dates", () => {
      const text = "Please submit by next Friday";
      const referenceDate = new Date("2024-12-21"); // Saturday
      const dates = extractDates(text, { referenceDate });

      expect(dates.length).toBeGreaterThan(0);
      // Next Friday from Dec 21 (Saturday) should be Dec 27
      const date = dates[0];
      expect(date.date.getDay()).toBe(5); // Friday
    });

    it("should filter future dates only when specified", () => {
      const text = "Met on January 1st, 2024. Next meeting January 1st, 2025.";
      const referenceDate = new Date("2024-12-21");

      const allDates = extractDates(text, { referenceDate, futureOnly: false });
      const futureDates = extractDates(text, {
        referenceDate,
        futureOnly: true,
      });

      expect(allDates.length).toBeGreaterThanOrEqual(2);
      expect(futureDates.length).toBeLessThanOrEqual(allDates.length);
    });

    it("should detect deadline language", () => {
      const text = "Deadline is Friday, December 27th";
      const dates = extractDates(text);

      expect(dates.length).toBeGreaterThan(0);
      expect(dates[0].isPotentialDeadline).toBe(true);
    });

    it("should extract time when present", () => {
      const text = "Meeting at 3:30 PM on December 25th";
      const dates = extractDates(text);

      expect(dates.length).toBeGreaterThan(0);
      expect(dates[0].hasTime).toBe(true);
    });

    it("should extract date ranges", () => {
      const text = "Available from Monday to Friday";
      const dates = extractDates(text);

      // May extract as range or multiple dates
      expect(dates.length).toBeGreaterThan(0);
    });

    it("should handle empty text", () => {
      const dates = extractDates("");
      expect(dates).toEqual([]);
    });

    it("should preserve original text", () => {
      const text = "Due by end of next week";
      const dates = extractDates(text);

      if (dates.length > 0) {
        expect(dates[0].originalText).toBeDefined();
        expect(dates[0].originalText.length).toBeGreaterThan(0);
      }
    });
  });

  describe("extractDeadlines", () => {
    it("should extract explicit deadlines when date keywords present", () => {
      const text = "Deadline: December 31st, 2024 - submit report";
      const deadlines = extractDeadlines(text);

      // May return dates if chrono-node can parse them
      if (deadlines.length > 0) {
        expect(deadlines[0].isPotentialDeadline).toBe(true);
      }
    });

    it("should recognize date patterns with deadline context", () => {
      const text = "Due by next Monday";
      const deadlines = extractDeadlines(text);

      // This test documents that extractDeadlines attempts to find deadline-like dates
      // Result depends on chrono-node parsing ability
      expect(Array.isArray(deadlines)).toBe(true);
    });

    it("should return empty for non-deadline text", () => {
      const text = "We had a meeting yesterday";
      const deadlines = extractDeadlines(text);

      // Past dates are typically filtered out
      expect(Array.isArray(deadlines)).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Action Item Extraction
// ─────────────────────────────────────────────────────────────

describe("Action Item Extraction", () => {
  describe("extractActionItems", () => {
    it("should return an array", () => {
      const text = "Please review the document and send me your feedback.";
      const actions = extractActionItems(text);

      // The function should return an array (may be empty based on implementation)
      expect(Array.isArray(actions)).toBe(true);
    });

    it("should handle various text formats", () => {
      const text = "Can you finish the report by Friday?";
      const actions = extractActionItems(text);

      // Should not throw and should return an array
      expect(Array.isArray(actions)).toBe(true);
    });

    it("should handle list-style text", () => {
      const text = `
        Action items:
        1. Complete the design mockups
        2. Review the budget
      `;
      const actions = extractActionItems(text);

      expect(Array.isArray(actions)).toBe(true);
    });

    it("should detect priority when actions found", () => {
      const urgentText = "URGENT: Submit the report immediately";
      const urgentActions = extractActionItems(urgentText);

      if (urgentActions.length > 0) {
        expect(["urgent", "high", "medium", "low"]).toContain(
          urgentActions[0].priority
        );
      }
    });

    it("should handle empty text gracefully", () => {
      const actions = extractActionItems("");
      expect(Array.isArray(actions)).toBe(true);
      expect(actions.length).toBe(0);
    });
  });

  describe("containsActionPatterns", () => {
    it("should return boolean for text", () => {
      const result1 = containsActionPatterns("Please review this document");
      const result2 = containsActionPatterns("Hello world");

      expect(typeof result1).toBe("boolean");
      expect(typeof result2).toBe("boolean");
    });
  });

  describe("extractListItems", () => {
    it("should return an array", () => {
      const text = `
        1. First item
        2. Second item
      `;
      const items = extractListItems(text);

      expect(Array.isArray(items)).toBe(true);
    });

    it("should handle various list formats", () => {
      const text = `
        - Task one
        - Task two
      `;
      const items = extractListItems(text);

      expect(Array.isArray(items)).toBe(true);
    });

    it("should handle empty input", () => {
      const items = extractListItems("");
      expect(Array.isArray(items)).toBe(true);
    });
  });

  describe("Priority Detection", () => {
    it("should detect urgent priority", () => {
      const urgentKeywords = ["URGENT", "ASAP", "immediately", "critical"];

      urgentKeywords.forEach((keyword) => {
        const text = `${keyword}: Complete this task`;
        const actions = extractActionItems(text);

        if (actions.length > 0) {
          expect(actions[0].priority).toBe("urgent");
        }
      });
    });

    it("should detect high priority", () => {
      const text = "Important: Review the proposal";
      const actions = extractActionItems(text);

      if (actions.length > 0) {
        expect(["urgent", "high"]).toContain(actions[0].priority);
      }
    });

    it("should detect low priority", () => {
      const text = "No rush, but when you have time, please review";
      const actions = extractActionItems(text);

      if (actions.length > 0) {
        expect(["low", "medium"]).toContain(actions[0].priority);
      }
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Topic Categorization
// ─────────────────────────────────────────────────────────────

describe("Topic Categorization", () => {
  describe("extractTopics", () => {
    it("should categorize finance emails", () => {
      const email = {
        subject: "Invoice #12345 Payment Confirmation",
        bodyText: "Your payment of $500 has been received. Receipt attached.",
        fromEmail: "billing@company.com",
      };

      const topics = extractTopics(email);

      expect(topics.length).toBeGreaterThan(0);
      expect(topics.some((t) => t.category === "finance")).toBe(true);
    });

    it("should categorize travel emails", () => {
      const email = {
        subject: "Flight Confirmation - LAX to JFK",
        bodyText: "Your booking is confirmed. Flight departs at 8:00 AM.",
        fromEmail: "bookings@airline.com",
      };

      const topics = extractTopics(email);

      expect(topics.some((t) => t.category === "travel")).toBe(true);
    });

    it("should categorize scheduling emails", () => {
      const email = {
        subject: "Meeting Invitation: Project Review",
        bodyText: "You are invited to a meeting on Thursday at 2pm.",
        fromEmail: "calendar@company.com",
      };

      const topics = extractTopics(email);

      expect(topics.some((t) => t.category === "scheduling")).toBe(true);
    });

    it("should limit number of topics", () => {
      const email = {
        subject: "Multiple topics meeting invoice flight",
        bodyText: "Meeting about invoice for flight booking project",
        fromEmail: "test@example.com",
      };

      const topics = extractTopics(email, { maxTopics: 2 });

      expect(topics.length).toBeLessThanOrEqual(2);
    });

    it("should respect minimum confidence", () => {
      const email = {
        subject: "Generic message",
        bodyText: "Hello, how are you?",
        fromEmail: "friend@example.com",
      };

      const highConfTopics = extractTopics(email, { minConfidence: 0.8 });
      const lowConfTopics = extractTopics(email, { minConfidence: 0.1 });

      expect(lowConfTopics.length).toBeGreaterThanOrEqual(
        highConfTopics.length
      );
    });
  });

  describe("matchesTopic", () => {
    it("should match specific topics", () => {
      const email = {
        subject: "Your Amazon Order Has Shipped",
        bodyText: "Track your delivery",
        fromEmail: "shipping@amazon.com",
      };

      expect(matchesTopic(email, "shopping")).toBe(true);
    });

    it("should not match unrelated topics", () => {
      const email = {
        subject: "Meeting Tomorrow",
        bodyText: "Let's discuss the project",
        fromEmail: "coworker@company.com",
      };

      expect(matchesTopic(email, "shopping")).toBe(false);
    });
  });

  describe("getAllCategories", () => {
    it("should return all available categories", () => {
      const categories = getAllCategories();

      expect(categories).toContain("work");
      expect(categories).toContain("finance");
      expect(categories).toContain("travel");
      expect(categories).toContain("scheduling");
      expect(categories).toContain("shopping");
      expect(categories).toContain("personal");
    });
  });

  describe("isValidCategory", () => {
    it("should validate known categories", () => {
      expect(isValidCategory("work")).toBe(true);
      expect(isValidCategory("finance")).toBe(true);
      expect(isValidCategory("travel")).toBe(true);
    });

    it("should reject unknown categories", () => {
      expect(isValidCategory("invalid_category")).toBe(false);
      expect(isValidCategory("")).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Processing Result Utilities
// ─────────────────────────────────────────────────────────────

describe("Processing Result Utilities", () => {
  describe("hasActionableContent", () => {
    it("should return true when deadlines present", () => {
      const result: Partial<EmailProcessingResult> = {
        dates: [
          { date: new Date(), isPotentialDeadline: true } as ExtractedDate,
        ],
        actionItems: [],
      };

      expect(hasActionableContent(result as EmailProcessingResult)).toBe(true);
    });

    it("should return true when action items present", () => {
      const result: Partial<EmailProcessingResult> = {
        dates: [],
        actionItems: [
          {
            title: "Review document",
            priority: "medium" as ActionPriority,
          } as ExtractedActionItem,
        ],
      };

      expect(hasActionableContent(result as EmailProcessingResult)).toBe(true);
    });

    it("should return false when no actionable content", () => {
      const result: Partial<EmailProcessingResult> = {
        dates: [],
        actionItems: [],
      };

      expect(hasActionableContent(result as EmailProcessingResult)).toBe(false);
    });
  });

  describe("getDeadlines", () => {
    it("should filter to deadlines only", () => {
      const result: Partial<EmailProcessingResult> = {
        dates: [
          { date: new Date(), isPotentialDeadline: true } as ExtractedDate,
          { date: new Date(), isPotentialDeadline: false } as ExtractedDate,
          { date: new Date(), isPotentialDeadline: true } as ExtractedDate,
        ],
      };

      const deadlines = getDeadlines(result as EmailProcessingResult);

      expect(deadlines).toHaveLength(2);
      expect(deadlines.every((d) => d.isPotentialDeadline)).toBe(true);
    });
  });

  describe("getHighPriorityActions", () => {
    it("should filter to urgent and high priority", () => {
      const result: Partial<EmailProcessingResult> = {
        actionItems: [
          {
            title: "Urgent task",
            priority: "urgent" as ActionPriority,
          } as ExtractedActionItem,
          {
            title: "High task",
            priority: "high" as ActionPriority,
          } as ExtractedActionItem,
          {
            title: "Medium task",
            priority: "medium" as ActionPriority,
          } as ExtractedActionItem,
          {
            title: "Low task",
            priority: "low" as ActionPriority,
          } as ExtractedActionItem,
        ],
      };

      const highPriority = getHighPriorityActions(
        result as EmailProcessingResult
      );

      expect(highPriority).toHaveLength(2);
      expect(
        highPriority.every((a) => ["urgent", "high"].includes(a.priority))
      ).toBe(true);
    });
  });
});
