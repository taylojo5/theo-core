"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Integrations Settings Page
// Overview of all available integrations
// ═══════════════════════════════════════════════════════════════════════════

import * as React from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout";
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

interface IntegrationStatus {
  gmail: {
    connected: boolean;
    canRead: boolean;
    canSend: boolean;
    emailCount?: number;
  };
  calendar: {
    connected: boolean;
    canRead: boolean;
    canWrite: boolean;
    eventCount?: number;
  };
  contacts: {
    connected: boolean;
    contactCount?: number;
  };
}

// ─────────────────────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [status, setStatus] = React.useState<IntegrationStatus | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/integrations/status");
        if (res.ok) {
          const data = await res.json();
          setStatus({
            gmail: data.gmail || {
              connected: false,
              canRead: false,
              canSend: false,
            },
            calendar: data.calendar || {
              connected: false,
              canRead: false,
              canWrite: false,
            },
            contacts: data.contacts || { connected: false },
          });
        }
      } catch (error) {
        console.error("Failed to fetch integration status:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStatus();
  }, []);

  return (
    <DashboardLayout>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl p-6">
          {/* Header */}
          <div className="mb-8">
            <div className="mb-4 flex items-center gap-2">
              <Link href="/chat">
                <Button variant="ghost" size="sm">
                  <ChevronLeftIcon className="mr-1 size-4" />
                  Back to Chat
                </Button>
              </Link>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
            <p className="text-muted-foreground mt-1">
              Connect your accounts to give Theo access to your data and enable
              powerful features
            </p>
          </div>

          {/* Integrations Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" label="Loading integrations..." />
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Gmail Integration */}
              <IntegrationCard
                icon={<GmailIcon className="size-6" />}
                iconBg="from-red-500 to-red-600"
                title="Gmail"
                description="Sync emails, access contacts, and send emails with approval"
                status={
                  status?.gmail.connected
                    ? status.gmail.canSend
                      ? "connected"
                      : "limited"
                    : "disconnected"
                }
                features={[
                  "Read and search emails",
                  "Send emails with approval",
                  "Sync contacts",
                ]}
                stats={
                  status?.gmail.connected
                    ? [`${status.gmail.emailCount || 0} emails synced`]
                    : undefined
                }
                href="/settings/integrations/gmail"
                ctaText={status?.gmail.connected ? "Manage" : "Connect"}
              />

              {/* Calendar Integration */}
              <IntegrationCard
                icon={<CalendarIcon className="size-6" />}
                iconBg="from-blue-500 to-blue-600"
                title="Google Calendar"
                description="Sync events, check availability, and schedule meetings"
                status={
                  status?.calendar.connected
                    ? status.calendar.canWrite
                      ? "connected"
                      : "limited"
                    : "disconnected"
                }
                features={[
                  "View upcoming events",
                  "Check availability",
                  "Create calendar events (with approval)",
                ]}
                stats={
                  status?.calendar.connected
                    ? [`${status.calendar.eventCount || 0} events synced`]
                    : undefined
                }
                href="/settings/integrations/calendar"
                ctaText={status?.calendar.connected ? "Manage" : "Connect"}
              />

              {/* Slack Integration - Coming Soon */}
              <IntegrationCard
                icon={<SlackIcon className="size-6" />}
                iconBg="from-purple-500 to-fuchsia-600"
                title="Slack"
                description="Access messages, channels, and send notifications"
                status="coming_soon"
                features={[
                  "Search messages",
                  "Access channel history",
                  "Send notifications",
                ]}
                ctaText="Coming Soon"
                disabled
              />

              {/* Notion Integration - Coming Soon */}
              <IntegrationCard
                icon={<NotionIcon className="size-6" />}
                iconBg="from-gray-700 to-gray-900"
                title="Notion"
                description="Access notes, databases, and documents"
                status="coming_soon"
                features={["Search notes", "Query databases", "Create pages"]}
                ctaText="Coming Soon"
                disabled
              />
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

interface IntegrationCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  status: "connected" | "limited" | "disconnected" | "coming_soon";
  features: string[];
  stats?: string[];
  href?: string;
  ctaText: string;
  disabled?: boolean;
}

function IntegrationCard({
  icon,
  iconBg,
  title,
  description,
  status,
  features,
  stats,
  href,
  ctaText,
  disabled,
}: IntegrationCardProps) {
  const statusConfig = {
    connected: { label: "Connected", variant: "success" as const },
    limited: { label: "Limited Access", variant: "warning" as const },
    disconnected: { label: "Not Connected", variant: "secondary" as const },
    coming_soon: { label: "Coming Soon", variant: "outline" as const },
  };

  const { label, variant } = statusConfig[status];

  const cardContent = (
    <Card
      className={`transition-all ${
        disabled
          ? "opacity-60"
          : "hover:border-primary/50 cursor-pointer hover:shadow-md"
      }`}
    >
      <CardHeader>
        <div className="flex items-center gap-4">
          <div
            className={`flex size-12 items-center justify-center rounded-xl bg-gradient-to-br text-white ${iconBg}`}
          >
            {icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle>{title}</CardTitle>
              <Badge variant={variant} className="text-xs">
                {label}
              </Badge>
            </div>
            <CardDescription className="mt-0.5">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Features */}
        <ul className="text-muted-foreground space-y-1 text-sm">
          {features.map((feature, i) => (
            <li key={i} className="flex items-center gap-2">
              <CheckIcon className="size-4 text-emerald-500" />
              {feature}
            </li>
          ))}
        </ul>

        {/* Stats */}
        {stats && stats.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {stats.map((stat, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {stat}
              </Badge>
            ))}
          </div>
        )}

        {/* CTA */}
        <Button
          variant={status === "connected" ? "outline" : "default"}
          className="w-full"
          disabled={disabled}
        >
          {ctaText}
          {!disabled && <ChevronRightIcon className="ml-1 size-4" />}
        </Button>
      </CardContent>
    </Card>
  );

  if (disabled) {
    return cardContent;
  }

  return (
    <Link href={href!} className="block">
      {cardContent}
    </Link>
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

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
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

function GmailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
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

function SlackIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.124 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.52 2.521h-2.522V8.834zm-1.271 0a2.528 2.528 0 0 1-2.521 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.166 0a2.528 2.528 0 0 1 2.521 2.522v6.312zm-2.521 10.124a2.528 2.528 0 0 1 2.521 2.522A2.528 2.528 0 0 1 15.166 24a2.528 2.528 0 0 1-2.521-2.52v-2.522h2.521zm0-1.271a2.528 2.528 0 0 1-2.521-2.521 2.528 2.528 0 0 1 2.521-2.521h6.312A2.528 2.528 0 0 1 24 15.166a2.528 2.528 0 0 1-2.52 2.521h-6.313z" />
    </svg>
  );
}

function NotionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.98-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466l1.823 1.447zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.886l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.22.186c-.094-.187 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.454-.233 4.763 7.278v-6.44l-1.215-.14c-.093-.514.28-.887.747-.933l3.222-.187zm-12.79-6.58l13.168-.933c1.637-.14 2.055-.047 3.08.7l4.25 2.986c.7.514.935.653.935 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.588-1.634z" />
    </svg>
  );
}
