-- August grade promotion marker and course reviews. Additive: nothing is dropped or changed.
ALTER TABLE "User" ADD COLUMN "gradePromotedYear" INTEGER;

CREATE TYPE "ReviewStatus" AS ENUM ('PUBLISHED', 'HELD', 'REMOVED');

CREATE TABLE "CourseReview" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "text" TEXT,
    "status" "ReviewStatus" NOT NULL,
    "adminNote" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CourseReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseReview_courseId_studentId_key" ON "CourseReview"("courseId", "studentId");
CREATE INDEX "CourseReview_courseId_status_idx" ON "CourseReview"("courseId", "status");
CREATE INDEX "CourseReview_status_createdAt_idx" ON "CourseReview"("status", "createdAt");

ALTER TABLE "CourseReview" ADD CONSTRAINT "CourseReview_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseReview" ADD CONSTRAINT "CourseReview_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
