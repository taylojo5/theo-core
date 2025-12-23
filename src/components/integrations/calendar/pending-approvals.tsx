"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Calendar Pending Approvals Component
// Lists pending calendar action approvals with quick actions
// ═══════════════════════════════════════════════════════════════════════════

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type CalendarActionType = "create" | "update" | "delete" | "respond";

export interface CalendarApprovalData {
  id: string;
  actionType: CalendarActionType;
  calendarId: string;
  eventId?: string | null;
  eventSnapshot: Record<string, unknown>;
  status: string;
  requestedAt: string;
  requestedBy?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
}

export interface CalendarApprovalStats {
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
  total: number;
}

export interface CalendarPendingApprovalsData {
  approvals: CalendarApprovalData[];
  count: number;
  stats?: CalendarApprovalStats;
}

export interface CalendarPendingApprovalsProps {
  data?: CalendarPendingApprovalsData;
  isLoading?: boolean;
  isConnected?: boolean;
  onApprove: (id: string, notes?: string) => Promise<void>;
  onReject: (id: string, notes?: string) => Promise<void>;
  onRefresh: () => void;
  className?: string;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function CalendarPendingApprovals({
  data,
  isLoading = false,
  isConnected = false,
  onApprove,
  onReject,
  onRefresh,
  className,
}: CalendarPendingApprovalsProps) {
  const [selectedApproval, setSelectedApproval] =
    React.useState<CalendarApprovalData | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [notes, setNotes] = React.useState("");

  const handleApprove = async (id: string) => {
    setActionLoading(true);
    try {
      await onApprove(id, notes);
      setSelectedApproval(null);
      setNotes("");
      onRefresh();
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(true);
    try {
      await onReject(id, notes);
      setSelectedApproval(null);
      setNotes("");
      onRefresh();
    } finally {
      setActionLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <Card className={cn("opacity-60", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <InboxIcon className="size-5" />
            Pending Approvals
          </CardTitle>
          <CardDescription>
            Connect Calendar to manage event approvals
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card className={cn("relative", className)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <InboxIcon className="size-5" />
                Pending Approvals
                {data?.stats?.pending !== undefined &&
                  data.stats.pending > 0 && (
                    <Badge variant="warning" className="text-xs">
                      {data.stats.pending}
                    </Badge>
                  )}
              </CardTitle>
              <CardDescription>
                Calendar actions waiting for your approval
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RefreshIcon className="size-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="default" label="Loading approvals..." />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Stats Overview */}
              {data?.stats && (
                <div className="grid grid-cols-4 gap-3">
                  <StatBox
                    label="Pending"
                    value={data.stats.pending}
                    variant="warning"
                  />
                  <StatBox
                    label="Approved"
                    value={data.stats.approved}
                    variant="success"
                  />
                  <StatBox
                    label="Rejected"
                    value={data.stats.rejected}
                    variant="destructive"
                  />
                  <StatBox
                    label="Expired"
                    value={data.stats.expired}
                    variant="muted"
                  />
                </div>
              )}

              {/* Approvals List */}
              <div>
                <h4 className="mb-3 text-sm font-medium">Pending Actions</h4>
                {data?.approvals && data.approvals.length > 0 ? (
                  <div className="space-y-2">
                    {data.approvals.map((approval) => (
                      <ApprovalCard
                        key={approval.id}
                        approval={approval}
                        onClick={() => setSelectedApproval(approval)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                    <CheckIcon className="mx-auto mb-2 size-8 text-emerald-500" />
                    <p>No pending approvals</p>
                    <p className="mt-1 text-xs">
                      All calendar actions have been handled
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Detail Modal */}
      {selectedApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="mx-4 w-full max-w-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ActionTypeBadge type={selectedApproval.actionType} />
                {getActionTitle(selectedApproval.actionType)}
              </CardTitle>
              <CardDescription>
                Review the details below and approve or reject this action.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Event Summary */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="mb-2 text-sm font-medium">Event Details</h4>
                <dl className="space-y-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground shrink-0">Title:</dt>
                    <dd className="font-medium">
                      {(selectedApproval.eventSnapshot as { summary?: string })?.summary ||
                        "(No title)"}
                    </dd>
                  </div>
                  {(selectedApproval.eventSnapshot as { start?: { dateTime?: string } })?.start?.dateTime && (
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground shrink-0">When:</dt>
                      <dd>
                        {formatEventTime(
                          (selectedApproval.eventSnapshot as { start?: { dateTime?: string } }).start?.dateTime || ""
                        )}
                      </dd>
                    </div>
                  )}
                  {(selectedApproval.eventSnapshot as { location?: string })?.location && (
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground shrink-0">Where:</dt>
                      <dd>
                        {(selectedApproval.eventSnapshot as { location?: string }).location}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Requested By */}
              {selectedApproval.requestedBy && (
                <div className="text-muted-foreground text-sm">
                  Requested by: {selectedApproval.requestedBy}
                </div>
              )}

              {/* Expiration Warning */}
              {selectedApproval.expiresAt && (
                <ExpirationWarning expiresAt={selectedApproval.expiresAt} />
              )}

              {/* Notes */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                  placeholder="Add a note about your decision..."
                  rows={2}
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </CardContent>

            <CardFooter className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setSelectedApproval(null)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleReject(selectedApproval.id)}
                disabled={actionLoading}
              >
                {actionLoading ? <Spinner size="sm" className="mr-2" /> : null}
                Reject
              </Button>
              <Button
                variant="default"
                onClick={() => handleApprove(selectedApproval.id)}
                disabled={actionLoading}
              >
                {actionLoading ? <Spinner size="sm" className="mr-2" /> : null}
                Approve
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

interface StatBoxProps {
  label: string;
  value: number;
  variant?: "warning" | "success" | "destructive" | "muted";
}

function StatBox({ label, value, variant = "muted" }: StatBoxProps) {
  const variantClasses = {
    warning:
      "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30",
    success:
      "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30",
    destructive:
      "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30",
    muted: "border-border bg-muted/50",
  };

  const valueClasses = {
    warning: "text-amber-700 dark:text-amber-400",
    success: "text-emerald-700 dark:text-emerald-400",
    destructive: "text-red-700 dark:text-red-400",
    muted: "text-foreground",
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-3 text-center",
        variantClasses[variant]
      )}
    >
      <p className={cn("text-2xl font-semibold", valueClasses[variant])}>
        {value}
      </p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  );
}

interface ApprovalCardProps {
  approval: CalendarApprovalData;
  onClick: () => void;
}

function ApprovalCard({ approval, onClick }: ApprovalCardProps) {
  const requestedAt = new Date(approval.requestedAt);
  const [isExpiringSoon, setIsExpiringSoon] = React.useState(false);

  React.useEffect(() => {
    if (approval.expiresAt) {
      const checkExpiration = () => {
        const remaining = new Date(approval.expiresAt!).getTime() - Date.now();
        setIsExpiringSoon(remaining < 60 * 60 * 1000);
      };
      checkExpiration();
      const interval = setInterval(checkExpiration, 30000);
      return () => clearInterval(interval);
    }
  }, [approval.expiresAt]);

  const eventSnapshot = approval.eventSnapshot as {
    summary?: string;
    start?: { dateTime?: string };
  };

  return (
    <div
      className={cn(
        "group rounded-lg border p-4 transition-colors",
        "hover:border-primary/50 hover:bg-muted/50"
      )}
    >
      <button className="w-full text-left" onClick={onClick}>
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <ActionTypeBadge type={approval.actionType} />
              <p className="group-hover:text-primary truncate font-medium">
                {eventSnapshot?.summary || "(No title)"}
              </p>
            </div>
            {eventSnapshot?.start?.dateTime && (
              <p className="text-muted-foreground mt-1 text-sm">
                {formatEventTime(eventSnapshot.start.dateTime)}
              </p>
            )}
          </div>
          <div className="ml-3 flex shrink-0 flex-col items-end gap-1">
            {isExpiringSoon && (
              <Badge variant="destructive" className="animate-pulse text-xs">
                Expiring Soon
              </Badge>
            )}
            <span className="text-muted-foreground text-xs">
              {formatTimeAgo(requestedAt)}
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}

function ActionTypeBadge({ type }: { type: CalendarActionType }) {
  const config: Record<
    CalendarActionType,
    { label: string; variant: "default" | "success" | "warning" | "destructive" }
  > = {
    create: { label: "Create", variant: "success" },
    update: { label: "Update", variant: "warning" },
    delete: { label: "Delete", variant: "destructive" },
    respond: { label: "RSVP", variant: "default" },
  };

  const { label, variant } = config[type] || config.create;

  return (
    <Badge variant={variant} className="shrink-0 text-xs">
      {label}
    </Badge>
  );
}

function ExpirationWarning({ expiresAt }: { expiresAt: string }) {
  const remaining = new Date(expiresAt).getTime() - new Date().getTime();
  const isExpiringSoon = remaining < 60 * 60 * 1000;

  if (!isExpiringSoon) return null;

  const minutes = Math.max(0, Math.floor(remaining / 60000));
  const hours = Math.floor(minutes / 60);

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
      <p className="text-sm text-amber-800 dark:text-amber-200">
        ⚠️ This approval expires in{" "}
        {hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function getActionTitle(type: CalendarActionType): string {
  const titles: Record<CalendarActionType, string> = {
    create: "Create Event",
    update: "Update Event",
    delete: "Delete Event",
    respond: "RSVP to Event",
  };
  return titles[type] || "Calendar Action";
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function formatEventTime(dateTime: string): string {
  try {
    const date = new Date(dateTime);
    return date.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return dateTime;
  }
}

// ─────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────

function InboxIcon({ className }: { className?: string }) {
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
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
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

function CheckIcon({ className }: { className?: string }) {
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
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

export default CalendarPendingApprovals;

