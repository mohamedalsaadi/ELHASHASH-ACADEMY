import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireStaff } from "@/lib/staff";
import { PremiereManager } from "../../admin/premieres/PremiereManager";
import { TeacherNav } from "../TeacherNav";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/teacher/premieres", "premiere", { key: "admin.title", noindex: true });
}

export default async function TeacherPremieresPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ error?: string }> }) {
  const { locale } = await params;
  const { error } = await searchParams;
  setRequestLocale(locale);
  const me = await requireStaff();
  const t = await getTranslations("premiere.admin");

  return (
    <main className="mx-auto grid max-w-4xl gap-6 px-4 py-12">
      <TeacherNav current="premieres" />
      <h1 className="font-display text-h1 font-semibold">{t("title")}</h1>
      <PremiereManager locale={locale} me={me} error={error} />
    </main>
  );
}
