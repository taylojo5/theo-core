"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Gmail Sync Settings Component
// Sync configuration form with manual sync trigger
// Uses Luxon for date formatting
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

export interface SyncConfig {
  syncLabels: string[];
  excludeLabels: string[];
  maxEmailAgeDays: number;
  syncAttachments: boolean;
}

export interface SyncSettingsData {
  status: "idle" | "syncing" | "error";
  error?: string | null;
  lastSyncAt?: string | null;
  lastFullSyncAt?: string | null;
  recurring: boolean;
  hasActiveSyncs: boolean;
  config: SyncConfig;
  labels: Array<{
    id: string;
    name: string;
    type: string;
    messageCount: number;
  }>;
}

export interface SyncSettingsProps {
  data?: SyncSettingsData;
  isLoading?: boolean;
  isConnected?: boolean;
  onTriggerSync: (type: "auto" | "full" | "incremental") => Promise<void>;
  onToggleRecurring: (enabled: boolean) => Promise<void>;
  onCancelSync: () => Promise<void>;
  className?: string;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function SyncSettings({
  data,
  isLoading = false,
  isConnected = false,
  onTriggerSync,
  onToggleRecurring,
  onCancelSync,
  className,
}: SyncSettingsProps) {
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);

  const handleSync = async (type: "auto" | "full" | "incremental") => {
    setActionLoading(`sync-${type}`);
    try {
      await onTriggerSync(type);
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

  const handleCancel = async () => {
    setActionLoading("cancel");
    try {
      await onCancelSync();
    } finally {
      setActionLoading(null);
    }
  };

  // Using Luxon for consistent date formatting
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "Never";
    const dt = DateTime.fromISO(dateStr);
    return dt.toLocaleString(DateTime.DATETIME_MED);
  };

  if (!isConnected) {
    return (
      <Card className={cn("opacity-60", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SyncIcon className="size-5" />
            Sync Settings
          </CardTitle>
          <CardDescription>
            Connect Gmail to configure sync settings
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
              <SyncIcon className="size-5" />
              Sync Settings
              {data?.status === "syncing" && (
                <Badge variant="info" className="animate-pulse text-xs">
                  Syncing...
                </Badge>
              )}
              {data?.status === "error" && (
                <Badge variant="destructive" className="text-xs">
                  Error
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Manage how and when emails are synced
            </CardDescription>
          </div>
          {data?.recurring && (
            <Badge variant="success" className="text-xs">
              Auto-sync Active
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="default" label="Loading sync settings..." />
          </div>
        ) : (
          <>
            {/* Sync Status */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="mb-3 text-sm font-medium">Sync Status</h4>
              <div className="text-muted-foreground grid grid-cols-2 gap-2 text-sm">
                <span>Status:</span>
                <span
                  className={cn(
                    data?.status === "syncing" && "text-blue-600",
                    data?.status === "error" && "text-red-600",
                    data?.status === "idle" && "text-emerald-600"
                  )}
                >
                  {data?.status === "syncing"
                    ? "Syncing..."
                    : data?.status === "error"
                      ? "Error"
                      : "Idle"}
                </span>
                <span>Last Sync:</span>
                <span>{formatDate(data?.lastSyncAt)}</span>
                <span>Last Full Sync:</span>
                <span>{formatDate(data?.lastFullSyncAt)}</span>
                <span>Auto-Sync:</span>
                <span className={data?.recurring ? "text-emerald-600" : ""}>
                  {data?.recurring ? "Enabled" : "Disabled"}
                </span>
              </div>

              {/* Error Display */}
              {data?.error && (
                <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                  <span className="font-medium">Error:</span> {data.error}
                </div>
              )}
            </div>

            {/* Sync Actions */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Manual Sync</h4>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSync("auto")}
                  disabled={actionLoading !== null || data?.hasActiveSyncs}
                >
                  {actionLoading === "sync-auto" ? (
                    <Spinner size="sm" className="mr-2" />
                  ) : (
                    <SyncIcon className="mr-2 size-4" />
                  )}
                  Smart Sync
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSync("incremental")}
                  disabled={actionLoading !== null || data?.hasActiveSyncs}
                >
                  {actionLoading === "sync-incremental" ? (
                    <Spinner size="sm" className="mr-2" />
                  ) : (
                    <IncrementalIcon className="mr-2 size-4" />
                  )}
                  Incremental
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSync("full")}
                  disabled={actionLoading !== null || data?.hasActiveSyncs}
                >
                  {actionLoading === "sync-full" ? (
                    <Spinner size="sm" className="mr-2" />
                  ) : (
                    <FullSyncIcon className="mr-2 size-4" />
                  )}
                  Full Sync
                </Button>
                {data?.hasActiveSyncs && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleCancel}
                    disabled={actionLoading !== null}
                  >
                    {actionLoading === "cancel" ? (
                      <Spinner size="sm" className="mr-2" />
                    ) : (
                      <CancelIcon className="mr-2 size-4" />
                    )}
                    Cancel
                  </Button>
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                Smart Sync will perform a full sync if never synced, otherwise
                incremental.
              </p>
            </div>

            {/* Auto-Sync Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Automatic Sync</p>
                <p className="text-muted-foreground text-sm">
                  Sync emails every 5 minutes in the background
                </p>
              </div>
              <Button
                variant={data?.recurring ? "destructive" : "default"}
                size="sm"
                onClick={handleToggleRecurring}
                disabled={actionLoading !== null}
              >
                {actionLoading === "recurring" ? (
                  <Spinner size="sm" className="mr-2" />
                ) : null}
                {data?.recurring ? "Disable" : "Enable"}
              </Button>
            </div>

            {/* Labels Overview */}
            {data?.labels && data.labels.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-medium">Gmail Labels</h4>
                <div className="flex flex-wrap gap-1.5">
                  {data.labels.slice(0, 10).map((label) => (
                    <Badge
                      key={label.id}
                      variant="secondary"
                      className="text-xs"
                    >
                      {label.name}
                      <span className="text-muted-foreground ml-1">
                        ({label.messageCount})
                      </span>
                    </Badge>
                  ))}
                  {data.labels.length > 10 && (
                    <Badge variant="outline" className="text-xs">
                      +{data.labels.length - 10} more
                    </Badge>
                  )}
                </div>
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

function IncrementalIcon({ className }: { className?: string }) {
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
        d="M13 5l7 7-7 7M5 5l7 7-7 7"
      />
    </svg>
  );
}

function FullSyncIcon({ className }: { className?: string }) {
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
        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
      />
    </svg>
  );
}

function CancelIcon({ className }: { className?: string }) {
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
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

export default SyncSettings;
