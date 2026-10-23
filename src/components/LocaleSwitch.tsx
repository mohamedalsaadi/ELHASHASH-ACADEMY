"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

// Client-side route swap: the page re-renders in the other locale without a full reload, so the session cookie is untouched.
export function LocaleSwitch() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("nav");
  const other = locale === "ar" ? "en" : "ar";

  return (
    <Link
      href={pathname}
      locale={other}
      className="rounded-sm border border-hairline px-3 py-2 font-display text-label transition-colors duration-(--dur-fast) ease-(--ease-out) hover:border-ink-muted hover:bg-raised"
    >
      {t("switchLocale")}
    </Link>
  );
}
