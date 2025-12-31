# Phase 10: Walmart Grocery Integration

> **Status**: Draft v0.1  
> **Duration**: Weeks 30-32  
> **Dependencies**: Phase 9 (Kroger/Grocery Patterns), Phase 5 (Agent Engine)

---

## Overview

Integrate Walmart grocery functionality via **browser automation** (Playwright) to enable Theo to assist with meal planning and cart building — while **never placing orders or handling checkout**.

Unlike Kroger (API-based), Walmart requires a web-based approach because they do not expose a public, stable API for cart operations.

> **See also**:
>
> - [Grocery Integration Contract](../ideas/[IDEA]%20-%20grocery-integration-contract.md) for universal constraints
> - [Walmart Grocery Integration](../ideas/[IDEA]%20-%20walmart-grocery-integration.md) for detailed design

---

## Core Product Principle

> **Theo builds the cart. The user places the order.**

The **terminal state** is always: `CART_READY_FOR_REVIEW`. This is treated as a **best-effort convenience**, not a guaranteed system of record.

### Architecture Note

This integration uses **browser automation** rather than API calls. Design with resilience in mind:

- UI selectors may change
- Session management is critical
- CAPTCHA/bot detection requires human intervention
- Implement robust observability for debugging

---

## Integration Type

| Property       | Value                                        |
| -------------- | -------------------------------------------- |
| Type           | `web_cart_builder`                           |
| Implementation | Headful browser automation (Playwright)      |
| Auth           | Cookie/session-based (user logs in manually) |
| Reliability    | Best-effort convenience                      |

---

## Goals

- Browser automation for Walmart cart operations
- URL-first product resolution (saved product links)
- Fallback on-site search
- Session management with encrypted cookie storage
- Store/ZIP context management
- Strict checkout guardrails
- CAPTCHA/intervention handling
- Meal planning and recipe integration (reuse Phase 7 patterns)

---

## Critical Constraints

### Explicitly Forbidden

Theo **must never**:

| Forbidden Action      | Enforcement         |
| --------------------- | ------------------- |
| Place an order        | Blocklist detection |
| Click "Checkout"      | Text detection      |
| Enter checkout flows  | URL path guard      |
| Select delivery times | Not in allowlist    |
| Handle payment        | Not in allowlist    |
| Substitute items      | Pause for user      |

### Allowlist Actions

The agent may **only** interact with:

- "Add to cart" buttons
- Quantity controls (dropdown/stepper)
- "Continue shopping" buttons
- Store selector / ZIP input
- Cart icon (view-only)
- Search box (for product lookup)

### Blocklist Detection

If any visible element contains these terms, **halt immediately**:

- "Checkout"
- "Continue to checkout"
- "Review order"
- "Place order"
- "Payment"

### URL Path Guard

If navigation enters these paths, **stop execution**:

- `/checkout`
- `/review-order`
- `/payment`
- `/order-confirmation`

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Meal Planning Layer                             │
│  (Shared with Kroger: Recipes → Ingredients → Shopping List)        │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Product Resolution Layer                           │
│  Saved URLs → Previously Confirmed → On-site Search (fallback)      │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Browser Automation Layer                           │
│                      Playwright Engine                               │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
┌──────────────────────┐ ┌──────────────┐ ┌──────────────────────┐
│  SessionManager      │ │ CartRunner   │ │   SafetyGuards       │
│  Login, cookies      │ │ Add to cart  │ │   Blocklist, URL     │
└──────────────────────┘ └──────────────┘ └──────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Cart Ready for Review                             │
│                    HANDOFF TO USER                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### State Machine

```
MEAL_PLAN_CREATED
      ↓
INGREDIENT_LIST_READY
      ↓
PRODUCTS_RESOLVED (URLs or search)
      ↓
CART_BUILD_IN_PROGRESS
      ↓
CART_READY_FOR_REVIEW  ← terminal (no transitions past this)
```

---

## Authentication Model

### First Run (Manual Login)

```
1. Launch headful Playwright browser
2. Navigate to walmart.com
3. Display login prompt to user
4. User enters credentials directly in browser
5. Theo never sees or stores credentials
6. After login, capture session cookies
7. Encrypt and store cookies for reuse
```

### Subsequent Runs

```
1. Load encrypted cookies
2. Inject into browser session
3. Verify session validity
4. If expired → prompt re-authentication
```

### Security Principles

