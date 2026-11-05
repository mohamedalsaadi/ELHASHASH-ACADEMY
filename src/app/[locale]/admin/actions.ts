"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { accessEnd, schoolYearEnd } from "@/lib/access";
import { logEvent } from "@/lib/analytics";
import { cairoDay, youtubeId } from "@/lib/admin-input";
import { blobInfo, coverPrefix } from "@/lib/blob";
import type { FinanceConfig } from "@/lib/finance";
import { saveFinanceConfig } from "@/lib/platform-settings";
import { refundIntent } from "@/lib/ziina";
import { CODE_RE } from "@/lib/coupons";
import { db } from "@/lib/db";
import { toMinor } from "@/lib/format";
import { issueInvite } from "@/lib/invites";
import { appUrl, emailLayout, sendMail } from "@/lib/mail";
import { applyPaymentOutcome } from "@/lib/payments";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import { safeNext } from "@/lib/safe-redirect";
import { countryInput, gradeInput, rangesOverlap, stageInput, subjectInput } from "@/lib/schemas/catalog-admin";
import { PASSWORD_MIN, passwordSchema, phoneSchema } from "@/lib/schemas/auth";
import { assertCourse, assertSlot, requireAdmin, requireStaff } from "@/lib/staff";
import { stripe } from "@/lib/stripe";

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
  revalidatePath("/[locale]", "page");
}

/** Sends the owner back to the catalog with a readable error instead of a server error page. */
function catalogError(form: FormData, error: string): never {
  const locale = form.get("locale") === "en" ? "en" : "ar";
  redirect(`/${locale}/admin/catalog?error=${error}`);
}

export async function updateCourse(form: FormData) {
  const me = await requireStaff();
  const d = z
    .object({
      id: z.string(),
      titleAr: text,
      titleEn: text,
      headlineAr: optionalText,
      headlineEn: optionalText,
      descAr: optionalText,
      descEn: optionalText,
      published: checkbox,
      aiGrading: checkbox,
      coverKey: z.string().trim().max(500).default(""),
    })
    .parse(Object.fromEntries(form));
  await assertCourse(me, d.id);
  const { id, coverKey, ...data } = d;
  const wasHidden = (await db.course.count({ where: { id, published: false } })) === 1;

  // The cover must be this course's own object, and its type is read from Blob, not the form.
  let cover: { coverKey: string | null; coverType: string | null } = { coverKey: null, coverType: null };
  if (coverKey) {
    if (!coverKey.startsWith(coverPrefix(id))) return;
    const info = await blobInfo(coverKey);
    if (!info) return;
    cover = { coverKey, coverType: info.contentType };
  }

  await db.course.update({ where: { id }, data: { ...data, ...cover } });
  if (data.published && wasHidden) await logEvent({ name: "course_published", userId: me.id, courseId: id });
  done();
}

