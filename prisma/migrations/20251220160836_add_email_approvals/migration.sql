-- CreateTable
CREATE TABLE "EmailApproval" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "gmailDraftId" TEXT,
    "to" TEXT[],
    "cc" TEXT[],
    "bcc" TEXT[],
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "threadId" TEXT,
    "inReplyTo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedBy" TEXT,
    "expiresAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "sentMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "notes" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailApproval_draftId_key" ON "EmailApproval"("draftId");

-- CreateIndex
CREATE INDEX "EmailApproval_userId_status_idx" ON "EmailApproval"("userId", "status");

-- CreateIndex
CREATE INDEX "EmailApproval_userId_requestedAt_idx" ON "EmailApproval"("userId", "requestedAt" DESC);

-- CreateIndex
CREATE INDEX "EmailApproval_expiresAt_idx" ON "EmailApproval"("expiresAt");

-- AddForeignKey
ALTER TABLE "EmailApproval" ADD CONSTRAINT "EmailApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
