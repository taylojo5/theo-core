# Frontend Documentation

> **Status**: Complete  
> **Last Updated**: December 2024  
> **Related**: [API_REFERENCE.md](./API_REFERENCE.md), [SSE_STREAMING.md](./SSE_STREAMING.md)

---

## Overview

Theo's frontend is built with **Next.js 15** (App Router), **React 19**, and **Tailwind CSS**. The UI uses **shadcn/ui** components for a polished, consistent design.

---

## Technology Stack

| Component  | Technology   | Purpose                 |
| ---------- | ------------ | ----------------------- |
| Framework  | Next.js 15   | Full-stack React        |
| UI Library | React 19     | Components              |
| Styling    | Tailwind CSS | Utility-first CSS       |
| Components | shadcn/ui    | Pre-built UI components |
| Icons      | Lucide React | Icon library            |
| Auth       | NextAuth.js  | Session management      |

---

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Auth route group
│   │   ├── layout.tsx      # Auth layout
│   │   └── login/
│   │       └── page.tsx    # Login page
│   ├── (dashboard)/        # Dashboard route group
│   │   ├── chat/
│   │   │   └── page.tsx    # Chat interface
│   │   ├── layout.tsx      # Dashboard layout
│   │   └── error.tsx       # Error boundary
│   ├── api/                # API routes
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Landing page
│
├── components/
│   ├── chat/               # Chat components
│   │   ├── chat-input.tsx
│   │   ├── conversation-sidebar.tsx
│   │   ├── message-bubble.tsx
│   │   └── message-list.tsx
│   ├── layout/             # Layout components
│   │   ├── dashboard-header.tsx
│   │   └── dashboard-layout.tsx
│   ├── providers/          # React providers
│   │   ├── session-provider.tsx
│   │   └── error-provider.tsx
│   ├── shared/             # Shared components
│   │   ├── connection-status.tsx
│   │   └── error-boundary.tsx
│   └── ui/                 # shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       └── ...
│
└── hooks/                  # Custom hooks
    └── use-event-source.ts
```

---

## Layouts

### Root Layout

```typescript
// src/app/layout.tsx
import { SessionProvider } from "@/components/providers";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
```

### Dashboard Layout

```typescript
// src/app/(dashboard)/layout.tsx
export default function DashboardLayout({ children }) {
  return (
    <DashboardLayoutComponent>
      <DashboardHeader />
      <main>{children}</main>
    </DashboardLayoutComponent>
  );
}
```

### Auth Layout

```typescript
// src/app/(auth)/layout.tsx
export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      {children}
    </div>
  );
}
```

---

## Route Groups

### `(auth)` - Authentication Routes

- `/login` - Sign in page

Protected: No (public)

### `(dashboard)` - Protected Routes

- `/chat` - Main chat interface

Protected: Yes (requires authentication)

---

## Providers

### Session Provider

Wraps app with NextAuth session:

```typescript
"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

export function SessionProvider({ children }) {
  return (
    <NextAuthSessionProvider>
      {children}
    </NextAuthSessionProvider>
  );
}
```

### Error Provider

Context for error handling:

```typescript
"use client";

import { createContext, useContext, useState } from "react";

const ErrorContext = createContext<ErrorContextType | null>(null);

export function ErrorProvider({ children }) {
  const [error, setError] = useState<AppError | null>(null);

  return (
    <ErrorContext.Provider value={{ error, setError, clearError }}>
      {children}
    </ErrorContext.Provider>
  );
}

export function useError() {
  const context = useContext(ErrorContext);
  if (!context) throw new Error("useError must be used within ErrorProvider");
  return context;
}
```

---

## Chat Components

### Chat Page

```typescript
// src/app/(dashboard)/chat/page.tsx
export default function ChatPage() {
  return (
    <div className="flex h-full">
      <ConversationSidebar />
      <div className="flex-1 flex flex-col">
        <MessageList />
        <ChatInput />
      </div>
    </div>
  );
}
```

### Message Bubble

```typescript
interface MessageBubbleProps {
  message: Message;
  isUser: boolean;
}

export function MessageBubble({ message, isUser }: MessageBubbleProps) {
  return (
    <div className={cn(
      "max-w-[80%] rounded-lg p-3",
      isUser
        ? "bg-primary text-primary-foreground ml-auto"
        : "bg-muted"
    )}>
      {message.content}
    </div>
  );
}
```

### Chat Input

```typescript
export function ChatInput() {
  const [input, setInput] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // Send message...
    setInput("");
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t">
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
        />
        <Button type="submit">Send</Button>
      </div>
    </form>
  );
}
```

---

## Custom Hooks

### useEventSource

For SSE streaming:

```typescript
const { data, error, isConnected } = useEventSource(
  `/api/chat/conversations/${id}/stream`,
  {
    onMessage: (event) => {
      const chunk = JSON.parse(event.data);
      // Handle chunk...
    },
  }
);
```

See [SSE_STREAMING.md](./SSE_STREAMING.md) for details.

### useCsrf

For CSRF-protected API calls:

```typescript
import { useCsrf } from "@/hooks";

