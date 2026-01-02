/*
  Warnings:

  - You are about to drop the column `nutritionInformationId` on the `KrogerProduct` table. All the data in the column will be lost.
  - You are about to drop the column `nutritionInformation` on the `KrogerProductNutritionInformation` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[productId]` on the table `KrogerProductNutritionInformation` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `dailyValueIntakeReference` to the `KrogerProductNutritionInformation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ingredientStatement` to the `KrogerProductNutritionInformation` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "KrogerProduct" DROP CONSTRAINT "KrogerProduct_nutritionInformationId_fkey";

-- AlterTable
ALTER TABLE "KrogerProduct" DROP COLUMN "nutritionInformationId";

-- AlterTable
ALTER TABLE "KrogerProductNutritionInformation" DROP COLUMN "nutritionInformation",
ADD COLUMN     "dailyValueIntakeReference" TEXT NOT NULL,
ADD COLUMN     "ingredientStatement" TEXT NOT NULL,
ADD COLUMN     "preparationStateCode" TEXT,
ADD COLUMN     "preparationStateName" TEXT,
ADD COLUMN     "servingDescription" TEXT,
ADD COLUMN     "servingQuantity" INTEGER,
ADD COLUMN     "servingUnitOfMeasure" TEXT,
ADD COLUMN     "servingsPerPackageDescription" TEXT,
ADD COLUMN     "servingsPerPackageValue" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "KrogerProductNutritionInformation_productId_key" ON "KrogerProductNutritionInformation"("productId");

-- CreateIndex
CREATE INDEX "KrogerProductNutritionInformation_productId_idx" ON "KrogerProductNutritionInformation"("productId");

-- CreateIndex
CREATE INDEX "KrogerProductNutritionInformation_createdAt_idx" ON "KrogerProductNutritionInformation"("createdAt");

-- CreateIndex
CREATE INDEX "KrogerProductNutritionInformation_updatedAt_idx" ON "KrogerProductNutritionInformation"("updatedAt");

-- AddForeignKey
ALTER TABLE "KrogerProductNutritionInformation" ADD CONSTRAINT "KrogerProductNutritionInformation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "KrogerProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
