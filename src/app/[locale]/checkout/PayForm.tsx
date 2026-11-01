"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

type Method = "CARD" | "WALLET" | "KIOSK" | "VALU";

export function PayForm({ skuIds, locale, methods, gateway, coupon }: { skuIds: string[]; locale: string; methods: Method[]; gateway: "PAYMOB" | "ZIINA" | "STRIPE"; coupon?: string }) {
  const t = useTranslations("checkout");
  const [method, setMethod] = useState<Method>(methods[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skuIds, method, locale, coupon }),
      });
      const data = (await res.json().catch(() => ({}))) as { checkoutUrl?: string; error?: string };
      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
        return;
      }
      setError(data.error && t.has(`errors.${data.error}`) ? t(`errors.${data.error}`) : t("errors.generic"));
    } catch {
      setError(t("errors.network"));
    } finally {
      setBusy(false);
    }
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
        className="btn btn-primary"
      >
        {busy ? t("redirecting") : t("pay")}
      </button>
    </form>
  );
}
