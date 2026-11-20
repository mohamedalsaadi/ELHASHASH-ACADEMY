import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthShell } from "@/app/[locale]/signin/AuthShell";
import { CountryGrade } from "@/components/CountryGrade";
import { field } from "@/components/ui/form";
import { PhoneField } from "@/components/ui/PhoneField";
import { Req } from "@/components/ui/Req";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { gradeGroups } from "@/lib/catalog";
import { completeProfileUrl, profileIncomplete } from "@/lib/profile";
import { safeNext } from "@/lib/safe-redirect";
import { completeProfile } from "./actions";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/complete-profile", "signup", { key: "completeTitle", noindex: true });
}

export default async function CompleteProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { locale } = await params;
  const { error, next: rawNext } = await searchParams;
  setRequestLocale(locale);
  // The page the student was heading to (a course, the cart); only a same-site path is kept.
  const next = safeNext(rawNext, "");

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/signin?next=${encodeURIComponent(completeProfileUrl(locale, next))}`);
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, phone: true, gradeId: true },
  });
  if (!user) redirect(`/${locale}/signin`);
  if (user.role !== "STUDENT") {
    const home = user.role === "PARENT" ? "parent" : user.role === "ADMIN" ? "admin" : "teacher";
    redirect(`/${locale}/${home}`);
  }
  if (!profileIncomplete(user)) redirect(next || `/${locale}/dashboard`);

  const t = await getTranslations("signup");
  const tc = await getTranslations("common");
  const groups = await gradeGroups(locale);

  return (
    <AuthShell>
      <h1 className="font-display text-h1 font-semibold">{t("completeTitle")}</h1>
      <p className="text-small text-ink-muted">{t("completeHint")}</p>
      <form action={completeProfile} className="grid gap-4">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="next" value={next} />
        <p className="text-label text-ink-muted">{tc("requiredNote")}</p>
        <div className="grid gap-2 text-label text-ink-muted">
          <Req>{t("phone")}</Req>
          <PhoneField />
          <span className="text-label">{t("phoneHint")}</span>
        </div>
        <CountryGrade groups={groups} invalid={error === "invalid_grade"} />
        <label className="grid gap-2 text-label text-ink-muted">
          <Req>{t("dateOfBirth")}</Req>
          <input type="date" name="dateOfBirth" required max={new Date().toISOString().slice(0, 10)} dir="ltr" className={field} />
          <span className="text-label">{t("dateOfBirthHint")}</span>
        </label>
        <label className="grid gap-2 text-label text-ink-muted">
          {t("guardianName")}
          <input name="guardianName" autoComplete="name" minLength={2} maxLength={80} dir="auto" className={field} />
          <span className="text-label">{t("guardianHint")}</span>
        </label>
        <div className="grid gap-2 text-label text-ink-muted">
          {t("guardianPhone")}
          <PhoneField name="guardianPhone" required={false} />
          <span className="text-label">{t("guardianPhoneHint")}</span>
        </div>
        <label className="grid gap-2 text-label text-ink-muted">
          {t("guardianEmail")}
          <input type="email" name="guardianEmail" autoComplete="email" dir="ltr" className={field} />
          <span className="text-label">{t("guardianEmailHint")}</span>
        </label>
        <label className="flex min-h-11 items-center gap-3 text-small">
          <input type="checkbox" name="guardianConsent" className="size-5 shrink-0" />
          <span>{t("guardianConsent")}</span>
        </label>
        <label className="flex min-h-11 items-center gap-3 text-small">
          <input type="checkbox" name="acceptTerms" required className="size-5 shrink-0" />
          <span>
            <span aria-hidden="true" className="text-down">* </span>
            {t.rich("acceptTerms", {
              terms: (chunks) => (
                <Link href="/terms" className="text-ink underline underline-offset-4">
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link href="/privacy" className="text-ink underline underline-offset-4">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </label>
        {error && (
          <p role="alert" className="text-small text-down">
            {t.has(`errors.${error}`) ? t(`errors.${error}`) : t("errors.invalid_phone")}
          </p>
        )}
        <button className="btn btn-primary">{t("submit")}</button>
      </form>
    </AuthShell>
  );
}
