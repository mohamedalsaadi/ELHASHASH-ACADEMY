-- AlterEnum
ALTER TYPE "AccessType" ADD VALUE 'MONTHLY';

-- AlterTable
ALTER TABLE "Entitlement" ADD COLUMN     "accessType" "AccessType",
ADD COLUMN     "month" INTEGER,
ADD COLUMN     "term" INTEGER;

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "month" INTEGER;

-- AlterTable
ALTER TABLE "Sku" ADD COLUMN     "month" INTEGER,
ADD COLUMN     "term" INTEGER;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "term" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "body" VARCHAR(1500) NOT NULL,
    "answer" VARCHAR(4000),
    "answeredById" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Question_lessonId_idx" ON "Question"("lessonId");

-- CreateIndex
CREATE INDEX "Question_userId_idx" ON "Question"("userId");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

