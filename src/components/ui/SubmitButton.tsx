"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: string;
  showSaved?: boolean;
};

/** Disables while the surrounding form action runs and briefly confirms success. */
export function SubmitButton({ children, pendingLabel, showSaved = true, className = "", disabled, ...rest }: Props) {
  const { pending } = useFormStatus();
  const t = useTranslations("common");
  const [saved, setSaved] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      setSaved(false);
      return;
    }
    if (!wasPending.current) return;
    wasPending.current = false;
    if (!showSaved) return;
    setSaved(true);
    const id = window.setTimeout(() => setSaved(false), 1500);
    return () => window.clearTimeout(id);
  }, [pending, showSaved]);

  return (
    <button
      {...rest}
      disabled={pending || disabled}
      aria-disabled={pending || disabled || undefined}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-45`}
    >
      {pending ? (pendingLabel ?? t("saving")) : saved ? t("saved") : children}
    </button>
  );
}
