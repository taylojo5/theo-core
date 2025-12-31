# Theo Agentic Framework

> **Status**: Draft v0.1  
> **Last Updated**: December 2024

## Overview

The Agentic Framework is the brain of Theo. It transforms Theo from a simple chat assistant into an intelligent agent that can reason, plan, act, and learn—all while maintaining complete auditability.

---

## Core Philosophy

### What Makes Theo "Agentic"?

| Traditional Assistant          | Agentic Theo                |
| ------------------------------ | --------------------------- |
| Responds to commands           | Anticipates needs           |
| Single-turn interactions       | Multi-step reasoning        |
| Forgets context                | Accumulates understanding   |
| Requires explicit instructions | Infers from patterns        |
| Reports what happened          | Takes action (with consent) |

### Autonomy Spectrum

```
Full Manual ←──────────────────────────────────────────→ Full Autonomous
     │                                                            │
     │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
     │  │ Advisory │  │ Suggest  │  │ Draft    │  │ Execute  │  │
     │  │          │  │ + Confirm│  │ + Approve│  │ + Notify │  │
     │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
     │                                                            │
     └────────────────────────────────────────────────────────────┘
                              USER CONTROL
```

Users control where Theo operates on this spectrum per action type.

---

## Agent Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AGENT ENGINE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                        PERCEPTION LAYER                             │     │
│  │                                                                     │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │     │
│  │  │  User    │  │ Context  │  │  Time/   │  │ External │          │     │
│  │  │  Input   │  │ Changes  │  │ Schedule │  │  Events  │          │     │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘          │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                    │                                         │
│                                    ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                        REASONING LAYER                              │     │
│  │                                                                     │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │     │
│  │  │    Intent    │  │   Context    │  │  Hypothesis  │             │     │
│  │  │ Understanding│  │  Retrieval   │  │  Formation   │             │     │
│  │  └──────────────┘  └──────────────┘  └──────────────┘             │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                    │                                         │
│                                    ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                        PLANNING LAYER                               │     │
│  │                                                                     │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │     │
│  │  │    Goal      │  │    Step      │  │  Dependency  │             │     │
│  │  │ Decomposition│  │  Sequencing  │  │   Analysis   │             │     │
│  │  └──────────────┘  └──────────────┘  └──────────────┘             │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                    │                                         │
│                                    ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                        EXECUTION LAYER                              │     │
│  │                                                                     │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │     │
│  │  │   Action     │  │    Tool      │  │   Result     │             │     │
│  │  │  Selection   │  │  Invocation  │  │  Evaluation  │             │     │
│  │  └──────────────┘  └──────────────┘  └──────────────┘             │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                    │                                         │
│                                    ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                        LEARNING LAYER                               │     │
│  │                                                                     │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │     │
│  │  │   Outcome    │  │   Context    │  │  Preference  │             │     │
│  │  │  Recording   │  │   Update     │  │   Learning   │             │     │
│  │  └──────────────┘  └──────────────┘  └──────────────┘             │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                      AUDIT TRAIL (Always On)                        │     │
│  │  Every perception, decision, action, and outcome is logged          │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Reasoning System

### Intent Understanding

The agent first understands what the user wants:

```typescript
interface IntentAnalysis {
  // Primary intent
  intent: string; // e.g., "schedule_meeting"
  confidence: number; // 0.0 - 1.0

  // Extracted entities
  entities: Entity[]; // People, dates, places mentioned

  // Implicit needs
  impliedNeeds: string[]; // What the user didn't say but needs

  // Ambiguities
  clarificationNeeded: boolean;
  clarificationQuestions: string[];

  // Assumptions made
  assumptions: Assumption[];
}

interface Assumption {
  statement: string;
  evidence: string[];
  confidence: number;
  verifiable: boolean;
}
```

### Context Retrieval

The agent pulls in relevant context:

```typescript
interface ContextRetrieval {
  // From structured DBs
  relevantPeople: Person[];
  relevantEvents: Event[];
  relevantTasks: Task[];
  relevantDeadlines: Deadline[];

  // From conversation history
  conversationContext: Message[];

  // From semantic search
  semanticMatches: SemanticMatch[];

  // Recency-weighted
  recentInteractions: Interaction[];
}

async function retrieveContext(
  intent: IntentAnalysis,
  options: RetrievalOptions
): Promise<ContextRetrieval> {
  // Multi-source retrieval with ranking
}
```

