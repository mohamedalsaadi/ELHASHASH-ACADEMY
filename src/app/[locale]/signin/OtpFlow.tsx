"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { PhoneField } from "@/components/ui/PhoneField";
import { Req } from "@/components/ui/Req";
import { field, label } from "@/components/ui/form";
import { Link } from "@/i18n/navigation";
import { ageOn, parseBirthDate } from "@/lib/age";
import { otpStep, type OtpState } from "./otp-actions";

function Go({ children, pending, step }: { children: React.ReactNode; pending: string; step?: string }) {
  const { pending: busy } = useFormStatus();
  return (
    <button disabled={busy} name={step ? "step" : undefined} value={step} className="btn btn-primary">
      {busy ? pending : children}
    </button>
  );
}

type Group = { label: string; grades: { id: string; name: string }[] };

/** Phone, then the WhatsApp code, then (for a new number only) a short profile. One page, no password. */
export function OtpFlow({ groups, locale, next, parent }: { groups: Group[]; locale: string; next: string; parent?: boolean }) {
  const t = useTranslations("otp");
  const ts = useTranslations("signup");
  const tc = useTranslations("common");
  const [state, action] = useActionState<OtpState, FormData>(otpStep, { step: "phone" });
  const step = state?.step ?? "phone";
  const err = state && "error" in state ? state.error : undefined;
  const v = state?.step === "finish" ? state.values : undefined;

  const [type, setType] = useState<"STUDENT" | "PARENT">(parent ? "PARENT" : "STUDENT");
  const [dob, setDob] = useState("");
  const born = parseBirthDate(dob);
  const minor = born !== null && ageOn(born) < 18;
  const hidden = (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
    </>
  );
  const alert = err && (
    <p id="otp-error" role="alert" className="text-small text-down">
      {t.has(`errors.${err}`) ? t(`errors.${err}`) : ts(`errors.${err}` as never)}
    </p>
  );

  if (step === "code" && state?.step === "code") {
    return (
      <form action={action} className="grid gap-4">
        {hidden}
        <input type="hidden" name="phone" value={state.phone} />
        <p className="text-small text-ink-muted">{t("codeHint", { phone: state.phone })}</p>
        <label className={label}>
          <Req>{t("code")}</Req>
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            dir="ltr"
            aria-describedby="otp-error"
            className={`${field} text-center tracking-[0.5em]`}
          />
        </label>
        {alert}
        <Go pending={t("checking")} step="code">{t("verify")}</Go>
        <p className="text-small text-ink-muted">
          {/* Sending again is the phone step with the same number; the server's limits apply to it too. */}
          <button type="submit" formNoValidate name="step" value="phone" className="underline underline-offset-4">
            {t("resend")}
          </button>
        </p>
      </form>
    );
  }

  if (step === "finish" && state?.step === "finish") {
    return (
      <form action={action} className="grid gap-4">
        {hidden}
        <input type="hidden" name="step" value="finish" />
        <input type="hidden" name="proof" value={state.proof} />
        <p className="text-small text-ink-muted">{t("finishHint")}</p>
        <p className="text-label text-ink-muted">{tc("requiredNote")}</p>
        <label className={label}>
          <Req>{ts("type")}</Req>
          <select name="type" value={type} onChange={(e) => setType(e.target.value as "STUDENT" | "PARENT")} className={field}>
            <option value="STUDENT">{ts("typeStudent")}</option>
            <option value="PARENT">{ts("typeParent")}</option>
          </select>
        </label>
        <label className={label}>
          <Req>{ts("name")}</Req>
          <input name="name" autoComplete="name" required minLength={2} maxLength={80} defaultValue={String(v?.name ?? "")} dir="auto" className={field} />
        </label>
        {type === "STUDENT" ? (
          <>
            <label className={label}>
              <Req>{ts("grade")}</Req>
              <select name="gradeId" required defaultValue={String(v?.gradeId ?? "")} className={field}>
                <option value="" disabled>
                  {ts("gradePick")}
                </option>
                {groups.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.grades.map((gr) => (
                      <option key={gr.id} value={gr.id}>
                        {gr.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className={label}>
              <Req>{ts("dateOfBirth")}</Req>
              <input type="date" name="dateOfBirth" required max={new Date().toISOString().slice(0, 10)} value={dob} onChange={(e) => setDob(e.target.value)} dir="ltr" className={field} />
              <span className="text-label">{ts("dateOfBirthHint")}</span>
            </label>
            {minor && (
              <>
                <label className={label}>
                  {ts("guardianName")}
                  <input name="guardianName" autoComplete="name" minLength={2} maxLength={80} dir="auto" className={field} />
                  <span className="text-label">{ts("guardianHint")}</span>
                </label>
                <label className={label}>
                  {ts("guardianEmail")}
                  <input type="email" name="guardianEmail" autoComplete="email" dir="ltr" className={field} />
                  <span className="text-label">{ts("guardianEmailHint")}</span>
                </label>
                <label className="flex min-h-11 items-center gap-3 text-small">
                  <input type="checkbox" name="guardianConsent" className="size-5 shrink-0" />
                  <span>{ts("guardianConsent")}</span>
                </label>
              </>
            )}
          </>
        ) : (
          <p className="text-small text-ink-muted">{ts("parentHint")}</p>
        )}
        <label className={label}>
          {t("email")}
          <input name="email" type="email" autoComplete="email" dir="ltr" defaultValue={String(v?.email ?? "")} className={field} />
          <span className="text-label">{t("emailHint")}</span>
        </label>
        {alert}
        <label className="flex min-h-11 items-center gap-3 text-small">
          <input type="checkbox" name="acceptTerms" required defaultChecked={Boolean(v?.acceptTerms)} className="size-5 shrink-0" />
          <span>
            <span aria-hidden="true" className="text-down">* </span>
            {ts.rich("acceptTerms", {
              terms: (c) => (
                <Link href="/terms" className="text-ink underline underline-offset-4">
                  {c}
                </Link>
              ),
              privacy: (c) => (
                <Link href="/privacy" className="text-ink underline underline-offset-4">
                  {c}
                </Link>
              ),
            })}
          </span>
        </label>
        <Go pending={ts("submitting")}>{ts("submit")}</Go>
      </form>
    );
  }

  return (
    <form action={action} className="grid gap-4">
      {hidden}
      <input type="hidden" name="step" value="phone" />
      <div className={label}>
        <Req>{t("phone")}</Req>
        <PhoneField defaultValue={state?.step === "phone" ? state.phone : undefined} invalid={Boolean(err)} describedBy="otp-error" />
        <span className="text-label">{t("phoneHint")}</span>
      </div>
      {alert}
      <Go pending={t("sending")}>{t("send")}</Go>
    </form>
  );
}
