"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

const ORDER = ["system", "light", "dark"] as const;
type Choice = (typeof ORDER)[number];
const ICON = { system: Monitor, light: Sun, dark: Moon };

function read(): Choice {
  try {
    const s = localStorage.getItem("theme");
    return s === "light" || s === "dark" ? s : "system";
  } catch {
    return "system";
  }
}

/** Device, light or dark. One button that steps through them and names the current one. /theme-guard.js does the applying. */
export function ThemeToggle({ withLabel = false, className = "" }: { withLabel?: boolean; className?: string }) {
  const t = useTranslations("nav");
  const [choice, setChoice] = useState<Choice>("system");
  useEffect(() => setChoice(read()), []);

  const next = () => {
    const value = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length];
    try {
      if (value === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", value);
    } catch {}
    window.dispatchEvent(new Event("dhirwa-theme"));
    setChoice(value);
  };

  const Icon = ICON[choice];
  const label = t(`theme.${choice}`);
  return (
    <button
      type="button"
      onClick={next}
      aria-label={label}
      title={label}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full text-small font-medium text-ink-muted transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised hover:text-ink ${withLabel ? "px-4" : ""} ${className}`}
    >
      <Icon aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
      {withLabel && <span>{label}</span>}
    </button>
  );
}
