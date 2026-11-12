-- Additive: a teacher may be allowed to manage discount codes, and a code can belong to a teacher and be limited to one course.
ALTER TABLE "User" ADD COLUMN "canManageCoupons" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Coupon" ADD COLUMN "instructorId" TEXT;
ALTER TABLE "Coupon" ADD COLUMN "courseId" TEXT;
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Coupon_instructorId_idx" ON "Coupon"("instructorId");
