-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "attendees" JSONB,
ADD COLUMN     "calendarId" TEXT,
ADD COLUMN     "conferenceData" JSONB,
ADD COLUMN     "creator" JSONB,
ADD COLUMN     "etag" TEXT,
ADD COLUMN     "googleCalendarId" TEXT,
ADD COLUMN     "googleEventId" TEXT,
ADD COLUMN     "hangoutLink" TEXT,
ADD COLUMN     "htmlLink" TEXT,
ADD COLUMN     "iCalUID" TEXT,
ADD COLUMN     "organizer" JSONB,
ADD COLUMN     "recurrence" JSONB,
ADD COLUMN     "recurringEventId" TEXT,
ADD COLUMN     "reminders" JSONB,
ADD COLUMN     "sequence" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Calendar" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleCalendarId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "timeZone" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "accessRole" TEXT NOT NULL,
    "backgroundColor" TEXT,
    "foregroundColor" TEXT,
    "isSelected" BOOLEAN NOT NULL DEFAULT true,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Calendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarSyncState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "syncToken" TEXT,
    "syncTokenSetAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastFullSyncAt" TIMESTAMP(3),
    "fullSyncPageToken" TEXT,
    "fullSyncProgress" INTEGER NOT NULL DEFAULT 0,
    "fullSyncStartedAt" TIMESTAMP(3),
    "syncStatus" TEXT NOT NULL DEFAULT 'idle',
    "syncError" TEXT,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "calendarCount" INTEGER NOT NULL DEFAULT 0,
    "embeddingsPending" INTEGER NOT NULL DEFAULT 0,
    "embeddingsCompleted" INTEGER NOT NULL DEFAULT 0,
    "embeddingsFailed" INTEGER NOT NULL DEFAULT 0,
    "webhookChannelId" TEXT,
    "webhookResourceId" TEXT,
    "webhookExpiration" TIMESTAMP(3),
    "syncCalendarIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludeCalendarIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarSyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarApproval" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "eventId" TEXT,
    "eventSnapshot" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedBy" TEXT,
    "expiresAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "resultEventId" TEXT,
    "errorMessage" TEXT,
    "notes" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Calendar_userId_idx" ON "Calendar"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Calendar_userId_googleCalendarId_key" ON "Calendar"("userId", "googleCalendarId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarSyncState_userId_key" ON "CalendarSyncState"("userId");

-- CreateIndex
CREATE INDEX "CalendarApproval_userId_status_idx" ON "CalendarApproval"("userId", "status");

-- CreateIndex
CREATE INDEX "CalendarApproval_expiresAt_idx" ON "CalendarApproval"("expiresAt");

-- CreateIndex
CREATE INDEX "CalendarApproval_userId_requestedAt_idx" ON "CalendarApproval"("userId", "requestedAt" DESC);

-- CreateIndex
CREATE INDEX "Event_googleEventId_idx" ON "Event"("googleEventId");

-- CreateIndex
CREATE INDEX "Event_googleCalendarId_idx" ON "Event"("googleCalendarId");

-- CreateIndex
CREATE INDEX "Event_userId_googleCalendarId_idx" ON "Event"("userId", "googleCalendarId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "Calendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calendar" ADD CONSTRAINT "Calendar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarSyncState" ADD CONSTRAINT "CalendarSyncState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarApproval" ADD CONSTRAINT "CalendarApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
