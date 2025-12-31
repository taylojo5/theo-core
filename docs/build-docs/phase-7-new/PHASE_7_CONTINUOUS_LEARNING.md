# Phase 7: Continuous Learning System

> **Status**: Draft v0.1  
> **Duration**: Weeks 21-23  
> **Dependencies**: Phase 6 (Memory System), Phase 5 (Agent Engine)

---

## Overview

Enable Theo to continually learn, refine, and reconfirm user preferences through explicit, respectful feedback loops. Onboarding never ends — it simply becomes quieter, more contextual, and more valuable.

### Core Insight

Learning happens through **Open Questions** — small, well-timed prompts that clarify ambiguity, confirm preferences, and reinforce memory. An Open Question represents:

- Something Theo needs to know to act better
- Something Theo is unsure about
- Something that may no longer be true

---

## Guiding Principles

| Principle      | Description                                                    |
| -------------- | -------------------------------------------------------------- |
| **Continuous** | Learning is ongoing, not front-loaded during onboarding        |
| **Respectful** | User attention is scarce — ask only what matters               |
| **Valuable**   | Every question has a clear payoff                              |
| **Explicit**   | Memory is inspectable and reversible; never silent assumptions |
| **Skippable**  | All questions can be snoozed, dismissed, or ignored            |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Learning Detector                            │
│  Observes: edits, overrides, rejections, patterns, staleness        │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Question Backlog                             │
│  Stores all unresolved Open Questions with priority scores          │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Question Orchestrator                          │
│  Controls when, where, and how often to ask                         │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Answer Interpreter                             │
│  Converts responses → memory updates, mappings, dismissals          │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Memory Reinforcement Engine                         │
│  Handles promotion (soft→hard) and decay (staleness checks)         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. Open Question (First-Class Entity)

An `OpenQuestion` is a pending clarification or confirmation that Theo wants answered.

**Question Types:**

| Type                  | Description                              | Urgency        |
| --------------------- | ---------------------------------------- | -------------- |
| `disambiguation`      | Multiple options, need user choice       | Often blocking |
| `preference_proposal` | Theo noticed a pattern, wants to save it | Non-blocking   |
| `reconfirm`           | Stale memory needs validation            | Non-blocking   |
| `missing_context`     | Can't proceed without info               | Blocking       |

**Question States:**

```
open → asked → answered
         ↓         ↓
      snoozed   dismissed
         ↓
      expired
```

### 2. Learning Detector

Continuously observes system behavior to identify learning opportunities.

**Inputs:**

- User edits, overrides, rejections
- Acceptance or dismissal of suggestions
- Confidence scores from decision-making
- Frequency of repeated choices
- Memory age / staleness
- Integration errors (out-of-stock, ambiguity)

**Outputs:**

- New `OpenQuestion`
- Memory proposal (via Phase 9)
- Reconfirmation request

### 3. Question Backlog

A persistent queue of unresolved Open Questions.

**Responsibilities:**

- Store all open questions with metadata
- Track status and resolution history
- Support priority-based retrieval
- Enforce throttling limits

### 4. Question Orchestrator

Controls the timing and delivery of questions.

**Timing Rules:**

- Ask immediately only if blocking progress
- Defer non-urgent questions to low-friction moments
- Batch related questions when possible

**Throttling Rules:**

- Max 1 non-urgent question per session
- Max 1-2 questions per day (unless user opts in)
- Respect "snooze" and "ask later"

**Delivery Channels:**

- In-chat (default)
- Email digest (weekly check-in)
- Slack DM (future)
- Push notification (future)

### 5. Answer Interpreter

Converts user responses into concrete system updates.

**Possible Outcomes:**

- Create/update hard memory (Phase 9)
- Create/update soft memory (Phase 9)
- Save product/service mappings
- Update confidence levels
- Permanently dismiss question
- Generate follow-up question

### 6. Memory Reinforcement Engine

Keeps memory accurate over time through promotion and decay.

**Promotion (Soft → Hard):**

