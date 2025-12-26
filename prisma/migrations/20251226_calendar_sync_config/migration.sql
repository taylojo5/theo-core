-- Calendar Sync Configuration Updates
-- 1. Change isSelected default to false (calendars opt-out of event sync by default)
-- 2. Add syncConfigured and recurringEnabled fields to CalendarSyncState

-- Update existing calendars to keep their current behavior (set to true if they were created before)
-- This is a no-op migration for existing data, only affects defaults for NEW records

-- Add new columns to CalendarSyncState
ALTER TABLE "CalendarSyncState" ADD COLUMN IF NOT EXISTS "syncConfigured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CalendarSyncState" ADD COLUMN IF NOT EXISTS "recurringEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Note: Changing the default for isSelected in Calendar model only affects new records
-- Existing calendars keep their current isSelected value

