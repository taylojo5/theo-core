// ═══════════════════════════════════════════════════════════════════════════
// Calendar Actions Tests
// Tests for calendar action workflow and approval system
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  summarizeConflicts,
  shouldBlockAction,
} from "@/integrations/calendar/actions/conflicts";
import { createMockDbApproval, resetMockCounters } from "./mocks";
import type { ConflictInfo } from "@/integrations/calendar/actions/types";

// Helper to create mock conflicts matching the actual ConflictInfo type
function createMockConflict(
  overrides: Partial<ConflictInfo> = {}
): ConflictInfo {
  return {
    eventId: "evt-" + Math.random().toString(36).substring(7),
    title: "Conflicting Event",
    startsAt: new Date("2024-03-15T10:00:00Z"),
    endsAt: new Date("2024-03-15T11:00:00Z"),
    allDay: false,
    conflictType: "overlap",
    severity: "medium",
    ...overrides,
  };
}

describe("Calendar Actions", () => {
  beforeEach(() => {
    resetMockCounters();
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // Conflict Utility Tests (Pure Functions)
  // ─────────────────────────────────────────────────────────────

  describe("Conflict Utilities", () => {
    describe("conflict severity check", () => {
      it("should identify high severity in conflict list", () => {
        const conflicts: ConflictInfo[] = [
          createMockConflict({ severity: "low", title: "Event 1" }),
          createMockConflict({
            severity: "high",
            conflictType: "same_time",
            title: "Event 2",
          }),
        ];

        const hasHigh = conflicts.some((c) => c.severity === "high");
        expect(hasHigh).toBe(true);
      });

      it("should return false if no high severity conflicts", () => {
        const conflicts: ConflictInfo[] = [
          createMockConflict({ severity: "low", title: "Event 1" }),
        ];

        const hasHigh = conflicts.some((c) => c.severity === "high");
        expect(hasHigh).toBe(false);
      });

      it("should return false for empty conflicts", () => {
        const conflicts: ConflictInfo[] = [];
        const hasHigh = conflicts.some((c) => c.severity === "high");
        expect(hasHigh).toBe(false);
      });
    });

    describe("summarizeConflicts", () => {
      it("should summarize conflicts into readable text", () => {
        const conflicts: ConflictInfo[] = [
          createMockConflict({ severity: "medium", title: "Team Standup" }),
          createMockConflict({ severity: "low", title: "Lunch" }),
        ];

        const summary = summarizeConflicts(conflicts);

        // The function groups by type and severity
        expect(summary).toContain("Conflict");
        expect(summary.length).toBeGreaterThan(0);
      });

      it("should return no conflicts message for empty array", () => {
        const summary = summarizeConflicts([]);
        expect(summary).toContain("No conflicts");
      });
    });

    describe("shouldBlockAction", () => {
      it("should block when high severity conflicts exist", () => {
        const conflicts: ConflictInfo[] = [
          createMockConflict({ severity: "high", conflictType: "same_time" }),
        ];

        expect(shouldBlockAction(conflicts)).toBe(true);
      });

      it("should not block for low severity conflicts", () => {
        const conflicts: ConflictInfo[] = [
          createMockConflict({ severity: "low", conflictType: "overlap" }),
        ];

        expect(shouldBlockAction(conflicts)).toBe(false);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Approval Data Tests
  // ─────────────────────────────────────────────────────────────

  describe("Approval Data Structures", () => {
    it("should create valid approval data structure", () => {
      const approval = createMockDbApproval({
        actionType: "create",
        status: "pending",
        calendarId: "primary",
        actionData: {
          summary: "New Meeting",
          start: { dateTime: "2024-03-15T10:00:00Z" },
          end: { dateTime: "2024-03-15T11:00:00Z" },
        },
      });

      expect(approval.actionType).toBe("create");
      expect(approval.status).toBe("pending");
      expect(approval.calendarId).toBe("primary");
      expect(approval.actionData).toHaveProperty("summary", "New Meeting");
    });

    it("should have expiration date in future", () => {
      const approval = createMockDbApproval();

      expect(new Date(approval.expiresAt) > new Date()).toBe(true);
    });

    it("should support update action type", () => {
      const approval = createMockDbApproval({
        actionType: "update",
        eventId: "existing-event-id",
        eventSnapshot: {
          title: "Original Title",
          startsAt: "2024-03-15T10:00:00Z",
        },
        actionData: {
          summary: "Updated Title",
        },
      });

      expect(approval.actionType).toBe("update");
      expect(approval.eventId).toBe("existing-event-id");
      expect(approval.eventSnapshot).toHaveProperty("title", "Original Title");
    });

    it("should support delete action type", () => {
      const approval = createMockDbApproval({
        actionType: "delete",
        eventId: "event-to-delete",
        eventSnapshot: {
          title: "Event to Delete",
        },
      });

      expect(approval.actionType).toBe("delete");
      expect(approval.eventId).toBe("event-to-delete");
    });

    it("should support respond action type", () => {
      const approval = createMockDbApproval({
        actionType: "respond",
        eventId: "event-to-respond",
        actionData: {
          response: "accepted",
        },
      });

      expect(approval.actionType).toBe("respond");
      expect(approval.actionData).toHaveProperty("response", "accepted");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Approval Status Tests
  // ─────────────────────────────────────────────────────────────

  describe("Approval Status Transitions", () => {
    it("should create approval in pending status", () => {
      const approval = createMockDbApproval({ status: "pending" });

      expect(approval.status).toBe("pending");
      expect(approval.executedAt).toBeNull();
    });

    it("should support approved status", () => {
      const approval = createMockDbApproval({ status: "approved" });

      expect(approval.status).toBe("approved");
    });

    it("should support rejected status", () => {
      const approval = createMockDbApproval({ status: "rejected" });

      expect(approval.status).toBe("rejected");
    });

    it("should support expired status", () => {
      const approval = createMockDbApproval({
        status: "expired",
        expiresAt: new Date(Date.now() - 1000), // Already expired
      });

      expect(approval.status).toBe("expired");
    });

    it("should support executed status", () => {
      const approval = createMockDbApproval({ status: "executed" });

      expect(approval.status).toBe("executed");
    });

    it("should support failed status", () => {
      const approval = createMockDbApproval({ status: "failed" });

      expect(approval.status).toBe("failed");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Conflict Association Tests
  // ─────────────────────────────────────────────────────────────

  describe("Conflict Association with Approvals", () => {
    it("should store conflicts with approval", () => {
      const conflicts: ConflictInfo[] = [
        createMockConflict({
          conflictType: "overlap",
          severity: "medium",
          title: "Existing Event",
        }),
      ];

      const approval = createMockDbApproval({
        conflicts: conflicts,
      });

      expect(approval.conflicts).toHaveLength(1);
      expect((approval.conflicts as ConflictInfo[])[0].conflictType).toBe(
        "overlap"
      );
    });

    it("should handle approval without conflicts", () => {
      const approval = createMockDbApproval({
        conflicts: null,
      });

      expect(approval.conflicts).toBeNull();
    });
  });
});