- Requires explicit confirmation, OR
- Repeated acceptance (3+) followed by confirmation prompt

**Decay (Staleness):**

- Hard memory flagged after configurable time period
- Behavior drift triggers reconfirmation
- Contradictory actions create `reconfirm` questions

---

## Data Model (Conceptual)

### OpenQuestion

| Field         | Type      | Description                                                             |
| ------------- | --------- | ----------------------------------------------------------------------- |
| id            | string    | Unique identifier                                                       |
| userId        | string    | Owner                                                                   |
| type          | enum      | `disambiguation`, `preference_proposal`, `reconfirm`, `missing_context` |
| domain        | string    | Food, schedule, shopping, etc.                                          |
| prompt        | string    | User-facing question text                                               |
| context       | json      | Evidence, options, defaults                                             |
| priority      | number    | 0-100, computed score                                                   |
| urgency       | enum      | `blocking`, `non_blocking`                                              |
| status        | enum      | `open`, `asked`, `snoozed`, `answered`, `dismissed`, `expired`          |
| sourceEventId | string    | What triggered this question                                            |
| memoryItemId  | string?   | Related memory (if reconfirm)                                           |
| expiresAt     | datetime? | Auto-expire if not answered                                             |
| createdAt     | datetime  |                                                                         |
| askedAt       | datetime? | When presented to user                                                  |
| answeredAt    | datetime? | When resolved                                                           |

### LearningEvent (Audit Trail)

| Field      | Type     | Description                                                                |
| ---------- | -------- | -------------------------------------------------------------------------- |
| id         | string   | Unique identifier                                                          |
| userId     | string   | Owner                                                                      |
| eventType  | enum     | `override`, `reject`, `accept`, `skip`, `pattern_detected`, `stale_memory` |
| domain     | string   | Affected domain                                                            |
| payload    | json     | Event-specific data                                                        |
| questionId | string?  | Related question if any                                                    |
| createdAt  | datetime |                                                                            |

---

## Core Learning Flows

### Flow A: Blocking Disambiguation

**Trigger:** System encounters ambiguity that prevents action.

**Example:** Grocery item with multiple matching products.

```
1. Agent attempts to resolve "chicken breast"
2. Multiple products score similarly (85% vs 83% vs 82%)
3. Create OpenQuestion (type: disambiguation, urgency: blocking)
4. Orchestrator presents immediately in chat
5. User selects option
6. Interpreter: resolves action + optionally proposes preference
```

### Flow B: Post-Action Learning

**Trigger:** Pattern detected in user behavior.

**Example:** User consistently edits email tone.

```
1. Theo drafts emails
2. User edits tone 4 out of 5 times
3. Learning Detector identifies pattern
4. Create OpenQuestion (type: preference_proposal, urgency: non_blocking)
5. Orchestrator defers to end of session or digest
6. User confirms → memory created
```

### Flow C: Stale Memory Reconfirmation

**Trigger:** Memory item exceeds staleness threshold.

**Example:** Preferred grocery store saved 6 months ago.

```
1. Memory Reinforcement Engine flags stale item
2. Create OpenQuestion (type: reconfirm)
3. Include in weekly check-in
4. User confirms, edits, or dismisses
5. Memory updated or archived
```

### Flow D: Weekly Check-in

**Trigger:** Scheduled (configurable frequency).

A low-friction summary designed to avoid annoyance.

**Characteristics:**

- 1-3 highest-value questions only
- Mix of reconfirmations and proposals
- Fully skippable ("I'll handle these later")
- Delivered via preferred channel

---

## Prioritization Model

Each OpenQuestion is scored by:

| Factor             | Weight   | Description                                |
| ------------------ | -------- | ------------------------------------------ |
| Value              | High     | Time saved or errors prevented if answered |
| Frequency          | Medium   | How often this ambiguity occurs            |
| Confidence Gap     | Medium   | How uncertain Theo currently is            |
| Temporal Relevance | Low      | Is this needed soon?                       |
| Annoyance Budget   | Negative | Penalize if user has been asked recently   |

