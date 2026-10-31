-- CreateEnum
CREATE TYPE "LedgerKind" AS ENUM ('SALE', 'REFUND');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "coverKey" TEXT,
ADD COLUMN     "coverType" TEXT,
ADD COLUMN     "headlineAr" TEXT,
ADD COLUMN     "headlineEn" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "vat" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "vatRateBp" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "photoType" TEXT;

-- CreateTable
CREATE TABLE "TeacherInvite" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherInviteSlot" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,

    CONSTRAINT "TeacherInviteSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherSlot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "kind" "LedgerKind" NOT NULL DEFAULT 'SALE',
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "instructorId" TEXT,
    "courseId" TEXT NOT NULL,
    "subjectId" TEXT,
    "gradeId" TEXT,
    "currency" "Currency" NOT NULL,
    "gross" INTEGER NOT NULL,
    "vat" INTEGER NOT NULL DEFAULT 0,
    "net" INTEGER NOT NULL,
    "platformFee" INTEGER NOT NULL,
    "instructorNet" INTEGER NOT NULL,
    "vatRateBp" INTEGER NOT NULL DEFAULT 0,
    "platformShareBp" INTEGER NOT NULL DEFAULT 3000,
    "reversalOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "vatEnabled" BOOLEAN NOT NULL DEFAULT false,
    "vatRateBp" INTEGER NOT NULL DEFAULT 500,
    "vatTrn" TEXT,
    "platformShareBp" INTEGER NOT NULL DEFAULT 3000,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "courseId" TEXT,
    "props" JSONB,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeacherInvite_tokenHash_key" ON "TeacherInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "TeacherInvite_email_idx" ON "TeacherInvite"("email");

-- CreateIndex
CREATE INDEX "TeacherInvite_phone_idx" ON "TeacherInvite"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherInviteSlot_inviteId_gradeId_subjectId_key" ON "TeacherInviteSlot"("inviteId", "gradeId", "subjectId");

-- CreateIndex
CREATE INDEX "TeacherSlot_gradeId_subjectId_idx" ON "TeacherSlot"("gradeId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherSlot_userId_gradeId_subjectId_key" ON "TeacherSlot"("userId", "gradeId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_reversalOfId_key" ON "LedgerEntry"("reversalOfId");

-- CreateIndex
CREATE INDEX "LedgerEntry_orderId_idx" ON "LedgerEntry"("orderId");

-- CreateIndex
CREATE INDEX "LedgerEntry_instructorId_createdAt_idx" ON "LedgerEntry"("instructorId", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_courseId_createdAt_idx" ON "LedgerEntry"("courseId", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_kind_createdAt_idx" ON "LedgerEntry"("kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_orderItemId_kind_key" ON "LedgerEntry"("orderItemId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsEvent_dedupeKey_key" ON "AnalyticsEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_name_createdAt_idx" ON "AnalyticsEvent"("name", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_userId_createdAt_idx" ON "AnalyticsEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_sessionId_createdAt_idx" ON "AnalyticsEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_courseId_createdAt_idx" ON "AnalyticsEvent"("courseId", "createdAt");

-- AddForeignKey
ALTER TABLE "TeacherInviteSlot" ADD CONSTRAINT "TeacherInviteSlot_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "TeacherInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherInviteSlot" ADD CONSTRAINT "TeacherInviteSlot_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherInviteSlot" ADD CONSTRAINT "TeacherInviteSlot_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSlot" ADD CONSTRAINT "TeacherSlot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSlot" ADD CONSTRAINT "TeacherSlot_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSlot" ADD CONSTRAINT "TeacherSlot_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
