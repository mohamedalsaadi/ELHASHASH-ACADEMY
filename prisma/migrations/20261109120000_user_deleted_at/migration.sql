-- Erasure marks the row instead of deleting it: orders reference the buyer with ON DELETE RESTRICT,
-- so the account stays as an anonymised shell and every personal field is cleared.
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
