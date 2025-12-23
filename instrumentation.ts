// ═══════════════════════════════════════════════════════════════════════════
// Next.js Instrumentation
// Server startup hooks for initializing background services
// @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * This function is called when the Next.js server starts.
 * It's used to initialize background services like the Gmail sync worker
 * and approval expiration scheduler.
 */
export async function register() {
  // Only run on the server (not in Edge runtime or during build)
  if (typeof window === "undefined" && process.env.NEXT_RUNTIME === "nodejs") {
    try {
      // Dynamically import to avoid bundling issues
      const { initializeGmailSync } = await import("@/integrations/gmail");

      // Initialize Gmail sync system (worker + scheduler)
      await initializeGmailSync();

      console.log("[Instrumentation] Gmail sync system initialized");
    } catch (error) {
      // Log error but don't crash the server
      console.error(
        "[Instrumentation] Failed to initialize Gmail sync:",
        error
      );
    }

    // Initialize embedding worker
    try {
      const { initializeEmbeddingWorker } =
        await import("@/lib/queue/embedding-worker");
      initializeEmbeddingWorker();

      console.log("[Instrumentation] Embedding worker initialized");
    } catch (error) {
      console.error(
        "[Instrumentation] Failed to initialize embedding worker:",
        error
      );
    }
  }
}
