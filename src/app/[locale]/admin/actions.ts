"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { accessEnd, schoolYearEnd } from "@/lib/access";
import { cairoDay, youtubeId } from "@/lib/admin-input";
import { CODE_RE } from "@/lib/coupons";
import { db } from "@/lib/db";
import { toMinor } from "@/lib/format";
import { phoneSchema } from "@/lib/schemas/auth";
import { assertCourse, requireAdmin, requireStaff } from "@/lib/staff";

// Every action re-checks the role: server actions are public endpoints, whatever page renders them.

const text = z.string().trim().min(1).max(200);
const optionalText = z.string().trim().max(2000).transform((s) => s || null);
const checkbox = z.literal("on").optional().transform(Boolean);
const term = z.coerce.number().int().min(1).max(2);
/** Month of the school year; "" clears it. */
const month = z.string().transform((s) => (s ? Number(s) : null)).pipe(z.number().int().min(1).max(12).nullable());
/** Optional money field in major units; "" clears it. */
const optionalMoney = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().min(0).max(1_000_000).nullable());

const unitCourse = async (id: string) =>
  (await db.unit.findUniqueOrThrow({ where: { id }, select: { courseId: true } })).courseId;
const lessonCourse = async (id: string) =>
  (await db.lesson.findUniqueOrThrow({ where: { id }, select: { unit: { select: { courseId: true } } } })).unit.courseId;

function done() {
  revalidatePath("/[locale]/admin", "layout");
  revalidatePath("/[locale]/courses", "layout");
  revalidatePath("/[locale]/teacher", "layout");
}

export async function updateCourse(form: FormData) {
  const me = await requireStaff();
  const d = z
    .object({ id: z.string(), titleAr: text, titleEn: text, descAr: optionalText, descEn: optionalText, published: checkbox })
    .parse(Object.fromEntries(form));
  const { id, ...data } = d;
  await assertCourse(me, id);
  await db.course.update({ where: { id }, data });
  done();
}

export async function updateUnit(form: FormData) {
  const me = await requireStaff();
  const { id, ...data } = z
    .object({ id: z.string(), titleAr: text, titleEn: text, isFree: checkbox, term })
    .parse(Object.fromEntries(form));
  await assertCourse(me, await unitCourse(id));
  await db.unit.update({ where: { id }, data });
  done();
}

export async function addUnit(form: FormData) {
  const me = await requireStaff();
  const courseId = z.string().parse(form.get("courseId"));
  await assertCourse(me, courseId);
  const last = await db.unit.findFirst({ where: { courseId }, orderBy: { order: "desc" } });
  const order = (last?.order ?? 0) + 1;
  await db.unit.create({ data: { courseId, order, titleAr: `الوحدة ${order}`, titleEn: `Unit ${order}` } });
  done();
}

export async function addLesson(form: FormData) {
  const me = await requireStaff();
  const unitId = z.string().parse(form.get("unitId"));
  await assertCourse(me, await unitCourse(unitId));
  const last = await db.lesson.findFirst({ where: { unitId }, orderBy: { order: "desc" } });
  const order = (last?.order ?? 0) + 1;
  // A teacher adding a lesson is the one recording it; an admin's lesson falls back to the course's teacher.
  const instructorId = me.role === "ADMIN" ? null : me.id;
  await db.lesson.create({ data: { unitId, order, kind: "VIDEO", titleAr: `درس ${order}`, titleEn: `Lesson ${order}`, instructorId } });
  done();
}

export async function deleteLesson(form: FormData) {
  const me = await requireStaff();
  const id = z.string().parse(form.get("id"));
  await assertCourse(me, await lessonCourse(id));
  await db.lesson.delete({ where: { id } });
  done();
}

export async function updateLesson(form: FormData) {
  const me = await requireStaff();
  const d = z
    .object({
      id: z.string(),
      titleAr: text,
      titleEn: text,
      kind: z.enum(["VIDEO", "EXAM_STRUCTURE", "PAST_QUESTIONS", "PDF"]),
      provider: z.enum(["", "VDOCIPHER", "YOUTUBE"]),
      externalId: z.string().trim().max(200),
      instructorId: z.string().optional(),
      month,
    })
    .parse(Object.fromEntries(form));
  await assertCourse(me, await lessonCourse(d.id));
  // The admin picks who recorded it ("" = the course's teacher); a teacher editing a lesson becomes its instructor.
  const instructorId = me.role !== "ADMIN" ? me.id : d.instructorId ? await teacherId.parseAsync(d.instructorId) : null;

  let videoId: string | null = null;
  if (d.provider && d.externalId) {
    const externalId = d.provider === "YOUTUBE" ? youtubeId(d.externalId) : d.externalId;
    if (!externalId) throw new Error("Not a YouTube link");
    const video = await db.videoAsset.upsert({
      where: { provider_externalId: { provider: d.provider, externalId } },
      update: {},
      create: { provider: d.provider, externalId },
    });
    videoId = video.id;
  }
  await db.lesson.update({ where: { id: d.id }, data: { titleAr: d.titleAr, titleEn: d.titleEn, kind: d.kind, videoId, instructorId, month: d.month } });
  done();
}

