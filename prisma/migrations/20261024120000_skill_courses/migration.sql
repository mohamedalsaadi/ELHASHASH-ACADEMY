-- CreateEnum
CREATE TYPE "CourseKind" AS ENUM ('SCHOOL', 'SKILL');

-- AlterEnum
ALTER TYPE "AccessType" ADD VALUE 'FIXED_DAYS';

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "kind" "CourseKind" NOT NULL DEFAULT 'SCHOOL',
ALTER COLUMN "gradeId" DROP NOT NULL,
ALTER COLUMN "subjectId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Sku" ADD COLUMN     "accessDays" INTEGER;

