"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Email Thread View Component
// Displays a conversation thread with all emails
// ═══════════════════════════════════════════════════════════════════════════

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface ThreadEmail {
  id: string;
  gmailId: string;
  subject: string | null;
  fromEmail: string;
  fromName: string | null;
  toEmails: string[];
  ccEmails: string[];
  bodyText: string | null;
  bodyHtml: string | null;
  internalDate: string;
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  labelIds: string[];
}

interface ThreadViewProps {
  /** Thread ID to display */
  threadId: string;
  /** Callback when thread is closed */
  onClose?: () => void;
  /** Additional CSS classes */
  className?: string;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function ThreadView({
  threadId,
  onClose,
  className = "",
}: ThreadViewProps) {
  const [emails, setEmails] = React.useState<ThreadEmail[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [expandedEmails, setExpandedEmails] = React.useState<Set<string>>(
    new Set()
  );

  // Fetch thread on mount
  React.useEffect(() => {
    const fetchThread = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/integrations/gmail/threads/${threadId}`);

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.error || `Failed to load thread (${res.status})`
          );
        }

        const data = await res.json();
        setEmails(data.emails);

        // Expand the last email by default
        if (data.emails.length > 0) {
          setExpandedEmails(new Set([data.emails[data.emails.length - 1].id]));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load thread");
      } finally {
        setIsLoading(false);
      }
    };

    fetchThread();
  }, [threadId]);

  const toggleExpanded = (emailId: string) => {
    setExpandedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(emailId)) {
        next.delete(emailId);
      } else {
        next.add(emailId);
      }
      return next;
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      return date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email[0].toUpperCase();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          {onClose && <Skeleton className="h-8 w-20" />}
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`${className}`}>
        <Card className="border-destructive bg-destructive/10 p-6">
          <p className="text-destructive font-medium">Error loading thread</p>
          <p className="text-muted-foreground mt-1 text-sm">{error}</p>
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // Empty state
  if (emails.length === 0) {
    return (
      <div className={`${className}`}>
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">
            No emails found in this thread.
          </p>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-4"
              onClick={onClose}
            >
              Close
            </Button>
          )}
        </Card>
      </div>
    );
  }

  const threadSubject = emails[0].subject || "(No subject)";

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold">{threadSubject}</h2>
          <p className="text-muted-foreground text-sm">
            {emails.length} {emails.length === 1 ? "message" : "messages"}
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <CloseIcon className="size-4" />
          </Button>
        )}
      </div>

      {/* Email list */}
      <div className="space-y-2">
        {emails.map((email, index) => {
          const isExpanded = expandedEmails.has(email.id);
          const isLast = index === emails.length - 1;

          return (
            <Card
              key={email.id}
              className={`overflow-hidden transition-all ${
                !email.isRead ? "border-primary/50" : ""
              }`}
            >
              {/* Email header - always visible */}
              <button
                className="hover:bg-muted/50 flex w-full items-start gap-3 p-4 text-left transition-colors"
                onClick={() => toggleExpanded(email.id)}
              >
                {/* Avatar */}
                <Avatar className="size-10 shrink-0">
                  <div className="bg-primary/10 text-primary flex h-full w-full items-center justify-center text-sm font-medium">
                    {getInitials(email.fromName, email.fromEmail)}
                  </div>
                </Avatar>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`truncate font-medium ${!email.isRead ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {email.fromName || email.fromEmail}
                    </span>
                    {email.isStarred && (
                      <StarIcon className="size-4 shrink-0 text-yellow-500" />
                    )}
                    {email.hasAttachments && (
                      <AttachmentIcon className="text-muted-foreground size-4 shrink-0" />
                    )}
                    <span className="text-muted-foreground ml-auto shrink-0 text-sm">
                      {formatDate(email.internalDate)}
                    </span>
                  </div>

                  {!isExpanded && (
                    <p className="text-muted-foreground mt-1 truncate text-sm">
                      {email.bodyText?.slice(0, 120) || "(No content)"}
                    </p>
                  )}
                </div>

                {/* Expand indicator */}
                <ChevronIcon
                  className={`text-muted-foreground size-5 shrink-0 transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Email body - visible when expanded */}
              {isExpanded && (
                <div className="border-t px-4 pb-4">
                  {/* Recipients */}
                  <div className="text-muted-foreground space-y-1 py-3 text-sm">
                    <div className="flex gap-2">
                      <span className="w-8 text-right">To:</span>
                      <span className="truncate">
                        {email.toEmails.join(", ")}
                      </span>
                    </div>
                    {email.ccEmails.length > 0 && (
                      <div className="flex gap-2">
                        <span className="w-8 text-right">Cc:</span>
                        <span className="truncate">
                          {email.ccEmails.join(", ")}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="mt-2">
                    {email.bodyHtml ? (
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
                      />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">
                        {email.bodyText || "(No content)"}
                      </p>
                    )}
                  </div>

                  {/* Labels */}
                  {email.labelIds.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1">
                      {email.labelIds
                        .filter((l) => !["INBOX", "SENT", "UNREAD"].includes(l))
                        .map((label) => (
                          <Badge
                            key={label}
                            variant="secondary"
                            className="text-xs"
                          >
                            {label.replace("CATEGORY_", "")}
                          </Badge>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function AttachmentIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
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
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

export default ThreadView;
