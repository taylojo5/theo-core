"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Connection Status Component
// Displays real-time connection status indicator
// ═══════════════════════════════════════════════════════════════════════════

import * as React from "react";
import { cn } from "@/lib/utils";

interface ConnectionStatusProps {
  /** Whether the connection is currently active */
  isConnected: boolean;
  /** Optional CSS class name */
  className?: string;
  /** Whether to show the text label (default: true) */
  showLabel?: boolean;
  /** Number of reconnection attempts (optional) */
  reconnectAttempts?: number;
  /** Callback to manually trigger reconnection */
  onReconnect?: () => void;
}

export function ConnectionStatus({
  isConnected,
  className,
  showLabel = true,
  reconnectAttempts = 0,
  onReconnect,
}: ConnectionStatusProps) {
  const isReconnecting = !isConnected && reconnectAttempts > 0;

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs transition-all duration-200",
        className
      )}
    >
      {/* Status indicator */}
      <span
        className={cn(
          "relative h-2 w-2 rounded-full transition-colors duration-200",
          isConnected && "bg-green-500",
          isReconnecting && "bg-yellow-500",
          !isConnected && !isReconnecting && "bg-red-500"
        )}
      >
        {/* Pulse animation when connected */}
        {isConnected && (
          <span className="absolute inset-0 animate-ping rounded-full bg-green-500 opacity-75" />
        )}
        {/* Pulse animation when reconnecting */}
        {isReconnecting && (
          <span className="absolute inset-0 animate-pulse rounded-full bg-yellow-500 opacity-75" />
        )}
      </span>

      {/* Status text */}
      {showLabel && (
        <span
          className={cn(
            "text-muted-foreground",
            isConnected && "text-green-600 dark:text-green-400",
            isReconnecting && "text-yellow-600 dark:text-yellow-400",
            !isConnected && !isReconnecting && "text-red-600 dark:text-red-400"
          )}
        >
          {isConnected && "Connected"}
          {isReconnecting && `Reconnecting (${reconnectAttempts})...`}
          {!isConnected && !isReconnecting && "Disconnected"}
        </span>
      )}

      {/* Reconnect button when disconnected */}
      {!isConnected && !isReconnecting && onReconnect && (
        <button
          onClick={onReconnect}
          className="text-xs text-blue-600 underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Reconnect
        </button>
      )}
    </div>
  );
}
