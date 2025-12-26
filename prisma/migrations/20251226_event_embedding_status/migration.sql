-- Add embedding status tracking fields to Event model
-- Mirrors the same fields on the Email model for consistent embedding tracking

-- Add embedding status fields
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "embeddingStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "embeddingError" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "embeddingAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "embeddedAt" TIMESTAMP(3);

-- Add index for efficient embedding status queries
CREATE INDEX IF NOT EXISTS "Event_userId_embeddingStatus_idx" ON "Event"("userId", "embeddingStatus");

