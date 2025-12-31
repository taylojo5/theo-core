# Phase 9: Kroger Grocery Integration

> **Status**: Draft v0.1  
> **Duration**: Weeks 27-29  
> **Dependencies**: Phase 5 (Agent Engine), Phase 6 (Memory System)

---

## Overview

Integrate Kroger's API to enable Theo to assist with meal planning, recipe management, and grocery cart building — while **never placing orders or handling checkout**.

> **See also**:
>
> - [Grocery Integration Contract](../ideas/[IDEA]%20-%20grocery-integration-contract.md) for universal constraints
> - [Kroger Grocery Integration](../ideas/[IDEA]%20-%20kroger-grocery-integration.md) for detailed design

---

## Core Product Principle

> **Theo builds the cart. The user places the order.**

Theo may assist with planning and preparation, but **all order-finalizing actions remain under explicit user control**. The terminal state is always: `CART_READY_FOR_REVIEW`.

### Architecture Note

Design this integration as a **self-contained module** with clear boundaries to enable extraction to a standalone microservice. The patterns established here should be reusable for other grocery providers (Walmart, Instacart, etc.).

---

## Goals

- Kroger OAuth authentication
- Product search with aggressive local caching
- DB-first product lookups (10,000 API calls/day limit)
- Recipe and meal planning context
- User preference management (brands, dietary restrictions)
- Shopping list generation from recipes
- Cart building via Kroger API
- **Strict no-checkout guardrails**

---

## Critical Constraints

### Explicitly Forbidden

Theo **must never**:

| Forbidden Action             | Reason               |
| ---------------------------- | -------------------- |
| Place an order               | User control         |
| Select pickup/delivery slots | User decision        |
| Apply payment methods        | Security             |
| Apply coupons/tips           | User control         |
| Submit checkout              | Purchasing authority |
| Silently substitute items    | Transparency         |

### Rate Limit Constraint

> **Kroger API limit: 10,000 calls/day**

Implement aggressive caching:

- Store product data with 7-30 day TTL
- Always check local DB before API calls
- Cache search results by query
- Batch API requests where possible

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Meal Planning Layer                             │
│  Recipes → Ingredients → Normalized Shopping List                   │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Product Resolution Layer                        │
│  Ingredient → Product Match (preferences + cache + API)             │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
┌──────────────────────┐ ┌──────────────┐ ┌──────────────────────┐
│   KrogerProductCache │ │ KrogerClient │ │  UserPreferences     │
│   DB-first lookups   │ │  API wrapper │ │  Brands, dietary     │
└──────────────────────┘ └──────────────┘ └──────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Cart Building Layer                             │
│  Add items → Validate → Summary → HANDOFF TO USER                   │
└─────────────────────────────────────────────────────────────────────┘
```

### State Machine

```
MEAL_PLAN_CREATED
      ↓
INGREDIENT_LIST_READY
      ↓
PRODUCTS_RESOLVED
      ↓
CART_BUILD_IN_PROGRESS
      ↓
