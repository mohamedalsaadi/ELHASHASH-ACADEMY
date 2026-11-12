import { notFound } from "next/navigation";
import { db } from "./db";
import { requireStaff } from "./staff";

/** A teacher the admin has allowed (read from the database, not the cookie), and the discount limit that applies to them. */
export async function couponManager() {
  const me = await requireStaff();
  const u = await db.user.findUnique({ where: { id: me.id }, select: { role: true, canManageCoupons: true, maxDiscountPct: true } });
  if (!u || (u.role !== "ADMIN" && !u.canManageCoupons)) notFound();
  return { me, cap: u.role === "ADMIN" ? 100 : u.maxDiscountPct };
}
