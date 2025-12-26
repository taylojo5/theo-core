"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Gmail Settings Page
// Configuration and management for Gmail integration
// ═══════════════════════════════════════════════════════════════════════════

import * as React from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { DashboardLayout } from "@/components/layout";
import { Button, toast } from "@/components/ui";
import {
  ConnectionStatus,
  SyncSettings,
  SyncHistory,
  PendingApprovals,
  Statistics,
  SyncConfigPanel,
  type ConnectionStatusData,
  type SyncSettingsData,
  type SyncHistoryData,
  type PendingApprovalsData,
  type GmailStatisticsData,
  type SyncConfigData,
} from "@/components/integrations/gmail";

// ─────────────────────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────────────────────

export default function GmailSettingsPage() {
  // ───────────────────────────────────────────────────────────
  // State
  // ───────────────────────────────────────────────────────────

  const [connectionData, setConnectionData] = React.useState<
    ConnectionStatusData | undefined
  >();
  const [syncData, setSyncData] = React.useState<
    SyncSettingsData | undefined
  >();
  const [historyData, setHistoryData] = React.useState<
    SyncHistoryData | undefined
  >();
  const [approvalsData, setApprovalsData] = React.useState<
    PendingApprovalsData | undefined
  >();
  const [statsData, setStatsData] = React.useState<
    GmailStatisticsData | undefined
  >();

  // Config state (separate from sync for the new config endpoint)
  const [configData, setConfigData] = React.useState<{
    syncConfigured: boolean;
    syncLabels: string[];
    excludeLabels: string[];
    maxEmailAgeDays: number | null;
    syncAttachments: boolean;
  } | undefined>();
  const [availableLabels, setAvailableLabels] = React.useState<Array<{
    id: string;
    gmailId: string;
    name: string;
    type: string;
    messageCount: number;
    unreadCount: number;
  }>>([]);
  const [metadataSynced, setMetadataSynced] = React.useState(false);
  const [metadataSyncing, setMetadataSyncing] = React.useState(false);

  const [loadingStates, setLoadingStates] = React.useState({
    connection: true,
    sync: true,
    approvals: true,
    config: true,
  });

  const isConnected =
    connectionData?.connected && connectionData?.hasRequiredScopes;

  // ───────────────────────────────────────────────────────────
  // Data Fetching
  // ───────────────────────────────────────────────────────────

  const fetchConnectionStatus = React.useCallback(async () => {
    setLoadingStates((s) => ({ ...s, connection: true }));
    try {
      const [statusRes, connectRes] = await Promise.all([
        fetch("/api/integrations/status"),
        fetch("/api/integrations/gmail/connect"),
      ]);

      if (statusRes.ok && connectRes.ok) {
        const status = await statusRes.json();
        const connect = await connectRes.json();

        setConnectionData({
          connected: status.google?.connected || false,
          email: status.google?.email,
          hasRequiredScopes: connect.hasRequiredScopes,
          missingScopes: connect.missingScopes || [],
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

  const fetchSyncStatus = React.useCallback(async () => {
    if (!isConnected) {
      setLoadingStates((s) => ({ ...s, sync: false }));
      return;
    }

    setLoadingStates((s) => ({ ...s, sync: true }));
    try {
      const res = await fetch("/api/integrations/gmail/sync/status");
      if (res.ok) {
        const data = await res.json();

        setSyncData({
          status: data.status || "idle",
          error: data.error,
          lastSyncAt: data.lastSyncAt,
          lastFullSyncAt: data.lastFullSyncAt,
          recurring: data.recurring || false,
          hasActiveSyncs: data.hasActiveSyncs || false,
          config: data.config || {
            syncLabels: [],
            excludeLabels: [],
            maxEmailAgeDays: 90,
            syncAttachments: false,
          },
          labels: data.labels || [],
        });

        setHistoryData({
          pendingJobs: data.pendingJobs || [],
          lastSyncAt: data.lastSyncAt,
          lastFullSyncAt: data.lastFullSyncAt,
          historyId: data.historyId,
        });

        setStatsData({
          emailCount: data.stats?.emailCount || 0,
          unreadCount: data.stats?.unreadCount || 0,
          labelCount: data.stats?.labelCount || 0,
          contactCount: data.stats?.contactCount || 0,
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
      const [approvalsRes, statsRes] = await Promise.all([
        fetch("/api/integrations/gmail/approvals?pending=true"),
        fetch("/api/integrations/gmail/approvals?stats=true"),
      ]);

      if (approvalsRes.ok && statsRes.ok) {
        const approvals = await approvalsRes.json();
        const stats = await statsRes.json();

        setApprovalsData({
          approvals: approvals.approvals || [],
          count: approvals.count || 0,
          stats,
        });
      }
    } catch (error) {
      toast.error("Failed to fetch approvals");
      console.error("Failed to fetch approvals:", error);
    } finally {
      setLoadingStates((s) => ({ ...s, approvals: false }));
    }
  }, [isConnected]);

  const fetchSyncConfig = React.useCallback(async () => {
    if (!isConnected) {
      setLoadingStates((s) => ({ ...s, config: false }));
      return;
    }

    setLoadingStates((s) => ({ ...s, config: true }));
    try {
      const res = await fetch("/api/integrations/gmail/sync/config");
      if (res.ok) {
        const data = await res.json();
        setConfigData(data.config);
        setAvailableLabels(data.availableLabels || []);
        // Labels available means metadata has synced
        const hasLabels = (data.availableLabels?.length || 0) > 0;
        setMetadataSynced(hasLabels);
        // Track if metadata sync is in progress
        setMetadataSyncing(data.metadataSyncing === true && !hasLabels);
      }
    } catch (error) {
      console.error("Failed to fetch sync config:", error);
    } finally {
      setLoadingStates((s) => ({ ...s, config: false }));
    }
  }, [isConnected]);

  // Initial fetch
  React.useEffect(() => {
    fetchConnectionStatus();
  }, [fetchConnectionStatus]);

  // Fetch data when connected
  React.useEffect(() => {
    if (isConnected) {
      fetchSyncStatus();
      fetchApprovals();
      fetchSyncConfig();
    }
  }, [isConnected, fetchSyncStatus, fetchApprovals, fetchSyncConfig]);

  // Poll for updates when syncing
  React.useEffect(() => {
    if (!isConnected || !syncData?.hasActiveSyncs) return;

    const interval = setInterval(() => {
      fetchSyncStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [isConnected, syncData?.hasActiveSyncs, fetchSyncStatus]);

  // Poll for config updates when metadata is syncing
  React.useEffect(() => {
    if (!isConnected || !metadataSyncing) return;

    const interval = setInterval(() => {
      fetchSyncConfig();
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [isConnected, metadataSyncing, fetchSyncConfig]);

  // ───────────────────────────────────────────────────────────
  // Handlers
  // ───────────────────────────────────────────────────────────

  const handleConnect = async () => {
    try {
      const res = await fetch("/api/integrations/gmail/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redirectUrl: "/settings/integrations/gmail" }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || `Connection failed (${res.status})`);
      }

      const data = await res.json();

      if (data.signInRequired && data.authorizationParams) {
        // Use NextAuth's signIn() to properly handle PKCE and OAuth flow
        await signIn(
          "google",
          { callbackUrl: data.callbackUrl || "/settings/integrations/gmail" },
          data.authorizationParams
        );
      } else if (data.alreadyConnected) {
        // Already connected, refresh status
        await fetchConnectionStatus();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Connection failed";
      toast.error(message);
      console.error("Failed to connect Gmail:", error);
      // Update connection data to show error state
      setConnectionData((prev) =>
        prev
          ? {
              ...prev,
              error: message,
            }
          : undefined
      );
    }
  };

  const handleDisconnect = async () => {
    try {
      const res = await fetch("/api/integrations/gmail/disconnect", {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Gmail disconnected successfully");
        await fetchConnectionStatus();
        // Clear other data
        setSyncData(undefined);
        setHistoryData(undefined);
        setApprovalsData(undefined);
        setStatsData(undefined);
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to disconnect");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to disconnect Gmail";
      toast.error(message);
      console.error("Failed to disconnect Gmail:", error);
    }
  };

  const handleTriggerSync = async (type: "auto" | "full" | "incremental") => {
    try {
      const res = await fetch("/api/integrations/gmail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || `Sync failed (${res.status})`);
      }

      toast.success("Sync started");
      await fetchSyncStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      toast.error(message);
      console.error("Failed to trigger sync:", error);
      // Update sync data to show error state
      setSyncData((prev) =>
        prev
          ? {
              ...prev,
              status: "error",
              error: message,
            }
          : undefined
      );
    }
  };

  const handleToggleRecurring = async (enabled: boolean) => {
    try {
      const res = await fetch("/api/integrations/gmail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enableRecurring: enabled }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(
          error.error || `Failed to toggle recurring sync (${res.status})`
        );
      }

      toast.success(
        enabled ? "Recurring sync enabled" : "Recurring sync disabled"
      );
      await fetchSyncStatus();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to toggle recurring sync";
      toast.error(message);
      console.error("Failed to toggle recurring sync:", error);
      // Update sync data to show error state
      setSyncData((prev) =>
        prev
          ? {
              ...prev,
              error: message,
            }
          : undefined
      );
    }
  };

  const handleCancelSync = async () => {
    try {
      const res = await fetch("/api/integrations/gmail/sync?stopRecurring=true", {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || `Failed to cancel sync (${res.status})`);
      }

      toast.success("Sync cancelled");
      await fetchSyncStatus();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to cancel sync";
      toast.error(message);
      console.error("Failed to cancel sync:", error);
      // Update sync data to show error state
      setSyncData((prev) =>
        prev
          ? {
              ...prev,
              error: message,
            }
          : undefined
      );
    }
  };

  const handleApproveEmail = async (id: string) => {
    try {
      const res = await fetch(`/api/integrations/gmail/approvals/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to approve");
      }
      toast.success("Email approved and sent");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to approve email";
      toast.error(message);
      console.error("Failed to approve email:", error);
      throw error;
    }
  };

  const handleRejectEmail = async (id: string, notes?: string) => {
    try {
      const res = await fetch(`/api/integrations/gmail/approvals/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", notes }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to reject");
      }
      toast.success("Email rejected");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to reject email";
      toast.error(message);
      console.error("Failed to reject email:", error);
      throw error;
    }
  };

  const handleSyncContacts = async () => {
    try {
      const res = await fetch("/api/integrations/gmail/sync/contacts", {
        method: "POST",
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || `Contact sync failed (${res.status})`);
      }

      toast.success("Contacts synced successfully");
      // Refresh the sync status to get updated contact count
      await fetchSyncStatus();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to sync contacts";
      toast.error(message);
      console.error("Failed to sync contacts:", error);
      throw error;
    }
  };

  const handleSaveSyncConfig = async (config: Partial<SyncConfigData>) => {
    try {
      const res = await fetch("/api/integrations/gmail/sync/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(
          error.error || `Failed to save config (${res.status})`
        );
      }

      const data = await res.json();
      
      if (data.syncStarted) {
        toast.success("Email sync started! Your emails are being imported.");
      } else {
        toast.success("Sync configuration saved");
      }
      
      // Refresh both config and sync status
      await Promise.all([fetchSyncConfig(), fetchSyncStatus()]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save sync config";
      toast.error(message);
      console.error("Failed to save sync config:", error);
      throw error;
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
                  Integrations
                </Button>
              </Link>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              Gmail Settings
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your Gmail integration, sync settings, and email approvals
            </p>
          </div>

          {/* Main Content */}
          <div className="space-y-6">
            {/* Connection Status */}
            <ConnectionStatus
              data={connectionData}
              isLoading={loadingStates.connection}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onRefresh={fetchConnectionStatus}
            />

            {/* Sync Configuration - Show FIRST if not configured (setup wizard) */}
            {isConnected && !configData?.syncConfigured && (
              <SyncConfigPanel
                config={configData}
                labels={availableLabels}
                isLoading={loadingStates.config}
                isConnected={isConnected}
                metadataSynced={metadataSynced}
                onSave={handleSaveSyncConfig}
              />
            )}

            {/* Show remaining UI only after sync is configured OR when not connected */}
            {/* Don't show while loading config - wait until we know the configuration status */}
            {(!isConnected || (configData?.syncConfigured && !loadingStates.config)) && (
              <>
                {/* Two Column Layout for Sync */}
                <div className="grid gap-6 lg:grid-cols-2">
                  <SyncSettings
                    data={syncData}
                    isLoading={loadingStates.sync}
                    isConnected={isConnected}
                    onTriggerSync={handleTriggerSync}
                    onToggleRecurring={handleToggleRecurring}
                    onCancelSync={handleCancelSync}
                  />

                  <SyncHistory
                    data={historyData}
                    isLoading={loadingStates.sync}
                    isConnected={isConnected}
                  />
                </div>

                {/* Sync Configuration - Show in normal position once configured */}
                {configData?.syncConfigured && (
                  <SyncConfigPanel
                    config={configData}
                    labels={availableLabels}
                    isLoading={loadingStates.config}
                    isConnected={isConnected}
                    metadataSynced={metadataSynced}
                    onSave={handleSaveSyncConfig}
                  />
                )}

                {/* Statistics */}
                <Statistics
                  data={statsData}
                  isLoading={loadingStates.sync}
                  isConnected={isConnected}
                  onSyncContacts={handleSyncContacts}
                />

                {/* Pending Approvals */}
                <PendingApprovals
                  data={approvalsData}
                  isLoading={loadingStates.approvals}
                  isConnected={isConnected}
                  onApprove={handleApproveEmail}
                  onReject={handleRejectEmail}
                  onRefresh={fetchApprovals}
                />
              </>
            )}
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
