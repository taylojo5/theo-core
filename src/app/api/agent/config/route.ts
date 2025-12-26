// ═══════════════════════════════════════════════════════════════════════════
// Agent Configuration API
// Manage per-user agent configuration settings
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";
import {
  agentConfigService,
  getDefaultAgentConfig,
  type AgentConfigUpdateInput,
} from "@/lib/agent/config";
import { getLogger } from "@/lib/logging";

const logger = getLogger("AgentConfigAPI");

// ─────────────────────────────────────────────────────────────
// GET /api/agent/config - Get effective agent config for current user
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.api
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers }
      );
    }

    const userId = session.user.id;

    // Get effective config (DB values merged with defaults)
    const config = await agentConfigService.getConfig(userId);

    // Also include defaults for reference
    const defaults = getDefaultAgentConfig();

    return NextResponse.json(
      {
        config,
        defaults,
        userId,
      },
      { headers }
    );
  } catch (error) {
    logger.error("Failed to get agent config", {}, error);
    return NextResponse.json(
      { error: "Failed to get agent configuration" },
      { status: 500, headers }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/agent/config - Update agent config (partial update)
// ─────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.api
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers }
      );
    }

    const userId = session.user.id;
    const body = await request.json();

    // Validate the update payload
    const updateInput: AgentConfigUpdateInput = {};

    if (body.rateLimits && typeof body.rateLimits === "object") {
      updateInput.rateLimits = validateRateLimits(body.rateLimits);
    }

    if (body.tokenLimits && typeof body.tokenLimits === "object") {
      updateInput.tokenLimits = validateTokenLimits(body.tokenLimits);
    }

    if (body.contentFilterConfig && typeof body.contentFilterConfig === "object") {
      updateInput.contentFilterConfig = validateContentFilterConfig(
        body.contentFilterConfig
      );
    }

    if (body.featureFlags && typeof body.featureFlags === "object") {
      updateInput.featureFlags = validateFeatureFlags(body.featureFlags);
    }

    if (body.confidenceThresholds && typeof body.confidenceThresholds === "object") {
      updateInput.confidenceThresholds = validateConfidenceThresholds(
        body.confidenceThresholds
      );
    }

    // Check if there's anything to update
    if (Object.keys(updateInput).length === 0) {
      return NextResponse.json(
        { error: "No valid configuration fields provided" },
        { status: 400, headers }
      );
    }

    // Update config
    const result = await agentConfigService.updateConfig(userId, updateInput);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to update configuration" },
        { status: 500, headers }
      );
    }

    // Return updated config
    const config = await agentConfigService.getConfig(userId);

    logger.info("Updated agent config", { userId });

    return NextResponse.json(
      {
        message: "Configuration updated successfully",
        config,
      },
      { headers }
    );
  } catch (error) {
    logger.error("Failed to update agent config", {}, error);
    return NextResponse.json(
      { error: "Failed to update agent configuration" },
      { status: 500, headers }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/agent/config - Reset agent config to defaults
// ─────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.api
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers }
      );
    }

    const userId = session.user.id;
    const searchParams = request.nextUrl.searchParams;
    const section = searchParams.get("section");

    if (section) {
      // Reset a specific section
      const validSections = [
        "rateLimits",
        "tokenLimits",
        "contentFilterConfig",
        "featureFlags",
        "confidenceThresholds",
      ] as const;

      if (!validSections.includes(section as typeof validSections[number])) {
        return NextResponse.json(
          { error: `Invalid section: ${section}` },
          { status: 400, headers }
        );
      }

      const result = await agentConfigService.resetSection(
        userId,
        section as typeof validSections[number]
      );

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Failed to reset section" },
          { status: 500, headers }
        );
      }

      logger.info("Reset agent config section", { userId, section });
    } else {
      // Reset entire config
      const result = await agentConfigService.resetConfig(userId);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Failed to reset configuration" },
          { status: 500, headers }
        );
      }

      logger.info("Reset agent config to defaults", { userId });
    }

    // Return default config
    const config = await agentConfigService.getConfig(userId);

    return NextResponse.json(
      {
        message: section
          ? `Section "${section}" reset to defaults`
          : "Configuration reset to defaults",
        config,
      },
      { headers }
    );
  } catch (error) {
    logger.error("Failed to reset agent config", {}, error);
    return NextResponse.json(
      { error: "Failed to reset agent configuration" },
      { status: 500, headers }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────

function validateRateLimits(input: Record<string, unknown>): Record<string, number> {
  const result: Record<string, number> = {};
  const validKeys = [
    "CHAT_PER_MINUTE",
    "ACTIONS_PER_MINUTE",
    "EXTERNAL_CALLS_PER_HOUR",
    "LLM_TOKENS_PER_HOUR",
    "MAX_CONCURRENT_PLANS",
    "MAX_PLAN_STEPS",
  ];

  for (const key of validKeys) {
    // Require > 0 to prevent users from accidentally blocking themselves
    if (key in input && typeof input[key] === "number" && input[key] > 0) {
      result[key] = input[key] as number;
    }
  }

  return result;
}

function validateTokenLimits(input: Record<string, unknown>): Record<string, number> {
  const result: Record<string, number> = {};
  const validKeys = [
    "MAX_CONVERSATION_CONTEXT",
    "MAX_RETRIEVED_CONTEXT",
    "MAX_SYSTEM_PROMPT",
    "MAX_TOOL_DESCRIPTIONS",
    "MAX_RESPONSE_TOKENS",
    "TARGET_REQUEST_BUDGET",
  ];

  for (const key of validKeys) {
    if (key in input && typeof input[key] === "number" && input[key] > 0) {
      result[key] = input[key] as number;
    }
  }

  return result;
}

function validateContentFilterConfig(
  input: Record<string, unknown>
): Record<string, boolean | number> {
  const result: Record<string, boolean | number> = {};

  const booleanKeys = ["SANITIZE_INPUT", "FILTER_OUTPUT", "DETECT_INJECTION"];
  const numberKeys = ["MAX_MESSAGE_LENGTH", "MAX_PROMPT_LENGTH"];

  for (const key of booleanKeys) {
    if (key in input && typeof input[key] === "boolean") {
      result[key] = input[key] as boolean;
    }
  }

  for (const key of numberKeys) {
    if (key in input && typeof input[key] === "number" && input[key] > 0) {
      result[key] = input[key] as number;
    }
  }

  return result;
}

function validateFeatureFlags(input: Record<string, unknown>): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  const validKeys = [
    "enablePlanning",
    "enableProactive",
    "enableLearning",
    "enableToolExecution",
    "enableAuditLogging",
    "enableStreaming",
  ];

  for (const key of validKeys) {
    if (key in input && typeof input[key] === "boolean") {
      result[key] = input[key] as boolean;
    }
  }

  return result;
}

function validateConfidenceThresholds(
  input: Record<string, unknown>
): Record<string, number> {
  const result: Record<string, number> = {};
  const validKeys = ["ACTION", "STATEMENT", "ASSUMPTION", "HIGH_RISK", "ENTITY_RESOLUTION"];

  for (const key of validKeys) {
    const value = input[key];
    if (
      key in input &&
      typeof value === "number" &&
      value >= 0 &&
      value <= 1
    ) {
      result[key] = value;
    }
  }

  return result;
}

