"use server";

import bcrypt from "bcryptjs";
import { BCRYPT_COST } from "@/lib/schemas/auth";
import { headers } from "next/headers";
import { maskContacts } from "@/lib/contact-guard";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/client-ip";
import { appUrl, emailLayout, sendMail } from "@/lib/mail";
import { notifyAdmins } from "@/lib/notify";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import { teacherApplicationInput } from "@/lib/schemas/teacher-application";
import { verifyTurnstile } from "@/lib/turnstile";

export type TeachState = { status: "sent" | "invalid" | "taken" | "limited" } | null;

/** A teacher registers; the owner is told and decides. No account exists until then. */
export async function applyToTeach(_: TeachState, form: FormData): Promise<TeachState> {
  const d = teacherApplicationInput.safeParse({ ...Object.fromEntries(form), countryIds: form.getAll("countryId") });
  if (!d.success) return { status: "invalid" };
  const a = d.data;

  const ip = clientIp(await headers());
  if (!(await verifyTurnstile(String(form.get("cf-turnstile-response") ?? ""), ip))) return { status: "limited" };
  const key = `teach:${ip}`;
  if (await isLimited(key, 3, 60 * 60_000)) return { status: "limited" };
  // Count every attempt, taken or not, so probing for registered addresses is rate limited too.
  await recordAttempt(key);

  const countries = await db.country.findMany({ where: { id: { in: a.countryIds }, active: true }, select: { id: true } });
  if (countries.length !== a.countryIds.length) return { status: "invalid" };

  const taken =
    (await db.user.count({ where: { OR: [{ email: a.email }, { phone: a.phone }] } })) +
    (await db.teacherApplication.count({ where: { status: "PENDING", OR: [{ email: a.email }, { phone: a.phone }] } }));
  // Never say whether the address already has an account: answer exactly as for a new application.
  const passwordHash = await bcrypt.hash(a.password, BCRYPT_COST); // also run when taken, so timing does not give it away
  if (taken) return { status: "sent" };

  const name = maskContacts(a.name).text;
  const app = await db.teacherApplication.create({
    data: {
      name,
      email: a.email,
      phone: a.phone,
      passwordHash,
      locale: a.locale,
      bio: a.bio ? maskContacts(a.bio).text : null,
      subjectsNote: a.subjectsNote,
      countries: { create: countries.map((c) => ({ countryId: c.id })) },
    },
  });

  await notifyAdmins({
    kind: "SYSTEM",
    titleAr: `طلب تسجيل معلم جديد: ${name}`,
    titleEn: `New teacher application: ${name}`,
    href: "/admin/teachers",
    dedupeKey: `tapp:${app.id}`,
    email: false,
  });
  const ar = a.locale === "ar";
  await sendMail({
    to: a.email,
    subject: ar ? "استلمنا طلبك في ذروة" : "We received your Dhirwa application",
    html: emailLayout(
      ar ? "استلمنا طلبك" : "We received your application",
      [ar ? "سنراجع طلبك ونرد عليك بالبريد. بعد الموافقة تستطيع تسجيل الدخول ببريدك أو هاتفك وكلمة المرور التي اخترتها." : "We will review it and reply by email. Once approved you can sign in with your email or phone and the password you chose."],
      { href: `${appUrl()}/${a.locale}`, label: ar ? "الذهاب إلى ذروة" : "Go to Dhirwa" },
      ar ? "ar" : "en",
    ),
  });
  return { status: "sent" };
}