export async function updateUnit(form: FormData) {
  const me = await requireStaff();
  const { id, ...data } = z
    .object({ id: z.string(), titleAr: text, titleEn: text, term })
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

/** New packages use the course country's currency and time zone; skill courses have no country and use AED/Dubai. */
async function courseLocation(courseId: string) {
  const c = await db.course.findUniqueOrThrow({
    where: { id: courseId },
    select: { grade: { select: { country: { select: { currency: true, timeZone: true } } } } },
  });
  return {
    currency: c.grade?.country.currency ?? "AED",
    timeZone: c.grade?.country.timeZone ?? "Asia/Dubai",
  };
}

export async function updateSku(form: FormData) {
  const me = await requireStaff();
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
  const sku = await db.sku.findUniqueOrThrow({ where: { id: d.id }, select: { currency: true, courseId: true } });
  // A teacher sets the price of their own course; the owner sets any.
  await assertCourse(me, sku.courseId);
  const { currency } = sku;
  const { timeZone } = await courseLocation(sku.courseId);
  await db.sku.update({
    where: { id: d.id },
    data: {
      price: toMinor(d.price, currency),
      active: d.active,
      accessEndsAt: cairoDay(d.accessEndsAt, "end", timeZone),
      accessDays: d.accessDays,
      saleFrom: cairoDay(d.saleFrom, "start", timeZone),
      saleTo: cairoDay(d.saleTo, "end", timeZone),
      discountPrice: d.discountPrice === null ? null : toMinor(d.discountPrice, currency),
      discountFrom: cairoDay(d.discountFrom, "start", timeZone),
      discountTo: cairoDay(d.discountTo, "end", timeZone),
      term: d.term,
      month: d.month,
    },
  });
  done();
}

export async function addSku(form: FormData) {
  const me = await requireStaff();
  const d = z
    .object({ courseId: z.string(), accessType: z.enum(["SEMESTER", "MONTHLY", "YEARLY", "REVISION", "FIXED_DAYS"]) })
    .parse(Object.fromEntries(form));
  await assertCourse(me, d.courseId);
  // New packages start hidden so a half-filled price never goes on sale.
  // A full year ends with the school year; a month runs 30 days; a fixed-days package starts at 90. The owner can change each.
  const loc = await courseLocation(d.courseId);
  await db.sku.create({
    data: {
      ...d,
      price: 0,
      currency: loc.currency,
      active: false,
      accessEndsAt: d.accessType === "YEARLY" ? cairoDay(schoolYearEnd(new Date()), "end", loc.timeZone) : null,
      accessDays: d.accessType === "FIXED_DAYS" ? 90 : d.accessType === "MONTHLY" ? 30 : null,
      term: d.accessType === "SEMESTER" ? 1 : null,
      month: d.accessType === "MONTHLY" ? 1 : null,
    },
  });
  done();
}

/** Adds a rental package for one lesson: hidden, 7 days, until the owner sets a price. One per lesson. */
export async function addRental(form: FormData) {
  const me = await requireStaff();
  const { lessonId } = z.object({ lessonId: z.string() }).parse(Object.fromEntries(form));
  const lesson = await db.lesson.findUniqueOrThrow({ where: { id: lessonId }, select: { unit: { select: { courseId: true } } } });
  await assertCourse(me, lesson.unit.courseId);
  if (!(await db.sku.count({ where: { lessonId } }))) {
    await db.sku.create({
      data: { courseId: lesson.unit.courseId, lessonId, accessType: "RENTAL", price: 0, currency: (await courseLocation(lesson.unit.courseId)).currency, active: false, accessDays: 7 },
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
    // Same-site destinations only: a promotion must not become a phishing link. `startsWith("/")` alone
    // let "//evil.com" and "/\evil.com" through, which browsers resolve off-site.
    .refine((h) => safeNext(h, "") === h, "bad_href"),
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

/** Completes a pending order (kiosk cash received, …) through the same path as a webhook. */
export async function markOrderPaid(form: FormData) {
  const me = await requireAdmin();
  const { id } = z.object({ id: z.string() }).parse(Object.fromEntries(form));
  const order = await db.order.findUniqueOrThrow({ where: { id }, select: { id: true, status: true, total: true, vat: true, currency: true } });
  if (order.status === "PAID") return;
  // The gateway charges the net total plus VAT, so a manual settlement must match it.
  await applyPaymentOutcome(order.id, `manual:${randomUUID()}`, { kind: "paid", amount: order.total + order.vat, currency: order.currency }, { admin: me.id });
  done();
  revalidatePath("/[locale]/admin/orders", "layout");
  revalidatePath("/[locale]/dashboard", "page");
}

/**
 * Refunds a paid order and revokes the access it granted. Stripe is refunded through its API;
 * for Paymob the money is refunded in the Paymob dashboard and this records it and closes access.
 */
export async function refundOrder(form: FormData) {
  const me = await requireAdmin();
  const { id } = z.object({ id: z.string() }).parse(Object.fromEntries(form));
  const order = await db.order.findUniqueOrThrow({
    where: { id },
    select: { id: true, status: true, gateway: true, gatewayOrderId: true, total: true, vat: true, currency: true },
  });
  if (order.status !== "PAID") return;

  if (order.gateway === "STRIPE" && order.gatewayOrderId) {
    const session = await stripe().checkout.sessions.retrieve(order.gatewayOrderId);
    const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    // Same order, same key: a retry or double-click is one refund. (Ziina derives its key the same way.)
    if (paymentIntent) await stripe().refunds.create({ payment_intent: paymentIntent }, { idempotencyKey: `refund:${order.id}` });
  } else if (order.gateway === "ZIINA" && order.gatewayOrderId) {
    // The refund id is derived from the order, so a retry or a double-click is one refund.
    await refundIntent({ orderId: order.id, paymentIntentId: order.gatewayOrderId, amount: order.total + order.vat });
  }

  await db.$transaction(async (trx) => {
    const sales = await trx.ledgerEntry.findMany({ where: { orderId: id, kind: "SALE" } });
    await trx.order.update({ where: { id }, data: { status: "REFUNDED" } });
    await trx.entitlement.updateMany({ where: { orderId: id }, data: { endsAt: new Date() } });
    // A fixed key: a racing second refund fails here instead of recording (and issuing) two.
    await trx.paymentEvent.create({ data: { orderId: id, gatewayEventId: `refund:${id}`, payload: { admin: me.id, gateway: order.gateway } } });
    if (sales.length) {
      // A refund is a new negative row with the original rates; the sale row is never touched.
      await trx.ledgerEntry.createMany({
        data: sales.map((s) => ({
          kind: "REFUND" as const,
          orderId: id,
          orderItemId: s.orderItemId,
          instructorId: s.instructorId,
          courseId: s.courseId,
          subjectId: s.subjectId,
          gradeId: s.gradeId,
          currency: s.currency,
          gross: -s.gross,
          vat: -s.vat,
          net: -s.net,
          platformFee: -s.platformFee,
          instructorNet: -s.instructorNet,
          vatRateBp: s.vatRateBp,
          platformShareBp: s.platformShareBp,
          reversalOfId: s.id,
        })),
        skipDuplicates: true,
      });
    }
  });
  done();
  revalidatePath("/[locale]/admin/orders", "layout");
  revalidatePath("/[locale]/dashboard", "page");
}

/**
 * The platform fee and VAT live in one settings row. A change applies to future orders only:
 * every ledger row keeps the rates it was written with.
 */
export async function saveFinanceSettings(form: FormData) {
  const me = await requireAdmin();
  const d = z
    .object({
      vatEnabled: checkbox,
      vatRate: z.coerce.number().min(0).max(50),
      vatTrn: z.string().trim().max(40).default(""),
      platformShare: z.coerce.number().min(0).max(100),
    })
    .parse(Object.fromEntries(form));

  const cfg: FinanceConfig = {
    vatEnabled: d.vatEnabled,
    vatRateBp: Math.round(d.vatRate * 100),
    vatTrn: d.vatTrn || null,
    platformShareBp: Math.round(d.platformShare * 100),
  };
  await saveFinanceConfig(cfg, me.id);
  revalidatePath("/[locale]/admin", "layout");
}

export async function changePassword(_: unknown, form: FormData): Promise<"ok" | "wrong" | "short"> {
  const me = await requireStaff();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  // A stolen session must not be able to guess the current password at full speed.
  if (await isLimited(`chpw:${me.id}`, 5, 15 * 60_000)) return "wrong";
  if (next.length < PASSWORD_MIN) return "short";
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await bcrypt.compare(current, user.passwordHash))) {
    await recordAttempt(`chpw:${me.id}`);
    return "wrong";
  }
  await db.user.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(next, 10), passwordChangedAt: new Date() } });
  return "ok";
}

