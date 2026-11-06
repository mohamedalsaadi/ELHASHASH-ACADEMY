-- Model 1: every market is charged in AED. The local price becomes a display reference,
-- copied onto the order line so the receipt can show what the buyer saw.

ALTER TABLE "Sku" ADD COLUMN "aedPrice" INTEGER;
ALTER TABLE "OrderItem" ADD COLUMN "displayPrice" INTEGER;
ALTER TABLE "OrderItem" ADD COLUMN "displayCurrency" "Currency";
