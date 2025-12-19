"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { MessageBubble, type MessageBubbleProps } from "./message-bubble";
import { SkeletonMessage, Spinner } from "@/components/ui";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  createdAt: Date | string;
}

export interface MessageListProps {
  messages: Message[];
  /** Current user info for avatars */
  user?: {
    name?: string | null;
    image?: string | null;
  };
  /** ID of the message currently being streamed */
  streamingMessageId?: string;
  /** Whether to show loading skeleton */
  isLoading?: boolean;
  /** Whether more messages are being loaded (infinite scroll) */
  isLoadingMore?: boolean;
  /** Callback when user scrolls to top (for infinite scroll) */
  onLoadMore?: () => void;
  /** Additional className */
  className?: string;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function MessageList({
  messages,
  user,
  streamingMessageId,
  isLoading = false,
  isLoadingMore = false,
  onLoadMore,
  className,
}: MessageListProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = React.useState(true);

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScroll]);

  // Detect if user has scrolled up (disable auto-scroll)
  const handleScroll = React.useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setAutoScroll(isNearBottom);

    // Load more when scrolling near top
    if (scrollTop < 100 && onLoadMore && !isLoadingMore) {
      onLoadMore();
    }
  }, [onLoadMore, isLoadingMore]);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("flex flex-1 flex-col gap-6 p-6", className)}>
        <SkeletonMessage align="left" />
        <SkeletonMessage align="right" />
        <SkeletonMessage align="left" />
      </div>
    );
  }

  // Empty state
  if (messages.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center",
          className
        )}
      >
        <div className="rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 p-6">
          <svg
            className="size-12 text-violet-600 dark:text-violet-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold">Start a conversation</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask me anything about your schedule, contacts, or tasks.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={cn(
        "flex flex-1 flex-col gap-6 overflow-y-auto scroll-smooth p-6",
        className
      )}
    >
      {/* Loading more indicator */}
      {isLoadingMore && (
        <div className="flex justify-center py-2">
          <Spinner size="sm" />
        </div>
      )}

      {/* Messages */}
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          id={message.id}
          role={message.role}
          content={message.content}
          createdAt={message.createdAt}
          name={message.role === "user" ? user?.name || undefined : "Theo"}
          avatarUrl={message.role === "user" ? user?.image || undefined : undefined}
          isStreaming={message.id === streamingMessageId}
        />
      ))}

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
}

