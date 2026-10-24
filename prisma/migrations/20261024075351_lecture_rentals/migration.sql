-- AlterEnum
ALTER TYPE "AccessType" ADD VALUE 'RENTAL';

-- AlterTable
ALTER TABLE "Entitlement" ADD COLUMN     "lessonId" TEXT;

-- AlterTable
ALTER TABLE "Sku" ADD COLUMN     "lessonId" TEXT;

-- CreateIndex
CREATE INDEX "Sku_lessonId_idx" ON "Sku"("lessonId");

-- AddForeignKey
ALTER TABLE "Sku" ADD CONSTRAINT "Sku_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
