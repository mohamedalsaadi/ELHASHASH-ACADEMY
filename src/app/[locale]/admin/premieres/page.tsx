import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireAdmin } from "@/lib/staff";
import { AdminNav } from "../AdminNav";
import { PremiereManager } from "./PremiereManager";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/admin/premieres", "office", { key: "nav.premieres", noindex: true });
}

export default async function AdminPremieresPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ error?: string }> }) {
  const { locale } = await params;
  const { error } = await searchParams;
  setRequestLocale(locale);
  const me = await requireAdmin();
  const t = await getTranslations("premiere.admin");

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-12">
      <AdminNav current="premieres" title={t("title")} />
      <PremiereManager locale={locale} me={me} error={error} />
    </main>
  );
}
