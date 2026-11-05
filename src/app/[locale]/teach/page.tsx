import { pick } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/app/[locale]/signin/AuthShell";
import { db } from "@/lib/db";
import { TeachForm } from "./TeachForm";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/teach", "teach", { key: "title" });
}

export default async function TeachPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("teach");
  const ar = locale === "ar";
  const countries = (await db.country.findMany({ where: { active: true }, orderBy: { order: "asc" } })).map((c) => ({ id: c.id, name: pick(ar, c.nameAr, c.nameEn) }));

  return (
    <AuthShell>
      <h1 className="font-display text-h1 font-semibold">{t("title")}</h1>
      <p className="max-w-[65ch] text-small text-ink-muted">{t("intro")}</p>
      <TeachForm countries={countries} locale={locale} />
    </AuthShell>
  );
}
