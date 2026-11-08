-- AlterTable
ALTER TABLE "GuardianConsent" ADD COLUMN "guardianPhone" TEXT,
ADD COLUMN "viaWhatsApp" BOOLEAN NOT NULL DEFAULT false;
