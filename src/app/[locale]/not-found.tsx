import { getTranslations } from "next-intl/server";
import { EmptyMark } from "@/components/brand/Mark";
import { Link } from "@/i18n/navigation";

export async function generateMetadata() {
  const t = await getTranslations("errors");
  return { title: t("notFoundTitle"), robots: { index: false, follow: false } };
}

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <main className="mx-auto grid max-w-xl justify-items-center gap-4 px-4 py-24 text-center">
      <EmptyMark />
      <h1 className="font-display text-h1 font-semibold">{t("notFoundTitle")}</h1>
      <p className="text-ink-muted">{t("notFoundBody")}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-primary text-small">
          {t("home")}
        </Link>
        <Link href="/courses" className="btn btn-outline px-4 text-small hover:bg-raised">
          {t("courses")}
        </Link>
      </div>
    </main>
  );
}
