// ═══════════════════════════════════════════════════════════════════════════
// Agent User Config Repository
// Database operations for per-user agent configuration
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import type { AgentUserConfig, Prisma } from "@prisma/client";
import { getLogger } from "@/lib/logging";
import type {
  AgentRateLimits,
  TokenLimits,
  ContentFilterConfig,
  AgentFeatureFlags,
  ConfidenceThresholds,
} from "./types";

const logger = getLogger("AgentConfigRepository");

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/**
 * Partial update input for agent user config
 * All fields are optional - only provided fields will be updated
 */
export interface AgentConfigUpdateInput {
  rateLimits?: Partial<AgentRateLimits>;
  tokenLimits?: Partial<TokenLimits>;
  contentFilterConfig?: Partial<ContentFilterConfig>;
  featureFlags?: Partial<AgentFeatureFlags>;
  confidenceThresholds?: Partial<ConfidenceThresholds>;
}

/**
 * Result of repository operations
 */
export interface RepositoryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// Repository Implementation
// ─────────────────────────────────────────────────────────────

class AgentConfigRepository {
  /**
   * Get agent config for a user, or null if not set
   */
  async findByUserId(userId: string): Promise<AgentUserConfig | null> {
    try {
      return await db.agentUserConfig.findUnique({
        where: { userId },
      });
    } catch (error) {
      logger.error("Failed to find agent config", { userId }, error);
      return null;
    }
  }

  /**
   * Create a new agent config for a user
   */
  async create(
    userId: string,
    config: AgentConfigUpdateInput = {}
  ): Promise<RepositoryResult<AgentUserConfig>> {
    try {
      const data = await db.agentUserConfig.create({
        data: {
          userId,
          rateLimits: (config.rateLimits ?? {}) as Prisma.InputJsonValue,
          tokenLimits: (config.tokenLimits ?? {}) as Prisma.InputJsonValue,
          contentFilterConfig: (config.contentFilterConfig ??
            {}) as Prisma.InputJsonValue,
          featureFlags: (config.featureFlags ?? {}) as Prisma.InputJsonValue,
          confidenceThresholds: (config.confidenceThresholds ??
            {}) as Prisma.InputJsonValue,
        },
      });

      logger.info("Created agent config", { userId, configId: data.id });
      return { success: true, data };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create agent config";
      logger.error("Failed to create agent config", { userId }, error);
      return { success: false, error: message };
    }
  }

  /**
   * Update an existing agent config
   * Merges provided fields with existing values
   */
  async update(
    userId: string,
    config: AgentConfigUpdateInput
  ): Promise<RepositoryResult<AgentUserConfig>> {
    try {
      // Get existing config to merge
      const existing = await this.findByUserId(userId);
      if (!existing) {
        return { success: false, error: "Agent config not found" };
      }

      // Merge each config section (use nullish coalescing to avoid spreading undefined)
      const mergedRateLimits = {
        ...(existing.rateLimits as object),
        ...(config.rateLimits ?? {}),
      };
      const mergedTokenLimits = {
        ...(existing.tokenLimits as object),
        ...(config.tokenLimits ?? {}),
      };
      const mergedContentFilterConfig = {
        ...(existing.contentFilterConfig as object),
        ...(config.contentFilterConfig ?? {}),
      };
      const mergedFeatureFlags = {
        ...(existing.featureFlags as object),
        ...(config.featureFlags ?? {}),
      };
      const mergedConfidenceThresholds = {
        ...(existing.confidenceThresholds as object),
        ...(config.confidenceThresholds ?? {}),
      };

      const data = await db.agentUserConfig.update({
        where: { userId },
        data: {
          rateLimits: mergedRateLimits as Prisma.InputJsonValue,
          tokenLimits: mergedTokenLimits as Prisma.InputJsonValue,
          contentFilterConfig: mergedContentFilterConfig as Prisma.InputJsonValue,
          featureFlags: mergedFeatureFlags as Prisma.InputJsonValue,
          confidenceThresholds: mergedConfidenceThresholds as Prisma.InputJsonValue,
        },
      });

      logger.info("Updated agent config", { userId, configId: data.id });
      return { success: true, data };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update agent config";
      logger.error("Failed to update agent config", { userId }, error);
      return { success: false, error: message };
    }
  }

  /**
   * Create or update agent config (upsert)
   * If config exists, merges with existing values
   * If not, creates new config
   */
  async upsert(
    userId: string,
    config: AgentConfigUpdateInput
  ): Promise<RepositoryResult<AgentUserConfig>> {
    try {
      const existing = await this.findByUserId(userId);

      if (existing) {
        return this.update(userId, config);
      } else {
        return this.create(userId, config);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to upsert agent config";
      logger.error("Failed to upsert agent config", { userId }, error);
      return { success: false, error: message };
    }
  }

  /**
   * Replace the entire config (no merging)
   */
  async replace(
    userId: string,
    config: AgentConfigUpdateInput
  ): Promise<RepositoryResult<AgentUserConfig>> {
    try {
      const data = await db.agentUserConfig.upsert({
        where: { userId },
        create: {
          userId,
          rateLimits: (config.rateLimits ?? {}) as Prisma.InputJsonValue,
          tokenLimits: (config.tokenLimits ?? {}) as Prisma.InputJsonValue,
          contentFilterConfig: (config.contentFilterConfig ??
            {}) as Prisma.InputJsonValue,
          featureFlags: (config.featureFlags ?? {}) as Prisma.InputJsonValue,
          confidenceThresholds: (config.confidenceThresholds ??
            {}) as Prisma.InputJsonValue,
        },
        update: {
          rateLimits: (config.rateLimits ?? {}) as Prisma.InputJsonValue,
          tokenLimits: (config.tokenLimits ?? {}) as Prisma.InputJsonValue,
          contentFilterConfig: (config.contentFilterConfig ??
            {}) as Prisma.InputJsonValue,
          featureFlags: (config.featureFlags ?? {}) as Prisma.InputJsonValue,
          confidenceThresholds: (config.confidenceThresholds ??
            {}) as Prisma.InputJsonValue,
        },
      });

      logger.info("Replaced agent config", { userId, configId: data.id });
      return { success: true, data };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to replace agent config";
      logger.error("Failed to replace agent config", { userId }, error);
      return { success: false, error: message };
    }
  }

  /**
   * Delete agent config for a user (revert to defaults)
   */
  async delete(userId: string): Promise<RepositoryResult<void>> {
    try {
      await db.agentUserConfig.delete({
        where: { userId },
      });

      logger.info("Deleted agent config", { userId });
      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete agent config";
      logger.error("Failed to delete agent config", { userId }, error);
      return { success: false, error: message };
    }
  }

  /**
   * Reset a specific config section to defaults (empty object)
   */
  async resetSection(
    userId: string,
    section:
      | "rateLimits"
      | "tokenLimits"
      | "contentFilterConfig"
      | "featureFlags"
      | "confidenceThresholds"
  ): Promise<RepositoryResult<AgentUserConfig>> {
    try {
      const data = await db.agentUserConfig.update({
        where: { userId },
        data: {
          [section]: {},
        },
      });

      logger.info("Reset agent config section", { userId, section });
      return { success: true, data };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to reset agent config section";
      logger.error("Failed to reset agent config section", { userId, section }, error);
      return { success: false, error: message };
    }
  }
}

// Export singleton instance
export const agentConfigRepository = new AgentConfigRepository();

