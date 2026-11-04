-- One-tap self-report after a lesson. Nullable: existing rows mean "not answered", not "lost".
CREATE TYPE "LessonConfidence" AS ENUM ('GOT_IT', 'SHAKY', 'LOST');
ALTER TABLE "LessonView" ADD COLUMN "confidence" "LessonConfidence";
