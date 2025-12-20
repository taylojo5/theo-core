import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getUserGrantedScopes,
  checkUserScopes,
  checkGmailScopes,
  generateUpgradeUrl,
  generateScopeSetUpgradeUrl,
  updateUserScopes,
  removeUserScopes,
  isGmailConnected,
} from "@/lib/auth/scope-upgrade";
import {
  GMAIL_SCOPES,
  ALL_GMAIL_SCOPES,
  formatScopes,
} from "@/lib/auth/scopes";
import { db } from "@/lib/db";

// Mock the database
vi.mock("@/lib/db", () => ({
  db: {
    account: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    connectedAccount: {
      deleteMany: vi.fn(),
    },
  },
}));

describe("Scope Upgrade Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock environment variables
    vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
    vi.stubEnv("NEXTAUTH_URL", "http://localhost:3000");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("getUserGrantedScopes", () => {
    it("should return parsed scopes for existing account", async () => {
      vi.mocked(db.account.findFirst).mockResolvedValue({
        scope: `openid email profile ${GMAIL_SCOPES.READONLY}`,
      } as never);

      const scopes = await getUserGrantedScopes("user-123");

      expect(scopes).toEqual([
        "openid",
        "email",
        "profile",
        GMAIL_SCOPES.READONLY,
      ]);
    });

    it("should return null for non-existent account", async () => {
      vi.mocked(db.account.findFirst).mockResolvedValue(null as never);

      const scopes = await getUserGrantedScopes("user-123");

      expect(scopes).toBeNull();
    });

    it("should return empty array for account with no scopes", async () => {
      vi.mocked(db.account.findFirst).mockResolvedValue({
        scope: "",
      } as never);

      const scopes = await getUserGrantedScopes("user-123");

      expect(scopes).toEqual([]);
    });
  });

  describe("checkUserScopes", () => {
    it("should return hasRequiredScopes true when all scopes granted", async () => {
      vi.mocked(db.account.findFirst).mockResolvedValue({
        scope: formatScopes(ALL_GMAIL_SCOPES),
      } as never);

      const result = await checkUserScopes("user-123", ALL_GMAIL_SCOPES);

      expect(result.hasRequiredScopes).toBe(true);
      expect(result.missingScopes).toEqual([]);
      expect(result.upgradeUrl).toBeUndefined();
    });

    it("should return missing scopes and upgrade URL when scopes missing", async () => {
      vi.mocked(db.account.findFirst).mockResolvedValue({
        scope: GMAIL_SCOPES.READONLY,
      } as never);

      const result = await checkUserScopes("user-123", ALL_GMAIL_SCOPES);

      expect(result.hasRequiredScopes).toBe(false);
      expect(result.missingScopes).toContain(GMAIL_SCOPES.SEND);
      expect(result.upgradeUrl).toBeDefined();
      expect(result.upgradeUrl).toContain("accounts.google.com");
    });

    it("should return all scopes as missing for non-existent account", async () => {
      vi.mocked(db.account.findFirst).mockResolvedValue(null as never);

      const result = await checkUserScopes("user-123", ALL_GMAIL_SCOPES);

      expect(result.hasRequiredScopes).toBe(false);
      expect(result.grantedScopes).toEqual([]);
      expect(result.missingScopes).toEqual([...ALL_GMAIL_SCOPES]);
    });
  });

  describe("checkGmailScopes", () => {
    it("should check all Gmail scopes", async () => {
      vi.mocked(db.account.findFirst).mockResolvedValue({
        scope: formatScopes(ALL_GMAIL_SCOPES),
      } as never);

      const result = await checkGmailScopes("user-123");

      expect(result.hasRequiredScopes).toBe(true);
      expect(result.missingScopes).toEqual([]);
    });
  });

  describe("generateUpgradeUrl", () => {
    it("should generate valid Google OAuth URL", () => {
      const url = generateUpgradeUrl(ALL_GMAIL_SCOPES);
      const parsedUrl = new URL(url);

      expect(parsedUrl.hostname).toBe("accounts.google.com");
      expect(parsedUrl.pathname).toBe("/o/oauth2/v2/auth");
      expect(parsedUrl.searchParams.get("client_id")).toBe("test-client-id");
      expect(parsedUrl.searchParams.get("access_type")).toBe("offline");
      expect(parsedUrl.searchParams.get("prompt")).toBe("consent");
      expect(parsedUrl.searchParams.get("include_granted_scopes")).toBe("true");
    });

    it("should include all requested scopes", () => {
      const url = generateUpgradeUrl(ALL_GMAIL_SCOPES);
      const parsedUrl = new URL(url);
      const scopes = parsedUrl.searchParams.get("scope")!;

      for (const scope of ALL_GMAIL_SCOPES) {
        expect(scopes).toContain(scope);
      }
    });

    it("should include state parameter when provided", () => {
      const url = generateUpgradeUrl(ALL_GMAIL_SCOPES, "test-state");
      const parsedUrl = new URL(url);

      expect(parsedUrl.searchParams.get("state")).toBe("test-state");
    });

    it("should throw when GOOGLE_CLIENT_ID is not set", () => {
      vi.stubEnv("GOOGLE_CLIENT_ID", "");

      expect(() => generateUpgradeUrl(ALL_GMAIL_SCOPES)).toThrow(
        "GOOGLE_CLIENT_ID is not configured"
      );
    });
  });

  describe("generateScopeSetUpgradeUrl", () => {
    it("should generate URL for basic scope set", () => {
      const url = generateScopeSetUpgradeUrl("basic");
      const parsedUrl = new URL(url);
      const scopes = parsedUrl.searchParams.get("scope")!;

      expect(scopes).toContain("openid");
      expect(scopes).toContain("email");
      expect(scopes).toContain("profile");
    });

    it("should generate URL for gmail-full scope set", () => {
      const url = generateScopeSetUpgradeUrl("gmailFull");
      const parsedUrl = new URL(url);
      const scopes = parsedUrl.searchParams.get("scope")!;

      expect(scopes).toContain(GMAIL_SCOPES.READONLY);
      expect(scopes).toContain(GMAIL_SCOPES.SEND);
    });
  });

  describe("updateUserScopes", () => {
    it("should merge new scopes with existing ones", async () => {
      vi.mocked(db.account.findFirst).mockResolvedValue({
        id: "account-123",
        scope: "openid email",
      } as never);
      vi.mocked(db.account.update).mockResolvedValue({} as never);

      const result = await updateUserScopes("user-123", [
        GMAIL_SCOPES.READONLY,
      ]);

      expect(result.success).toBe(true);
      expect(db.account.update).toHaveBeenCalledWith({
        where: { id: "account-123" },
        data: {
          scope: expect.stringContaining(GMAIL_SCOPES.READONLY),
        },
      });
    });

    it("should return error when no account found", async () => {
      vi.mocked(db.account.findFirst).mockResolvedValue(null as never);

      const result = await updateUserScopes("user-123", [
        GMAIL_SCOPES.READONLY,
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toBe("No Google account found for user");
    });

    it("should deduplicate scopes", async () => {
      vi.mocked(db.account.findFirst).mockResolvedValue({
        id: "account-123",
        scope: `openid ${GMAIL_SCOPES.READONLY}`,
      } as never);
      vi.mocked(db.account.update).mockResolvedValue({} as never);

      await updateUserScopes("user-123", [GMAIL_SCOPES.READONLY, "openid"]);

      const updateCall = vi.mocked(db.account.update).mock.calls[0][0];
      const scopes = (updateCall.data.scope as string).split(" ");
      const uniqueScopes = [...new Set(scopes)];
      expect(scopes.length).toBe(uniqueScopes.length);
    });
  });

  describe("removeUserScopes", () => {
    it("should remove specified scopes", async () => {
      vi.mocked(db.account.findFirst).mockResolvedValue({
        id: "account-123",
        scope: `openid email ${GMAIL_SCOPES.READONLY} ${GMAIL_SCOPES.SEND}`,
      } as never);
      vi.mocked(db.account.update).mockResolvedValue({} as never);

      const result = await removeUserScopes("user-123", [GMAIL_SCOPES.SEND]);

      expect(result.success).toBe(true);
      expect(db.account.update).toHaveBeenCalledWith({
        where: { id: "account-123" },
        data: {
          scope: expect.not.stringContaining(GMAIL_SCOPES.SEND),
        },
      });
    });

    it("should return error when no account found", async () => {
      vi.mocked(db.account.findFirst).mockResolvedValue(null as never);

      const result = await removeUserScopes("user-123", [GMAIL_SCOPES.SEND]);

      expect(result.success).toBe(false);
      expect(result.error).toBe("No Google account found for user");
    });
  });

  describe("isGmailConnected", () => {
    it("should return true when all Gmail scopes are granted", async () => {
      vi.mocked(db.account.findFirst).mockResolvedValue({
        scope: formatScopes(ALL_GMAIL_SCOPES),
      } as never);

      const connected = await isGmailConnected("user-123");

      expect(connected).toBe(true);
    });

    it("should return false when scopes are missing", async () => {
      vi.mocked(db.account.findFirst).mockResolvedValue({
        scope: GMAIL_SCOPES.READONLY,
      } as never);

      const connected = await isGmailConnected("user-123");

      expect(connected).toBe(false);
    });

    it("should return false when no account exists", async () => {
      vi.mocked(db.account.findFirst).mockResolvedValue(null as never);

      const connected = await isGmailConnected("user-123");

      expect(connected).toBe(false);
    });
  });
});
