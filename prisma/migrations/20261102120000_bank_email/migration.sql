-- CreateEnum
CREATE TYPE "BankEmailStatus" AS ENUM ('RECEIVED', 'AUTO_APPROVED', 'NEEDS_REVIEW', 'MATCHED', 'REJECTED', 'DUPLICATE', 'FAILED');

-- AlterTable
ALTER TABLE "PlatformSetting" ADD COLUMN     "bankAutoApprove" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BankEmail" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "auth" JSONB,
    "parsed" JSONB,
    "amount" INTEGER,
    "currency" "Currency",
    "senderName" TEXT,
    "reference" TEXT,
    "bankTransactionId" TEXT,
    "valueDate" DATE,
    "status" "BankEmailStatus" NOT NULL DEFAULT 'RECEIVED',
    "reason" TEXT,
    "orderId" TEXT,
    "matchedById" TEXT,
    "matchedAt" TIMESTAMP(3),
    "bodyText" VARCHAR(20000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankEmail_messageId_key" ON "BankEmail"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "BankEmail_bankTransactionId_key" ON "BankEmail"("bankTransactionId");

-- CreateIndex
CREATE INDEX "BankEmail_status_createdAt_idx" ON "BankEmail"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BankEmail_orderId_idx" ON "BankEmail"("orderId");

-- AddForeignKey
ALTER TABLE "BankEmail" ADD CONSTRAINT "BankEmail_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
