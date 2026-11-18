-- Who bears a code's discount: platform only (PLATFORM), teacher and platform (STANDARD, the existing meaning), or teacher only.
-- Additive: every existing code and order stays shared, which is how it was settled.
ALTER TYPE "CouponFunding" ADD VALUE 'TEACHER';
ALTER TABLE "OrderItem" ADD COLUMN "teacherDiscount" INTEGER NOT NULL DEFAULT 0;
