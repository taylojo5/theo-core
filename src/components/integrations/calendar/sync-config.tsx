"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Calendar Sync Configuration Component
// Configure which calendars to sync and recurring sync settings
// ═══════════════════════════════════════════════════════════════════════════

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface CalendarOption {
  id: string;
  googleCalendarId: string;
  name: string;
  description?: string | null;
  isPrimary: boolean;
  isOwner: boolean;
  accessRole: string;
  backgroundColor?: string | null;
  foregroundColor?: string | null;
  isSelected: boolean;
  isHidden: boolean;
  canSyncEvents: boolean;
}

export interface CalendarSyncConfigData {
  syncConfigured: boolean;
  recurringEnabled: boolean;
  enabledCalendarIds: string[];
}

export interface CalendarSyncConfigProps {
  config?: CalendarSyncConfigData;
  calendars?: CalendarOption[];
  isLoading?: boolean;
  isConnected?: boolean;
  /** Whether calendar metadata has been synced */
  metadataSynced?: boolean;
  onSave: (config: {
    enabledCalendarIds?: string[];
    enableRecurring?: boolean;
  }) => Promise<void>;
  className?: string;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function CalendarSyncConfigPanel({
  config,
  calendars = [],
  isLoading = false,
  isConnected = false,
  metadataSynced = false,
  onSave,
  className,
}: CalendarSyncConfigProps) {
  // Start in editing mode if sync not configured (first-time setup)
  const [isEditing, setIsEditing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [selectedCalendarIds, setSelectedCalendarIds] = React.useState<
    string[]
  >([]);

  const isSetupMode = !config?.syncConfigured;

  // Filter to only syncable calendars
  const syncableCalendars = calendars.filter((c) => c.canSyncEvents);
  const unsyncableCalendars = calendars.filter((c) => !c.canSyncEvents);

  // Reset selected calendars when config changes
  React.useEffect(() => {
    if (config) {
      setSelectedCalendarIds(config.enabledCalendarIds ?? []);
    }
  }, [config]);

  // Auto-enter edit mode when in setup mode
  React.useEffect(() => {
    if (isSetupMode && isConnected && metadataSynced) {
      setIsEditing(true);
    }
  }, [isSetupMode, isConnected, metadataSynced]);

  const handleSave = async () => {
    // Validate at least one calendar is selected
    if (selectedCalendarIds.length === 0) {
      return; // Button should be disabled anyway
    }

    setIsSaving(true);
    try {
      await onSave({ enabledCalendarIds: selectedCalendarIds });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (config) {
      setSelectedCalendarIds(config.enabledCalendarIds ?? []);
    }
    // Only allow cancel if already configured
    if (!isSetupMode) {
      setIsEditing(false);
    }
  };

  const toggleCalendar = (calendarId: string) => {
    setSelectedCalendarIds((prev) =>
      prev.includes(calendarId)
        ? prev.filter((id) => id !== calendarId)
        : [...prev, calendarId]
    );
  };

  const canSave = selectedCalendarIds.length > 0;

  if (!isConnected) {
    return (
      <Card className={cn("opacity-60", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ConfigIcon className="size-5" />
            Sync Configuration
          </CardTitle>
          <CardDescription>
            Connect Google Calendar to configure sync settings
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "relative",
        isSetupMode && "ring-2 ring-blue-500 ring-offset-2",
        className
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ConfigIcon className="size-5" />
              {isSetupMode ? "Set Up Calendar Sync" : "Sync Configuration"}
              {isSetupMode && (
                <Badge variant="secondary" className="text-xs">
                  Required
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {isSetupMode
                ? "Select which calendars you want to sync events from. Only calendars with reader or owner access can sync event details."
                : "Customize which calendars are synced"}
            </CardDescription>
          </div>
          {!isEditing && !isSetupMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              disabled={isLoading}
            >
              <EditIcon className="mr-1 size-4" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="default" label="Loading configuration..." />
          </div>
        ) : !metadataSynced && isSetupMode ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Spinner size="default" className="mb-4" />
            <p className="text-muted-foreground">Loading your calendars...</p>
            <p className="text-muted-foreground text-sm">
              This may take a moment
            </p>
          </div>
        ) : (
          <>
            {/* Syncable Calendars */}
            {syncableCalendars.length > 0 && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">
                    Calendars to Sync
                    <span className="text-destructive ml-1">*</span>
                  </label>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Select at least one calendar to import events from.
                  </p>
                </div>

                {/* Show validation message if no calendars selected in edit mode */}
                {isEditing && selectedCalendarIds.length === 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      <WarningIcon className="mr-1.5 inline-block size-4" />
                      Please select at least one calendar to sync
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  {syncableCalendars.map((calendar) => {
                    const isSelected = selectedCalendarIds.includes(
                      calendar.id
                    );
                    return (
                      <div
                        key={calendar.id}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                          isEditing && "hover:bg-muted/50 cursor-pointer",
                          isSelected && "border-primary bg-primary/5"
                        )}
                        onClick={() => isEditing && toggleCalendar(calendar.id)}
                      >
                        {/* Color indicator */}
                        <div
                          className="size-3 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              calendar.backgroundColor || "#4285F4",
                            border: "1px solid rgba(0,0,0,0.1)",
                          }}
                        />

                        {/* Calendar info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">
                              {calendar.name}
                            </span>
                            {calendar.isPrimary && (
                              <Badge
                                variant="outline"
                                className="shrink-0 text-xs"
                              >
                                Primary
                              </Badge>
                            )}
                          </div>
                          <p className="text-muted-foreground text-xs">
                            {calendar.accessRole === "owner"
                              ? "Owner"
                              : "Can view"}
                          </p>
                        </div>

                        {/* Selection indicator */}
                        {isEditing ? (
                          <div
                            className={cn(
                              "flex size-5 items-center justify-center rounded border",
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted-foreground/30"
                            )}
                          >
                            {isSelected && <CheckIcon className="size-3" />}
                          </div>
                        ) : (
                          isSelected && (
                            <Badge variant="success" className="text-xs">
                              Syncing
                            </Badge>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Unsyncable Calendars (collapsed by default) */}
            {unsyncableCalendars.length > 0 && (
              <div className="space-y-2">
                <details className="group">
                  <summary className="text-muted-foreground flex cursor-pointer items-center gap-2 text-xs">
                    <ChevronIcon className="size-4 transition-transform group-open:rotate-90" />
                    {unsyncableCalendars.length} calendar
                    {unsyncableCalendars.length === 1 ? "" : "s"} with limited
                    access
                  </summary>
                  <div className="mt-2 space-y-2 pl-6">
                    {unsyncableCalendars.map((calendar) => (
                      <div
                        key={calendar.id}
                        className="flex items-center gap-3 rounded-lg border border-dashed p-3 opacity-60"
                      >
                        <div
                          className="size-3 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              calendar.backgroundColor || "#4285F4",
                            border: "1px solid rgba(0,0,0,0.1)",
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="truncate text-sm">
                            {calendar.name}
                          </span>
                          <p className="text-muted-foreground text-xs">
                            {calendar.accessRole === "freeBusyReader"
                              ? "Free/Busy only"
                              : calendar.accessRole === "writer"
                                ? "Can edit (no read access)"
                                : calendar.accessRole}
                          </p>
                        </div>
                        <LockIcon className="text-muted-foreground size-4" />
                      </div>
                    ))}
                    <p className="text-muted-foreground text-xs">
                      These calendars cannot sync event details because they
                      don&apos;t have reader or owner access.
                    </p>
                  </div>
                </details>
              </div>
            )}

            {/* Summary when not editing */}
            {!isEditing && selectedCalendarIds.length > 0 && (
              <div className="rounded-lg border p-3">
                <p className="text-sm">
                  <span className="font-medium">
                    {selectedCalendarIds.length}
                  </span>{" "}
                  calendar{selectedCalendarIds.length === 1 ? "" : "s"}{" "}
                  configured for sync
                </p>
              </div>
            )}

            {/* Action Buttons */}
            {isEditing && (
              <div className="flex justify-end gap-2 border-t pt-4">
                {!isSetupMode && (
                  <Button
                    variant="ghost"
                    onClick={handleCancel}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  onClick={handleSave}
                  disabled={isSaving || !canSave}
                  className={isSetupMode ? "w-full sm:w-auto" : ""}
                >
                  {isSaving ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      {isSetupMode ? "Starting Sync..." : "Saving..."}
                    </>
                  ) : isSetupMode ? (
                    <>
                      <StartIcon className="mr-2 size-4" />
                      Start Calendar Sync
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────

function ConfigIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function StartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  );
}

export default CalendarSyncConfigPanel;
