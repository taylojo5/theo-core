"use client";

import * as React from "react";
import { Button } from "@/components/ui";

// ═══════════════════════════════════════════════════════════════════════════
// Error Boundary
// Catches React errors and displays a fallback UI
// ═══════════════════════════════════════════════════════════════════════════

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback error={this.state.error} onReset={this.handleReset} />
      );
    }

    return this.props.children;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Error Fallback UI
// Default fallback when an error is caught
// ═══════════════════════════════════════════════════════════════════════════

interface ErrorFallbackProps {
  error: Error | null;
  onReset?: () => void;
}

export function ErrorFallback({ error, onReset }: ErrorFallbackProps) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
      <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950">
        <div className="mb-4 text-4xl">⚠️</div>
        <h2 className="mb-2 text-lg font-semibold text-red-800 dark:text-red-200">
          Something went wrong
        </h2>
        <p className="mb-4 text-sm text-red-600 dark:text-red-400">
          {error?.message || "An unexpected error occurred"}
        </p>
        {process.env.NODE_ENV === "development" && error?.stack && (
          <details className="mb-4 text-left">
            <summary className="cursor-pointer text-xs text-red-500">
              Stack trace
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-red-100 p-2 text-xs dark:bg-red-900">
              {error.stack}
            </pre>
          </details>
        )}
        {onReset && (
          <Button variant="outline" onClick={onReset}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Page Error Fallback
// Full-page error state for route-level errors
// ═══════════════════════════════════════════════════════════════════════════

interface PageErrorFallbackProps {
  error: Error | null;
  onReset?: () => void;
  onGoHome?: () => void;
}

export function PageErrorFallback({
  error,
  onReset,
  onGoHome,
}: PageErrorFallbackProps) {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-lg text-center">
        <div className="mb-6 text-6xl">🔧</div>
        <h1 className="text-foreground mb-4 text-2xl font-bold">
          Oops! Something broke
        </h1>
        <p className="text-muted-foreground mb-6">
          {error?.message ||
            "We encountered an unexpected error. Please try again."}
        </p>
        <div className="flex justify-center gap-4">
          {onReset && (
            <Button variant="outline" onClick={onReset}>
              Try again
            </Button>
          )}
          {onGoHome && <Button onClick={onGoHome}>Go home</Button>}
        </div>
      </div>
    </div>
  );
}
