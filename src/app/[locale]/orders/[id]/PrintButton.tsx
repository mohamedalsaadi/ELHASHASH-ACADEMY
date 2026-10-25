"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-sm border border-ink-muted px-4 py-2 font-display text-small font-semibold transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised print:hidden"
    >
      {label}
    </button>
  );
}
