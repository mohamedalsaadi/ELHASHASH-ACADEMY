import { getLocale, getTranslations } from "next-intl/server";
import { Wordmark } from "@/components/brand/Mark";
import { Link } from "@/i18n/navigation";
import { InstallApp } from "@/components/InstallApp";
import { getSeller } from "@/components/SellerLine";
import { CONTACT_EMAIL } from "@/lib/site";

const footLink = "inline-flex min-h-11 min-w-11 items-center transition-colors duration-(--dur-fast) ease-(--ease-out) hover:text-ink";

export async function SiteFooter() {
  const [t, locale, seller] = await Promise.all([getTranslations("footer"), getLocale(), getSeller()]);
  const operator = [seller.name, seller.address].filter(Boolean).join(locale === "ar" ? "، " : ", ");
  return (
    <footer className="mt-24 border-t border-hairline print:hidden">
      <div className="mx-auto grid max-w-(--container-page) gap-6 px-4 py-10 text-small text-ink-muted">
        <div className="grid justify-items-start gap-2">
          <span className="text-ink">
            <Wordmark locale={locale} className="text-[1.35rem]" />
          </span>
          <span>{t("tagline")}</span>
          {operator && <span>{operator}</span>}
          {seller.licence && <span>{t("sellerLicence", { no: seller.licence })}</span>}
        </div>
        <nav aria-label={t("legalNav")} className="flex flex-wrap items-center gap-x-6">
          {(["terms", "refund", "privacy", "accessibility", "faq", "contact"] as const).map((k) => (
            <Link key={k} href={`/${k}`} className={footLink}>
              {t(k)}
            </Link>
          ))}
          <a href={`mailto:${CONTACT_EMAIL}`} dir="ltr" className={`${footLink} [overflow-wrap:anywhere]`}>
            {CONTACT_EMAIL}
          </a>
          <InstallApp />
        </nav>
        <span className="border-t border-hairline pt-5 text-label">© {new Date().getFullYear()} {t("rights")}</span>
      </div>
    </footer>
  );
}