### Hypothesis Formation

Based on intent + context, the agent forms hypotheses:

```typescript
interface Hypothesis {
  id: string;
  statement: string; // "User wants to schedule with Sarah next week"
  confidence: number;
  supportingEvidence: Evidence[];
  contradictingEvidence: Evidence[];

  // Actions this hypothesis suggests
  suggestedActions: ActionPlan[];
}

interface Evidence {
  source: "user_input" | "context" | "inference" | "history";
  content: string;
  weight: number;
}
```

---

## Planning System

### Goal Decomposition

Complex goals are broken into subgoals:

```typescript
interface Goal {
  id: string;
  description: string;
  type: "atomic" | "composite";

  // For composite goals
  subgoals?: Goal[];

  // For atomic goals
  action?: Action;

  // Dependencies
  dependsOn: string[]; // Goal IDs

  // State
  status: "pending" | "in_progress" | "completed" | "failed" | "blocked";
}

function decomposeGoal(goal: Goal): Goal[] {
  // Recursive decomposition until atomic
}
```

### Plan Generation

```typescript
interface Plan {
  id: string;
  goal: Goal;

  // Ordered steps
  steps: PlanStep[];

  // Execution state
  currentStep: number;
  status: "planned" | "executing" | "completed" | "failed" | "paused";

  // Approval requirements
  requiresApproval: boolean;
  approvedAt?: Date;
  approvedBy?: string;
}

interface PlanStep {
  id: string;
  order: number;
  action: Action;

  // Conditions
  preconditions: Condition[];
  postconditions: Condition[];

  // Execution
  status: "pending" | "executing" | "completed" | "failed" | "skipped";
  result?: ActionResult;

  // Rollback
  rollbackAction?: Action;
}
```

### Example Plan: Schedule a Meeting

```
Goal: Schedule meeting with Sarah Chen about Q1 planning

Plan:
├── Step 1: Retrieve Sarah's context [COMPLETED]
│   └── Action: query_context(entity: 'sarah chen', type: 'person')
│
├── Step 2: Check Sarah's availability [COMPLETED]
│   └── Action: check_calendar(person: 'sarah', range: 'next_week')
│   └── Depends on: Step 1 (need Sarah's calendar integration)
│
├── Step 3: Check my availability [COMPLETED]
│   └── Action: check_calendar(person: 'self', range: 'next_week')
│
├── Step 4: Find overlapping slots [COMPLETED]
│   └── Action: compute_overlap(calendars: [step_2, step_3])
│   └── Depends on: Steps 2, 3
│
├── Step 5: Propose times to user [AWAITING_APPROVAL]
│   └── Action: present_options(slots: step_4_result)
│   └── Requires: user_approval
│
└── Step 6: Send calendar invite [PENDING]
    └── Action: create_event(time: approved_slot, attendees: ['sarah'])
    └── Depends on: Step 5 approval
```

---

## Action System

### Action Types

```typescript
type ActionCategory =
  | "query" // Read data (low risk)
  | "compute" // Process data (no side effects)
  | "draft" // Create draft (reversible)
  | "notify" // Send notification (low risk)
  | "create" // Create entity (medium risk)
  | "update" // Modify entity (medium risk)
  | "delete" // Remove entity (high risk)
  | "external"; // Call external service (high risk)

interface Action {
  id: string;
  name: string;
  category: ActionCategory;

  // The tool/skill to use
  tool: string;
  parameters: Record<string, unknown>;

  // Risk assessment
  riskLevel: "low" | "medium" | "high" | "critical";
  reversible: boolean;

  // Approval requirements
  requiresApproval: boolean;
  autoApproveIf?: Condition[];
}
```

### Action Approval Flow

