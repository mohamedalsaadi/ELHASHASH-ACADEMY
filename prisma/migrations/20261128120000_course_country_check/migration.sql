-- The "second country within 6 hours" play block is now a per-course option, off by default (a VPN looked like account sharing).
ALTER TABLE "Course" ADD COLUMN "blockCountryChange" BOOLEAN NOT NULL DEFAULT false;
