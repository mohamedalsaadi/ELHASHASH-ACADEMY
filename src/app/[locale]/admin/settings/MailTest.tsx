"use client";

import { useActionState } from "react";
import { sendTestEmail } from "./mail-test";

export function MailTest({ title, hint, button }: { title: string; hint: string; button: string }) {
  const [res, run, pending] = useActionState(() => sendTestEmail(), null);
  return (
    <form action={run} className="grid gap-3">
      <h2 className="font-display text-h3 font-semibold">{title}</h2>
      <p className="text-small text-ink-muted">{hint}</p>
      <button type="submit" disabled={pending} className="btn btn-outline w-fit">
        {button}
      </button>
      {res && (
        <p role="status" dir="ltr" className={`text-small break-all ${res.ok ? "text-up" : "text-down"}`}>
          {res.ok ? `Accepted by Resend (${res.detail}) to ${res.to}` : `Failed: ${res.detail}`}
        </p>
      )}
    </form>
  );
}
