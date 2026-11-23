-- CreateTable
CREATE TABLE "PremiereSeen" (
    "premiereId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PremiereSeen_pkey" PRIMARY KEY ("premiereId","userId")
);

-- CreateIndex
CREATE INDEX "PremiereSeen_premiereId_seenAt_idx" ON "PremiereSeen"("premiereId", "seenAt");

-- AddForeignKey
ALTER TABLE "PremiereSeen" ADD CONSTRAINT "PremiereSeen_premiereId_fkey" FOREIGN KEY ("premiereId") REFERENCES "Premiere"("id") ON DELETE CASCADE ON UPDATE CASCADE;
