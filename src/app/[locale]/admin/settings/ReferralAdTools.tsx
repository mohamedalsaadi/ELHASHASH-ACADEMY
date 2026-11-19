"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { CopyButton } from "@/components/ui/CopyButton";
import { sendReferralAdTest } from "./referral-ad-test";

/** Test copy to the admin's own address, and the finished HTML to paste into another mailer. */
export function ReferralAdTools({ htmlAr, htmlEn }: { htmlAr: string; htmlEn: string }) {
  const t = useTranslations("office");
  const [res, run, pending] = useActionState(() => sendReferralAdTest(), null);
  return (
    <div className="grid gap-3">
      <form action={run} className="grid gap-3">
        <button type="submit" disabled={pending} className="btn btn-outline w-fit">
          {t("referralAdTest")}
        </button>
        {res && (
          <p role="status" className={`text-small break-all ${res.ok ? "text-up" : "text-down"}`}>
            {res.ok ? t("referralAdTestSent", { to: res.to }) : t("referralAdTestFailed", { detail: res.detail })}
          </p>
        )}
      </form>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-small">
        <span className="flex items-center gap-2">
          {t("referralAdCopyAr")}
          <CopyButton value={htmlAr} />
        </span>
        <span className="flex items-center gap-2">
          {t("referralAdCopyEn")}
          <CopyButton value={htmlEn} />
        </span>
      </div>
    </div>
  );
}
