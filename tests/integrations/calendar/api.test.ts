// ═══════════════════════════════════════════════════════════════════════════
// Calendar API Route Tests
// Tests for Calendar API endpoints: auth, rate limiting, and approval workflow
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import {
  createMockDbCalendar,
  createMockDbApproval,
  resetMockCounters,
} from "./mocks";

// ─────────────────────────────────────────────────────────────
// Mock Dependencies
// ─────────────────────────────────────────────────────────────

// Mock auth
const mockSession = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockSession(),
}));

// Mock rate limiting
const mockApplyRateLimit = vi.fn();
vi.mock("@/lib/rate-limit/middleware", () => ({
  applyRateLimit: (...args: unknown[]) => mockApplyRateLimit(...args),
  RATE_LIMITS: {
    calendarConnect: { windowMs: 60000, maxRequests: 10, keyPrefix: "cal-connect" },
    calendarCalendars: { windowMs: 60000, maxRequests: 100, keyPrefix: "cal-calendars" },
    calendarApprovals: { windowMs: 60000, maxRequests: 50, keyPrefix: "cal-approvals" },
  },
}));

// Mock scope checking
const mockCheckCalendarScopes = vi.fn();
const mockIsCalendarConnected = vi.fn();
const mockRevokeCalendarAccess = vi.fn();
vi.mock("@/lib/auth/scope-upgrade", () => ({
  checkCalendarScopes: () => mockCheckCalendarScopes(),
  isCalendarConnected: () => mockIsCalendarConnected(),
  revokeCalendarAccess: () => mockRevokeCalendarAccess(),
}));

// Mock scopes
vi.mock("@/lib/auth/scopes", () => ({
  ALL_CALENDAR_SCOPES: [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",
  ],
  BASE_SCOPES: [
    "openid",
    "email",
    "profile",
  ],
  formatScopes: (scopes: string[]) => scopes.join(" "),
}));

// Mock calendar repository
const mockCalendarRepository = {
  findByUser: vi.fn(),
};
vi.mock("@/integrations/calendar/repository", () => ({
  calendarRepository: {
    findByUser: () => mockCalendarRepository.findByUser(),
  },
  calendarApprovalRepository: {
    findByStatus: vi.fn(),
  },
}));

// Mock approval actions
const mockGetApproval = vi.fn();
const mockApproveCalendarAction = vi.fn();
const mockRejectCalendarAction = vi.fn();
const mockCancelApproval = vi.fn();
const mockGetPendingApprovals = vi.fn();
vi.mock("@/integrations/calendar/actions", () => ({
  getApproval: (...args: unknown[]) => mockGetApproval(...args),
  approveCalendarAction: (...args: unknown[]) => mockApproveCalendarAction(...args),
  rejectCalendarAction: (...args: unknown[]) => mockRejectCalendarAction(...args),
  cancelApproval: (...args: unknown[]) => mockCancelApproval(...args),
  getPendingApprovals: (...args: unknown[]) => mockGetPendingApprovals(...args),
}));

// Mock sync functions
const mockGetCalendarQueue = vi.fn();
const mockStartRecurringSync = vi.fn();
const mockScheduleIncrementalSync = vi.fn();
const mockHasRecurringSyncActive = vi.fn();
vi.mock("@/integrations/calendar/sync", () => ({
  getCalendarQueue: () => mockGetCalendarQueue(),
  startRecurringSync: (...args: unknown[]) => mockStartRecurringSync(...args),
  scheduleIncrementalSync: (...args: unknown[]) => mockScheduleIncrementalSync(...args),
  hasRecurringSyncActive: (...args: unknown[]) => mockHasRecurringSyncActive(...args),
}));

// Mock audit logging
vi.mock("@/services/audit", () => ({
  logAuditEntry: vi.fn(() => Promise.resolve()),
}));