function MyComponent() {
  const { protectedFetch, csrfToken, isLoading, error } = useCsrf();

  const handleDelete = async () => {
    // protectedFetch automatically includes CSRF token
    const response = await protectedFetch("/api/integrations/gmail/disconnect", {
      method: "DELETE",
    });

    if (response.ok) {
      // Success
    }
  };

  return (
    <button onClick={handleDelete} disabled={isLoading}>
      Disconnect
    </button>
  );
}
```

The hook:

- Fetches CSRF token on mount from `/api/auth/csrf`
- Provides `protectedFetch` that automatically includes the token
- Handles loading and error states
- Required for all state-changing API calls (POST, PUT, DELETE)

---

## UI Components (shadcn/ui)

### Available Components

| Component | File                   | Usage                    |
| --------- | ---------------------- | ------------------------ |
| Button    | `ui/button.tsx`        | Actions, form submission |
| Card      | `ui/card.tsx`          | Content containers       |
| Input     | `ui/input.tsx`         | Text input               |
| Avatar    | `ui/avatar.tsx`        | User avatars             |
| Badge     | `ui/badge.tsx`         | Status indicators        |
| Dropdown  | `ui/dropdown-menu.tsx` | User menu                |
| Skeleton  | `ui/skeleton.tsx`      | Loading states           |
| Spinner   | `ui/spinner.tsx`       | Loading indicator        |

### Adding Components

```bash
npx shadcn@latest add [component-name]
```

### Customization

Components are in `src/components/ui/` and can be freely modified.

---

## Styling

### Tailwind Configuration

```typescript
// tailwind.config.ts
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // ... more colors
      },
    },
  },
};
```

### CSS Variables

```css
/* globals.css */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    /* ... more variables */
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    /* ... dark mode colors */
  }
}
```

---

## Authentication Flow

### Login Page

```typescript
"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={() => signIn("google", { callbackUrl: "/chat" })}>
          Continue with Google
        </Button>
      </CardContent>
    </Card>
  );
}
```

### User Dropdown

```typescript
"use client";

import { useSession, signOut } from "next-auth/react";

export function UserDropdown() {
  const { data: session } = useSession();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Avatar>
          <AvatarImage src={session?.user?.image} />
          <AvatarFallback>{session?.user?.name?.[0]}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => signOut()}>
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## Error Handling

### Error Boundary

```typescript
"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <Card className="m-8">
      <CardHeader>
        <CardTitle>Something went wrong</CardTitle>
      </CardHeader>
      <CardContent>
        <p>{error.message}</p>
        <Button onClick={reset}>Try again</Button>
      </CardContent>
    </Card>
  );
}
```

### Connection Status

```typescript
export function ConnectionStatus() {
  const { isConnected } = useEventSource(...);

  return (
    <Badge variant={isConnected ? "default" : "destructive"}>
      {isConnected ? "Connected" : "Disconnected"}
    </Badge>
  );
}
```

---

## Loading States

### Skeleton Loading

```typescript
function ConversationListSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
```

### Suspense Boundaries

```typescript
import { Suspense } from "react";

export default function ChatPage() {
  return (
    <Suspense fallback={<ConversationListSkeleton />}>
      <ConversationList />
    </Suspense>
  );
}
```

---

## Best Practices

### 1. Use Server Components by Default

```typescript
// ✅ Good - Server Component (default)
async function ConversationList() {
  const conversations = await listConversations();
  return <ul>{...}</ul>;
}

// Only use "use client" when needed for interactivity
"use client";
function InteractiveComponent() {
  const [state, setState] = useState();
  // ...
}
```

### 2. Colocate Related Files

```
chat/
├── page.tsx          # Route
├── chat-input.tsx    # Component
├── message-list.tsx  # Component
└── actions.ts        # Server actions
```

### 3. Use CSS Variables for Theming

```typescript
// ✅ Good - uses theme variables
<div className="bg-background text-foreground" />

// ❌ Bad - hard-coded colors
<div className="bg-white text-black" />
```

---

## Gmail Integration Components

### Settings Page Structure

The Gmail settings are located at `/settings/integrations/gmail` and use the following components:

