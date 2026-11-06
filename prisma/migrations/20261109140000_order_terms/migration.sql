-- What the buyer accepted, and when. Nullable: orders an admin creates are not a purchase acceptance.
ALTER TABLE "Order" ADD COLUMN "termsVersion" TEXT;
ALTER TABLE "Order" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
