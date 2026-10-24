import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { Link } from "@/i18n/navigation";
import { hasAccess, onSale } from "@/lib/catalog";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

function LockIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0 fill-none stroke-current" strokeWidth="1.5">
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

export default async function CoursePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("catalog");
  const ar = locale === "ar";
  const now = new Date();

  const course = await db.course.findUnique({
    where: { slug, published: true },
    include: {
      grade: true,
      instructor: { select: { id: true, name: true } },
      units: { orderBy: { order: "asc" }, include: { lessons: { orderBy: { order: "asc" } } } },
      skus: { where: onSale(now), orderBy: { price: "asc" } },
    },
  });
  if (!course) notFound();

  const session = await auth();
  const owned = await hasAccess(session?.user?.id, course.id, now);
  const firstFree = course.units.find((u) => u.isFree)?.lessons[0];
  const date = new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", { dateStyle: "long", timeZone: "Africa/Cairo" });
  const lessonHref = (id: string) => `/courses/${course.slug}/lessons/${id}`;

  return (
    <main className="mx-auto grid max-w-3xl gap-10 px-4 py-12">
      <section className="grid gap-3">
        <p className="text-small text-ink-muted">{ar ? course.grade.nameAr : course.grade.nameEn}</p>
        <h1 className="font-display text-h1 font-semibold text-balance">{ar ? course.titleAr : course.titleEn}</h1>
        <Link href={`/teachers/${course.instructor.id}`} className="w-fit text-ink-muted hover:text-ink">
          {t("teacher", { name: course.instructor.name })}
        </Link>
        {(ar ? course.descAr : course.descEn) && <p className="max-w-[65ch] text-ink-muted">{ar ? course.descAr : course.descEn}</p>}
        {owned ? (
          <p className="w-fit rounded-full border border-up px-3 py-1 text-label text-up">{t("owned")}</p>
        ) : (
          firstFree && (
            <Link
              href={lessonHref(firstFree.id)}
              className="w-fit rounded-sm bg-amber-fill px-[18px] py-3 font-display font-semibold text-on-amber transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-[color-mix(in_oklab,var(--color-amber-fill)_86%,#fff)]"
            >
              {t("startFree")}
            </Link>
          )
        )}
      </section>

      <section className="grid gap-4">
        <h2 className="font-display text-h2 font-semibold">{t("units")}</h2>
        {course.units.map((u) => {
          const open = owned || u.isFree;
          return (
            <div key={u.id} className="grid gap-2 rounded-md border border-hairline bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-h3 font-semibold">{ar ? u.titleAr : u.titleEn}</h3>
                {u.isFree && !owned && <span className="rounded-full border border-up px-3 py-1 text-label text-up">{t("free")}</span>}
              </div>
              <ul className="grid">
                {u.lessons.map((l) => {
                  const label = (
                    <>
                      <span>{ar ? l.titleAr : l.titleEn}</span>
                      <span className="text-label text-ink-muted">{t(`kind.${l.kind}`)}</span>
                    </>
                  );
                  return (
                    <li key={l.id} className="border-t border-hairline first:border-t-0">
                      {open ? (
                        <Link
                          href={lessonHref(l.id)}
                          className="flex items-center justify-between gap-3 rounded-sm px-2 py-3 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
                        >
                          {label}
                        </Link>
                      ) : (
                        <div className="flex items-center justify-between gap-3 px-2 py-3 text-ink-muted">
                          <span className="flex items-center gap-2">
                            <LockIcon />
                            <span>{ar ? l.titleAr : l.titleEn}</span>
                          </span>
                          <span className="text-label">{t(`kind.${l.kind}`)}</span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      {!owned && course.skus.length > 0 && (
        <section id="packages" className="grid gap-4">
          <h2 className="font-display text-h2 font-semibold">{t("packages")}</h2>
          <ul className="grid gap-3">
            {course.skus.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-hairline bg-surface p-4">
                <div className="grid gap-1">
                  <span className="font-display font-semibold">{t(`access.${s.accessType}`)}</span>
                  {s.accessEndsAt && (
                    <span className="text-small text-ink-muted">{t("until", { date: date.format(s.accessEndsAt) })}</span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="num text-h3 font-semibold">{formatMoney(s.price, s.currency, locale)}</span>
                  <Link
                    href={{ pathname: "/checkout", query: { sku: s.id } }}
                    className="rounded-sm border border-ink-muted px-4 py-2 font-display font-semibold transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
                  >
                    {t("subscribe")}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
