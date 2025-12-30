-- Add missing metadata fields to AgentPlan and AgentPlanStep models
-- These fields are needed for proper plan persistence and retrieval

-- Add metadata fields to AgentPlan
ALTER TABLE "AgentPlan" ADD COLUMN IF NOT EXISTS "reasoning" TEXT;
ALTER TABLE "AgentPlan" ADD COLUMN IF NOT EXISTS "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5;
ALTER TABLE "AgentPlan" ADD COLUMN IF NOT EXISTS "assumptions" JSONB NOT NULL DEFAULT '[]';

-- Add metadata fields to AgentPlanStep
ALTER TABLE "AgentPlanStep" ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AgentPlanStep" ADD COLUMN IF NOT EXISTS "requiresApproval" BOOLEAN NOT NULL DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN "AgentPlan"."reasoning" IS 'LLM reasoning for why this plan structure was chosen';
COMMENT ON COLUMN "AgentPlan"."confidence" IS 'LLM confidence in plan success (0.0-1.0)';
COMMENT ON COLUMN "AgentPlan"."assumptions" IS 'Assumptions made during planning as JSON array';
COMMENT ON COLUMN "AgentPlanStep"."description" IS 'Human-readable description of what this step does';
COMMENT ON COLUMN "AgentPlanStep"."requiresApproval" IS 'Whether this step requires user approval before execution';


