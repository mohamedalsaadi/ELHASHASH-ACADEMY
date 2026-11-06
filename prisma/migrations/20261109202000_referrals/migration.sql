-- Platform-funded referral discounts, attribution, and the one-time referrer reward.

CREATE TYPE "CouponFunding" AS ENUM ('STANDARD', 'PLATFORM');
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'REWARDED', 'VOID');

ALTER TABLE "Coupon" ADD COLUMN "funding" "CouponFunding" NOT NULL DEFAULT 'STANDARD';
ALTER TABLE "Coupon" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order" ADD COLUMN "platformDiscount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OrderItem" ADD COLUMN "platformDiscount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LedgerEntry" ADD COLUMN "platformDiscount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlatformSetting" ADD COLUMN "referralWelcomePercentOff" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlatformSetting" ADD COLUMN "referralRewardPercentOff" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ReferralCode" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReferralCode_userId_key" ON "ReferralCode"("userId");
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Referral" (
  "id" TEXT NOT NULL,
  "codeId" TEXT NOT NULL,
  "referrerId" TEXT NOT NULL,
  "referredUserId" TEXT NOT NULL,
  "referredOrderId" TEXT,
  "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
  "currency" "Currency" NOT NULL,
  "discount" INTEGER NOT NULL DEFAULT 0,
  "rewardCouponId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rewardedAt" TIMESTAMP(3),
  CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Referral_referredUserId_key" ON "Referral"("referredUserId");
CREATE UNIQUE INDEX "Referral_referredOrderId_key" ON "Referral"("referredOrderId");
CREATE UNIQUE INDEX "Referral_rewardCouponId_key" ON "Referral"("rewardCouponId");
CREATE INDEX "Referral_referrerId_createdAt_idx" ON "Referral"("referrerId", "createdAt");
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "ReferralCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredOrderId_fkey" FOREIGN KEY ("referredOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_rewardCouponId_fkey" FOREIGN KEY ("rewardCouponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
