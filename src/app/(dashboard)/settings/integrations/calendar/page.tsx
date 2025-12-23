"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Calendar Settings Page
// Configuration and management for Google Calendar integration
// ═══════════════════════════════════════════════════════════════════════════

import * as React from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { DashboardLayout } from "@/components/layout";
import { Button, toast } from "@/components/ui";
import {
  CalendarConnectionStatus,
  CalendarList,
  CalendarSyncStatus,
  CalendarPendingApprovals,
  type CalendarConnectionStatusData,
  type CalendarListData,
  type CalendarSyncStatusData,
  type CalendarPendingApprovalsData,
} from "@/components/integrations/calendar";

// ─────────────────────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────────────────────

export default function CalendarSettingsPage() {
  // ───────────────────────────────────────────────────────────
  // State
  // ───────────────────────────────────────────────────────────

  const [connectionData, setConnectionData] = React.useState<
    CalendarConnectionStatusData | undefined
  >();
  const [calendarListData, setCalendarListData] = React.useState<
    CalendarListData | undefined
  >();
  const [syncData, setSyncData] = React.useState<
    CalendarSyncStatusData | undefined
  >();
  const [approvalsData, setApprovalsData] = React.useState<
    CalendarPendingApprovalsData | undefined
  >();

  const [loadingStates, setLoadingStates] = React.useState({
    connection: true,
    calendars: true,
    sync: true,
    approvals: true,
  });

  const isConnected =
    connectionData?.connected && connectionData?.hasRequiredScopes;

  // ───────────────────────────────────────────────────────────
  // Data Fetching
  // ───────────────────────────────────────────────────────────

  const fetchConnectionStatus = React.useCallback(async () => {
    setLoadingStates((s) => ({ ...s, connection: true }));
    try {
      const res = await fetch("/api/integrations/status");
      if (res.ok) {
        const status = await res.json();
        setConnectionData({
          connected: status.calendar?.connected || false,
          email: status.google?.email,
          hasRequiredScopes: status.calendar?.canRead || false,
          canRead: status.calendar?.canRead || false,
          canWrite: status.calendar?.canWrite || false,
          missingScopes: status.calendar?.missingScopes || [],
          tokenHealth: status.google?.tokenHealth,
        });
      }
    } catch (error) {
      toast.error("Failed to fetch connection status");
      console.error("Failed to fetch connection status:", error);
    } finally {
      setLoadingStates((s) => ({ ...s, connection: false }));
    }
  }, []);

  const fetchCalendars = React.useCallback(async () => {
    if (!isConnected) {
      setLoadingStates((s) => ({ ...s, calendars: false }));
      return;
    }

    setLoadingStates((s) => ({ ...s, calendars: true }));
    try {
      const res = await fetch("/api/integrations/calendar/calendars?includeHidden=true");
      if (res.ok) {
        const data = await res.json();
        setCalendarListData({
          calendars: data.calendars || [],
          count: data.count || 0,
        });
      }
    } catch (error) {
      toast.error("Failed to fetch calendars");
      console.error("Failed to fetch calendars:", error);
    } finally {
      setLoadingStates((s) => ({ ...s, calendars: false }));
    }
  }, [isConnected]);

  const fetchSyncStatus = React.useCallback(async () => {
    if (!isConnected) {
      setLoadingStates((s) => ({ ...s, sync: false }));
      return;
    }

    setLoadingStates((s) => ({ ...s, sync: true }));
    try {
      const res = await fetch("/api/integrations/calendar/sync");
      if (res.ok) {
        const data = await res.json();
        setSyncData({
          status: data.status || "idle",
          lastSyncAt: data.lastSyncAt,
          lastFullSyncAt: data.lastFullSyncAt,
          error: data.error,
          recurring: data.recurring || false,
          stats: {
            eventCount: data.stats?.eventCount || 0,
            calendarCount: data.stats?.calendarCount || 0,
            embeddingsPending: data.stats?.embeddingsPending || 0,
            embeddingsCompleted: data.stats?.embeddingsCompleted || 0,
          },
        });
      }
    } catch (error) {
      toast.error("Failed to fetch sync status");
      console.error("Failed to fetch sync status:", error);
    } finally {
      setLoadingStates((s) => ({ ...s, sync: false }));
    }
  }, [isConnected]);

  const fetchApprovals = React.useCallback(async () => {
    if (!isConnected) {
      setLoadingStates((s) => ({ ...s, approvals: false }));
      return;
    }

    setLoadingStates((s) => ({ ...s, approvals: true }));
    try {
      const res = await fetch("/api/integrations/calendar/approvals?pending=true");
      if (res.ok) {
        const data = await res.json();
        setApprovalsData({
          approvals: data.approvals || [],
          count: data.count || 0,
          stats: {
            pending: data.approvals?.length || 0,
            approved: 0,
            rejected: 0,
            expired: 0,
            total: data.total || 0,
          },
        });
      }
    } catch (error) {
      toast.error("Failed to fetch approvals");
      console.error("Failed to fetch approvals:", error);
    } finally {
      setLoadingStates((s) => ({ ...s, approvals: false }));
    }
  }, [isConnected]);

  // Initial load
  React.useEffect(() => {
    fetchConnectionStatus();
  }, [fetchConnectionStatus]);

  // Load dependent data when connected
  React.useEffect(() => {
    if (isConnected) {
      fetchCalendars();
      fetchSyncStatus();
      fetchApprovals();
    }
  }, [isConnected, fetchCalendars, fetchSyncStatus, fetchApprovals]);

  // ───────────────────────────────────────────────────────────
  // Handlers
  // ───────────────────────────────────────────────────────────

  const handleConnect = async () => {
    try {
      await signIn("google", {
        callbackUrl: "/settings/integrations/calendar",
        scope: "https://www.googleapis.com/auth/calendar.events",
      });
    } catch (error) {
      toast.error("Failed to initiate connection");
      console.error("Failed to connect:", error);
    }
  };

  const handleDisconnect = async () => {
    try {
      const res = await fetch("/api/auth/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "google" }),
      });
      if (res.ok) {
        toast.success("Calendar disconnected");
        fetchConnectionStatus();
      } else {
        toast.error("Failed to disconnect");
      }
    } catch (error) {
      toast.error("Failed to disconnect");
      console.error("Failed to disconnect:", error);
    }
  };

  const handleToggleCalendarSelection = async (
    calendarId: string,
    isSelected: boolean
  ) => {
    try {
      const res = await fetch(`/api/integrations/calendar/calendars/${calendarId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSelected }),
      });
      if (res.ok) {
        fetchCalendars();
      } else {
        toast.error("Failed to update calendar");
      }
    } catch (error) {
      toast.error("Failed to update calendar");
      console.error("Failed to update calendar:", error);
    }
  };

  const handleToggleCalendarHidden = async (
    calendarId: string,
    isHidden: boolean
  ) => {
    try {
      const res = await fetch(`/api/integrations/calendar/calendars/${calendarId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHidden }),
      });
      if (res.ok) {
        fetchCalendars();
      } else {
        toast.error("Failed to update calendar");
      }
    } catch (error) {
      toast.error("Failed to update calendar");
      console.error("Failed to update calendar:", error);
    }
  };

  const handleTriggerFullSync = async () => {
    try {
      const res = await fetch("/api/integrations/calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "full" }),
      });
      if (res.ok) {
        toast.success("Full sync started");
        fetchSyncStatus();
      } else {
        toast.error("Failed to start sync");
      }
    } catch (error) {
      toast.error("Failed to start sync");
      console.error("Failed to start sync:", error);
    }
  };

  const handleTriggerIncrementalSync = async () => {
    try {
      const res = await fetch("/api/integrations/calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "incremental" }),
      });
      if (res.ok) {
        toast.success("Sync started");
        fetchSyncStatus();
      } else {
        toast.error("Failed to start sync");
      }
    } catch (error) {
      toast.error("Failed to start sync");
      console.error("Failed to start sync:", error);
    }
  };

  const handleToggleRecurring = async (enabled: boolean) => {
    try {
      const res = await fetch("/api/integrations/calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enableRecurring: enabled }),
      });
      if (res.ok) {
        toast.success(enabled ? "Auto sync enabled" : "Auto sync disabled");
        fetchSyncStatus();
      } else {
        toast.error("Failed to update sync settings");
      }
    } catch (error) {
      toast.error("Failed to update sync settings");
      console.error("Failed to update sync settings:", error);
    }
  };

  const handleApproveAction = async (id: string, notes?: string) => {
    try {
      const res = await fetch(`/api/integrations/calendar/approvals/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", notes }),
      });
      if (res.ok) {
        toast.success("Action approved");
        fetchApprovals();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to approve action");
      }
    } catch (error) {
      toast.error("Failed to approve action");
      console.error("Failed to approve action:", error);
    }
  };

  const handleRejectAction = async (id: string, notes?: string) => {
    try {
      const res = await fetch(`/api/integrations/calendar/approvals/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", notes }),
      });
      if (res.ok) {
        toast.success("Action rejected");
        fetchApprovals();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to reject action");
      }
    } catch (error) {
      toast.error("Failed to reject action");
      console.error("Failed to reject action:", error);
    }
  };

  // ───────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl p-6">
          {/* Header */}
          <div className="mb-8">
            <div className="mb-4 flex items-center gap-2">
              <Link href="/settings/integrations">
                <Button variant="ghost" size="sm">
                  <ChevronLeftIcon className="mr-1 size-4" />
                  Back to Integrations
                </Button>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <CalendarIcon className="size-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  Google Calendar
                </h1>
                <p className="text-muted-foreground mt-1">
                  Sync your calendar events and manage scheduling
                </p>
              </div>
            </div>
          </div>

          {/* Content Grid */}
          <div className="space-y-6">
            {/* Connection Status */}
            <CalendarConnectionStatus
              data={connectionData}
              isLoading={loadingStates.connection}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onRefresh={fetchConnectionStatus}
            />

            {/* Sync Status */}
            <CalendarSyncStatus
              data={syncData}
              isLoading={loadingStates.sync}
              isConnected={isConnected}
              onTriggerFullSync={handleTriggerFullSync}
              onTriggerIncrementalSync={handleTriggerIncrementalSync}
              onToggleRecurring={handleToggleRecurring}
              onRefresh={fetchSyncStatus}
            />

            {/* Calendar List */}
            <CalendarList
              data={calendarListData}
              isLoading={loadingStates.calendars}
              isConnected={isConnected}
              onToggleSelection={handleToggleCalendarSelection}
              onToggleHidden={handleToggleCalendarHidden}
              onRefresh={fetchCalendars}
            />

            {/* Pending Approvals */}
            <CalendarPendingApprovals
              data={approvalsData}
              isLoading={loadingStates.approvals}
              isConnected={isConnected}
              onApprove={handleApproveAction}
              onReject={handleRejectAction}
              onRefresh={fetchApprovals}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

// ─────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
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
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

