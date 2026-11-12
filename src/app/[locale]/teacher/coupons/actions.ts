"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cairoDay } from "@/lib/admin-input";
import { CODE_RE } from "@/lib/coupons";
import { db } from "@/lib/db";
import { couponManager } from "@/lib/coupon-manager";
import { assertCourse } from "@/lib/staff";

export type CouponFormState = "invalid" | "cap" | "taken" | "ok" | null;

const input = z.object({
  id: z.string().optional(),
  code: z.string().trim().toUpperCase().regex(CODE_RE),
  courseId: z.string().min(1),
  percentOff: z.coerce.number().int().min(1).max(100),
  startsAt: z.string().default(""),
  endsAt: z.string().default(""),
  maxRedemptions: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(1).max(100_000).nullable()),
  perUser: z.coerce.number().int().min(1).max(100).default(1),
  active: z.literal("on").optional(),
});

/**
 * Creates or edits one of the teacher's own codes. It is for a course they teach, percent only, never above their limit,
 * and paid for by the teacher (STANDARD): the order line is priced after the discount, so their share is calculated on it.
 */
export async function saveTeacherCoupon(_prev: CouponFormState, form: FormData): Promise<CouponFormState> {
  const { me, cap } = await couponManager();
  const parsed = input.safeParse(Object.fromEntries(form));
  if (!parsed.success) return "invalid";
  const d = parsed.data;
  await assertCourse(me, d.courseId);
  if (d.percentOff > cap) return "cap";

  const clash = await db.coupon.findUnique({ where: { code: d.code }, select: { id: true } });
  if (clash && clash.id !== d.id) return "taken";
  if (d.id) {
    const own = await db.coupon.findFirst({ where: { id: d.id, instructorId: me.id }, select: { id: true } });
    if (!own) return "invalid";
  }

  const data = {
    code: d.code,
    percentOff: d.percentOff,
    amountOff: null,
    currency: null,
    startsAt: cairoDay(d.startsAt, "start"),
    endsAt: cairoDay(d.endsAt, "end"),
    maxRedemptions: d.maxRedemptions,
    perUser: d.perUser,
    active: d.active === "on",
    funding: "STANDARD" as const,
    instructorId: me.id,
    courseId: d.courseId,
  };
  if (d.id) await db.coupon.update({ where: { id: d.id }, data });
  else await db.coupon.create({ data });
  revalidatePath("/[locale]/teacher/coupons", "page");
  revalidatePath("/[locale]/admin/marketing", "page");
  return "ok";
}

/** Switches one of the teacher's own codes off or on. Codes are never deleted: paid orders keep pointing at them. */
export async function setTeacherCouponActive(form: FormData) {
  const { me } = await couponManager();
  const d = z.object({ id: z.string().min(1), active: z.enum(["on", "off"]) }).parse(Object.fromEntries(form));
  await db.coupon.updateMany({ where: { id: d.id, instructorId: me.id }, data: { active: d.active === "on" } });
  revalidatePath("/[locale]/teacher/coupons", "page");
}
