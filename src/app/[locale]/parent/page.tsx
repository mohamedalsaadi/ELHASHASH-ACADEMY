import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { unlinkParent } from "../account/actions";
import { LinkChildForm } from "./LinkChildForm";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const panel = "grid gap-4 rounded-md border border-hairline bg-surface p-5";
const small = "text-small text-ink-muted";

export default async function ParentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/signin?next=${encodeURIComponent(`/${locale}/parent`)}`);
  if (session.user.role !== "PARENT") {
    if (session.user.role === "INSTRUCTOR") redirect(`/${locale}/teacher`);
    if (session.user.role === "ADMIN") redirect(`/${locale}/admin`);
    redirect(`/${locale}/dashboard`);
  }

  const t = await getTranslations("parent");
  const ar = locale === "ar";
  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * DAY);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const date = new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", { dateStyle: "long", timeZone: "Asia/Dubai" });

  const links = await db.parentLink.findMany({
    where: { parentId: session.user.id },
    include: { student: { select: { id: true, name: true, phone: true } } },
    orderBy: { createdAt: "asc" },
  });

  const children = await Promise.all(
    links.map(async (link) => {
      const [courses, nextExpiry, done, attended, lastOrder] = await Promise.all([
        db.entitlement.findMany({
          where: {
            userId: link.student.id,
            startsAt: { lte: now },
            OR: [{ endsAt: null }, { endsAt: { gt: now } }],
            lessonId: null,
            liveSessionId: null,
          },
          select: { courseId: true },
          distinct: ["courseId"],
        }),
        db.entitlement.findFirst({
          where: { userId: link.student.id, endsAt: { gt: now } },
          orderBy: { endsAt: "asc" },
          select: { endsAt: true },
        }),
        db.lessonView.count({ where: { userId: link.student.id, completedAt: { gte: weekStart } } }),
        db.liveAttendance.count({ where: { userId: link.student.id, joinedAt: { gte: monthStart } } }),
        db.order.findFirst({
          where: { userId: link.student.id, status: "PAID" },
          orderBy: { paidAt: "desc" },
          select: { total: true, currency: true, paidAt: true },
        }),
      ]);
      return { link, courses: courses.length, nextExpiry: nextExpiry?.endsAt ?? null, done, attended, lastOrder };
    }),
  );

  return (
    <main className="mx-auto grid max-w-3xl gap-8 px-4 py-12">
      <div className="grid gap-2">
        <h1 className="font-display text-h1 font-semibold">{t("title")}</h1>
        <p className={small}>{t("lede")}</p>
      </div>

      <section className={panel}>
        <h2 className="font-display text-h3 font-semibold">{t("linkTitle")}</h2>
        <p className={small}>{t("linkHint")}</p>
        <LinkChildForm />
      </section>

      {children.length === 0 ? (
        <p className={small}>{t("noChildren")}</p>
      ) : (
        <ul className="grid gap-4">
          {children.map(({ link, courses, nextExpiry, done, attended, lastOrder }) => (
            <li key={link.id} className={panel}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-h3 font-semibold">{link.student.name}</h2>
                <form action={unlinkParent}>
                  <input type="hidden" name="id" value={link.id} />
                  <button className="text-small text-down underline-offset-4 hover:underline">{t("unlink")}</button>
                </form>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-small [&_dt]:text-label [&_dt]:text-ink-muted">
                <dt>{t("courses")}</dt>
                <dd className="num">{courses}</dd>
                <dt>{t("completedWeek")}</dt>
                <dd className="num">{done}</dd>
                <dt>{t("attendedMonth")}</dt>
                <dd className="num">{attended}</dd>
                <dt>{t("nextExpiry")}</dt>
                <dd>{nextExpiry ? date.format(nextExpiry) : t("noExpiry")}</dd>
                <dt>{t("lastPayment")}</dt>
                <dd>{lastOrder?.paidAt ? `${formatMoney(lastOrder.total, lastOrder.currency, locale)} · ${date.format(lastOrder.paidAt)}` : t("noPayment")}</dd>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