export async function addTeacher(_: unknown, form: FormData): Promise<"ok" | "taken" | "invalid"> {
  await requireAdmin();
  const d = z
    .object({
      name: z.string().trim().min(2).max(80),
      login: z.union([phoneSchema, z.email().trim().toLowerCase()]),
      password: passwordSchema,
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

export type InviteState = { ok: true; link: string } | { error: "invalid" | "contact" | "slot" | "email_taken" } | null;

/**
 * Invites a teacher to several (grade, subject) slots at once. The link is returned so the
 * owner can copy it when no email is configured; with an address, the same link is emailed.
 */
export async function inviteTeacher(_: InviteState, form: FormData): Promise<InviteState> {
  const me = await requireAdmin();
  const base = z
    .object({ name: z.string().trim().min(2).max(80), email: z.string().trim().max(200), phone: z.string().trim().max(30) })
    .safeParse({ name: form.get("name"), email: form.get("email") ?? "", phone: form.get("phone") ?? "" });
  if (!base.success) return { error: "invalid" };
  const email = base.data.email.toLowerCase() || null;
  const phone = base.data.phone || null;
  if (!email && !phone) return { error: "contact" };
  if (email && !z.email().safeParse(email).success) return { error: "contact" };
  if (phone && !phoneSchema.safeParse(phone).success) return { error: "contact" };

  const keys = form.getAll("slot").map(String).filter(Boolean);
  if (keys.length === 0) return { error: "slot" };
  const slots = keys.map((k) => {
    const [gradeId, subjectId] = k.split(":");
    return { gradeId: gradeId ?? "", subjectId: subjectId ?? "" };
  });
  if (slots.some((s) => !s.gradeId || !s.subjectId)) return { error: "slot" };
  // A slot must be a subject the grade actually teaches.
  const known = await db.gradeSubject.findMany({
    where: { gradeId: { in: slots.map((s) => s.gradeId) } },
    select: { gradeId: true, subjectId: true },
  });
  const valid = new Set(known.map((g) => `${g.gradeId}:${g.subjectId}`));
  if (slots.some((s) => !valid.has(`${s.gradeId}:${s.subjectId}`))) return { error: "slot" };

  const locale = form.get("locale") === "en" ? "en" : "ar";
  const { raw } = await issueInvite({ name: base.data.name, email, phone, slots, createdById: me.id });
  const link = `${appUrl()}/${locale}/invite/${raw}`;

  if (email) {
    const ar = locale === "ar";
    await sendMail({
      to: email,
      subject: ar ? "دعوة للتدريس في ذروة" : "An invitation to teach at Dhirwa",
      html: emailLayout(
        ar ? "دعوة للتدريس في ذروة" : "An invitation to teach at Dhirwa",
        [
          ar
            ? `مرحبًا ${base.data.name}، تمت دعوتك للانضمام إلى ذروة كمدرّس. الرابط صالح لسبعة أيام ولمرة واحدة.`
            : `Hello ${base.data.name}, you have been invited to teach at Dhirwa. The link is valid for seven days and works once.`,
        ],
        { href: link, label: ar ? "قبول الدعوة" : "Accept the invitation" },
        locale,
      ),
    });
  }

  done();
  return { ok: true, link };
}

export async function cancelInvite(form: FormData) {
  await requireAdmin();
  await db.teacherInvite.delete({ where: { id: String(form.get("id")) } });
  done();
}

export async function addTeacherSlot(form: FormData) {
  await requireAdmin();
  const d = z.object({ userId: z.string(), slot: z.string() }).parse(Object.fromEntries(form));
  const [gradeId, subjectId] = d.slot.split(":");
  if (!gradeId || !subjectId) return;
  // Only subjects the grade actually teaches.
  if (!(await db.gradeSubject.count({ where: { gradeId, subjectId } }))) return;
  await db.teacherSlot.createMany({ data: [{ userId: d.userId, gradeId, subjectId }], skipDuplicates: true });
  done();
}

export async function removeTeacherSlot(form: FormData) {
  await requireAdmin();
  await db.teacherSlot.delete({ where: { id: String(form.get("id")) } });
  done();
}

const teacherId = z.string().refine(async (id) => !!(await db.user.count({ where: { id, role: { in: ["INSTRUCTOR", "ADMIN"] } } })));

/** "Physics, Grade 12" -> "physics-grade-12", plus a suffix when taken. */
async function freeSlug(base: string) {
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "course";
  return (await db.course.count({ where: { slug } })) ? `${slug}-${Date.now().toString(36)}` : slug;
}

export async function createCourse(form: FormData) {
  const me = await requireStaff();
  const locale = form.get("locale") === "en" ? "en" : "ar";

  // A teacher creates school courses only, in any grade and subject of their own country.
  if (me.role !== "ADMIN") {
    const { slot } = z.object({ slot: z.string() }).parse(Object.fromEntries(form));
    const [gradeId, subjectId] = slot.split(":");
    if (!gradeId || !subjectId) notFound();
    await assertSlot(me, gradeId, subjectId);
    const [grade, subject] = await Promise.all([
      db.grade.findUniqueOrThrow({ where: { id: gradeId }, include: { country: true } }),
      db.subject.findUniqueOrThrow({ where: { id: subjectId } }),
    ]);
    const owned = await db.course.create({
      data: {
        instructorId: me.id,
        kind: "SCHOOL",
        gradeId,
        subjectId,
        slug: await freeSlug(`${grade.country.code}-${grade.level}-${subject.slug}`),
        titleAr: `${subject.nameAr}، ${grade.nameAr}`,
        titleEn: `${subject.nameEn}, ${grade.nameEn}`,
      },
    });
    await logEvent({ name: "course_created", userId: me.id, courseId: owned.id });
    done();
    redirect(`/${locale}/admin/courses/${owned.id}`);
  }

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
  // Starts hidden, like a new package, until it is filled in and published.
  const course = await db.course.create({ data });
  await logEvent({ name: "course_created", userId: me.id, courseId: course.id });
  done();
  redirect(`/${locale}/admin/courses/${course.id}`);
}

/**
 * Removes a course: unpublishes it when anything was sold or granted (the history stays),
 * deletes it only when it never was.
 */
export async function deleteCourse(form: FormData) {
  const me = await requireStaff();
  const d = z.object({ id: z.string(), locale: z.string().optional() }).parse(Object.fromEntries(form));
  await assertCourse(me, d.id);
  const [sold, granted] = await Promise.all([
    db.orderItem.count({ where: { sku: { courseId: d.id } } }),
    db.entitlement.count({ where: { courseId: d.id } }),
  ]);
  if (sold || granted) await db.course.update({ where: { id: d.id }, data: { published: false } });
  else await db.course.delete({ where: { id: d.id } });
  done();
  redirect(`/${d.locale === "en" ? "en" : "ar"}/${me.role === "ADMIN" ? "admin/courses" : "teacher"}`);
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

export async function saveCountry(form: FormData) {
  await requireAdmin();
  const d = countryInput.parse(Object.fromEntries(form));
  const data = { nameAr: d.nameAr, nameEn: d.nameEn, currency: d.currency, timeZone: d.timeZone, order: d.order, active: d.active };
  try {
    if (d.id) await db.country.update({ where: { id: d.id }, data });
    else await db.country.create({ data: { ...data, code: d.code } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") catalogError(form, "duplicate");
    throw e;
  }
  done();
}

export async function deleteCountry(form: FormData) {
  await requireAdmin();
  const { id } = z.object({ id: z.string() }).parse(Object.fromEntries(form));
  if ((await db.grade.count({ where: { countryId: id } })) > 0) catalogError(form, "in_use");
  await db.country.delete({ where: { id } });
  done();
}

export async function saveStage(form: FormData) {
  await requireAdmin();
  const d = stageInput.parse(Object.fromEntries(form));
  const siblings = await db.stage.findMany({
    where: { countryId: d.countryId, ...(d.id ? { id: { not: d.id } } : {}) },
    select: { fromLevel: true, toLevel: true },
  });
  if (siblings.some((s) => rangesOverlap(d, s))) catalogError(form, "overlap");
  const data = { countryId: d.countryId, nameAr: d.nameAr, nameEn: d.nameEn, fromLevel: d.fromLevel, toLevel: d.toLevel, order: d.order };
  try {
    if (d.id) await db.stage.update({ where: { id: d.id }, data });
    else await db.stage.create({ data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") catalogError(form, "overlap");
    throw e;
  }
  done();
}

export async function deleteStage(form: FormData) {
  await requireAdmin();
  const { id } = z.object({ id: z.string() }).parse(Object.fromEntries(form));
  await db.stage.delete({ where: { id } });
  done();
}

export async function saveGrade(form: FormData) {
  await requireAdmin();
  const d = gradeInput.parse(Object.fromEntries(form));
  const data = {
    countryId: d.countryId,
    curriculum: d.curriculum,
    level: d.level,
    nameAr: d.nameAr,
    nameEn: d.nameEn,
    isTerminal: d.isTerminal,
    order: d.order,
    active: d.active,
  };
  try {
    if (d.id) await db.grade.update({ where: { id: d.id }, data });
    else await db.grade.create({ data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") catalogError(form, "duplicate");
    throw e;
  }
  done();
}

export async function deleteGrade(form: FormData) {
  await requireAdmin();
  const { id } = z.object({ id: z.string() }).parse(Object.fromEntries(form));
  const grade = await db.grade.findUniqueOrThrow({ where: { id }, include: { _count: { select: { courses: true, users: true } } } });
  if (grade._count.courses > 0 || grade._count.users > 0) catalogError(form, "in_use");
  await db.grade.delete({ where: { id } });
  done();
}

export async function saveSubject(form: FormData) {
  await requireAdmin();
  const d = subjectInput.parse(Object.fromEntries(form));
  const data = { slug: d.slug, nameAr: d.nameAr, nameEn: d.nameEn, icon: d.icon, active: d.active };
  try {
    if (d.id) await db.subject.update({ where: { id: d.id }, data });
    else await db.subject.create({ data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") catalogError(form, "duplicate");
    throw e;
  }
  done();
}

export async function deleteSubject(form: FormData) {
  await requireAdmin();
  const { id } = z.object({ id: z.string() }).parse(Object.fromEntries(form));
  const subject = await db.subject.findUniqueOrThrow({
    where: { id },
    include: { _count: { select: { courses: true, grades: true, concepts: true, bundles: true } } },
  });
  const { courses, grades, concepts, bundles } = subject._count;
  if (courses > 0 || grades > 0 || concepts > 0 || bundles > 0) catalogError(form, "in_use");
  await db.subject.delete({ where: { id } });
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
  const { timeZone } = await courseLocation(sku.courseId);
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
        endsAt: d.endsAt ? cairoDay(d.endsAt, "end", timeZone) : accessEnd(sku, now),
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
  const { currency, timeZone } = await courseLocation(e.courseId);
  const endsAt = cairoDay(d.endsAt, "end", timeZone);
  await db.$transaction([
    db.entitlement.update({ where: { id: e.id }, data: { endsAt } }),
    db.order.create({
      data: {
        userId: e.userId, status: "PAID", gateway: "MANUAL", currency, subtotal: 0, discount: 0, total: 0, paidAt: new Date(),
        events: { create: { gatewayEventId: `manual:${randomUUID()}`, payload: { action: "extend", entitlementId: e.id, from: e.endsAt, to: endsAt, by: me.id, byName: me.name ?? null } } },
      },
    }),
  ]);
  done();
}

/** Sets a temporary password for a student or teacher. Admin accounts (the owner's) are never reset from here. */
export async function resetPassword(_: unknown, form: FormData): Promise<"ok" | "invalid"> {
  await requireAdmin();
  const d = z.object({ userId: z.string(), password: passwordSchema }).safeParse(Object.fromEntries(form));
  if (!d.success) return "invalid";
  const { count } = await db.user.updateMany({
    where: { id: d.data.userId, role: { not: "ADMIN" } },
    data: { passwordHash: await bcrypt.hash(d.data.password, 10), passwordChangedAt: new Date() },
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

/**
 * Live streaming is hidden until an admin approves a teacher, one teacher at a time. Turning it off
 * again hides their live sessions everywhere without touching the sessions themselves.
 */
export async function setTeacherLive(form: FormData) {
  await requireAdmin();
  const id = z.string().parse(form.get("id"));
  const on = form.get("live") === "on";
  await db.user.updateMany({ where: { id, role: { in: ["INSTRUCTOR", "ADMIN"] } }, data: { liveApproved: on } });
  done();
  redirect(`/${form.get("locale") === "en" ? "en" : "ar"}/admin/teachers/${id}`);
}
