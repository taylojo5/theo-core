# Kroger Grocery Integration  
**API-Based Cart Builder**

> **Status:** V1 Design  
> **Extends:** `grocery-integration-contract.md`

This document defines the **Kroger-specific implementation** of the Grocery Integration Contract using **Kroger’s APIs** (and partner/OAuth patterns as applicable).  
All constraints and guardrails from the base contract apply **without exception**.

---

## Purpose

Enable Theo to:
- Plan meals
- Generate recipes
- Normalize ingredients
- Resolve products in Kroger’s catalog
- Add items to a **Kroger cart**

While **never**:
- Placing an order
- Entering checkout
- Selecting pickup/delivery time slots
- Handling payment, substitutions, or confirmations

Terminal state is always:
> **Cart built and ready for user review**

---

## Integration Type

**Type:** `api_cart_builder`  
**Auth:** OAuth (user-consented)

---

## Supported Capabilities

| Capability | Supported | Notes |
|----------|----------|------|
| Product search | ✅ | Keyword + filters |
| Product details | ✅ | Price, size, availability (store-scoped) |
| Add to cart | ✅ | By product/variant identifiers |
| Set quantity | ✅ | Quantity updates supported |
| Cart summary | ✅ | Reliable via API |
| Checkout | ❌ | Explicitly not implemented |

---

## High-Level Flow

```
Meal Plan
  ↓
Recipes Selected / Generated
  ↓
Ingredients Normalized
  ↓
Kroger Product Resolution (search + preferences)
  ↓
Cart Build via API
  ↓
Cart Ready for Review  ← terminal
```

---

## Authentication & Consent Model

### User Experience
- User connects Kroger account via OAuth
- Theo requests only scopes required for:
  - product browsing
  - cart creation/modification

### Security Constraints
- Theo never handles passwords
- Access tokens stored encrypted
- Refresh tokens stored encrypted (if applicable)
- User can revoke access at any time

---

## Store & Fulfillment Context

Kroger’s catalog and pricing are typically **store-scoped**.

Theo must:
- Determine the user’s default store (or ask during onboarding)
- Persist:
  - `store_id`
  - optional `fulfillment_mode` (pickup/delivery)
- Re-validate store context during cart runs

If store context is missing:
- Pause and ask user to select a store

---

## Product Resolution Strategy

### Priority Order
1. **Previously confirmed Kroger items** (best)
2. User preferences (brand, organic, size) applied to search
3. Heuristic search match (fallback)

### Matching Heuristics (V1)
When resolving an ingredient to a Kroger product, prioritize:
- Exact ingredient match in title (e.g., “yellow onion”)
- Category alignment (produce vs pantry)
- Size constraints (e.g., 16 oz, 1 lb, 1 gal)
- Lowest ambiguity (single dominant match)

**Ambiguity triggers user confirmation**, e.g.:
- “Boneless skinless chicken breast” vs “thighs”
- “Shredded cheddar” multiple sizes/brands

---

## Cart Build Run (API)

### Component: `kroger_cart_builder`

**Responsibilities**
- Ensure valid OAuth access token
- Ensure store context exists
- Create or reuse a cart (implementation choice)
- Add items with quantities
- Validate final cart summary
- Stop and hand off to user

---

## Hard No-Checkout Guardrails

Even though an API might expose order endpoints, Theo must not use them.

### Explicitly excluded endpoints/actions
- checkout initiation
- time slot selection
- order submission / placement
- payment methods / tips / coupons
- substitution rules / preferences

**Implementation:** do not include these capabilities in the adapter interface at all.

---

## Error & Intervention Handling

Theo must pause and ask the user if:
- Item is out of stock
- API reports limited availability
- Multiple products match with similar confidence
- Price deviates materially from expectation
- Store context conflicts with item availability

Theo must never silently substitute items.

---

## Cart Summary & Handoff

At completion, Theo presents:
- Meals planned
- Items added (with quantities)
- Items skipped or requiring confirmation
- Estimated total (from API if available)
- A clear **“Open Kroger Cart”** link/action

Terminal state:
> `CART_READY_FOR_REVIEW`

---

## Observability & Debugging

For each cart run, capture:
- Request IDs (if provided)
- Step logs (search → match → add → verify)
- Resolution decisions (why each item was chosen)
- Any errors returned by the API

---

## Data Model (Kroger-Specific)

### `kroger_connection`
- `user_id`
- `access_token_encrypted`
- `refresh_token_encrypted` (optional)
- `token_expires_at`
- `scopes[]`

### `preferred_products`
- `ingredient_key`
- `kroger_product_id` (and variant/UPC if needed)
- `title_snapshot`
- `size_snapshot`
- `last_verified_at`
- `store_scope` (optional)

### `cart_runs`
- `id`
- `shopping_list_id`
- `status` (`RUNNING|NEEDS_USER|DONE|FAILED`)
- `added_items_count`
- `skipped_items[]`
- `evidence` (logs, api request ids)

---

## Known Limitations

- Pricing and availability depend on store and fulfillment mode
- Some ingredients require human selection (e.g., “fresh basil” bunch size variance)
- Promotions/coupons are not applied automatically (by design)

---

## Future Enhancements (Non-V1)

- Smarter ranking using historical purchases
- “Best value” selection (price/unit)
- Pantry inference (optional)
- Multi-store strategies (split list across stores)
- Budget-aware cart optimization

---

## Summary

The Kroger Grocery Integration:
- Uses OAuth + API-based cart operations
- Provides reliable cart building and cart summaries
- Preserves strict user control by ending at cart review
- Cleanly extends the Grocery Integration Contract
