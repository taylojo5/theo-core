# Phase 11: SMS Integration

> **Status**: Draft v0.1  
> **Duration**: Weeks 33-35  
> **Dependencies**: Phase 5 (Agent Engine), Phase 6 (Memory), Phase 7 (Continuous Learning)

---

## Overview

Enable users to communicate with Theo via SMS text messaging, creating a truly personal assistant experience. Users can text Theo from anywhere, and Theo can proactively reach out when something important happens.

This transforms Theo from a web-only tool into an always-available assistant that meets users where they are — in their text messages.

---

## Core Product Principle

> **Theo should feel like texting a real human assistant.**

Messages should be conversational, concise, and respectful of the user's attention. Theo should know when to reach out and when to stay quiet.

---

## Goals

- Receive and respond to inbound text messages
- Send proactive notifications for important events
- Maintain conversation context across SMS sessions
- Respect user preferences (quiet hours, notification frequency)
- Handle opt-in, opt-out, and phone number verification
- Integrate with existing agent engine and memory system
- Cost-conscious message management

---

## User Experience Vision

### Inbound (User → Theo)

```
User: Hey, what's on my calendar today?

Theo: You have 3 meetings today:
• 10am - Team standup (30 min)
• 1pm - Sarah 1:1 (1 hour)
• 3pm - Product review (1 hour)

Want me to add anything?
```

```
User: Add milk to my shopping list

Theo: ✓ Added milk to your Kroger list.
You now have 8 items ($32 estimated).
```

```
User: Text Sarah that I'm running 10 min late

Theo: I'll draft that Slack message to Sarah Chen:
"Hey Sarah, running about 10 minutes late to our 1:1. Be there soon!"

Send it? (Reply YES to confirm)
```

### Outbound (Theo → User)

```
Theo: 📅 Reminder: Team standup starts in 15 minutes.
Join link: meet.google.com/abc-xyz

[Reply SKIP to dismiss]
```

```
Theo: 🛒 Your Kroger cart is ready for review!
12 items • $67.50 estimated
Open cart: theo.app/cart/abc123
```

