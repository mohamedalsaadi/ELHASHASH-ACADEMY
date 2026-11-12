-- A question belongs to a course; the lesson link becomes optional. Additive, with a backfill, no data is dropped.
ALTER TABLE "QuestionItem" ADD COLUMN "courseId" TEXT;
UPDATE "QuestionItem" q SET "courseId" = u."courseId" FROM "Lesson" l JOIN "Unit" u ON u.id = l."unitId" WHERE l.id = q."lessonId";
ALTER TABLE "QuestionItem" ALTER COLUMN "courseId" SET NOT NULL;
ALTER TABLE "QuestionItem" ALTER COLUMN "lessonId" DROP NOT NULL;
ALTER TABLE "QuestionItem" ADD CONSTRAINT "QuestionItem_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "QuestionItem_courseId_order_idx" ON "QuestionItem"("courseId", "order");
