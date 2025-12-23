# Phase 5: Agent Engine

> **Status**: Draft v0.1  
> **Duration**: Weeks 14-17  
> **Dependencies**: Phase 1 (Core Foundation), Phase 2 (Context System), Phase 3 (Gmail), Phase 4 (Calendar)

---

## Overview

Build the "brain" of Theo — the Agent Engine that transforms simple chat into intelligent, context-aware, action-capable assistance. The engine reasons about user intent, retrieves relevant context, plans multi-step actions, executes tools, and maintains complete auditability.

> **See also**: [AGENTIC_FRAMEWORK.md](../AGENTIC_FRAMEWORK.md) for detailed architectural concepts and philosophy.

---

## Goals

- Intent understanding from natural language
- Context-aware response generation
- Tool execution framework with type-safe definitions
- Multi-step planning for complex requests
- Action approval workflow for user control
- Full audit trail for transparency and debugging

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AGENT ENGINE                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │                    PERCEPTION LAYER                         │     │
│  │  User Input → Intent Analysis → Entity Extraction          │     │
│  └────────────────────────────────────────────────────────────┘     │
│                              │                                       │
│                              ▼                                       │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │                    REASONING LAYER                          │     │
│  │  Context Retrieval → Hypothesis Formation → Confidence     │     │
│  └────────────────────────────────────────────────────────────┘     │
│                              │                                       │
│                              ▼                                       │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │                    PLANNING LAYER                           │     │
│  │  Goal Decomposition → Step Sequencing → Dependency Graph   │     │
│  └────────────────────────────────────────────────────────────┘     │
│                              │                                       │
│                              ▼                                       │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │                    EXECUTION LAYER                          │     │
│  │  Tool Selection → Approval Check → Execution → Evaluation  │     │
│  └────────────────────────────────────────────────────────────┘     │
│                              │                                       │
│                              ▼                                       │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │                    AUDIT LAYER (Always On)                  │     │
│  │  Every decision, action, and outcome is logged             │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Agent Engine

The main orchestrator that processes messages and coordinates all layers.

| Method | Description |
| --- | --- |
| `processMessage(message, context)` | Main entry point for user messages |
| `executePlan(plan)` | Execute a multi-step plan |
| `continueExecution(planId)` | Resume after approval |
| `cancelExecution(planId)` | Abort in-progress plan |

### 2. Intent Analyzer

Understands what the user wants from their message.

| Method | Description |
| --- | --- |
| `analyzeIntent(message, history)` | Extract intent and entities |
| `detectAmbiguity(intent)` | Identify clarification needs |
| `generateClarification(ambiguity)` | Create clarifying questions |

**Intent Analysis Output:**

| Field | Type | Description |
| --- | --- | --- |
| intent | string | Primary intent (e.g., `schedule_meeting`) |
| confidence | float | 0.0-1.0 confidence score |
| entities | Entity[] | Extracted people, dates, places, etc. |
| impliedNeeds | string[] | Inferred but unstated needs |
| clarificationNeeded | boolean | Whether to ask follow-up |
| clarificationQuestions | string[] | Suggested questions |
| assumptions | Assumption[] | Assumptions made with evidence |

### 3. Context Retrieval Service

Gathers relevant context from all sources.

| Method | Description |
| --- | --- |
| `retrieveContext(intent, options)` | Multi-source context retrieval |
| `searchSemantic(query, filters)` | Vector similarity search |
| `getRecentInteractions(userId)` | Recent conversation context |
| `rankContextRelevance(items, intent)` | Relevance scoring |

**Context Sources:**

| Source | Data |
| --- | --- |
| People | Relevant contacts, relationships |
| Events | Upcoming/recent calendar events |
| Tasks | Active tasks and deadlines |
| Conversations | Recent message history |
| Emails | Relevant email threads |
| Semantic | Vector-matched content |

### 4. Planner

Decomposes complex goals into executable steps.

| Method | Description |
| --- | --- |
| `createPlan(goal, context)` | Generate execution plan |
| `validatePlan(plan)` | Check feasibility and permissions |
| `optimizePlan(plan)` | Parallelize independent steps |
| `estimateApprovals(plan)` | Identify approval requirements |

**Plan Structure:**

| Field | Type | Description |
| --- | --- | --- |
| id | string | Unique plan identifier |
| goal | Goal | Top-level goal description |
| steps | PlanStep[] | Ordered execution steps |
| currentStep | number | Current execution position |
| status | enum | `planned`, `executing`, `paused`, `completed`, `failed` |
| requiresApproval | boolean | Has pending approval steps |
| approvedAt | datetime? | When approved |

### 5. Tool Registry

Type-safe registry of available tools/actions.