CART_READY_FOR_REVIEW  ← terminal (no transitions past this)
```

---

## OAuth Configuration

### Required Scopes

| Scope              | Purpose                    |
| ------------------ | -------------------------- |
| `product.compact`  | Product search and details |
| `cart.basic:write` | Add/remove cart items      |

### OAuth Flow

```
1. User clicks "Connect Kroger"
2. Redirect to Kroger OAuth
3. User approves in Kroger
4. Kroger redirects with code
5. Exchange code for access token
6. Store encrypted tokens
7. Prompt user to select store location
```

### Store Context

Kroger's catalog and pricing are **store-scoped**. Theo must:

- Determine user's default store during onboarding
- Persist `store_id` and optional `fulfillment_mode`
- Re-validate store context during cart runs
- Pause and ask if store context is missing

---

## Data Model

### KrogerConnection

Stores OAuth credentials per user.

| Field           | Type     | Description             |
| --------------- | -------- | ----------------------- |
| id              | string   | Unique identifier       |
| userId          | string   | FK to User              |
| accessToken     | string   | Encrypted access token  |
| refreshToken    | string?  | Encrypted refresh token |
| tokenExpiresAt  | datetime | Token expiration        |
| scopes          | string[] | Granted scopes          |
| storeId         | string?  | Preferred store         |
| storeName       | string?  | Store display name      |
| storeAddress    | string?  | Store location          |
| fulfillmentMode | enum?    | `pickup`, `delivery`    |
| isActive        | boolean  | Connection active       |
| createdAt       | datetime |                         |
| updatedAt       | datetime |                         |

### KrogerProduct (Cache)

Cached product data with long TTL.

| Field           | Type     | Description               |
| --------------- | -------- | ------------------------- |
| id              | string   | Unique identifier         |
| krogerProductId | string   | Kroger's product ID       |
| upc             | string?  | Universal Product Code    |
| name            | string   | Product name              |
| description     | string?  | Product description       |
| brand           | string?  | Brand name                |
| category        | string?  | Product category          |
| size            | string?  | Package size              |
| price           | decimal? | Current price             |
| priceUnit       | string?  | Price unit (per oz, each) |
| imageUrl        | string?  | Product image             |
| storeId         | string?  | Store scope for pricing   |
| isAvailable     | boolean  | In stock                  |
| lastVerifiedAt  | datetime | Last API verification     |
| expiresAt       | datetime | Cache expiration          |
| metadata        | json     | Additional data           |
| createdAt       | datetime |                           |
| updatedAt       | datetime |                           |

### KrogerSearchCache

Cached search results.

| Field       | Type     | Description          |
| ----------- | -------- | -------------------- |
| id          | string   | Unique identifier    |
| queryHash   | string   | Hash of search query |
| query       | string   | Original query       |
| storeId     | string?  | Store scope          |
| productIds  | string[] | Matching product IDs |
| resultCount | int      | Total results        |
| expiresAt   | datetime | Cache expiration     |
| createdAt   | datetime |                      |

### Recipe

User's saved recipes for meal planning.

| Field           | Type      | Description               |
| --------------- | --------- | ------------------------- |
| id              | string    | Unique identifier         |
| userId          | string    | FK to User                |
| name            | string    | Recipe name               |
| source          | string?   | URL, cookbook, "custom"   |
| description     | string?   | Recipe description        |
| servings        | int       | Default servings          |
| prepTimeMinutes | int?      | Prep time                 |
| cookTimeMinutes | int?      | Cook time                 |
| ingredients     | json      | Array of RecipeIngredient |
| instructions    | string?   | Cooking instructions      |
| tags            | string[]  | Cuisine, diet labels      |
| imageUrl        | string?   | Recipe image              |
| lastMadeAt      | datetime? | Last time made            |
| timesUsed       | int       | Usage count               |
| createdAt       | datetime  |                           |
| updatedAt       | datetime  |                           |

### RecipeIngredient (embedded JSON)

| Field              | Type    | Description                  |
| ------------------ | ------- | ---------------------------- |
| name               | string  | Ingredient name (normalized) |
| quantity           | number  | Amount needed                |
| unit               | string  | Measurement unit             |
| notes              | string? | "optional", "to taste"       |
| category           | string? | produce, dairy, pantry       |
| preferredProductId | string? | Saved product match          |

### ProductPreference

User's product preferences.

| Field         | Type     | Description                                  |
| ------------- | -------- | -------------------------------------------- |
| id            | string   | Unique identifier                            |
| userId        | string   | FK to User                                   |
| type          | enum     | `prefer`, `avoid`                            |
| category      | enum     | `brand`, `product`, `ingredient`, `category` |
| value         | string   | The preference value                         |
| reason        | string?  | allergy, taste, dietary, budget              |
| ingredientKey | string?  | For ingredient-specific prefs                |
| productId     | string?  | Specific product if type=product             |
| isActive      | boolean  | Currently active                             |
| createdAt     | datetime |                                              |
| updatedAt     | datetime |                                              |

### SubstitutionRule

Automatic ingredient substitutions.

| Field                | Type     | Description                            |
| -------------------- | -------- | -------------------------------------- |
| id                   | string   | Unique identifier                      |
| userId               | string   | FK to User                             |
| originalIngredient   | string   | What to substitute                     |
| substituteIngredient | string   | What to use instead                    |
| substituteProductId  | string?  | Specific product                       |
| context              | enum     | `always`, `if_available`, `for_recipe` |
| recipeId             | string?  | If context = for_recipe                |
| reason               | string?  | Why substitution exists                |
| isActive             | boolean  | Currently active                       |
| createdAt            | datetime |                                        |
| updatedAt            | datetime |                                        |

### ShoppingList

Generated shopping lists.

| Field          | Type     | Description                               |
| -------------- | -------- | ----------------------------------------- |
| id             | string   | Unique identifier                         |
| userId         | string   | FK to User                                |
| name           | string   | List name                                 |
| status         | enum     | `draft`, `building`, `ready`, `completed` |
| sourceType     | enum     | `manual`, `recipe`, `meal_plan`           |
| sourceIds      | string[] | Recipe or meal plan IDs                   |
| items          | json     | Array of ShoppingListItem                 |
| estimatedTotal | decimal? | Estimated cost                            |
| storeId        | string?  | Target store                              |
| createdAt      | datetime |                                           |
| updatedAt      | datetime |                                           |

### ShoppingListItem (embedded JSON)

| Field              | Type     | Description                                            |
| ------------------ | -------- | ------------------------------------------------------ |
| ingredientName     | string   | Original ingredient                                    |
| quantity           | number   | Amount needed                                          |
| unit               | string   | Measurement unit                                       |
| productId          | string?  | Resolved Kroger product                                |
| productName        | string?  | Product name snapshot                                  |
| price              | decimal? | Current price                                          |
| status             | enum     | `pending`, `resolved`, `needs_confirmation`, `skipped` |
| confirmationReason | string?  | Why confirmation needed                                |

### CartRun

Tracks cart building operations.

| Field           | Type      | Description                               |
| --------------- | --------- | ----------------------------------------- |
| id              | string    | Unique identifier                         |
| userId          | string    | FK to User                                |
| shoppingListId  | string    | FK to ShoppingList                        |
| storeId         | string    | Target store                              |
| status          | enum      | `running`, `needs_user`, `done`, `failed` |
| addedItemsCount | int       | Successfully added                        |
| skippedItems    | json      | Items requiring user action               |
| errorMessage    | string?   | Error if failed                           |
| evidence        | json      | Logs, API request IDs                     |
| startedAt       | datetime  | When started                              |
| completedAt     | datetime? | When finished                             |

---

## Core Services

### KrogerClient

API wrapper with rate limiting.

| Method                                | Description                       |
| ------------------------------------- | --------------------------------- |
| `searchProducts(query, options)`      | Search products (cache-first)     |
| `getProduct(productId)`               | Get product details (cache-first) |
| `getLocations(zipCode, radius?)`      | Find nearby stores                |
| `getCart()`                           | Get current cart contents         |
| `addToCart(productId, quantity)`      | Add item to cart                  |
| `updateCartItem(productId, quantity)` | Update quantity                   |
| `removeFromCart(productId)`           | Remove item                       |
| `refreshToken()`                      | Refresh OAuth token               |

### KrogerProductCache

DB-first product lookups.

| Method                                | Description               |
| ------------------------------------- | ------------------------- |
| `getCachedProduct(productId)`         | Get from cache            |
| `getCachedSearch(query, storeId)`     | Get cached search results |
| `cacheProduct(product)`               | Store product             |
| `cacheSearchResults(query, products)` | Store search results      |
| `invalidateProduct(productId)`        | Force refresh             |
| `cleanupExpired()`                    | Remove expired entries    |

### RecipeService

Recipe and ingredient management.

| Method                                | Description             |
| ------------------------------------- | ----------------------- |
| `createRecipe(input)`                 | Create new recipe       |
| `updateRecipe(id, input)`             | Update recipe           |
| `deleteRecipe(id)`                    | Delete recipe           |
| `scaleRecipe(id, servings)`           | Adjust servings         |
| `getIngredientList(recipeIds)`        | Extract ingredients     |
| `normalizeIngredients(ingredients)`   | Standardize names/units |
| `deduplicateIngredients(ingredients)` | Combine across recipes  |

### ProductResolutionService

Maps ingredients to products.

| Method                                    | Description                |
| ----------------------------------------- | -------------------------- |
| `resolveIngredient(ingredient, prefs)`    | Find matching product      |
| `resolveIngredients(ingredients, prefs)`  | Batch resolution           |
| `applyPreferences(products, userId)`      | Filter/rank by preferences |
| `applySubstitutions(ingredients, userId)` | Apply substitution rules   |
| `markConfirmed(ingredientKey, productId)` | Save user confirmation     |

### ShoppingListService

Shopping list generation.

| Method                                    | Description             |
| ----------------------------------------- | ----------------------- |
| `createFromRecipes(recipeIds, servings?)` | Generate from recipes   |
| `createFromMealPlan(mealPlanId)`          | Generate from meal plan |
| `addItem(listId, item)`                   | Add manual item         |
| `removeItem(listId, itemId)`              | Remove item             |
| `resolveProducts(listId)`                 | Resolve all to products |
| `getEstimatedTotal(listId)`               | Calculate cost          |

### CartBuilderService

Builds Kroger cart from shopping list.

| Method                               | Description             |
| ------------------------------------ | ----------------------- |
| `startCartRun(shoppingListId)`       | Begin cart building     |
| `continueCartRun(runId)`             | Resume after user input |
| `handleAmbiguity(runId, selections)` | Process user choices    |
| `getCartSummary(runId)`              | Get final summary       |
| `generateHandoffLink()`              | Create "Open Cart" link |

---

## Product Resolution Strategy

### Priority Order

1. **Previously confirmed products** (highest confidence)
2. **User preferences applied** (brands, organic, size)
3. **Heuristic search match** (fallback)

### Matching Heuristics

When resolving an ingredient to a product:

| Factor             | Weight | Description             |
| ------------------ | ------ | ----------------------- |
| Exact name match   | High   | "yellow onion" in title |
| Category alignment | Medium | Produce vs pantry       |
| Size constraints   | Medium | 16 oz, 1 lb, 1 gal      |
| Brand preference   | Medium | User's preferred brands |
| Price/unit         | Low    | Value optimization      |

### Ambiguity Triggers

Pause and ask user when:

- Multiple products match with similar confidence
- Item is out of stock
- Price deviates significantly from expectation
- Size/quantity unclear (e.g., "fresh basil" bunch size)

---

## API Routes

### OAuth

| Method | Path                                  | Description        |
| ------ | ------------------------------------- | ------------------ |
| GET    | `/api/integrations/kroger/auth`       | Start OAuth flow   |
| GET    | `/api/integrations/kroger/callback`   | OAuth callback     |
| DELETE | `/api/integrations/kroger/disconnect` | Disconnect account |
| GET    | `/api/integrations/kroger/status`     | Connection status  |

### Store Selection

| Method | Path                                 | Description         |
| ------ | ------------------------------------ | ------------------- |
| GET    | `/api/integrations/kroger/locations` | Find nearby stores  |
| POST   | `/api/integrations/kroger/store`     | Set preferred store |

### Products

| Method | Path                                       | Description         |
| ------ | ------------------------------------------ | ------------------- |
| GET    | `/api/integrations/kroger/products/search` | Search products     |
| GET    | `/api/integrations/kroger/products/:id`    | Get product details |

### Preferences

| Method | Path                                       | Description        |
| ------ | ------------------------------------------ | ------------------ |
| GET    | `/api/integrations/kroger/preferences`     | List preferences   |
| POST   | `/api/integrations/kroger/preferences`     | Add preference     |
| DELETE | `/api/integrations/kroger/preferences/:id` | Remove preference  |
| GET    | `/api/integrations/kroger/substitutions`   | List substitutions |
| POST   | `/api/integrations/kroger/substitutions`   | Add substitution   |

### Recipes

| Method | Path               | Description   |
| ------ | ------------------ | ------------- |
| GET    | `/api/recipes`     | List recipes  |
| POST   | `/api/recipes`     | Create recipe |
| GET    | `/api/recipes/:id` | Get recipe    |
| PATCH  | `/api/recipes/:id` | Update recipe |
| DELETE | `/api/recipes/:id` | Delete recipe |

### Shopping Lists

| Method | Path                                 | Description         |
| ------ | ------------------------------------ | ------------------- |
| GET    | `/api/shopping-lists`                | List shopping lists |
| POST   | `/api/shopping-lists`                | Create from recipes |
| GET    | `/api/shopping-lists/:id`            | Get list with items |
| POST   | `/api/shopping-lists/:id/resolve`    | Resolve products    |
| POST   | `/api/shopping-lists/:id/build-cart` | Start cart build    |

### Cart Building

| Method | Path                                              | Description              |
| ------ | ------------------------------------------------- | ------------------------ |
| GET    | `/api/integrations/kroger/cart-runs/:id`          | Get run status           |
| POST   | `/api/integrations/kroger/cart-runs/:id/continue` | Continue with selections |
| GET    | `/api/integrations/kroger/cart-runs/:id/summary`  | Get final summary        |

---

## Agent Integration

### Agent Tools

| Tool                     | Description                      |
| ------------------------ | -------------------------------- |
| `search_kroger_products` | Search products with preferences |
| `get_product_details`    | Get specific product info        |
| `create_recipe`          | Save a new recipe                |
| `generate_shopping_list` | Create list from recipes         |
| `resolve_shopping_list`  | Match ingredients to products    |
| `build_kroger_cart`      | Add items to Kroger cart         |
| `get_cart_summary`       | Get current cart status          |
| `add_product_preference` | Save brand/product preference    |
| `add_substitution_rule`  | Create substitution              |

### Context Enrichment

Kroger data enriches agent context:

- **Saved Recipes**: User's recipe library
- **Product Preferences**: Brands to prefer/avoid
- **Dietary Restrictions**: Allergies, diets
- **Recent Purchases**: What user bought before
- **Pending Lists**: In-progress shopping lists

### Example Prompt Injection

```
### Grocery Context

