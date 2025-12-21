"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Toaster Component
// Toast notifications using Sonner
// ═══════════════════════════════════════════════════════════════════════════

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        className: "font-sans",
        duration: 5000,
      }}
    />
  );
}

// Re-export toast function for easy imports
export { toast } from "sonner";
