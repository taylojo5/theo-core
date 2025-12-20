"use client";

// ═══════════════════════════════════════════════════════════════════════════
// useEventSource Hook
// React hook for SSE connections with auto-reconnect
// ═══════════════════════════════════════════════════════════════════════════

import * as React from "react";

interface UseEventSourceOptions {
  /** Callback for generic messages */
  onMessage?: (event: MessageEvent) => void;
  /** Callback for connection errors */
  onError?: (error: Event) => void;
  /** Callback when connection opens */
  onOpen?: () => void;
  /** Named event handlers - keys are event names, values are callbacks */
  eventHandlers?: Record<string, (data: unknown) => void>;
  /** Reconnection delay in milliseconds (default: 5000) */
  reconnectDelay?: number;
  /** Maximum reconnection attempts (default: 5) */
  maxReconnectAttempts?: number;
}

interface UseEventSourceResult {
  /** Whether the connection is currently open */
  isConnected: boolean;
  /** Last received message event */
  lastEvent: MessageEvent | null;
  /** Number of reconnection attempts */
  reconnectAttempts: number;
  /** Manually close the connection */
  close: () => void;
  /** Manually reconnect */
  reconnect: () => void;
}

export function useEventSource(
  url: string | null,
  options: UseEventSourceOptions = {}
): UseEventSourceResult {
  const [isConnected, setIsConnected] = React.useState(false);
  const [lastEvent, setLastEvent] = React.useState<MessageEvent | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = React.useState(0);

  const eventSourceRef = React.useRef<EventSource | null>(null);
  const reconnectTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const optionsRef = React.useRef(options);
  const connectRef = React.useRef<() => void>(() => {});

  // Keep options ref updated
  React.useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Define connect function and store in ref for recursive calls
  const connect = React.useCallback(() => {
    if (!url) {
      setIsConnected(false);
      return;
    }

    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setReconnectAttempts(0);
      optionsRef.current.onOpen?.();
    };

    eventSource.onerror = (error) => {
      setIsConnected(false);
      optionsRef.current.onError?.(error);

      // Auto-reconnect with exponential backoff
      const maxAttempts = optionsRef.current.maxReconnectAttempts ?? 5;
      const baseDelay = optionsRef.current.reconnectDelay ?? 5000;

      setReconnectAttempts((prev) => {
        const attempts = prev + 1;

        if (attempts <= maxAttempts) {
          const delay = Math.min(baseDelay * Math.pow(2, prev), 60000);
          console.log(
            `[SSE] Reconnecting in ${delay}ms (attempt ${attempts}/${maxAttempts})`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            eventSource.close();
            // Use ref to call connect to avoid stale closure
            connectRef.current();
          }, delay);
        } else {
          console.log("[SSE] Max reconnection attempts reached");
          eventSource.close();
        }

        return attempts;
      });
    };

    eventSource.onmessage = (event) => {
      setLastEvent(event);
      optionsRef.current.onMessage?.(event);
    };

    // Register custom event handlers
    const handlers = optionsRef.current.eventHandlers;
    if (handlers) {
      for (const [eventName, handler] of Object.entries(handlers)) {
        eventSource.addEventListener(eventName, (event) => {
          try {
            const data = JSON.parse((event as MessageEvent).data);
            handler(data);
          } catch {
            // Ignore parse errors
          }
        });
      }
    }
  }, [url]);

  // Keep connect ref updated
  React.useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // Connect when URL changes
  React.useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect]);

  const close = React.useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const reconnect = React.useCallback(() => {
    setReconnectAttempts(0);
    connect();
  }, [connect]);

  return { isConnected, lastEvent, reconnectAttempts, close, reconnect };
}
