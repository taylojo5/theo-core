/*
  Warnings:

  - You are about to drop the `KrogerCartRun` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `KrogerCartRunItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "KrogerCartRun" DROP CONSTRAINT "KrogerCartRun_storeId_fkey";

-- DropForeignKey
ALTER TABLE "KrogerCartRunItem" DROP CONSTRAINT "KrogerCartRunItem_cartRunId_fkey";

-- DropForeignKey
ALTER TABLE "KrogerCartRunItem" DROP CONSTRAINT "KrogerCartRunItem_productId_fkey";

-- DropTable
DROP TABLE "KrogerCartRun";

-- DropTable
DROP TABLE "KrogerCartRunItem";
