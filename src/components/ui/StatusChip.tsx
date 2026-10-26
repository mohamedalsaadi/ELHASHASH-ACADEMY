import { Check, Clock, Lock, X } from "lucide-react";

export type ChipTone = "active" | "expiring" | "expired" | "locked" | "live" | "neutral";

const TONES: Record<ChipTone, { className: string; Icon: typeof Check | null }> = {
  active: { className: "border-pen text-pen", Icon: Check },
  expiring: { className: "border-ink text-ink", Icon: Clock },
  expired: { className: "border-down text-down", Icon: X },
  locked: { className: "border-hairline text-ink-muted", Icon: Lock },
  live: { className: "border-pen text-pen", Icon: null },
  neutral: { className: "border-hairline text-ink-muted", Icon: null },
};

/** State in a word and a glyph, never colour alone (DESIGN.md §2.4). Gold is reserved for earned progress. */
export function StatusChip({ tone, children, className = "" }: { tone: ChipTone; children: React.ReactNode; className?: string }) {
  const { className: toneClass, Icon } = TONES[tone];
  return (
    <span
      className={`inline-flex w-fit items-center gap-1 rounded-full border px-3 py-1 text-label font-medium ${toneClass} ${className}`}
    >
      {tone === "live" ? (
        <span aria-hidden="true" className="size-2 rounded-full bg-pen" />
      ) : Icon ? (
        <Icon aria-hidden="true" className="size-3.5" />
      ) : null}
      {children}
    </span>
  );
}
