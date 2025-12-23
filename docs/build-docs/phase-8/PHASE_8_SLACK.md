# Phase 8: Slack Integration

> **Status**: Draft v0.1  
> **Duration**: Weeks 24-26  
> **Dependencies**: Phase 5 (Agent Engine), Phase 6 (Memory System)

---

## Overview

Integrate Slack to give Theo visibility into workplace communications, enabling context-aware assistance with team collaboration, message management, and proactive notifications.

### Architecture Note

Design this integration as a **self-contained module** with clear boundaries (API contracts, message-based communication patterns) to enable extraction to a standalone microservice in the future. Follow the patterns established by Gmail and Calendar integrations.

---

## Goals

- Slack OAuth (user token and/or bot token)
- Workspace user import to People context
- Channel and DM message sync
- Message send action with approval workflow
- Real-time event handling (optional Socket Mode)
- Integration with existing Person entities

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SlackClient                                  │
│  Wrapper over Slack Web API with rate limiting                      │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
┌──────────────────────┐ ┌──────────────┐ ┌──────────────────────┐
│   SlackRepository    │ │   Mappers    │ │   SlackActions       │
│   CRUD for DB models │ │  API ↔ DB    │ │   Send/React/Status  │
└──────────────────────┘ └──────────────┘ └──────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
┌──────────────────────┐ ┌──────────────┐ ┌──────────────────────┐
│     UserSync         │ │ Message Sync │ │   Message Approval   │
│  Import workspace    │ │  History &   │ │     Workflow         │
│      users           │ │  real-time   │ │                      │
└──────────────────────┘ └──────────────┘ └──────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Context System (Person)                             │
│           Slack users linked to existing People entities            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## OAuth Configuration

### Token Types

| Type | Use Case | Scopes |
| --- | --- | --- |
| User Token | Act as user (preferred for personal assistant) | `chat:write`, `users:read`, `channels:read`, etc. |
| Bot Token | App-level actions, events | `app_mentions:read`, `chat:write`, `users:read` |

### Required Scopes (User Token)

| Scope | Purpose |
| --- | --- |
| `channels:read` | List public channels |
| `channels:history` | Read public channel messages |
| `groups:read` | List private channels |
| `groups:history` | Read private channel messages |
| `im:read` | List direct messages |
| `im:history` | Read DM history |
| `mpim:read` | List group DMs |
| `mpim:history` | Read group DM history |
| `users:read` | List workspace users |
| `users:read.email` | Get user email addresses |
| `chat:write` | Send messages |
| `reactions:write` | Add emoji reactions |

### OAuth Flow

```
1. User clicks "Connect Slack"
2. Redirect to Slack OAuth with scopes
3. User approves in Slack
4. Slack redirects back with code
5. Exchange code for access token
6. Store encrypted token in ConnectedAccount
7. Trigger initial sync
```

---

## Data Model

### SlackSyncState

Tracks sync progress per user.

| Field | Type | Description |
| --- | --- | --- |
| id | string | Unique identifier |
| userId | string | FK to User (unique) |
| teamId | string | Slack workspace ID |
| teamName | string | Workspace name |
| lastSyncAt | datetime? | Last successful sync |
| lastFullSyncAt | datetime? | Last full sync |
| syncStatus | enum | `idle`, `syncing`, `error` |
| syncError | string? | Error message if failed |
| userCount | int | Total users synced |
| channelCount | int | Total channels synced |
| messageCount | int | Total messages synced |
| socketConnected | boolean | Real-time connection active |
| createdAt | datetime | |
| updatedAt | datetime | |

### SlackWorkspace

Stores workspace metadata.

| Field | Type | Description |
| --- | --- | --- |
| id | string | Unique identifier |
| userId | string | FK to User |
| teamId | string | Slack team/workspace ID |
| teamName | string | Workspace display name |
| teamDomain | string | Workspace URL subdomain |
| teamIcon | string? | Workspace icon URL |
| enterpriseId | string? | Enterprise Grid ID if applicable |
| isActive | boolean | Currently connected |
| createdAt | datetime | |
| updatedAt | datetime | |

### SlackChannel

Stores synced channels.

| Field | Type | Description |
| --- | --- | --- |
| id | string | Unique identifier |
| userId | string | FK to User |
| workspaceId | string | FK to SlackWorkspace |
| slackChannelId | string | Slack's channel ID |
| name | string | Channel name |
| type | enum | `public`, `private`, `dm`, `mpim` |
| topic | string? | Channel topic |
| purpose | string? | Channel purpose |
| isMember | boolean | User is a member |
| isArchived | boolean | Channel is archived |
| memberCount | int? | Number of members |
| lastMessageTs | string? | Latest message timestamp |
| syncEnabled | boolean | Sync messages for this channel |
| createdAt | datetime | |
| updatedAt | datetime | |

