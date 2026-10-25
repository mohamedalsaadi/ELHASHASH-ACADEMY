"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransitionRouter } from "next-view-transitions";
import { getPathname, Link, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

// Keeps the path, query and hash when the language changes; the fallback Link still works without JS.
export function LocaleSwitch() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const t = useTranslations("nav");
  const router = useTransitionRouter();
  const other: Locale = locale === "ar" ? "en" : "ar";

  return (
    <Link
      href={pathname}
      locale={other}
      lang={other}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        const href = `${pathname}${window.location.search}${window.location.hash}`;
        router.push(getPathname({ href, locale: other }));
      }}
      className="inline-flex min-h-11 items-center rounded-sm border border-hairline px-3 py-2 font-display text-label transition-colors duration-(--dur-fast) ease-(--ease-out) hover:border-ink-muted hover:bg-raised"
    >
      {t("switchLocale")}
    </Link>
  );
}
