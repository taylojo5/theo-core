/*
  Warnings:

  - You are about to drop the column `krogerAddressId` on the `KrogerStore` table. All the data in the column will be lost.
  - You are about to drop the column `krogerGeolocationId` on the `KrogerStore` table. All the data in the column will be lost.
  - You are about to drop the column `krogerStoreHoursId` on the `KrogerStore` table. All the data in the column will be lost.
  - You are about to drop the `KrogerAddress` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `KrogerGeolocation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `KrogerStoreCapabilities` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `KrogerStoreHours` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `addressLine1` to the `KrogerStore` table without a default value. This is not possible if the table is not empty.
  - Added the required column `capabilities` to the `KrogerStore` table without a default value. This is not possible if the table is not empty.
  - Added the required column `city` to the `KrogerStore` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hours` to the `KrogerStore` table without a default value. This is not possible if the table is not empty.
  - Added the required column `state` to the `KrogerStore` table without a default value. This is not possible if the table is not empty.
  - Added the required column `zipCode` to the `KrogerStore` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "KrogerStore" DROP CONSTRAINT "KrogerStore_krogerAddressId_fkey";

-- DropForeignKey
ALTER TABLE "KrogerStore" DROP CONSTRAINT "KrogerStore_krogerGeolocationId_fkey";

-- DropForeignKey
ALTER TABLE "KrogerStore" DROP CONSTRAINT "KrogerStore_krogerStoreHoursId_fkey";

-- DropForeignKey
ALTER TABLE "KrogerStoreCapabilities" DROP CONSTRAINT "KrogerStoreCapabilities_krogerStoreId_fkey";

-- AlterTable
ALTER TABLE "KrogerStore" DROP COLUMN "krogerAddressId",
DROP COLUMN "krogerGeolocationId",
DROP COLUMN "krogerStoreHoursId",
ADD COLUMN     "addressLine1" TEXT NOT NULL,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "capabilities" JSONB NOT NULL,
ADD COLUMN     "city" TEXT NOT NULL,
ADD COLUMN     "county" TEXT,
ADD COLUMN     "gmtOffset" INTEGER,
ADD COLUMN     "hours" JSON NOT NULL,
ADD COLUMN     "latitude" DECIMAL(10,8),
ADD COLUMN     "longitude" DECIMAL(11,8),
ADD COLUMN     "open24Hours" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "state" TEXT NOT NULL,
ADD COLUMN     "timezone" TEXT,
ADD COLUMN     "zipCode" TEXT NOT NULL;

-- DropTable
DROP TABLE "KrogerAddress";

-- DropTable
DROP TABLE "KrogerGeolocation";

-- DropTable
DROP TABLE "KrogerStoreCapabilities";

-- DropTable
DROP TABLE "KrogerStoreHours";

-- CreateTable
CREATE TABLE "KrogerStoreDepartment" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "county" TEXT,
    "timezone" TEXT,
    "gmtOffset" INTEGER,
    "hours" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "krogerStoreId" TEXT NOT NULL,

    CONSTRAINT "KrogerStoreDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KrogerStoreDepartment_departmentId_idx" ON "KrogerStoreDepartment"("departmentId");

-- CreateIndex
CREATE INDEX "KrogerStoreDepartment_krogerStoreId_idx" ON "KrogerStoreDepartment"("krogerStoreId");

-- CreateIndex
CREATE INDEX "KrogerStoreDepartment_createdAt_idx" ON "KrogerStoreDepartment"("createdAt");

-- CreateIndex
CREATE INDEX "KrogerStoreDepartment_updatedAt_idx" ON "KrogerStoreDepartment"("updatedAt");

-- CreateIndex
CREATE INDEX "KrogerStoreDepartment_name_idx" ON "KrogerStoreDepartment"("name");

-- CreateIndex
CREATE INDEX "KrogerStoreDepartment_phone_idx" ON "KrogerStoreDepartment"("phone");

-- CreateIndex
CREATE INDEX "KrogerStoreDepartment_hours_idx" ON "KrogerStoreDepartment"("hours");

-- AddForeignKey
ALTER TABLE "KrogerStoreDepartment" ADD CONSTRAINT "KrogerStoreDepartment_krogerStoreId_fkey" FOREIGN KEY ("krogerStoreId") REFERENCES "KrogerStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
