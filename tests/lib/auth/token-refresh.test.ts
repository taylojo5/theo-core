// ═══════════════════════════════════════════════════════════════════════════
// Token Refresh - Unit Tests
// Tests for OAuth token refresh functionality
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("@/lib/db", () => ({
  db: {
    account: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock fetch for token refresh
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocking
import { db } from "@/lib/db";
import {
  refreshGoogleToken,
  getValidAccessToken,
  checkTokenHealth,
  forceTokenRefresh,
} from "@/lib/auth/token-refresh";

// ─────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────

const mockUserId = "user-123";
const mockAccountId = "account-456";
const mockAccessToken = "ya29.mock-access-token";
const mockRefreshToken = "1//mock-refresh-token";
const mockNewAccessToken = "ya29.new-mock-access-token";

const nowSeconds = Math.floor(Date.now() / 1000);

const mockAccount = {
  id: mockAccountId,
  userId: mockUserId,
  provider: "google",
  access_token: mockAccessToken,
  refresh_token: mockRefreshToken,
  expires_at: nowSeconds + 3600, // Expires in 1 hour
};

const mockExpiredAccount = {
  ...mockAccount,
  expires_at: nowSeconds - 100, // Expired 100 seconds ago
};

const mockExpiringAccount = {
  ...mockAccount,
  expires_at: nowSeconds + 200, // Expires in ~3 minutes (within buffer)
};

// ─────────────────────────────────────────────────────────────
// refreshGoogleToken Tests
// ─────────────────────────────────────────────────────────────

describe("refreshGoogleToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  });

  it("should successfully refresh token", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: mockNewAccessToken,
          expires_in: 3600,
        }),
    });

    const result = await refreshGoogleToken(mockRefreshToken);

    expect(result.success).toBe(true);
    expect(result.accessToken).toBe(mockNewAccessToken);
    expect(result.expiresAt).toBeDefined();
    expect(result.expiresAt).toBeGreaterThan(nowSeconds);
  });

  it("should return error when credentials missing", async () => {
    delete process.env.GOOGLE_CLIENT_ID;

    const result = await refreshGoogleToken(mockRefreshToken);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Missing Google OAuth credentials");
  });

  it("should return error when token refresh fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () =>
        Promise.resolve({
          error: "invalid_grant",
          error_description: "Token has been revoked",
        }),
    });

    const result = await refreshGoogleToken(mockRefreshToken);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Token has been revoked");
  });

  it("should handle network errors", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const result = await refreshGoogleToken(mockRefreshToken);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Network error");
  });
});

// ─────────────────────────────────────────────────────────────
// getValidAccessToken Tests
// ─────────────────────────────────────────────────────────────

describe("getValidAccessToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  });

  it("should return existing token if still valid", async () => {
    vi.mocked(db.account.findFirst).mockResolvedValue(mockAccount as never);

    const token = await getValidAccessToken(mockUserId);

    expect(token).toBe(mockAccessToken);
    expect(db.account.update).not.toHaveBeenCalled();
  });

  it("should refresh token if expired", async () => {
    vi.mocked(db.account.findFirst).mockResolvedValue(
      mockExpiredAccount as never
    );
    vi.mocked(db.account.update).mockResolvedValue(mockAccount as never);

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: mockNewAccessToken,
          expires_in: 3600,
        }),
    });

    const token = await getValidAccessToken(mockUserId);

    expect(token).toBe(mockNewAccessToken);
    expect(db.account.update).toHaveBeenCalled();
  });

  it("should refresh token if expiring soon (within buffer)", async () => {
    vi.mocked(db.account.findFirst).mockResolvedValue(
      mockExpiringAccount as never
    );
    vi.mocked(db.account.update).mockResolvedValue(mockAccount as never);

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: mockNewAccessToken,
          expires_in: 3600,
        }),
    });

    const token = await getValidAccessToken(mockUserId);

    expect(token).toBe(mockNewAccessToken);
    expect(db.account.update).toHaveBeenCalled();
  });

  it("should return null if no account found", async () => {
    vi.mocked(db.account.findFirst).mockResolvedValue(null);

    const token = await getValidAccessToken(mockUserId);

    expect(token).toBeNull();
  });

  it("should return null if no refresh token available", async () => {
    vi.mocked(db.account.findFirst).mockResolvedValue({
      ...mockExpiredAccount,
      refresh_token: null,
    } as never);

    const token = await getValidAccessToken(mockUserId);

    expect(token).toBeNull();
  });

  it("should return null if refresh fails", async () => {
    vi.mocked(db.account.findFirst).mockResolvedValue(
      mockExpiredAccount as never
    );

    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "invalid_grant" }),
    });

    const token = await getValidAccessToken(mockUserId);

    expect(token).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// checkTokenHealth Tests
// ─────────────────────────────────────────────────────────────

describe("checkTokenHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should report healthy token", async () => {
    vi.mocked(db.account.findFirst).mockResolvedValue(mockAccount as never);

    const health = await checkTokenHealth(mockUserId);

    expect(health.hasAccount).toBe(true);
    expect(health.hasRefreshToken).toBe(true);
    expect(health.hasAccessToken).toBe(true);
    expect(health.isExpired).toBe(false);
    expect(health.expiresIn).toBeGreaterThan(0);
    expect(health.expiresInHuman).toBeDefined();
  });

  it("should report expired token", async () => {
    vi.mocked(db.account.findFirst).mockResolvedValue(
      mockExpiredAccount as never
    );

    const health = await checkTokenHealth(mockUserId);

    expect(health.isExpired).toBe(true);
    expect(health.expiresIn).toBe(0);
    expect(health.expiresInHuman).toBe("expired");
  });

  it("should report no account", async () => {
    vi.mocked(db.account.findFirst).mockResolvedValue(null);

    const health = await checkTokenHealth(mockUserId);

    expect(health.hasAccount).toBe(false);
    expect(health.hasRefreshToken).toBe(false);
    expect(health.hasAccessToken).toBe(false);
    expect(health.isExpired).toBe(true);
  });

  it("should report missing refresh token", async () => {
    vi.mocked(db.account.findFirst).mockResolvedValue({
      ...mockAccount,
      refresh_token: null,
    } as never);

    const health = await checkTokenHealth(mockUserId);

    expect(health.hasAccount).toBe(true);
    expect(health.hasRefreshToken).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// forceTokenRefresh Tests
// ─────────────────────────────────────────────────────────────

describe("forceTokenRefresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  });

  it("should force refresh even if token is valid", async () => {
    vi.mocked(db.account.findFirst).mockResolvedValue(mockAccount as never);
    vi.mocked(db.account.update).mockResolvedValue(mockAccount as never);

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: mockNewAccessToken,
          expires_in: 3600,
        }),
    });

    const result = await forceTokenRefresh(mockUserId);

    expect(result.success).toBe(true);
    expect(result.accessToken).toBe(mockNewAccessToken);
    expect(db.account.update).toHaveBeenCalled();
  });

  it("should return error if no account", async () => {
    vi.mocked(db.account.findFirst).mockResolvedValue(null);

    const result = await forceTokenRefresh(mockUserId);

    expect(result.success).toBe(false);
    expect(result.error).toContain("No Google account found");
  });

  it("should return error if no refresh token", async () => {
    vi.mocked(db.account.findFirst).mockResolvedValue({
      ...mockAccount,
      refresh_token: null,
    } as never);

    const result = await forceTokenRefresh(mockUserId);

    expect(result.success).toBe(false);
    expect(result.error).toContain("No refresh token available");
  });
});