```
Theo: ✉️ Email from your boss (Sarah Chen):
"Quick question about the Q1 budget..."

Reply here or open in app: theo.app/email/xyz
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SMS Provider (Twilio)                        │
│                    Inbound webhook + Outbound API                    │
└─────────────────────────────────────────────────────────────────────┘
                         │                    ▲
                         ▼                    │
┌─────────────────────────────────────────────────────────────────────┐
│                      SMS Gateway Service                             │
│  Webhook handler, message parsing, rate limiting, cost tracking     │
└─────────────────────────────────────────────────────────────────────┘
                         │                    ▲
                         ▼                    │
┌──────────────────────────────┐    ┌──────────────────────────────┐
│     Inbound Processor        │    │    Outbound Processor        │
│  Parse, route to agent       │    │    Queue, format, send       │
└──────────────────────────────┘    └──────────────────────────────┘
                         │                    ▲
                         ▼                    │
┌─────────────────────────────────────────────────────────────────────┐
│                         Agent Engine                                 │
│              Process message, generate response                      │
└─────────────────────────────────────────────────────────────────────┘
                         │                    ▲
                         ▼                    │
┌─────────────────────────────────────────────────────────────────────┐
│                    Notification Engine                               │
│         Triggers, rules, quiet hours, throttling                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## SMS Provider

### Twilio (Recommended)

| Feature           | Details                       |
| ----------------- | ----------------------------- |
| Inbound SMS       | Webhook to `/api/sms/webhook` |
| Outbound SMS      | REST API                      |
| Phone numbers     | Provision via API             |
| Pricing           | ~$0.0079/message (US)         |
| MMS support       | Images, media                 |
| Delivery receipts | Webhook callbacks             |

### Alternative Providers

| Provider    | Pros               | Cons             |
| ----------- | ------------------ | ---------------- |
| Vonage      | Good international | More complex API |
| MessageBird | EU-focused         | Less US coverage |
| AWS SNS     | AWS integration    | Less SMS-focused |

---

## Phone Number Management

### User Phone Registration

```
1. User enters phone number in settings
2. Theo sends verification code via SMS
3. User enters code to verify
4. Phone number stored (encrypted)
5. User configures notification preferences
```

### Theo's Phone Number

Options:

- **Dedicated number per user** (expensive, best UX)
- **Shared number with user context** (cost-effective, recommended)
- **Short code** (high volume, requires approval)

**Recommendation**: Start with shared Twilio number. User identified by their phone number.

### Phone Number Storage

| Field               | Encryption  |
| ------------------- | ----------- |
| Phone number        | AES-256-GCM |
| Verification status | Plain       |
| Preferences         | Plain       |

---

## Data Model

### SmsPhoneNumber

Stores verified user phone numbers.

| Field                 | Type      | Description              |
| --------------------- | --------- | ------------------------ |
| id                    | string    | Unique identifier        |
| userId                | string    | FK to User               |
| phoneNumber           | string    | E.164 format (encrypted) |
| phoneHash             | string    | For lookup (hashed)      |
| countryCode           | string    | ISO country code         |
| isVerified            | boolean   | Verification complete    |
| verifiedAt            | datetime? | When verified            |
| verificationCode      | string?   | Current code (temporary) |
| verificationExpiresAt | datetime? | Code expiration          |
| isActive              | boolean   | SMS enabled              |
| optedOutAt            | datetime? | If user opted out        |
| createdAt             | datetime  |                          |
| updatedAt             | datetime  |                          |

### SmsConversation

Tracks SMS conversation sessions.

| Field                | Type     | Description                |
| -------------------- | -------- | -------------------------- |
| id                   | string   | Unique identifier          |
| userId               | string   | FK to User                 |
| phoneNumberId        | string   | FK to SmsPhoneNumber       |
| status               | enum     | `active`, `idle`, `closed` |
| lastMessageAt        | datetime | Last activity              |
| messageCount         | int      | Total messages in session  |
| context              | json     | Conversation context       |
| linkedConversationId | string?  | FK to web Conversation     |
| createdAt            | datetime |                            |
| updatedAt            | datetime |                            |

### SmsMessage

Individual SMS messages.

| Field             | Type      | Description                                          |
| ----------------- | --------- | ---------------------------------------------------- |
| id                | string    | Unique identifier                                    |
| conversationId    | string    | FK to SmsConversation                                |
| direction         | enum      | `inbound`, `outbound`                                |
| content           | string    | Message text                                         |
| mediaUrls         | string[]? | MMS attachments                                      |
| providerMessageId | string    | Twilio message SID                                   |
| status            | enum      | `pending`, `sent`, `delivered`, `failed`, `received` |
| statusUpdatedAt   | datetime? | Last status update                                   |
| errorCode         | string?   | If failed                                            |
| errorMessage      | string?   | If failed                                            |
| costCents         | int?      | Message cost                                         |
| metadata          | json      | Additional data                                      |
| createdAt         | datetime  |                                                      |

### SmsNotificationPreference

User preferences for proactive messages.

| Field              | Type     | Description         |
| ------------------ | -------- | ------------------- |
| id                 | string   | Unique identifier   |
| userId             | string   | FK to User          |
| category           | string   | Notification type   |
| enabled            | boolean  | Category enabled    |
| quietHoursStart    | time?    | Don't disturb start |
| quietHoursEnd      | time?    | Don't disturb end   |
| quietHoursTimezone | string?  | User timezone       |
| maxPerDay          | int?     | Daily message limit |
| createdAt          | datetime |                     |
| updatedAt          | datetime |                     |

### SmsNotificationTrigger

Configurable triggers for proactive messages.

| Field           | Type      | Description                |
| --------------- | --------- | -------------------------- |
| id              | string    | Unique identifier          |
| userId          | string    | FK to User                 |
| triggerType     | string    | What triggers notification |
| conditions      | json      | When to trigger            |
| messageTemplate | string?   | Custom message template    |
| isEnabled       | boolean   | Trigger active             |
| lastTriggeredAt | datetime? | Last activation            |
| triggerCount    | int       | Times triggered            |
| createdAt       | datetime  |                            |
| updatedAt       | datetime  |                            |

---

## Core Services

### SmsGatewayService

Handles provider communication.

| Method                               | Description            |
| ------------------------------------ | ---------------------- |
| `sendMessage(to, content, options?)` | Send outbound SMS      |
| `sendVerificationCode(phoneNumber)`  | Send verification      |
| `verifyCode(phoneNumber, code)`      | Validate code          |
| `handleWebhook(payload)`             | Process inbound        |
| `handleStatusCallback(payload)`      | Update delivery status |
| `getMessageStatus(messageId)`        | Check message status   |

### SmsConversationService

Manages SMS conversation state.

| Method                                        | Description              |
| --------------------------------------------- | ------------------------ |
| `getOrCreateConversation(phoneNumber)`        | Find/create session      |
| `addMessage(conversationId, message)`         | Record message           |
| `getContext(conversationId)`                  | Get conversation context |
| `updateContext(conversationId, context)`      | Update context           |
| `linkToWebConversation(smsConvId, webConvId)` | Link sessions            |
| `closeConversation(conversationId)`           | End session              |

### SmsInboundProcessor

Processes incoming messages.

| Method                                   | Description                   |
| ---------------------------------------- | ----------------------------- |
| `processInbound(message)`                | Main entry point              |
| `identifyUser(phoneNumber)`              | Look up user                  |
| `parseIntent(message)`                   | Quick intent detection        |
| `routeToAgent(userId, message, context)` | Send to agent                 |
| `handleCommand(command)`                 | Process commands (STOP, HELP) |
| `generateResponse(agentResponse)`        | Format for SMS                |

### SmsOutboundProcessor

Handles outgoing messages.

| Method                                    | Description          |
| ----------------------------------------- | -------------------- |
| `queueMessage(userId, content, priority)` | Add to send queue    |
| `processQueue()`                          | Send queued messages |
| `checkQuietHours(userId)`                 | Respect preferences  |
| `checkThrottling(userId)`                 | Prevent spam         |
| `formatForSms(content)`                   | Truncate, format     |
| `splitLongMessage(content)`               | Handle >160 chars    |

### SmsNotificationEngine

Triggers proactive notifications.

| Method                                          | Description            |
| ----------------------------------------------- | ---------------------- |
| `evaluateTrigger(event, userId)`                | Check if should notify |
| `generateNotification(trigger, data)`           | Create message         |
| `scheduleNotification(userId, content, sendAt)` | Delayed send           |
| `cancelScheduled(notificationId)`               | Cancel pending         |
| `getUpcoming(userId)`                           | List scheduled         |

---

## Inbound Message Processing

### Flow

```
1. Twilio webhook receives SMS
2. Validate webhook signature
3. Look up user by phone number
4. Get or create SMS conversation
5. Check for system commands (STOP, HELP, YES, NO)
6. If command → handle directly
7. Else → route to agent engine
8. Agent processes with full context
9. Format response for SMS (concise)
10. Send response via Twilio
11. Log message and update conversation
```

### System Commands

| Command | Action                 |
| ------- | ---------------------- |
| `STOP`  | Opt out of all SMS     |
| `START` | Re-enable SMS          |
| `HELP`  | Send help message      |
| `YES`   | Confirm pending action |
| `NO`    | Cancel pending action  |
| `SKIP`  | Dismiss notification   |
| `MORE`  | Get more details       |

### Message Formatting for SMS

| Constraint         | Handling                     |
| ------------------ | ---------------------------- |
| 160 char limit     | Split into segments          |
| No rich formatting | Plain text only              |
| No long URLs       | Use short links (theo.app/x) |
| Conciseness        | Agent prompted for brevity   |

### Agent Context Injection

When routing to agent, include:

```
Channel: SMS
Constraints:
- Keep responses under 300 characters
- Use plain text only
- Include action shortcuts (Reply YES to confirm)
- Be conversational but concise