// Mock logger
vi.mock("@/integrations/calendar/logger", () => ({
  calendarLogger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

// ─────────────────────────────────────────────────────────────
// Test Utilities
// ─────────────────────────────────────────────────────────────

function createMockRequest(
  method: string,
  url: string,
  body?: object
): NextRequest {
  const request = new NextRequest(new URL(url, "http://localhost:3000"), {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "127.0.0.1",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return request;
}

function setupDefaultMocks() {
  // Default: authenticated user
  mockSession.mockResolvedValue({
    user: { id: "test-user-id", email: "test@example.com" },
  });

  // Default: rate limit allows request
  mockApplyRateLimit.mockResolvedValue({
    response: null,
    headers: new Headers({
      "X-RateLimit-Limit": "100",
      "X-RateLimit-Remaining": "99",
    }),
  });

  // Default: calendar connected
  mockCheckCalendarScopes.mockResolvedValue({
    hasRequiredScopes: true,
    canRead: true,
    canWrite: true,
    grantedScopes: [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
    ],
    missingScopes: [],
  });

  // Default: sync queue mock
  mockGetCalendarQueue.mockReturnValue({
    add: vi.fn(),
    removeRepeatable: vi.fn(),
    getRepeatableJobs: vi.fn(() => []),
  });
  mockHasRecurringSyncActive.mockResolvedValue(true);
  mockStartRecurringSync.mockResolvedValue({ jobId: "job-1" });
  mockScheduleIncrementalSync.mockResolvedValue({ jobId: "job-2" });
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("Calendar API Routes", () => {
  beforeEach(() => {
    resetMockCounters();
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ═══════════════════════════════════════════════════════════
  // Authentication Tests
  // ═══════════════════════════════════════════════════════════

  describe("Authentication", () => {
    describe("GET /api/integrations/calendar/connect", () => {
      it("should return 401 when not authenticated", async () => {
        mockSession.mockResolvedValue(null);

        const { GET } = await import(
          "@/app/api/integrations/calendar/connect/route"
        );
        const request = createMockRequest(
          "GET",
          "/api/integrations/calendar/connect"
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.connected).toBe(false);
      });

      it("should return connection status when authenticated", async () => {
        const { GET } = await import(
          "@/app/api/integrations/calendar/connect/route"
        );
        const request = createMockRequest(
          "GET",
          "/api/integrations/calendar/connect"
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.connected).toBe(true);
        expect(data.canRead).toBe(true);
        expect(data.canWrite).toBe(true);
      });
    });

    describe("POST /api/integrations/calendar/connect", () => {
      it("should return 401 when not authenticated", async () => {
        mockSession.mockResolvedValue(null);

        const { POST } = await import(
          "@/app/api/integrations/calendar/connect/route"
        );
        const request = createMockRequest(
          "POST",
          "/api/integrations/calendar/connect"
        );
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.error).toBe("Unauthorized");
      });

      it("should return alreadyConnected when scopes are granted", async () => {
        const { POST } = await import(
          "@/app/api/integrations/calendar/connect/route"
        );
        const request = createMockRequest(
          "POST",
          "/api/integrations/calendar/connect"
        );
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.alreadyConnected).toBe(true);
      });

      it("should return signInRequired when scopes are missing", async () => {
        mockCheckCalendarScopes.mockResolvedValue({
          hasRequiredScopes: false,
          canRead: false,
          canWrite: false,
          grantedScopes: [],
          missingScopes: [
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/calendar.events",
          ],
        });

        const { POST } = await import(
          "@/app/api/integrations/calendar/connect/route"
        );
        const request = createMockRequest(
          "POST",
          "/api/integrations/calendar/connect"
        );
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.signInRequired).toBe(true);
        expect(data.authorizationParams).toBeDefined();
        expect(data.authorizationParams.scope).toContain("calendar");
      });
    });

    describe("DELETE /api/integrations/calendar/disconnect", () => {
      it("should return 401 when not authenticated", async () => {
        mockSession.mockResolvedValue(null);

        const { DELETE } = await import(
          "@/app/api/integrations/calendar/disconnect/route"
        );
        const request = createMockRequest(
          "DELETE",
          "/api/integrations/calendar/disconnect"
        );
        const response = await DELETE(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.error).toBe("Unauthorized");
      });

      it("should disconnect successfully when connected", async () => {
        mockIsCalendarConnected.mockResolvedValue(true);
        mockRevokeCalendarAccess.mockResolvedValue({ success: true });

        const { DELETE } = await import(
          "@/app/api/integrations/calendar/disconnect/route"
        );
        const request = createMockRequest(
          "DELETE",
          "/api/integrations/calendar/disconnect"
        );
        const response = await DELETE(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toContain("disconnected");
      });

      it("should return success when not connected", async () => {
        mockIsCalendarConnected.mockResolvedValue(false);

        const { DELETE } = await import(
          "@/app/api/integrations/calendar/disconnect/route"
        );
        const request = createMockRequest(
          "DELETE",
          "/api/integrations/calendar/disconnect"
        );
        const response = await DELETE(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toContain("not currently connected");
      });
    });

    describe("GET /api/integrations/calendar/calendars", () => {
      it("should return 401 when not authenticated", async () => {
        mockSession.mockResolvedValue(null);

        const { GET } = await import(
          "@/app/api/integrations/calendar/calendars/route"
        );
        const request = createMockRequest(
          "GET",
          "/api/integrations/calendar/calendars"
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe("Unauthorized");
      });

      it("should return calendars when authenticated", async () => {
        const mockCalendars = [
          createMockDbCalendar({ isPrimary: true, name: "Primary" }),
          createMockDbCalendar({ name: "Work" }),
        ];
        mockCalendarRepository.findByUser.mockResolvedValue(mockCalendars);

        const { GET } = await import(
          "@/app/api/integrations/calendar/calendars/route"
        );
        const request = createMockRequest(
          "GET",
          "/api/integrations/calendar/calendars"
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.calendars).toHaveLength(2);
        expect(data.count).toBe(2);
        // Primary should be first
        expect(data.calendars[0].isPrimary).toBe(true);
      });
    });

    describe("GET /api/integrations/calendar/approvals", () => {
      it("should return 401 when not authenticated", async () => {
        mockSession.mockResolvedValue(null);

        const { GET } = await import(
          "@/app/api/integrations/calendar/approvals/route"
        );
        const request = createMockRequest(
          "GET",
          "/api/integrations/calendar/approvals"
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe("Unauthorized");
      });

      it("should return approvals when authenticated", async () => {
        const mockApprovals = [
          createMockDbApproval({ actionType: "create", status: "pending" }),
          createMockDbApproval({ actionType: "update", status: "pending" }),
        ];
        mockGetPendingApprovals.mockResolvedValue(mockApprovals);

        const { GET } = await import(
          "@/app/api/integrations/calendar/approvals/route"
        );
        const request = createMockRequest(
          "GET",
          "/api/integrations/calendar/approvals"
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.approvals).toHaveLength(2);
        expect(data.total).toBe(2);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Rate Limiting Tests
  // ═══════════════════════════════════════════════════════════

  describe("Rate Limiting", () => {
    it("should return 429 when rate limit exceeded on connect", async () => {
      const rateLimitResponse = new Response(
        JSON.stringify({ error: "Too many requests" }),
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "10",
            "X-RateLimit-Remaining": "0",
            "Retry-After": "60",
          },
        }
      );
      mockApplyRateLimit.mockResolvedValue({
        response: rateLimitResponse,
        headers: rateLimitResponse.headers,
      });

      const { GET } = await import(
        "@/app/api/integrations/calendar/connect/route"
      );
      const request = createMockRequest(
        "GET",
        "/api/integrations/calendar/connect"
      );
      const response = await GET(request);

      expect(response.status).toBe(429);
    });

    it("should return 429 when rate limit exceeded on calendars", async () => {
      const rateLimitResponse = new Response(
        JSON.stringify({ error: "Too many requests" }),
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "100",
            "X-RateLimit-Remaining": "0",
            "Retry-After": "60",
          },
        }
      );
      mockApplyRateLimit.mockResolvedValue({
        response: rateLimitResponse,
        headers: rateLimitResponse.headers,
      });

      const { GET } = await import(
        "@/app/api/integrations/calendar/calendars/route"
      );
      const request = createMockRequest(
        "GET",
        "/api/integrations/calendar/calendars"
      );
      const response = await GET(request);

      expect(response.status).toBe(429);
    });

    it("should include rate limit headers in successful responses", async () => {
      const { GET } = await import(
        "@/app/api/integrations/calendar/connect/route"
      );
      const request = createMockRequest(
        "GET",
        "/api/integrations/calendar/connect"
      );
      const response = await GET(request);

      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Approval Workflow Tests
  // ═══════════════════════════════════════════════════════════

  describe("Approval Workflow", () => {
    describe("GET /api/integrations/calendar/approvals/[id]", () => {
      it("should return 404 when approval not found", async () => {
        mockGetApproval.mockResolvedValue(null);

        const { GET } = await import(
          "@/app/api/integrations/calendar/approvals/[id]/route"
        );
        const request = createMockRequest(
          "GET",
          "/api/integrations/calendar/approvals/nonexistent"
        );
        const response = await GET(request, {
          params: Promise.resolve({ id: "nonexistent" }),
        });
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe("Approval not found");
      });

      it("should return approval when found", async () => {
        const approval = createMockDbApproval({
          id: "approval-1",
          actionType: "create",
          status: "pending",
        });
        mockGetApproval.mockResolvedValue(approval);

        const { GET } = await import(
          "@/app/api/integrations/calendar/approvals/[id]/route"
        );
        const request = createMockRequest(
          "GET",
          "/api/integrations/calendar/approvals/approval-1"
        );
        const response = await GET(request, {
          params: Promise.resolve({ id: "approval-1" }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.approval).toBeDefined();
        expect(data.approval.id).toBe("approval-1");
      });
    });

    describe("POST /api/integrations/calendar/approvals/[id]", () => {
      it("should approve action successfully", async () => {
        const approval = createMockDbApproval({
          id: "approval-1",
          status: "approved",
        });
        mockApproveCalendarAction.mockResolvedValue({
          success: true,
          message: "Action approved",
          approval,
        });

        const { POST } = await import(
          "@/app/api/integrations/calendar/approvals/[id]/route"
        );
        const request = createMockRequest(
          "POST",
          "/api/integrations/calendar/approvals/approval-1",
          { action: "approve" }
        );
        const response = await POST(request, {
          params: Promise.resolve({ id: "approval-1" }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(mockApproveCalendarAction).toHaveBeenCalledWith(
          "test-user-id",
          "approval-1",
          expect.objectContaining({ autoExecute: true })
        );
      });

      it("should reject action successfully", async () => {
        const approval = createMockDbApproval({
          id: "approval-1",
          status: "rejected",
        });
        mockRejectCalendarAction.mockResolvedValue({
          success: true,
          message: "Action rejected",
          approval,
        });

        const { POST } = await import(
          "@/app/api/integrations/calendar/approvals/[id]/route"
        );
        const request = createMockRequest(
          "POST",
          "/api/integrations/calendar/approvals/approval-1",
          { action: "reject", notes: "Not needed" }
        );
        const response = await POST(request, {
          params: Promise.resolve({ id: "approval-1" }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(mockRejectCalendarAction).toHaveBeenCalledWith(
          "test-user-id",
          "approval-1",
          expect.objectContaining({ notes: "Not needed" })
        );
      });

      it("should cancel approval successfully", async () => {
        mockCancelApproval.mockResolvedValue({
          success: true,
          message: "Approval cancelled",
        });

        const { POST } = await import(
          "@/app/api/integrations/calendar/approvals/[id]/route"
        );
        const request = createMockRequest(
          "POST",
          "/api/integrations/calendar/approvals/approval-1",
          { action: "cancel" }
        );
        const response = await POST(request, {
          params: Promise.resolve({ id: "approval-1" }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(mockCancelApproval).toHaveBeenCalledWith(
          "test-user-id",
          "approval-1"
        );
      });

      it("should return 400 for invalid action", async () => {
        const { POST } = await import(
          "@/app/api/integrations/calendar/approvals/[id]/route"
        );
        const request = createMockRequest(
          "POST",
          "/api/integrations/calendar/approvals/approval-1",
          { action: "invalid" }
        );
        const response = await POST(request, {
          params: Promise.resolve({ id: "approval-1" }),
        });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Validation failed");
        expect(data.details).toBeDefined();
      });

      it("should return 400 when approval action fails", async () => {
        mockApproveCalendarAction.mockResolvedValue({
          success: false,
          message: "Approval has expired",
        });

        const { POST } = await import(
          "@/app/api/integrations/calendar/approvals/[id]/route"
        );
        const request = createMockRequest(
          "POST",
          "/api/integrations/calendar/approvals/approval-1",
          { action: "approve" }
        );
        const response = await POST(request, {
          params: Promise.resolve({ id: "approval-1" }),
        });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Approval has expired");
      });

      it("should pass autoExecute=false when specified", async () => {
        mockApproveCalendarAction.mockResolvedValue({
          success: true,
          message: "Approved without executing",
          approval: createMockDbApproval({ status: "approved" }),
        });

        const { POST } = await import(
          "@/app/api/integrations/calendar/approvals/[id]/route"
        );
        const request = createMockRequest(
          "POST",
          "/api/integrations/calendar/approvals/approval-1",
          { action: "approve", autoExecute: false }
        );
        const response = await POST(request, {
          params: Promise.resolve({ id: "approval-1" }),
        });

        expect(response.status).toBe(200);
        expect(mockApproveCalendarAction).toHaveBeenCalledWith(
          "test-user-id",
          "approval-1",
          expect.objectContaining({ autoExecute: false })
        );
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Calendar Filtering Tests
  // ═══════════════════════════════════════════════════════════

  describe("Calendar Filtering", () => {
    it("should filter hidden calendars by default", async () => {
      const mockCalendars = [
        createMockDbCalendar({ name: "Visible", isHidden: false }),
        createMockDbCalendar({ name: "Hidden", isHidden: true }),
      ];
      mockCalendarRepository.findByUser.mockResolvedValue(mockCalendars);

      const { GET } = await import(
        "@/app/api/integrations/calendar/calendars/route"
      );
      const request = createMockRequest(
        "GET",
        "/api/integrations/calendar/calendars"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.calendars).toHaveLength(1);
      expect(data.calendars[0].name).toBe("Visible");
    });

    it("should include hidden calendars when requested", async () => {
      const mockCalendars = [
        createMockDbCalendar({ name: "Visible", isHidden: false }),
        createMockDbCalendar({ name: "Hidden", isHidden: true }),
      ];
      mockCalendarRepository.findByUser.mockResolvedValue(mockCalendars);

      const { GET } = await import(
        "@/app/api/integrations/calendar/calendars/route"
      );
      const request = createMockRequest(
        "GET",
        "/api/integrations/calendar/calendars?includeHidden=true"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.calendars).toHaveLength(2);
    });

    it("should filter to selected calendars only when requested", async () => {
      const mockCalendars = [
        createMockDbCalendar({ name: "Selected", isSelected: true }),
        createMockDbCalendar({ name: "Not Selected", isSelected: false }),
      ];
      mockCalendarRepository.findByUser.mockResolvedValue(mockCalendars);

      const { GET } = await import(
        "@/app/api/integrations/calendar/calendars/route"
      );
      const request = createMockRequest(
        "GET",
        "/api/integrations/calendar/calendars?selectedOnly=true"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.calendars).toHaveLength(1);
      expect(data.calendars[0].name).toBe("Selected");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Auto-Sync on Connect Tests
  // ═══════════════════════════════════════════════════════════

  describe("Auto-Sync on Connect", () => {
    it("should start recurring sync for returning connected user", async () => {
      mockHasRecurringSyncActive.mockResolvedValue(false);

      const { POST } = await import(
        "@/app/api/integrations/calendar/connect/route"
      );
      const request = createMockRequest(
        "POST",
        "/api/integrations/calendar/connect"
      );
      await POST(request);

      expect(mockStartRecurringSync).toHaveBeenCalled();
      expect(mockScheduleIncrementalSync).toHaveBeenCalled();
    });

    it("should not start recurring sync if already active", async () => {
      mockHasRecurringSyncActive.mockResolvedValue(true);

      const { POST } = await import(
        "@/app/api/integrations/calendar/connect/route"
      );
      const request = createMockRequest(
        "POST",
        "/api/integrations/calendar/connect"
      );
      await POST(request);

      expect(mockStartRecurringSync).not.toHaveBeenCalled();
      expect(mockScheduleIncrementalSync).not.toHaveBeenCalled();
    });

    it("should not fail if sync scheduling fails", async () => {
      mockHasRecurringSyncActive.mockRejectedValue(new Error("Queue error"));

      const { POST } = await import(
        "@/app/api/integrations/calendar/connect/route"
      );
      const request = createMockRequest(
        "POST",
        "/api/integrations/calendar/connect"
      );
      const response = await POST(request);
      const data = await response.json();

      // Should still return success
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.alreadyConnected).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Error Handling Tests
  // ═══════════════════════════════════════════════════════════

  describe("Error Handling", () => {
    it("should handle repository errors gracefully", async () => {
      mockCalendarRepository.findByUser.mockRejectedValue(
        new Error("Database error")
      );

      const { GET } = await import(
        "@/app/api/integrations/calendar/calendars/route"
      );
      const request = createMockRequest(
        "GET",
        "/api/integrations/calendar/calendars"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Database error");
    });

    it("should handle disconnect revocation errors", async () => {
      mockIsCalendarConnected.mockResolvedValue(true);
      mockRevokeCalendarAccess.mockResolvedValue({
        success: false,
        error: "Token revocation failed",
      });

      const { DELETE } = await import(
        "@/app/api/integrations/calendar/disconnect/route"
      );
      const request = createMockRequest(
        "DELETE",
        "/api/integrations/calendar/disconnect"
      );
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Token revocation failed");
    });
  });
});

