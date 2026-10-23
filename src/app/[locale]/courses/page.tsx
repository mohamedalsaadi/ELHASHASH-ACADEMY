import { getTranslations, setRequestLocale } from "next-intl/server";
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

  const grades = await db.grade.findMany({
    where: { courses: { some: { published: true } } },
    orderBy: { level: "asc" },
    include: {
      courses: {
        where: { published: true },
        orderBy: { titleEn: "asc" },
        include: {
          skus: { where: onSale(new Date()), orderBy: { price: "asc" }, take: 1 },
          units: { where: { isFree: true }, select: { id: true }, take: 1 },
        },
      },
    },
  });

  return (
    <main className="mx-auto grid max-w-5xl gap-12 px-4 py-12">
      <h1 className="font-display text-h1 font-semibold">{t("title")}</h1>
      {grades.length === 0 && <p className="text-ink-muted">{t("empty")}</p>}
      {grades.map((g) => (
        <section key={g.id} className="grid gap-4">
          <h2 className="font-display text-h2 font-semibold">{ar ? g.nameAr : g.nameEn}</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {g.courses.map((c) => {
              const from = c.skus[0];
              return (
                <li key={c.id}>
                  <Link
                    href={`/courses/${c.slug}`}
                    className="grid h-full gap-3 rounded-md border border-hairline bg-surface p-4 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
                  >
                    <span className="font-display text-h3 font-semibold">{ar ? c.titleAr : c.titleEn}</span>
                    {c.units.length > 0 && <span className="text-small text-up">{t("freeUnit")}</span>}
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
        </section>
      ))}
    </main>
  );
}