### SlackMessage

Stores synced messages (selective sync based on importance).

| Field | Type | Description |
| --- | --- | --- |
| id | string | Unique identifier |
| userId | string | FK to User |
| channelId | string | FK to SlackChannel |
| slackMessageTs | string | Slack's message timestamp (unique ID) |
| slackUserId | string | Sender's Slack user ID |
| text | string | Message content |
| threadTs | string? | Parent thread timestamp |
| isThreadReply | boolean | Is a reply in a thread |
| hasAttachments | boolean | Contains files/attachments |
| hasReactions | boolean | Has emoji reactions |
| reactions | json | Array of reactions |
| mentions | string[] | Mentioned user IDs |
| isImportant | boolean | Marked important for context |
| embeddingStatus | enum | `pending`, `completed`, `skipped` |
| createdAt | datetime | When synced |
| messageAt | datetime | Original message time |

### SlackUser

Stores workspace users for mapping to Person entities.

| Field | Type | Description |
| --- | --- | --- |
| id | string | Unique identifier |
| userId | string | FK to User (Theo user) |
| workspaceId | string | FK to SlackWorkspace |
| slackUserId | string | Slack's user ID |
| username | string | Slack username |
| displayName | string | Display name |
| realName | string? | Full name |
| email | string? | Email address |
| avatarUrl | string? | Profile picture URL |
| title | string? | Job title |
| isBot | boolean | Is a bot user |
| isDeleted | boolean | Deactivated account |
| personId | string? | FK to Person (linked entity) |
| createdAt | datetime | |
| updatedAt | datetime | |

### SlackMessageApproval

For agent-initiated message actions.

| Field | Type | Description |
| --- | --- | --- |
| id | string | Unique identifier |
| userId | string | FK to User |
| actionType | enum | `send`, `reply`, `react`, `status` |
| channelId | string | Target channel |
| threadTs | string? | Thread to reply to |
| content | string | Message text |
| blocks | json? | Rich message blocks |
| status | enum | `pending`, `approved`, `rejected`, `expired`, `sent` |
| requestedAt | datetime | When requested |
| expiresAt | datetime? | Auto-expiration |
| decidedAt | datetime? | When user decided |
| sentMessageTs | string? | Resulting message timestamp |
| errorMessage | string? | Error if failed |
| metadata | json | Additional context |

---

## Core Services

### SlackClient

Wrapper over Slack Web API with rate limiting.

| Method | Description |
| --- | --- |
| `listUsers()` | List all workspace users |
| `listChannels()` | List channels user has access to |
| `getChannelInfo(channelId)` | Get channel details |
| `getChannelHistory(channelId, options)` | Get message history |
| `sendMessage(params)` | Send a message |
| `replyToThread(channel, threadTs, text)` | Reply in thread |
| `addReaction(channel, timestamp, emoji)` | Add emoji reaction |
| `setStatus(text, emoji, expiration?)` | Set user status |
| `getUserInfo(userId)` | Get user profile |

### SlackRepository

Database operations for Slack data.

| Method | Description |
| --- | --- |
| `upsertWorkspace(input)` | Create or update workspace |
| `upsertChannel(input)` | Create or update channel |
| `upsertMessage(input)` | Create or update message |
| `upsertUser(input)` | Create or update Slack user |
| `linkUserToPerson(slackUserId, personId)` | Link to Person entity |
| `findChannelsByType(userId, type)` | Query channels |
| `findRecentMessages(userId, hours)` | Get recent messages |
| `findMentions(userId)` | Get messages mentioning user |

### SlackSyncService

Handles sync operations.

| Method | Description |
| --- | --- |
| `fullSync(userId)` | Full workspace import |
| `syncUsers(userId)` | Sync workspace users |
| `syncChannels(userId)` | Sync channel list |
| `syncChannelHistory(userId, channelId)` | Sync channel messages |
| `processSlackEvent(event)` | Handle real-time events |

### SlackActions

Agent-facing actions with approval workflow.

| Method | Description |
| --- | --- |
| `requestMessageSend(params)` | Request to send message |
| `requestThreadReply(params)` | Request to reply in thread |
| `requestReaction(params)` | Request to add reaction |
| `requestStatusUpdate(params)` | Request status change |
| `approveAction(approvalId)` | User approves |
| `rejectAction(approvalId, notes)` | User rejects |
| `executeApprovedAction(approvalId)` | Execute after approval |

---

## Sync Strategy

### Full Sync

Initial import of workspace data.

