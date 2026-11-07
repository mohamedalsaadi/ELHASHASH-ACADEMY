-- CreateTable
CREATE TABLE "SuggestionDigest" (
    "id" TEXT NOT NULL,
    "locale" VARCHAR(2) NOT NULL,
    "count" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuggestionDigest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "kind" VARCHAR(12) NOT NULL,
    "message" VARCHAR(1500) NOT NULL,
    "role" VARCHAR(12) NOT NULL,
    "locale" VARCHAR(2) NOT NULL,
    "digestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Suggestion_digestId_createdAt_idx" ON "Suggestion"("digestId", "createdAt");

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_digestId_fkey" FOREIGN KEY ("digestId") REFERENCES "SuggestionDigest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
