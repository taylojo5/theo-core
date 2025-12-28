-- Agent User Configuration
-- Per-user agent settings with JSON fields for flexibility
-- Defaults are stored in code/env vars, DB values override them

-- Create AgentUserConfig table
CREATE TABLE "AgentUserConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    
    -- Rate limits configuration (JSON)
    -- Keys: CHAT_PER_MINUTE, ACTIONS_PER_MINUTE, EXTERNAL_CALLS_PER_HOUR, 
    --       LLM_TOKENS_PER_HOUR, MAX_CONCURRENT_PLANS, MAX_PLAN_STEPS
    "rateLimits" JSONB NOT NULL DEFAULT '{}',
    
    -- Token limits configuration (JSON)
    -- Keys: MAX_CONVERSATION_CONTEXT, MAX_RETRIEVED_CONTEXT, MAX_SYSTEM_PROMPT,
    --       MAX_TOOL_DESCRIPTIONS, MAX_RESPONSE_TOKENS, TARGET_REQUEST_BUDGET
    "tokenLimits" JSONB NOT NULL DEFAULT '{}',
    
    -- Content filter configuration (JSON)
    -- Keys: SANITIZE_INPUT, FILTER_OUTPUT, MAX_MESSAGE_LENGTH, 
    --       MAX_PROMPT_LENGTH, DETECT_INJECTION
    "contentFilterConfig" JSONB NOT NULL DEFAULT '{}',
    
    -- Feature flags configuration (JSON)
    -- Keys: enablePlanning, enableProactive, enableLearning, 
    --       enableToolExecution, enableAuditLogging, enableStreaming
    "featureFlags" JSONB NOT NULL DEFAULT '{}',
    
    -- Confidence thresholds configuration (JSON)
    -- Keys: ACTION, STATEMENT, ASSUMPTION, HIGH_RISK, ENTITY_RESOLUTION
    "confidenceThresholds" JSONB NOT NULL DEFAULT '{}',
    
    -- Timestamps
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentUserConfig_pkey" PRIMARY KEY ("id")
);

-- Create unique index on userId (one config per user)
CREATE UNIQUE INDEX "AgentUserConfig_userId_key" ON "AgentUserConfig"("userId");

-- Add foreign key constraint
ALTER TABLE "AgentUserConfig" ADD CONSTRAINT "AgentUserConfig_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add helpful comments
COMMENT ON TABLE "AgentUserConfig" IS 'Per-user agent configuration - overrides defaults from env vars/code';
COMMENT ON COLUMN "AgentUserConfig"."rateLimits" IS 'Rate limiting settings (null fields use defaults)';
COMMENT ON COLUMN "AgentUserConfig"."tokenLimits" IS 'Token/context window limits (null fields use defaults)';
COMMENT ON COLUMN "AgentUserConfig"."contentFilterConfig" IS 'Content filtering settings (null fields use defaults)';
COMMENT ON COLUMN "AgentUserConfig"."featureFlags" IS 'Feature flags (null fields use defaults)';
COMMENT ON COLUMN "AgentUserConfig"."confidenceThresholds" IS 'Confidence thresholds (null fields use defaults)';


