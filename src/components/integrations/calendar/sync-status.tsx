"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Calendar Sync Status Component
// Displays sync progress, status, and controls
// Uses Luxon for relative time formatting
// ═══════════════════════════════════════════════════════════════════════════

import * as React from "react";
import { DateTime } from "luxon";
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

export type SyncStatusType =
  | "idle"
  | "syncing"
  | "full_sync"
  | "incremental_sync"
  | "error"
  | "paused";

export interface CalendarSyncStats {
  eventCount: number;
  calendarCount: number;
  embeddingsPending: number;
  embeddingsCompleted: number;
  embeddingsFailed?: number;
}

export interface CalendarSyncStatusData {
  status: SyncStatusType;
  lastSyncAt?: string | null;
  lastFullSyncAt?: string | null;
  error?: string | null;
  recurring: boolean;
  stats: CalendarSyncStats;
  webhook?: {
    active: boolean;
    expiresAt?: string | null;
  };
}

export interface CalendarSyncStatusProps {
  data?: CalendarSyncStatusData;
  isLoading?: boolean;
  isConnected?: boolean;
  onTriggerFullSync: () => Promise<void>;
  onTriggerIncrementalSync: () => Promise<void>;
  onToggleRecurring: (enabled: boolean) => Promise<void>;
  onRefresh: () => void;
  className?: string;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function CalendarSyncStatus({
  data,
  isLoading = false,
  isConnected = false,
  onTriggerFullSync,
  onTriggerIncrementalSync,
  onToggleRecurring,
  onRefresh,
  className,
}: CalendarSyncStatusProps) {
  const [actionLoading, setActionLoading] = React.useState<
    "full" | "incremental" | "recurring" | null
  >(null);

  const handleFullSync = async () => {
    setActionLoading("full");
    try {
      await onTriggerFullSync();
    } finally {
      setActionLoading(null);
    }
  };

  const handleIncrementalSync = async () => {
    setActionLoading("incremental");
    try {
      await onTriggerIncrementalSync();
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleRecurring = async () => {
    setActionLoading("recurring");
    try {
      await onToggleRecurring(!data?.recurring);
    } finally {
      setActionLoading(null);
    }
  };

  const isSyncing =
    data?.status === "syncing" ||
    data?.status === "full_sync" ||
    data?.status === "incremental_sync";

  if (!isConnected) {
    return (
      <Card className={cn("opacity-60", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SyncIcon className="size-5" />
            Sync Status
          </CardTitle>
          <CardDescription>
            Connect Google Calendar to sync events
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
              <SyncIcon className={cn("size-5", isSyncing && "animate-spin")} />
              Sync Status
              <StatusBadge status={data?.status || "idle"} />
            </CardTitle>
            <CardDescription>
              {isSyncing
                ? "Syncing your calendar events..."
                : data?.lastSyncAt
                  ? `Last synced ${formatTimeAgo(new Date(data.lastSyncAt))}`
                  : "No sync yet"}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRefresh}
            disabled={isLoading || isSyncing}
          >
            <RefreshIcon className="size-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="default" label="Loading sync status..." />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Sync Progress (if syncing) */}
            {isSyncing && (
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {data?.status === "full_sync"
                      ? "Full Sync in Progress"
                      : "Incremental Sync in Progress"}
                  </span>
                  <Spinner size="sm" />
                </div>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div className="bg-primary h-full w-1/2 animate-pulse rounded-full" />
                </div>
                <p className="text-muted-foreground mt-2 text-xs">
                  This may take a few minutes for large calendars...
                </p>
              </div>
            )}

            {/* Sync Error */}
            {data?.status === "error" && data.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
                <h4 className="mb-1 text-sm font-medium text-red-800 dark:text-red-200">
                  Sync Error
                </h4>
                <p className="text-sm text-red-700 dark:text-red-300">
                  {data.error}
                </p>
              </div>
            )}

            {/* Statistics */}
            {data?.stats && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatBox
                  label="Calendars"
                  value={data.stats.calendarCount}
                  icon={<CalendarIcon className="size-4" />}
                />
                <StatBox
                  label="Events"
                  value={data.stats.eventCount}
                  icon={<EventIcon className="size-4" />}
                />
                <StatBox
                  label="Embeddings"
                  value={data.stats.embeddingsCompleted}
                  icon={<EmbeddingIcon className="size-4" />}
                  subValue={
                    data.stats.embeddingsPending > 0
                      ? `+${data.stats.embeddingsPending} pending`
                      : undefined
                  }
                />
                <StatBox
                  label="Webhook"
                  value={data.webhook?.active ? "Active" : "Inactive"}
                  icon={<WebhookIcon className="size-4" />}
                  variant={data.webhook?.active ? "success" : "muted"}
                />
              </div>
            )}

            {/* Sync Info */}
            <div className="text-muted-foreground grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-foreground font-medium">Last Full Sync:</span>
                <p>
                  {data?.lastFullSyncAt
                    ? formatTimeAgo(new Date(data.lastFullSyncAt))
                    : "Never"}
                </p>
              </div>
              <div>
                <span className="text-foreground font-medium">Auto Sync:</span>
                <p>{data?.recurring ? "Enabled" : "Disabled"}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                variant="default"
                onClick={handleIncrementalSync}
                disabled={actionLoading !== null || isSyncing}
              >
                {actionLoading === "incremental" ? (
                  <Spinner size="sm" className="mr-2" />
                ) : (
                  <SyncIcon className="mr-2 size-4" />
                )}
                Sync Now
              </Button>

              <Button
                variant="outline"
                onClick={handleFullSync}
                disabled={actionLoading !== null || isSyncing}
              >
                {actionLoading === "full" ? (
                  <Spinner size="sm" className="mr-2" />
                ) : (
                  <RefreshIcon className="mr-2 size-4" />
                )}
                Full Sync
              </Button>

              <Button
                variant={data?.recurring ? "secondary" : "outline"}
                onClick={handleToggleRecurring}
                disabled={actionLoading !== null}
              >
                {actionLoading === "recurring" ? (
                  <Spinner size="sm" className="mr-2" />
                ) : (
                  <RecurringIcon className="mr-2 size-4" />
                )}
                {data?.recurring ? "Auto Sync On" : "Auto Sync Off"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: SyncStatusType;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const config: Record<
    SyncStatusType,
    { label: string; variant: "default" | "success" | "warning" | "destructive" | "secondary" }
  > = {
    idle: { label: "Idle", variant: "secondary" },
    syncing: { label: "Syncing", variant: "default" },
    full_sync: { label: "Full Sync", variant: "default" },
    incremental_sync: { label: "Syncing", variant: "default" },
    error: { label: "Error", variant: "destructive" },
    paused: { label: "Paused", variant: "warning" },
  };

  const { label, variant } = config[status] || config.idle;

  return (
    <Badge variant={variant} className="text-xs">
      {label}
    </Badge>
  );
}

interface StatBoxProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  subValue?: string;
  variant?: "default" | "success" | "muted";
}

function StatBox({
  label,
  value,
  icon,
  subValue,
  variant = "default",
}: StatBoxProps) {
  const variantClasses = {
    default: "border-border bg-muted/50",
    success:
      "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30",
    muted: "border-border bg-muted/30",
  };

  return (
    <div className={cn("rounded-lg border p-3", variantClasses[variant])}>
      <div className="text-muted-foreground mb-1 flex items-center gap-1.5">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-lg font-semibold">{value}</p>
      {subValue && (
        <p className="text-muted-foreground text-xs">{subValue}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers (Luxon-powered)
// ─────────────────────────────────────────────────────────────

function formatTimeAgo(date: Date): string {
  const dt = DateTime.fromJSDate(date);
  const diff = DateTime.now().diff(dt, ["days", "hours", "minutes"]);
  
  if (diff.minutes < 1) return "Just now";
  if (diff.hours < 1) return `${Math.floor(diff.minutes)}m ago`;
  if (diff.days < 1) return `${Math.floor(diff.hours)}h ago`;
  if (diff.days < 2) return "Yesterday";
  return `${Math.floor(diff.days)}d ago`;
}

// ─────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────

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

function CalendarIcon({ className }: { className?: string }) {
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
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function EventIcon({ className }: { className?: string }) {
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
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function EmbeddingIcon({ className }: { className?: string }) {
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
        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}

function WebhookIcon({ className }: { className?: string }) {
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
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      />
    </svg>
  );
}

function RecurringIcon({ className }: { className?: string }) {
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
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

export default CalendarSyncStatus;

