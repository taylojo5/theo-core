/*
  Warnings:

  - A unique constraint covering the columns `[userId,draftId]` on the table `EmailApproval` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "EmailApproval_draftId_key";

-- CreateIndex
CREATE UNIQUE INDEX "EmailApproval_userId_draftId_key" ON "EmailApproval"("userId", "draftId");