| Principle             | Implementation               |
| --------------------- | ---------------------------- |
| No credential storage | User types directly          |
| Cookie encryption     | AES-256-GCM at rest          |
| Session expiry        | Check before each run        |
| Revocation            | User can clear saved session |

---

## Store & Fulfillment Context

Walmart's catalog and pricing vary by location and fulfillment mode.

### Context Requirements

| Field            | Required | Description                      |
| ---------------- | -------- | -------------------------------- |
| ZIP code         | Yes      | Determines store                 |
| Store            | Yes      | Selected store location          |
| Fulfillment mode | Yes      | `pickup`, `delivery`, `shipping` |

### Context Validation

Before each cart run:

1. Verify store context is set
2. Check fulfillment mode availability
3. If context missing or invalid → pause and ask user

---

## Product Resolution Strategy

### Priority Order

1. **User-saved product URLs** (most reliable)
2. **Previously confirmed items** (from past runs)
3. **On-site search fallback** (least reliable)

### URL-First Model (Recommended)

Each ingredient maps to a saved Walmart product URL:

```
ingredient: milk.whole
→ https://www.walmart.com/ip/Great-Value-Whole-Milk-1-Gallon/10450114
```

**Benefits:**

- Stable (URL-based, not selector-based)
- Predictable (known product)
- User-correctable (can update URL)
- Resilient to UI changes

### On-Site Search (Fallback)

When no saved URL exists:

1. Navigate to Walmart search
2. Enter normalized ingredient name
3. Parse search results
4. Apply ranking heuristics
5. If ambiguous → pause for user confirmation

---

## Data Model

### WalmartSession

Stores encrypted session data per user.

| Field            | Type     | Description                      |
| ---------------- | -------- | -------------------------------- |
| id               | string   | Unique identifier                |
| userId           | string   | FK to User                       |
| cookiesEncrypted | string   | AES-256-GCM encrypted cookies    |
| sessionExpiresAt | datetime | When session expires             |
| storeId          | string?  | Selected store                   |
| storeName        | string?  | Store display name               |
| storeAddress     | string?  | Store location                   |
| zipCode          | string?  | ZIP context                      |
| fulfillmentMode  | enum?    | `pickup`, `delivery`, `shipping` |
| lastValidatedAt  | datetime | Last session check               |
| isActive         | boolean  | Session usable                   |
| createdAt        | datetime |                                  |
| updatedAt        | datetime |                                  |

### SavedProductLink

User's saved product URLs for reliable resolution.

| Field              | Type     | Description                          |
| ------------------ | -------- | ------------------------------------ |
| id                 | string   | Unique identifier                    |
| userId             | string   | FK to User                           |
| ingredientKey      | string   | Normalized ingredient name           |
| walmartProductUrl  | string   | Full product URL                     |
| walmartProductId   | string?  | Extracted product ID                 |
| titleSnapshot      | string   | Product name at save time            |
| sizeSnapshot       | string?  | Package size                         |
| priceSnapshot      | decimal? | Price at save time                   |
| storeScope         | string?  | Store-specific if needed             |
| lastVerifiedAt     | datetime | Last confirmed working               |
| verificationStatus | enum     | `verified`, `changed`, `unavailable` |
| createdAt          | datetime |                                      |
| updatedAt          | datetime |                                      |

### WalmartCartRun

Tracks cart building operations.

| Field           | Type      | Description                               |
| --------------- | --------- | ----------------------------------------- |
| id              | string    | Unique identifier                         |
| userId          | string    | FK to User                                |
| shoppingListId  | string    | FK to ShoppingList                        |
| storeId         | string    | Target store                              |
| status          | enum      | `running`, `needs_user`, `done`, `failed` |
| addedItemsCount | int       | Successfully added                        |
| skippedItems    | json      | Items requiring action                    |
| haltReason      | string?   | Why stopped (captcha, checkout, etc.)     |
| evidence        | json      | Screenshots, logs, selectors              |
| startedAt       | datetime  | When started                              |
| completedAt     | datetime? | When finished                             |

### CartRunEvidence (embedded JSON)

| Field                   | Type    | Description                 |
| ----------------------- | ------- | --------------------------- |
| stepLogs                | array   | Step-by-step action log     |
| screenshots             | array   | Failure screenshots (paths) |
| domSnapshotHash         | string? | Hash for UI drift detection |
| lastSuccessfulSelectors | object  | Working selectors           |
| errorDetails            | object? | Error info if failed        |

---

## Core Services

### WalmartSessionManager

Manages browser sessions and authentication.

