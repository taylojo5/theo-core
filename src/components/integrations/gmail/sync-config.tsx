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
  syncLabels: string[];
  excludeLabels: string[];
  maxEmailAgeDays: number;
  syncAttachments: boolean;
}

export interface LabelOption {
  id: string;
  name: string;
  type: string;
  messageCount: number;
}

export interface SyncConfigProps {
  config?: SyncConfigData;
  labels?: LabelOption[];
  isLoading?: boolean;
  isConnected?: boolean;
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
  onSave,
  className,
}: SyncConfigProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [editedConfig, setEditedConfig] = React.useState<
    Partial<SyncConfigData>
  >({});

  // Reset edited config when config changes
  React.useEffect(() => {
    if (config) {
      setEditedConfig({
        syncLabels: config.syncLabels,
        excludeLabels: config.excludeLabels,
        maxEmailAgeDays: config.maxEmailAgeDays,
        syncAttachments: config.syncAttachments,
      });
    }
  }, [config]);

  const handleSave = async () => {
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
        excludeLabels: config.excludeLabels,
        maxEmailAgeDays: config.maxEmailAgeDays,
        syncAttachments: config.syncAttachments,
      });
    }
    setIsEditing(false);
  };

  const toggleLabel = (
    labelId: string,
    field: "syncLabels" | "excludeLabels"
  ) => {
    const current = editedConfig[field] || [];
    const updated = current.includes(labelId)
      ? current.filter((id) => id !== labelId)
      : [...current, labelId];
    setEditedConfig((prev) => ({ ...prev, [field]: updated }));
  };

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
    <Card className={cn("relative", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ConfigIcon className="size-5" />
              Sync Configuration
            </CardTitle>
            <CardDescription>Customize which emails are synced</CardDescription>
          </div>
          {!isEditing && (
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
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Labels to Sync
                  <span className="text-muted-foreground ml-1 text-xs">
                    (empty = all labels)
                  </span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {labels.slice(0, 15).map((label) => {
                    const isSelected = (editedConfig.syncLabels || []).includes(
                      label.id
                    );
                    return (
                      <Badge
                        key={label.id}
                        variant={isSelected ? "default" : "outline"}
                        className={cn(
                          "cursor-pointer transition-colors",
                          isEditing && "hover:bg-primary/20"
                        )}
                        onClick={() =>
                          isEditing && toggleLabel(label.id, "syncLabels")
                        }
                      >
                        {label.name}
                        {isSelected && <CheckIcon className="ml-1 size-3" />}
                      </Badge>
                    );
                  })}
                  {labels.length > 15 && (
                    <Badge variant="secondary" className="text-xs">
                      +{labels.length - 15} more
                    </Badge>
                  )}
                </div>
                {!isEditing && (editedConfig.syncLabels?.length || 0) === 0 && (
                  <p className="text-muted-foreground text-xs">
                    Syncing all labels
                  </p>
                )}
              </div>
            )}

            {/* Labels to Exclude */}
            {labels.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Labels to Exclude</label>
                <div className="flex flex-wrap gap-1.5">
                  {labels.slice(0, 15).map((label) => {
                    const isExcluded = (
                      editedConfig.excludeLabels || []
                    ).includes(label.id);
                    return (
                      <Badge
                        key={label.id}
                        variant={isExcluded ? "destructive" : "outline"}
                        className={cn(
                          "cursor-pointer transition-colors",
                          isEditing && "hover:bg-destructive/20"
                        )}
                        onClick={() =>
                          isEditing && toggleLabel(label.id, "excludeLabels")
                        }
                      >
                        {label.name}
                        {isExcluded && <XIcon className="ml-1 size-3" />}
                      </Badge>
                    );
                  })}
                </div>
                {!isEditing &&
                  (editedConfig.excludeLabels?.length || 0) === 0 && (
                    <p className="text-muted-foreground text-xs">
                      No labels excluded
                    </p>
                  )}
              </div>
            )}

            {/* Action Buttons */}
            {isEditing && (
              <div className="flex justify-end gap-2 border-t pt-4">
                <Button
                  variant="ghost"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Saving...
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

function XIcon({ className }: { className?: string }) {
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
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

export default SyncConfigPanel;
