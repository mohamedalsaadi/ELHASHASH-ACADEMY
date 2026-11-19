"use client";

import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { Mark } from "@/components/brand/Mark";
import { CopyButton } from "@/components/ui/CopyButton";
import { Link } from "@/i18n/navigation";

type Ad = { percent: number; link: string | null };

/** Once per visit (browser tab session). `?referral=1` on the home page shows it again, for previews. */
const SEEN = "dh-referral-ad";

/**
 * The invite-a-friend popup: a small centred card over a very light veil, so the page stays visible behind it. It opens once
 * per visit right after the intro, only when an admin switched it on (the API answers `enabled: false` otherwise).
 * The intro has no end event, only `data-intro` on <html> (public/intro-guard.js), so this waits for that to clear.
 * A native <dialog> gives the focus trap, Escape, and a place above the intro in the top layer.
 */
export function ReferralPopup() {
  const t = useTranslations("referralAd");
  const locale = useLocale();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [ad, setAd] = useState<Ad | null>(null);

  useEffect(() => {
    const html = document.documentElement;
    const force = new URLSearchParams(location.search).has("referral");
    try {
      if (!force && sessionStorage.getItem(SEEN)) return;
    } catch {
      // Storage can be blocked; the popup then shows once per page load, which is acceptable.
    }
    let stopped = false;
    let timer: number | undefined;
    let watch: MutationObserver | undefined;

    const show = () => {
      timer = window.setTimeout(() => {
        if (stopped) return;
        try {
          sessionStorage.setItem(SEEN, "1");
        } catch {}
        dialog.current?.showModal();
      }, 600);
    };

    fetch(`/api/referral-ad?locale=${locale === "en" ? "en" : "ar"}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { enabled: boolean; percent: number; link: string | null } | null) => {
        if (stopped || !d?.enabled) return;
        setAd({ percent: d.percent, link: d.link });
        if (!html.dataset.intro) return show();
        watch = new MutationObserver(() => {
          if (html.dataset.intro) return;
          watch?.disconnect();
          show();
        });
        watch.observe(html, { attributes: true, attributeFilter: ["data-intro"] });
      })
      .catch(() => {});

    return () => {
      stopped = true;
      watch?.disconnect();
      window.clearTimeout(timer);
    };
  }, [locale]);

  const pct = ad?.percent ?? 0;
  const link = ad?.link ?? null;
  const shareText = link ? t("shareText", { link }) : "";

  return (
    <dialog
      ref={dialog}
      aria-labelledby={`${id}-title`}
      // A click on the veil lands on the dialog element itself; clicks inside land on its children.
      onClick={(e) => {
        if (e.target === dialog.current) dialog.current?.close();
      }}
      className="as-pop m-auto w-[min(92vw,22rem)] rounded-lg border border-hairline bg-surface p-0 text-ink shadow-float backdrop:bg-black/15"
    >
      {ad && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 p-6">
          <div className="flex items-start justify-between gap-3">
            <Mark size={36} className="text-ink" />
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label={t("close")}
              className="-m-2 inline-flex size-11 items-center justify-center rounded-full text-ink-muted transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>

          <span className="w-fit rounded-full bg-summit px-3 py-1 text-label font-semibold text-on-summit">{t("badge", { pct })}</span>
          <h2 id={`${id}-title`} className="font-display text-h3 font-semibold">
            {t("title", { pct })}
          </h2>
          <p className="text-small text-ink-muted">{t("line", { pct })}</p>

          <ul className="grid gap-1.5 text-small">
            {(["rule1", "rule2", "rule3"] as const).map((k) => (
              <li key={k} className="flex items-center gap-2">
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-ink-muted" />
                {t(k)}
              </li>
            ))}
          </ul>

          {link ? (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
              <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
                <span className="text-label text-ink-muted">{t("linkLabel")}</span>
                <div className="flex items-center justify-between gap-2 rounded-md border border-hairline bg-ground px-3 py-1.5">
                  <span dir="ltr" className="min-w-0 truncate text-small">
                    {link}
                  </span>
                  <CopyButton value={link} />
                </div>
              </div>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  // The phone's own share sheet when there is one; the WhatsApp link above is the fallback.
                  if (typeof navigator.share !== "function") return;
                  e.preventDefault();
                  navigator.share({ text: shareText }).catch(() => {});
                }}
                className="btn btn-primary w-full"
              >
                {t("share")}
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
              <p className="text-small text-ink-muted">{t("guestLine")}</p>
              <Link href="/signup" className="btn btn-primary w-full" onClick={() => dialog.current?.close()}>
                {t("signup")}
              </Link>
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
