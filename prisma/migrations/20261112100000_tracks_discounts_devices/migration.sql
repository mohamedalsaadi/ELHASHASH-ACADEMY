-- General and Advanced tracks, per-teacher discount cap, device cap, homework link, new-course alerts. All additive.
CREATE TYPE "GradeTrack" AS ENUM ('GENERAL', 'ADVANCED');

ALTER TABLE "Grade" ADD COLUMN "track" "GradeTrack" NOT NULL DEFAULT 'GENERAL';
DROP INDEX "Grade_countryId_curriculum_level_key";
CREATE UNIQUE INDEX "Grade_countryId_curriculum_level_track_key" ON "Grade"("countryId", "curriculum", "level", "track");

ALTER TABLE "User" ADD COLUMN "maxDiscountPct" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "Course" ADD COLUMN "maxDevices" INTEGER;
ALTER TABLE "PlayEvent" ADD COLUMN "deviceId" TEXT;
ALTER TABLE "Assignment" ADD COLUMN "linkUrl" VARCHAR(500);

ALTER TYPE "NotificationKind" ADD VALUE 'NEW_COURSE';
