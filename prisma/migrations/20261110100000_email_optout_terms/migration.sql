-- Proof that a person accepted the terms at sign-up, and a one-click unsubscribe for non-essential mail.
-- Both columns are nullable and additive: old code keeps working against the new schema.

ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "emailOptOutAt" TIMESTAMP(3);