Recent SMS context:
- Last 5 messages in this session
- Pending confirmations
```

---

## Outbound Notifications

### Notification Categories

| Category            | Examples                      | Default  |
| ------------------- | ----------------------------- | -------- |
| `calendar_reminder` | Upcoming meetings             | Enabled  |
| `task_due`          | Task deadlines                | Enabled  |
| `email_urgent`      | Important emails              | Enabled  |
| `email_summary`     | Daily digest                  | Disabled |
| `shopping_ready`    | Cart ready                    | Enabled  |
| `approval_needed`   | Actions needing approval      | Enabled  |
| `learning_question` | Continuous learning questions | Disabled |

### Trigger Types

| Trigger                 | Condition                    | Example Message                      |
| ----------------------- | ---------------------------- | ------------------------------------ |
| `calendar_reminder`     | Event starts in X minutes    | "📅 Team standup in 15 min"          |
| `calendar_conflict`     | Overlapping events detected  | "⚠️ Conflict: 2 meetings at 3pm"     |
| `task_due_soon`         | Task due within X hours      | "📋 'Submit report' due in 2 hours"  |
| `task_overdue`          | Task past due date           | "⚠️ 'Submit report' is overdue"      |
| `email_from_vip`        | Email from important contact | "✉️ Email from Sarah Chen: ..."      |
| `email_urgent_keywords` | Email with urgent language   | "🚨 Urgent email: ..."               |
| `shopping_cart_ready`   | Cart build complete          | "🛒 Your cart is ready!"             |
| `approval_pending`      | Action awaiting approval     | "✋ Pending: Send email to..."       |
| `daily_briefing`        | Scheduled time               | "☀️ Good morning! Today you have..." |

### Quiet Hours

| Setting             | Default         |
| ------------------- | --------------- |
| Start time          | 10:00 PM        |
| End time            | 8:00 AM         |
| Timezone            | User's timezone |
| Override for urgent | Optional        |

During quiet hours:

- Non-urgent messages queued until morning
- Urgent messages (configurable) can override
- User can set per-category overrides

### Throttling

| Limit                | Default   | Purpose        |
| -------------------- | --------- | -------------- |
| Max per hour         | 5         | Prevent spam   |
| Max per day          | 20        | Cost control   |
| Min interval         | 5 minutes | Batch related  |
| Cooldown after reply | 2 minutes | Natural pacing |

---

## Confirmation Workflow

For actions that need approval via SMS:

```
Theo: I'll send this Slack message to Sarah:
"Running 10 min late to our 1:1"