| Method | Description |
| --- | --- |
| `registerTool(tool)` | Add tool to registry |
| `getTool(name)` | Retrieve tool by name |
| `listTools(category?)` | List available tools |
| `validateToolCall(name, params)` | Validate parameters |

---

## Tool System

### Tool Definition

Each tool has a consistent interface:

| Field | Type | Description |
| --- | --- | --- |
| name | string | Unique identifier |
| description | string | For LLM tool selection |
| category | enum | `query`, `compute`, `draft`, `create`, `update`, `delete`, `external` |
| inputSchema | JSONSchema | Parameter validation |
| outputSchema | JSONSchema | Response structure |
| requiredIntegrations | string[] | Required connected accounts |
| riskLevel | enum | `low`, `medium`, `high`, `critical` |
| requiresApproval | boolean | Default approval requirement |
| execute | function | Execution handler |
| undo | function? | Rollback handler (if reversible) |

### Core Tools

| Tool | Category | Risk | Approval | Description |
| --- | --- | --- | --- | --- |
| `query_context` | query | low | no | Search user's context |
| `search_emails` | query | low | no | Search email archive |
| `list_calendar_events` | query | low | no | Query calendar |
| `check_availability` | query | low | no | Find free time slots |
| `create_task` | create | medium | optional | Create a task |
| `update_task` | update | medium | optional | Modify a task |
| `send_email` | external | high | yes | Send email via Gmail |
| `create_calendar_event` | external | high | yes | Create calendar event |
| `send_slack` | external | high | yes | Send Slack message |

### Tool Execution Flow

```
1. LLM selects tool + parameters
2. Validate parameters against schema
3. Check required integrations available
4. Assess risk level
5. If approval required:
   a. Create pending action
   b. Notify user
   c. Wait for approval
6. Execute tool
7. Evaluate result
8. Log to audit trail
9. Return to LLM for next step
```

---

## Approval Workflow

### Approval Levels

| Level | Description | Example |
| --- | --- | --- |
| `auto` | Execute immediately | Query tools, read-only |
| `notify` | Execute and notify | Low-risk creates |
| `confirm` | Require explicit approval | Sends, external actions |
| `review` | Present draft for editing | Email drafts |

### User Autonomy Settings

Users control approval requirements per action type:

```json
{
  "email.send": "confirm",
  "email.draft": "notify",
  "calendar.create": "confirm",
  "task.create": "auto",
  "slack.send": "confirm"
}
```

### Action Approval Model

| Field | Type | Description |
| --- | --- | --- |
| id | string | Unique identifier |
| userId | string | FK to User |
| planId | string? | Parent plan if multi-step |
| stepIndex | number? | Step in plan |
| actionType | string | Tool name |
| parameters | json | Tool parameters |
| status | enum | `pending`, `approved`, `rejected`, `expired`, `executed` |
| riskLevel | enum | `low`, `medium`, `high`, `critical` |
| reasoning | string | Why agent proposed this |
| requestedAt | datetime | When requested |
| expiresAt | datetime? | Auto-expiration |
| decidedAt | datetime? | When user decided |
| result | json? | Execution result |
| errorMessage | string? | Error if failed |

---

## Audit Trail

### Audit Entry Structure

Every agent action generates an audit entry:

| Field | Type | Description |
| --- | --- | --- |
| id | string | Unique identifier |
| userId | string | FK to User |
| sessionId | string? | Session context |
| conversationId | string? | Conversation context |
| actionType | string | What happened |
| actionCategory | enum | Tool category |
| intent | string | Agent's understanding |
| reasoning | string | Why this action |
| confidence | float | How certain |
| assumptions | Assumption[] | Assumptions made |
| entityType | string? | Affected entity type |
| entityId | string? | Affected entity ID |
| entityBefore | json? | State before |
| entityAfter | json? | State after |
| input | json | Action input |
| output | json | Action output |
| status | enum | `pending`, `completed`, `failed`, `rolled_back` |
| errorMessage | string? | Error details |
| durationMs | number | Execution time |
| modelUsed | string? | LLM model |
| tokensUsed | number? | Token consumption |
| createdAt | datetime | Timestamp |

### Assumption Tracking

| Field | Type | Description |
| --- | --- | --- |
| id | string | Unique identifier |
| auditLogId | string | Parent audit entry |
| statement | string | The assumption |
| category | enum | `intent`, `context`, `preference`, `inference` |
| evidence | json | Supporting evidence |
| confidence | float | Confidence level |
| verified | boolean? | User verified |
| verifiedAt | datetime? | When verified |
| correction | string? | User correction |

---

## LLM Integration

### Prompt Structure

```
System Prompt:
- Core identity and capabilities
- Available tools (dynamically injected)
- User preferences and autonomy settings
- Current context summary

User Context:
- Recent conversation history
- Relevant people/events/tasks
- Time and timezone

User Message:
- Current user input

Response Format:
- Think through the request
- Select appropriate tool(s)
- Provide reasoning for actions
- Generate user-facing response
```