```
1. Fetch workspace info (team name, icon)
2. Sync all workspace users
   a. Map to existing Person entities by email
   b. Create new Person entities for unmatched
3. Sync accessible channels
   a. Public channels user is member of
   b. Private channels user is member of
   c. Direct messages
4. Selective message sync
   a. Recent messages (last 7 days)
   b. Threads with user participation
   c. Messages mentioning user
5. Generate embeddings for important messages
```

### Selective Message Sync

Not all messages are valuable context. Prioritize:

| Priority | Criteria | Action |
| --- | --- | --- |
| High | User mentioned | Sync + embed |
| High | User replied | Sync + embed |
| High | User reacted | Sync |
| Medium | Recent (24h) | Sync |
| Low | Old, no interaction | Skip |

### Real-Time Events (Socket Mode)

Optional real-time updates via Slack Socket Mode.

| Event | Handler |
| --- | --- |
| `message` | Add to message store |
| `reaction_added` | Update message reactions |
| `channel_created` | Add to channel list |
| `member_joined_channel` | Update membership |
| `user_change` | Update user info |
| `app_mention` | High-priority context |

---

## Rate Limiting

Slack API has tiered rate limits:

| Tier | Limit | Methods |
| --- | --- | --- |
| Tier 1 | 1 req/min | `admin.*` |
| Tier 2 | 20 req/min | `chat.postMessage` |
| Tier 3 | 50 req/min | `conversations.list` |
| Tier 4 | 100 req/min | `users.list` |

### Implementation

- Token bucket rate limiter per method tier
- Respect `Retry-After` header on 429 responses
- Queue non-urgent operations during high load
- Batch requests where possible

---

## Person Entity Linking

### Matching Strategy

When syncing Slack users, link to existing Person entities:

```
1. Match by email (highest confidence)
2. Match by name (fuzzy, requires confirmation)
3. Create new Person if no match
4. Store slackUserId on Person for future lookups
```

### Person Enrichment

Slack provides additional context for People:

| Slack Field | Person Field |
| --- | --- |
| `profile.email` | email |
| `profile.display_name` | name |
| `profile.real_name` | name (fallback) |
| `profile.image_*` | avatarUrl |
| `profile.title` | title |
| `tz` | timezone |

---

## API Routes

### Workspace Management

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/integrations/slack/workspaces` | List connected workspaces |
| DELETE | `/api/integrations/slack/workspaces/:id` | Disconnect workspace |
| POST | `/api/integrations/slack/sync` | Trigger sync |
| GET | `/api/integrations/slack/status` | Get sync status |

### Channel Management

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/integrations/slack/channels` | List channels |
| PATCH | `/api/integrations/slack/channels/:id` | Update sync settings |
| GET | `/api/integrations/slack/channels/:id/messages` | Get channel messages |

### Message Actions

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/integrations/slack/messages` | Send message (with approval) |
| POST | `/api/integrations/slack/messages/:id/reply` | Reply to thread |
| POST | `/api/integrations/slack/messages/:id/react` | Add reaction |

### Approval Workflow

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/integrations/slack/approvals` | List pending approvals |
| POST | `/api/integrations/slack/approvals/:id/approve` | Approve action |
| POST | `/api/integrations/slack/approvals/:id/reject` | Reject action |

### OAuth

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/integrations/slack/auth` | Start OAuth flow |
| GET | `/api/integrations/slack/callback` | OAuth callback |

---

## Agent Integration

### Agent Tools

| Tool | Description |
| --- | --- |
| `search_slack_messages` | Search message history |
| `list_slack_channels` | Get available channels |
| `get_slack_thread` | Get full thread context |
| `send_slack_message` | Send message (requires approval) |
| `reply_to_slack_thread` | Reply in thread (requires approval) |
| `get_slack_user_context` | Get info about Slack user |
| `find_slack_user` | Find user by name/email |

### Context Enrichment

Slack data enriches agent context:

- **Recent Mentions**: Messages where user was mentioned
- **Active Threads**: Ongoing conversations
- **People Context**: Who user communicates with
- **Channel Topics**: What topics are discussed where

### Example Prompt Injection

```
### Slack Context

**Recent Mentions** (last 24h):
- #engineering: Sarah asked about the API deadline
- DM from Alex: "Can we sync on the budget tomorrow?"

**Active Threads**:
- #product: Discussion about Q1 roadmap (3 new replies)

