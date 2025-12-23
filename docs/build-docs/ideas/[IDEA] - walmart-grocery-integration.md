# Walmart Grocery Integration  
**Web Cart Builder (Browser-as-API)**

> **Status:** V1 Design  
> **Extends:** `grocery-integration-contract.md`

This document defines the **Walmart-specific implementation** of the Grocery Integration Contract using **browser automation**.  
All constraints and guardrails from the base contract apply **without exception**.

---

## Purpose

Enable Theo to:
- Plan meals
- Generate recipes
- Normalize ingredients
- Add corresponding items to a **Walmart cart**

While **never**:
- Placing an order
- Entering checkout
- Selecting delivery/pickup times
- Handling payment, substitutions, or confirmations

The **terminal state** is always:  
> **Cart built and ready for user review**

---

## Why Walmart Requires a Web-Based Approach

- Walmart does **not** expose a public, stable API for cart operations
- Cart functionality is gated behind authenticated user sessions
- Therefore, Walmart integration is implemented as:
  > **Browser automation acting as the integration surface**

This is treated as a **best-effort convenience**, not a guaranteed system of record.

---

## Integration Type

**Type:** `web_cart_builder`  
**Implementation:** Headful browser automation (Playwright)

---

## Supported Capabilities

Inherited from the base contract, plus Walmart-specific notes:

| Capability | Supported | Notes |
|----------|----------|------|
| Product lookup | ✅ | Via saved URLs or on-site search |
| Add to cart | ✅ | Button-based interaction only |
| Set quantity | ✅ | Quantity dropdown / stepper |
| Cart summary | ⚠️ | Best-effort scrape |
| Checkout | ❌ | Explicitly blocked |

---

## High-Level Flow

```
Meal Plan
  ↓
Recipes Selected / Generated
  ↓
Ingredients Normalized
  ↓
Products Resolved (URL or search)
  ↓
Walmart Cart Build Run
  ↓
Cart Ready for Review  ← terminal
```

---

## Product Resolution Strategy

### Priority Order

1. **User-saved product URLs** (most reliable)
2. Previously confirmed Walmart items
3. On-site search fallback (least reliable)

### URL-First Model (Recommended V1)
Each canonical ingredient may map to a saved Walmart product URL:

Example:
```
ingredient: milk.whole
→ https://www.walmart.com/ip/Great-Value-Whole-Milk-1-Gallon/...
```

Benefits:
- Stable
- Predictable
- User-correctable
- Resilient to UI changes

---

## Cart Runner Architecture

### Component: `walmart_cart_runner`

**Responsibilities**
- Ensure authenticated Walmart session
- Set correct store / ZIP context
- Visit product pages
- Click “Add to cart”
- Adjust quantities
- Validate cart contents
- Stop and hand off to user

---

## Authentication Model

### First Run
- User logs in manually in a real browser window
- Theo never sees or stores credentials

### Ongoing Runs
- Encrypted cookies / session storage reused
- Expired sessions trigger re-auth request

---

## Store & Fulfillment Context

Theo must:
- Set or verify ZIP/store context before adding items
- Respect the user’s preferred fulfillment mode:
  - Pickup
  - Delivery
  - Shipping

If fulfillment context is unclear or unavailable:
- Pause and ask the user

---

## Guardrails: No-Checkout Enforcement

### 1. Allowlist Actions
The agent may only click:
- “Add to cart”
- Quantity controls
- “Continue shopping”
- Store selector / ZIP input
- Cart icon (view-only)

---

### 2. Blocklist Text Detection
If any visible element contains:
- “Checkout”
- “Continue to checkout”
- “Review order”
- “Place order”
- “Payment”

The agent must **halt immediately** and notify the user.

---

### 3. URL Path Guard
If navigation enters paths such as:
- `/checkout`
- `/review-order`
- `/payment`

Execution must stop instantly.

---

## Error & Intervention Handling

Theo must pause and ask the user if:

- Item is out of stock
- Multiple product matches are plausible
- Price deviates materially from expectations
- CAPTCHA or bot challenge appears
- Store mismatch blocks availability

Theo must **never** auto-substitute items.

---

## Cart Summary & Handoff

At completion, Theo must present:

- Meals planned
- Items added (with quantities)
- Items skipped or needing confirmation
- Optional estimated total
- A clear **“Open Walmart Cart”** action

No further automation occurs beyond this point.

---

## Observability & Debugging

Each cart run should capture:
- Step-by-step logs
- Screenshots on failure
- DOM snapshot hash (to detect UI drift)
- Last successful selector set

---

## Data Model (Walmart-Specific)

### `saved_product_links`
- `ingredient_key`
- `walmart_product_url`
- `title_snapshot`
- `size_snapshot`
- `last_verified_at`
- `store_scope` (optional)

---

### `cart_runs`
- `id`
- `shopping_list_id`
- `status` (`RUNNING|NEEDS_USER|DONE|FAILED`)
- `added_items_count`
- `skipped_items[]`
- `evidence` (screenshots, logs)

---

## Known Limitations (Explicit)

- Subject to Walmart UI changes
- CAPTCHA may require manual intervention
- Some items vary by store/region
- Cart totals are approximate until user review

These are surfaced clearly to the user to preserve trust.

---

## Why This Works

- Preserves user control
- Avoids checkout risk entirely
- Maximizes value where users feel pain (cart building)
- Cleanly extends the Grocery Integration Contract

---

## Future Enhancements (Non-V1)

- Smarter on-site search heuristics
- Price/unit optimization
- “Preferred Walmart item” suggestions
- Regional availability awareness
- Visual confirmation (highlight added items)

---

## Summary

The Walmart Grocery Integration:
- Treats the browser as the API
- Obeys strict no-checkout constraints
- Ends at cart review, every time
- Is transparent, reversible, and user-controlled

This makes it safe to ship — even with aggressive automation.
