# Theo Onboarding Funnel  
**Phased Implementation Design**

> Goal: Collect high‑leverage personal context using a progressive, trust‑building onboarding funnel that moves from **general → specific** and **important → non‑important**, while immediately delivering value.

---

## Core Principles

1. General → Specific  
2. Important → Nice‑to‑Have  
3. Ask only when value is obvious  
4. Everything is skippable  
5. Every question explains *why* it’s being asked  

---

## Phase 0 — Orientation (0–60 seconds)

**Goal:** Establish trust and expectations.

### Theo Explains
- What Theo can do today
- What Theo will *never* do without permission
- How memory works (explicit, editable, forgettable)

**Questions:** None  
**Storage:** None  

---

## Phase 1 — Life Shape (High Value, Low Sensitivity)

> “Help me understand the shape of your life.”

### Topics
- Work vs personal focus
- Household structure
- General busyness

### Example Questions
- “Do you mostly want help with **work**, **personal life**, or **both**?”
- “Do you live alone, with a partner, or with family?”
- “How busy are your weeks right now?”

### Storage
- Soft memory  
- Low confidence starter assumptions

---

## Phase 2 — Time & Commitments (Immediate ROI)

> “Let me protect your time first.”

### Topics
- Work hours
- Protected time
- Interruptibility rules

### Example Questions
- “What does a normal workday look like for you?”
- “Are evenings or weekends protected time?”
- “When should I interrupt you immediately vs wait?”

### Storage
- Hard memory (when explicit)
- Used immediately for reminders and scheduling

---

## Phase 3 — Work Context (Scoped, Not Creepy)

> “I don’t need your org chart — just how you work.”

### Topics
- Role type
- Primary communication channels
- Task preference style

### Example Questions
- “What kind of work do you do? (IC, manager, founder, student, etc.)”
- “Where do most work requests come from?”
- “Do you prefer short action lists or fewer big priorities?”

### Storage
- Soft memory  
- Drives email drafts, task summaries, nudges

---

## Phase 4 — People That Matter (Opt‑In, High Trust)

> “Who should I help you show up better for?”

### Topics
- Close relationships
- Communication cadence
- Important dates

### Example Questions
- “Are there a few people you’d like me to keep in mind?”
- “How often do you like to check in with them?”
- “Any upcoming events I should know about?”

### UX Safeguards
- Max 3–5 people
- Explicit consent per person

### Storage
- Soft memory initially  
- Can later be promoted to hard memory

---

## Phase 5 — Household & Logistics (Execution Power)

> “This is where I save you time.”

### Topics
- Meals
- Groceries
- Errands
- Shared responsibilities

### Example Questions
- “Do you usually cook at home, order out, or mix?”
- “Who do you usually plan meals for?”
- “Any dietary constraints or strong dislikes?”

### Immediate Wins
- Meal planning
- Grocery defaults
- Budget‑aware suggestions

### Storage
- Mostly hard memory

---

## Phase 6 — Near‑Term Priorities (Time‑Bound Context)

> “What’s important *right now*?”

### Topics
- Upcoming events
- Projects
- Stressors

### Example Questions
- “Is there anything big coming up in the next 1–3 months?”
- “Do you want lighter weeks, more structure, or more reminders right now?”

### Storage
- Soft memory with expiration
- Used to adjust tone and pacing

---

## Phase 7 — Preferences & Style (Low Importance, High Polish)

> “How do you like things done?”

### Topics
- Communication tone
- Autonomy level
- Explanation vs execution

### Example Questions
- “Do you want explanations or just results?”
- “Should I ask before acting, or default and let you correct me?”

### Storage
- Hard memory (when explicit)
- Drives assistant personality

---

## Funnel Summary

| Phase | Purpose | Sensitivity | Storage |
|------|--------|-------------|---------|
| 0 | Trust & framing | — | — |
| 1 | Life shape | Low | Soft |
| 2 | Time | Medium | Hard |
| 3 | Work | Medium | Soft |
| 4 | People | High | Soft → Hard |
| 5 | Logistics | Medium | Hard |
| 6 | Priorities | Medium | Soft (expiring) |
| 7 | Style | Low | Hard |

---

## UX Mechanics

### Progressive Asking
- Max **3 questions at a time**
- Interleave with value (“I’ll use this to…”)

### Skip & Defer
- “Skip for now”
- “Ask me later”
- Theo can re‑enter phases opportunistically

### Confirmation Pattern
> “Want me to save this as a preference?”

---

## Implementation Notes

- Each phase is a **state machine**
- Completion is fuzzy, not binary
- Phases can be revisited just‑in‑time
- All answers flow into the Memory System (hard vs soft)

---

## Why This Works

- Feels conversational, not interrogative
- Mirrors how humans build trust
- Seeds memory cleanly
- Avoids premature over‑personalization
