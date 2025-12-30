-- Add approvalId field to AgentPlanStep
-- This field links a step to its ActionApproval when awaiting user approval

ALTER TABLE "AgentPlanStep" ADD COLUMN IF NOT EXISTS "approvalId" TEXT;

-- Add index for efficient approval lookup
CREATE INDEX IF NOT EXISTS "AgentPlanStep_approvalId_idx" ON "AgentPlanStep"("approvalId");