Reply YES to send, NO to cancel.

User: YES

Theo: ✓ Sent! Sarah will see your message.
```

### Pending Confirmations

| Field       | Description                 |
| ----------- | --------------------------- |
| Action type | What will happen            |
| Preview     | What user will see          |
| Expiration  | Auto-cancel after X minutes |
| Reminder    | Re-prompt if no response    |

### Confirmation Commands

| Reply                 | Action                |
| --------------------- | --------------------- |
| `YES` / `Y` / `OK`    | Approve               |
| `NO` / `N` / `CANCEL` | Reject                |
| `EDIT`                | Modify (if supported) |
| (no reply)            | Expire after timeout  |

---

## API Routes

### Phone Management

| Method | Path                      | Description           |
| ------ | ------------------------- | --------------------- |
| POST   | `/api/sms/phone/register` | Start verification    |
| POST   | `/api/sms/phone/verify`   | Complete verification |
| GET    | `/api/sms/phone`          | Get phone status      |
| DELETE | `/api/sms/phone`          | Remove phone          |

### Preferences

| Method | Path                               | Description         |
| ------ | ---------------------------------- | ------------------- |
| GET    | `/api/sms/preferences`             | Get all preferences |
| PATCH  | `/api/sms/preferences`             | Update preferences  |
| GET    | `/api/sms/preferences/quiet-hours` | Get quiet hours     |
| PATCH  | `/api/sms/preferences/quiet-hours` | Set quiet hours     |

### Notifications

| Method | Path                    | Description    |
| ------ | ----------------------- | -------------- |
| GET    | `/api/sms/triggers`     | List triggers  |
| POST   | `/api/sms/triggers`     | Create trigger |
| PATCH  | `/api/sms/triggers/:id` | Update trigger |
| DELETE | `/api/sms/triggers/:id` | Delete trigger |

### Conversations

| Method | Path                                  | Description            |
| ------ | ------------------------------------- | ---------------------- |
| GET    | `/api/sms/conversations`              | List SMS conversations |
| GET    | `/api/sms/conversations/:id`          | Get conversation       |
| GET    | `/api/sms/conversations/:id/messages` | Get messages           |

### Webhooks (Twilio)

| Method | Path                       | Description     |
| ------ | -------------------------- | --------------- |
| POST   | `/api/sms/webhook/inbound` | Receive SMS     |
| POST   | `/api/sms/webhook/status`  | Delivery status |

---

## Agent Integration

### SMS-Specific Agent Prompt

```
You are responding via SMS text message.

