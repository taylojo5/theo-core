# Grocery Integration Contract  
**Function, Constraints, and Trust Boundaries**

> **Purpose**  
Define a safe, user-controlled contract for grocery integrations that enables Theo to plan meals and build carts while **never taking ownership of purchasing or checkout actions**.

This document applies to **all grocery integrations**, regardless of implementation (API-based or browser automation).

---

## Core Product Principle

> **Theo builds the cart.  
The user places the order.**

Theo may assist with *planning and preparation*, but **all order-finalizing actions remain under explicit user control**.

---

## Allowed Capabilities (Universal)

Theo **may** perform the following actions for any grocery integration:

### 1. Meal Planning
- Generate weekly meal plans
- Adjust plans based on:
  - calendar load
  - household size
  - dietary constraints
  - budget targets
- Modify plans interactively

---

### 2. Recipe Selection & Generation
- Select known recipes or generate new ones
- Scale recipes by servings
- Identify required ingredients
- Distinguish:
  - “pantry assumed”
  - “must purchase”

---

### 3. Ingredient Normalization
Theo may:
- Normalize ingredient names (e.g. “yellow onion”)
- Convert units (cups → ounces, etc.)
- Deduplicate across recipes
- Categorize items (produce, dairy, pantry, frozen)
- Apply user preferences:
  - organic
  - brand preferences
  - size preferences

This step produces a **canonical ingredient list**, independent of retailer.

---

### 4. Product Resolution
Theo may:
- Map ingredients → store-specific products
- Prefer:
  - user-saved product links
  - previously confirmed items
- Fall back to:
  - search-based matching
  - heuristic selection (size, price/unit)

**Ambiguity must trigger user confirmation.**

---

### 5. Cart Construction
Theo may:
- Add items to a grocery cart
- Set quantities
- Remove items (with explanation)
- Validate cart contents

Theo must stop once the cart is fully built.

---

### 6. Cart Review Handoff
Theo must:
- Present a summary of:
  - meals planned
  - items added
  - estimated cost (if available)
  - skipped or ambiguous items
- Provide a clear **“Review Cart”** handoff to the user

This is the **terminal state** for all grocery integrations.

---

## Explicitly Forbidden Capabilities

Theo **must never**:

- Place an order
- Select pickup or delivery time slots
- Choose substitutions
- Apply payment methods, coupons, or tips
- Confirm or submit an order
- Click or navigate through checkout flows
- Modify orders after user checkout has begun

These actions are **out of scope by design**, not by policy preference.

---

## Trust & Safety Constraints

### User-in-Control Model
- All purchasing authority remains with the user
- Theo cannot finalize or commit funds
- Theo cannot act without visibility

### Transparency
Theo must always be able to answer:
> “Why did you add this item?”

Each cart action should be traceable to:
- a recipe
- a preference
- or a user confirmation

---

## Integration Capability Levels

Different grocers may support different technical depths.

| Capability | API-Based | Web Automation |
|-----------|----------|----------------|
| Product lookup | ✅ | ✅ |
| Add to cart | ✅ | ✅ |
| Cart summary | ✅ | ⚠️ best-effort |
| Checkout | ❌ | ❌ |

**Checkout is never supported**, regardless of capability.

---

## Canonical States (State Machine)

```
MEAL_PLAN_CREATED
  ↓
INGREDIENT_LIST_READY
  ↓
PRODUCTS_RESOLVED
  ↓
CART_BUILD_IN_PROGRESS
  ↓
CART_READY_FOR_REVIEW  ← terminal
```

No grocery integration may transition past `CART_READY_FOR_REVIEW`.

---

## Error Handling Rules

Theo must pause and ask the user if:
- an item is unavailable
- multiple products are plausible
- price deviates significantly
- store or fulfillment context is unclear

Theo may never silently substitute items.

---

## Data Ownership & Persistence

Theo may store:
- ingredient preferences
- product mappings
- historical cart builds

Theo must not store:
- payment credentials
- checkout confirmations
- order placement artifacts

---

## UX Commitments

- Users can always:
  - remove items
  - override selections
  - switch stores
- All grocery actions are reversible
- Grocery integrations are **assistive**, not autonomous

---

## Why This Contract Exists

This contract:
- Prevents accidental purchases
- Reduces legal and trust risk
- Keeps integrations reliable across retailers
- Allows aggressive automation *without* loss of user control

---

## Extension Model

Retailer-specific integrations (e.g. Walmart, Kroger) must:
- Inherit all constraints in this document
- Add only implementation-specific details
- Never weaken checkout or purchasing guardrails