```
┌────────────┐      ┌────────────┐      ┌────────────┐      ┌────────────┐
│   Action   │  →   │   Risk     │  →   │  Approval  │  →   │  Execute   │
│  Proposed  │      │ Assessment │      │   Check    │      │            │
└────────────┘      └────────────┘      └────────────┘      └────────────┘
                           │                   │
                           ▼                   ▼
                    ┌────────────┐      ┌────────────┐
                    │    Low     │      │   Auto     │
                    │   Risk?    │  ←   │  Approve?  │
                    └────────────┘      └────────────┘
                           │                   │
                      Yes  │                   │ No
                           ▼                   ▼
                    ┌────────────┐      ┌────────────┐
                    │  Execute   │      │   Queue    │
                    │ Immediately│      │ for User   │
                    └────────────┘      └────────────┘
```

### Tool Registry

```typescript
interface Tool {
  name: string;
  description: string;
  category: ActionCategory;

  // Input/Output schema
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;

  // Requirements
  requiredIntegrations: string[];
  requiredPermissions: string[];

  // Execution
  execute(input: unknown, context: ExecutionContext): Promise<unknown>;

  // Undo (if reversible)
  undo?(result: unknown, context: ExecutionContext): Promise<void>;
}

// Tool registry
const tools: Map<string, Tool> = new Map([
  ["query_context", queryContextTool],
  ["send_email", sendEmailTool],
  ["create_task", createTaskTool],
  ["search_web", searchWebTool],
  // ... more tools
]);
```

---

## Audit Trail System

### Audit Log Structure

Every agent action generates an audit entry:

```typescript
interface AuditEntry {
  id: string;
  timestamp: Date;

  // Session context
  userId: string;
  sessionId: string;
  conversationId?: string;

  // What happened
  actionType: string;
  actionCategory: ActionCategory;

  // The agent's reasoning
  intent: string; // What the agent understood
  reasoning: string; // Why it took this action
  confidence: number; // How sure it was

  // Assumptions made
  assumptions: AuditAssumption[];

  // What was affected
  entityType?: string;
  entityId?: string;
  entityBefore?: unknown; // State before action
  entityAfter?: unknown; // State after action

  // Input/Output
  input: unknown;
  output: unknown;

  // Status
  status: "pending" | "completed" | "failed" | "rolled_back";
  errorMessage?: string;

  // Timing
  durationMs: number;

  // Model metadata
  modelUsed?: string;
  tokensUsed?: number;
}

interface AuditAssumption {
  statement: string;
  category: "intent" | "context" | "preference" | "inference";
  evidence: string[];
  confidence: number;

  // Later verification
  verified?: boolean;
  verifiedAt?: Date;
  correction?: string;
}
```

### Audit Query API

```typescript
interface AuditQueryOptions {
  userId: string;

  // Filters
  sessionId?: string;
  actionTypes?: string[];
  entityTypes?: string[];
  dateRange?: { start: Date; end: Date };
  minConfidence?: number;

  // Pagination
  limit?: number;
  offset?: number;

  // Sort
  orderBy?: "timestamp" | "confidence";
  order?: "asc" | "desc";
}

async function queryAuditLog(options: AuditQueryOptions): Promise<AuditEntry[]>;

// Special queries
async function getAssumptionsForAction(
  actionId: string
): Promise<AuditAssumption[]>;
async function getActionChain(startActionId: string): Promise<AuditEntry[]>;
async function getUnverifiedAssumptions(
  userId: string
): Promise<AuditAssumption[]>;
```

### Audit UI Features

1. **Timeline View**: Chronological list of agent actions
2. **Reasoning Transparency**: "Why did you do this?" for any action
3. **Assumption Review**: User can verify/correct assumptions
4. **Undo Trail**: See what can be undone and its impact
5. **Export**: Full audit log export for user ownership

---

## Learning System

### Types of Learning

| Type                      | Description                  | Storage             |
| ------------------------- | ---------------------------- | ------------------- |
| **Explicit Preferences**  | User tells Theo preferences  | User preferences DB |
| **Implicit Preferences**  | Learned from behavior        | Preference model    |
| **Entity Updates**        | New info about people/places | Context DBs         |
| **Relationship Learning** | Who knows whom, etc.         | Relationships DB    |
| **Pattern Recognition**   | Recurring behaviors          | Pattern store       |

### Feedback Loops