/** New packages are priced in the course country's currency; skill courses have no country and stay in AED. */
async function courseCurrency(courseId: string) {
  const c = await db.course.findUniqueOrThrow({ where: { id: courseId }, select: { grade: { select: { country: { select: { currency: true } } } } } });
  return c.grade?.country.currency ?? "AED";
}

export async function updateSku(form: FormData) {
  await requireAdmin();
  const d = z
    .object({
      id: z.string(),
      price: z.coerce.number().min(0).max(1_000_000),
      active: checkbox,
      accessEndsAt: z.string().default(""),
      accessDays: z.coerce.number().int().min(1).max(3650).optional(),
      saleFrom: z.string(),
      saleTo: z.string(),
      discountPrice: optionalMoney,
      discountFrom: z.string().default(""),
      discountTo: z.string().default(""),
      term: term.optional(),
      month: z.coerce.number().int().min(1).max(12).optional(),
    })
    .parse(Object.fromEntries(form));
  const { currency } = await db.sku.findUniqueOrThrow({ where: { id: d.id }, select: { currency: true } });
  await db.sku.update({
    where: { id: d.id },
    data: {
      price: toMinor(d.price, currency),
      active: d.active,
      accessEndsAt: cairoDay(d.accessEndsAt, "end"),
      accessDays: d.accessDays,
      saleFrom: cairoDay(d.saleFrom, "start"),
      saleTo: cairoDay(d.saleTo, "end"),
      discountPrice: d.discountPrice === null ? null : toMinor(d.discountPrice, currency),
      discountFrom: cairoDay(d.discountFrom, "start"),
      discountTo: cairoDay(d.discountTo, "end"),
      term: d.term,
      month: d.month,
    },
  });
  done();
}

export async function addSku(form: FormData) {
  await requireAdmin();
  const d = z
    .object({ courseId: z.string(), accessType: z.enum(["SEMESTER", "MONTHLY", "YEARLY", "REVISION", "FIXED_DAYS"]) })
    .parse(Object.fromEntries(form));
  // New packages start hidden so a half-filled price never goes on sale.
  // A full year ends with the school year; a month runs 30 days; a fixed-days package starts at 90. The owner can change each.
  await db.sku.create({
    data: {
      ...d,
      price: 0,
      currency: await courseCurrency(d.courseId),
      active: false,
      accessEndsAt: d.accessType === "YEARLY" ? cairoDay(schoolYearEnd(new Date()), "end") : null,
      accessDays: d.accessType === "FIXED_DAYS" ? 90 : d.accessType === "MONTHLY" ? 30 : null,
      term: d.accessType === "SEMESTER" ? 1 : null,
      month: d.accessType === "MONTHLY" ? 1 : null,
    },
  });
  done();
}

/** Adds a rental package for one lesson: hidden, 7 days, until the owner sets a price. One per lesson. */
export async function addRental(form: FormData) {
  await requireAdmin();
  const { lessonId } = z.object({ lessonId: z.string() }).parse(Object.fromEntries(form));
  const lesson = await db.lesson.findUniqueOrThrow({ where: { id: lessonId }, select: { unit: { select: { courseId: true } } } });
  if (!(await db.sku.count({ where: { lessonId } }))) {
    await db.sku.create({
      data: { courseId: lesson.unit.courseId, lessonId, accessType: "RENTAL", price: 0, currency: await courseCurrency(lesson.unit.courseId), active: false, accessDays: 7 },
    });
  }
  done();
}

const promoInput = z.object({
  id: z.string().optional(),
  placement: z.enum(["BAR", "CARD"]),
  titleAr: z.string().trim().min(1).max(120),
  titleEn: z.string().trim().min(1).max(120),
  bodyAr: z.string().trim().max(400).default(""),
  bodyEn: z.string().trim().max(400).default(""),
  href: z
    .string()
    .trim()
    .max(500)
    .default("")
    .refine((h) => !h || h.startsWith("/") || h.startsWith("https://"), "bad_href"),
  startsAt: z.string().default(""),
  endsAt: z.string().default(""),
  order: z.coerce.number().int().min(0).max(999).default(0),
  active: checkbox,
});

