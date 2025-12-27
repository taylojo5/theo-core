"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Gmail Pending Approvals Component
// Lists pending email approvals with quick actions
// Uses Luxon for date/time calculations
// ═══════════════════════════════════════════════════════════════════════════

import * as React from "react";
import Link from "next/link";
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
import { ApprovalDialog, type EmailApprovalData } from "@/components/email";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ApprovalStats {
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
  total: number;
}

export interface PendingApprovalsData {
  approvals: EmailApprovalData[];
  count: number;
  stats?: ApprovalStats;
}

export interface PendingApprovalsProps {
  data?: PendingApprovalsData;
  isLoading?: boolean;
  isConnected?: boolean;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, notes?: string) => Promise<void>;
  onRefresh: () => void;
  className?: string;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function PendingApprovals({
  data,
  isLoading = false,
  isConnected = false,
  onApprove,
  onReject,
  onRefresh,
  className,
}: PendingApprovalsProps) {
  const [selectedApproval, setSelectedApproval] =
    React.useState<EmailApprovalData | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);

  const handleApprove = async (id: string) => {
    setActionLoading(true);
    try {
      await onApprove(id);
      setSelectedApproval(null);
      onRefresh();
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id: string, notes?: string) => {
    setActionLoading(true);
    try {
      await onReject(id, notes);
      setSelectedApproval(null);
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
            Connect Gmail to manage email approvals
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
                Emails waiting for your approval before sending
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
                <h4 className="mb-3 text-sm font-medium">Pending Emails</h4>
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
                      All email requests have been handled
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      {selectedApproval && (
        <ApprovalDialog
          approval={selectedApproval}
          isOpen={true}
          onClose={() => setSelectedApproval(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          isLoading={actionLoading}
        />
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
  approval: EmailApprovalData;
  onClick: () => void;
}

function ApprovalCard({ approval, onClick }: ApprovalCardProps) {
  // Convert requestedAt to Luxon DateTime
  const requestedAtDt =
    approval.requestedAt instanceof Date
      ? DateTime.fromJSDate(approval.requestedAt)
      : DateTime.fromISO(approval.requestedAt as string);

  const [isExpiringSoon, setIsExpiringSoon] = React.useState(false);

  React.useEffect(() => {
    if (approval.expiresAt) {
      const checkExpiration = () => {
        const expiresAtDt = approval.expiresAt instanceof Date
          ? DateTime.fromJSDate(approval.expiresAt)
          : DateTime.fromISO(approval.expiresAt as string);
        const remaining = expiresAtDt.diffNow("milliseconds").milliseconds;
        setIsExpiringSoon(remaining < 60 * 60 * 1000);
      };
      checkExpiration();
      const interval = setInterval(checkExpiration, 30000);
      return () => clearInterval(interval);
    }
  }, [approval.expiresAt]);

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
            <p className="group-hover:text-primary truncate font-medium">
              {approval.subject || "(No subject)"}
            </p>
            <p className="text-muted-foreground truncate text-sm">
              To: {approval.to.join(", ")}
            </p>
          </div>
          <div className="ml-3 flex shrink-0 flex-col items-end gap-1">
            {isExpiringSoon && (
              <Badge variant="destructive" className="animate-pulse text-xs">
                Expiring Soon
              </Badge>
            )}
            <span className="text-muted-foreground text-xs">
              {formatTimeAgo(requestedAtDt)}
            </span>
          </div>
        </div>
      </button>
      {approval.threadId && (
        <div className="mt-2 border-t pt-2">
          <Link
            href={`/email/thread/${approval.threadId}`}
            className="text-muted-foreground hover:text-primary flex items-center gap-1 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <ThreadIcon className="size-3" />
            View Thread
          </Link>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers (Luxon-powered)
// ─────────────────────────────────────────────────────────────

function formatTimeAgo(dt: DateTime): string {
  const diff = DateTime.now().diff(dt, ["days", "hours", "minutes"]);
  
  if (diff.minutes < 1) return "Just now";
  if (diff.hours < 1) return `${Math.floor(diff.minutes)}m ago`;
  if (diff.days < 1) return `${Math.floor(diff.hours)}h ago`;
  return `${Math.floor(diff.days)}d ago`;
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

function ThreadIcon({ className }: { className?: string }) {
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
        d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
      />
    </svg>
  );
}

export default PendingApprovals;