**Frequent Contacts** (via Slack):
- Sarah Chen (15 messages this week)
- Alex Johnson (8 messages this week)
```

---

## Error Handling

### Error Types

| Error | Cause | Recovery |
| --- | --- | --- |
| `token_revoked` | User revoked access | Prompt re-authentication |
| `missing_scope` | Need additional permissions | Prompt scope upgrade |
| `channel_not_found` | Channel deleted/archived | Remove from sync |
| `not_in_channel` | User left channel | Update membership |
| `ratelimited` | Rate limit exceeded | Exponential backoff |
| `user_not_found` | User deactivated | Mark as deleted |

### Token Refresh

Slack user tokens don't expire but can be revoked. Handle:

- Check token validity on sync start
- Catch `invalid_auth` errors
- Prompt user to re-authenticate

---

## Privacy Considerations

### Data Handling

- Only sync channels user is a member of
- Respect workspace privacy settings
- Don't sync content from locked channels
- Allow user to exclude specific channels
- Provide clear data deletion option

### Retention

| Data Type | Retention |
| --- | --- |
| Messages | 30 days default, configurable |
| Users | Indefinite (Person entities) |
| Channels | Until disconnected |
| Embeddings | Same as messages |

---

## Deliverables

### Phase 6 Checklist

- [ ] **OAuth**
  - [ ] Slack OAuth flow (user token)
  - [ ] Token storage and refresh handling
  - [ ] Scope management

- [ ] **Database**
  - [ ] SlackSyncState table
  - [ ] SlackWorkspace table
  - [ ] SlackChannel table
  - [ ] SlackMessage table
  - [ ] SlackUser table
  - [ ] SlackMessageApproval table
  - [ ] Migrations applied

- [ ] **SlackClient**
  - [ ] User listing
  - [ ] Channel listing
  - [ ] Message history retrieval
  - [ ] Send message
  - [ ] Thread replies
  - [ ] Reactions
  - [ ] Rate limiting

- [ ] **Sync System**
  - [ ] Full sync (users, channels, messages)
  - [ ] Selective message sync (importance-based)
  - [ ] Incremental sync
  - [ ] Socket Mode (optional)

- [ ] **Person Linking**
  - [ ] Match Slack users to existing Person entities
  - [ ] Create new Person from Slack users
  - [ ] Enrich Person with Slack data

- [ ] **Actions & Approvals**
  - [ ] Send message with approval
  - [ ] Reply to thread with approval
  - [ ] Approval UI components
  - [ ] Expiration handling

- [ ] **Agent Integration**
  - [ ] Message search tool
  - [ ] Channel listing tool
  - [ ] Send message tool
  - [ ] Context injection

- [ ] **API Routes**
  - [ ] OAuth endpoints
  - [ ] Workspace management
  - [ ] Channel management
  - [ ] Message actions
  - [ ] Approval workflow

---

## Success Metrics

| Metric | Target | Description |
| --- | --- | --- |
| OAuth success rate | >95% | Successful connections |
| Sync latency | <60s | Full initial sync |
| User matching rate | >80% | Slack users linked to Person |
| Message relevance | >70% | Synced messages used in context |
| Action approval rate | >60% | Slack actions approved |

---

## Future Enhancements (V2+)

- **Bot Mode**: Deploy as Slack bot for app mentions
- **Slash Commands**: `/theo` command in Slack
- **Interactive Messages**: Buttons and menus in Slack
- **Workflow Builder**: Integration with Slack Workflows
- **Enterprise Grid**: Multi-workspace support
- **Huddles**: Meeting context from Slack Huddles
- **Canvas**: Rich document integration
- **Scheduled Messages**: Schedule Slack messages

---

## Appendix: Examples

### Slack User Object

```json
{
  "id": "su_abc123",
  "userId": "user_123",
  "slackUserId": "U0123456789",
  "username": "sarah.chen",
  "displayName": "Sarah Chen",
  "realName": "Sarah Chen",
  "email": "sarah@company.com",
  "avatarUrl": "https://avatars.slack.com/...",
  "title": "Engineering Manager",
  "isBot": false,
  "isDeleted": false,
  "personId": "person_456"
}
```

### Message Approval Object

```json
{
  "id": "sma_xyz789",
  "userId": "user_123",
  "actionType": "send",
  "channelId": "C0123456789",
  "content": "Thanks for the update! I'll review the PR this afternoon.",
  "status": "pending",
  "requestedAt": "2025-12-22T15:30:00Z",
  "expiresAt": "2025-12-23T15:30:00Z",
  "metadata": {
    "channelName": "#engineering",
    "inReplyTo": "Sarah Chen: Can you review the latest PR?"
  }
}
```

### Agent Tool Call Example

```json
{
  "tool": "send_slack_message",
  "parameters": {
    "channel": "#engineering",
    "text": "Thanks for the update! I'll review the PR this afternoon.",
    "threadTs": "1703234567.123456"
  }
}
```

**Response:**
```json
{
  "success": true,
  "requiresApproval": true,
  "approvalId": "sma_xyz789",
  "message": "I've drafted a Slack reply. Please review and approve."
}
```

