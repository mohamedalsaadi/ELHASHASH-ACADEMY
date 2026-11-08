"use client";

/**
 * A lesson PDF shown as page images: no download button, no selection, no context menu, hidden when printing, and a faint
 * name-and-phone mark over every page so a leaked screenshot points back to its student. A determined person can still
 * screenshot; this stops casual saving and sharing.
 */
export function PdfPages({ lessonId, count, mark, title }: { lessonId: string; count: number; mark: string; title: string }) {
  return (
    <div
      role="document"
      aria-label={title}
      onContextMenu={(e) => e.preventDefault()}
      className="grid max-h-[80vh] gap-3 overflow-y-auto bg-raised p-3 select-none print:hidden"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-sm bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/lesson-pages/${lessonId}/${i}`}
            alt={`${title} ${i + 1}`}
            loading={i < 2 ? "eager" : "lazy"}
            draggable={false}
            className="pointer-events-none block h-auto w-full"
          />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid grid-cols-2 content-around gap-y-16 overflow-hidden opacity-[0.12]">
            {Array.from({ length: 12 }, (_, k) => (
              <span key={k} dir="ltr" className="-rotate-25 text-center text-small font-semibold whitespace-nowrap text-ink">
                {mark}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
