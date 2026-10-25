import { getTranslations, setRequestLocale } from "next-intl/server";
import { ResetForm } from "./ResetForm";

export default async function ResetPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("reset");
  return (
    <main className="mx-auto grid max-w-sm gap-6 px-4 py-16">
      <h1 className="font-display text-h1 font-semibold">{t("title")}</h1>
      <ResetForm token={token} />
    </main>
  );
}
