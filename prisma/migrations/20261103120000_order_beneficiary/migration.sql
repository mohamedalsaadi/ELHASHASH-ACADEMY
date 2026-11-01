-- A parent can pay for a linked child: the order keeps the buyer (userId) and names the learner. Additive only.
ALTER TABLE "Order" ADD COLUMN "beneficiaryId" TEXT;

CREATE INDEX "Order_beneficiaryId_idx" ON "Order"("beneficiaryId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