| Method                         | Description               |
| ------------------------------ | ------------------------- |
| `initSession(userId)`          | Start new browser session |
| `loadSession(userId)`          | Load existing session     |
| `validateSession(userId)`      | Check if session valid    |
| `promptReauth(userId)`         | Request user re-login     |
| `saveSession(userId, cookies)` | Encrypt and store cookies |
| `clearSession(userId)`         | Remove session data       |

### WalmartCartRunner

Executes cart building via browser automation.

| Method                                 | Description              |
| -------------------------------------- | ------------------------ |
| `startCartRun(shoppingListId)`         | Begin cart building      |
| `continueRun(runId, selections)`       | Resume after user input  |
| `addItem(productUrl, quantity)`        | Navigate and add to cart |
| `adjustQuantity(productUrl, quantity)` | Update item quantity     |
| `verifyCart()`                         | Scrape cart contents     |
| `generateHandoff()`                    | Create "Open Cart" link  |
| `halt(reason)`                         | Stop execution safely    |

### WalmartSafetyGuard

Enforces checkout prevention.

| Method                      | Description             |
| --------------------------- | ----------------------- |
| `isAllowedAction(element)`  | Check against allowlist |
| `containsBlockedText(page)` | Scan for checkout terms |
| `isBlockedUrl(url)`         | Check URL path          |
| `onNavigate(url, callback)` | URL change listener     |
| `emergencyHalt()`           | Immediate stop          |

### WalmartProductResolver

Maps ingredients to Walmart products.

| Method                                | Description              |
| ------------------------------------- | ------------------------ |
| `resolveByUrl(ingredientKey)`         | Look up saved URL        |
| `searchOnSite(query)`                 | Perform on-site search   |
| `parseSearchResults(page)`            | Extract product options  |
| `rankResults(products, prefs)`        | Apply preferences        |
| `saveProductLink(ingredientKey, url)` | Store for future         |
| `verifyLink(linkId)`                  | Check if URL still works |

---

## Browser Automation Patterns

### Selector Strategy

Use resilient selectors that survive UI changes:

| Priority | Selector Type   | Example                              |
| -------- | --------------- | ------------------------------------ |
| 1        | Data attributes | `[data-automation-id="add-to-cart"]` |
| 2        | ARIA roles      | `button[aria-label="Add to cart"]`   |
| 3        | Text content    | `button:has-text("Add to cart")`     |
| 4        | CSS class       | `.add-to-cart-btn` (least stable)    |

### Action Pattern

```
1. Wait for page load
2. Check safety guards (blocklist, URL)
3. Locate element with resilient selector
4. Verify element is actionable
5. Perform action (click, type)
6. Wait for response (cart update)
7. Capture evidence (screenshot on failure)
8. Log step result
```

### Error Recovery

| Error             | Recovery                |
| ----------------- | ----------------------- |
| Element not found | Try alternate selectors |
| Timeout           | Retry with backoff      |
| CAPTCHA           | Pause for user          |
| Session expired   | Prompt re-auth          |
| Checkout detected | Halt immediately        |
| Network error     | Retry with backoff      |

---

## Intervention Handling

### CAPTCHA Detection

If CAPTCHA appears:

1. Pause automation
2. Show browser window to user
3. Display message: "Please complete the CAPTCHA"
4. Wait for user to solve
5. Resume automation

### User Intervention Points

| Scenario                    | Action                    |
| --------------------------- | ------------------------- |
| Item out of stock           | Pause, show alternatives  |
| Multiple matches            | Pause, ask for selection  |
| Price changed significantly | Warn user, continue       |
| CAPTCHA                     | Pause for manual solve    |
| Session expired             | Prompt re-login           |
| Store mismatch              | Ask user to confirm store |

---

## API Routes

### Session Management

| Method | Path                                       | Description            |
| ------ | ------------------------------------------ | ---------------------- |
| POST   | `/api/integrations/walmart/session/start`  | Start login flow       |
| GET    | `/api/integrations/walmart/session/status` | Check session validity |
| DELETE | `/api/integrations/walmart/session`        | Clear session          |

### Store Context

| Method | Path                              | Description       |
| ------ | --------------------------------- | ----------------- |
| POST   | `/api/integrations/walmart/store` | Set store/ZIP     |
| GET    | `/api/integrations/walmart/store` | Get current store |

### Product Links

