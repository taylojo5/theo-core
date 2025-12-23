"use client";

import { useEffect } from "react";
import { PageErrorFallback } from "@/components/shared/error-boundary";
import { logError } from "@/lib/utils/error-handler";

// ═══════════════════════════════════════════════════════════════════════════
// Global Error Page
// Next.js error boundary for the root route segment
// ═══════════════════════════════════════════════════════════════════════════

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    logError(error, {
      type: "global-error",
      digest: error.digest,
    });
  }, [error]);

  return <PageErrorFallback error={error} onReset={reset} />;
}
