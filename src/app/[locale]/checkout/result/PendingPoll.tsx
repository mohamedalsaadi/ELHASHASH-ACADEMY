"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the result page while a payment is pending; stops after two minutes. */
export function PendingPoll({ seconds = 120 }: { seconds?: number }) {
  const t = useTranslations("checkout.result");
  const router = useRouter();

  useEffect(() => {
    const id = window.setInterval(() => router.refresh(), 5000);
    const stop = window.setTimeout(() => window.clearInterval(id), seconds * 1000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(stop);
    };
  }, [router, seconds]);

  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      className="inline-flex min-h-(--control-h) w-fit items-center rounded-full border border-hairline bg-surface px-4 py-2 font-display text-small font-semibold transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
    >
      {t("refresh")}
    </button>
  );
}
