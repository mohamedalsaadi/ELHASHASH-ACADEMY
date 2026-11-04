-- Guardian consent for live lectures, one row per student. Only a parent account can write it.
CREATE TABLE "GuardianConsent" (
    "studentId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "guardianName" TEXT NOT NULL,
    "rulesVersion" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardianConsent_pkey" PRIMARY KEY ("studentId")
);

CREATE INDEX "GuardianConsent_parentId_idx" ON "GuardianConsent"("parentId");

ALTER TABLE "GuardianConsent" ADD CONSTRAINT "GuardianConsent_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuardianConsent" ADD CONSTRAINT "GuardianConsent_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