```
src/components/integrations/gmail/
├── connection-status.tsx   # OAuth connection state
├── sync-settings.tsx       # Sync configuration
├── sync-history.tsx        # Recent sync jobs
├── pending-approvals.tsx   # Email approval queue
├── statistics.tsx          # Email statistics
└── index.ts               # Barrel export
```

### ConnectionStatus Component

Shows Gmail connection state and provides connect/disconnect actions:

```typescript
import { ConnectionStatus } from "@/components/integrations/gmail";

// Data shape
interface ConnectionStatusData {
  connected: boolean;
  email?: string;
  lastSyncAt?: string;
  scopes: string[];
}

// Usage
<ConnectionStatus
  data={connectionData}
  onConnect={() => handleConnect()}
  onDisconnect={() => handleDisconnect()}
/>
```

### SyncSettings Component

Configures sync behavior and triggers manual syncs:

```typescript
import { SyncSettings } from "@/components/integrations/gmail";

// Data shape
interface SyncConfig {
  autoSync: boolean;
  syncInterval: number; // minutes
  labelIds: string[];
  excludeLabels: string[];
  maxEmailAgeDays: number;
}

// Usage
<SyncSettings
  config={syncConfig}
  onSave={(config) => saveConfig(config)}
  onTriggerSync={() => triggerManualSync()}
/>
```

### SyncHistory Component

Displays recent sync job status:

```typescript
import { SyncHistory } from "@/components/integrations/gmail";

interface SyncJob {
  id: string;
  type: "full" | "incremental";
  status: "pending" | "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  emailsProcessed: number;
  error?: string;
}

<SyncHistory jobs={recentJobs} />
```

### PendingApprovals Component

Shows emails awaiting user approval:

```typescript
import { PendingApprovals } from "@/components/integrations/gmail";

interface ApprovalStats {
  pending: number;
  expiringIn24h: number;
}

<PendingApprovals
  stats={approvalStats}
  onViewApprovals={() => navigate("/approvals")}
/>
```

### Statistics Component

Displays email sync statistics:

```typescript
import { Statistics } from "@/components/integrations/gmail";

interface GmailStatisticsData {
  totalEmails: number;
  embeddedEmails: number;
  lastFullSync?: string;
  lastIncrementalSync?: string;
}

<Statistics data={stats} />
```

### Integration with Dashboard

To add Gmail settings to the dashboard settings page:

```typescript
// src/app/(dashboard)/settings/integrations/gmail/page.tsx
import {
  ConnectionStatus,
  SyncSettings,
  SyncHistory,
  PendingApprovals,
  Statistics,
} from "@/components/integrations/gmail";

export default async function GmailSettingsPage() {
  const session = await getServerSession(authOptions);
  const data = await fetchGmailData(session.user.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Gmail Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Connection</CardTitle>
        </CardHeader>
        <CardContent>
          <ConnectionStatus data={data.connection} />
        </CardContent>
      </Card>

      {data.connection.connected && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Sync Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <SyncSettings config={data.syncConfig} />
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Statistics data={data.statistics} />
            <PendingApprovals stats={data.approvals} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Syncs</CardTitle>
            </CardHeader>
            <CardContent>
              <SyncHistory jobs={data.recentJobs} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
```

---

## Email Components

### ThreadView

Displays email threads as expandable conversations:

```typescript
import { ThreadView } from "@/components/email";

<ThreadView
  threadId="thread_123abc"
  onClose={() => setSelectedThread(null)}
  className="max-w-2xl"
/>
```

Features:

- Expands/collapses individual messages
- Shows latest message expanded by default
- Visual indicators for unread, starred, attachments
- Responsive layout

### Email Approval Dialog

The approval dialog allows users to review and approve agent-drafted emails:

```typescript
import { ApprovalDialog } from "@/components/email/approval-dialog";
import { EmailPreview } from "@/components/email/email-preview";

<ApprovalDialog
  approval={pendingApproval}
  onApprove={(notes) => handleApprove(approval.id, notes)}
  onReject={(reason) => handleReject(approval.id, reason)}
  onEdit={() => handleEdit(approval.id)}
>
  <EmailPreview
    to={approval.to}
    cc={approval.cc}
    subject={approval.subject}
    body={approval.body}
  />
</ApprovalDialog>
```

---

## Related Documentation

- [API_REFERENCE.md](./API_REFERENCE.md) - API endpoints
- [AUTH_SECURITY.md](./AUTH_SECURITY.md) - Authentication
- [SSE_STREAMING.md](./SSE_STREAMING.md) - Real-time streaming
- [INTEGRATIONS_GUIDE.md](./INTEGRATIONS_GUIDE.md) - Integration setup
- [services/GMAIL_SERVICE.md](./services/GMAIL_SERVICE.md) - Gmail service details
- [shadcn/ui Docs](https://ui.shadcn.com/) - Component library