### Model Selection

| Use Case | Recommended Model | Notes |
| --- | --- | --- |
| Intent analysis | GPT-4o-mini | Fast, good at classification |
| Complex planning | Claude Opus / GPT-4 | Strong reasoning |
| Tool selection | GPT-4o | Good function calling |
| Response generation | GPT-4o | Balanced quality/speed |

### Token Management

| Strategy | Implementation |
| --- | --- |
| Context window | Truncate old messages, keep system prompt |
| Tool descriptions | Only include relevant tools |
| Context injection | Summarize large context |
| Streaming | SSE for real-time responses |

---

## API Routes

### Chat

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/chat/message` | Send message, get response |
| GET | `/api/chat/conversations` | List conversations |
| GET | `/api/chat/conversations/:id` | Get conversation with messages |
| DELETE | `/api/chat/conversations/:id` | Delete conversation |

### Actions

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/actions/pending` | List pending approvals |
| GET | `/api/actions/:id` | Get action details |
| POST | `/api/actions/:id/approve` | Approve action |
| POST | `/api/actions/:id/reject` | Reject action |
| POST | `/api/actions/:id/edit` | Edit and approve |

### Plans

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/plans/:id` | Get plan status |
| POST | `/api/plans/:id/continue` | Resume after approval |
| POST | `/api/plans/:id/cancel` | Cancel plan |

### Audit

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/audit` | Query audit log |
| GET | `/api/audit/:id` | Get audit entry |
| GET | `/api/audit/:id/assumptions` | Get assumptions |
| POST | `/api/audit/:id/verify` | Verify assumption |

---

## Streaming Response

### SSE Event Types

| Event | Payload | Description |
| --- | --- | --- |
| `thinking` | `{ step: string }` | Agent reasoning step |
| `tool_call` | `{ tool, params }` | Tool being called |
| `tool_result` | `{ tool, result }` | Tool execution result |
| `approval_needed` | `{ actionId, details }` | Requires user approval |
| `content` | `{ delta: string }` | Response text chunk |
| `done` | `{ messageId }` | Response complete |
| `error` | `{ message }` | Error occurred |

### Client Integration

```typescript
// Example client usage
const eventSource = new EventSource('/api/chat/message', {
  method: 'POST',
  body: JSON.stringify({ message, conversationId })
});

eventSource.on('thinking', (e) => showThinking(e.step));
eventSource.on('content', (e) => appendContent(e.delta));
eventSource.on('approval_needed', (e) => showApprovalDialog(e));
eventSource.on('done', (e) => finalize(e.messageId));
```

---

## Error Handling

### Error Types

| Error | Cause | Recovery |
| --- | --- | --- |
| `IntentUnclear` | Can't understand request | Ask clarifying question |
| `ContextMissing` | Required context unavailable | Explain what's needed |
| `ToolNotAvailable` | Integration not connected | Prompt to connect |
| `ApprovalTimeout` | User didn't approve in time | Notify, allow retry |
| `ToolExecutionFailed` | Tool returned error | Explain, suggest alternative |
| `PlanFailed` | Step in plan failed | Rollback if possible, explain |
| `RateLimitExceeded` | Too many requests | Queue and retry |

### Graceful Degradation

| Failure | Fallback |
| --- | --- |
| LLM timeout | Retry with simpler prompt |
| Context retrieval fails | Proceed with available context |
| Tool fails | Try alternative tool or explain |
| Full plan fails | Complete what's possible, explain rest |

---

## Safety & Guardrails

### Confidence Thresholds

| Threshold | Value | Action |
| --- | --- | --- |
| Action threshold | 0.7 | Below = ask clarification |
| Statement threshold | 0.5 | Below = express uncertainty |
| High-risk threshold | 0.9 | Require for sensitive actions |

### Rate Limits

| Limit | Value | Scope |
| --- | --- | --- |
| Actions per minute | 10 | Per user |
| External calls per hour | 50 | Per user |
| LLM tokens per hour | 100,000 | Per user |

### Content Filtering

- Refuse harmful requests
- Don't generate personal attacks
- Respect privacy boundaries
- Flag suspicious patterns

---

## Deliverables

### Phase 5 Checklist

- [ ] **Agent Engine Core**
  - [ ] Message processing pipeline
  - [ ] Intent analyzer with entity extraction
  - [ ] Context retrieval service
  - [ ] Response generator

- [ ] **Tool System**
  - [ ] Tool registry with type-safe definitions
  - [ ] Core query tools (context, email, calendar)
  - [ ] Core action tools (task, email, calendar)
  - [ ] Tool validation and execution

