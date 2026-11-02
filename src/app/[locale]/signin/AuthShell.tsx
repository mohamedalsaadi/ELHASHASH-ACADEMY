import { getLocale, getTranslations } from "next-intl/server";
import { Wordmark } from "@/components/brand/Mark";

/** Every sign-in, sign-up and token page: the form on a paper card, a small night-map panel beside it from `md`. */
export async function AuthShell({ children }: { children: React.ReactNode }) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("auth")]);
  return (
    <main className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-12 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] md:py-16">
      <div className="card grid content-start gap-6 p-6 sm:p-8">{children}</div>
      <aside className="stage hidden content-between gap-8 rounded-lg p-8 md:grid">
        <Wordmark locale={locale} className="text-h2" />
        <p className="font-display text-h3 font-semibold text-night-text">{t("panel")}</p>
      </aside>
    </main>
  );
}