CRITICAL CONSTRAINTS:
- Keep responses under 300 characters when possible
- Maximum 3 short paragraphs
- Use plain text only (no markdown)
- Be conversational and friendly
- For actions requiring approval, end with:
  "Reply YES to confirm, NO to cancel"
- For informational responses, optionally end with:
  "Reply for more details"

EMOJI USAGE:
- Use sparingly for visual scanning
- ✓ for confirmations
- 📅 for calendar
- ✉️ for email
- 🛒 for shopping
- ⚠️ for warnings

LINK HANDLING:
- Use short links: theo.app/x/[id]
- Don't include long URLs
```

### Agent Tools for SMS

| Tool                       | Description               |
| -------------------------- | ------------------------- |
| `send_sms_notification`    | Queue a proactive message |
| `schedule_sms_reminder`    | Set timed reminder        |
| `cancel_sms_reminder`      | Cancel scheduled message  |
| `get_sms_preferences`      | Check user SMS settings   |
| `request_sms_confirmation` | Set up YES/NO flow        |

### Cross-Channel Context

SMS conversations should have access to:

- Full conversation history (web + SMS)
- All context entities
- Memory system
- Pending approvals from any channel

---

## Cost Management

### Per-Message Costs (Twilio US)

| Type         | Cost         |
| ------------ | ------------ |
| Outbound SMS | ~$0.0079     |
| Inbound SMS  | ~$0.0079     |
| Phone number | ~$1.00/month |
| MMS          | ~$0.02       |

### Cost Controls

| Control               | Implementation                     |
| --------------------- | ---------------------------------- |
| Daily budget per user | Hard cap on messages               |
| Aggregate by time     | Batch notifications                |
| Smart suppression     | Don't repeat similar messages      |
| Preference defaults   | Conservative notification defaults |

### Cost Tracking

| Metric            | Tracking             |
| ----------------- | -------------------- |
| Messages per user | Daily/monthly        |
| Total spend       | Real-time            |
| Cost per category | By notification type |
| Budget alerts     | Threshold warnings   |

---

## Privacy & Compliance

### SMS Compliance Requirements

| Requirement            | Implementation                 |
| ---------------------- | ------------------------------ |
| Opt-in consent         | Explicit verification flow     |
| Opt-out handling       | STOP command support           |
| Message identification | "Theo:" prefix                 |
| No spam                | Throttling, user control       |
| Data retention         | Configurable message retention |

### TCPA Compliance (US)

- Prior express consent required
- Clear opt-out instructions
- Respect do-not-call requests immediately
- No messages to landlines

### Privacy Measures

| Measure                  | Implementation                 |
| ------------------------ | ------------------------------ |
| Phone encryption         | AES-256-GCM at rest            |
| Message encryption       | Encrypted in database          |
| Minimal retention        | Configurable (default 30 days) |
| No sensitive data in SMS | Summarize, link to app         |
| Audit logging            | All SMS activity logged        |

---

## Error Handling

### Error Scenarios

| Error                 | Handling                        |
| --------------------- | ------------------------------- |
| Invalid phone number  | Reject during registration      |
| Delivery failed       | Retry with backoff, notify user |
| Rate limited (Twilio) | Queue and retry                 |
| User opted out        | Respect, don't retry            |
| Unknown sender        | Ignore (security)               |
| Webhook failure       | Retry queue, alerting           |

### Delivery Status Handling

| Status        | Action                        |
| ------------- | ----------------------------- |
| `queued`      | Wait                          |
| `sent`        | Update status                 |
| `delivered`   | Confirm success               |
| `failed`      | Log error, notify if critical |
| `undelivered` | Check carrier issues          |

---

## Deliverables

### Phase 12 Checklist

- [ ] **Phone Management**
  - [ ] Phone number registration flow
  - [ ] SMS verification code sending
  - [ ] Code validation
  - [ ] Phone number encryption/storage
  - [ ] Opt-out handling

- [ ] **Database**
  - [ ] SmsPhoneNumber table
  - [ ] SmsConversation table
  - [ ] SmsMessage table
  - [ ] SmsNotificationPreference table
  - [ ] SmsNotificationTrigger table
  - [ ] Migrations applied

- [ ] **Inbound Processing**
  - [ ] Twilio webhook integration
  - [ ] Webhook signature validation
  - [ ] User identification by phone
  - [ ] System command handling (STOP, HELP, YES, NO)
  - [ ] Route to agent engine
  - [ ] SMS-optimized response formatting

- [ ] **Outbound Processing**
  - [ ] Message queue
  - [ ] Twilio API integration
  - [ ] Long message splitting
  - [ ] Delivery status tracking
  - [ ] Cost tracking

- [ ] **Notification Engine**
  - [ ] Trigger evaluation
  - [ ] Quiet hours enforcement
  - [ ] Throttling
  - [ ] Message templating
  - [ ] Scheduled notifications

- [ ] **Confirmation Workflow**
  - [ ] Pending confirmation tracking
  - [ ] YES/NO response handling
  - [ ] Timeout/expiration
  - [ ] Cross-channel confirmation sync

- [ ] **Agent Integration**
  - [ ] SMS channel context injection
  - [ ] SMS-specific prompt tuning
  - [ ] SMS notification tools
  - [ ] Cross-channel context access

- [ ] **Preferences UI**
  - [ ] Phone number management
  - [ ] Notification category toggles
  - [ ] Quiet hours configuration
  - [ ] Trigger management

- [ ] **Compliance**
  - [ ] STOP/START handling
  - [ ] Opt-in consent tracking
  - [ ] Message identification
  - [ ] Audit logging

---

## Success Metrics

| Metric                  | Target | Description                     |
| ----------------------- | ------ | ------------------------------- |
| SMS registration rate   | >30%   | Users who add phone             |
| Response rate           | >80%   | Inbound messages answered       |
| Response time           | <30s   | Time to first response          |
| Delivery rate           | >98%   | Messages successfully delivered |
| Opt-out rate            | <5%    | Users who disable SMS           |
| Notification engagement | >40%   | Notifications acted upon        |
| Cost per user/month     | <$2    | Average SMS cost                |

---

## Future Enhancements (V2+)

- **MMS Support**: Send images, screenshots
- **Voice Calls**: Urgent voice notifications
- **WhatsApp Integration**: Alternative messaging channel
- **iMessage/RCS**: Rich messaging where supported
- **Group SMS**: Family/household notifications
- **Location-Based Triggers**: "You're near Kroger, want to review your list?"
- **Voice-to-Text Commands**: "Hey Theo..." via voice
- **International SMS**: Multi-country support
- **Smart Batching**: ML-driven message aggregation

---

## Appendix: Examples

### Inbound Message Object

```json
{
  "id": "sms_msg_abc123",
  "conversationId": "sms_conv_xyz789",
  "direction": "inbound",
  "content": "What's on my calendar today?",
  "providerMessageId": "SM1234567890abcdef",
  "status": "received",
  "createdAt": "2025-12-22T14:30:00Z"
}
```

### Outbound Notification

```json
{
  "id": "sms_msg_def456",
  "conversationId": "sms_conv_xyz789",
  "direction": "outbound",
  "content": "📅 Reminder: Team standup starts in 15 minutes.\nJoin: meet.google.com/abc-xyz\n\n[Reply SKIP to dismiss]",
  "providerMessageId": "SM0987654321fedcba",
  "status": "delivered",
  "statusUpdatedAt": "2025-12-22T14:30:05Z",
  "costCents": 1,
  "metadata": {
    "triggerId": "trigger_calendar_reminder",
    "eventId": "cal_event_123"
  }
}
```

### Notification Trigger

```json
{
  "id": "trigger_abc123",
  "userId": "user_123",
  "triggerType": "calendar_reminder",
  "conditions": {
    "minutesBefore": 15,
    "calendarIds": ["primary"],
    "excludeAllDay": true
  },
  "messageTemplate": "📅 Reminder: {{event.title}} starts in {{minutesBefore}} minutes.",
  "isEnabled": true
}
```

### User Preferences

```json
{
  "userId": "user_123",
  "preferences": {
    "calendar_reminder": { "enabled": true },
    "task_due": { "enabled": true },
    "email_urgent": { "enabled": true },
    "email_summary": { "enabled": false },
    "shopping_ready": { "enabled": true }
  },
  "quietHours": {
    "enabled": true,
    "start": "22:00",
    "end": "08:00",
    "timezone": "America/New_York",
    "urgentOverride": true
  },
  "throttling": {
    "maxPerHour": 5,
    "maxPerDay": 20
  }
}
```
