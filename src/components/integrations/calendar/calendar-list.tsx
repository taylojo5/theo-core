"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Calendar List Component
// Displays user's calendars with selection toggles
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

export interface CalendarInfo {
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
  /** Whether this calendar can be enabled for event sync (reader/owner access) */
  canSyncEvents?: boolean;
}

export interface CalendarListData {
  calendars: CalendarInfo[];
  count: number;
}

export interface CalendarListProps {
  data?: CalendarListData;
  isLoading?: boolean;
  isConnected?: boolean;
  isSyncingMetadata?: boolean;
  onToggleHidden: (calendarId: string, isHidden: boolean) => Promise<void>;
  onRefresh: () => void;
  onRefreshCalendars?: () => Promise<void>;
  className?: string;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function CalendarList({
  data,
  isLoading = false,
  isConnected = false,
  isSyncingMetadata = false,
  onToggleHidden,
  onRefresh,
  onRefreshCalendars,
  className,
}: CalendarListProps) {
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  const handleToggleHidden = async (
    calendarId: string,
    currentValue: boolean
  ) => {
    setTogglingId(calendarId);
    try {
      await onToggleHidden(calendarId, !currentValue);
    } finally {
      setTogglingId(null);
    }
  };

  if (!isConnected) {
    return (
      <Card className={cn("opacity-60", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarListIcon className="size-5" />
            Your Calendars
          </CardTitle>
          <CardDescription>
            Connect Google Calendar to view your calendars
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={cn("relative", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarListIcon className="size-5" />
              Your Calendars
              {data?.count !== undefined && data.count > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {data.count}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Manage calendar visibility. Use Sync Configuration above to select
              which calendars to sync events from.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {onRefreshCalendars && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefreshCalendars}
                disabled={isLoading || isSyncingMetadata}
              >
                {isSyncingMetadata ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <SyncIcon className="mr-1.5 size-4" />
                    Refresh Calendars
                  </>
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RefreshIcon className="size-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="default" label="Loading calendars..." />
          </div>
        ) : data?.calendars && data.calendars.length > 0 ? (
          <div className="space-y-3">
            {data.calendars.map((calendar) => (
              <CalendarItem
                key={calendar.id}
                calendar={calendar}
                isToggling={togglingId === calendar.id}
                onToggleHidden={() =>
                  handleToggleHidden(calendar.id, calendar.isHidden)
                }
              />
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            <CalendarListIcon className="mx-auto mb-2 size-8 opacity-50" />
            <p>No calendars found</p>
            <p className="mt-1 text-xs">
              Start a sync to import your calendars
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

interface CalendarItemProps {
  calendar: CalendarInfo;
  isToggling: boolean;
  onToggleHidden: () => void;
}

function CalendarItem({
  calendar,
  isToggling,
  onToggleHidden,
}: CalendarItemProps) {
  const accessRoleLabels: Record<string, string> = {
    owner: "Owner",
    writer: "Can edit",
    reader: "Can view",
    freeBusyReader: "Free/Busy only",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-lg border p-4 transition-colors",
        calendar.isHidden && "opacity-50"
      )}
    >
      {/* Color indicator */}
      <div
        className="size-4 shrink-0 rounded-full"
        style={{
          backgroundColor: calendar.backgroundColor || "#4285F4",
          border: "1px solid rgba(0,0,0,0.1)",
        }}
      />

      {/* Calendar info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{calendar.name}</span>
          {calendar.isPrimary && (
            <Badge variant="outline" className="shrink-0 text-xs">
              Primary
            </Badge>
          )}
          {calendar.isSelected && (
            <Badge variant="default" className="shrink-0 text-xs">
              Syncing
            </Badge>
          )}
        </div>
        <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
          <span>
            {accessRoleLabels[calendar.accessRole] || calendar.accessRole}
          </span>
          {calendar.description && (
            <>
              <span>•</span>
              <span className="truncate">{calendar.description}</span>
            </>
          )}
        </div>
      </div>

      {/* Visibility toggle */}
      <div className="flex shrink-0 items-center">
        {isToggling ? (
          <Spinner size="sm" />
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleHidden}
            disabled={isToggling}
            title={calendar.isHidden ? "Show calendar" : "Hide calendar"}
            className={cn(
              calendar.isHidden
                ? "text-muted-foreground"
                : "text-muted-foreground/50"
            )}
          >
            {calendar.isHidden ? (
              <EyeOffIcon className="size-4" />
            ) : (
              <EyeIcon className="size-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────

function CalendarListIcon({ className }: { className?: string }) {
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
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
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
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function SyncIcon({ className }: { className?: string }) {
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
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
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
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
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
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
      />
    </svg>
  );
}

export default CalendarList;
