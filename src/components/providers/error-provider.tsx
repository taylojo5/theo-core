"use client";

import * as React from "react";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { logError } from "@/lib/utils/error-handler";

// ═══════════════════════════════════════════════════════════════════════════
// Error Provider
// Global error boundary and unhandled rejection handler
// ═══════════════════════════════════════════════════════════════════════════

interface ErrorProviderProps {
  children: React.ReactNode;
}

export function ErrorProvider({ children }: ErrorProviderProps) {
  React.useEffect(() => {
    // Global unhandled rejection handler
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logError(
        event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason)),
        { type: "unhandledrejection" }
      );
    };

    // Global error handler
    const handleError = (event: ErrorEvent) => {
      logError(event.error || new Error(event.message), {
        type: "error",
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleError);

    return () => {
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection
      );
      window.removeEventListener("error", handleError);
    };
  }, []);

  const handleBoundaryError = React.useCallback(
    (error: Error, errorInfo: React.ErrorInfo) => {
      logError(error, {
        componentStack: errorInfo.componentStack,
        type: "react-error-boundary",
      });
    },
    []
  );

  return (
    <ErrorBoundary onError={handleBoundaryError}>{children}</ErrorBoundary>
  );
}
