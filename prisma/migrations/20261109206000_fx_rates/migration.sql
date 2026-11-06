-- Owner-maintained rates that pre-fill the AED price suggestion. Never used at checkout.

CREATE TABLE "FxRate" (
  "currency" "Currency" NOT NULL,
  "aedPerUnit" DECIMAL(12,6) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FxRate_pkey" PRIMARY KEY ("currency")
);
