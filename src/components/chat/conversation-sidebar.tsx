"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatRelativeTime, truncate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  title: string | null;
  updatedAt: Date | string;
  /** Preview of the last message */
  preview?: string;
}

export interface ConversationSidebarProps {
  conversations: Conversation[];
  /** Currently active conversation ID */
  activeId?: string;
  /** Called when a conversation is selected */
  onSelect: (id: string) => void;
  /** Called when user wants to create a new conversation */
  onNewConversation: () => void;
  /** Called when user wants to delete a conversation */
  onDelete?: (id: string) => void;
  /** Whether conversations are loading */
  isLoading?: boolean;
  /** Whether the sidebar is collapsed (mobile) */
  isCollapsed?: boolean;
  /** Toggle sidebar collapsed state */
  onToggleCollapse?: () => void;
  /** Additional className */
  className?: string;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNewConversation,
  onDelete,
  isLoading = false,
  isCollapsed = false,
  onToggleCollapse,
  className,
}: ConversationSidebarProps) {
  return (
    <aside
      className={cn(
        "bg-sidebar flex h-full flex-col border-r transition-all duration-300",
        isCollapsed ? "w-0 overflow-hidden md:w-16" : "w-72",
        className
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        {!isCollapsed && (
          <h2 className="text-sidebar-foreground text-sm font-semibold">
            Conversations
          </h2>
        )}
        <div className="flex items-center gap-1">
          {/* New conversation button */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onNewConversation}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
            title="New conversation"
          >
            <svg
              className="size-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            <span className="sr-only">New conversation</span>
          </Button>

          {/* Collapse toggle (optional) */}
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleCollapse}
              className="text-sidebar-foreground hover:bg-sidebar-accent"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg
                className={cn(
                  "size-4 transition-transform",
                  isCollapsed && "rotate-180"
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 19.5L8.25 12l7.5-7.5"
                />
              </svg>
              <span className="sr-only">
                {isCollapsed ? "Expand" : "Collapse"} sidebar
              </span>
            </Button>
          )}
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          // Loading skeletons
          <div className="space-y-1 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg p-3">
                <Skeleton className="mb-2 h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <p className="text-muted-foreground text-sm">
              No conversations yet
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={onNewConversation}
              className="mt-2"
            >
              Start one now
            </Button>
          </div>
        ) : (
          // Conversation items
          <nav className="space-y-1 p-2">
            {conversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={conversation.id === activeId}
                onSelect={() => onSelect(conversation.id)}
                onDelete={
                  onDelete ? () => onDelete(conversation.id) : undefined
                }
                isCollapsed={isCollapsed}
              />
            ))}
          </nav>
        )}
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────
// Conversation Item
// ─────────────────────────────────────────────────────────────

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  isCollapsed: boolean;
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
  isCollapsed,
}: ConversationItemProps) {
  const [showDelete, setShowDelete] = React.useState(false);

  const title = conversation.title || "New conversation";

  if (isCollapsed) {
    // Collapsed view - just show icon
    return (
      <button
        onClick={onSelect}
        className={cn(
          "flex w-full items-center justify-center rounded-lg p-2 transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent/50"
        )}
        title={title}
      >
        <svg
          className="size-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
          />
        </svg>
      </button>
    );
  }

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
      className={cn(
        "group flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/50"
      )}
    >
      {/* Icon */}
      <svg
        className="mt-0.5 size-4 shrink-0 opacity-60"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
        />
      </svg>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">
            {truncate(title, 24)}
          </span>
          <span className="text-muted-foreground shrink-0 text-[10px]">
            {formatRelativeTime(conversation.updatedAt)}
          </span>
        </div>
        {conversation.preview && (
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            {truncate(conversation.preview, 40)}
          </p>
        )}
      </div>

      {/* Delete button */}
      {onDelete && showDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100"
          title="Delete conversation"
        >
          <svg
            className="size-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
            />
          </svg>
        </button>
      )}
    </button>
  );
}
