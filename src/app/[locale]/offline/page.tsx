import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/offline", "offline", { key: "title", noindex: true });
}

export default async function OfflinePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("offline");
  return (
    <main className="mx-auto grid max-w-xl justify-items-center gap-4 px-4 py-24 text-center">
      <h1 className="font-display text-h1 font-semibold">{t("title")}</h1>
      <p className="text-ink-muted">{t("body")}</p>
      <Link href="/" className="btn btn-primary text-small">
        {t("back")}
      </Link>
    </main>
  );
}