- [ ] **Planning System**
  - [ ] Goal decomposition
  - [ ] Multi-step plan generation
  - [ ] Dependency tracking
  - [ ] Plan execution engine

- [ ] **Approval Workflow**
  - [ ] Action approval model
  - [ ] Pending action management
  - [ ] Approval/rejection handling
  - [ ] Expiration processing

- [ ] **Audit Trail**
  - [ ] Audit log entries for all actions
  - [ ] Assumption tracking
  - [ ] Reasoning capture
  - [ ] Query API

- [ ] **API & Streaming**
  - [ ] Chat message endpoint with SSE
  - [ ] Action approval endpoints
  - [ ] Audit query endpoints
  - [ ] Plan management endpoints

- [ ] **UI Integration**
  - [ ] Streaming message display
  - [ ] Tool execution indicators
  - [ ] Approval dialog
  - [ ] Audit viewer

---

## Success Metrics

| Metric | Target | Description |
| --- | --- | --- |
| Intent accuracy | >90% | Correct intent classification |
| Tool selection accuracy | >85% | Correct tool chosen |
| Response latency (p50) | <2s | Time to first content |
| Response latency (p95) | <5s | Including tool calls |
| Plan completion rate | >80% | Multi-step plans succeed |
| User approval rate | >70% | Actions approved vs rejected |
| Audit coverage | 100% | All actions logged |

---

## Future Enhancements (V2+)

- **Proactive Behavior**: Time-based triggers, deadline alerts
- **Learning Layer**: Preference learning from feedback
- **Parallel Execution**: Execute independent plan steps concurrently
- **Plan Caching**: Reuse similar plans for repeated requests
- **Multi-agent**: Specialized agents for different domains
- **Voice Interface**: Speech-to-text integration
- **Mobile Push**: Action approval via push notification

---

## Appendix: Examples

### Simple Query Flow

**User**: "When is my next meeting with Sarah?"

```
1. Intent Analysis:
   - intent: "query_calendar"
   - entities: [{ type: "person", value: "Sarah" }]
   - confidence: 0.95

2. Context Retrieval:
   - Sarah Chen identified from contacts
   - Calendar events with Sarah queried

3. Tool Execution:
   - Tool: list_calendar_events
   - Params: { attendee: "sarah@example.com", timeMin: now }
   - Result: Meeting tomorrow at 2pm

4. Response:
   "Your next meeting with Sarah Chen is tomorrow at 2:00 PM - 
    'Q1 Planning Review' in Conference Room A."
```

### Multi-Step Plan Example

**User**: "Schedule a 30-minute meeting with Alex next week to discuss the budget"

```
Plan:
├── Step 1: Find Alex [AUTO]
│   └── query_context(type: "person", name: "Alex")
│   └── Result: Alex Johnson, alex@company.com
│
├── Step 2: Get Alex's availability [AUTO]
│   └── check_availability(email: "alex@company.com", range: "next_week")
│   └── Result: Mon 10am, Tue 2pm, Wed 11am, Thu 3pm
│
├── Step 3: Get my availability [AUTO]
│   └── check_availability(email: "me", range: "next_week")
│   └── Result: Mon 10am-12pm, Tue all day, Wed 9am-12pm
│
├── Step 4: Find overlap [AUTO]
│   └── compute_overlap(calendars: [step_2, step_3], duration: 30)
│   └── Result: Mon 10am, Tue 2pm, Wed 11am
│
├── Step 5: Present options [AWAITING_USER]
│   └── "I found 3 available times..."
│
└── Step 6: Create event [REQUIRES_APPROVAL]
    └── create_calendar_event(...)
    └── Waiting for Step 5 selection + approval
```

### Audit Entry Example

```json
{
  "id": "aud_abc123",
  "userId": "user_123",
  "conversationId": "conv_456",
  "actionType": "create_calendar_event",
  "actionCategory": "external",
  "intent": "Schedule meeting with Alex about budget",
  "reasoning": "User requested a 30-minute meeting with Alex next week. Found mutual availability on Monday at 10am. Created event with budget discussion topic.",
  "confidence": 0.92,
  "assumptions": [
    {
      "statement": "Alex refers to Alex Johnson (alex@company.com)",
      "category": "context",
      "evidence": ["Only Alex in contacts", "Recent email thread"],
      "confidence": 0.95
    },
    {
      "statement": "30 minutes is the default meeting length",
      "category": "preference",
      "evidence": ["User specified '30-minute'"],
      "confidence": 1.0
    }
  ],
  "input": {
    "title": "Budget Discussion",
    "attendees": ["alex@company.com"],
    "startTime": "2025-12-29T10:00:00Z",
    "duration": 30
  },
  "output": {
    "eventId": "evt_789",
    "htmlLink": "https://calendar.google.com/..."
  },
  "status": "completed",
  "durationMs": 1250
}
```

