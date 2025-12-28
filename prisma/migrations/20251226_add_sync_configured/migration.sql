-- Add syncConfigured field to GmailSyncState for opt-in email sync model
-- This field tracks whether the user has configured their sync preferences

ALTER TABLE "GmailSyncState" ADD COLUMN "syncConfigured" BOOLEAN NOT NULL DEFAULT false;

-- Update comment on the table to reflect opt-in behavior
COMMENT ON COLUMN "GmailSyncState"."syncLabels" IS 'Labels opted-in for sync (empty = no emails synced)';
COMMENT ON COLUMN "GmailSyncState"."syncConfigured" IS 'Whether user has configured sync settings';



