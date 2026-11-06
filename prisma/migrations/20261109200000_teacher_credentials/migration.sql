-- Credentials a teacher states publicly: years teaching and qualification. Optional, so existing rows are untouched.
ALTER TABLE "User" ADD COLUMN "yearsTeaching" INTEGER;
ALTER TABLE "User" ADD COLUMN "qualification" VARCHAR(120);
