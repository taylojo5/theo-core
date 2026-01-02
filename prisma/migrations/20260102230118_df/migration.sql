/*
  Warnings:

  - You are about to drop the column `storeId` on the `KrogerConnection` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "KrogerConnection" DROP CONSTRAINT "KrogerConnection_storeId_fkey";

-- DropIndex
DROP INDEX "KrogerConnection_storeId_idx";

-- AlterTable
ALTER TABLE "KrogerConnection" DROP COLUMN "storeId",
ADD COLUMN     "krogerStoreId" TEXT;

-- AddForeignKey
ALTER TABLE "KrogerConnection" ADD CONSTRAINT "KrogerConnection_krogerStoreId_fkey" FOREIGN KEY ("krogerStoreId") REFERENCES "KrogerStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;
