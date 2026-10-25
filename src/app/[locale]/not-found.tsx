import { getTranslations } from "next-intl/server";
import { EmptyMark } from "@/components/brand/Mark";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <main className="mx-auto grid max-w-xl justify-items-center gap-4 px-4 py-24 text-center">
      <EmptyMark />
      <h1 className="font-display text-h1 font-semibold">{t("notFoundTitle")}</h1>
      <p className="text-ink-muted">{t("notFoundBody")}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-sm bg-primary px-[18px] py-3 font-display text-small font-semibold text-on-primary">
          {t("home")}
        </Link>
        <Link href="/courses" className="rounded-sm border-[1.5px] border-ink px-4 py-3 font-display text-small font-semibold hover:bg-raised">
          {t("courses")}
        </Link>
      </div>
    </main>
  );
}
