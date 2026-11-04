-- Live streaming is hidden by default. An admin approves one teacher at a time, so nothing
-- changes for existing teachers: they all start at false.
ALTER TABLE "User" ADD COLUMN "liveApproved" BOOLEAN NOT NULL DEFAULT false;
