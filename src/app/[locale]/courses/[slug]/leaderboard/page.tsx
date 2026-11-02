import { pageMetadata } from "@/lib/seo";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/courses", "practice", { key: "leaderboard", noindex: true });
}

/** A course's own weekly ranking. Opt-in per course, and never visible outside its enrolled students. */
export default async function LeaderboardPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/signin?next=${encodeURIComponent(`/${locale}/courses/${slug}/leaderboard`)}`);

  const t = await getTranslations("practice");
  const ar = locale === "ar";
  const now = new Date();

  const course = await db.course.findUnique({
    where: { slug, published: true },
    select: { id: true, titleAr: true, titleEn: true, leaderboard: true },
  });
  if (!course) notFound();

  const enrolled = await db.entitlement.findFirst({
    where: { userId: session.user.id, courseId: course.id, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    select: { id: true },
  });
  if (!enrolled) notFound();

  const weekStart = new Date(now.getTime() - 7 * 86_400_000);
  const rows = course.leaderboard
    ? await db.practiceAttempt.groupBy({
        by: ["userId"],
        where: { lesson: { unit: { courseId: course.id } }, createdAt: { gte: weekStart } },
        _sum: { xp: true },
      })
    : [];

  const users = rows.length > 0 ? await db.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true } }) : [];
  const names = new Map(users.map((u) => [u.id, u.name]));
  const board = rows
    .map((r) => ({ id: r.userId, name: names.get(r.userId) ?? "—", xp: r._sum.xp ?? 0 }))
    .filter((r) => r.xp > 0)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 20);

  return (
    <main className="mx-auto grid max-w-2xl gap-6 px-4 py-12">
      <PageHeader
        back={{ href: `/courses/${slug}`, label: ar ? course.titleAr : course.titleEn }}
        title={t("leaderboard")}
        meta={t("weekXp")}
      />

      {!course.leaderboard ? (
        <p className="text-small text-ink-muted">{t("leaderboardOff")}</p>
      ) : board.length === 0 ? (
        <p className="text-small text-ink-muted">{t("noEntries")}</p>
      ) : (
        <ol className="grid gap-1">
          {board.map((row, i) => (
            <li
              key={row.id}
              className={`flex min-h-11 items-center justify-between gap-3 rounded-full border bg-surface px-4 py-2 text-small ${
                row.id === session.user.id ? "border-pen" : "border-hairline"
              }`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="num w-6 text-ink-muted">{i + 1}</span>
                <span className="truncate">{row.name}</span>
                {/* The summit point: the week's first place, earned. */}
                {i === 0 && row.xp > 0 && <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-summit" />}
              </span>
              <span className="num font-semibold">{row.xp}</span>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
