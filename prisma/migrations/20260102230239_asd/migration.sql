/*
  Warnings:

  - You are about to drop the column `krogerStoreId` on the `KrogerConnection` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "KrogerConnection" DROP CONSTRAINT "KrogerConnection_krogerStoreId_fkey";

-- AlterTable
ALTER TABLE "KrogerConnection" DROP COLUMN "krogerStoreId";
