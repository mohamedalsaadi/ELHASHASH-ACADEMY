import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/app/[locale]/signin/AuthShell";
import { Link } from "@/i18n/navigation";
import { ForgotForm } from "./ForgotForm";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/forgot", "forgot", { key: "title", noindex: true });
}

export default async function ForgotPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("forgot");
  return (
    <AuthShell>
      <h1 className="font-display text-h1 font-semibold">{t("title")}</h1>
      <p className="text-small text-ink-muted">{t("lede")}</p>
      <ForgotForm />
      <Link href="/signin" className="text-small text-pen underline-offset-4 hover:underline">
        {t("back")}
      </Link>
    </AuthShell>
  );
}