/** Creates a promotion when `id` is empty, updates it otherwise. */
export async function savePromotion(form: FormData) {
  await requireAdmin();
  const d = promoInput.parse(Object.fromEntries(form));
  const data = {
    placement: d.placement,
    titleAr: d.titleAr,
    titleEn: d.titleEn,
    bodyAr: d.bodyAr || null,
    bodyEn: d.bodyEn || null,
    href: d.href || null,
    startsAt: cairoDay(d.startsAt, "start"),
    endsAt: cairoDay(d.endsAt, "end"),
    order: d.order,
    active: d.active,
  };
  if (d.id) await db.promotion.update({ where: { id: d.id }, data });
  else await db.promotion.create({ data });
  done();
  revalidatePath("/[locale]", "page");
}

export async function deletePromotion(form: FormData) {
  await requireAdmin();
  const { id } = z.object({ id: z.string() }).parse(Object.fromEntries(form));
  await db.promotion.delete({ where: { id } });
  done();
  revalidatePath("/[locale]", "page");
}

const couponInput = z.object({
  id: z.string().optional(),
  code: z.string().trim().toUpperCase().regex(CODE_RE),
  percentOff: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(1).max(100).nullable()),
  amountOff: optionalMoney,
  currency: z.enum(["EGP", "SAR", "AED", "KWD", "QAR", "BHD", "OMR"]).default("EGP"),
  startsAt: z.string().default(""),
  endsAt: z.string().default(""),
  maxRedemptions: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(1).max(100_000).nullable()),
  perUser: z.coerce.number().int().min(1).max(100).default(1),
  active: checkbox,
});

/** Exactly one of percentOff / amountOff must be set; the amount is stored in the chosen currency's minor units. */
export async function saveCoupon(form: FormData) {
  await requireAdmin();
  const d = couponInput.parse(Object.fromEntries(form));
  if ((d.percentOff === null) === (d.amountOff === null)) throw new Error("coupon_needs_one_discount");
  const data = {
    code: d.code,
    percentOff: d.percentOff,
    amountOff: d.amountOff === null ? null : toMinor(d.amountOff, d.currency),
    currency: d.amountOff === null ? null : d.currency,
    startsAt: cairoDay(d.startsAt, "start"),
    endsAt: cairoDay(d.endsAt, "end"),
    maxRedemptions: d.maxRedemptions,
    perUser: d.perUser,
    active: d.active,
  };
  if (d.id) await db.coupon.update({ where: { id: d.id }, data });
  else await db.coupon.create({ data });
  done();
}

export async function deleteCoupon(form: FormData) {
  await requireAdmin();
  const { id } = z.object({ id: z.string() }).parse(Object.fromEntries(form));
  await db.coupon.delete({ where: { id } });
  done();
}

export async function changePassword(_: unknown, form: FormData): Promise<"ok" | "wrong" | "short"> {
  const me = await requireStaff();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (next.length < 10) return "short";
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await bcrypt.compare(current, user.passwordHash))) return "wrong";
  await db.user.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  return "ok";
}

export async function addTeacher(_: unknown, form: FormData): Promise<"ok" | "taken" | "invalid"> {
  await requireAdmin();
  const d = z
    .object({
      name: z.string().trim().min(2).max(80),
      login: z.union([phoneSchema, z.email().trim().toLowerCase()]),
      password: z.string().min(10).max(128),
    })
    .safeParse(Object.fromEntries(form));
  if (!d.success) return "invalid";
  const { name, login, password } = d.data;
  try {
    await db.user.create({
      data: { name, role: "INSTRUCTOR", passwordHash: await bcrypt.hash(password, 10), ...(login.includes("@") ? { email: login } : { phone: login }) },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "taken";
    throw e;
  }
  done();
  return "ok";
}

const teacherId = z.string().refine(async (id) => !!(await db.user.count({ where: { id, role: { in: ["INSTRUCTOR", "ADMIN"] } } })));

/** "Physics, Grade 12" -> "physics-grade-12", plus a suffix when taken. */
async function freeSlug(base: string) {
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "course";
  return (await db.course.count({ where: { slug } })) ? `${slug}-${Date.now().toString(36)}` : slug;
}

export async function createCourse(form: FormData) {
  await requireAdmin();
  const d = await z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("SCHOOL"), gradeId: z.string(), subjectId: z.string(), instructorId: teacherId }),
      z.object({ kind: z.literal("SKILL"), titleAr: text, titleEn: text, instructorId: teacherId }),
    ])
    .parseAsync(Object.fromEntries(form));

  let data: Prisma.CourseUncheckedCreateInput;
  if (d.kind === "SCHOOL") {
    const [grade, subject] = await Promise.all([
      db.grade.findUniqueOrThrow({ where: { id: d.gradeId }, include: { country: true } }),
      db.subject.findUniqueOrThrow({ where: { id: d.subjectId } }),
    ]);
    data = {
      ...d,
      slug: await freeSlug(`${grade.country.code}-${grade.level}-${subject.slug}`),
      titleAr: `${subject.nameAr}، ${grade.nameAr}`,
      titleEn: `${subject.nameEn}, ${grade.nameEn}`,
    };
  } else {
    data = { ...d, slug: await freeSlug(d.titleEn) };
  }
  // Starts hidden, like a new package, until the owner fills it in and publishes it.
  const course = await db.course.create({ data });
  done();
  redirect(`/${form.get("locale") === "en" ? "en" : "ar"}/admin/courses/${course.id}`);
}

