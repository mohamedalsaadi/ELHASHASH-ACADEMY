import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/staff";
import { PageHeader } from "@/components/ui/PageHeader";
import { TeacherNav } from "../TeacherNav";
import { toggleLeaderboard } from "./actions";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/teacher/bank", "practice", { key: "bank", noindex: true });
}

export default async function BankPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireStaff();
  const t = await getTranslations("practice");
  const ar = locale === "ar";

  const courses = await db.course.findMany({
    where: me.role === "ADMIN" ? {} : { instructorId: me.id },
    orderBy: { slug: "asc" },
    select: {
      id: true,
      slug: true,
      titleAr: true,
      titleEn: true,
      leaderboard: true,
      units: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          titleAr: true,
          titleEn: true,
          lessons: {
            orderBy: { order: "asc" },
            select: { id: true, titleAr: true, titleEn: true, _count: { select: { questionItems: true } } },
          },
        },
      },
    },
  });

  return (
    <main className="mx-auto grid max-w-4xl gap-6 px-4 py-12">
      <PageHeader title={t("bank")} />
      <TeacherNav current="bank" />

      {courses.length === 0 ? (
        <p className="text-small text-ink-muted">{t("empty")}</p>
      ) : (
        courses.map((c) => (
          <section key={c.id} className="grid gap-3 rounded-md border border-hairline bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-h3 font-semibold">{ar ? c.titleAr : c.titleEn}</h2>
              <form action={toggleLeaderboard} className="flex items-center gap-2 text-label text-ink-muted">
                <input type="hidden" name="courseId" value={c.id} />
                <input type="checkbox" name="on" defaultChecked={c.leaderboard} className="size-4" />
                <button className="underline underline-offset-4">{t("toggleLeaderboard")}</button>
              </form>
            </div>
            <ul className="grid gap-1 text-small">
              {c.units.flatMap((u) =>
                u.lessons.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/teacher/bank/${l.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-sm px-2 py-1.5 hover:bg-raised"
                    >
                      <span className="min-w-0 truncate">
                        <span className="text-label text-ink-muted">{ar ? u.titleAr : u.titleEn} · </span>
                        <span dir="auto">{ar ? l.titleAr : l.titleEn}</span>
                      </span>
                      <span className="num text-label text-ink-muted">{l._count.questionItems}</span>
                    </Link>
                  </li>
                )),
              )}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
