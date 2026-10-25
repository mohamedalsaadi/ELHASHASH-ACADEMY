import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { VerifyForm } from "./VerifyForm";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/verify", "verify", { key: "title", noindex: true });
}

export default async function VerifyPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("verify");
  return (
    <main className="mx-auto grid max-w-sm gap-6 px-4 py-16">
      <h1 className="font-display text-h1 font-semibold">{t("title")}</h1>
      <p className="text-small text-ink-muted">{t("lede")}</p>
      <VerifyForm token={token} />
    </main>
  );
}
