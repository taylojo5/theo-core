-- Add embedding status tracking to Email table
ALTER TABLE "Email" ADD COLUMN IF NOT EXISTS "embeddingStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "Email" ADD COLUMN IF NOT EXISTS "embeddingError" TEXT;
ALTER TABLE "Email" ADD COLUMN IF NOT EXISTS "embeddingAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Email" ADD COLUMN IF NOT EXISTS "embeddedAt" TIMESTAMP(3);

-- Add index for embedding status queries
CREATE INDEX IF NOT EXISTS "Email_userId_embeddingStatus_idx" ON "Email"("userId", "embeddingStatus");

-- Add checkpoint and history tracking fields to GmailSyncState
ALTER TABLE "GmailSyncState" ADD COLUMN IF NOT EXISTS "historyIdSetAt" TIMESTAMP(3);
ALTER TABLE "GmailSyncState" ADD COLUMN IF NOT EXISTS "fullSyncPageToken" TEXT;
ALTER TABLE "GmailSyncState" ADD COLUMN IF NOT EXISTS "fullSyncProgress" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GmailSyncState" ADD COLUMN IF NOT EXISTS "fullSyncStartedAt" TIMESTAMP(3);

-- Add embedding statistics to GmailSyncState
ALTER TABLE "GmailSyncState" ADD COLUMN IF NOT EXISTS "embeddingsPending" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GmailSyncState" ADD COLUMN IF NOT EXISTS "embeddingsCompleted" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GmailSyncState" ADD COLUMN IF NOT EXISTS "embeddingsFailed" INTEGER NOT NULL DEFAULT 0;

