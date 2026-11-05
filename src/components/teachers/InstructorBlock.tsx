import { useTranslations } from "next-intl";
import { InstructorCard, type InstructorSummary } from "./InstructorCard";

export type InstructorEntry = {
  instructor: InstructorSummary;
  lessons: number;
  courseSlug: string;
};

/**
 * The comparison layer: one card per teacher who published a course for this subject.
 * Renders for a single teacher too, so the layout never changes shape and a lone teacher still gets
 * advertised. Nothing here compares teachers on their students.
 */
export function InstructorBlock({ entries, locale }: { entries: InstructorEntry[]; locale: string }) {
  const t = useTranslations("catalog");
  if (entries.length === 0) return null;

  return (
    <section className="grid gap-4" aria-labelledby="instructors">
      <div className="grid gap-1">
        <h2 id="instructors" className="font-display text-h2 font-bold">
          {t("instructorsTitle")}
        </h2>
        <p className="text-small text-ink-muted">{t("instructorsLede", { count: entries.length })}</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((e) => (
          <li key={e.instructor.id}>
            <InstructorCard instructor={e.instructor} lessons={e.lessons} courseSlug={e.courseSlug} locale={locale} />
          </li>
        ))}
      </ul>
    </section>
  );
}
