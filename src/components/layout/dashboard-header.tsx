"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { UserDropdown } from "@/components/user-dropdown";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface DashboardHeaderProps {
  /** Whether to show the mobile menu button */
  showMobileMenu?: boolean;
  /** Called when mobile menu button is clicked */
  onMobileMenuClick?: () => void;
  /** Additional className */
  className?: string;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function DashboardHeader({
  showMobileMenu = true,
  onMobileMenuClick,
  className,
}: DashboardHeaderProps) {
  return (
    <header
      className={cn(
        "bg-background/95 supports-[backdrop-filter]:bg-background/60 flex h-14 items-center justify-between border-b px-4 backdrop-blur",
        className
      )}
    >
      {/* Left side */}
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        {showMobileMenu && onMobileMenuClick && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onMobileMenuClick}
            className="md:hidden"
          >
            <svg
              className="size-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
            <span className="sr-only">Toggle menu</span>
          </Button>
        )}

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600">
            <span className="text-sm font-bold text-white">T</span>
          </div>
          <span className="hidden text-lg font-semibold tracking-tight sm:inline-block">
            Theo
          </span>
        </Link>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Theme toggle placeholder - can be added later */}
        <UserDropdown />
      </div>
    </header>
  );
}
