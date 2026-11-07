import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/app/[locale]/signin/AuthShell";
import { redirect } from "next/navigation";
import { whatsappEnabled } from "@/lib/whatsapp";
import { SocialButtons } from "@/components/auth/SocialButtons";
import { Link } from "@/i18n/navigation";
import { logEventLater } from "@/lib/analytics";
import { gradeGroups } from "@/lib/catalog";
import { SignUpForm } from "./SignUpForm";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/signup", "signup", { key: "title", noindex: true });
}

export default async function SignUpPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; type?: string }>;
}) {
  const { locale } = await params;
  const { next, type } = await searchParams;
  setRequestLocale(locale);
  // One front door: with WhatsApp set up, sign-in and sign-up are the same screen.
  if (whatsappEnabled()) redirect(`/${locale}/signin?${new URLSearchParams({ ...(next ? { next } : {}), ...(type ? { type } : {}) })}`);
  const t = await getTranslations("signup");
  const groups = await gradeGroups(locale);

  void logEventLater({ name: "signup_viewed", dedupeScope: "signup" });

  return (
    <AuthShell>
      <h1 className="font-display text-h1 font-semibold">{t("title")}</h1>
      <SocialButtons locale={locale} next={next} />
      <SignUpForm groups={groups} locale={locale} next={next ?? ""} parent={type === "PARENT"} />
      <p className="text-small text-ink-muted">
        {t("haveAccount")}{" "}
        <Link href={{ pathname: "/signin", query: next ? { next } : {} }} className="text-ink underline underline-offset-4">
          {t("signIn")}
        </Link>
      </p>
      {/* Teachers register themselves; the owner approves. This line is their door on the public site. */}
      <p className="text-label text-ink-muted">
        {t("teacherQ")}{" "}
        <Link href="/teach" className="underline underline-offset-4 hover:text-ink">
          {t("teacherLink")}
        </Link>
      </p>
    </AuthShell>
  );
}