**Priority Formula (conceptual):**

```
priority = (value * 0.4) + (frequency * 0.25) + (confidence_gap * 0.2)
         + (temporal * 0.1) - (recent_asks * 0.15)
```

Only questions above threshold are surfaced.

---

## UX Patterns

### Micro-Confirmation

```
┌─────────────────────────────────────────────┐
│ 💡 Save this as a preference?               │
│                                             │
│ "Always use Kroger for grocery orders"      │
│                                             │
│     [ Yes ]  [ No ]  [ Edit ]               │
└─────────────────────────────────────────────┘
```

### Evidence-Based Prompt

```
┌─────────────────────────────────────────────┐
│ 📊 You chose Fairlife milk 6 of the last    │
│    7 times. Make it your default?           │
│                                             │
│     [ Yes, save it ]  [ No, keep asking ]   │
└─────────────────────────────────────────────┘
```

### Snooze Option

```
┌─────────────────────────────────────────────┐
│ ⏰ Ask me later                             │
│                                             │
│   [ Tomorrow ]  [ Next week ]  [ Never ]    │
└─────────────────────────────────────────────┘
```

### Weekly Digest

```
Subject: Theo Check-in (3 quick questions)

Hey! I have a few things I'd like to confirm:

1. You've been ordering from Whole Foods. Still your preferred store?
   [Yes] [No, changed] [Skip]

2. I noticed you always remove cilantro from recipes.
   Should I remember this?
   [Yes] [No] [Skip]

3. Is your work schedule still Mon-Fri, 9-5?
   [Yes] [It's changed] [Skip]

[Skip all for now]
```

---

## Integration Points

### With Memory System (Phase 9)

- Answers flow directly into Hard or Soft Memory
- OpenQuestions may reference existing `memoryItemId` for reconfirmation
- Memory retrieval may trigger new OpenQuestions when context is missing
- Memory proposals from agent go through confirmation flow

### With Agent Engine (Phase 5)

- Agent can create blocking OpenQuestions during execution
- Agent receives resolution before continuing
- Agent tools for creating preference proposals

### With Integrations (Gmail, Calendar, etc.)

- Integration errors generate learning opportunities
- Successful patterns become preference proposals
- Disambiguation uses integration-specific options

---

## API Surface

### Endpoints

| Method | Path                                  | Description                  |
| ------ | ------------------------------------- | ---------------------------- |
| GET    | `/api/learning/questions`             | List open questions for user |
| GET    | `/api/learning/questions/:id`         | Get question details         |
| POST   | `/api/learning/questions/:id/answer`  | Submit answer                |
| POST   | `/api/learning/questions/:id/snooze`  | Snooze question              |
| POST   | `/api/learning/questions/:id/dismiss` | Permanently dismiss          |
| GET    | `/api/learning/digest`                | Get weekly digest content    |
| GET    | `/api/learning/stats`                 | Learning analytics           |

### Internal Services

| Service                       | Responsibility                        |
| ----------------------------- | ------------------------------------- |
| `LearningDetectorService`     | Observe events, generate questions    |
| `QuestionBacklogService`      | CRUD for questions, priority scoring  |
| `QuestionOrchestratorService` | Timing, throttling, channel selection |
| `AnswerInterpreterService`    | Process answers, update system state  |
| `MemoryReinforcementService`  | Staleness checks, promotion logic     |

---

## Deliverables

### Phase 10 Checklist

- [ ] **Data Layer**
  - [ ] OpenQuestion table and indices
  - [ ] LearningEvent table (audit trail)
  - [ ] Migrations applied

- [ ] **Core Services**
  - [ ] Learning Detector (pattern recognition)
  - [ ] Question Backlog (storage, prioritization)
  - [ ] Question Orchestrator (timing, throttling)
  - [ ] Answer Interpreter (response handling)
  - [ ] Memory Reinforcement Engine (promotion, decay)

