-- CreateEnum
CREATE TYPE "KrogerChain" AS ENUM ('KROGER', 'RALPHS', 'FRYS', 'SMITHS', 'KING_SOOPERS', 'MARIANOS', 'PICK_N_SAVE', 'DILLONS', 'QFC', 'FRED_MEYER', 'HARRIS_TEETER', 'OTHER');

-- CreateTable
CREATE TABLE "KrogerConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT[],
    "storeId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KrogerConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KrogerStore" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "divisionId" TEXT,
    "chain" VARCHAR(255) NOT NULL DEFAULT 'KROGER',
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "departments" TEXT[],
    "distanceMiles" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "krogerAddressId" TEXT NOT NULL,
    "krogerGeolocationId" TEXT NOT NULL,
    "krogerStoreHoursId" TEXT NOT NULL,

    CONSTRAINT "KrogerStore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KrogerAddress" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "line1" VARCHAR(255) NOT NULL,
    "line2" VARCHAR(255),
    "city" VARCHAR(255) NOT NULL,
    "state" VARCHAR(255) NOT NULL,
    "zipCode" VARCHAR(255) NOT NULL,
    "county" VARCHAR(255),

    CONSTRAINT "KrogerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KrogerGeolocation" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,

    CONSTRAINT "KrogerGeolocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KrogerStoreHours" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "monday" JSONB NOT NULL,
    "tuesday" JSONB NOT NULL,
    "wednesday" JSONB NOT NULL,
    "thursday" JSONB NOT NULL,
    "friday" JSONB NOT NULL,
    "saturday" JSONB NOT NULL,
    "sunday" JSONB NOT NULL,

    CONSTRAINT "KrogerStoreHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KrogerStoreCapabilities" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "pickup" BOOLEAN NOT NULL DEFAULT false,
    "delivery" BOOLEAN NOT NULL DEFAULT false,
    "shipToHome" BOOLEAN NOT NULL DEFAULT false,
    "pharmacy" BOOLEAN NOT NULL DEFAULT false,
    "fuelCenter" BOOLEAN NOT NULL DEFAULT false,
    "krogerStoreId" TEXT,

    CONSTRAINT "KrogerStoreCapabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KrogerUserProductPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferOrganic" BOOLEAN NOT NULL DEFAULT false,
    "preferStorebrands" BOOLEAN NOT NULL DEFAULT false,
    "preferredBrands" TEXT[],
    "avoidBrands" TEXT[],
    "dietaryRestrictions" TEXT NOT NULL DEFAULT 'NONE',
    "defaultQuantityBehavior" TEXT NOT NULL DEFAULT 'EXACT',
    "maxPriceVariancePercent" INTEGER NOT NULL DEFAULT 25,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KrogerUserProductPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KrogerPreferredProduct" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ingredientKey" TEXT NOT NULL,
    "krogerProductId" TEXT NOT NULL,
    "productSnapshot" JSONB NOT NULL,
    "lastVerifiedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KrogerPreferredProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KrogerProduct" (
    "id" TEXT NOT NULL,
    "krogerProductId" TEXT NOT NULL,
    "upc" VARCHAR(255) NOT NULL,
    "brand" VARCHAR(255),
    "description" VARCHAR(255) NOT NULL,
    "category" VARCHAR(255) NOT NULL,
    "subcategory" VARCHAR(255),
    "size" VARCHAR(255) NOT NULL,
    "sizeQuantity" INTEGER NOT NULL,
    "unitOfMeasure" VARCHAR(255) NOT NULL,
    "soldAs" VARCHAR(255) NOT NULL,
    "priceRegular" DECIMAL(10,2) NOT NULL,
    "pricePromo" DECIMAL(10,2),
    "promoDescription" VARCHAR(255),
    "priceLoyalty" DECIMAL(10,2),
    "priceUnit" DECIMAL(10,4),
    "priceUnitLabel" VARCHAR(255),
    "available" BOOLEAN NOT NULL DEFAULT true,
    "stockLevel" VARCHAR(255) NOT NULL DEFAULT 'HIGH',
    "fulfillmentTypes" TEXT[],
    "estimatedAvailability" TEXT,
    "isOrganic" BOOLEAN NOT NULL DEFAULT false,
    "isGlutenFree" BOOLEAN NOT NULL DEFAULT false,
    "isKosher" BOOLEAN NOT NULL DEFAULT false,
    "isVegan" BOOLEAN NOT NULL DEFAULT false,
    "isVegetarian" BOOLEAN NOT NULL DEFAULT false,
    "isLocallyGrown" BOOLEAN NOT NULL DEFAULT false,
    "isPrivateLabel" BOOLEAN NOT NULL DEFAULT false,
    "temperature" TEXT NOT NULL DEFAULT 'AMBIENT',
    "images" JSONB,
    "storeId" TEXT NOT NULL,
    "lastFetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KrogerProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KrogerCartRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shoppingListId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "storeId" TEXT NOT NULL,
    "addedItemsCount" INTEGER NOT NULL DEFAULT 0,
    "skippedItems" TEXT[],
    "evidence" TEXT,
    "estimatedTotal" DECIMAL(10,2) NOT NULL,
    "cartUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KrogerCartRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KrogerCartRunItem" (
    "id" TEXT NOT NULL,
    "cartRunId" TEXT NOT NULL,
    "krogerProductId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resolutionReason" TEXT,
    "alternativeProductIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KrogerCartRunItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KrogerConnection_userId_key" ON "KrogerConnection"("userId");

-- CreateIndex
CREATE INDEX "KrogerConnection_userId_idx" ON "KrogerConnection"("userId");

-- CreateIndex
CREATE INDEX "KrogerConnection_storeId_idx" ON "KrogerConnection"("storeId");

-- CreateIndex
CREATE INDEX "KrogerConnection_createdAt_idx" ON "KrogerConnection"("createdAt");

-- CreateIndex
CREATE INDEX "KrogerConnection_updatedAt_idx" ON "KrogerConnection"("updatedAt");

-- CreateIndex
CREATE INDEX "KrogerStore_storeId_idx" ON "KrogerStore"("storeId");

-- CreateIndex
CREATE INDEX "KrogerStore_divisionId_idx" ON "KrogerStore"("divisionId");

-- CreateIndex
CREATE INDEX "KrogerStore_chain_idx" ON "KrogerStore"("chain");

-- CreateIndex
CREATE INDEX "KrogerStore_name_idx" ON "KrogerStore"("name");

-- CreateIndex
CREATE INDEX "KrogerStore_phone_idx" ON "KrogerStore"("phone");

-- CreateIndex
CREATE INDEX "KrogerStore_departments_idx" ON "KrogerStore"("departments");

-- CreateIndex
CREATE INDEX "KrogerStore_distanceMiles_idx" ON "KrogerStore"("distanceMiles");

-- CreateIndex
CREATE INDEX "KrogerStore_createdAt_idx" ON "KrogerStore"("createdAt");

-- CreateIndex
CREATE INDEX "KrogerStore_updatedAt_idx" ON "KrogerStore"("updatedAt");

-- CreateIndex
CREATE INDEX "KrogerUserProductPreferences_userId_idx" ON "KrogerUserProductPreferences"("userId");

-- CreateIndex
CREATE INDEX "KrogerUserProductPreferences_createdAt_idx" ON "KrogerUserProductPreferences"("createdAt");

-- CreateIndex
CREATE INDEX "KrogerUserProductPreferences_updatedAt_idx" ON "KrogerUserProductPreferences"("updatedAt");

-- CreateIndex
CREATE INDEX "KrogerProduct_krogerProductId_idx" ON "KrogerProduct"("krogerProductId");

-- CreateIndex
CREATE INDEX "KrogerProduct_upc_idx" ON "KrogerProduct"("upc");

-- CreateIndex
CREATE INDEX "KrogerProduct_category_idx" ON "KrogerProduct"("category");

-- CreateIndex
CREATE INDEX "KrogerProduct_lastFetchedAt_idx" ON "KrogerProduct"("lastFetchedAt");

-- CreateIndex
CREATE INDEX "KrogerProduct_createdAt_idx" ON "KrogerProduct"("createdAt");

-- CreateIndex
CREATE INDEX "KrogerProduct_updatedAt_idx" ON "KrogerProduct"("updatedAt");

-- CreateIndex
CREATE INDEX "KrogerProduct_storeId_idx" ON "KrogerProduct"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "KrogerProduct_krogerProductId_storeId_key" ON "KrogerProduct"("krogerProductId", "storeId");

-- CreateIndex
CREATE INDEX "KrogerCartRun_userId_idx" ON "KrogerCartRun"("userId");

-- CreateIndex
CREATE INDEX "KrogerCartRun_shoppingListId_idx" ON "KrogerCartRun"("shoppingListId");

-- CreateIndex
CREATE INDEX "KrogerCartRun_status_idx" ON "KrogerCartRun"("status");

-- CreateIndex
CREATE INDEX "KrogerCartRun_storeId_idx" ON "KrogerCartRun"("storeId");

-- CreateIndex
CREATE INDEX "KrogerCartRun_createdAt_idx" ON "KrogerCartRun"("createdAt");

-- CreateIndex
CREATE INDEX "KrogerCartRun_updatedAt_idx" ON "KrogerCartRun"("updatedAt");

-- CreateIndex
CREATE INDEX "KrogerCartRunItem_cartRunId_idx" ON "KrogerCartRunItem"("cartRunId");

-- CreateIndex
CREATE INDEX "KrogerCartRunItem_krogerProductId_idx" ON "KrogerCartRunItem"("krogerProductId");

-- CreateIndex
CREATE INDEX "KrogerCartRunItem_status_idx" ON "KrogerCartRunItem"("status");

-- CreateIndex
CREATE INDEX "KrogerCartRunItem_createdAt_idx" ON "KrogerCartRunItem"("createdAt");

-- CreateIndex
CREATE INDEX "KrogerCartRunItem_updatedAt_idx" ON "KrogerCartRunItem"("updatedAt");

-- AddForeignKey
ALTER TABLE "KrogerConnection" ADD CONSTRAINT "KrogerConnection_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "KrogerStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KrogerStore" ADD CONSTRAINT "KrogerStore_krogerAddressId_fkey" FOREIGN KEY ("krogerAddressId") REFERENCES "KrogerAddress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KrogerStore" ADD CONSTRAINT "KrogerStore_krogerGeolocationId_fkey" FOREIGN KEY ("krogerGeolocationId") REFERENCES "KrogerGeolocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KrogerStore" ADD CONSTRAINT "KrogerStore_krogerStoreHoursId_fkey" FOREIGN KEY ("krogerStoreHoursId") REFERENCES "KrogerStoreHours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KrogerStoreCapabilities" ADD CONSTRAINT "KrogerStoreCapabilities_krogerStoreId_fkey" FOREIGN KEY ("krogerStoreId") REFERENCES "KrogerStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KrogerPreferredProduct" ADD CONSTRAINT "KrogerPreferredProduct_krogerProductId_fkey" FOREIGN KEY ("krogerProductId") REFERENCES "KrogerProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KrogerCartRun" ADD CONSTRAINT "KrogerCartRun_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "KrogerStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KrogerCartRunItem" ADD CONSTRAINT "KrogerCartRunItem_cartRunId_fkey" FOREIGN KEY ("cartRunId") REFERENCES "KrogerCartRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KrogerCartRunItem" ADD CONSTRAINT "KrogerCartRunItem_krogerProductId_fkey" FOREIGN KEY ("krogerProductId") REFERENCES "KrogerProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
