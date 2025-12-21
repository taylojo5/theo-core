"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Email Approval Dialog
// Modal for reviewing and approving/rejecting email sends
// ═══════════════════════════════════════════════════════════════════════════

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmailPreview } from "./email-preview";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface EmailApprovalData {
  id: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  bodyHtml: string | null;
  threadId: string | null;
  inReplyTo: string | null;
  status: "pending" | "approved" | "rejected" | "expired" | "sent";
  /** Date object or ISO string (from JSON API response) */
  requestedAt: Date | string;
  /** Date object or ISO string (from JSON API response) */
  expiresAt: Date | string | null;
  requestedBy: string | null;
}

export interface ApprovalDialogProps {
  approval: EmailApprovalData;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, notes?: string) => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function ApprovalDialog({
  approval,
  isOpen,
  onClose,
  onApprove,
  onReject,
  isLoading = false,
  className,
}: ApprovalDialogProps) {
  const [rejectNotes, setRejectNotes] = React.useState("");
  const [showRejectForm, setShowRejectForm] = React.useState(false);
  const [action, setAction] = React.useState<"approve" | "reject" | null>(null);

  // Convert ISO strings to Date objects (handles API JSON serialization)
  const requestedAt = toDate(approval.requestedAt);
  const expiresAt = approval.expiresAt ? toDate(approval.expiresAt) : null;

  // Calculate time until expiration
  const timeUntilExpiration = expiresAt
    ? expiresAt.getTime() - Date.now()
    : null;

  const isExpiringSoon =
    timeUntilExpiration !== null && timeUntilExpiration < 60 * 60 * 1000;

  const isExpired = timeUntilExpiration !== null && timeUntilExpiration <= 0;

  // Handle approve
  const handleApprove = async () => {
    setAction("approve");
    try {
      await onApprove(approval.id);
    } finally {
      setAction(null);
    }
  };

  // Handle reject
  const handleReject = async () => {
    setAction("reject");
    try {
      await onReject(approval.id, rejectNotes || undefined);
    } finally {
      setAction(null);
      setRejectNotes("");
      setShowRejectForm(false);
    }
  };

  // Close on escape
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const isPending = approval.status === "pending";

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4",
        "bg-black/50 backdrop-blur-sm",
        "animate-in fade-in duration-200"
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <Card
        className={cn(
          "flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden",
          "animate-in zoom-in-95 duration-200",
          className
        )}
      >
        <CardHeader className="shrink-0 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold tracking-tight">
              Email Approval Request
            </CardTitle>
            <div className="flex items-center gap-2">
              {approval.status !== "pending" && (
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-xs uppercase",
                    approval.status === "sent" && "bg-green-100 text-green-800",
                    approval.status === "rejected" && "bg-red-100 text-red-800",
                    approval.status === "expired" && "bg-gray-100 text-gray-800"
                  )}
                >
                  {approval.status}
                </Badge>
              )}
              {isPending && isExpiringSoon && !isExpired && (
                <Badge variant="destructive" className="animate-pulse text-xs">
                  Expires {formatTimeRemaining(timeUntilExpiration!)}
                </Badge>
              )}
              {isPending && isExpired && (
                <Badge variant="secondary" className="bg-gray-100 text-xs">
                  Expired
                </Badge>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="text-muted-foreground mt-2 flex items-center gap-4 text-xs">
            <span>
              Requested{" "}
              {requestedAt.toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
            {approval.requestedBy && (
              <>
                <span>•</span>
                <span>By: {approval.requestedBy}</span>
              </>
            )}
            {approval.threadId && (
              <>
                <span>•</span>
                <Link
                  href={`/email/thread/${approval.threadId}`}
                  className="text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ThreadIcon className="mr-1 inline-block size-3" />
                  View Thread
                </Link>
              </>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-4">
          <EmailPreview
            to={approval.to}
            cc={approval.cc.length > 0 ? approval.cc : undefined}
            bcc={approval.bcc.length > 0 ? approval.bcc : undefined}
            subject={approval.subject}
            body={approval.body}
            bodyHtml={approval.bodyHtml || undefined}
            threadId={approval.threadId || undefined}
            inReplyTo={approval.inReplyTo || undefined}
            showHtml={!!approval.bodyHtml}
          />

          {/* Reject notes form */}
          {showRejectForm && (
            <div className="bg-muted/30 mt-4 rounded-lg border p-4">
              <label className="mb-2 block text-sm font-medium">
                Rejection Notes (Optional)
              </label>
              <textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Why are you rejecting this email?"
                className={cn(
                  "bg-background min-h-[80px] w-full rounded-md border p-3",
                  "resize-none text-sm",
                  "focus:ring-ring focus:ring-2 focus:outline-none"
                )}
              />
            </div>
          )}
        </CardContent>

        <CardFooter className="shrink-0 justify-between gap-3 border-t">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Close
          </Button>

          {isPending && !isExpired && (
            <div className="flex gap-2">
              {showRejectForm ? (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => setShowRejectForm(false)}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={isLoading}
                  >
                    {action === "reject" ? (
                      <LoadingSpinner />
                    ) : (
                      "Confirm Reject"
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setShowRejectForm(true)}
                    disabled={isLoading}
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={handleApprove}
                    disabled={isLoading}
                    className="bg-green-600 text-white hover:bg-green-700"
                  >
                    {action === "approve" ? (
                      <LoadingSpinner />
                    ) : (
                      <>
                        <SendIcon className="mr-1.5 h-4 w-4" />
                        Approve & Send
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "now";

  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(ms / 3600000);

  if (minutes < 60) return `in ${minutes}m`;
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.floor(hours / 24)}d`;
}

/** Convert a Date or ISO string to a Date object */
function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function LoadingSpinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function ThreadIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default ApprovalDialog;
