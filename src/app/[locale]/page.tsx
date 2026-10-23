import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { LocaleSwitch } from "@/components/LocaleSwitch";

export default function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("home");

  return (
    <main className="mx-auto grid max-w-5xl gap-12 px-4 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-hairline pb-4">
        <span className="font-display text-h3 font-bold tracking-wide">
          ELHASHASH <span className="text-amber">ACADEMY</span>
        </span>
        <LocaleSwitch />
      </header>

      <section className="grid gap-4">
        <h1 className="font-display text-display font-semibold text-balance">{t("headline")}</h1>
        <p className="max-w-[65ch] text-ink-muted">{t("lede")}</p>
        <div className="flex flex-wrap gap-3">
          <a
            href="#"
            className="rounded-sm bg-amber-fill px-[18px] py-3 font-display font-semibold text-on-amber transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-[color-mix(in_oklab,var(--color-amber-fill)_86%,#fff)]"
          >
            {t("ctaFree")}
          </a>
        </div>
      </section>
    </main>
  );
}
