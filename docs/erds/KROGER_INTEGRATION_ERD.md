# Kroger Integration ERD

**Technical Design Document for API-Based Cart Builder**

> **Status:** Draft ERD  
> **Type:** `api_cart_builder`  
> **Auth:** Kroger OAuth 2.0 (user-consented)  
> **Extends:** `grocery-integration-contract.md`, `kroger-grocery-integration.md`

---

## Table of Contents

1. [Overview](#overview)
2. [Environment Variables](#environment-variables)
3. [File Structure](#file-structure)
4. [Database Schema](#database-schema)
5. [Types & Interfaces](#types--interfaces)
6. [API Endpoints](#api-endpoints)
7. [Integration Functions](#integration-functions)
8. [OAuth Flow](#oauth-flow)
9. [Libraries & Dependencies](#libraries--dependencies)
10. [User Setup Flow](#user-setup-flow)
11. [Guardrails & Constraints](#guardrails--constraints)

---

## Overview

The Kroger integration enables Theo to:

- Connect to a user's Kroger account via OAuth
- Search Kroger's product catalog
- Resolve ingredients to specific products
- Build shopping carts via API
- **Never** place orders or enter checkout

Terminal state is always: **Cart built and ready for user review**

---

## Environment Variables

```bash
# ═══════════════════════════════════════════════════════════════════════════
# Kroger OAuth Configuration
# Obtain from Kroger Developer Portal: https://developer.kroger.com/
# ═══════════════════════════════════════════════════════════════════════════

# OAuth Client Credentials
KROGER_CLIENT_ID=           # Kroger OAuth client ID
KROGER_CLIENT_SECRET=       # Kroger OAuth client secret

# OAuth URLs (production defaults)
KROGER_AUTH_URL=https://api.kroger.com/v1/connect/oauth2/authorize
KROGER_TOKEN_URL=https://api.kroger.com/v1/connect/oauth2/token
KROGER_API_BASE_URL=https://api.kroger.com/v1

# Scopes (space-separated)
# - product.compact: Read product catalog
# - cart.basic:write: Create/modify cart items
# - profile.compact: Read basic profile info (store location)
KROGER_SCOPES=product.compact cart.basic:write profile.compact

# Redirect URI (must match Kroger Developer Portal config)
KROGER_REDIRECT_URI=${NEXT_PUBLIC_APP_URL}/api/integrations/kroger/callback
```

---

## File Structure

```
src/
├── app/api/integrations/kroger/
│   ├── callback/
│   │   └── route.ts                 # OAuth callback handler
│   ├── connect/
│   │   └── route.ts                 # POST: initiate OAuth, GET: check status
│   ├── disconnect/
│   │   └── route.ts                 # DELETE/POST: revoke access
│   ├── stores/
│   │   ├── route.ts                 # GET: list nearby stores
│   │   └── [storeId]/
│   │       └── route.ts             # GET: store details, POST: set as default
│   ├── products/
│   │   ├── route.ts                 # GET: search products
│   │   └── [productId]/
│   │       └── route.ts             # GET: product details
│   ├── cart/
│   │   ├── route.ts                 # GET: current cart, POST: add items
│   │   └── items/
│   │       └── [itemId]/
│   │           └── route.ts         # PUT: update qty, DELETE: remove item
│   └── preferences/
│       └── route.ts                 # GET/PUT: user product preferences
│
├── integrations/kroger/
│   ├── index.ts                     # Public exports barrel
│   ├── types.ts                     # TypeScript type definitions
│   ├── constants.ts                 # API constants, rate limits
│   ├── errors.ts                    # Kroger-specific error classes
│   ├── logger.ts                    # Integration-specific logger
│   ├── scopes.ts                    # Kroger scope definitions & utilities
│   │
│   ├── client.ts
│   │   ├── index.ts                 # Client exports
│   │   ├── connection.ts            # Kroger API HTTP client
│   │   ├── store.ts                 # Store context management
│   │   ├── product.ts               # Product detail fetching
│   │   ├── cart.ts                  # Cart CRUD operations
│   │   ├── preference.ts            # Product preference storage
│   │   └── repository.ts            # Client repository for caching and retrieval
│   ├── auth/
│   │   ├── index.ts                 # Auth exports
│   │   ├── oauth.ts                 # OAuth flow helpers
│   │   └── connection.ts            # Connection management
│   │
│   ├── stores/
│   │   ├── index.ts                 # Store exports
│   │   ├── search.ts                # Store location search
│   │   ├── repository.ts            # Store repository for caching and retrieval
│   │   └── context.ts               # Store context management
│   │
│   ├── products/
│   │   ├── index.ts                 # Product exports
│   │   ├── search.ts                # Product catalog search
│   │   ├── details.ts               # Product detail fetching
│   │   ├── repository.ts            # Product repository for caching and retrieval
│   │   └── resolution.ts            # Ingredient → product resolution
│   │
│   ├── cart/
│   │   ├── index.ts                 # Cart exports
│   │   ├── operations.ts            # Cart CRUD operations
│   │   ├── builder.ts               # Cart building orchestration
│   │   ├── repository.ts            # Cart repository for caching and retrieval
│   │   └── summary.ts               # Cart summary generation
│   │
│   ├── preferences/
│   │   ├── index.ts                 # Preferences exports
│   │   └── repository.ts            # Product preference storage
│   │
│   └── mappers.ts                   # API ↔ internal type mappers
│
├── lib/auth/
│   └── scopes.ts                    # Add KROGER_SCOPES export
│
└── components/integrations/kroger/
    ├── index.ts                     # Component exports
    ├── KrogerConnectionStatus.tsx   # Connection status display
    ├── StoreSelector.tsx            # Store selection UI
    ├── ProductResolutionCard.tsx    # Ingredient → product confirmation
    └── CartSummary.tsx              # Cart review before handoff

prisma/
└── migrations/
    └── YYYYMMDD_add_kroger_models/
        └── migration.sql            # Kroger-specific database tables
```

---

## Database Schema

### New Tables Required

> **Note:** Only table names and relationships are shown. Field definitions will be added during implementation.

```
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      KROGER DATA MODEL                                        │
├───────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                               │
│  ┌───────────────────┐         ┌───────────────────────────┐                                  │
│  │  KrogerConnection │         │   KrogerPreferredProduct  │                                  │
│  ├───────────────────┤         ├───────────────────────────┤                                  │
│  │ PK id             │         │ PK id                     │                                  │
│  │ FK userId ────────┼────┐    │ FK userId ────────────────┼───┐                              │
│  │    accessToken    │    │    │    ingredientKey          │   │                              │
│  │    refreshToken   │    │    │ FK krogerProductId ───────┼───┼──┐                           │
│  │    tokenExpiresAt │    │    │    productSnapshot        │   │  │                           │
│  │    scopes[]       │    │    │    lastVerifiedAt         │   │  │                           │
│  │    defaultStore   │    │    │                           │   │  │                           │
│  │    createdAt      │    │    └───────────────────────────┘   │  │                           │
│  │    updatedAt      │    │                                    │  │                           │
│  └───────────────────┘    │    ┌───────────────────────────┐   │  │                           │
│                           │    │      KrogerCartRun        │   │  │                           │
│                           │    ├───────────────────────────┤   │  │                           │
│                           └───►│ FK userId                 │◄──┘  │                           │
│                                │ PK id                     │      │                           │
│  ┌───────────────────┐         │    shoppingListId         │      │                           │
│  │       User        │         │    status                 │      │                           │
│  ├───────────────────┤         │    storeId                │      │                           │
│  │ PK id             │◄────────┤    addedItemsCount        │      │                           │
│  │    ...            │         │    skippedItems[]         │      │                           │
│  └───────────────────┘         │    evidence               │      │                           │
│                                │    estimatedTotal         │      │                           │
│                                │    cartUrl                │      │                           │
│                                │    createdAt              │      │                           │
│                                │    updatedAt              │      │                           │
│                                └───────────────────────────┘      │                           │
│                                                                   │                           │
│  ┌────────────────────────────────────────────────────────────────┼─────────────────────────┐ │
│  │                      KrogerCartRunItem                         │                         │ │
│  ├────────────────────────────────────────────────────────────────┴─────────────────────────┤ │
│  │ PK id                                                                                    │ │
│  │ FK cartRunId                                                                             │ │
│  │ FK krogerProductId ──────────────────────────────────────────────────────────────────┐   │ │
│  │    ingredientKey                                                                     │   │ │
│  │    productName                                                                       │   │ │
│  │    quantity                                                                          │   │ │
│  │    unitPrice                                                                         │   │ │
│  │    status (added | skipped | needs_confirmation)                                     │   │ │
│  │    resolutionReason                                                                  │   │ │
│  │    alternativeProducts[]                                                             │   │ │
│  └──────────────────────────────────────────────────────────────────────────────────────┼───┘ │
│                                                                                         │     │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┴───┐ │
│  │                              KrogerProduct                                               │ │
│  ├──────────────────────────────────────────────────────────────────────────────────────────┤ │
│  │ PK id                                   │ Pricing                                        │ │
│  │    krogerProductId (unique)             │    priceRegular                                │ │
│  │    upc                                  │    pricePromo                                  │ │
│  │    brand                                │    promoDescription                            │ │
│  │    description                          │    priceLoyalty                                │ │
│  │    category                             │    priceUnit                                   │ │
│  │    subcategory                          │    priceUnitLabel                              │ │
│  │ ───────────────────────────────────     │ ───────────────────────────────────            │ │
│  │ Size                                    │ Availability                                   │ │
│  │    size                                 │    available                                   │ │
│  │    sizeQuantity                         │    stockLevel                                  │ │
│  │    unitOfMeasure                        │    fulfillmentTypes[]                          │ │
│  │    soldAs                               │    estimatedAvailability                       │ │
│  │ ───────────────────────────────────     │ ───────────────────────────────────            │ │
│  │ Attributes                              │ Meta                                           │ │
│  │    isOrganic                            │    storeId                                     │ │
│  │    isGlutenFree                         │    images (JSON)                               │ │
│  │    isKosher                             │    temperature                                 │ │
│  │    isVegan                              │    createdAt                                   │ │
│  │    isVegetarian                         │    updatedAt                                   │ │
│  │    isLocallyGrown                       │    lastFetchedAt                               │ │
│  │    isPrivateLabel                       │                                                │ │
│  └──────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                               │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Prisma Model Names

```prisma
// Add to schema.prisma


/**
 * Stores OAuth tokens and store context for a user's Kroger account.
 * One-to-one with User.
 */
model KrogerConnection {
  id String @id @default(cuid())
  userId String @unique
  accessToken String @db.Text
  refreshToken String? @db.Text
  tokenExpiresAt DateTime
  scopes String[]
  storeId String?
  store KrogerStore? @relation(fields: [storeId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([createdAt])
  @@index([updatedAt])
}

/**
 * A Kroger store location with address, hours, and capabilities.
 * Store context is required for accurate product availability.
 */
model KrogerStore {
  id String @id @default(cuid())
  storeId String
  divisionId String
  chain String
  name String
  address KrogerAddress
  geolocation KrogerGeolocation
  phone String?
  hours KrogerStoreHours
  departments String[]
  capabilities KrogerStoreCapabilities[]
  distanceMiles Decimal @db.Decimal(10, 2)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([storeId])
  @@index([divisionId])
  @@index([chain])
  @@index([name])
  @@index([address])
  @@index([geolocation])
  @@index([phone])
  @@index([hours])
  @@index([departments])
  @@index([capabilities])
  @@index([distanceMiles])
  @@index([createdAt])
  @@index([updatedAt])
}

/**
 * Store address. Line 1, line 2, city, state, zip code, and county are stored as strings.
 */
model KrogerAddress {
  line1 String @db.VarChar(255)
  line2 String? @db.VarChar(255)
  city String @db.VarChar(255)
  state String @db.VarChar(255)
  zipCode String @db.VarChar(255)
  county String? @db.VarChar(255)
}

/**
 * Store geolocation. Latitude and longitude are stored as decimal numbers.
 */
model KrogerGeolocation {
  latitude Decimal @db.Decimal(10, 8)
  longitude Decimal @db.Decimal(11, 8)
}

/**
 * Store hours by day. IANA timezone is used to store the timezone.
 */
model KrogerStoreHours {
  monday KrogerStoreHoursDay
  tuesday KrogerStoreHoursDay
  wednesday KrogerStoreHoursDay
  thursday KrogerStoreHoursDay
  friday KrogerStoreHoursDay
  saturday KrogerStoreHoursDay
  sunday KrogerStoreHoursDay
}

/**
 * Store hours by day. Open and close times are in the store's timezone.
 */
model KrogerStoreHoursDay {
  open String
  close String
  open24Hours Boolean @default(false)
}

/**
 * Store capabilities such as pickup, delivery, ship to home, pharmacy, and fuel center.
 */
model KrogerStoreCapabilities {
  pickup Boolean @default(false)
  delivery Boolean @default(false)
  shipToHome Boolean @default(false)
  pharmacy Boolean @default(false)
  fuelCenter Boolean @default(false)
}

/**
 * User product preferences. UserProductPreferences is a union of this model and the model in the integrations/types.ts file.
 */
model KrogerUserProductPreferences {
  id String @id @default(cuid())
  userId String
  preferOrganic Boolean @default(false)
  preferStorebrands Boolean @default(false)
  preferredBrands String[]
  avoidBrands String[]
  dietaryRestrictions String @default("NONE")
  defaultQuantityBehavior QuantityBehavior @default("EXACT")
  maxPriceVariancePercent Int @default(25)
  updatedAt DateTime @updatedAt
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([createdAt])
  @@index([updatedAt])
}

/**
 * User-confirmed ingredient → Kroger product mappings.
 * Enables learning from user selections for future cart builds.
 */
model KrogerPreferredProduct {
  id String @id @default(cuid())
  userId String
  ingredientKey String
  krogerProductId String
  krogerProduct KrogerProduct @relation(fields: [krogerProductId], references: [id])
  productSnapshot Json
  lastVerifiedAt DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([ingredientKey])
  @@index([krogerProductId])
  @@index([createdAt])
  @@index([updatedAt])
  @@unique([userId, ingredientKey])
}

/**
 * Tracks a cart building session from ingredient list to completion.
 * Provides auditability and debugging for each cart build.
 */
model KrogerCartRun {
  id String @id @default(cuid())
  userId String
  shoppingListId String
  status String @default("RUNNING")
  store KrogerStore @relation(fields: [storeId], references: [id])
  storeId String
  addedItemsCount Int @default(0)
  skippedItems String[]
  evidence String?
  estimatedTotal Decimal @db.Decimal(10, 2)
  cartUrl String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([shoppingListId])
  @@index([status])
  @@index([storeId])
  @@index([createdAt])
  @@index([updatedAt])
}

/**
 * Individual item within a cart run, tracking resolution status
 * and providing evidence for each product selection.
 */
model KrogerCartRunItem {
  id String @id @default(cuid())
  cartRun KrogerCartRun @relation(fields: [cartRunId], references: [id])
  cartRunId String
  krogerProduct KrogerProduct @relation(fields: [krogerProductId], references: [id])
  krogerProductId String
  status String @default("PENDING")
  resolutionReason String?
  alternativeProductIds String[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([cartRunId])
  @@index([krogerProductId])
  @@index([status])
  @@index([createdAt])
  @@index([updatedAt])
}

/**
 * Cached Kroger product catalog entries.
 * Stores product details, pricing, and availability per store.
 * Used to reduce API calls and provide faster product resolution.
 * Note: Pricing and availability are store-specific.
 */
model KrogerProduct {
  id String    @id @default(cuid())
  // Identifiers
  krogerProductId String @id @default(cuid()) // Kroger's product ID
  upc String @db.VarChar(255) // Universal Product Code
  // Product Info
  brand String? @db.VarChar(255) // Brand name (nullable)
  description String @db.VarChar(255) // Product title/description
  category String @db.VarChar(255) // Top-level category (ProductCategory enum)
  subcategory String? @db.VarChar(255) // Subcategory (nullable)
  // Size Information
  size String @db.VarChar(255) // Display size (e.g., "16 oz")
  sizeQuantity Int // Number of units
  unitOfMeasure String @db.VarChar(255) // Unit (oz, lb, ct, etc.)
  soldAs String @db.VarChar(255) // EACH | BY_WEIGHT
  // Pricing (store-specific, may vary)
  priceRegular Decimal @db.Decimal(10, 2) // Regular price
  pricePromo Decimal? @db.Decimal(10, 2) // Promotional price
  promoDescription String? @db.VarChar(255) // Sale description
  priceLoyalty Decimal?  @db.Decimal(10, 2) // Kroger Plus card price
  priceUnit Decimal?  @db.Decimal(10, 4) // Price per unit
  priceUnitLabel String? // Unit price display

  // Availability (store-specific)
  available Boolean @default(true) // In stock
  stockLevel String @db.VarChar(255) @default("HIGH") // HIGH | LOW | TEMPORARILY_OUT | OUT_OF_STOCK
  fulfillmentTypes String[] // PICKUP, DELIVERY
  estimatedAvailability String? // Restock estimate if out

  // Product Attributes
  isOrganic Boolean   @default(false)     // USDA Organic
  isGlutenFree Boolean   @default(false)     // Gluten-free certified
  isKosher Boolean   @default(false)     // Kosher certified
  isVegan Boolean   @default(false)     // Vegan
  isVegetarian Boolean   @default(false)     // Vegetarian
  isLocallyGrown Boolean   @default(false)     // Locally sourced
  isPrivateLabel Boolean   @default(false)     // Store brand

  // Storage & Images
  temperature String    @default("AMBIENT") // AMBIENT | REFRIGERATED | FROZEN
  images Json?                         // ProductImage[] as JSON

  // Store Context
  storeId String                        // Store where pricing/availability applies

  // Timestamps
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  lastFetchedAt DateTime  @default(now())     // Last API fetch timestamp

  @@index([krogerProductId])
  @@index([upc])
  @@index([storeId])
  @@index([category])
  @@unique([krogerProductId, storeId])                 // Product + store combo is unique
}
```

---

## Types & Interfaces

### Core Integration Types

Located in `src/integrations/kroger/types.ts`:

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// Kroger Integration Types
// TypeScript type definitions for Kroger API interactions
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// OAuth & Connection Types
// ─────────────────────────────────────────────────────────────

/**
 * OAuth token set returned from Kroger authorization.
 * Contains access token, refresh token, and expiration.
 */
interface KrogerTokenSet {
  accessToken: string; // Encrypted access token
  refreshToken: string; // Encrypted refresh token
  expiresAt: Date; // Token expiration timestamp
  tokenType: "Bearer"; // Always 'Bearer' for Kroger
  scopes: string[]; // Granted OAuth scopes
}

/**
 * Current connection state including token health,
 * store context, and last activity timestamps.
 */
interface KrogerConnectionStatus {
  connected: boolean; // Whether OAuth connection exists
  hasValidToken: boolean; // Whether token is valid (not expired)
  tokenExpiresAt: Date | null; // When current token expires
  storeId: string | null; // Default store ID (if set)
  storeName: string | null; // Default store name (if set)
  scopes: string[]; // Currently granted scopes
  lastActivityAt: Date | null; // Last API activity timestamp
}

// ─────────────────────────────────────────────────────────────
// Store Types
// ─────────────────────────────────────────────────────────────

/**
 * A Kroger store location with address, hours, and capabilities.
 * Store context is required for accurate product availability.
 */
interface KrogerStore {
  storeId: string; // Kroger location ID (e.g., "01400376")
  divisionId: string; // Division/banner ID
  chain: KrogerChain; // Store banner (Kroger, Ralphs, etc.)
  name: string; // Store display name
  address: KrogerAddress; // Full address object
  geolocation: {
    latitude: number;
    longitude: number;
  };
  phone: string | null; // Store phone number
  hours: KrogerStoreHours; // Operating hours
  departments: string[]; // Available departments
  capabilities: StoreCapability[]; // Pickup, delivery, etc.
  distanceMiles: number | null; // Distance from search location
}

/**
 * Kroger store chain/banner identifiers.
 */
enum KrogerChain {
  KROGER = "KROGER",
  RALPHS = "RALPHS",
  FRYS = "FRYS",
  SMITHS = "SMITHS",
  KING_SOOPERS = "KING_SOOPERS",
  MARIANOS = "MARIANOS",
  PICK_N_SAVE = "PICK_N_SAVE",
  DILLONS = "DILLONS",
  QFC = "QFC",
  FRED_MEYER = "FRED_MEYER",
  HARRIS_TEETER = "HARRIS_TEETER",
  OTHER = "OTHER",
}

/**
 * Store address components.
 */
interface KrogerAddress {
  line1: string; // Street address
  line2: string | null; // Suite/unit (optional)
  city: string; // City name
  state: string; // 2-letter state code
  zipCode: string; // 5-digit ZIP
  county: string | null; // County name
}

/**
 * Store operating hours by day.
 */
interface KrogerStoreHours {
  monday: DayHours | null;
  tuesday: DayHours | null;
  wednesday: DayHours | null;
  thursday: DayHours | null;
  friday: DayHours | null;
  saturday: DayHours | null;
  sunday: DayHours | null;
  timezone: string; // IANA timezone (e.g., "America/New_York")
}

interface DayHours {
  open: string; // Opening time (e.g., "06:00")
  close: string; // Closing time (e.g., "23:00")
  open24Hours: boolean; // True if 24-hour operation
}

/**
 * Store fulfillment capabilities.
 */
enum StoreCapability {
  PICKUP = "PICKUP", // Curbside/in-store pickup
  DELIVERY = "DELIVERY", // Home delivery
  SHIP_TO_HOME = "SHIP_TO_HOME", // Ship non-perishables
  PHARMACY = "PHARMACY", // Has pharmacy
  FUEL_CENTER = "FUEL_CENTER", // Has fuel station
}

/**
 * Parameters for searching nearby stores by location or zip code.
 */
interface KrogerStoreSearchParams {
  zipCode?: string; // 5-digit ZIP code
  latitude?: number; // Latitude for geo search
  longitude?: number; // Longitude for geo search
  radiusMiles?: number; // Search radius (default: 10)
  limit?: number; // Max results (default: 10, max: 200)
  chain?: KrogerChain; // Filter by store banner
}

/**
 * User's selected store and fulfillment preferences.
 * Required before product search or cart operations.
 */
interface KrogerStoreContext {
  storeId: string; // Selected store ID
  storeName: string; // Store display name for UI
  chain: KrogerChain; // Store banner
  fulfillmentMode: FulfillmentMode; // Pickup or delivery
  address: KrogerAddress; // Store address
  timezone: string; // Store timezone
  setAt: Date; // When context was set
}

enum FulfillmentMode {
  PICKUP = "PICKUP",
  DELIVERY = "DELIVERY",
}

// ─────────────────────────────────────────────────────────────
// Product Types
// ─────────────────────────────────────────────────────────────

/**
 * A product from Kroger's catalog with pricing, size, and availability.
 * Availability may vary by store.
 */
interface KrogerProduct {
  productId: string; // Kroger product ID
  upc: string; // Universal Product Code
  brand: string | null; // Brand name
  description: string; // Product title/description
  category: ProductCategory; // Top-level category
  subcategory: string | null; // Subcategory
  size: ProductSize; // Size/quantity info
  price: ProductPrice; // Pricing info
  images: ProductImage[]; // Product images
  availability: ProductAvailability; // Stock status
  itemInformation: ItemInformation; // Attributes (organic, etc.)
  temperature: TemperatureIndicator; // Storage type
}

/**
 * Product category from Kroger taxonomy.
 */
enum ProductCategory {
  PRODUCE = "PRODUCE",
  MEAT_SEAFOOD = "MEAT_SEAFOOD",
  DAIRY = "DAIRY",
  BAKERY = "BAKERY",
  DELI = "DELI",
  FROZEN = "FROZEN",
  PANTRY = "PANTRY",
  BEVERAGES = "BEVERAGES",
  SNACKS = "SNACKS",
  HOUSEHOLD = "HOUSEHOLD",
  HEALTH_BEAUTY = "HEALTH_BEAUTY",
  BABY = "BABY",
  PET = "PET",
  OTHER = "OTHER",
}

/**
 * How product is priced and sold.
 */
enum SoldAsType {
  EACH = "EACH", // Sold per unit
  BY_WEIGHT = "BY_WEIGHT", // Sold by weight (lb, oz)
}

/**
 * Product size and quantity information.
 */
interface ProductSize {
  size: string; // Display size (e.g., "16 oz")
  quantity: number; // Number of units
  unitOfMeasure: string; // Unit (oz, lb, ct, etc.)
  soldAs: SoldAsType; // Pricing method
}

/**
 * Product pricing information.
 */
interface ProductPrice {
  regular: number; // Regular price in dollars
  promo: number | null; // Promotional price (if on sale)
  promoDescription: string | null; // Sale description (e.g., "2 for $5")
  loyaltyPrice: number | null; // Kroger Plus card price
  unitPrice: number | null; // Price per unit (e.g., per oz)
  unitPriceLabel: string | null; // Unit price display (e.g., "$0.25/oz")
}

/**
 * Product image viewing angle.
 */
enum ImagePerspective {
  FRONT = "front",
  LEFT = "left",
  RIGHT = "right",
  TOP = "top",
  BACK = "back",
}

/**
 * Product images at various resolutions.
 */
interface ProductImage {
  perspective: ImagePerspective;
  sizes: {
    small: string; // ~100px URL
    medium: string; // ~200px URL
    large: string; // ~400px URL
    xlarge: string; // ~800px URL
  };
}

/**
 * Product availability at user's store.
 */
interface ProductAvailability {
  available: boolean; // In stock
  stockLevel: StockLevel; // Stock status
  fulfillmentTypes: FulfillmentMode[]; // Available for pickup/delivery
  estimatedAvailability: string | null; // Restock estimate if out
}

enum StockLevel {
  HIGH = "HIGH",
  LOW = "LOW",
  TEMPORARILY_OUT = "TEMPORARILY_OUT",
  OUT_OF_STOCK = "OUT_OF_STOCK",
}

/**
 * Product item attributes.
 */
interface ItemInformation {
  organic: boolean; // USDA Organic
  glutenFree: boolean; // Gluten-free certified
  kosher: boolean; // Kosher certified
  vegan: boolean; // Vegan
  vegetarian: boolean; // Vegetarian
  locallyGrown: boolean; // Locally sourced
  private_label: boolean; // Store brand
}

enum TemperatureIndicator {
  AMBIENT = "AMBIENT",
  REFRIGERATED = "REFRIGERATED",
  FROZEN = "FROZEN",
}

/**
 * Product search parameters including keyword, filters, and pagination.
 */
interface KrogerProductSearchParams {
  term: string; // Search keyword (required)
  brand?: string; // Filter by brand
  category?: ProductCategory; // Filter by category
  fulfillment?: FulfillmentMode; // Filter by availability
  start?: number; // Pagination offset (default: 0)
  limit?: number; // Results per page (default: 20, max: 50)
}

/**
 * Paginated product search response with metadata.
 */
interface KrogerProductSearchResult {
  products: KrogerProduct[]; // Matched products
  pagination: {
    start: number; // Current offset
    limit: number; // Page size
    total: number; // Total matches
    hasMore: boolean; // More pages available
  };
  meta: {
    searchTerm: string; // Original search term
    filters: Record<string, string>; // Applied filters
    storeId: string; // Store context used
  };
}

/**
 * Detailed product information including nutritional data,
 * images, and current pricing.
 */
interface KrogerProductDetails extends KrogerProduct {
  nutrition: NutritionFacts | null; // Nutritional info
  ingredients: string | null; // Ingredient list text
  allergens: string[]; // Allergen warnings
  countryOfOrigin: string | null; // Origin country
  instructions: string | null; // Preparation/storage
}

/**
 * Nutritional facts per serving.
 */
interface NutritionFacts {
  servingSize: string; // e.g., "1 cup (240ml)"
  servingsPerContainer: number | null; // Servings count
  calories: number | null;
  totalFat: NutrientValue | null;
  saturatedFat: NutrientValue | null;
  transFat: NutrientValue | null;
  cholesterol: NutrientValue | null;
  sodium: NutrientValue | null;
  totalCarbohydrates: NutrientValue | null;
  dietaryFiber: NutrientValue | null;
  sugars: NutrientValue | null;
  protein: NutrientValue | null;
}

interface NutrientValue {
  amount: number; // Amount in grams/mg
  unit: string; // Unit (g, mg, etc.)
  dailyValue: number | null; // Percent daily value
}

// ─────────────────────────────────────────────────────────────
// Product Resolution Types
// ─────────────────────────────────────────────────────────────

/**
 * Request to resolve a normalized ingredient to a Kroger product.
 * May include user preferences and quantity requirements.
 */
interface IngredientResolutionRequest {
  ingredientKey: string; // Normalized ingredient ID
  ingredientName: string; // Display name (e.g., "yellow onion")
  quantity: number; // Required quantity
  unit: string; // Unit (e.g., "lb", "oz", "each")
  recipeContext?: string; // Recipe name for context
  preferences?: {
    preferOrganic: boolean;
    preferredBrands: string[];
    avoidBrands: string[];
    maxPricePerUnit: number | null;
  };
}

/**
 * Result of ingredient resolution containing matched product,
 * confidence score, and alternative options.
 */
interface IngredientResolutionResult {
  ingredientKey: string; // Original ingredient key
  ingredientName: string; // Original ingredient name
  status: ResolutionStatus; // Resolution outcome
  confidence: ResolutionConfidence; // Match confidence
  matchedProduct: KrogerProduct | null; // Best match (if found)
  alternatives: KrogerProduct[]; // Other options (max 5)
  evidence: ProductResolutionEvidence; // Why this was selected
  requiresConfirmation: boolean; // Needs user approval
  confirmationReason: string | null; // Why confirmation needed
}

enum ResolutionStatus {
  MATCHED = "MATCHED", // Product found with confidence
  AMBIGUOUS = "AMBIGUOUS", // Multiple matches, needs user
  NOT_FOUND = "NOT_FOUND", // No matching product
  OUT_OF_STOCK = "OUT_OF_STOCK", // Found but unavailable
  USER_CONFIRMED = "USER_CONFIRMED", // Previously confirmed by user
}

/**
 * Confidence level of ingredient → product resolution.
 * AMBIGUOUS requires user confirmation before adding to cart.
 */
enum ResolutionConfidence {
  HIGH = "HIGH",
  MEDIUM = "MEDIUM",
  LOW = "LOW",
  AMBIGUOUS = "AMBIGUOUS",
}

/**
 * Audit trail explaining why a product was selected.
 * Enables answer to "Why did you add this item?"
 */
interface ProductResolutionEvidence {
  ingredientKey: string; // Source ingredient
  productId: string; // Selected product
  matchMethod: MatchMethod; // How match was made
  matchScore: number; // 0-100 confidence score
  matchFactors: MatchFactor[]; // Contributing factors
  alternativeCount: number; // Number of alternatives found
  resolvedAt: Date; // When resolution occurred
  storeId: string; // Store context at resolution
}

enum MatchMethod {
  USER_PREFERENCE = "USER_PREFERENCE", // Previously confirmed
  BRAND_MATCH = "BRAND_MATCH", // Brand preference match
  EXACT_SEARCH = "EXACT_SEARCH", // Exact term match
  FUZZY_SEARCH = "FUZZY_SEARCH", // Approximate match
  CATEGORY_INFER = "CATEGORY_INFER", // Category-based inference
}

interface MatchFactor {
  factor: string; // e.g., "title_match", "brand_match"
  value: string; // Matched value
  weight: number; // Factor weight (0-1)
  contributed: boolean; // Did this improve score?
}

// ─────────────────────────────────────────────────────────────
// Cart Types
// ─────────────────────────────────────────────────────────────

/**
 * Current state of a Kroger shopping cart.
 * May be retrieved or created via API.
 */
interface KrogerCart {
  items: KrogerCartItem[]; // Cart contents
  itemCount: number; // Total item count
  subtotal: number; // Subtotal in dollars
  estimatedTotal: number; // Including estimated tax
  storeId: string; // Store context
  fulfillmentMode: FulfillmentMode; // Pickup or delivery
  cartUrl: string; // Deep link to Kroger cart
  lastModifiedAt: Date; // Last cart update
}

/**
 * An item in the Kroger cart with product reference and quantity.
 */
interface KrogerCartItem {
  cartItemId: string; // Cart-specific item ID
  productId: string; // Kroger product ID
  upc: string; // UPC code
  description: string; // Product description
  quantity: number; // Item quantity
  price: number; // Unit price
  extendedPrice: number; // price × quantity
  size: string; // Size display
  imageUrl: string | null; // Thumbnail URL
  available: boolean; // Still in stock
}

/**
 * Request to add one or more items to the cart.
 * Includes product IDs and quantities.
 */
interface AddToCartRequest {
  items: Array<{
    productId: string; // Kroger product ID or UPC
    quantity: number; // Quantity to add (min: 1)
    modality?: FulfillmentMode; // Override default fulfillment
  }>;
}

/**
 * Result of cart add operation with success/failure per item.
 */
interface AddToCartResult {
  success: boolean; // All items added successfully
  itemResults: Array<{
    productId: string; // Product attempted
    added: boolean; // Successfully added
    quantity: number; // Quantity added
    error: CartItemError | null; // Error if failed
  }>;
  cart: KrogerCart; // Updated cart state
}

interface CartItemError {
  code: CartItemErrorCode; // Error type
  message: string; // Human-readable message
  productId: string; // Failed product
}

enum CartItemErrorCode {
  PRODUCT_NOT_FOUND = "PRODUCT_NOT_FOUND",
  OUT_OF_STOCK = "OUT_OF_STOCK",
  QUANTITY_LIMIT = "QUANTITY_LIMIT",
  NOT_AVAILABLE_AT_STORE = "NOT_AVAILABLE_AT_STORE",
  INVALID_PRODUCT = "INVALID_PRODUCT",
}

/**
 * Summary of cart contents for user review before handoff.
 * Includes items, totals, and link to Kroger for checkout.
 */
interface CartSummary {
  meals: MealSummary[]; // Grouped by meal plan
  items: CartItemSummary[]; // All items added
  skippedItems: SkippedItemSummary[]; // Items not added
  pendingConfirmations: number; // Items needing confirmation
  totals: {
    itemCount: number;
    subtotal: number;
    estimatedTax: number;
    estimatedTotal: number;
  };
  store: {
    name: string;
    address: string;
    fulfillmentMode: FulfillmentMode;
  };
  cartUrl: string; // "Open Kroger Cart" link
  expiresAt: Date | null; // When cart may expire
}

interface MealSummary {
  mealName: string; // e.g., "Monday Dinner"
  recipeName: string; // Recipe title
  ingredientCount: number; // Ingredients in recipe
  itemsAdded: number; // Items added to cart
  itemsSkipped: number; // Items not added
}

interface CartItemSummary {
  productName: string; // Product description
  brand: string | null; // Brand name
  quantity: number; // Quantity in cart
  price: number; // Unit price
  total: number; // Line total
  forIngredient: string; // Source ingredient
  forMeal: string | null; // Associated meal
}

interface SkippedItemSummary {
  ingredientName: string; // What was needed
  reason: SkipReason; // Why not added
  message: string; // User-friendly explanation
}

enum SkipReason {
  OUT_OF_STOCK = "OUT_OF_STOCK",
  NOT_FOUND = "NOT_FOUND",
  NEEDS_CONFIRMATION = "NEEDS_CONFIRMATION",
  USER_SKIPPED = "USER_SKIPPED",
  PRICE_TOO_HIGH = "PRICE_TOO_HIGH",
}

// ─────────────────────────────────────────────────────────────
// Cart Run Types
// ─────────────────────────────────────────────────────────────

/**
 * State machine for cart building runs.
 * Terminal state is always DONE or FAILED.
 */
enum CartRunStatus {
  RUNNING = "RUNNING", // Cart build in progress
  NEEDS_USER = "NEEDS_USER", // Waiting for user confirmation
  DONE = "DONE", // Cart ready for review (terminal)
  FAILED = "FAILED", // Cart build failed
}

/**
 * Runtime context for a cart building session.
 * Tracks progress, items added, and items needing confirmation.
 */
interface CartRunContext {
  cartRunId: string; // Unique run identifier
  userId: string; // User ID
  shoppingListId: string; // Source shopping list
  storeId: string; // Store context
  status: CartRunStatus; // Current status
  progress: {
    totalIngredients: number; // Total to process
    processed: number; // Completed
    added: number; // Successfully added
    skipped: number; // Skipped/failed
    pending: number; // Awaiting confirmation
  };
  itemsNeedingConfirmation: IngredientResolutionResult[];
  errors: CartRunError[]; // Any errors encountered
  startedAt: Date; // Run start time
  updatedAt: Date; // Last update time
  completedAt: Date | null; // Completion time
}

interface CartRunError {
  code: string; // Error code
  message: string; // Error message
  ingredientKey: string | null; // Associated ingredient
  productId: string | null; // Associated product
  occurredAt: Date; // When error occurred
  recoverable: boolean; // Can continue?
}

/**
 * Observability data captured during cart build.
 * Includes request IDs, timing, and decision logs.
 */
interface CartRunEvidence {
  cartRunId: string; // Run identifier
  requestLog: RequestLogEntry[]; // API request history
  decisionLog: DecisionLogEntry[]; // Resolution decisions
  timing: {
    totalDurationMs: number; // Total run time
    apiTimeMs: number; // Time in API calls
    resolutionTimeMs: number; // Time in resolution
  };
  apiStats: {
    totalRequests: number; // API calls made
    productSearches: number; // Product search calls
    cartOperations: number; // Cart API calls
    rateLimitHits: number; // Rate limit encounters
  };
}

/**
 * HTTP request method types.
 */
enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
}

interface RequestLogEntry {
  requestId: string; // Unique request ID
  endpoint: string; // API endpoint called
  method: HttpMethod;
  statusCode: number; // Response status
  durationMs: number; // Request duration
  timestamp: Date; // When request made
}

/**
 * Cart builder decision types for an ingredient.
 */
enum CartDecision {
  ADD = "ADD", // Add to cart
  SKIP = "SKIP", // Skip this ingredient
  CONFIRM = "CONFIRM", // Needs user confirmation
}

interface DecisionLogEntry {
  ingredientKey: string; // Ingredient resolved
  decision: CartDecision; // What we decided
  productId: string | null; // Selected product
  confidence: ResolutionConfidence; // Confidence level
  reasoning: string; // Human-readable reason
  timestamp: Date; // When decision made
}

// ─────────────────────────────────────────────────────────────
// Preference Types
// ─────────────────────────────────────────────────────────────

/**
 * How to handle quantity matching.
 */
enum QuantityBehavior {
  EXACT = "EXACT", // Match quantity exactly
  ROUND_UP = "ROUND_UP", // Round up to available sizes
}

/**
 * User preferences for product selection including brand preferences,
 * organic preferences, and size constraints.
 */
interface UserProductPreferences {
  userId: string; // User ID
  preferOrganic: boolean; // Prefer organic products
  preferStorebrands: boolean; // Prefer Kroger brands
  preferredBrands: string[]; // Brands to prefer
  avoidBrands: string[]; // Brands to avoid
  dietaryRestrictions: DietaryRestriction[];
  defaultQuantityBehavior: QuantityBehavior;
  maxPriceVariancePercent: number; // Alert threshold (e.g., 25)
  updatedAt: Date; // Last preference update
}

enum DietaryRestriction {
  GLUTEN_FREE = "GLUTEN_FREE",
  DAIRY_FREE = "DAIRY_FREE",
  VEGAN = "VEGAN",
  VEGETARIAN = "VEGETARIAN",
  KOSHER = "KOSHER",
  NUT_FREE = "NUT_FREE",
  SOY_FREE = "SOY_FREE",
}

/**
 * A user-confirmed ingredient → product mapping.
 * Used to prioritize previously selected products.
 */
interface PreferredProductMapping {
  id: string; // Mapping ID
  userId: string; // User ID
  ingredientKey: string; // Normalized ingredient key
  krogerProductId: string; // Selected Kroger product
  productSnapshot: {
    upc: string; // UPC at time of selection
    description: string; // Product name snapshot
    brand: string | null; // Brand snapshot
    size: string; // Size snapshot
    price: number; // Price at selection
  };
  storeId: string | null; // Store-specific or global
  confirmedAt: Date; // When user confirmed
  lastVerifiedAt: Date; // Last availability check
  useCount: number; // Times used in cart builds
}

// ─────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────

/**
 * Categorized error codes for Kroger API failures.
 */
enum KrogerErrorCode {
  AUTH_FAILED = "AUTH_FAILED", // OAuth failed
  TOKEN_EXPIRED = "TOKEN_EXPIRED", // Access token expired
  TOKEN_REVOKED = "TOKEN_REVOKED", // User revoked access
  STORE_NOT_SET = "STORE_NOT_SET", // No store context
  STORE_INVALID = "STORE_INVALID", // Store no longer valid
  PRODUCT_NOT_FOUND = "PRODUCT_NOT_FOUND", // Product doesn't exist
  PRODUCT_UNAVAILABLE = "PRODUCT_UNAVAILABLE", // Product out of stock
  CART_ERROR = "CART_ERROR", // Cart operation failed
  RATE_LIMITED = "RATE_LIMITED", // Too many requests
  API_ERROR = "API_ERROR", // Generic API error
  NETWORK_ERROR = "NETWORK_ERROR", // Network failure
}

/**
 * Structured error from Kroger API with code, message,
 * and optional retry guidance.
 */
interface KrogerApiError {
  code: KrogerErrorCode; // Error category
  message: string; // Human-readable message
  httpStatus: number; // HTTP status code
  krogerErrorCode: string | null; // Kroger's error code
  retryable: boolean; // Can retry this request
  retryAfterMs: number | null; // Wait before retry
  requestId: string | null; // Request ID for support
  timestamp: Date; // When error occurred
}

// ─────────────────────────────────────────────────────────────
// API Response Types (from Kroger API)
// ─────────────────────────────────────────────────────────────

/**
 * Raw product response from Kroger Product API.
 * Maps to internal KrogerProduct via mapKrogerProductToInternal().
 */
interface KrogerApiProductResponse {
  data: Array<{
    productId: string;
    upc: string;
    brand: string;
    description: string;
    categories: string[];
    countryOfOrigin: string;
    items: Array<{
      itemId: string;
      size: string;
      soldBy: string;
      price: {
        regular: number;
        promo: number;
      };
      fulfillment: {
        curbside: boolean;
        delivery: boolean;
        inStore: boolean;
        shipToHome: boolean;
      };
      nationalPrice: {
        regular: number;
        promo: number;
      };
    }>;
    images: Array<{
      perspective: string;
      sizes: Array<{
        size: string;
        url: string;
      }>;
    }>;
    temperature: {
      indicator: string;
    };
    productInfo: {
      organic: boolean;
      glutenFree: boolean;
    };
  }>;
  meta: {
    pagination: {
      start: number;
      limit: number;
      total: number;
    };
  };
}

/**
 * Raw store response from Kroger Locations API.
 * Maps to internal KrogerStore via mapKrogerStoreToInternal().
 */
interface KrogerApiStoreResponse {
  data: Array<{
    locationId: string;
    chain: string;
    divisionNumber: string;
    name: string;
    phone: string;
    address: {
      addressLine1: string;
      addressLine2: string;
      city: string;
      state: string;
      zipCode: string;
      county: string;
    };
    geolocation: {
      latitude: number;
      longitude: number;
    };
    hours: {
      open24: boolean;
      monday: { open: string; close: string };
      tuesday: { open: string; close: string };
      wednesday: { open: string; close: string };
      thursday: { open: string; close: string };
      friday: { open: string; close: string };
      saturday: { open: string; close: string };
      sunday: { open: string; close: string };
      timezone: string;
    };
    departments: Array<{
      departmentId: string;
      name: string;
    }>;
  }>;
}

/**
 * Raw cart response from Kroger Cart API.
 * Maps to internal KrogerCart via mapKrogerCartToInternal().
 */
interface KrogerApiCartResponse {
  data: {
    cartId: string;
    items: Array<{
      cartItemId: string;
      productId: string;
      upc: string;
      description: string;
      quantity: number;
      price: number;
      extendedPrice: number;
      size: string;
      image: string;
    }>;
    subtotal: number;
    taxes: number;
    total: number;
    itemCount: number;
    lastModified: string;
  };
}
```

---

## API Endpoints

### Connect Endpoints

#### `POST /api/integrations/kroger/connect`

```typescript
/**
 * Initiate Kroger OAuth connection flow.
 *
 * Returns authorization URL for redirect to Kroger login.
 * Stores PKCE code verifier in session for callback.
 *
 * @param force - Re-authorize even if already connected
 * @param redirectUrl - URL to redirect after OAuth completes
 * @returns { authorizationUrl, state } for client redirect
 */
```

#### `GET /api/integrations/kroger/connect`

```typescript
/**
 * Check current Kroger connection status.
 *
 * Returns connection state, token health, and store context.
 * Used by UI to display connection status.
 *
 * @returns { connected, hasValidToken, storeId, storeName }
 */
```

#### `GET /api/integrations/kroger/callback`

```typescript
/**
 * OAuth callback handler for Kroger authorization.
 *
 * Exchanges authorization code for tokens using PKCE verifier.
 * Stores encrypted tokens in KrogerConnection.
 * Redirects to configured redirect URL on success.
 *
 * @param code - Authorization code from Kroger
 * @param state - State parameter for CSRF validation
 */
```

#### `DELETE /api/integrations/kroger/disconnect`

```typescript
/**
 * Disconnect Kroger integration.
 *
 * Revokes tokens at Kroger, deletes KrogerConnection,
 * and clears related preferences and cart runs.
 *
 * @returns { success, message }
 */
```

### Store Endpoints

#### `GET /api/integrations/kroger/stores`

```typescript
/**
 * Search for nearby Kroger stores.
 *
 * Requires connected Kroger account.
 * Returns stores sorted by distance from provided location.
 *
 * @param zipCode - ZIP code for location search
 * @param latitude - Latitude for location search (alternative)
 * @param longitude - Longitude for location search (alternative)
 * @param limit - Maximum number of stores to return
 * @returns { stores: KrogerStore[] }
 */
```

#### `GET /api/integrations/kroger/stores/[storeId]`

```typescript
/**
 * Get details for a specific store.
 *
 * Returns store hours, departments, and capabilities.
 *
 * @param storeId - Kroger store ID
 * @returns KrogerStore
 */
```

#### `POST /api/integrations/kroger/stores/[storeId]`

```typescript
/**
 * Set store as user's default for product search and cart.
 *
 * Updates KrogerConnection.defaultStoreId.
 * Required before product search or cart operations.
 *
 * @param storeId - Kroger store ID to set as default
 * @param fulfillmentMode - 'pickup' | 'delivery' (optional)
 * @returns { success, store }
 */
```

### Product Endpoints

#### `GET /api/integrations/kroger/products`

```typescript
/**
 * Search Kroger product catalog.
 *
 * Requires store context to be set for accurate availability.
 * Returns products with pricing scoped to user's store.
 *
 * @param term - Search keyword
 * @param brand - Filter by brand
 * @param category - Filter by category
 * @param limit - Maximum results
 * @param start - Pagination offset
 * @returns { products: KrogerProduct[], pagination }
 */
```

#### `GET /api/integrations/kroger/products/[productId]`

```typescript
/**
 * Get detailed product information.
 *
 * Returns full product details including images,
 * nutritional info, and current availability.
 *
 * @param productId - Kroger product ID (UPC or product ID)
 * @returns KrogerProductDetails
 */
```

### Cart Endpoints

#### `GET /api/integrations/kroger/cart`

```typescript
/**
 * Get current cart contents.
 *
 * Returns cart items with current pricing.
 * Cart is scoped to user's default store.
 *
 * @returns KrogerCart
 */
```

#### `POST /api/integrations/kroger/cart`

```typescript
/**
 * Add items to cart.
 *
 * Accepts array of products with quantities.
 * Validates availability before adding.
 *
 * @param items - Array of { productId, quantity }
 * @returns AddToCartResult
 */
```

#### `PUT /api/integrations/kroger/cart/items/[itemId]`

```typescript
/**
 * Update cart item quantity.
 *
 * @param itemId - Cart item ID
 * @param quantity - New quantity (0 to remove)
 * @returns { success, item }
 */
```

#### `DELETE /api/integrations/kroger/cart/items/[itemId]`

```typescript
/**
 * Remove item from cart.
 *
 * @param itemId - Cart item ID
 * @returns { success }
 */
```

### Preferences Endpoints

#### `GET /api/integrations/kroger/preferences`

```typescript
/**
 * Get user's product preferences.
 *
 * Returns brand preferences, dietary requirements,
 * and previously confirmed product mappings.
 *
 * @returns UserProductPreferences
 */
```

#### `PUT /api/integrations/kroger/preferences`

```typescript
/**
 * Update user's product preferences.
 *
 * @param preferences - Updated preference object
 * @returns { success, preferences }
 */
```

---

## Integration Functions

### Client (`client.ts`)

```typescript
function createKrogerClient(userId: string): KrogerClient {}
/**
 * Create an authenticated Kroger API client for a user.
 *
 * Automatically handles token refresh if needed.
 * Throws if user is not connected to Kroger.
 */

class KrogerClient {
  constructor(config: KrogerClientConfig) {}
  /**
   * HTTP client for Kroger API with rate limiting and retry logic.
   */

  async request<T>(endpoint: string, options?: RequestOptions): Promise<T> {}
  /**
   * Make authenticated request to Kroger API.
   * Handles token refresh and rate limit backoff.
   */
}
```

### Auth (`auth/oauth.ts`)

```typescript
function buildAuthorizationUrl(state: string, codeChallenge: string): string {}
/**
 * Build Kroger OAuth authorization URL with PKCE challenge.
 *
 * Includes required scopes and redirect URI.
 */

function generateCodeVerifier(): string {}
/**
 * Generate cryptographically secure PKCE code verifier.
 */

function generateCodeChallenge(verifier: string): string {}
/**
 * Generate S256 code challenge from verifier for PKCE flow.
 */

async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<KrogerTokenSet> {}
/**
 * Exchange authorization code for access and refresh tokens.
 *
 * Uses PKCE code verifier for validation.
 * Returns encrypted token set for storage.
 */
```

### Auth (`auth/tokens.ts`)

```typescript
async function getKrogerTokens(
  userId: string
): Promise<KrogerTokenSet | null> {}
/**
 * Retrieve and decrypt stored Kroger tokens for a user.
 *
 * Returns null if not connected.
 */

async function saveKrogerTokens(
  userId: string,
  tokens: KrogerTokenSet
): Promise<void> {}
/**
 * Encrypt and store Kroger tokens for a user.
 *
 * Creates or updates KrogerConnection record.
 */

async function refreshKrogerTokens(userId: string): Promise<KrogerTokenSet> {}
/**
 * Refresh expired access token using refresh token.
 *
 * Updates stored tokens with new values.
 * Throws if refresh token is invalid or expired.
 */

async function revokeKrogerTokens(userId: string): Promise<void> {}
/**
 * Revoke tokens at Kroger and delete local connection.
 */

function isTokenExpired(tokenSet: KrogerTokenSet): boolean {}
/**
 * Check if access token is expired or will expire soon.
 *
 * Considers buffer time for network latency.
 */
```

### Stores (`stores/search.ts`)

```typescript
async function searchStores(
  userId: string,
  params: KrogerStoreSearchParams
): Promise<KrogerStore[]> {}
/**
 * Search for Kroger stores near a location.
 *
 * Returns stores sorted by distance.
 */

async function getStoreDetails(
  userId: string,
  storeId: string
): Promise<KrogerStore> {}
/**
 * Get detailed information for a specific store.
 */
```

### Stores (`stores/context.ts`)

```typescript
async function getStoreContext(
  userId: string
): Promise<KrogerStoreContext | null> {}
/**
 * Get user's current store context.
 *
 * Returns null if no store is selected.
 */

async function setStoreContext(
  userId: string,
  storeId: string,
  fulfillmentMode?: string
): Promise<void> {}
/**
 * Set user's default store for product operations.
 *
 * Required before product search or cart operations.
 */

async function validateStoreContext(userId: string): Promise<boolean> {}
/**
 * Validate that store context is set and store is still valid.
 *
 * Returns false if store context needs to be re-established.
 */
```

### Products (`products/search.ts`)

```typescript
async function searchProducts(
  userId: string,
  params: KrogerProductSearchParams
): Promise<KrogerProductSearchResult> {}
/**
 * Search Kroger product catalog.
 *
 * Results are scoped to user's default store for accurate pricing/availability.
 * Throws if store context is not set.
 */

async function getProductDetails(
  userId: string,
  productId: string
): Promise<KrogerProductDetails> {}
/**
 * Get detailed product information including images and nutrition.
 */

async function checkProductAvailability(
  userId: string,
  productIds: string[]
): Promise<Map<string, boolean>> {}
/**
 * Check availability for multiple products at user's store.
 *
 * Returns map of productId → available.
 */
```

### Products (`products/resolution.ts`)

```typescript
async function resolveIngredient(
  userId: string,
  request: IngredientResolutionRequest
): Promise<IngredientResolutionResult> {}
/**
 * Resolve a normalized ingredient to a Kroger product.
 *
 * Priority order:
 * 1. Previously confirmed products for this ingredient
 * 2. User preferences (brand, organic, size)
 * 3. Heuristic search match
 *
 * Returns confidence level - 'ambiguous' requires user confirmation.
 */

async function resolveIngredientBatch(
  userId: string,
  requests: IngredientResolutionRequest[]
): Promise<IngredientResolutionResult[]> {}
/**
 * Resolve multiple ingredients in batch.
 *
 * Optimizes API calls by batching product searches.
 */

function buildResolutionEvidence(
  ingredient: string,
  product: KrogerProduct,
  matchReason: string
): ProductResolutionEvidence {}
/**
 * Create audit trail for why a product was selected.
 *
 * Enables transparency: "Why did you add this item?"
 */

function calculateResolutionConfidence(
  ingredient: string,
  product: KrogerProduct,
  alternatives: KrogerProduct[]
): ResolutionConfidence {}
/**
 * Calculate confidence level for ingredient → product match.
 *
 * Factors: title match, category alignment, alternatives count, price variance.
 */
```

### Cart (`cart/operations.ts`)

```typescript
async function getCart(userId: string): Promise<KrogerCart> {}
/**
 * Get current cart contents for user.
 *
 * Creates cart if none exists.
 */

async function addToCart(
  userId: string,
  items: Array<{ productId: string; quantity: number }>
): Promise<AddToCartResult> {}
/**
 * Add items to user's cart.
 *
 * Validates availability before adding.
 * Returns success/failure per item.
 */

async function updateCartItemQuantity(
  userId: string,
  itemId: string,
  quantity: number
): Promise<void> {}
/**
 * Update quantity of an item in cart.
 *
 * Set quantity to 0 to remove.
 */

async function removeCartItem(userId: string, itemId: string): Promise<void> {}
/**
 * Remove an item from cart.
 */

async function clearCart(userId: string): Promise<void> {}
/**
 * Remove all items from cart.
 */
```

### Cart (`cart/builder.ts`)

```typescript
async function buildCartFromIngredients(
  userId: string,
  ingredients: IngredientList,
  shoppingListId: string
): Promise<CartRunContext> {}
/**
 * Orchestrate cart building from an ingredient list.
 *
 * Steps:
 * 1. Validate store context
 * 2. Resolve ingredients to products
 * 3. Collect items needing confirmation
 * 4. Add high-confidence items to cart
 * 5. Return context with pending confirmations
 *
 * Never proceeds past cart building.
 */

async function resumeCartBuild(
  userId: string,
  cartRunId: string,
  confirmations: ProductConfirmation[]
): Promise<CartRunContext> {}
/**
 * Resume cart build after user confirms ambiguous items.
 *
 * Adds confirmed items to cart.
 * Updates cart run status.
 */

async function finalizeCartRun(
  userId: string,
  cartRunId: string
): Promise<CartSummary> {}
/**
 * Complete cart run and generate summary for user review.
 *
 * Terminal state: CART_READY_FOR_REVIEW.
 * Returns link to Kroger for checkout.
 */
```

### Cart (`cart/summary.ts`)

```typescript
async function generateCartSummary(
  userId: string,
  cartRunId: string
): Promise<CartSummary> {}
/**
 * Generate user-friendly summary of cart contents.
 *
 * Includes:
 * - Items added with quantities
 * - Items skipped with reasons
 * - Estimated total
 * - Link to Kroger cart
 */

function formatCartForHandoff(
  cart: KrogerCart,
  cartRun: CartRun
): CartHandoff {}
/**
 * Format cart data for presentation to user.
 *
 * Terminal handoff - user takes over from here.
 */
```

### Preferences (`preferences/repository.ts`)

```typescript
async function getPreferredProduct(
  userId: string,
  ingredientKey: string
): Promise<PreferredProductMapping | null> {}
/**
 * Get user's preferred product for an ingredient.
 *
 * Returns null if no preference saved.
 */

async function savePreferredProduct(
  userId: string,
  ingredientKey: string,
  productId: string,
  productSnapshot: object
): Promise<void> {}
/**
 * Save user's confirmed product selection for an ingredient.
 *
 * Used for future cart builds.
 */

async function getProductPreferences(
  userId: string
): Promise<UserProductPreferences> {}
/**
 * Get user's general product preferences.
 *
 * Brand preferences, organic/conventional, size preferences.
 */

async function updateProductPreferences(
  userId: string,
  preferences: Partial<UserProductPreferences>
): Promise<void> {}
/**
 * Update user's product preferences.
 */
```

### Mappers (`mappers.ts`)

```typescript
function mapKrogerProductToInternal(
  apiProduct: KrogerApiProductResponse
): KrogerProduct {}
/**
 * Map Kroger API product response to internal type.
 */

function mapKrogerStoreToInternal(
  apiStore: KrogerApiStoreResponse
): KrogerStore {}
/**
 * Map Kroger API store response to internal type.
 */

function mapKrogerCartToInternal(apiCart: KrogerApiCartResponse): KrogerCart {}
/**
 * Map Kroger API cart response to internal type.
 */
```

### Logger (`logger.ts`)

```typescript
const krogerLogger: KrogerLogger = createKrogerLogger();
/**
 * Logger instance for Kroger integration.
 * Includes context for debugging cart runs.
 */

function createCartRunLogger(cartRunId: string): KrogerLogger {}
/**
 * Create logger scoped to a specific cart run.
 * Attaches cart run ID to all log entries.
 */
```

### Errors (`errors.ts`)

```typescript
class KrogerError extends Error {}
/**
 * Base error class for Kroger integration errors.
 * Includes error code and retryability.
 */

class KrogerAuthError extends KrogerError {}
/**
 * Authentication/authorization failures.
 */

class KrogerStoreContextError extends KrogerError {}
/**
 * Store context missing or invalid.
 */

class KrogerProductError extends KrogerError {}
/**
 * Product search or availability errors.
 */

class KrogerCartError extends KrogerError {}
/**
 * Cart operation failures.
 */

function parseKrogerApiError(response: Response): KrogerApiError {}
/**
 * Parse error response from Kroger API.
 */

function isRetryableError(error: KrogerError): boolean {}
/**
 * Determine if error is transient and can be retried.
 */
```

---

## OAuth Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              KROGER OAUTH 2.0 + PKCE FLOW                               │
└─────────────────────────────────────────────────────────────────────────────────────────┘

    ┌──────────┐                    ┌──────────────┐                    ┌───────────────┐
    │  Client  │                    │   Theo API   │                    │  Kroger API   │
    │  (React) │                    │  (Next.js)   │                    │               │
    └────┬─────┘                    └──────┬───────┘                    └───────┬───────┘
         │                                 │                                    │
         │ 1. Click "Connect Kroger"       │                                    │
         │────────────────────────────────►│                                    │
         │                                 │                                    │
         │                                 │ 2. Generate PKCE verifier          │
         │                                 │    & challenge (S256)              │
         │                                 │                                    │
         │                                 │ 3. Store verifier in               │
         │                                 │    encrypted session               │
         │                                 │                                    │
         │ 4. Return authorization URL     │                                    │
         │◄────────────────────────────────│                                    │
         │    (includes state, challenge)  │                                    │
         │                                 │                                    │
         │ 5. Redirect to Kroger           │                                    │
         │─────────────────────────────────┼───────────────────────────────────►│
         │                                 │                                    │
         │                                 │                    ┌───────────────┤
         │                                 │                    │ 6. User logs  │
         │                                 │                    │    in & grants│
         │                                 │                    │    permissions│
         │                                 │                    └───────────────┤
         │                                 │                                    │
         │ 7. Redirect to callback         │                                    │
         │    with ?code=xxx&state=yyy     │                                    │
         │◄────────────────────────────────┼────────────────────────────────────│
         │                                 │                                    │
         │ 8. GET /api/.../callback        │                                    │
         │────────────────────────────────►│                                    │
         │                                 │                                    │
         │                                 │ 9. Validate state (CSRF)           │
         │                                 │    Retrieve verifier               │
         │                                 │                                    │
         │                                 │ 10. Exchange code + verifier       │
         │                                 │─────────────────────────────────────►│
         │                                 │                                    │
         │                                 │     tokens (access, refresh)       │
         │                                 │◄─────────────────────────────────────│
         │                                 │                                    │
         │                                 │ 11. Encrypt & store tokens         │
         │                                 │     in KrogerConnection            │
         │                                 │                                    │
         │ 12. Redirect to success page    │                                    │
         │◄────────────────────────────────│                                    │
         │    /settings/integrations/kroger│                                    │
         │                                 │                                    │
         │ 13. Prompt store selection      │                                    │
         │    (required for product ops)   │                                    │
         │                                 │                                    │
    ┌────┴─────┐                    ┌──────┴───────┐                    ┌───────┴───────┐
    │  Client  │                    │   Theo API   │                    │  Kroger API   │
    └──────────┘                    └──────────────┘                    └───────────────┘


Token Refresh Flow:
═══════════════════

    ┌──────────────┐                                           ┌───────────────┐
    │   Theo API   │                                           │  Kroger API   │
    └──────┬───────┘                                           └───────┬───────┘
           │                                                           │
           │  1. API request fails with 401                            │
           │◄──────────────────────────────────────────────────────────│
           │                                                           │
           │  2. Check if refresh token exists                         │
           │                                                           │
           │  3. POST /oauth2/token (grant_type=refresh_token)         │
           │──────────────────────────────────────────────────────────►│
           │                                                           │
           │  4. New access_token (+ new refresh_token)                │
           │◄──────────────────────────────────────────────────────────│
           │                                                           │
           │  5. Update stored tokens                                  │
           │                                                           │
           │  6. Retry original request                                │
           │──────────────────────────────────────────────────────────►│
           │                                                           │
    ┌──────┴───────┐                                           ┌───────┴───────┐
    │   Theo API   │                                           │  Kroger API   │
    └──────────────┘                                           └───────────────┘


Required OAuth Scopes:
══════════════════════

┌──────────────────────┬────────────────────────────────────────────────┐
│ Scope                │ Purpose                                        │
├──────────────────────┼────────────────────────────────────────────────┤
│ product.compact      │ Search and view product catalog                │
│ cart.basic:write     │ Add/remove/modify items in cart                │
│ profile.compact      │ Access user's default store location           │
└──────────────────────┴────────────────────────────────────────────────┘

NOT REQUESTED (by design):
─────────────────────────
× cart.basic:read     - Not needed, we use write scope
× fulfillment.*       - Time slots, delivery - explicitly avoided
× order.*             - Order placement - NEVER requested
```

---

## Libraries & Dependencies

### Required NPM Packages

```json
{
  "dependencies": {
    // Already in project - reuse
    "next": "^14.x",
    "next-auth": "^5.x",
    "@prisma/client": "^5.x",
    "zod": "^3.x"

    // No new dependencies required
    // Use built-in fetch for HTTP calls
    // Use existing crypto utilities for PKCE
  }
}
```

### Internal Dependencies

| Module             | Purpose                     | Location |
| ------------------ | --------------------------- | -------- |
| `@/lib/crypto`     | Token encryption/decryption | Existing |
| `@/lib/rate-limit` | API rate limiting           | Existing |
| `@/lib/auth`       | Session management          | Existing |
| `@/services/audit` | Action logging              | Existing |
| `@/lib/validation` | Request validation with Zod | Existing |

### Kroger API Documentation

| API       | Base URL                             | Documentation                                                               |
| --------- | ------------------------------------ | --------------------------------------------------------------------------- |
| OAuth 2.0 | `api.kroger.com/v1/connect/oauth2`   | [OAuth Guide](https://developer.kroger.com/documentation/public/oauth)      |
| Products  | `api.kroger.com/v1/products`         | [Product API](https://developer.kroger.com/documentation/public/product)    |
| Locations | `api.kroger.com/v1/locations`        | [Locations API](https://developer.kroger.com/documentation/public/location) |
| Cart      | `api.kroger.com/v1/cart`             | [Cart API](https://developer.kroger.com/documentation/public/cart)          |
| Profile   | `api.kroger.com/v1/identity/profile` | [Identity API](https://developer.kroger.com/documentation/public/identity)  |

---

## User Setup Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              USER SETUP FLOW                                            │
└─────────────────────────────────────────────────────────────────────────────────────────┘

    ┌────────────────────────────────────────────────────────────────────────────────────┐
    │                                                                                    │
    │  Step 1: CONNECT KROGER ACCOUNT                                                    │
    │  ─────────────────────────────────                                                 │
    │                                                                                    │
    │  ┌──────────────────────────────────────┐                                          │
    │  │  🛒  Connect Your Kroger Account     │                                          │
    │  │                                      │                                          │
    │  │  Theo can help you:                  │                                          │
    │  │  • Plan meals for the week           │                                          │
    │  │  • Build your shopping cart          │                                          │
    │  │  • Find products you love            │                                          │
    │  │                                      │                                          │
    │  │  [Connect Kroger]                    │                                          │
    │  │                                      │                                          │
    │  │  ℹ️ Theo will never place orders     │                                          │
    │  │     or enter checkout on your behalf │                                          │
    │  └──────────────────────────────────────┘                                          │
    │                              │                                                     │
    │                              ▼                                                     │
    │                    (Kroger OAuth login)                                            │
    │                              │                                                     │
    │                              ▼                                                     │
    ├────────────────────────────────────────────────────────────────────────────────────┤
    │                                                                                    │
    │  Step 2: SELECT YOUR STORE                                                         │
    │  ──────────────────────────────                                                    │
    │                                                                                    │
    │  ┌──────────────────────────────────────┐                                          │
    │  │  📍  Select Your Store               │                                          │
    │  │                                      │                                          │
    │  │  Enter your ZIP code:                │                                          │
    │  │  ┌──────────────────┐                │                                          │
    │  │  │ 90210            │                │                                          │
    │  │  └──────────────────┘                │                                          │
    │  │                                      │                                          │
    │  │  Nearby stores:                      │                                          │
    │  │  ○ Kroger - Beverly Hills (2.1 mi)   │                                          │
    │  │  ○ Kroger - West Hollywood (3.4 mi)  │                                          │
    │  │  ○ Ralphs - Sunset (4.2 mi)          │                                          │
    │  │                                      │                                          │
    │  │  [Continue]                          │                                          │
    │  └──────────────────────────────────────┘                                          │
    │                              │                                                     │
    │                              ▼                                                     │
    ├────────────────────────────────────────────────────────────────────────────────────┤
    │                                                                                    │
    │  Step 3: CONNECTED                                                                 │
    │  ─────────────────────                                                             │
    │                                                                                    │
    │  ┌──────────────────────────────────────┐                                          │
    │  │  ✅  Kroger Connected                │                                          │
    │  │                                      │                                          │
    │  │  Store: Kroger - Beverly Hills       │                                          │
    │  │  Address: 123 Main St                │                                          │
    │  │                                      │                                          │
    │  │  You can now:                        │                                          │
    │  │  • Ask Theo to plan meals            │                                          │
    │  │  • Build shopping lists              │                                          │
    │  │  • Review your cart on Kroger.com    │                                          │
    │  │                                      │                                          │
    │  │  [Change Store]  [Disconnect]        │                                          │
    │  └──────────────────────────────────────┘                                          │
    │                                                                                    │
    └────────────────────────────────────────────────────────────────────────────────────┘


State Requirements for Cart Operations:
═══════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                         │
│  ┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐        │
│  │   Kroger Connected  │────►│   Store Selected    │────►│   Ready for Cart    │        │
│  │     (OAuth done)    │     │   (context set)     │     │   Operations        │        │
│  └─────────────────────┘     └─────────────────────┘     └─────────────────────┘        │
│                                                                                         │
│  If store context is missing:                                                           │
│  ┌──────────────────────────────────────────────────────────────────────────────┐       │
│  │  ⚠️ Store Selection Required                                                 │       │
│  │                                                                              │       │
│  │  Before I can search for products or build your cart, I need to know        │       │
│  │  which Kroger store you'd like to shop at.                                  │       │
│  │                                                                              │       │
│  │  [Select Store]                                                              │       │
│  └──────────────────────────────────────────────────────────────────────────────┘       │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Guardrails & Constraints

### Checkout Prevention

The following capabilities are **explicitly not implemented**:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                            ❌ FORBIDDEN OPERATIONS                                      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  NEVER request these OAuth scopes:                                                      │
│  ─────────────────────────────────                                                      │
│  × fulfillment.times:read     - Time slot browsing                                      │
│  × fulfillment.times:write    - Time slot reservation                                   │
│  × order.create               - Order placement                                         │
│  × order.*                    - Any order operations                                    │
│                                                                                         │
│  NEVER implement these endpoints:                                                       │
│  ─────────────────────────────────                                                      │
│  × POST /checkout             - Checkout initiation                                     │
│  × POST /orders               - Order creation                                          │
│  × POST /timeslots            - Time slot selection                                     │
│  × POST /payment              - Payment processing                                      │
│                                                                                         │
│  NEVER call these Kroger APIs:                                                          │
│  ─────────────────────────────                                                          │
│  × /v1/fulfillment/*          - Fulfillment scheduling                                  │
│  × /v1/orders/*               - Order management                                        │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### User Intervention Points

Theo MUST pause and ask the user when:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                            🛑 USER CONFIRMATION REQUIRED                                │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  1. AMBIGUOUS PRODUCT MATCH                                                             │
│     Multiple products match with similar confidence                                     │
│     Example: "chicken breast" → boneless vs bone-in                                     │
│                                                                                         │
│  2. PRODUCT OUT OF STOCK                                                                │
│     Requested product is unavailable at user's store                                    │
│     Never silently substitute                                                           │
│                                                                                         │
│  3. SIGNIFICANT PRICE VARIANCE                                                          │
│     Price differs significantly from expectation                                        │
│     Threshold: >25% of typical price                                                    │
│                                                                                         │
│  4. STORE CONTEXT MISSING                                                               │
│     No default store set for user                                                       │
│     Required before any product operation                                               │
│                                                                                         │
│  5. INGREDIENT NOT FOUND                                                                │
│     No products match the ingredient search                                             │
│     User may need to rephrase or skip                                                   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Rate Limits

```typescript
// src/integrations/kroger/constants.ts

const KROGER_RATE_LIMITS = {
  // Kroger API limits (per access token)
  requestsPerSecond: 10,
  requestsPerMinute: 100,
  requestsPerDay: 10000,

  // Internal limits (per user)
  productSearchPerMinute: 30,
  cartOperationsPerMinute: 20,
  storeSearchPerMinute: 10,
} as const;
```

---

## Changes Required Outside Integration Folder

### Minimal External Changes

```
src/lib/auth/scopes.ts
├── Add KROGER_SCOPES constant
└── Add hasKrogerAccess() utility

prisma/schema.prisma
├── Add KrogerConnection model
├── Add KrogerPreferredProduct model
├── Add KrogerCartRun model
├── Add KrogerCartRunItem model
└── Add relation to User model

src/lib/rate-limit/middleware.ts
└── Add krogerConnect rate limit key

src/integrations/types.ts
└── Add 'kroger' to IntegrationProvider type
```

---

## Implementation Phases

> **Note:** This section is for planning reference only. Implementation order may vary.

### Phase 1: OAuth & Connection

- Environment variables setup
- OAuth flow with PKCE
- Token storage & refresh
- Connect/disconnect endpoints
- Connection status UI

### Phase 2: Store Context

- Store search by location
- Store selection UI
- Store context persistence
- Store validation

### Phase 3: Product Operations

- Product search endpoint
- Product details endpoint
- Availability checking

### Phase 4: Cart Operations

- Cart read/write operations
- Add/remove/update items
- Cart summary generation

### Phase 5: Ingredient Resolution

- Resolution algorithm
- User preference storage
- Confirmation workflow
- Resolution evidence logging

### Phase 6: Cart Builder

- End-to-end cart building
- Ambiguity handling
- Cart run tracking
- Handoff to user

---

_Last Updated: 2024-12-30_
_Version: ERD v1.0_
