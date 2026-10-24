import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/brand/Mark";
import { Link } from "@/i18n/navigation";
import { onSale } from "@/lib/catalog";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CoursesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("catalog");
  const ar = locale === "ar";

  const cardInclude = {
    skus: { where: onSale(new Date()), orderBy: { price: "asc" as const }, take: 1 },
    units: { where: { isFree: true }, select: { id: true }, take: 1 },
  };
  const [grades, skills] = await Promise.all([
    db.grade.findMany({
      where: { courses: { some: { published: true } } },
      orderBy: { level: "asc" },
      include: { courses: { where: { published: true }, orderBy: { titleEn: "asc" }, include: cardInclude } },
    }),
    db.course.findMany({ where: { kind: "SKILL", published: true }, orderBy: { titleEn: "asc" }, include: cardInclude }),
  ]);
  type Card = (typeof skills)[number];

  const cards = (courses: Card[]) => (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((c) => {
        const from = c.skus[0];
        return (
          <li key={c.id}>
            <Link
              href={`/courses/${c.slug}`}
              className="grid h-full content-start gap-3 rounded-md border border-hairline bg-surface p-4 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
            >
              <span className="font-display text-h3 font-semibold">{ar ? c.titleAr : c.titleEn}</span>
              <span className="h-px bg-hairline" aria-hidden="true" />
              {c.units.length > 0 && <span className="text-small text-up">{t("freeUnit")}</span>}
              {from?.accessDays && <span className="text-small text-ink-muted">{t("access.FIXED_DAYS", { days: from.accessDays })}</span>}
              {from && (
                <span className="text-small text-ink-muted">
                  {t("from")} <span className="num text-ink">{formatMoney(from.price, from.currency, locale)}</span>
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
  const tab = "rounded-sm border border-hairline px-4 py-2 font-display font-semibold transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised";

  return (
    <main className="mx-auto grid max-w-5xl gap-12 px-4 py-12">
      <h1 className="font-display text-h1 font-semibold">{t("title")}</h1>
      {grades.length + skills.length === 0 ? (
        <EmptyState>
          <p className="text-ink-muted">{t("empty")}</p>
        </EmptyState>
      ) : (
        <nav className="flex flex-wrap gap-3">
          <a href="#school" className={tab}>
            {t("schoolTab")}
          </a>
          <a href="#skills" className={tab}>
            {t("skillTab")}
          </a>
        </nav>
      )}
      {grades.length > 0 && (
        <div id="school" className="grid scroll-mt-24 gap-10">
          <h2 className="font-display text-h2 font-semibold">{t("schoolTab")}</h2>
          {grades.map((g) => (
            <section key={g.id} className="grid gap-4">
              <h3 className="font-display text-h3 font-semibold text-ink-muted">{ar ? g.nameAr : g.nameEn}</h3>
              {cards(g.courses)}
            </section>
          ))}
        </div>
      )}
      {grades.length + skills.length > 0 && (
        <section id="skills" className="grid scroll-mt-24 gap-4">
          <h2 className="font-display text-h2 font-semibold">{t("skillTab")}</h2>
          {skills.length ? cards(skills) : <p className="text-ink-muted">{t("skillEmpty")}</p>}
        </section>
      )}
    </main>
  );
}
