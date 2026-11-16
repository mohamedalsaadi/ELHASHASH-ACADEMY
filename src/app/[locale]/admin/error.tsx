"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { errorText, reportClient } from "@/lib/client-log";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");
  useEffect(() => {
    reportClient("client.error", errorText(error), { digest: error.digest });
  }, [error]);
  return (
    <main className="mx-auto grid max-w-xl justify-items-center gap-4 px-4 py-24 text-center">
      <h1 className="font-display text-h1 font-semibold">{t("errorTitle")}</h1>
      <p className="text-ink-muted">{t("errorBody")}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button onClick={reset} className="btn btn-primary text-small">
          {t("retry")}
        </button>
        <Link href="/admin" className="btn btn-outline px-4 text-small hover:bg-raised">
          {t("backToAdmin")}
        </Link>
      </div>
    </main>
  );
}
