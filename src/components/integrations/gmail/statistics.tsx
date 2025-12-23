"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Gmail Statistics Component
// Displays email counts and integration metrics
// ═══════════════════════════════════════════════════════════════════════════

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface GmailStatisticsData {
  emailCount: number;
  unreadCount: number;
  labelCount: number;
  contactCount: number;
  draftCount?: number;
  sentCount?: number;
}

export interface StatisticsProps {
  data?: GmailStatisticsData;
  isLoading?: boolean;
  isConnected?: boolean;
  onSyncContacts?: () => Promise<void>;
  className?: string;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function Statistics({
  data,
  isLoading = false,
  isConnected = false,
  onSyncContacts,
  className,
}: StatisticsProps) {
  const [isSyncingContacts, setIsSyncingContacts] = React.useState(false);

  const handleSyncContacts = async () => {
    if (!onSyncContacts) return;
    setIsSyncingContacts(true);
    try {
      await onSyncContacts();
    } finally {
      setIsSyncingContacts(false);
    }
  };

  if (!isConnected) {
    return (
      <Card className={cn("opacity-60", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChartIcon className="size-5" />
            Statistics
          </CardTitle>
          <CardDescription>Connect Gmail to view statistics</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={cn("relative", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ChartIcon className="size-5" />
              Statistics
            </CardTitle>
            <CardDescription>
              Your Gmail integration at a glance
            </CardDescription>
          </div>
          {onSyncContacts && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncContacts}
              disabled={isSyncingContacts || isLoading}
            >
              {isSyncingContacts ? (
                <Spinner size="sm" className="mr-2" />
              ) : (
                <ContactIcon className="mr-2 size-4" />
              )}
              Sync Contacts
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="default" label="Loading statistics..." />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <StatCard
              icon={<EmailIcon className="size-5" />}
              label="Total Emails"
              value={data?.emailCount ?? 0}
              color="blue"
            />
            <StatCard
              icon={<UnreadIcon className="size-5" />}
              label="Unread"
              value={data?.unreadCount ?? 0}
              color="amber"
            />
            <StatCard
              icon={<LabelIcon className="size-5" />}
              label="Labels"
              value={data?.labelCount ?? 0}
              color="purple"
            />
            <StatCard
              icon={<ContactIcon className="size-5" />}
              label="Contacts"
              value={data?.contactCount ?? 0}
              color="emerald"
            />
            {data?.draftCount !== undefined && (
              <StatCard
                icon={<DraftIcon className="size-5" />}
                label="Drafts"
                value={data.draftCount}
                color="gray"
              />
            )}
            {data?.sentCount !== undefined && (
              <StatCard
                icon={<SentIcon className="size-5" />}
                label="Sent"
                value={data.sentCount}
                color="green"
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color?: "blue" | "amber" | "purple" | "emerald" | "gray" | "green";
}

function StatCard({ icon, label, value, color = "blue" }: StatCardProps) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400",
    amber:
      "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400",
    purple:
      "bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400",
    emerald:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400",
    gray: "bg-gray-50 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
    green:
      "bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400",
  };

  return (
    <div className="bg-card rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <div className={cn("rounded-lg p-2", colorClasses[color])}>{icon}</div>
        <div>
          <p className="text-2xl font-semibold tabular-nums">
            {formatNumber(value)}
          </p>
          <p className="text-muted-foreground text-xs">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

// ─────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );
}

function EmailIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}

function UnreadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76"
      />
    </svg>
  );
}

function LabelIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
      />
    </svg>
  );
}

function ContactIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  );
}

function DraftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  );
}

function SentIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
      />
    </svg>
  );
}

export default Statistics;