- [ ] **API Routes**
  - [ ] Question retrieval and management
  - [ ] Answer submission
  - [ ] Snooze/dismiss actions
  - [ ] Weekly digest generation

- [ ] **Agent Integration**
  - [ ] Blocking question flow
  - [ ] Preference proposal tool
  - [ ] Resolution awaiting

- [ ] **UI Components**
  - [ ] In-chat question card
  - [ ] Weekly digest view
  - [ ] Settings for notification preferences
  - [ ] Question history/audit view

- [ ] **Digest System**
  - [ ] Email digest template
  - [ ] Scheduling (configurable frequency)
  - [ ] One-click responses

---

## Success Metrics

| Metric               | Target | Description                             |
| -------------------- | ------ | --------------------------------------- |
| Question answer rate | >60%   | % of asked questions that get answered  |
| Preference save rate | >50%   | % of proposals that become memories     |
| Snooze rate          | <20%   | Low indicates good timing               |
| Dismissal rate       | <15%   | Low indicates relevant questions        |
| Time to answer       | <2 min | For blocking questions                  |
| Memory accuracy      | >90%   | User-reported accuracy of saved prefs   |
| Questions per week   | 2-5    | Right balance of learning vs. annoyance |

---

## Configuration

### User Settings

| Setting              | Default | Description                    |
| -------------------- | ------- | ------------------------------ |
| `maxQuestionsPerDay` | 2       | Non-blocking question limit    |
| `digestFrequency`    | weekly  | weekly, biweekly, monthly, off |
| `digestChannel`      | email   | email, slack, in-app only      |
| `autoSnoozeHours`    | 24      | Delay for snoozed questions    |
| `staleDays`          | 90      | Memory staleness threshold     |

### System Settings

| Setting                | Value | Description                         |
| ---------------------- | ----- | ----------------------------------- |
| `minPriorityThreshold` | 30    | Don't ask below this score          |
| `patternThreshold`     | 3     | Consistent actions before proposing |
| `confidenceThreshold`  | 0.7   | Below this, consider asking         |
| `questionExpireDays`   | 30    | Auto-expire unanswered questions    |

---

## Future Enhancements (V2+)

- **Predictive Questions**: Ask before ambiguity occurs
- **Contextual Timing**: Ask when user is likely receptive (end of task, etc.)
- **Collaborative Learning**: Learn from household/team patterns
- **Question Clustering**: Group related questions intelligently
- **Learning Analytics Dashboard**: Show users how Theo has improved
- **Negative Learning**: Explicitly learn what NOT to do

---

## Why This Works

| Benefit                          | How                                        |
| -------------------------------- | ------------------------------------------ |
| Treats learning as collaboration | Questions, not extraction                  |
| Prevents silent assumptions      | Every preference is explicit               |
| Scales with integrations         | Each integration generates learning events |
| Respects user attention          | Throttling, prioritization, snoozing       |
| Keeps improving over time        | Continuous, not one-time onboarding        |

---

## Appendix: Question Type Examples

### Disambiguation

```json
{
  "type": "disambiguation",
  "prompt": "Which chicken breast did you mean?",
  "context": {
    "options": [
      { "id": "sku-001", "name": "Perdue Chicken Breast", "price": 8.99 },
      { "id": "sku-002", "name": "Organic Valley Chicken", "price": 12.99 }
    ],
    "intent": "add to grocery cart"
  }
}
```

### Preference Proposal

```json
{
  "type": "preference_proposal",
  "prompt": "Should I always use Kroger for your grocery orders?",
  "context": {
    "evidence": {
      "pattern": "last 5 orders were Kroger",
      "confidence": 0.85
    },
    "proposedMemory": {
      "domain": "shopping",
      "key": "preferred_store",
      "content": "Kroger"
    }
  }
}
```

### Reconfirm

```json
{
  "type": "reconfirm",
  "prompt": "Is your schedule still Mon-Fri, 9am-5pm?",
  "context": {
    "memoryItemId": "mem_abc123",
    "lastConfirmed": "2024-08-15",
    "daysStale": 95
  }
}
```
