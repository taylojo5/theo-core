import { describe, it, expect } from "vitest";
import {
  parseScopes,
  formatScopes,
  hasScope,
  hasAllScopes,
  getMissingScopes,
  hasGmailReadAccess,
  hasGmailSendAccess,
  hasContactsAccess,
  getIntegrationStatus,
  getScopeDescription,
  GMAIL_SCOPES,
  ALL_GMAIL_SCOPES,
  BASE_SCOPES,
  SCOPE_SETS,
} from "@/lib/auth/scopes";

describe("Scope Utilities", () => {
  describe("parseScopes", () => {
    it("should parse space-separated scopes", () => {
      const result = parseScopes("openid email profile");
      expect(result).toEqual(["openid", "email", "profile"]);
    });

    it("should handle empty string", () => {
      const result = parseScopes("");
      expect(result).toEqual([]);
    });

    it("should handle null/undefined", () => {
      expect(parseScopes(null)).toEqual([]);
      expect(parseScopes(undefined)).toEqual([]);
    });

    it("should filter empty strings", () => {
      const result = parseScopes("openid  email   profile");
      expect(result).toEqual(["openid", "email", "profile"]);
    });
  });

  describe("formatScopes", () => {
    it("should format scopes to space-separated string", () => {
      const result = formatScopes(["openid", "email", "profile"]);
      expect(result).toBe("openid email profile");
    });

    it("should handle empty array", () => {
      const result = formatScopes([]);
      expect(result).toBe("");
    });

    it("should handle readonly arrays", () => {
      const result = formatScopes(BASE_SCOPES);
      expect(result).toBe("openid email profile");
    });
  });

  describe("hasScope", () => {
    const grantedScopes = [GMAIL_SCOPES.READONLY, GMAIL_SCOPES.LABELS];

    it("should return true if scope is granted", () => {
      expect(hasScope(grantedScopes, GMAIL_SCOPES.READONLY)).toBe(true);
    });

    it("should return false if scope is not granted", () => {
      expect(hasScope(grantedScopes, GMAIL_SCOPES.SEND)).toBe(false);
    });
  });

  describe("hasAllScopes", () => {
    const grantedScopes = [
      GMAIL_SCOPES.READONLY,
      GMAIL_SCOPES.LABELS,
      GMAIL_SCOPES.SEND,
    ];

    it("should return true if all scopes are granted", () => {
      expect(
        hasAllScopes(grantedScopes, [GMAIL_SCOPES.READONLY, GMAIL_SCOPES.SEND])
      ).toBe(true);
    });

    it("should return false if any scope is missing", () => {
      expect(
        hasAllScopes(grantedScopes, [
          GMAIL_SCOPES.READONLY,
          GMAIL_SCOPES.CONTACTS_READONLY,
        ])
      ).toBe(false);
    });

    it("should return true for empty required scopes", () => {
      expect(hasAllScopes(grantedScopes, [])).toBe(true);
    });
  });

  describe("getMissingScopes", () => {
    const grantedScopes = [GMAIL_SCOPES.READONLY, GMAIL_SCOPES.LABELS];

    it("should return missing scopes", () => {
      const missing = getMissingScopes(grantedScopes, ALL_GMAIL_SCOPES);
      expect(missing).toContain(GMAIL_SCOPES.SEND);
      expect(missing).toContain(GMAIL_SCOPES.CONTACTS_READONLY);
      expect(missing).not.toContain(GMAIL_SCOPES.READONLY);
      expect(missing).not.toContain(GMAIL_SCOPES.LABELS);
    });

    it("should return empty array if all scopes granted", () => {
      const missing = getMissingScopes([...ALL_GMAIL_SCOPES], ALL_GMAIL_SCOPES);
      expect(missing).toEqual([]);
    });

    it("should return all required scopes if none granted", () => {
      const missing = getMissingScopes([], ALL_GMAIL_SCOPES);
      expect(missing).toEqual([...ALL_GMAIL_SCOPES]);
    });
  });

  describe("hasGmailReadAccess", () => {
    it("should return true with read scopes", () => {
      const scopes = [GMAIL_SCOPES.READONLY, GMAIL_SCOPES.LABELS];
      expect(hasGmailReadAccess(scopes)).toBe(true);
    });

    it("should return false without labels scope", () => {
      const scopes = [GMAIL_SCOPES.READONLY];
      expect(hasGmailReadAccess(scopes)).toBe(false);
    });

    it("should return false with empty scopes", () => {
      expect(hasGmailReadAccess([])).toBe(false);
    });
  });

  describe("hasGmailSendAccess", () => {
    it("should return true with send scope", () => {
      const scopes = [GMAIL_SCOPES.SEND];
      expect(hasGmailSendAccess(scopes)).toBe(true);
    });

    it("should return false without send scope", () => {
      const scopes = [GMAIL_SCOPES.READONLY, GMAIL_SCOPES.LABELS];
      expect(hasGmailSendAccess(scopes)).toBe(false);
    });
  });

  describe("hasContactsAccess", () => {
    it("should return true with contacts scope", () => {
      const scopes = [GMAIL_SCOPES.CONTACTS_READONLY];
      expect(hasContactsAccess(scopes)).toBe(true);
    });

    it("should return false without contacts scope", () => {
      const scopes = [GMAIL_SCOPES.READONLY];
      expect(hasContactsAccess(scopes)).toBe(false);
    });
  });

  describe("getScopeDescription", () => {
    it("should return human-readable description for known scopes", () => {
      expect(getScopeDescription(GMAIL_SCOPES.READONLY)).toBe(
        "Read your emails"
      );
      expect(getScopeDescription(GMAIL_SCOPES.SEND)).toBe(
        "Send emails on your behalf"
      );
      expect(getScopeDescription(GMAIL_SCOPES.CONTACTS_READONLY)).toBe(
        "View your contacts"
      );
    });

    it("should return the scope itself for unknown scopes", () => {
      expect(getScopeDescription("unknown-scope")).toBe("unknown-scope");
    });
  });

  describe("getIntegrationStatus", () => {
    it("should return all features enabled with full scopes", () => {
      const status = getIntegrationStatus([...ALL_GMAIL_SCOPES]);

      expect(status.gmail.connected).toBe(true);
      expect(status.gmail.canRead).toBe(true);
      expect(status.gmail.canSend).toBe(true);
      expect(status.gmail.canManageLabels).toBe(true);
      expect(status.contacts.connected).toBe(true);
      expect(status.missingScopes).toEqual([]);
    });

    it("should return partial features with limited scopes", () => {
      const status = getIntegrationStatus([
        GMAIL_SCOPES.READONLY,
        GMAIL_SCOPES.LABELS,
      ]);

      expect(status.gmail.connected).toBe(true);
      expect(status.gmail.canRead).toBe(true);
      expect(status.gmail.canSend).toBe(false);
      expect(status.gmail.canManageLabels).toBe(true);
      expect(status.contacts.connected).toBe(false);
      expect(status.missingScopes).toContain(GMAIL_SCOPES.SEND);
      expect(status.missingScopes).toContain(GMAIL_SCOPES.CONTACTS_READONLY);
    });

    it("should return disconnected with no scopes", () => {
      const status = getIntegrationStatus([]);

      expect(status.gmail.connected).toBe(false);
      expect(status.gmail.canRead).toBe(false);
      expect(status.gmail.canSend).toBe(false);
      expect(status.gmail.canManageLabels).toBe(false);
      expect(status.contacts.connected).toBe(false);
      expect(status.missingScopes).toEqual([...ALL_GMAIL_SCOPES]);
    });
  });

  describe("Scope Constants", () => {
    it("should have correct Gmail scope URLs", () => {
      expect(GMAIL_SCOPES.READONLY).toBe(
        "https://www.googleapis.com/auth/gmail.readonly"
      );
      expect(GMAIL_SCOPES.SEND).toBe(
        "https://www.googleapis.com/auth/gmail.send"
      );
      expect(GMAIL_SCOPES.LABELS).toBe(
        "https://www.googleapis.com/auth/gmail.labels"
      );
      expect(GMAIL_SCOPES.CONTACTS_READONLY).toBe(
        "https://www.googleapis.com/auth/contacts.readonly"
      );
    });

    it("should have all Gmail scopes in ALL_GMAIL_SCOPES", () => {
      expect(ALL_GMAIL_SCOPES).toContain(GMAIL_SCOPES.READONLY);
      expect(ALL_GMAIL_SCOPES).toContain(GMAIL_SCOPES.SEND);
      expect(ALL_GMAIL_SCOPES).toContain(GMAIL_SCOPES.LABELS);
      expect(ALL_GMAIL_SCOPES).toContain(GMAIL_SCOPES.CONTACTS_READONLY);
      expect(ALL_GMAIL_SCOPES.length).toBe(4);
    });

    it("should have base scopes for auth", () => {
      expect(BASE_SCOPES).toContain("openid");
      expect(BASE_SCOPES).toContain("email");
      expect(BASE_SCOPES).toContain("profile");
    });

    it("should have scope sets with correct scopes", () => {
      expect(SCOPE_SETS.basic).toEqual([...BASE_SCOPES]);
      expect(SCOPE_SETS.gmailReadOnly).toContain(GMAIL_SCOPES.READONLY);
      expect(SCOPE_SETS.gmailReadOnly).not.toContain(GMAIL_SCOPES.SEND);
      expect(SCOPE_SETS.gmailFull).toContain(GMAIL_SCOPES.SEND);
    });
  });
});
