"use client";

import { useTranslations } from "next-intl";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");
  return (
    <main className="mx-auto grid max-w-xl justify-items-center gap-4 px-4 py-24 text-center">
      <h1 className="font-display text-h1 font-semibold">{t("errorTitle")}</h1>
      <p className="text-ink-muted">{t("errorBody")}</p>
      <button
        onClick={reset}
        className="rounded-sm bg-primary px-[18px] py-3 font-display text-small font-semibold text-on-primary transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-[color-mix(in_oklab,var(--color-primary)_86%,#fff)]"
      >
        {t("retry")}
      </button>
    </main>
  );
}
