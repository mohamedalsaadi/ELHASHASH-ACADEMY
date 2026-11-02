"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Link } from "@/i18n/navigation";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto grid max-w-xl justify-items-center gap-4 px-4 py-24 text-center">
      <h1 className="font-display text-h1 font-semibold">{t("errorTitle")}</h1>
      <p className="text-ink-muted">{t("errorBody")}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={reset}
          className="btn btn-primary text-small"
        >
          {t("retry")}
        </button>
        <Link href="/contact" className="btn btn-outline text-small">
          {t("contact")}
        </Link>
        <Link href="/" className="px-3 py-3 text-small text-pen underline-offset-4 hover:underline">
          {t("home")}
        </Link>
      </div>
    </main>
  );
}
