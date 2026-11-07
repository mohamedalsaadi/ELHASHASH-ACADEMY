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
  numbered = true,
  children,
}: {
  locale: string;
  title: string;
  sections: Section[];
  updated?: string;
  numbered?: boolean;
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
      </header>
      {children}
      {sections.map((s, i) => (
        <section key={s.h} className="grid gap-3">
          <h2 className="flex items-baseline gap-3 font-display text-h3 font-bold">
            {numbered && <span className="num text-small text-ink-muted">{String(i + 1).padStart(2, "0")}</span>}
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

export function Mail() {
  return <a href={`mailto:${CONTACT_EMAIL}`} dir="ltr">{CONTACT_EMAIL}</a>;
}
