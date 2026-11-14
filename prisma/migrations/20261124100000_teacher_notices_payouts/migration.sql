-- Teacher notices (new question, new review), the payout record and a teacher's bank details. Additive.
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'QUESTION_NEW';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'REVIEW_NEW';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'PAYOUT_PAID';

ALTER TABLE "User" ADD COLUMN "payoutHolder" TEXT;
ALTER TABLE "User" ADD COLUMN "payoutIban" TEXT;
ALTER TABLE "User" ADD COLUMN "payoutBank" TEXT;

ALTER TABLE "TeacherStatement" ADD COLUMN "coversFrom" TIMESTAMP(3);
ALTER TABLE "TeacherStatement" ADD COLUMN "coversTo" TIMESTAMP(3);
ALTER TABLE "TeacherStatement" ADD COLUMN "payableAt" TIMESTAMP(3);
ALTER TABLE "TeacherStatement" ADD COLUMN "paidAt" TIMESTAMP(3);
ALTER TABLE "TeacherStatement" ADD COLUMN "paidReference" TEXT;
ALTER TABLE "TeacherStatement" ADD COLUMN "paidById" TEXT;
