"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Gmail Sync Configuration Component
// Configure sync settings (labels, email age, attachments)
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
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface SyncConfigData {
  syncConfigured: boolean;
  syncLabels: string[];
  excludeLabels: string[];
  maxEmailAgeDays: number | null;
  syncAttachments: boolean;
}

export interface LabelOption {
  id: string;
  gmailId: string;
  name: string;
  type: string;
  messageCount: number;
  unreadCount: number;
}

export interface SyncConfigProps {
  config?: SyncConfigData;
  labels?: LabelOption[];
  isLoading?: boolean;
  isConnected?: boolean;
  /** Whether metadata (labels) has been synced */
  metadataSynced?: boolean;
  onSave: (config: Partial<SyncConfigData>) => Promise<void>;
  className?: string;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function SyncConfigPanel({
  config,
  labels = [],
  isLoading = false,
  isConnected = false,
  metadataSynced = false,
  onSave,
  className,
}: SyncConfigProps) {
  // Start in editing mode if sync not configured (first-time setup)
  const [isEditing, setIsEditing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  // Initialize with sensible defaults to avoid undefined fields during setup mode
  const [editedConfig, setEditedConfig] = React.useState<
    Partial<SyncConfigData>
  >({
    syncLabels: [],
    maxEmailAgeDays: 90,
    syncAttachments: true,
  });

  const isSetupMode = !config?.syncConfigured;

  // Reset edited config when config changes (or initialize from config on first load)
  React.useEffect(() => {
    if (config) {
      setEditedConfig({
        syncLabels: config.syncLabels ?? [],
        maxEmailAgeDays: config.maxEmailAgeDays ?? 90,
        syncAttachments: config.syncAttachments ?? true,
      });
    }
  }, [config]);

  // Auto-enter edit mode when in setup mode
  React.useEffect(() => {
    if (isSetupMode && isConnected && metadataSynced) {
      setIsEditing(true);
    }
  }, [isSetupMode, isConnected, metadataSynced]);

  const handleSave = async () => {
    // Validate at least one label is selected
    if (!editedConfig.syncLabels || editedConfig.syncLabels.length === 0) {
      return; // Button should be disabled anyway
    }
    
    setIsSaving(true);
    try {
      await onSave(editedConfig);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (config) {
      setEditedConfig({
        syncLabels: config.syncLabels,
        maxEmailAgeDays: config.maxEmailAgeDays ?? 90,
        syncAttachments: config.syncAttachments,
      });
    }
    // Only allow cancel if already configured
    if (!isSetupMode) {
      setIsEditing(false);
    }
  };

  const toggleLabel = (labelId: string) => {
    const current = editedConfig.syncLabels || [];
    const updated = current.includes(labelId)
      ? current.filter((id) => id !== labelId)
      : [...current, labelId];
    setEditedConfig((prev) => ({ ...prev, syncLabels: updated }));
  };

  // Check if save is allowed (at least one label selected)
  const canSave = (editedConfig.syncLabels?.length ?? 0) > 0;

  if (!isConnected) {
    return (
      <Card className={cn("opacity-60", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ConfigIcon className="size-5" />
            Sync Configuration
          </CardTitle>
          <CardDescription>
            Connect Gmail to configure sync settings
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={cn("relative", isSetupMode && "ring-2 ring-blue-500 ring-offset-2", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ConfigIcon className="size-5" />
              {isSetupMode ? "Set Up Email Sync" : "Sync Configuration"}
              {isSetupMode && (
                <Badge variant="secondary" className="text-xs">
                  Required
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {isSetupMode 
                ? "Select which email labels you want to sync. Only emails with these labels will be imported."
                : "Customize which emails are synced"}
            </CardDescription>
          </div>
          {!isEditing && !isSetupMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              disabled={isLoading}
            >
              <EditIcon className="mr-1 size-4" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="default" label="Loading configuration..." />
          </div>
        ) : !metadataSynced && isSetupMode ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Spinner size="default" className="mb-4" />
            <p className="text-muted-foreground">
              Loading your Gmail labels...
            </p>
            <p className="text-muted-foreground text-sm">
              This may take a moment
            </p>
          </div>
        ) : (
          <>
            {/* Max Email Age */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Sync emails from the last
              </label>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={editedConfig.maxEmailAgeDays || 90}
                    onChange={(e) =>
                      setEditedConfig((prev) => ({
                        ...prev,
                        maxEmailAgeDays: parseInt(e.target.value) || 90,
                      }))
                    }
                    className="w-24"
                  />
                  <span className="text-muted-foreground text-sm">days</span>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {config?.maxEmailAgeDays || 90} days
                </p>
              )}
            </div>

            {/* Sync Attachments */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Sync Attachments</p>
                <p className="text-muted-foreground text-sm">
                  Include attachment metadata in sync
                </p>
              </div>
              {isEditing ? (
                <Button
                  variant={editedConfig.syncAttachments ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    setEditedConfig((prev) => ({
                      ...prev,
                      syncAttachments: !prev.syncAttachments,
                    }))
                  }
                >
                  {editedConfig.syncAttachments ? "Enabled" : "Disabled"}
                </Button>
              ) : (
                <Badge
                  variant={config?.syncAttachments ? "success" : "secondary"}
                >
                  {config?.syncAttachments ? "Enabled" : "Disabled"}
                </Badge>
              )}
            </div>

            {/* Labels to Sync */}
            {labels.length > 0 && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">
                    Labels to Sync
                    <span className="text-destructive ml-1">*</span>
                  </label>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Only emails with selected labels will be synced. Select at least one label.
                  </p>
                </div>
                
                {/* Show validation message if no labels selected in edit mode */}
                {isEditing && (editedConfig.syncLabels?.length ?? 0) === 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      <WarningIcon className="mr-1.5 inline-block size-4" />
                      Please select at least one label to sync
                    </p>
                  </div>
                )}
                
                <div className="flex flex-wrap gap-1.5">
                  {labels.slice(0, 20).map((label) => {
                    const isSelected = (editedConfig.syncLabels || []).includes(
                      label.gmailId
                    );
                    return (
                      <Badge
                        key={label.gmailId}
                        variant={isSelected ? "default" : "outline"}
                        className={cn(
                          "cursor-pointer transition-colors",
                          isEditing && !isSelected && "hover:bg-primary/20",
                          isEditing && isSelected && "hover:bg-primary/80"
                        )}
                        onClick={() =>
                          isEditing && toggleLabel(label.gmailId)
                        }
                      >
                        {label.name}
                        {label.messageCount > 0 && (
                          <span className="text-muted-foreground ml-1 text-xs">
                            ({label.messageCount.toLocaleString()})
                          </span>
                        )}
                        {isSelected && <CheckIcon className="ml-1 size-3" />}
                      </Badge>
                    );
                  })}
                  {labels.length > 20 && (
                    <Badge variant="secondary" className="text-xs">
                      +{labels.length - 20} more
                    </Badge>
                  )}
                </div>
                {!isEditing && (editedConfig.syncLabels?.length || 0) === 0 && (
                  <p className="text-destructive text-sm">
                    No labels selected - email sync is disabled
                  </p>
                )}
                {!isEditing && (editedConfig.syncLabels?.length || 0) > 0 && (
                  <p className="text-muted-foreground text-xs">
                    Syncing {editedConfig.syncLabels?.length} label{editedConfig.syncLabels?.length === 1 ? "" : "s"}
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            {isEditing && (
              <div className="flex justify-end gap-2 border-t pt-4">
                {!isSetupMode && (
                  <Button
                    variant="ghost"
                    onClick={handleCancel}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                )}
                <Button 
                  onClick={handleSave} 
                  disabled={isSaving || !canSave}
                  className={isSetupMode ? "w-full sm:w-auto" : ""}
                >
                  {isSaving ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      {isSetupMode ? "Starting Sync..." : "Saving..."}
                    </>
                  ) : isSetupMode ? (
                    <>
                      <StartIcon className="mr-2 size-4" />
                      Start Email Sync
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────

function ConfigIcon({ className }: { className?: string }) {
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
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
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
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function StartIcon({ className }: { className?: string }) {
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
        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

export default SyncConfigPanel;
