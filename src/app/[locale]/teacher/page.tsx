import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/brand/Mark";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { requireStaff } from "@/lib/staff";
import { TeacherNav } from "./TeacherNav";

export const dynamic = "force-dynamic";

const card = "rounded-md border border-hairline bg-surface p-4";
const DAY = 24 * 60 * 60 * 1000;

export default async function TeacherPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireStaff();
  const t = await getTranslations("teacher");
  const tc = await getTranslations("catalog");
  const ar = locale === "ar";
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const courses = await db.course.findMany({ where: { instructorId: me.id }, orderBy: { slug: "asc" }, include: { grade: true } });
  const courseIds = courses.map((c) => c.id);

  const [subs, sold] = await Promise.all([
    db.entitlement.findMany({
      where: { courseId: { in: courseIds }, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      orderBy: { startsAt: "desc" },
      include: {
        user: { select: { id: true, name: true, phone: true, email: true } },
        course: { select: { titleAr: true, titleEn: true } },
        lesson: { select: { titleAr: true, titleEn: true } },
        order: { select: { items: { select: { sku: { select: { courseId: true, lessonId: true, accessType: true, accessDays: true } } } } } },
      },
    }),
    db.orderItem.findMany({
      where: { sku: { courseId: { in: courseIds } }, order: { status: "PAID", paidAt: { gte: monthStart } } },
      select: { price: true, order: { select: { subtotal: true, total: true, currency: true } } },
    }),
  ]);

  // ponytail: a bundle discount is shared across its lines by price; per-teacher payout rules go here if they ever differ.
  const earnings = new Map<"AED" | "EGP", number>();
  for (const { price, order } of sold) {
    const share = order.subtotal ? Math.round((price * order.total) / order.subtotal) : 0;
    earnings.set(order.currency, (earnings.get(order.currency) ?? 0) + share);
  }
  const students = new Set(subs.map((s) => s.user.id)).size;
  const newThisWeek = new Set(subs.filter((s) => now.getTime() - s.startsAt.getTime() < 7 * DAY).map((s) => s.user.id)).size;
  const perCourse = (id: string) => new Set(subs.filter((s) => s.courseId === id).map((s) => s.user.id)).size;
  const date = new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Dubai" });
  const money = [...earnings].map(([cur, n]) => formatMoney(n, cur, locale)).join(" · ") || formatMoney(0, "AED", locale);

  return (
    <main className="mx-auto grid max-w-4xl gap-10 px-4 py-12">
      <div className="grid gap-4">
        <h1 className="font-display text-h1 font-semibold">{t("hello", { name: me.name ?? "" })}</h1>
        <TeacherNav current="home" id={me.id} />
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          [t("statStudents"), String(students)],
          [t("statNew"), String(newThisWeek)],
          [t("statEarnings"), money],
        ].map(([k, v]) => (
          <div key={k} className={`${card} grid gap-1`}>
            <span className="text-label text-ink-muted">{k}</span>
            <span className="num font-display text-h2 font-semibold">{v}</span>
          </div>
        ))}
      </section>

      <section className="grid gap-3">
        <h2 className="font-display text-h2 font-semibold">{t("myCourses")}</h2>
        {courses.length === 0 ? (
          <EmptyState>
            <p className="text-ink-muted">{t("noCourses")}</p>
          </EmptyState>
        ) : (
          <ul className="grid gap-2">
            {courses.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/courses/${c.id}`}
                  className={`${card} flex flex-wrap items-center justify-between gap-3 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised`}
                >
                  <span className="grid gap-1">
                    <span className="font-display font-semibold">{ar ? c.titleAr : c.titleEn}</span>
                    <span className="text-small text-ink-muted">{c.grade ? (ar ? c.grade.nameAr : c.grade.nameEn) : tc("skill")}</span>
                  </span>
                  <span className="flex items-center gap-4 text-label">
                    <span className="num text-ink-muted">{t("courseStudents", { count: perCourse(c.id) })}</span>
                    <span className={c.published ? "text-up" : "text-ink-muted"}>{c.published ? t("published") : t("hidden")}</span>
                    <span className="text-pen">{t("edit")}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="font-display text-h2 font-semibold">{t("myStudents")}</h2>
        {subs.length === 0 ? (
          <EmptyState>
            <p className="text-ink-muted">{t("noStudents")}</p>
          </EmptyState>
        ) : (
          <ul className="grid gap-2">
            {subs.map((s) => {
              const sku = s.order?.items.find((i) => i.sku.courseId === s.courseId && i.sku.lessonId === s.lessonId)?.sku;
              return (
                <li key={s.id} className={`${card} flex flex-wrap items-center justify-between gap-x-6 gap-y-2`}>
                  <span className="grid gap-1">
                    <span className="font-display font-semibold">{s.user.name}</span>
                    <span className="num text-small text-ink-muted" dir="ltr">
                      {s.user.phone ?? s.user.email}
                    </span>
                  </span>
                  <span className="grid gap-1 text-small sm:text-end">
                    <span>
                      {ar ? s.course.titleAr : s.course.titleEn}
                      {s.lesson && ` · ${ar ? s.lesson.titleAr : s.lesson.titleEn}`}
                      {sku && ` · ${tc(`access.${sku.accessType}`, { days: sku.accessDays ?? 0 })}`}
                    </span>
                    <span className="text-ink-muted">
                      {s.endsAt ? t("until", { date: date.format(s.endsAt) }) : t("forever")}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