| Method | Path                                         | Description       |
| ------ | -------------------------------------------- | ----------------- |
| GET    | `/api/integrations/walmart/links`            | List saved links  |
| POST   | `/api/integrations/walmart/links`            | Save product link |
| DELETE | `/api/integrations/walmart/links/:id`        | Remove link       |
| POST   | `/api/integrations/walmart/links/:id/verify` | Verify link works |

### Cart Operations

| Method | Path                                                    | Description              |
| ------ | ------------------------------------------------------- | ------------------------ |
| POST   | `/api/integrations/walmart/cart/run`                    | Start cart run           |
| GET    | `/api/integrations/walmart/cart/run/:id`                | Get run status           |
| POST   | `/api/integrations/walmart/cart/run/:id/continue`       | Continue with selections |
| POST   | `/api/integrations/walmart/cart/run/:id/captcha-solved` | Resume after CAPTCHA     |
| GET    | `/api/integrations/walmart/cart/run/:id/summary`        | Get final summary        |

---

## Agent Integration

### Agent Tools

| Tool                      | Description                     |
| ------------------------- | ------------------------------- |
| `search_walmart_products` | Search on Walmart site          |
| `save_walmart_link`       | Save product URL for ingredient |
| `build_walmart_cart`      | Add items to Walmart cart       |
| `get_walmart_cart_status` | Check cart run progress         |
| `verify_walmart_session`  | Check if logged in              |

### Context Enrichment

Walmart data enriches agent context:

- **Saved Product Links**: Which ingredients have known products
- **Session Status**: Whether automation is possible
- **Store Context**: Current store and fulfillment mode
- **Recent Runs**: Past cart building history

### Example Prompt Injection

```
### Walmart Context

**Session**: Active (expires in 2 hours)
**Store**: Walmart #1234 (Main St, ZIP 12345)
**Fulfillment**: Pickup

**Saved Product Links**: 45 ingredients mapped
**Unmapped Ingredients**: 3 (will use search)

**Last Cart Run**: Yesterday, 12 items added successfully
```

---

## Observability & Debugging

### Evidence Capture

For each cart run, capture:

| Evidence Type     | Purpose             |
| ----------------- | ------------------- |
| Step logs         | Trace actions taken |
| Screenshots       | Debug failures      |
| DOM snapshot hash | Detect UI changes   |
| Selector versions | Track what worked   |
| Network logs      | API calls made      |

### UI Drift Detection

Monitor for Walmart UI changes:

- Hash DOM structure periodically
- Alert if selectors fail consistently
- Maintain selector version history
- Flag when manual selector update needed

---

## Cart Handoff Flow

At completion, Theo presents:

```
┌─────────────────────────────────────────────────────────┐
│ 🛒 Your Walmart Cart is Ready                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Meals Planned: 4 dinners                                │
│                                                         │
│ Items Added: 14                                         │
│ - Great Value Whole Milk (1 gal)          $3.48        │
│ - Boneless Chicken Breast (2 lb)          $7.94        │
│ - ... (12 more items)                                  │
│                                                         │
│ Items Needing Attention: 1                              │
│ - Fresh basil: out of stock at this store              │
│                                                         │
│ Estimated Total: ~$58.00 (verify in cart)              │
│                                                         │
│ Store: Walmart #1234 (Main St)                         │
│ Mode: Pickup                                           │
│                                                         │
│     [ Open Walmart Cart → ]                             │
│                                                         │
│ ⚠️ Cart totals are approximate until checkout.          │
└─────────────────────────────────────────────────────────┘
```

**Terminal state**: User must complete checkout on Walmart.

---

## Known Limitations

Surface these clearly to users:

| Limitation                       | Mitigation                  |
| -------------------------------- | --------------------------- |
| Subject to Walmart UI changes    | Selector versioning, alerts |
| CAPTCHA may require intervention | Pause and prompt user       |
| Items vary by store/region       | Verify store context        |
| Cart totals approximate          | Note in handoff             |
| Session may expire               | Check before each run       |
| No official API                  | Best-effort, not guaranteed |

---

## Deliverables

### Phase 11 Checklist

- [ ] **Session Management**
  - [ ] Headful Playwright browser launch
  - [ ] Manual login flow (no credential storage)
  - [ ] Cookie encryption and storage
  - [ ] Session validation
  - [ ] Re-auth prompting

- [ ] **Safety Guards**
  - [ ] Allowlist action enforcement
  - [ ] Blocklist text detection
  - [ ] URL path guards
  - [ ] Emergency halt mechanism
  - [ ] Checkout prevention verified

