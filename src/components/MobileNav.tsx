"use client";

import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { ActiveLink } from "@/components/ActiveLink";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Link } from "@/i18n/navigation";

type Item = { href: string; label: string; badge?: number; primary?: boolean };

/** Phone navigation: native dialog, so focus is trapped and Escape closes it. */
export function MobileNav({ items, signOut }: { items: Item[]; signOut?: () => Promise<void> }) {
  const t = useTranslations("nav");
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const itemClass = "flex min-h-11 items-center justify-between gap-2 rounded-sm px-3 py-2 font-display text-body text-ink transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised";

  return (
    <>
      <button
        type="button"
        aria-label={t("menu")}
        aria-haspopup="dialog"
        onClick={() => {
          ref.current?.showModal();
          setOpen(true);
        }}
        className="grid size-11 place-items-center rounded-sm border border-hairline text-ink md:hidden"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>

      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        aria-label={t("menu")}
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none border-0 bg-surface p-0 text-ink backdrop:bg-ink/40 md:hidden"
      >
        <div className="flex h-full flex-col gap-5 overflow-y-auto p-5">
          <div className="flex justify-end">
            <form method="dialog">
              <button aria-label={t("close")} className="grid size-11 place-items-center rounded-sm border border-hairline text-ink">
                <X aria-hidden="true" className="size-5" />
              </button>
            </form>
          </div>

          <nav aria-label={t("mainNav")} className="grid gap-1">
            {items.map((item) =>
              item.primary ? (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => ref.current?.close()}
                  className="mt-2 rounded-sm bg-primary px-4 py-3 text-center font-display font-semibold text-on-primary"
                >
                  {item.label}
                </Link>
              ) : (
                <ActiveLink key={item.href} href={item.href} className={itemClass} onClick={() => ref.current?.close()}>
                  <span>{item.label}</span>
                  {item.badge ? (
                    <span className="rounded-full bg-down px-1.5 py-0.5 text-label font-semibold text-on-primary">{item.badge}</span>
                  ) : null}
                </ActiveLink>
              ),
            )}
          </nav>

          <div className="mt-auto grid gap-3 border-t border-hairline pt-4">
            <LocaleSwitch />
            {signOut && (
              <form action={signOut}>
                <SubmitButton pendingLabel={t("signingOut")} className="min-h-11 rounded-sm px-3 py-2 text-start font-display text-small text-ink-muted hover:bg-raised">
                  {t("signOut")}
                </SubmitButton>
              </form>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
