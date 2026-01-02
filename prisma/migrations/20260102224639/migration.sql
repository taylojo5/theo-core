/*
  Warnings:

  - You are about to drop the column `capabilities` on the `KrogerStore` table. All the data in the column will be lost.
  - You are about to drop the column `departments` on the `KrogerStore` table. All the data in the column will be lost.
  - You are about to drop the column `distanceMiles` on the `KrogerStore` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "KrogerStore_departments_idx";

-- DropIndex
DROP INDEX "KrogerStore_distanceMiles_idx";

-- AlterTable
ALTER TABLE "KrogerStore" DROP COLUMN "capabilities",
DROP COLUMN "departments",
DROP COLUMN "distanceMiles",
ALTER COLUMN "gmtOffset" SET DATA TYPE TEXT;
