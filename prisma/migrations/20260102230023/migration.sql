/*
  Warnings:

  - You are about to drop the column `krogerProductId` on the `KrogerCartRunItem` table. All the data in the column will be lost.
  - You are about to drop the column `ingredientKey` on the `KrogerPreferredProduct` table. All the data in the column will be lost.
  - You are about to drop the column `krogerProductId` on the `KrogerPreferredProduct` table. All the data in the column will be lost.
  - You are about to alter the column `longitude` on the `KrogerStore` table. The data in that column could be lost. The data in that column will be cast from `Decimal(11,8)` to `Decimal(10,8)`.
  - You are about to drop the `KrogerUserProductPreferences` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[userId,productId]` on the table `KrogerPreferredProduct` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `productId` to the `KrogerCartRunItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productId` to the `KrogerPreferredProduct` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "KrogerCartRunItem" DROP CONSTRAINT "KrogerCartRunItem_krogerProductId_fkey";

-- DropForeignKey
ALTER TABLE "KrogerPreferredProduct" DROP CONSTRAINT "KrogerPreferredProduct_krogerProductId_fkey";

-- DropIndex
DROP INDEX "KrogerCartRunItem_krogerProductId_idx";

-- AlterTable
ALTER TABLE "KrogerCartRunItem" DROP COLUMN "krogerProductId",
ADD COLUMN     "productId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "KrogerPreferredProduct" DROP COLUMN "ingredientKey",
DROP COLUMN "krogerProductId",
ADD COLUMN     "productId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "KrogerStore" ALTER COLUMN "longitude" SET DATA TYPE DECIMAL(10,8);

-- DropTable
DROP TABLE "KrogerUserProductPreferences";

-- CreateTable
CREATE TABLE "KrogerUserPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferOrganic" BOOLEAN NOT NULL DEFAULT false,
    "preferStorebrands" BOOLEAN NOT NULL DEFAULT false,
    "preferredBrands" TEXT[],
    "avoidBrands" TEXT[],
    "dietaryRestrictions" TEXT NOT NULL DEFAULT 'NONE',
    "defaultQuantityBehavior" TEXT NOT NULL DEFAULT 'EXACT',
    "maxPriceVariancePercent" INTEGER NOT NULL DEFAULT 25,
    "preferredStoreId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KrogerUserPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KrogerUserPreferences_userId_idx" ON "KrogerUserPreferences"("userId");

-- CreateIndex
CREATE INDEX "KrogerUserPreferences_createdAt_idx" ON "KrogerUserPreferences"("createdAt");

-- CreateIndex
CREATE INDEX "KrogerUserPreferences_updatedAt_idx" ON "KrogerUserPreferences"("updatedAt");

-- CreateIndex
CREATE INDEX "KrogerCartRunItem_productId_idx" ON "KrogerCartRunItem"("productId");

-- CreateIndex
CREATE INDEX "KrogerPreferredProduct_userId_idx" ON "KrogerPreferredProduct"("userId");

-- CreateIndex
CREATE INDEX "KrogerPreferredProduct_productId_idx" ON "KrogerPreferredProduct"("productId");

-- CreateIndex
CREATE INDEX "KrogerPreferredProduct_createdAt_idx" ON "KrogerPreferredProduct"("createdAt");

-- CreateIndex
CREATE INDEX "KrogerPreferredProduct_updatedAt_idx" ON "KrogerPreferredProduct"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "KrogerPreferredProduct_userId_productId_key" ON "KrogerPreferredProduct"("userId", "productId");

-- AddForeignKey
ALTER TABLE "KrogerUserPreferences" ADD CONSTRAINT "KrogerUserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KrogerUserPreferences" ADD CONSTRAINT "KrogerUserPreferences_preferredStoreId_fkey" FOREIGN KEY ("preferredStoreId") REFERENCES "KrogerStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KrogerPreferredProduct" ADD CONSTRAINT "KrogerPreferredProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "KrogerProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KrogerCartRunItem" ADD CONSTRAINT "KrogerCartRunItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "KrogerProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
