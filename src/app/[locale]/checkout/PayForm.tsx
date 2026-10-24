"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

type Method = "CARD" | "WALLET" | "KIOSK" | "VALU";

export function PayForm({ skuIds, locale, methods, gateway }: { skuIds: string[]; locale: string; methods: Method[]; gateway: "PAYMOB" | "STRIPE" }) {
  const t = useTranslations("checkout");
  const [method, setMethod] = useState<Method>(methods[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skuIds, method, locale }),
    });
    const data = (await res.json().catch(() => ({}))) as { checkoutUrl?: string; error?: string };
    if (data.checkoutUrl) {
      window.location.assign(data.checkoutUrl);
      return;
    }
    setError(t.has(`errors.${data.error}`) ? t(`errors.${data.error}`) : t("errors.generic"));
    setBusy(false);
  }

  return (
    <form onSubmit={pay} className="grid gap-4">
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-label text-ink-muted">{t("method")}</legend>
        {methods.map((m) => (
          <label
            key={m}
            className="flex cursor-pointer items-start gap-3 rounded-sm border border-hairline p-3 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised has-checked:border-pen"
          >
            <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} className="mt-1 accent-(--color-primary)" />
            <span className="grid">
              <span className="font-display font-medium">{t(`methods.${m}.name`)}</span>
              <span className="text-small text-ink-muted">{t(gateway === "STRIPE" && m === "CARD" ? "methods.CARD.hintStripe" : `methods.${m}.hint`)}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {error && (
        <p role="alert" className="text-small text-down">
          {error}
        </p>
      )}
      <button
        disabled={busy}
        className="rounded-sm bg-primary px-[18px] py-3 font-display font-semibold text-on-primary transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-[color-mix(in_oklab,var(--color-primary)_86%,#fff)] disabled:cursor-not-allowed disabled:opacity-45"
      >
        {busy ? t("redirecting") : t("pay")}
      </button>
    </form>
  );
}
