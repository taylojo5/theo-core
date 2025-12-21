"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Gmail Connection Status Component
// Displays connection state with connect/disconnect actions
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
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ConnectionStatusData {
  connected: boolean;
  email?: string;
  hasRequiredScopes: boolean;
  missingScopes: string[];
  error?: string;
  tokenHealth?: {
    hasRefreshToken: boolean;
    isExpired: boolean;
    expiresIn?: number;
    expiresInHuman?: string;
  };
}

export interface ConnectionStatusProps {
  data?: ConnectionStatusData;
  isLoading?: boolean;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  onRefresh: () => void;
  className?: string;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function ConnectionStatus({
  data,
  isLoading = false,
  onConnect,
  onDisconnect,
  onRefresh,
  className,
}: ConnectionStatusProps) {
  const [actionLoading, setActionLoading] = React.useState<
    "connect" | "disconnect" | null
  >(null);

  const handleConnect = async () => {
    setActionLoading("connect");
    try {
      await onConnect();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async () => {
    setActionLoading("disconnect");
    try {
      await onDisconnect();
    } finally {
      setActionLoading(null);
    }
  };

  const isConnected = data?.connected && data?.hasRequiredScopes;

  return (
    <Card className={cn("relative", className)}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-red-600">
            <GmailIcon className="size-5 text-white" />
          </div>
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              Gmail Integration
              {isConnected && (
                <Badge variant="success" className="text-xs">
                  Connected
                </Badge>
              )}
              {data?.connected && !data?.hasRequiredScopes && (
                <Badge variant="warning" className="text-xs">
                  Limited Access
                </Badge>
              )}
              {data && !data.connected && (
                <Badge variant="secondary" className="text-xs">
                  Not Connected
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {isConnected
                ? `Connected as ${data?.email || "Unknown"}`
                : "Connect your Gmail account to sync emails and contacts"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Spinner size="default" label="Loading connection status..." />
          </div>
        ) : (
          <>
            {/* Token Health */}
            {isConnected && data?.tokenHealth && (
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="mb-2 text-sm font-medium">Token Status</h4>
                <div className="text-muted-foreground grid grid-cols-2 gap-2 text-sm">
                  <span>Refresh Token:</span>
                  <span
                    className={
                      data.tokenHealth.hasRefreshToken
                        ? "text-emerald-600"
                        : "text-red-600"
                    }
                  >
                    {data.tokenHealth.hasRefreshToken ? "Available" : "Missing"}
                  </span>
                  <span>Token Status:</span>
                  <span
                    className={
                      data.tokenHealth.isExpired
                        ? "text-red-600"
                        : "text-emerald-600"
                    }
                  >
                    {data.tokenHealth.isExpired
                      ? "Expired"
                      : data.tokenHealth.expiresInHuman || "Valid"}
                  </span>
                </div>
              </div>
            )}

            {/* Connection Error */}
            {data?.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
                <h4 className="mb-1 text-sm font-medium text-red-800 dark:text-red-200">
                  Connection Error
                </h4>
                <p className="text-sm text-red-700 dark:text-red-300">
                  {data.error}
                </p>
              </div>
            )}

            {/* Missing Scopes Warning */}
            {data?.connected && !data?.hasRequiredScopes && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                <h4 className="mb-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                  Additional Permissions Required
                </h4>
                <p className="text-muted-foreground mb-3 text-sm">
                  Please reconnect to grant all required permissions.
                </p>
                <div className="flex flex-wrap gap-1">
                  {data.missingScopes.map((scope) => (
                    <Badge
                      key={scope}
                      variant="outline"
                      className="font-mono text-xs"
                    >
                      {scope.split("/").pop()}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Permissions Info */}
            {isConnected && (
              <div className="text-muted-foreground space-y-1 text-sm">
                <p className="text-foreground font-medium">
                  Granted Permissions:
                </p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>Read emails and labels</li>
                  <li>Send emails (with approval)</li>
                  <li>Access contacts</li>
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              {isConnected ? (
                <>
                  <Button
                    variant="outline"
                    onClick={onRefresh}
                    disabled={actionLoading !== null}
                  >
                    <RefreshIcon className="mr-2 size-4" />
                    Refresh Status
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDisconnect}
                    disabled={actionLoading !== null}
                  >
                    {actionLoading === "disconnect" ? (
                      <Spinner size="sm" className="mr-2" />
                    ) : (
                      <DisconnectIcon className="mr-2 size-4" />
                    )}
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleConnect}
                  disabled={actionLoading !== null}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  {actionLoading === "connect" ? (
                    <Spinner size="sm" className="mr-2" />
                  ) : (
                    <GmailIcon className="mr-2 size-4" />
                  )}
                  Connect Gmail
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────

function GmailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
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
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function DisconnectIcon({ className }: { className?: string }) {
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
        d="M13.181 8.68a4 4 0 0 0-5.5 5.5M10.82 15.32a4 4 0 0 0 5.5-5.5M3.34 7l1.415 1.414m14.9 0L21.07 7M3.34 17l1.415-1.414m14.9 0L21.07 17M7 3.34l1.414 1.415m0 14.9L7 21.07M17 3.34l-1.414 1.415m0 14.9L17 21.07"
      />
    </svg>
  );
}

export default ConnectionStatus;