**Dietary Restrictions**:
- Avoid: shellfish (allergy), peanuts (allergy)
- Prefer: organic produce, Fairlife milk

**Recent Recipes**:
- Chicken Stir Fry (made 3 days ago)
- Pasta Primavera (made 1 week ago)

**Pending Shopping List**:
- 12 items for "Weekend Meal Prep"
- Estimated total: $47.50
- Status: Ready for cart build
```

---

## Cart Handoff Flow

At completion, Theo presents:

```
┌─────────────────────────────────────────────┐
│ 🛒 Your Kroger Cart is Ready                │
├─────────────────────────────────────────────┤
│                                             │
│ Meals Planned: 4 dinners                    │
│                                             │
│ Items Added: 15                             │
│ - 2 lbs chicken breast         $8.99       │
│ - 1 lb ground beef            $6.49       │
│ - ... (12 more items)                      │
│                                             │
│ Items Needing Review: 2                     │
│ - Basil: multiple sizes available          │
│ - Cheese: out of stock, substitute?        │
│                                             │
│ Estimated Total: $67.50                     │
│                                             │
│ Store: Kroger #123 (Main St)               │
│                                             │
│     [ Open Kroger Cart → ]                  │
│                                             │
└─────────────────────────────────────────────┘
```

**Terminal state**: User must complete checkout in Kroger app/website.

---

## Error Handling

### Error Types

| Error                 | Cause               | Recovery             |
| --------------------- | ------------------- | -------------------- |
| `token_expired`       | OAuth token expired | Refresh token        |
| `token_revoked`       | User revoked access | Prompt re-auth       |
| `store_not_set`       | No store selected   | Prompt selection     |
| `product_unavailable` | Out of stock        | Suggest alternatives |
| `rate_limited`        | API limit exceeded  | Queue and retry      |
| `cart_error`          | Cart API failure    | Retry or manual add  |

### Intervention Points

Theo must pause and ask user if:

- Item is out of stock
- Multiple products match with similar confidence
- Price deviates significantly (>20% from typical)
- Store context conflicts with availability
- Ingredient is ambiguous

---

## Deliverables

### Phase 7 Checklist

- [ ] **OAuth**
  - [ ] Kroger OAuth flow
  - [ ] Token storage and refresh
  - [ ] Store selection flow

- [ ] **Database**
  - [ ] KrogerConnection table
  - [ ] KrogerProduct cache table
  - [ ] KrogerSearchCache table
  - [ ] Recipe table
  - [ ] ProductPreference table
  - [ ] SubstitutionRule table
  - [ ] ShoppingList table
  - [ ] CartRun table
  - [ ] Migrations applied

- [ ] **Product Cache**
  - [ ] DB-first product lookups
  - [ ] Search result caching
  - [ ] TTL management (7-30 days)
  - [ ] Cache invalidation

- [ ] **KrogerClient**
  - [ ] Product search
  - [ ] Product details
  - [ ] Location finder
  - [ ] Cart operations
  - [ ] Rate limiting

- [ ] **Recipe System**
  - [ ] Recipe CRUD
  - [ ] Ingredient normalization
  - [ ] Serving scaling
  - [ ] Deduplication

- [ ] **Preferences**
  - [ ] Brand preferences (prefer/avoid)
  - [ ] Dietary restrictions
  - [ ] Substitution rules
  - [ ] Per-ingredient preferences

- [ ] **Shopping Lists**
  - [ ] Generate from recipes
  - [ ] Product resolution
  - [ ] Ambiguity handling
  - [ ] Estimated totals

- [ ] **Cart Building**
  - [ ] Cart run management
  - [ ] Add items via API
  - [ ] User intervention flow
  - [ ] Cart summary and handoff

- [ ] **Agent Integration**
  - [ ] Product search tool
  - [ ] Recipe creation tool
  - [ ] Shopping list tool
  - [ ] Cart building tool
  - [ ] Context injection

- [ ] **Safety Guardrails**
  - [ ] No checkout endpoints implemented
  - [ ] Clear handoff to user
  - [ ] Audit trail for all cart actions

---

## Success Metrics

| Metric                  | Target | Description                     |
| ----------------------- | ------ | ------------------------------- |
| Cache hit rate          | >80%   | Product lookups from cache      |
| API calls/user/day      | <100   | Stay well under limit           |
| Product resolution rate | >90%   | Ingredients matched to products |
| Cart build success      | >85%   | Lists fully added to cart       |
| User intervention rate  | <20%   | Items needing confirmation      |

---

## Future Enhancements (V2+)

- **Multi-store Support**: Compare prices across stores
- **Best Value Selection**: Optimize price/unit
- **Pantry Inference**: Track what user has at home
- **Historical Purchases**: Learn from past orders
- **Budget-aware Optimization**: Stay within budget
- **Coupon Awareness**: Surface relevant deals
- **Walmart Integration**: Alternative grocery provider
- **Instacart Integration**: Multi-retailer support

---

## Appendix: Examples

### Recipe Object

```json
{
  "id": "recipe_abc123",
  "userId": "user_123",
  "name": "Chicken Stir Fry",
  "servings": 4,
  "prepTimeMinutes": 15,
  "cookTimeMinutes": 20,
  "ingredients": [
    {
      "name": "chicken breast",
      "quantity": 1.5,
      "unit": "lb",
      "category": "meat"
    },
    {
      "name": "broccoli",
      "quantity": 2,
      "unit": "cups",
      "category": "produce"
    },
    {
      "name": "soy sauce",
      "quantity": 3,
      "unit": "tbsp",
      "category": "pantry"
    },
    { "name": "garlic", "quantity": 3, "unit": "cloves", "category": "produce" }
  ],
  "tags": ["asian", "quick", "healthy"]
}
```

### Shopping List Item

```json
{
  "ingredientName": "chicken breast",
  "quantity": 1.5,
  "unit": "lb",
  "productId": "0020123400000",
  "productName": "Kroger Boneless Skinless Chicken Breast",
  "price": 8.99,
  "status": "resolved"
}
```

### Cart Run Summary

```json
{
  "id": "run_xyz789",
  "status": "done",
  "addedItemsCount": 12,
  "skippedItems": [
    {
      "ingredientName": "fresh basil",
      "reason": "multiple_matches",
      "options": [
        { "productId": "001", "name": "Basil Bunch", "price": 2.49 },
        { "productId": "002", "name": "Living Basil Plant", "price": 3.99 }
      ]
    }
  ],
  "estimatedTotal": 67.5,
  "handoffUrl": "https://www.kroger.com/cart"
}
```
