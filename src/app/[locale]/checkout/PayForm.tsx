"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

type Method = "CARD" | "WALLET" | "KIOSK" | "VALU";

type Learner = { id: string; name: string };

export function PayForm({ skuIds, locale, methods, gateway, coupon, learners }: { skuIds: string[]; locale: string; methods: Method[]; gateway: "PAYMOB" | "ZIINA" | "STRIPE"; coupon?: string; learners?: Learner[] }) {
  const t = useTranslations("checkout");
  const [method, setMethod] = useState<Method>(methods[0]);
  // Set only for a parent: the child the access goes to.
  const [learner, setLearner] = useState<string | undefined>(learners?.[0]?.id);
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
        body: JSON.stringify({ skuIds, method, locale, coupon, forStudentId: learner }),
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
      {learners && (
        <label className="grid gap-1 text-label text-ink-muted">
          {t("forChild")}
          <select
            value={learner}
            onChange={(e) => setLearner(e.target.value)}
            className="min-h-11 rounded-sm border border-rule bg-surface px-3 text-body text-ink"
          >
            {learners.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-label text-ink-muted">{t("method")}</legend>
        {methods.map((m) => (
          <label
            key={m}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-hairline bg-surface shadow-paper p-4 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised has-checked:border-primary has-checked:ring-2 has-checked:ring-primary/20"
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
