"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Gmail Sync History Component
// Shows recent sync activity and pending jobs
// Uses Luxon for date formatting
// ═══════════════════════════════════════════════════════════════════════════

import * as React from "react";
import { DateTime } from "luxon";
import { cn } from "@/lib/utils";
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

export interface SyncJob {
  id: string;
  name: string;
  status: "active" | "delayed" | "waiting" | "completed" | "failed";
  progress?: number;
  timestamp: number;
  error?: string;
}

export interface SyncHistoryData {
  pendingJobs: SyncJob[];
  lastSyncAt?: string | null;
  lastFullSyncAt?: string | null;
  historyId?: string | null;
}

export interface SyncHistoryProps {
  data?: SyncHistoryData;
  isLoading?: boolean;
  isConnected?: boolean;
  className?: string;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function SyncHistory({
  data,
  isLoading = false,
  isConnected = false,
  className,
}: SyncHistoryProps) {
  // Using Luxon for consistent date formatting
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "Never";
    const dt = DateTime.fromISO(dateStr);
    return dt.toLocaleString(DateTime.DATETIME_SHORT);
  };

  const formatTimestamp = (ts: number) => {
    const dt = DateTime.fromMillis(ts);
    return dt.toLocaleString(DateTime.DATETIME_SHORT);
  };

  const getStatusVariant = (status: SyncJob["status"]) => {
    switch (status) {
      case "active":
        return "info";
      case "completed":
        return "success";
      case "failed":
        return "destructive";
      case "delayed":
        return "warning";
      default:
        return "secondary";
    }
  };

  if (!isConnected) {
    return (
      <Card className={cn("opacity-60", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HistoryIcon className="size-5" />
            Sync Activity
          </CardTitle>
          <CardDescription>Connect Gmail to view sync activity</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={cn("relative", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HistoryIcon className="size-5" />
          Sync Activity
        </CardTitle>
        <CardDescription>
          Recent sync operations and pending jobs
        </CardDescription>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="default" label="Loading sync history..." />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Recent Sync Info */}
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-muted-foreground grid grid-cols-2 gap-2 text-sm">
                <span>Last Incremental:</span>
                <span>{formatDate(data?.lastSyncAt)}</span>
                <span>Last Full Sync:</span>
                <span>{formatDate(data?.lastFullSyncAt)}</span>
                {data?.historyId && (
                  <>
                    <span>History ID:</span>
                    <span className="font-mono text-xs">{data.historyId}</span>
                  </>
                )}
              </div>
            </div>

            {/* Pending Jobs */}
            <div>
              <h4 className="mb-3 text-sm font-medium">
                Active & Pending Jobs
                {data?.pendingJobs && data.pendingJobs.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {data.pendingJobs.length}
                  </Badge>
                )}
              </h4>

              {data?.pendingJobs && data.pendingJobs.length > 0 ? (
                <div className="space-y-2">
                  {data.pendingJobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        {job.status === "active" && (
                          <Spinner size="sm" className="shrink-0" />
                        )}
                        {job.status !== "active" && (
                          <JobIcon
                            status={job.status}
                            className="size-4 shrink-0"
                          />
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {formatJobName(job.name)}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {formatTimestamp(job.timestamp)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {job.progress !== undefined && job.progress > 0 && (
                          <span className="text-muted-foreground text-xs">
                            {job.progress}%
                          </span>
                        )}
                        <Badge
                          variant={getStatusVariant(job.status)}
                          className="text-xs"
                        >
                          {job.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                  No active sync jobs
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function formatJobName(name: string): string {
  const nameMap: Record<string, string> = {
    "gmail-full-sync": "Full Email Sync",
    "gmail-incremental-sync": "Incremental Sync",
    "gmail-contact-sync": "Contact Sync",
    "gmail-sync": "Email Sync",
  };
  return nameMap[name] || name;
}

// ─────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────

function HistoryIcon({ className }: { className?: string }) {
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

function JobIcon({
  status,
  className,
}: {
  status: SyncJob["status"];
  className?: string;
}) {
  if (status === "completed") {
    return (
      <svg
        className={cn("text-emerald-600", className)}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }

  if (status === "failed") {
    return (
      <svg
        className={cn("text-red-600", className)}
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

  if (status === "delayed") {
    return (
      <svg
        className={cn("text-amber-600", className)}
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

  // waiting
  return (
    <svg
      className={cn("text-muted-foreground", className)}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

export default SyncHistory;
