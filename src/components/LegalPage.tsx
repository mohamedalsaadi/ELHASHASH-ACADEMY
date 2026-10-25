import { CONTACT_EMAIL } from "@/lib/site";

const UPDATED = new Date("2026-10-24T00:00:00Z");

export type Section = { h: string; body: React.ReactNode };

/** Plain reading page for the policies: title, last-updated date, numbered sections. */
export function LegalPage({ locale, title, sections, children }: { locale: string; title: string; sections: Section[]; children?: React.ReactNode }) {
  const ar = locale === "ar";
  const date = new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", { dateStyle: "long", timeZone: "UTC" }).format(UPDATED);
  return (
    <main className="mx-auto grid max-w-3xl gap-8 px-4 py-12">
      <div className="grid gap-2">
        <h1 className="font-display text-h1 font-semibold">{title}</h1>
        <p className="text-small text-ink-muted">{ar ? `آخر تحديث: ${date}` : `Last updated: ${date}`}</p>
      </div>
      {children}
      {sections.map((s, i) => (
        <section key={s.h} className="grid max-w-[65ch] gap-2">
          <h2 className="font-display text-h3 font-semibold">
            <span className="num text-ink-muted">{i + 1}. </span>
            {s.h}
          </h2>
          <div className="grid gap-2 text-ink-muted [&_a]:text-pen [&_a]:underline [&_li]:ms-5 [&_ul]:list-disc">{s.body}</div>
        </section>
      ))}
    </main>
  );
}

export function Mail() {
  return <a href={`mailto:${CONTACT_EMAIL}`} dir="ltr">{CONTACT_EMAIL}</a>;
}
