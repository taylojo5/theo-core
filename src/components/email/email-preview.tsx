"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Email Preview Component
// Displays a preview of an email before sending
// ═══════════════════════════════════════════════════════════════════════════

import * as React from "react";
import DOMPurify from "dompurify";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface EmailPreviewProps {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  threadId?: string;
  inReplyTo?: string;
  className?: string;
  showHtml?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function EmailPreview({
  to,
  cc,
  bcc,
  subject,
  body,
  bodyHtml,
  threadId,
  inReplyTo,
  className,
  showHtml = false,
}: EmailPreviewProps) {
  const [viewHtml, setViewHtml] = React.useState(showHtml && !!bodyHtml);

  // Sanitize HTML to prevent XSS attacks from malicious email content
  const sanitizedHtml = React.useMemo(() => {
    if (!bodyHtml) return "";
    return DOMPurify.sanitize(bodyHtml, {
      // Allow safe HTML elements for email formatting
      ALLOWED_TAGS: [
        "a",
        "abbr",
        "address",
        "article",
        "aside",
        "b",
        "bdi",
        "bdo",
        "blockquote",
        "br",
        "caption",
        "cite",
        "code",
        "col",
        "colgroup",
        "data",
        "dd",
        "del",
        "dfn",
        "div",
        "dl",
        "dt",
        "em",
        "figcaption",
        "figure",
        "footer",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "header",
        "hr",
        "i",
        "img",
        "ins",
        "kbd",
        "li",
        "main",
        "mark",
        "nav",
        "ol",
        "p",
        "pre",
        "q",
        "rp",
        "rt",
        "ruby",
        "s",
        "samp",
        "section",
        "small",
        "span",
        "strong",
        "sub",
        "sup",
        "table",
        "tbody",
        "td",
        "tfoot",
        "th",
        "thead",
        "time",
        "tr",
        "u",
        "ul",
        "var",
        "wbr",
      ],
      // Allow safe attributes
      ALLOWED_ATTR: [
        "href",
        "src",
        "alt",
        "title",
        "width",
        "height",
        "style",
        "class",
        "id",
        "name",
        "target",
        "rel",
        "colspan",
        "rowspan",
        "headers",
        "scope",
        "align",
        "valign",
        "border",
        "cellpadding",
        "cellspacing",
      ],
      // Force all links to open in new tab and add noopener for security
      ADD_ATTR: ["target", "rel"],
      // Forbid dangerous URI schemes
      ALLOWED_URI_REGEXP:
        /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    });
  }, [bodyHtml]);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="bg-muted/30 border-b pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold tracking-tight">
            Email Preview
          </CardTitle>
          {bodyHtml && (
            <button
              type="button"
              onClick={() => setViewHtml(!viewHtml)}
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              {viewHtml ? "View Plain Text" : "View HTML"}
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Email Headers */}
        <div className="bg-background space-y-2.5 border-b p-4">
          {/* To */}
          <div className="flex items-start gap-3">
            <span className="text-muted-foreground w-12 shrink-0 text-sm font-medium">
              To:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {to.map((email) => (
                <Badge
                  key={email}
                  variant="secondary"
                  className="text-xs font-normal"
                >
                  {email}
                </Badge>
              ))}
            </div>
          </div>

          {/* CC */}
          {cc && cc.length > 0 && (
            <div className="flex items-start gap-3">
              <span className="text-muted-foreground w-12 shrink-0 text-sm font-medium">
                Cc:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {cc.map((email) => (
                  <Badge
                    key={email}
                    variant="outline"
                    className="text-xs font-normal"
                  >
                    {email}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* BCC */}
          {bcc && bcc.length > 0 && (
            <div className="flex items-start gap-3">
              <span className="text-muted-foreground w-12 shrink-0 text-sm font-medium">
                Bcc:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {bcc.map((email) => (
                  <Badge
                    key={email}
                    variant="outline"
                    className="border-dashed text-xs font-normal"
                  >
                    {email}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Subject */}
          <div className="flex items-start gap-3">
            <span className="text-muted-foreground w-12 shrink-0 text-sm font-medium">
              Subj:
            </span>
            <span className="text-sm font-medium">{subject}</span>
          </div>

          {/* Thread indicator */}
          {(threadId || inReplyTo) && (
            <div className="flex items-center gap-2 pt-1">
              <Badge
                variant="outline"
                className="border-blue-200 bg-blue-50 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
              >
                {inReplyTo ? "Reply" : "In thread"}
              </Badge>
            </div>
          )}
        </div>

        {/* Email Body */}
        <div className="p-4">
          {viewHtml && sanitizedHtml ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
          ) : (
            <pre className="text-foreground/90 font-sans text-sm leading-relaxed whitespace-pre-wrap">
              {body}
            </pre>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Compact Preview
// ─────────────────────────────────────────────────────────────

export interface EmailPreviewCompactProps {
  to: string[];
  subject: string;
  snippet?: string;
  status?: "pending" | "approved" | "rejected" | "expired" | "sent";
  /** Date object or ISO string (from JSON API response) */
  requestedAt?: Date | string;
  /** Date object or ISO string (from JSON API response) */
  expiresAt?: Date | string;
  className?: string;
  onClick?: () => void;
}

export function EmailPreviewCompact({
  to,
  subject,
  snippet,
  status,
  requestedAt,
  expiresAt,
  className,
  onClick,
}: EmailPreviewCompactProps) {
  const statusColors: Record<string, string> = {
    pending:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    approved: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    expired: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    sent: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  };

  // Convert ISO strings to Date objects (handles API JSON serialization)
  const expiresAtDate = expiresAt ? toDate(expiresAt) : null;
  const requestedAtDate = requestedAt ? toDate(requestedAt) : null;

  // Track whether email is expiring soon (calculated after mount to avoid impure Date.now() during render)
  const [isExpiringSoon, setIsExpiringSoon] = React.useState(false);
  React.useEffect(() => {
    if (status !== "pending" || !expiresAtDate) {
      setIsExpiringSoon(false);
      return;
    }
    const checkExpiration = () => {
      setIsExpiringSoon(expiresAtDate.getTime() - Date.now() < 60 * 60 * 1000);
    };
    checkExpiration();
    // Re-check every minute
    const interval = setInterval(checkExpiration, 60 * 1000);
    return () => clearInterval(interval);
  }, [status, expiresAtDate]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "bg-card hover:bg-accent/50 w-full rounded-lg border p-4 text-left transition-colors",
        "focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-none",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Subject */}
          <h4 className="truncate text-sm font-medium">{subject}</h4>

          {/* Recipients */}
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            To: {to.join(", ")}
          </p>

          {/* Snippet */}
          {snippet && (
            <p className="text-muted-foreground mt-1.5 line-clamp-2 text-xs">
              {snippet}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {/* Status badge */}
          {status && (
            <Badge
              variant="secondary"
              className={cn(
                "text-[10px] tracking-wide uppercase",
                statusColors[status]
              )}
            >
              {status}
            </Badge>
          )}

          {/* Time */}
          {requestedAtDate && (
            <span className="text-muted-foreground text-[10px]">
              {formatRelativeTime(requestedAtDate)}
            </span>
          )}

          {/* Expiration warning */}
          {isExpiringSoon && (
            <span className="text-[10px] font-medium text-orange-600 dark:text-orange-400">
              Expires soon
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}

/** Convert a Date or ISO string to a Date object */
function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export default EmailPreview;