```typescript
interface FeedbackSignal {
  type: "explicit" | "implicit";

  // What it's about
  actionId?: string;
  assumptionId?: string;
  responseId?: string;

  // The signal
  signal: "positive" | "negative" | "correction";
  correction?: string;

  // Source
  source: "user_rating" | "user_correction" | "behavior" | "outcome";
}

// Examples of implicit signals:
// - User edits draft before sending → correction signal
// - User accepts suggestion → positive signal
// - User ignores suggestion repeatedly → negative signal
// - User manually does something Theo offered → negative signal
```

### Learning Pipeline

```
┌────────────┐     ┌────────────┐     ┌────────────┐     ┌────────────┐
│  Feedback  │ →   │  Signal    │ →   │  Update    │ →   │  Improved  │
│   Signal   │     │  Analysis  │     │   Model    │     │  Behavior  │
└────────────┘     └────────────┘     └────────────┘     └────────────┘
      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
 User action      Categorize &      Apply to          Future
 or rating        weight signal     relevant store    interactions
```

---

## Proactive Behavior

### Triggers for Proactive Actions

```typescript
type ProactiveTrigger =
  | "time_based" // "It's 9am, here's your daily briefing"
  | "deadline_approaching" // "Project due in 2 days"
  | "calendar_event" // "Meeting with Sarah in 15 minutes"
  | "pattern_match" // "You usually do X on Fridays"
  | "context_change" // "Sarah just emailed you"
  | "inferred_need"; // "You mentioned needing Y, here's help"

interface ProactiveRule {
  id: string;
  trigger: ProactiveTrigger;
  condition: Condition;
  action: Action;

  // User control
  enabled: boolean;
  autonomyLevel: "advise" | "suggest" | "draft" | "execute";

  // Frequency limits
  maxPerDay?: number;
  minIntervalMinutes?: number;
}
```

### Example Proactive Behaviors

| Trigger                | Condition        | Action                | Default Autonomy |
| ---------------------- | ---------------- | --------------------- | ---------------- |
| `time_based`           | Morning, weekday | Daily briefing        | Suggest          |
| `deadline_approaching` | < 24 hours       | Reminder notification | Execute          |
| `calendar_event`       | 15 min before    | Prep summary          | Suggest          |
| `context_change`       | Important email  | Alert + summary       | Advise           |
| `pattern_match`        | Friday 4pm       | Weekly review prompt  | Suggest          |

---

## Safety & Guardrails

### Permission Boundaries

```typescript
interface PermissionSet {
  // Data access
  canReadContext: boolean;
  canWriteContext: boolean;

  // Actions
  canSendEmail: boolean;
  canSendSlack: boolean;
  canCreateEvents: boolean;
  canModifyEvents: boolean;

  // Autonomy limits
  maxAutonomyLevel: "advise" | "suggest" | "draft" | "execute";
  requireApprovalFor: ActionCategory[];

  // Rate limits
  maxActionsPerHour: number;
  maxExternalCallsPerDay: number;
}
```

### Confidence Thresholds

```typescript
const CONFIDENCE_THRESHOLDS = {
  // Below this, ask for clarification
  action_threshold: 0.7,

  // Below this, present as uncertain
  statement_threshold: 0.5,

  // Below this, don't show assumption
  assumption_threshold: 0.3,

  // For high-risk actions, require higher confidence
  high_risk_threshold: 0.9,
};
```

### Fail-Safe Behaviors

1. **Uncertainty Expression**: Agent clearly states when unsure
2. **Confirmation for Risk**: High-risk actions always need approval
3. **Rate Limiting**: Prevents runaway action loops
4. **Rollback Capability**: Reversible actions can be undone
5. **Human Escalation**: Agent knows when to defer to user

---

## Implementation Roadmap

### Phase 1: Foundation

- [ ] Basic intent understanding
- [ ] Simple context retrieval
- [ ] Single-step action execution
- [ ] Full audit logging

### Phase 2: Planning

- [ ] Multi-step plan generation
- [ ] Dependency tracking
- [ ] Plan execution engine
- [ ] Approval workflows

### Phase 3: Learning

- [ ] Feedback signal processing
- [ ] Preference learning
- [ ] Pattern recognition
- [ ] Confidence calibration

### Phase 4: Proactivity

- [ ] Trigger system
- [ ] Proactive rule engine
- [ ] User autonomy controls
- [ ] Smart notification system
