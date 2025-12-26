-- Add trigger to enforce user consistency between AgentPlan and Conversation
-- When an AgentPlan has a conversationId, the plan's userId must match the conversation's userId
-- This prevents cross-user data leakage and authorization bugs

-- Create the validation function
CREATE OR REPLACE FUNCTION check_agent_plan_user_consistency()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check if conversationId is being set (not null)
  IF NEW."conversationId" IS NOT NULL THEN
    -- Verify the conversation's userId matches the plan's userId
    IF NOT EXISTS (
      SELECT 1 FROM "Conversation"
      WHERE id = NEW."conversationId"
      AND "userId" = NEW."userId"
    ) THEN
      RAISE EXCEPTION 'AgentPlan.userId (%) must match Conversation.userId for conversationId (%)',
        NEW."userId", NEW."conversationId";
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger for INSERT
CREATE TRIGGER agent_plan_user_consistency_insert
  BEFORE INSERT ON "AgentPlan"
  FOR EACH ROW
  EXECUTE FUNCTION check_agent_plan_user_consistency();

-- Create the trigger for UPDATE
CREATE TRIGGER agent_plan_user_consistency_update
  BEFORE UPDATE ON "AgentPlan"
  FOR EACH ROW
  WHEN (
    OLD."conversationId" IS DISTINCT FROM NEW."conversationId"
    OR OLD."userId" IS DISTINCT FROM NEW."userId"
  )
  EXECUTE FUNCTION check_agent_plan_user_consistency();

-- Add a comment for documentation
COMMENT ON FUNCTION check_agent_plan_user_consistency() IS 
  'Ensures AgentPlan.userId matches Conversation.userId when a plan is linked to a conversation';
