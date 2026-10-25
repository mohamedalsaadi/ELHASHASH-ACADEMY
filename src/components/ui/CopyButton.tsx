"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function CopyButton({ value }: { value: string }) {
  const t = useTranslations("common");
  const [copied, setCopied] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          } catch {
            // Clipboard access can be denied; the value stays visible on screen.
          }
        }}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-sm border border-hairline px-2.5 py-1 text-label text-ink-muted transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
      >
        {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
        <span>{copied ? t("copied") : t("copy")}</span>
      </button>
      <span role="status" className="sr-only">
        {copied ? t("copied") : ""}
      </span>
    </>
  );
}
