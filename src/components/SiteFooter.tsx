import { getLocale, getTranslations } from "next-intl/server";
import { Mark, Wordmark } from "@/components/brand/Mark";
import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const [t, locale] = await Promise.all([getTranslations("footer"), getLocale()]);
  return (
    <footer className="mt-8 border-t border-hairline bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-5 px-4 py-8 text-small text-ink-muted">
        <div className="grid gap-2">
          <span className="flex items-center gap-3 text-ink">
            <Mark size={36} />
            <Wordmark locale={locale} className="text-h3" />
          </span>
          <span>{t("tagline")}</span>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          {(["terms", "refund", "contact"] as const).map((k) => (
            <Link key={k} href={`/${k}`} className="hover:text-ink">
              {t(k)}
            </Link>
          ))}
        </nav>
        <span className="basis-full">© {new Date().getFullYear()} {t("rights")}</span>
      </div>
    </footer>
  );
}