- [ ] **Database**
  - [ ] WalmartSession table
  - [ ] SavedProductLink table
  - [ ] WalmartCartRun table
  - [ ] Migrations applied

- [ ] **Cart Runner**
  - [ ] Navigate to product URLs
  - [ ] Add items to cart
  - [ ] Quantity adjustment
  - [ ] Cart verification (best-effort)
  - [ ] Handoff link generation

- [ ] **Product Resolution**
  - [ ] URL-first lookup
  - [ ] On-site search fallback
  - [ ] Result parsing
  - [ ] Link verification

- [ ] **Intervention Handling**
  - [ ] CAPTCHA detection and pause
  - [ ] Out of stock handling
  - [ ] Multiple match disambiguation
  - [ ] Session expiry prompts

- [ ] **Observability**
  - [ ] Step logging
  - [ ] Failure screenshots
  - [ ] DOM hash tracking
  - [ ] Selector versioning

- [ ] **Agent Integration**
  - [ ] Search tool
  - [ ] Link saving tool
  - [ ] Cart building tool
  - [ ] Status checking tool

- [ ] **API Routes**
  - [ ] Session management endpoints
  - [ ] Store context endpoints
  - [ ] Product link endpoints
  - [ ] Cart operation endpoints

---

## Success Metrics

| Metric                  | Target   | Description                 |
| ----------------------- | -------- | --------------------------- |
| Session success rate    | >90%     | Sessions that stay valid    |
| Cart build success      | >80%     | Runs that complete          |
| URL resolution rate     | >95%     | Saved links that work       |
| Search fallback success | >60%     | Successful on-site searches |
| CAPTCHA frequency       | <10%     | Runs requiring CAPTCHA      |
| UI drift incidents      | <2/month | Selector failures           |

---

## Future Enhancements (V2+)

- **Smarter search heuristics**: Better on-site product matching
- **Price tracking**: Alert on price changes
- **Availability alerts**: Notify when saved items available
- **Multi-store comparison**: Find best prices
- **Browser extension**: Easier product link capture
- **Visual confirmation**: Highlight added items in screenshot
- **Headless mode**: Run without visible browser (after stable)
- **Instacart integration**: Alternative with API access

---

## Comparison: Kroger vs Walmart

| Aspect             | Kroger (Phase 7)    | Walmart (Phase 11)      |
| ------------------ | ------------------- | ----------------------- |
| Integration type   | API-based           | Browser automation      |
| Authentication     | OAuth               | Cookie/session          |
| Reliability        | High (official API) | Best-effort             |
| Rate limits        | 10,000/day          | Browser throttling      |
| Product resolution | API search + cache  | URL-first + search      |
| Cart operations    | Direct API calls    | Button clicks           |
| Maintenance        | Stable              | Selector updates needed |
| CAPTCHA risk       | None                | Possible                |

---

## Appendix: Examples

### Saved Product Link

```json
{
  "id": "link_abc123",
  "userId": "user_123",
  "ingredientKey": "milk.whole",
  "walmartProductUrl": "https://www.walmart.com/ip/Great-Value-Whole-Milk-1-Gallon/10450114",
  "walmartProductId": "10450114",
  "titleSnapshot": "Great Value Whole Milk, 1 Gallon",
  "sizeSnapshot": "1 gal",
  "priceSnapshot": 3.48,
  "lastVerifiedAt": "2025-12-20T10:00:00Z",
  "verificationStatus": "verified"
}
```

### Cart Run Evidence

```json
{
  "stepLogs": [
    {
      "step": 1,
      "action": "navigate",
      "url": "https://walmart.com/ip/...",
      "success": true
    },
    {
      "step": 2,
      "action": "click",
      "selector": "[data-automation-id='add-to-cart']",
      "success": true
    },
    {
      "step": 3,
      "action": "wait",
      "condition": "cart-updated",
      "success": true
    }
  ],
  "screenshots": [],
  "domSnapshotHash": "abc123def456",
  "lastSuccessfulSelectors": {
    "addToCart": "[data-automation-id='add-to-cart']",
    "quantity": "[data-automation-id='quantity-stepper']"
  }
}
```

### Cart Run Summary

```json
{
  "id": "run_xyz789",
  "status": "done",
  "addedItemsCount": 14,
  "skippedItems": [
    {
      "ingredientName": "fresh basil",
      "reason": "out_of_stock",
      "alternatives": []
    }
  ],
  "estimatedTotal": 58.0,
  "handoffUrl": "https://www.walmart.com/cart"
}
```
