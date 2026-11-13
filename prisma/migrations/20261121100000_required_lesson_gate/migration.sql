-- Mandatory homework and exams: a flag on each, and exams can follow a lesson. Additive, nothing is dropped, nothing is required until a teacher turns it on.
ALTER TABLE "Assignment" ADD COLUMN "required" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ExamPaper" ADD COLUMN "lessonId" TEXT;
ALTER TABLE "ExamPaper" ADD COLUMN "required" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ExamPaper" ADD CONSTRAINT "ExamPaper_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "ExamPaper_lessonId_idx" ON "ExamPaper"("lessonId");
