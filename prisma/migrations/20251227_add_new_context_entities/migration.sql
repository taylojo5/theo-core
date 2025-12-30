-- ═══════════════════════════════════════════════════════════════════════════
-- Add New Context Entities: Routine, OpenLoop, Project, Note
-- Phase 5 Entity Resolution Enhancement
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- Routine: Recurring patterns, habits, and scheduled activities
-- ─────────────────────────────────────────────────────────────

CREATE TABLE "Routine" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'habit',
    
    -- Schedule
    "frequency" TEXT NOT NULL,
    "schedule" JSONB,
    "timezone" TEXT,
    
    -- Timing
    "durationMinutes" INTEGER,
    "preferredTime" TEXT,
    
    -- Status
    "status" TEXT NOT NULL DEFAULT 'active',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "streak" INTEGER NOT NULL DEFAULT 0,
    
    -- Tracking
    "completionCount" INTEGER NOT NULL DEFAULT 0,
    "skipCount" INTEGER NOT NULL DEFAULT 0,
    "lastCompletedAt" TIMESTAMP(3),
    "averageRating" DECIMAL(3,2),
    
    -- Context
    "notes" TEXT,
    "importance" INTEGER NOT NULL DEFAULT 5,
    "category" TEXT,
    
    -- Associations
    "relatedTaskIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedEventIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Source tracking
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceSyncedAt" TIMESTAMP(3),
    
    -- Metadata
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Timestamps
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Routine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Routine_userId_idx" ON "Routine"("userId");
CREATE INDEX "Routine_status_idx" ON "Routine"("status");
CREATE INDEX "Routine_nextRunAt_idx" ON "Routine"("nextRunAt");

ALTER TABLE "Routine" ADD CONSTRAINT "Routine_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- OpenLoop: Unresolved items and follow-ups
-- ─────────────────────────────────────────────────────────────

CREATE TABLE "OpenLoop" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'follow_up',
    
    -- Context
    "context" TEXT,
    "trigger" TEXT,
    
    -- Resolution
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "resolvedBy" TEXT,
    
    -- Priority and timing
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "importance" INTEGER NOT NULL DEFAULT 5,
    "dueAt" TIMESTAMP(3),
    "reminderAt" TIMESTAMP(3),
    "staleAfter" TIMESTAMP(3),
    
    -- Associations
    "relatedPersonId" TEXT,
    "relatedTaskId" TEXT,
    "relatedEventId" TEXT,
    "relatedEmailId" TEXT,
    
    -- Source tracking
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceSyncedAt" TIMESTAMP(3),
    
    -- Metadata
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Timestamps
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "OpenLoop_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OpenLoop_userId_idx" ON "OpenLoop"("userId");
CREATE INDEX "OpenLoop_status_idx" ON "OpenLoop"("status");
CREATE INDEX "OpenLoop_priority_idx" ON "OpenLoop"("priority");
CREATE INDEX "OpenLoop_dueAt_idx" ON "OpenLoop"("dueAt");

ALTER TABLE "OpenLoop" ADD CONSTRAINT "OpenLoop_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- Project: Groups of related tasks and goals
-- ─────────────────────────────────────────────────────────────

CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'project',
    
    -- Hierarchy
    "parentId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    
    -- Status
    "status" TEXT NOT NULL DEFAULT 'active',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    
    -- Timing
    "targetDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "estimatedDays" INTEGER,
    
    -- Priority
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "importance" INTEGER NOT NULL DEFAULT 5,
    
    -- Metrics
    "taskCount" INTEGER NOT NULL DEFAULT 0,
    "completedTaskCount" INTEGER NOT NULL DEFAULT 0,
    
    -- Context
    "notes" TEXT,
    "objective" TEXT,
    
    -- Source tracking
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceSyncedAt" TIMESTAMP(3),
    
    -- Metadata
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "color" TEXT,
    
    -- Timestamps
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Project_userId_idx" ON "Project"("userId");
CREATE INDEX "Project_status_idx" ON "Project"("status");
CREATE INDEX "Project_parentId_idx" ON "Project"("parentId");
CREATE INDEX "Project_dueDate_idx" ON "Project"("dueDate");

ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_parentId_fkey" 
    FOREIGN KEY ("parentId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- Note: General notes and unstructured information
-- ─────────────────────────────────────────────────────────────

CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'note',
    
    -- Organization
    "folderId" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    
    -- Context
    "importance" INTEGER NOT NULL DEFAULT 5,
    "category" TEXT,
    
    -- Associations
    "relatedPersonIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedTaskIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedEventIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedProjectIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Source tracking
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceSyncedAt" TIMESTAMP(3),
    
    -- Metadata
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    
    -- Timestamps
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Note_userId_idx" ON "Note"("userId");
CREATE INDEX "Note_type_idx" ON "Note"("type");
CREATE INDEX "Note_isPinned_idx" ON "Note"("isPinned");
CREATE INDEX "Note_category_idx" ON "Note"("category");

ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- Comments for documentation
-- ─────────────────────────────────────────────────────────────

COMMENT ON TABLE "Routine" IS 'Recurring patterns, habits, and scheduled activities';
COMMENT ON TABLE "OpenLoop" IS 'Unresolved items, commitments, and follow-ups';
COMMENT ON TABLE "Project" IS 'Groups of related tasks, goals, and activities';
COMMENT ON TABLE "Note" IS 'General notes, memos, and unstructured information';



