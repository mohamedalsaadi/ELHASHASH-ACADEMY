-- Age assurance: a birth date, and a guardian email the student's guardian must confirm.

ALTER TABLE "User" ADD COLUMN "dateOfBirth" TIMESTAMP(3);

ALTER TABLE "GuardianConsent" ADD COLUMN "guardianEmail" TEXT;
ALTER TABLE "GuardianConsent" ADD COLUMN "verifiedAt" TIMESTAMP(3);
ALTER TABLE "GuardianConsent" ADD COLUMN "verifyTokenHash" TEXT;
ALTER TABLE "GuardianConsent" ADD COLUMN "verifyExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "GuardianConsent_verifyTokenHash_key" ON "GuardianConsent"("verifyTokenHash");

-- Legacy consent rows were a signup declaration before this flow existed. Do not lock those students out.
UPDATE "GuardianConsent" SET "verifiedAt" = "consentedAt" WHERE "verifiedAt" IS NULL;
