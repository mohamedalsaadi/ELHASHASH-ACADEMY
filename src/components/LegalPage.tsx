import { CONTACT_EMAIL } from "@/lib/site";

/** Policy pages carry their own date: a currency change edits the terms, not the privacy page. */
const DEFAULT_UPDATED = "2026-10-24";

export type Section = { h: string; body: React.ReactNode };

/** Plain reading page for the policies: title, last-updated date, numbered sections. */
export function LegalPage({
  locale,
  title,
  sections,
  updated = DEFAULT_UPDATED,
  children,
}: {
  locale: string;
  title: string;
  sections: Section[];
  updated?: string;
  children?: React.ReactNode;
}) {
  const ar = locale === "ar";
  const date = new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${updated}T00:00:00Z`),
  );
  return (
    <main className="mx-auto grid w-full max-w-(--container-reading) gap-10 px-4 py-12 sm:py-16">
      <header className="grid gap-3">
        <h1 className="font-display text-h1 font-bold">{title}</h1>
        <p className="text-small text-ink-muted">{ar ? `آخر تحديث: ${date}` : `Last updated: ${date}`}</p>
        <ContourDivider />
      </header>
      {children}
      {sections.map((s, i) => (
        <section key={s.h} className="grid gap-3">
          <h2 className="flex items-baseline gap-3 font-display text-h3 font-bold">
            <span className="num text-small text-ink-muted">{String(i + 1).padStart(2, "0")}</span>
            {s.h}
          </h2>
          <div className="grid gap-3 text-ink [&_a]:text-pen [&_a]:underline [&_a]:underline-offset-4 [&_li]:ms-5 [&_ul]:grid [&_ul]:list-disc [&_ul]:gap-1">
            {s.body}
          </div>
        </section>
      ))}
    </main>
  );
}

/** The one ornament on a reading page: three contour lines in the elevation ramp, thin and still. */
function ContourDivider() {
  return (
    <svg viewBox="0 0 240 20" preserveAspectRatio="none" aria-hidden="true" className="mt-2 h-5 w-full fill-none">
      <g strokeWidth="1.2" strokeLinecap="round">
        <path d="M0 18C60 17 110 12 160 9S220 6 240 5" className="stroke-contour-2" vectorEffect="non-scaling-stroke" />
        <path d="M0 14C60 13 110 8 160 5S220 3 240 2" className="stroke-contour-3" vectorEffect="non-scaling-stroke" />
        <path d="M0 10C70 9 120 5 170 3S225 1 240 1" className="stroke-contour-4" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}

export function Mail() {
  return <a href={`mailto:${CONTACT_EMAIL}`} dir="ltr">{CONTACT_EMAIL}</a>;
}
