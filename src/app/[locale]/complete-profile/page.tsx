import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthShell } from "@/app/[locale]/signin/AuthShell";
import { CountryGrade } from "@/components/CountryGrade";
import { PhoneField } from "@/components/ui/PhoneField";
import { Req } from "@/components/ui/Req";
import { db } from "@/lib/db";
import { gradeCoursesUrl, gradeGroups } from "@/lib/catalog";
import { completeProfileUrl, missingProfile } from "@/lib/profile";
import { safeNext } from "@/lib/safe-redirect";
import { completeProfile } from "./actions";
import { BirthAndGuardian } from "./BirthAndGuardian";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/complete-profile", "signup", { key: "completeTitle", noindex: true });
}

export default async function CompleteProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; next?: string; phone?: string }>;
}) {
  const { locale } = await params;
  const { error, next: rawNext, phone: phoneParam } = await searchParams;
  setRequestLocale(locale);
  // The page the student was heading to (a course, the cart); only a same-site path is kept.
  const next = safeNext(rawNext, "");
  // Checkout sends `phone=1`: the number is asked only when the student is about to pay.
  const askPhone = phoneParam === "1";

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/signin?next=${encodeURIComponent(completeProfileUrl(locale, next, askPhone))}`);
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, phone: true, gradeId: true, dateOfBirth: true },
  });
  if (!user) redirect(`/${locale}/signin`);
  if (user.role !== "STUDENT") {
    const home = user.role === "PARENT" ? "parent" : user.role === "ADMIN" ? "admin" : "teacher";
    redirect(`/${locale}/${home}`);
  }
  const missing = missingProfile(user);
  const ask = { grade: missing.grade, dob: missing.dob, phone: missing.phone && askPhone };
  if (!ask.grade && !ask.dob && !ask.phone) redirect(next || (await gradeCoursesUrl(locale, user.gradeId)));

  const t = await getTranslations("signup");
  const tc = await getTranslations("common");
  const groups = ask.grade ? await gradeGroups(locale) : [];

  return (
    <AuthShell>
      <h1 className="font-display text-h1 font-semibold">{t("completeTitle")}</h1>
      <p className="text-small text-ink-muted">{ask.grade || ask.dob ? t("completeHint") : t("completePhoneHint")}</p>
      <form action={completeProfile} className="grid gap-4">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="next" value={next} />
        {askPhone && <input type="hidden" name="askPhone" value="1" />}
        <p className="text-label text-ink-muted">{tc("requiredNote")}</p>
        {ask.grade && <CountryGrade groups={groups} invalid={error === "invalid_grade"} />}
        {ask.dob && <BirthAndGuardian />}
        {ask.phone && (
          <div className="grid gap-2 text-label text-ink-muted">
            <Req>{t("phone")}</Req>
            <PhoneField invalid={error === "invalid_phone" || error === "phone_taken"} />
            <span className="text-label">{t("phoneHint")}</span>
          </div>
        )}
        {error && (
          <p role="alert" className="text-small text-down">
            {t.has(`errors.${error}`) ? t(`errors.${error}`) : t("errors.invalid_phone")}
          </p>
        )}
        <button className="btn btn-primary">{t("completeSubmit")}</button>
      </form>
    </AuthShell>
  );
}
