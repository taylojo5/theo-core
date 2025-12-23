"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface MessageBubbleProps {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: Date | string;
  /** User or assistant avatar URL */
  avatarUrl?: string;
  /** User or assistant name */
  name?: string;
  /** Whether the message is currently streaming */
  isStreaming?: boolean;
  /** Additional className */
  className?: string;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function MessageBubble({
  role,
  content,
  createdAt,
  avatarUrl,
  name,
  isStreaming = false,
  className,
}: MessageBubbleProps) {
  const isUser = role === "user";
  const isSystem = role === "system";

  // Don't render system messages in the chat (they're for context)
  if (isSystem) return null;

  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : isUser
      ? "U"
      : "T";

  return (
    <div
      className={cn(
        "group flex gap-3",
        isUser && "flex-row-reverse",
        className
      )}
    >
      {/* Avatar */}
      <Avatar className="size-8 shrink-0 shadow-sm">
        <AvatarImage src={avatarUrl} alt={name || (isUser ? "You" : "Theo")} />
        <AvatarFallback
          className={cn(
            "text-xs font-medium",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-gradient-to-br from-violet-500 to-indigo-600 text-white"
          )}
        >
          {initials}
        </AvatarFallback>
      </Avatar>

      {/* Message content */}
      <div
        className={cn(
          "flex max-w-[75%] flex-col gap-1",
          isUser && "items-end"
        )}
      >
        {/* Name and time */}
        <div
          className={cn(
            "flex items-center gap-2 text-xs text-muted-foreground",
            isUser && "flex-row-reverse"
          )}
        >
          <span className="font-medium">{name || (isUser ? "You" : "Theo")}</span>
          <span className="opacity-0 transition-opacity group-hover:opacity-100">
            {formatRelativeTime(createdAt)}
          </span>
        </div>

        {/* Bubble */}
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "rounded-bl-md bg-muted text-foreground"
          )}
        >
          {/* Render content with basic formatting */}
          <MessageContent content={content} isStreaming={isStreaming} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Message Content with streaming cursor
// ─────────────────────────────────────────────────────────────

function MessageContent({
  content,
  isStreaming,
}: {
  content: string;
  isStreaming: boolean;
}) {
  // Simple markdown-like rendering for code blocks
  const parts = content.split(/(```[\s\S]*?```)/);

  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          // Code block
          const code = part.slice(3, -3);
          const [lang, ...lines] = code.split("\n");
          const codeContent = lines.join("\n").trim();

          return (
            <pre
              key={i}
              className="overflow-x-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100 dark:bg-zinc-950"
            >
              {lang && (
                <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">
                  {lang}
                </div>
              )}
              <code>{codeContent || lang}</code>
            </pre>
          );
        }

        // Regular text - preserve line breaks
        return (
          <span key={i} className="whitespace-pre-wrap">
            {part}
          </span>
        );
      })}
      {isStreaming && (
        <span className="inline-block size-2 animate-pulse rounded-full bg-current" />
      )}
    </div>
  );
}

