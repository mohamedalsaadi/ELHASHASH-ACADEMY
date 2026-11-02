"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice?: Promise<{ outcome: string }> };

export function InstallApp() {
  const t = useTranslations("pwa");
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem("dhirwa-install-dismissed") === "1") return;
    } catch {
      // Private mode: still offer install, just without the remembered dismissal.
    }
    if (matchMedia("(display-mode: standalone)").matches) return;
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
      setHidden(false);
    };
    addEventListener("beforeinstallprompt", handler);
    return () => removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (hidden || !prompt) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem("dhirwa-install-dismissed", "1");
    } catch {
      // Ignore storage failures.
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={async () => {
          try {
            await prompt.prompt();
          } catch {
            // The browser can cancel the prompt; dismissal still applies.
          }
          dismiss();
        }}
        className="btn btn-outline text-small"
      >
        {t("install")}
      </button>
      <button onClick={dismiss} aria-label={t("dismiss")} className="grid size-11 place-items-center rounded-full text-small text-ink-muted hover:bg-raised hover:text-ink">
        ×
      </button>
    </span>
  );
}
