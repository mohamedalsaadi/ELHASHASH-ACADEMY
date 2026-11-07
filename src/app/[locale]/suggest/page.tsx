import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageMetadata } from "@/lib/seo";
import { SuggestForm } from "./SuggestForm";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/suggest", "suggest", { key: "title" });
}

export default async function SuggestPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("suggest");
  return (
    <main className="mx-auto grid max-w-xl gap-6 px-4 py-16">
      <h1 className="font-display text-h1 font-bold">{t("title")}</h1>
      <p className="text-ink-muted">{t("lede")}</p>
      <SuggestForm locale={locale} />
    </main>
  );
}
