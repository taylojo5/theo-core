-- Add recurringEnabled field to GmailSyncState for tracking auto-sync status
-- This is more reliable than checking BullMQ's repeatable jobs list

ALTER TABLE "GmailSyncState" ADD COLUMN "recurringEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN "GmailSyncState"."recurringEnabled" IS 'Whether automatic recurring sync is enabled';

