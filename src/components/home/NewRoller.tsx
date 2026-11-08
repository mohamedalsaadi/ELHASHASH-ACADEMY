import { CourseCard, type CardCourse } from "@/components/CourseCard";

/**
 * A looping strip of new courses for the student's grade. Pure CSS (see `.roller` in brand.css): native scroll, pauses on
 * hover or focus, and holds still as a scrollable row for reduced motion. The second copy is hidden from assistive tech.
 */
export function NewRoller({ courses, locale, label, badge }: { courses: CardCourse[]; locale: string; label: string; badge: string }) {
  if (courses.length === 0) return null;
  // Each half of the loop must be wider than the screen, or the strip shows a gap: repeat a short list until it has 6 cards.
  const half = Array.from({ length: Math.ceil(6 / courses.length) }, () => courses).flat();
  return (
    <section aria-label={label} className="grid gap-4">
      <h2 className="font-display text-h1 font-bold">{label}</h2>
      <div className="roller" tabIndex={0} role="region" aria-label={label}>
        <ul className="roller-track">
          {[...half, ...half].map((c, i) => (
            <li key={`${c.id}-${i}`} className="roller-item" aria-hidden={i >= courses.length || undefined}>
              <span className="mb-2 inline-block rounded-full bg-marker px-2.5 py-0.5 text-label font-bold text-on-summit">{badge}</span>
              <CourseCard course={c} locale={locale} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
