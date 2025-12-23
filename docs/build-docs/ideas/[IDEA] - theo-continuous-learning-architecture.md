# Theo Continuous Learning & Preference Reinforcement  
**Architecture Overview**

> **Purpose**  
Enable Theo to continually learn, refine, and reconfirm user preferences over time through explicit, respectful feedback loops — without treating onboarding as a one-time event.

Onboarding never ends. It simply becomes quieter, more contextual, and more valuable.

---

## Core Concept

Theo learns through **Open Questions** — small, well-timed prompts that clarify ambiguity, confirm preferences, and reinforce memory.

An **Open Question** represents:
- something Theo needs to know to act better
- something Theo is unsure about
- something that may no longer be true

---

## Guiding Principles

1. Learning is **continuous**, not front-loaded  
2. User attention is scarce — ask only what matters  
3. Every question has a **clear payoff**  
4. Memory is explicit, inspectable, and reversible  
5. Theo never silently “assumes” preferences  

---

## Key Entities & Components

---

## 1. OpenQuestion (First-Class Entity)

An `OpenQuestion` is a pending clarification or confirmation that Theo wants answered.

### Characteristics
- Created automatically by system behavior
- Resolved explicitly by the user
- Always skippable, snoozable, or dismissible

### Sources
- Onboarding phases
- Ambiguous decisions (e.g. grocery item match)
- Repeated overrides or corrections
- Pattern detection (consistent choices)
- Stale or decaying memory items
- Integration failures or friction points

---

## 2. Learning Detector

Continuously observes system behavior to identify learning opportunities.

### Inputs
- User edits, overrides, rejections
- Acceptance or dismissal of suggestions
- Confidence scores from decision-making
- Frequency of repeated choices
- Memory age / staleness
- Integration errors (out-of-stock, ambiguity)

### Outputs
- New `OpenQuestion`
- Memory proposal
- Reconfirmation request

---

## 3. Question Backlog

A persistent backlog of unresolved Open Questions.

> Theo should maintain a backlog and **spend user attention carefully**, not ask everything immediately.

### Responsibilities
- Store all open questions
- Track status and resolution
- Support prioritization and throttling

---

## 4. Question Orchestrator

Controls **when**, **where**, and **how often** Theo asks questions.

### Timing Rules
- Ask immediately only if blocking progress
- Otherwise defer to low-friction moments
- Batch non-urgent questions when possible

### Throttling Rules
- Max 1 non-urgent question per session
- Max 1–2 per day unless user opts in
- Respect “snooze” and “ask later”

### Channels
- In-chat (default)
- Email digest
- Slack DM
- Push notification (future)

---

## 5. Answer Interpreter

Converts user responses into concrete system updates.

### Possible Outcomes
- Create or update hard memory
- Create or update soft memory
- Save product mappings (ingredient → SKU/URL)
- Update confidence levels
- Permanently dismiss a question

---

## 6. Memory Reinforcement Engine

Keeps memory accurate over time through **promotion** and **decay**.

### Promotion
- Soft → Hard only after:
  - explicit confirmation, or
  - repeated acceptance + confirmation prompt

### Decay
- Hard memory becomes stale after time or behavior drift
- Triggers reconfirmation Open Questions

---

## Core Data Models (Conceptual)

---

### `open_questions`

- `id`
- `type`
  - `disambiguation`
  - `preference_proposal`
  - `reconfirm`
  - `missing_context`
- `domain` (food, schedule, shopping, comms, etc.)
- `prompt` (user-facing)
- `context` (JSON: evidence, options, defaults)
- `priority` (0–100)
- `urgency`
  - `blocking`
  - `non_blocking`
- `status`
  - `open`
  - `asked`
  - `snoozed`
  - `answered`
  - `dismissed`
  - `expired`
- `created_at`
- `asked_at`
- `answered_at`
- `expires_at` (optional)
- `source_event_id`
- `memory_item_id` (optional)

---

### `learning_events` (Audit Trail)

- `id`
- `event_type`
  - `override`
  - `reject`
  - `accept`
  - `skip`
  - `pattern_detected`
  - `stale_memory`
- `domain`
- `payload` (JSON)
- `created_at`

---

## Core Learning Flows

---

## Flow A: Blocking Disambiguation (Immediate)

**Example:** Grocery item ambiguity.

1. Theo attempts to resolve an ingredient
2. Multiple products score similarly
3. Create `OpenQuestion`:
   - type: `disambiguation`
   - urgency: `blocking`
4. Orchestrator asks immediately
5. Answer:
   - resolves current action
   - optionally proposes a saved preference

---

## Flow B: Post-Action Learning (Deferred)

**Example:** Email tone preferences.

1. Theo drafts an email
2. User consistently edits tone
3. Learning Detector identifies pattern
4. Create `preference_proposal`
5. Orchestrator asks later (end of session or digest)
6. User confirms → memory updated

---

## Flow C: Reconfirmation of Stale Memory

**Example:** Shopping preference last confirmed months ago.

1. Memory decay process flags stale item
2. Create `reconfirm` OpenQuestion
3. Included in weekly check-in
4. User confirms or edits preference

---

## Flow D: Weekly “Theo Check-in”

A low-friction summary designed to avoid annoyance.

**Characteristics**
- 1–3 high-value questions
- Mix of reconfirmations and proposals
- Fully skippable

---

## Prioritization Model

Each OpenQuestion is scored by:

- Value (time saved, errors prevented)
- Frequency of occurrence
- Confidence gap
- Temporal relevance
- User annoyance budget

Only the highest-value questions are surfaced.

---

## UX Patterns

### Micro-Confirmation
> “Save this as a preference?”  
**Yes / No / Edit**

### Snooze
> “Ask me later” → reappear in X days

### Permanent Dismissal
> “Don’t ask again” → creates implicit preference

### Evidence-Based Prompting
> “You chose this option 6 of the last 7 times. Make it your default?”

---

## Integration with Memory System

- Answers flow directly into Hard or Soft Memory
- OpenQuestions may reference existing memory items
- Memory retrieval may generate new OpenQuestions when context is missing

---

## Why This Architecture Works

- Treats learning as collaboration, not extraction
- Prevents silent or incorrect assumptions
- Scales naturally as integrations grow
- Respects user attention and trust
- Keeps Theo improving without becoming intrusive

---

## Summary

Theo’s continuous learning system:
- Uses Open Questions as a universal learning primitive
- Learns gradually, explicitly, and respectfully
- Reinforces memory through confirmation, not inference
- Makes onboarding an ongoing, low-friction process
