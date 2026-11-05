-- Automatic AI grading becomes opt-in per course. Existing courses keep it off, so nothing that is
-- already running starts sending student work to an external model on deploy.
ALTER TABLE "Course" ADD COLUMN "aiGrading" BOOLEAN NOT NULL DEFAULT false;
