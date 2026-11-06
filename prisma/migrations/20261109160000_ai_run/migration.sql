-- Usage is computed on every model call and currently thrown away, so nobody can say what AI costs.
CREATE TABLE "AiRun" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actorId" TEXT,
    "studentId" TEXT,
    "model" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiRun_kind_createdAt_idx" ON "AiRun"("kind", "createdAt");
CREATE INDEX "AiRun_studentId_createdAt_idx" ON "AiRun"("studentId", "createdAt");