export async function setTeacher(form: FormData) {
  await requireAdmin();
  const d = await z.object({ id: z.string(), instructorId: teacherId }).parseAsync(Object.fromEntries(form));
  await db.course.update({ where: { id: d.id }, data: { instructorId: d.instructorId } });
  done();
}

/** Which subjects a grade teaches, in the order they were ticked on the page. */
export async function setGradeSubjects(form: FormData) {
  await requireAdmin();
  const gradeId = z.string().parse(form.get("gradeId"));
  const ids = z.array(z.string()).parse(form.getAll("subject"));
  const known = new Set((await db.subject.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((s) => s.id));
  await db.$transaction([
    db.gradeSubject.deleteMany({ where: { gradeId } }),
    db.gradeSubject.createMany({ data: ids.filter((id) => known.has(id)).map((subjectId, order) => ({ gradeId, subjectId, order })) }),
  ]);
  done();
}

/**
 * Manual access, logged as a MANUAL order paid at zero with a payment event naming the admin.
 * The plan's scope is copied from the SKU, as a real payment would; the end date defaults to the SKU's own.
 */
export async function grantAccess(form: FormData) {
  const me = await requireAdmin();
  const d = z.object({ userId: z.string(), skuId: z.string(), endsAt: z.string() }).parse(Object.fromEntries(form));
  const sku = await db.sku.findUniqueOrThrow({ where: { id: d.skuId } });
  if (sku.accessType === "LIVE") throw new Error("Live seats are granted from the live lecture");
  const now = new Date();
  await db.$transaction(async (trx) => {
    const order = await trx.order.create({
      data: {
        userId: d.userId, status: "PAID", gateway: "MANUAL", currency: sku.currency, subtotal: 0, discount: 0, total: 0, paidAt: now,
        items: { create: { skuId: sku.id, price: 0 } },
        events: { create: { gatewayEventId: `manual:${randomUUID()}`, payload: { action: "grant", by: me.id, byName: me.name ?? null } } },
      },
    });
    await trx.entitlement.create({
      data: {
        userId: d.userId, courseId: sku.courseId, orderId: order.id, lessonId: sku.lessonId,
        accessType: sku.accessType, term: sku.term, month: sku.month,
        endsAt: d.endsAt ? cairoDay(d.endsAt, "end") : accessEnd(sku, now),
      },
    });
  });
  done();
}

/** Moves one entitlement's end date, logged like a grant. An empty date means no end. */
export async function extendAccess(form: FormData) {
  const me = await requireAdmin();
  const d = z.object({ id: z.string(), endsAt: z.string() }).parse(Object.fromEntries(form));
  const e = await db.entitlement.findUniqueOrThrow({ where: { id: d.id } });
  const endsAt = cairoDay(d.endsAt, "end");
  await db.$transaction([
    db.entitlement.update({ where: { id: e.id }, data: { endsAt } }),
    db.order.create({
      data: {
        userId: e.userId, status: "PAID", gateway: "MANUAL", currency: await courseCurrency(e.courseId), subtotal: 0, discount: 0, total: 0, paidAt: new Date(),
        events: { create: { gatewayEventId: `manual:${randomUUID()}`, payload: { action: "extend", entitlementId: e.id, from: e.endsAt, to: endsAt, by: me.id, byName: me.name ?? null } } },
      },
    }),
  ]);
  done();
}

/** Sets a temporary password for a student or teacher. Admin accounts (the owner's) are never reset from here. */
export async function resetPassword(_: unknown, form: FormData): Promise<"ok" | "invalid"> {
  await requireAdmin();
  const d = z.object({ userId: z.string(), password: z.string().min(10).max(128) }).safeParse(Object.fromEntries(form));
  if (!d.success) return "invalid";
  const { count } = await db.user.updateMany({
    where: { id: d.data.userId, role: { not: "ADMIN" } },
    data: { passwordHash: await bcrypt.hash(d.data.password, 10) },
  });
  return count ? "ok" : "invalid";
}

/** Turns a teacher back into a student. Only INSTRUCTOR rows match, so the owner's ADMIN account can't be demoted. */
export async function disableTeacher(form: FormData) {
  await requireAdmin();
  const id = z.string().parse(form.get("id"));
  await db.user.updateMany({ where: { id, role: "INSTRUCTOR" }, data: { role: "STUDENT" } });
  done();
  redirect(`/${form.get("locale") === "en" ? "en" : "ar"}/admin/teachers`);
}
