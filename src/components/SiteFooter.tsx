import { getLocale, getTranslations } from "next-intl/server";
import { Wordmark } from "@/components/brand/Mark";
import { Link } from "@/i18n/navigation";
import { InstallApp } from "@/components/InstallApp";
import { CONTACT_EMAIL } from "@/lib/site";

const footLink = "inline-flex min-h-11 min-w-11 items-center justify-center transition-colors duration-(--dur-fast) ease-(--ease-out) hover:text-ink";

export async function SiteFooter() {
  const [t, locale] = await Promise.all([getTranslations("footer"), getLocale()]);
  return (
    <footer className="mt-16 border-t border-hairline bg-surface print:hidden">
      <div className="mx-auto flex max-w-(--container-page) flex-wrap items-center justify-between gap-x-6 gap-y-5 px-4 py-8 text-small text-ink-muted">
        <div className="grid gap-2">
          <span className="justify-self-start text-ink">
            <Wordmark locale={locale} className="text-[1.5rem]" />
          </span>
          <span>{t("tagline")}</span>
        </div>
        <nav aria-label={t("legalNav")} className="flex flex-wrap items-center gap-x-5">
          {(["terms", "refund", "privacy", "faq", "contact"] as const).map((k) => (
            <Link key={k} href={`/${k}`} className={footLink}>
              {t(k)}
            </Link>
          ))}
          <a href={`mailto:${CONTACT_EMAIL}`} dir="ltr" className={footLink}>
            {CONTACT_EMAIL}
          </a>
          <InstallApp />
        </nav>
        <span className="basis-full">© {new Date().getFullYear()} {t("rights")}</span>
      </div>
      {/* Every page closes on three contour lines rising to one gold summit point. */}
      <div aria-hidden="true" className="contour-rule h-7" />
    </footer>
  );
}
