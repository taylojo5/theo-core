// ═══════════════════════════════════════════════════════════════════════════
// Integration Type Definitions
// Common types used across all integrations
// ═══════════════════════════════════════════════════════════════════════════

export type IntegrationProvider = "google" | "slack" | "microsoft";

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
}

export interface IntegrationCapability {
  name: string;
  type: "read" | "write" | "both";
  requiredScopes: string[];
  description: string;
}

export interface SyncOptions {
  fullSync?: boolean;
  maxItems?: number;
  since?: Date;
}

export interface SyncResult {
  success: boolean;
  itemsSynced: number;
  itemsCreated: number;
  itemsUpdated: number;
  errors: SyncError[];
  nextCursor?: string;
  completedAt: Date;
}

export interface SyncError {
  itemId?: string;
  message: string;
  retryable: boolean;
}

export interface IntegrationAction<TParams = unknown, TResult = unknown> {
  name: string;
  provider: IntegrationProvider;
  params: TParams;
  requiresApproval: boolean;
  execute(): Promise<TResult>;
}

/**
 * Base integration interface that all integrations must implement
 *
 * Note: OAuth authentication should be handled via NextAuth.js signIn():
 * ```typescript
 * import { signIn } from "next-auth/react";
 * signIn("google", { callbackUrl }, { scope: "...", prompt: "consent" });
 * ```
 */
export interface Integration {
  // Metadata
  id: string;
  name: string;
  provider: IntegrationProvider;
  description: string;

  // Capabilities
  capabilities: IntegrationCapability[];

  // Token management (server-side operations)
  refreshToken(refreshToken: string): Promise<TokenSet>;
  revokeAccess(): Promise<void>;

  // Connection status
  isConnected(): Promise<boolean>;
  getConnectionStatus(): Promise<{
    connected: boolean;
    expiresAt?: Date;
    scopes: string[];
  }>;

  // Sync
  sync(options?: SyncOptions): Promise<SyncResult>;
}

/**
 * Rate limit configuration per integration
 */
export interface RateLimitConfig {
  requestsPerSecond?: number;
  requestsPerMinute?: number;
  requestsPerDay?: number;
  burstLimit?: number;
}

export const RATE_LIMITS: Record<IntegrationProvider, RateLimitConfig> = {
  google: {
    requestsPerSecond: 10,
    requestsPerDay: 1_000_000_000, // Gmail quota units
  },
  slack: {
    requestsPerMinute: 50, // Tier 2 methods
    burstLimit: 5,
  },
  microsoft: {
    requestsPerMinute: 60,
  },
};

