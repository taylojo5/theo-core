"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageErrorFallback } from "@/components/shared/error-boundary";
import { logError } from "@/lib/utils/error-handler";

// ═══════════════════════════════════════════════════════════════════════════
// Dashboard Error Page
// Next.js error boundary for the dashboard route segment
// ═══════════════════════════════════════════════════════════════════════════

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  const router = useRouter();

  useEffect(() => {
    logError(error, {
      type: "dashboard-error",
      digest: error.digest,
    });
  }, [error]);

  return (
    <PageErrorFallback
      error={error}
      onReset={reset}
      onGoHome={() => router.push("/")}
    />
  );
}
