-- Additive only: a new question kind, question pictures/PDF pages, several ticked choices, and AI marking suggestions.
ALTER TYPE "QuestionKind" ADD VALUE 'MULTI';
ALTER TABLE "QuestionItem" ADD COLUMN "media" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "PracticeAnswer" ADD COLUMN "choiceIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ExamAnswer" ADD COLUMN "choiceIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ExamAnswer" ADD COLUMN "aiMarks" INTEGER;
ALTER TABLE "ExamAnswer" ADD COLUMN "aiFeedback" VARCHAR(1000);
