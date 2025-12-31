"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { DashboardHeader } from "./dashboard-header";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface DashboardLayoutProps {
  /** Sidebar content (e.g., ConversationSidebar) */
  sidebar?: React.ReactNode;
  /** Main content area */
  children: React.ReactNode;
  /** Additional className for the main content area */
  className?: string;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function DashboardLayout({
  sidebar,
  children,
  className,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <div className="bg-background flex h-screen flex-col">
      {/* Header */}
      <DashboardHeader
        showMobileMenu={!!sidebar}
        onMobileMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - hidden on mobile unless open */}
        {sidebar && (
          <>
            {/* Mobile overlay */}
            {sidebarOpen && (
              <div
                className="fixed inset-0 z-40 bg-black/50 md:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            {/* Sidebar container */}
            <div
              className={cn(
                "fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 md:relative md:z-0 md:translate-x-0",
                sidebarOpen ? "translate-x-0" : "-translate-x-full"
              )}
              style={{ top: "3.5rem" }} // Below header
            >
              {sidebar}
            </div>
          </>
        )}

        {/* Main content */}
        <main className={cn("flex flex-1 flex-col overflow-hidden", className)}>
          {children}
        </main>
      </div>
    </div>
  );
}
