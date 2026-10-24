-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CountryCode" ADD VALUE 'SA';
ALTER TYPE "CountryCode" ADD VALUE 'KW';
ALTER TYPE "CountryCode" ADD VALUE 'QA';
ALTER TYPE "CountryCode" ADD VALUE 'BH';
ALTER TYPE "CountryCode" ADD VALUE 'OM';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Currency" ADD VALUE 'SAR';
ALTER TYPE "Currency" ADD VALUE 'KWD';
ALTER TYPE "Currency" ADD VALUE 'QAR';
ALTER TYPE "Currency" ADD VALUE 'BHD';
ALTER TYPE "Currency" ADD VALUE 'OMR';

-- AlterTable
ALTER TABLE "Country" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "instructorId" TEXT;

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "icon" TEXT NOT NULL DEFAULT 'book';

-- CreateTable
CREATE TABLE "GradeSubject" (
    "gradeId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "GradeSubject_pkey" PRIMARY KEY ("gradeId","subjectId")
);

-- AddForeignKey
ALTER TABLE "GradeSubject" ADD CONSTRAINT "GradeSubject_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeSubject" ADD CONSTRAINT "GradeSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

