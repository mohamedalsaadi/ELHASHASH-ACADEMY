"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { appUrl, emailLayout, sendMail } from "@/lib/mail";
import { createNotification } from "@/lib/notify";
import { requireAdmin } from "@/lib/staff";

const idOnly = z.object({ id: z.string().min(1) });
const refresh = () => revalidatePath("/[locale]/admin/teachers", "page");

/** Approving a teacher's request for another country stores the grant; they can then add subjects and courses there. */
export async function approveCountryRequest(form: FormData) {
  const me = await requireAdmin();
  const { id } = idOnly.parse(Object.fromEntries(form));
  const req = await db.teacherCountryRequest.findUnique({ where: { id }, include: { country: true } });
  if (!req || req.status !== "PENDING") return;
  await db.$transaction([
    db.teacherCountry.createMany({ data: [{ userId: req.userId, countryId: req.countryId, approvedById: me.id }], skipDuplicates: true }),
    db.teacherCountryRequest.update({ where: { id }, data: { status: "APPROVED", decidedById: me.id, decidedAt: new Date() } }),
  ]);
  await createNotification({
    userId: req.userId,
    kind: "SYSTEM",
    titleAr: `تمت الموافقة على التدريس في ${req.country.nameAr}`,
    titleEn: `Approved: you can now teach in ${req.country.nameEn}`,
    href: "/teacher/subjects",
    dedupeKey: `tcr-ok:${id}`,
  });
  refresh();
}

export async function rejectCountryRequest(form: FormData) {
  const me = await requireAdmin();
  const { id } = idOnly.parse(Object.fromEntries(form));
  const req = await db.teacherCountryRequest.findUnique({ where: { id }, include: { country: true } });
  if (!req || req.status !== "PENDING") return;
  await db.teacherCountryRequest.update({ where: { id }, data: { status: "REJECTED", decidedById: me.id, decidedAt: new Date() } });
  await createNotification({
    userId: req.userId,
    kind: "SYSTEM",
    titleAr: `لم تتم الموافقة على التدريس في ${req.country.nameAr}`,
    titleEn: `Not approved: teaching in ${req.country.nameEn}`,
    href: "/teacher/subjects",
    dedupeKey: `tcr-no:${id}`,
  });
  refresh();
}

/** Approving an application creates the teacher account (with the password they chose) and their country grants, in one step. */
export async function approveApplication(form: FormData) {
  const me = await requireAdmin();
  const { id } = idOnly.parse(Object.fromEntries(form));
  const app = await db.teacherApplication.findUnique({ where: { id }, include: { countries: true } });
  if (!app || app.status !== "PENDING" || !app.email) return;
  // Someone may have registered with this email or phone since; then the owner must sort it out by hand.
  const clash = await db.user.count({ where: { OR: [{ email: app.email }, ...(app.phone ? [{ phone: app.phone }] : [])] } });
  if (clash) return;

  const ar = app.locale === "ar";
  await db.$transaction(async (trx) => {
    const user = await trx.user.create({
      data: {
        name: app.name,
        email: app.email,
        phone: app.phone,
        passwordHash: app.passwordHash,
        role: "INSTRUCTOR",
        locale: app.locale,
        ...(ar ? { bioAr: app.bio } : { bioEn: app.bio }),
      },
    });
    await trx.teacherCountry.createMany({ data: app.countries.map((c) => ({ userId: user.id, countryId: c.countryId, approvedById: me.id })) });
    await trx.teacherApplication.update({ where: { id }, data: { status: "APPROVED", reviewedById: me.id, reviewedAt: new Date() } });
  });
  await sendMail({
    to: app.email,
    subject: ar ? "تمت الموافقة على طلبك في ذروة" : "Your Dhirwa application is approved",
    html: emailLayout(
      ar ? "تمت الموافقة على طلبك" : "You are approved",
      [ar ? "سجّل الدخول ببريدك أو هاتفك وكلمة المرور التي اخترتها، ثم أضف موادك وأنشئ دوراتك." : "Sign in with your email or phone and the password you chose, then add your subjects and create your courses."],
      { href: `${appUrl()}/${app.locale}/signin`, label: ar ? "تسجيل الدخول" : "Sign in" },
      ar ? "ar" : "en",
    ),
  });
  refresh();
}

export async function rejectApplication(form: FormData) {
  const me = await requireAdmin();
  const d = z.object({ id: z.string().min(1), reason: z.string().trim().max(500).default("") }).parse(Object.fromEntries(form));
  const app = await db.teacherApplication.findUnique({ where: { id: d.id } });
  if (!app || app.status !== "PENDING") return;
  await db.teacherApplication.update({ where: { id: d.id }, data: { status: "REJECTED", rejectReason: d.reason || null, reviewedById: me.id, reviewedAt: new Date() } });
  if (app.email) {
    const ar = app.locale === "ar";
    await sendMail({
      to: app.email,
      subject: ar ? "بخصوص طلبك في ذروة" : "About your Dhirwa application",
      html: emailLayout(
        ar ? "لم نتمكن من قبول طلبك الآن" : "We could not accept your application now",
        d.reason ? [d.reason] : [ar ? "شكرًا لاهتمامك. نتمنى لك التوفيق." : "Thank you for your interest."],
        undefined,
        ar ? "ar" : "en",
      ),
    });
  }
  refresh();
}
