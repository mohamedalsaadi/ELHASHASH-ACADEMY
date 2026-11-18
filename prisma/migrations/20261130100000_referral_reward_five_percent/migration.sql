-- Referrals v2: only the sender is rewarded, 5% off one course, once, never on top of another discount.
-- The friend's welcome discount is retired (the column stays, unused). Additive and safe to run on live data.
ALTER TABLE "PlatformSetting" ALTER COLUMN "referralRewardPercentOff" SET DEFAULT 5;
UPDATE "PlatformSetting" SET "referralWelcomePercentOff" = 0, "referralRewardPercentOff" = 5 WHERE "referralRewardPercentOff" = 0;
UPDATE "PlatformSetting" SET "referralWelcomePercentOff" = 0 WHERE "referralWelcomePercentOff" <> 0;
