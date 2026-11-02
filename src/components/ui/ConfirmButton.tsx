"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

type Props = {
  action: (form: FormData) => void | Promise<void>;
  children: ReactNode;
  confirmText: string;
  className?: string;
  tone?: "danger" | "primary";
};

/** A button that asks in an accessible dialog before running its form action. */
export function ConfirmButton({ action, children, confirmText, className = "", tone = "danger" }: Props) {
  const t = useTranslations("common");
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);

  return (
    <>
      <button ref={trigger} type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        onClose={() => {
          setOpen(false);
          if (trigger.current?.isConnected) trigger.current.focus();
        }}
        className="m-auto w-[min(92vw,24rem)] rounded-lg border border-hairline bg-surface p-6 text-ink shadow-float backdrop:bg-night/50"
      >
        <h2 id={`${id}-title`} className="font-display text-h3 font-semibold">
          {confirmText}
        </h2>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="btn btn-outline text-small"
          >
            {t("cancel")}
          </button>
          <ConfirmSubmit action={action} tone={tone} />
        </div>
      </dialog>
    </>
  );
}

function ConfirmSubmit({ action, tone }: { action: (form: FormData) => void | Promise<void>; tone: "danger" | "primary" }) {
  const t = useTranslations("common");
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      formAction={action}
      disabled={pending}
      className={`btn text-small ${
        tone === "danger" ? "bg-down text-on-primary" : "btn-primary"
      }`}
    >
      {pending ? t("saving") : t("confirm")}
    </button>
  );
}
