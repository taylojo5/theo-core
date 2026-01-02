/*
  Warnings:

  - You are about to drop the column `available` on the `KrogerProduct` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `KrogerProduct` table. All the data in the column will be lost.
  - You are about to drop the column `estimatedAvailability` on the `KrogerProduct` table. All the data in the column will be lost.
  - You are about to drop the column `fulfillmentTypes` on the `KrogerProduct` table. All the data in the column will be lost.
  - You are about to drop the column `images` on the `KrogerProduct` table. All the data in the column will be lost.
  - You are about to drop the column `isGlutenFree` on the `KrogerProduct` table. All the data in the column will be lost.
  - You are about to drop the column `isKosher` on the `KrogerProduct` table. All the data in the column will be lost.
  - You are about to drop the column `isLocallyGrown` on the `KrogerProduct` table. All the data in the column will be lost.
  - You are about to drop the column `isOrganic` on the `KrogerProduct` table. All the data in the column will be lost.
  - You are about to drop the column `isPrivateLabel` on the `KrogerProduct` table. All the data in the column will be lost.
  - You are about to drop the column `isVegan` on the `KrogerProduct` table. All the data in the column will be lost.
  - You are about to drop the column `isVegetarian` on the `KrogerProduct` table. All the data in the column will be lost.
  - You are about to drop the column `krogerProductId` on the `KrogerProduct` table. All the data in the column will be lost.
  - You are about to drop the column `priceLoyalty` on the `KrogerProduct` table. All the data in the column will be lost.
  - You are about to drop the column `pricePromo` on the `KrogerProduct` table. All the data in the column will be lost.
  - You are about to drop the column `priceRegular` on the `KrogerProduct` table. All the data in the column will be lost.
  - You are about to drop the column `priceUnit` on the `KrogerProduct` table. All the data in the column will be lost.
  - You are about to drop the column `priceUnitLabel` on the `KrogerProduct` table. All the data in the column will be lost.
  - You are about to drop the column `promoDescription` on the `KrogerProduct` table. All the data in the column will be lost.
  - You are about to drop the column `size` on the `KrogerProduct` table. All the data in the column will be lost.
  - You are about to drop the column `sizeQuantity` on the `KrogerProduct` table. All the data in the column will be lost.
  - You are about to drop the column `soldAs` on the `KrogerProduct` table. All the data in the column will be lost.
  - You are about to drop the column `stockLevel` on the `KrogerProduct` table. All the data in the column will be lost.
  - You are about to drop the column `storeId` on the `KrogerProduct` table. All the data in the column will be lost.
  - You are about to drop the column `subcategory` on the `KrogerProduct` table. All the data in the column will be lost.
  - You are about to drop the column `temperature` on the `KrogerProduct` table. All the data in the column will be lost.
  - You are about to drop the column `unitOfMeasure` on the `KrogerProduct` table. All the data in the column will be lost.
  - Added the required column `ageRestriction` to the `KrogerProduct` table without a default value. This is not possible if the table is not empty.
  - Added the required column `alcohol` to the `KrogerProduct` table without a default value. This is not possible if the table is not empty.
  - Added the required column `alcoholProof` to the `KrogerProduct` table without a default value. This is not possible if the table is not empty.
  - Added the required column `allergensDescription` to the `KrogerProduct` table without a default value. This is not possible if the table is not empty.
  - Added the required column `certifiedForPassover` to the `KrogerProduct` table without a default value. This is not possible if the table is not empty.
  - Added the required column `heatSensitive` to the `KrogerProduct` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hypoallergenic` to the `KrogerProduct` table without a default value. This is not possible if the table is not empty.
  - Added the required column `itemInformation` to the `KrogerProduct` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nonGmo` to the `KrogerProduct` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nonGmoClaimName` to the `KrogerProduct` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organicClaimName` to the `KrogerProduct` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productId` to the `KrogerProduct` table without a default value. This is not possible if the table is not empty.
  - Added the required column `receiptDescription` to the `KrogerProduct` table without a default value. This is not possible if the table is not empty.
  - Added the required column `snapEligible` to the `KrogerProduct` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sweeteningMethods` to the `KrogerProduct` table without a default value. This is not possible if the table is not empty.
  - Added the required column `temperatureIndicator` to the `KrogerProduct` table without a default value. This is not possible if the table is not empty.
  - Added the required column `warnings` to the `KrogerProduct` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "KrogerProduct_category_idx";

-- DropIndex
DROP INDEX "KrogerProduct_krogerProductId_idx";

-- DropIndex
DROP INDEX "KrogerProduct_krogerProductId_storeId_key";

-- DropIndex
DROP INDEX "KrogerProduct_storeId_idx";

-- AlterTable
ALTER TABLE "KrogerProduct" DROP COLUMN "available",
DROP COLUMN "category",
DROP COLUMN "estimatedAvailability",
DROP COLUMN "fulfillmentTypes",
DROP COLUMN "images",
DROP COLUMN "isGlutenFree",
DROP COLUMN "isKosher",
DROP COLUMN "isLocallyGrown",
DROP COLUMN "isOrganic",
DROP COLUMN "isPrivateLabel",
DROP COLUMN "isVegan",
DROP COLUMN "isVegetarian",
DROP COLUMN "krogerProductId",
DROP COLUMN "priceLoyalty",
DROP COLUMN "pricePromo",
DROP COLUMN "priceRegular",
DROP COLUMN "priceUnit",
DROP COLUMN "priceUnitLabel",
DROP COLUMN "promoDescription",
DROP COLUMN "size",
DROP COLUMN "sizeQuantity",
DROP COLUMN "soldAs",
DROP COLUMN "stockLevel",
DROP COLUMN "storeId",
DROP COLUMN "subcategory",
DROP COLUMN "temperature",
DROP COLUMN "unitOfMeasure",
ADD COLUMN     "ageRestriction" BOOLEAN NOT NULL,
ADD COLUMN     "alcohol" BOOLEAN NOT NULL,
ADD COLUMN     "alcoholProof" INTEGER NOT NULL,
ADD COLUMN     "allergens" TEXT[],
ADD COLUMN     "allergensDescription" TEXT NOT NULL,
ADD COLUMN     "averageRating" DECIMAL(10,2),
ADD COLUMN     "categories" TEXT[],
ADD COLUMN     "certifiedForPassover" BOOLEAN NOT NULL,
ADD COLUMN     "defaultImageUrl" TEXT,
ADD COLUMN     "heatSensitive" BOOLEAN NOT NULL,
ADD COLUMN     "hypoallergenic" BOOLEAN NOT NULL,
ADD COLUMN     "itemInformation" JSONB NOT NULL,
ADD COLUMN     "manufacturerDeclarations" TEXT[],
ADD COLUMN     "nonGmo" BOOLEAN NOT NULL,
ADD COLUMN     "nonGmoClaimName" TEXT NOT NULL,
ADD COLUMN     "nutritionInformationId" TEXT,
ADD COLUMN     "organicClaimName" TEXT NOT NULL,
ADD COLUMN     "productId" TEXT NOT NULL,
ADD COLUMN     "receiptDescription" TEXT NOT NULL,
ADD COLUMN     "snapEligible" BOOLEAN NOT NULL,
ADD COLUMN     "sweeteningMethods" TEXT NOT NULL,
ADD COLUMN     "temperatureIndicator" TEXT NOT NULL,
ADD COLUMN     "totalReviews" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "warnings" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "KrogerProductItem" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "stockLevel" TEXT NOT NULL DEFAULT 'HIGH',
    "curbsideAvailable" BOOLEAN NOT NULL DEFAULT false,
    "deliveryAvailable" BOOLEAN NOT NULL DEFAULT false,
    "instoreAvailable" BOOLEAN NOT NULL DEFAULT false,
    "shiptohomeAvailable" BOOLEAN NOT NULL DEFAULT false,
    "regularPrice" DECIMAL(10,2) NOT NULL,
    "promoPrice" DECIMAL(10,2) NOT NULL,
    "nationalPrice" DECIMAL(10,2) NOT NULL,
    "nationalPromoPrice" DECIMAL(10,2) NOT NULL,
    "size" TEXT NOT NULL,
    "soldBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KrogerProductItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KrogerProductNutritionInformation" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "nutritionInformation" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KrogerProductNutritionInformation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KrogerProductItem_productId_idx" ON "KrogerProductItem"("productId");

-- CreateIndex
CREATE INDEX "KrogerProductItem_storeId_idx" ON "KrogerProductItem"("storeId");

-- CreateIndex
CREATE INDEX "KrogerProductItem_createdAt_idx" ON "KrogerProductItem"("createdAt");

-- CreateIndex
CREATE INDEX "KrogerProductItem_updatedAt_idx" ON "KrogerProductItem"("updatedAt");

-- CreateIndex
CREATE INDEX "KrogerProductItem_stockLevel_idx" ON "KrogerProductItem"("stockLevel");

-- CreateIndex
CREATE INDEX "KrogerProductItem_curbsideAvailable_idx" ON "KrogerProductItem"("curbsideAvailable");

-- CreateIndex
CREATE INDEX "KrogerProductItem_deliveryAvailable_idx" ON "KrogerProductItem"("deliveryAvailable");

-- CreateIndex
CREATE INDEX "KrogerProductItem_instoreAvailable_idx" ON "KrogerProductItem"("instoreAvailable");

-- CreateIndex
CREATE INDEX "KrogerProductItem_shiptohomeAvailable_idx" ON "KrogerProductItem"("shiptohomeAvailable");

-- CreateIndex
CREATE INDEX "KrogerProductItem_regularPrice_idx" ON "KrogerProductItem"("regularPrice");

-- CreateIndex
CREATE INDEX "KrogerProductItem_promoPrice_idx" ON "KrogerProductItem"("promoPrice");

-- CreateIndex
CREATE INDEX "KrogerProductItem_nationalPrice_idx" ON "KrogerProductItem"("nationalPrice");

-- CreateIndex
CREATE INDEX "KrogerProductItem_nationalPromoPrice_idx" ON "KrogerProductItem"("nationalPromoPrice");

-- CreateIndex
CREATE INDEX "KrogerProductItem_size_idx" ON "KrogerProductItem"("size");

-- CreateIndex
CREATE INDEX "KrogerProductItem_soldBy_idx" ON "KrogerProductItem"("soldBy");

-- CreateIndex
CREATE INDEX "KrogerProduct_productId_idx" ON "KrogerProduct"("productId");

-- AddForeignKey
ALTER TABLE "KrogerProduct" ADD CONSTRAINT "KrogerProduct_nutritionInformationId_fkey" FOREIGN KEY ("nutritionInformationId") REFERENCES "KrogerProductNutritionInformation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KrogerProductItem" ADD CONSTRAINT "KrogerProductItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "KrogerProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KrogerProductItem" ADD CONSTRAINT "KrogerProductItem_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "KrogerStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
