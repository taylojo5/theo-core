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
export interface KrogerTokenSet {
  accessToken: string; // Encrypted access token
  refreshToken: string; // Encrypted refresh token
  expiresAt: Date; // Token expiration timestamp
  tokenType: "Bearer"; // Always 'Bearer' for Kroger
  scopes: string[]; // Granted OAuth scopes
}

// ─────────────────────────────────────────────────────────────
// Store Types
// ─────────────────────────────────────────────────────────────

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
 * Parameters for searching nearby stores by location or zip code.
 */
export interface KrogerStoreSearchParams {
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
export interface KrogerStoreContext {
  storeId: string; // Selected store ID
  storeName: string; // Store display name for UI
  chain: KrogerChain; // Store banner
  fulfillmentMode: FulfillmentMode; // Pickup or delivery
  address: KrogerAddress; // Store address
  timezone: string; // Store timezone
  setAt: Date; // When context was set
}

interface KrogerAddress {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  zipCode: string;
  county: string | null;
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
export interface KrogerProduct {
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
export interface KrogerProductSearchParams {
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
export interface KrogerProductSearchResult {
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
export interface KrogerProductDetails extends KrogerProduct {
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
export interface IngredientResolutionRequest {
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
export interface AddToCartRequest {
  items: Array<{
    productId: string; // Kroger product ID or UPC
    quantity: number; // Quantity to add (min: 1)
    modality?: FulfillmentMode; // Override default fulfillment
  }>;
}

/**
 * Result of cart add operation with success/failure per item.
 */
export interface AddToCartResult {
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
export interface CartSummary {
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
export interface CartRunContext {
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
export interface CartRunEvidence {
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
 * User preferences for product selection including brand preferences,
 * organic preferences, and size constraints.
 */
export interface KrogerUserProductPreferences {
  userId: string; // User ID
  preferOrganic: boolean; // Prefer organic products
  preferStorebrands: boolean; // Prefer Kroger brands
  preferredBrands: string[]; // Brands to prefer
  avoidBrands: string[]; // Brands to avoid
  dietaryRestrictions: DietaryRestriction[];
  defaultQuantityBehavior: QuantityBehavior;
  maxPriceVariancePercent: number; // Alert threshold (e.g., 25)
  createdAt: Date; // When preferences were created
  updatedAt: Date; // When preferences were last updated
}

/**
 * How to handle quantity matching.
 */
enum QuantityBehavior {
  EXACT = "EXACT", // Match quantity exactly
  ROUND_UP = "ROUND_UP", // Round up to available sizes
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
export interface PreferredProductMapping {
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
export interface KrogerApiError {
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
export interface KrogerApiProductResponse {
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
export interface KrogerApiStoreResponse {
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
export interface KrogerApiCartResponse {
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
