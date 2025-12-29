-- Add Opportunity model for tracking potential engagements
-- Opportunities are abstract entities identified from various sources (emails, etc.)
-- that the user can engage with and might turn into events, tasks, projects, etc.

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL DEFAULT 'identified',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "importance" INTEGER NOT NULL DEFAULT 5,
    "identifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "evaluatedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "context" TEXT,
    "trigger" TEXT,
    "outcome" TEXT,
    "outcomeNotes" TEXT,
    "convertedToType" TEXT,
    "convertedToId" TEXT,
    "relatedPersonId" TEXT,
    "participants" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedEmailId" TEXT,
    "relatedEventId" TEXT,
    "relatedTaskId" TEXT,
    "relatedProjectId" TEXT,
    "potentialValue" TEXT,
    "effort" TEXT,
    "risk" TEXT,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceSyncedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: userId for user filtering
CREATE INDEX "Opportunity_userId_idx" ON "Opportunity"("userId");

-- CreateIndex: status for status-based queries
CREATE INDEX "Opportunity_status_idx" ON "Opportunity"("status");

-- CreateIndex: priority for priority-based sorting
CREATE INDEX "Opportunity_priority_idx" ON "Opportunity"("priority");

-- CreateIndex: expiresAt for expiration queries
CREATE INDEX "Opportunity_expiresAt_idx" ON "Opportunity"("expiresAt");

-- CreateIndex: category for category filtering
CREATE INDEX "Opportunity_category_idx" ON "Opportunity"("category");

-- CreateIndex: unique constraint for source deduplication (required for upsert logic)
CREATE UNIQUE INDEX "Opportunity_userId_source_sourceId_key" ON "Opportunity"("userId", "source", "sourceId");

-- AddForeignKey: Link to User
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

