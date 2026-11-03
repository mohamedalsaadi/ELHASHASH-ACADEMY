-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "TeacherCountry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherCountry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherCountryRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "note" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherCountryRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherApplication" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "bio" TEXT,
    "subjectsNote" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherApplicationCountry" (
    "applicationId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,

    CONSTRAINT "TeacherApplicationCountry_pkey" PRIMARY KEY ("applicationId","countryId")
);

-- CreateIndex
CREATE INDEX "TeacherCountry_countryId_idx" ON "TeacherCountry"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherCountry_userId_countryId_key" ON "TeacherCountry"("userId", "countryId");

-- CreateIndex
CREATE INDEX "TeacherCountryRequest_status_createdAt_idx" ON "TeacherCountryRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TeacherCountryRequest_userId_countryId_idx" ON "TeacherCountryRequest"("userId", "countryId");

-- CreateIndex
CREATE INDEX "TeacherApplication_status_createdAt_idx" ON "TeacherApplication"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TeacherApplication_email_idx" ON "TeacherApplication"("email");

-- CreateIndex
CREATE INDEX "TeacherApplication_phone_idx" ON "TeacherApplication"("phone");

-- AddForeignKey
ALTER TABLE "TeacherCountry" ADD CONSTRAINT "TeacherCountry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherCountry" ADD CONSTRAINT "TeacherCountry_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherCountryRequest" ADD CONSTRAINT "TeacherCountryRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherCountryRequest" ADD CONSTRAINT "TeacherCountryRequest_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherApplicationCountry" ADD CONSTRAINT "TeacherApplicationCountry_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "TeacherApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherApplicationCountry" ADD CONSTRAINT "TeacherApplicationCountry_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Back-fill: every country a teacher already works in through a slot becomes a stored grant.
INSERT INTO "TeacherCountry" ("id", "userId", "countryId")
SELECT gen_random_uuid()::text, ts."userId", g."countryId"
FROM "TeacherSlot" ts
JOIN "Grade" g ON g."id" = ts."gradeId"
GROUP BY ts."userId", g."countryId"
ON CONFLICT DO NOTHING;
