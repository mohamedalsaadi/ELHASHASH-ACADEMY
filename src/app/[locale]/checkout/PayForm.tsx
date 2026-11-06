"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { lookupStudent } from "./actions";

type Method = "CARD" | "WALLET" | "KIOSK" | "VALU";

type Learner = { id: string; name: string };

type Lookup = { state: "idle" | "checking" | "found" | "not_found"; name?: string };

export function PayForm({ skuIds, locale, methods, gateway, coupon, learners, needsPhone }: { skuIds: string[]; locale: string; methods: Method[]; gateway: "PAYMOB" | "ZIINA" | "STRIPE"; coupon?: string; learners?: Learner[]; needsPhone?: boolean }) {
  const t = useTranslations("checkout");
  const [method, setMethod] = useState<Method>(methods[0]);
  // Set only for a parent: the child the access goes to.
  const [learner, setLearner] = useState<string | undefined>(learners?.[0]?.id);
  const [phone, setPhone] = useState("");
  const [lookup, setLookup] = useState<Lookup>({ state: "idle" });
  const [attested, setAttested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkPhone() {
    const value = phone.trim();
    if (!value) {
      setLookup({ state: "idle" });
      return;
    }
    setLookup({ state: "checking" });
    try {
      const result = await lookupStudent(value);
      setLookup(result.ok ? { state: "found", name: result.name } : { state: result.reason === "not_found" ? "not_found" : "idle" });
    } catch {
      setLookup({ state: "idle" });
    }
  }

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (needsPhone && lookup.state !== "found") {
      setError(t(lookup.state === "not_found" ? "errors.child_not_found" : "errors.child_required"));
      return;
    }
    if (needsPhone && !attested) {
      setError(t("errors.attestation_required"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skuIds,
          method,
          locale,
          coupon,
          forStudentId: needsPhone ? undefined : learner,
          forStudentPhone: needsPhone ? phone.trim() : undefined,
          guardianAttestation: needsPhone ? attested : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { checkoutUrl?: string; error?: string };
      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
        return;
      }
      setError(data.error && t.has(`errors.${data.error}`) ? t(`errors.${data.error}`) : t("errors.generic"));
    } catch {
      setError(t("errors.network"));
      // Only on failure: on success the page navigates away, and re-enabling here would let a
      // second tap create a second order and a second gateway intent.
      setBusy(false);
    }
  }

  return (
    <form onSubmit={pay} className="grid gap-4">
      {learners && learners.length > 0 && (
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
      {needsPhone && (
        <div className="grid gap-3">
          <label className="grid gap-1 text-label text-ink-muted">
            {t("forChildPhone")}
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setLookup({ state: "idle" });
              }}
              onBlur={checkPhone}
              className="min-h-11 rounded-sm border border-rule bg-surface px-3 text-body text-ink"
            />
          </label>
          <p className="text-small text-ink-muted">{t("forChildPhoneHint")}</p>
          {lookup.state === "checking" && <p className="text-small text-ink-muted">{t("childChecking")}</p>}
          {lookup.state === "found" && <p className="text-small text-up">{t("childFound", { name: lookup.name ?? "" })}</p>}
          {lookup.state === "not_found" && (
            <p role="alert" className="text-small text-down">
              {t("errors.child_not_found")}
            </p>
          )}
          <label className="flex min-h-11 items-start gap-2 text-small">
            <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} className="mt-1 size-4" />
            {t("guardianAttestation")}
          </label>
        </div>
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
      {gateway === "ZIINA" && <p className="text-small text-ink-muted">{t("walletHint")}</p>}
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
