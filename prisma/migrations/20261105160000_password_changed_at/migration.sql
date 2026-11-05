-- A password change must end existing sessions. Null means the password has never been changed,
-- so every session issued before this column existed stays valid (there is nothing to compare to).
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
