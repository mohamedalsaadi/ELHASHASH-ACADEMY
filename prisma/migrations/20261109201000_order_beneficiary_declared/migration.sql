-- A parent may buy for a registered student without a ParentLink, by declaring guardianship at checkout.
ALTER TABLE "Order" ADD COLUMN "beneficiaryDeclaredAt" TIMESTAMP(3);
