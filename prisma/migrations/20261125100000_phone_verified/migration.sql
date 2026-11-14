-- A phone number counts as verified once a WhatsApp code or link sent to it was used. Additive.
ALTER TABLE "User" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

-- Every number already on file keeps working exactly as before: it is treated as verified from the day the account was made.
-- Only numbers typed from now on (password signup, profile) start unverified.
UPDATE "User" SET "phoneVerifiedAt" = "createdAt" WHERE "phone" IS NOT NULL;
