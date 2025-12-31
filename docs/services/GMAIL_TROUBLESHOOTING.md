# Gmail Integration Troubleshooting Guide

> **Status**: Complete  
> **Last Updated**: December 2024  
> **Related**: [INTEGRATIONS_GUIDE.md](../INTEGRATIONS_GUIDE.md), [AUTH_SECURITY.md](../AUTH_SECURITY.md)

---

## Overview

This guide covers common issues encountered when setting up and using the Gmail integration in Theo, along with solutions and debugging steps.

---

## Table of Contents

1. [Connection Issues](#connection-issues)
2. [Sync Problems](#sync-problems)
3. [Email Action Errors](#email-action-errors)
4. [Rate Limiting](#rate-limiting)
5. [Token Issues](#token-issues)
6. [Contact Sync](#contact-sync)
7. [Search Issues](#search-issues)
8. [Approval Workflow](#approval-workflow)
9. [Debugging Tools](#debugging-tools)

---

## Connection Issues

### "Invalid Credentials" Error

**Symptoms**: OAuth flow fails or returns "Invalid Credentials" error.

**Possible Causes**:

1. Google OAuth credentials not configured
2. Client ID/Secret mismatch
3. Redirect URI not authorized

**Solutions**:

```bash
# 1. Verify environment variables are set
echo $GOOGLE_CLIENT_ID
echo $GOOGLE_CLIENT_SECRET

# 2. Check .env.local file
cat .env.local | grep GOOGLE
```

Ensure your Google Cloud Console OAuth settings include:

- Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
- Authorized redirect URI: `http://localhost:3000/api/integrations/gmail/callback`

---

### "Access Denied" or "Scope Not Granted"

**Symptoms**: User connects but some features don't work.

**Possible Causes**:

1. User declined some permission scopes
2. Incremental consent not triggered
3. App not verified for sensitive scopes

**Solutions**:

```typescript
// Check which scopes were granted
import { getIntegrationStatus } from "@/integrations/gmail";

const status = getIntegrationStatus(userScopes);
console.log("Can read:", status.canRead);
console.log("Can send:", status.canSend);
console.log("Can access contacts:", status.canAccessContacts);

// Trigger scope upgrade if needed using NextAuth signIn
import { signIn } from "next-auth/react";
import { ALL_GMAIL_SCOPES, BASE_SCOPES, formatScopes } from "@/lib/auth/scopes";

if (!status.canSend || !status.canAccessContacts) {
  // Use NextAuth's signIn to properly handle PKCE
  const scopeString = formatScopes([...BASE_SCOPES, ...ALL_GMAIL_SCOPES]);
  signIn(
    "google",
    { callbackUrl: "/settings/integrations/gmail" },
    {
      scope: scopeString,
      prompt: "consent",
      access_type: "offline",
      include_granted_scopes: "true",
    }
  );
}
```

---

### "App Not Verified" Warning

**Symptoms**: Google shows a warning screen during OAuth.

**Solutions**:

1. For development: Click "Advanced" → "Go to [App Name] (unsafe)"
2. For production: Submit your app for Google verification

---

## Sync Problems

### Sync Stuck in "syncing" Status

**Symptoms**: Sync started but never completes.

**Possible Causes**:

1. Worker crashed during sync
2. Rate limit caused long delays
3. Database connection issues

**Solutions**:

```typescript
// Check sync state
import { syncStateRepository } from "@/integrations/gmail";

const state = await syncStateRepository.findByUserId(userId);
console.log("Status:", state.syncStatus);
console.log("Last sync:", state.lastSyncAt);
console.log("Error:", state.syncError);

// Reset stuck sync
await syncStateRepository.update(userId, {
  syncStatus: "idle",
  syncError: null,
});
```

---

### "History ID Invalid" / 410 Gone Error

**Symptoms**: Incremental sync fails with history ID error.

**Explanation**: Gmail history IDs expire after ~30 days. If you don't sync for a month, the stored history ID becomes invalid.

**Solutions**:

```typescript
// 1. Trigger a full sync to reset history ID
import { scheduleFullSync } from "@/integrations/gmail";

await scheduleFullSync(userId);

// 2. The incremental sync automatically falls back to full sync
// when it detects this error
```

---

### Emails Not Appearing After Sync

**Symptoms**: Sync completes successfully but emails aren't searchable.

**Possible Causes**:

1. Embeddings not generated
2. Emails filtered by labels
3. Date range restrictions

**Debugging Steps**:

```typescript
// Check email count in database
import { emailRepository } from "@/integrations/gmail";

const result = await emailRepository.search(userId, {
  limit: 10,
});
console.log("Emails in DB:", result.total);

// Check embedding status
import { db } from "@/lib/db";

const emailsWithoutEmbeddings = await db.email.count({
  where: {
    userId,
    embeddings: { none: {} },
  },
});
console.log("Emails missing embeddings:", emailsWithoutEmbeddings);

// Regenerate embeddings for user
import { generateUserEmailEmbeddings } from "@/integrations/gmail";

await generateUserEmailEmbeddings(userId, { regenerate: true });
```

---

### Sync Too Slow

**Symptoms**: Full sync takes hours to complete.

**Possible Causes**:

1. Large mailbox (>10k emails)
2. Rate limiting kicking in
3. Slow embedding generation

**Solutions**:

```typescript
// 1. Limit initial sync scope
import { fullSync } from "@/integrations/gmail";

await fullSync(userId, accessToken, {
  maxEmails: 1000, // Limit to recent 1000
  labelIds: ["INBOX"], // Only sync inbox
});

// 2. Use incremental sync after initial import
import { startRecurringSync } from "@/integrations/gmail";

await startRecurringSync(userId);
```

---

## Email Action Errors

### "Draft Not Found" When Sending

**Symptoms**: Approval is approved but send fails.

**Possible Causes**:

1. Draft was manually deleted in Gmail
2. Draft expired or was cleaned up
3. Race condition with multiple approvals

**Solutions**:

```typescript
// Check if draft still exists before sending
import { getDraft } from "@/integrations/gmail";

try {
  await getDraft(client, draftId);
} catch (error) {
  // Draft doesn't exist - reject the approval
  await rejectApproval(userId, approvalId, {
    reason: "Draft no longer exists in Gmail",
  });
}
```

---

### "Insufficient Permissions" When Sending

**Symptoms**: User can view emails but can't send.

**Solutions**:

```typescript
// Check if user has send permission
import { hasGmailSendAccess } from "@/lib/auth/scopes";
import { signIn } from "next-auth/react";
import { ALL_GMAIL_SCOPES, BASE_SCOPES, formatScopes } from "@/lib/auth/scopes";

const canSend = hasGmailSendAccess(userScopes);

if (!canSend) {
  // Use NextAuth's signIn to request additional permissions (handles PKCE)
  const scopeString = formatScopes([...BASE_SCOPES, ...ALL_GMAIL_SCOPES]);
  signIn(
    "google",
    { callbackUrl: "/settings/integrations/gmail" },
    {
      scope: scopeString,
      prompt: "consent",
      access_type: "offline",
      include_granted_scopes: "true",
    }
  );
}
```

---

## Rate Limiting

### "Rate Limit Exceeded" Errors

**Symptoms**: API calls fail with 429 status.

**Understanding Gmail Quotas**:

- Per-user: 250 quota units/second, 25,000 units/day
- Per-project: 1,000,000 queries/day

**Common quota costs**:
| Operation | Quota Units |
|-----------|-------------|
| messages.list | 5 |
| messages.get | 5 |
| messages.send | 100 |
| threads.get | 5 |
| history.list | 2 |

**Solutions**:

```typescript
// 1. The client automatically handles rate limits
// But you can check remaining quota

import { estimateRemainingOperations } from "@/integrations/gmail";

const remaining = await estimateRemainingOperations(userId);
console.log("Estimated operations remaining:", remaining);

// 2. Reduce batch sizes for large syncs
import { fullSync } from "@/integrations/gmail";

await fullSync(userId, accessToken, {
  pageSize: 50, // Smaller pages = fewer concurrent requests
});

// 3. Add delays between batch operations
const BATCH_DELAY_MS = 1000;
for (const batch of batches) {
  await processBatch(batch);
  await sleep(BATCH_DELAY_MS);
}
```

---

## Token Issues

### Token Refresh Failures

**Symptoms**: API calls fail after some time with 401 errors.

**Possible Causes**:

1. Refresh token expired/revoked
2. User changed Google password
3. Token encryption key changed

**Solutions**:

```typescript
// 1. Check if token needs refresh
import { needsTokenRefresh, parseGoogleApiError } from "@/integrations/gmail";

try {
  await client.getProfile();
} catch (error) {
  const gmailError = parseGoogleApiError(error);
  if (needsTokenRefresh(gmailError)) {
    // Trigger token refresh
    await refreshUserTokens(userId);
  }
}

// 2. Mark account for re-authentication
import { db } from "@/lib/db";

await db.connectedAccount.update({
  where: { id: accountId },
  data: {
    status: "expired",
    errorMessage: "Token refresh failed - re-authentication required",
  },
});
```

---

### "Token Decryption Failed"

**Symptoms**: Connection appears valid but API calls fail.

**Possible Causes**:

1. TOKEN_ENCRYPTION_KEY environment variable changed
2. Key rotation issue
3. Database corruption

**Solutions**:

```bash
# Verify encryption key is consistent
echo $TOKEN_ENCRYPTION_KEY

# The key must be exactly 32 bytes base64 encoded
# Generate a new key if needed:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

```typescript
// Re-connect the user if tokens are unrecoverable
await db.connectedAccount.delete({
  where: { id: accountId },
});
// Prompt user to reconnect Gmail
```

---

## Contact Sync

### Contacts Not Syncing

**Symptoms**: Contact sync completes but no contacts appear.

**Possible Causes**:

1. User hasn't granted contacts scope
2. User has no Google Contacts
3. Contacts are in "Other Contacts" (different API)

**Debugging**:

```typescript
// Check contacts scope
import { hasContactsAccess } from "@/lib/auth/scopes";
import { signIn } from "next-auth/react";
import { ALL_GMAIL_SCOPES, BASE_SCOPES, formatScopes } from "@/lib/auth/scopes";

if (!hasContactsAccess(userScopes)) {
  // Use NextAuth's signIn to request contacts permission (handles PKCE)
  const scopeString = formatScopes([...BASE_SCOPES, ...ALL_GMAIL_SCOPES]);
  signIn(
    "google",
    { callbackUrl: "/settings/integrations/gmail" },
    {
      scope: scopeString,
      prompt: "consent",
      access_type: "offline",
      include_granted_scopes: "true",
    }
  );
}

// Check raw contact count
const result = await client.listContacts({ pageSize: 10 });
console.log("Total contacts:", result.totalItems);

// Try searching "Other Contacts"
const otherContacts = await client.searchContacts("@", 10);
console.log("Other contacts found:", otherContacts.length);
```

---

## Search Issues

### Search Returns No Results

**Symptoms**: Semantic search doesn't find relevant emails.

**Possible Causes**:

1. Embeddings not generated
2. Search index not updated
3. Query too specific/vague

**Debugging**:

```typescript
// Check if embeddings exist
import { db } from "@/lib/db";

const embeddingCount = await db.embedding.count({
  where: {
    userId,
    entityType: "email",
  },
});
console.log("Email embeddings:", embeddingCount);

// Try basic search to verify data exists
import { emailRepository } from "@/integrations/gmail";

const basicSearch = await emailRepository.findByUser(userId, {
  limit: 10,
});
console.log("Emails in DB:", basicSearch.length);

// Test embedding service directly
import { getSearchService } from "@/lib/embeddings";

const searchService = getSearchService();
const results = await searchService.search({
  query: "test query",
  userId,
  entityTypes: ["email"],
  limit: 5,
});
console.log("Search results:", results);
```

---

## Approval Workflow

### Approvals Expiring Too Quickly

**Symptoms**: Approvals expire before user can review.

**Solutions**:

```typescript
// Configure longer expiration time
import { requestApproval } from "@/integrations/gmail";

await requestApproval(client, userId, {
  ...emailParams,
  expiresInMinutes: 60 * 24 * 7, // 7 days instead of default 24 hours
});
```

---

### Orphaned Approvals

**Symptoms**: Approvals exist but drafts were deleted in Gmail.

**Solutions**:

```typescript
// Clean up orphaned approvals
import { getApprovals, rejectApproval, getDraft } from "@/integrations/gmail";

const approvals = await getApprovals(userId, { status: "pending" });

for (const approval of approvals) {
  try {
    await getDraft(client, approval.draftId);
  } catch {
    // Draft doesn't exist - auto-reject
    await rejectApproval(userId, approval.id, {
      reason: "Draft was deleted from Gmail",
    });
  }
}
```

---

## Debugging Tools

### Enable Debug Logging

```typescript
// Set log level for Gmail operations
import { createGmailLogger, LogLevel } from "@/integrations/gmail";

const logger = createGmailLogger("debug", {
  includeTimestamp: true,
  pretty: true,
});

// Or set environment variable
// DEBUG=gmail:* npm run dev
```

### Check Connection Health

```typescript
// Health check endpoint
// GET /api/integrations/gmail/health

async function checkGmailHealth(userId: string) {
  const checks = {
    connected: false,
    canFetchProfile: false,
    canListMessages: false,
    tokenValid: false,
    syncState: "unknown",
  };

  try {
    const account = await getConnectedAccount(userId, "google");
    checks.connected = !!account;

    if (account) {
      const client = createGmailClient(account.accessToken, userId);

      try {
        await client.getProfile();
        checks.canFetchProfile = true;
        checks.tokenValid = true;
      } catch (error) {
        const gmailError = parseGoogleApiError(error);
        checks.tokenValid = gmailError.code !== GmailErrorCode.UNAUTHORIZED;
      }

      try {
        await client.listMessages({ maxResults: 1 });
        checks.canListMessages = true;
      } catch {}

      const syncState = await syncStateRepository.findByUserId(userId);
      checks.syncState = syncState?.syncStatus || "not_initialized";
    }
  } catch {}

  return checks;
}
```

### Common Log Patterns

```bash
# View sync logs
grep -i "gmail" logs/app.log | grep -i "sync"

# View error patterns
grep -i "gmail" logs/app.log | grep -i "error\|failed\|exception"

# View rate limit hits
grep -i "gmail" logs/app.log | grep -i "rate\|429\|quota"
```

---

## Getting Help

If you're still experiencing issues:

1. Check the [API Reference](../API_REFERENCE.md) for endpoint documentation
2. Review [Auth Security](../AUTH_SECURITY.md) for OAuth configuration
3. Examine the Gmail integration source code in `src/integrations/gmail/`
4. Check BullMQ dashboard for job status at `/admin/queues`

---

_Document Version: 1.0_  
_Last Updated: December 2024_
