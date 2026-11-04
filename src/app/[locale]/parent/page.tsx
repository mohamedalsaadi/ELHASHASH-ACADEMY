import { pageMetadata } from "@/lib/seo";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { ParentNav } from "./ParentNav";
import { courseZone, formatMoney } from "@/lib/format";
import { average } from "@/lib/grades";
import { unlinkParent } from "../account/actions";
import { recordChildConsent } from "./actions";
import { LinkChildForm } from "./LinkChildForm";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const panel = "grid gap-4 rounded-lg border border-hairline bg-surface shadow-paper p-5";
const small = "text-small text-ink-muted";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/parent", "parent", { key: "title", noindex: true });
}

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
  const th = await getTranslations("homework");
  const ar = locale === "ar";
  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * DAY);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const date = new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", { dateStyle: "long", timeZone: "Asia/Dubai" });
  const dateIn = (zone: string) => new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", { dateStyle: "long", timeZone: zone });

  const links = await db.parentLink.findMany({
    where: { parentId: session.user.id },
    include: { student: { select: { id: true, name: true, phone: true, guardianConsent: { select: { consentedAt: true } } } } },
    orderBy: { createdAt: "asc" },
  });

  const children = await Promise.all(
    links.map(async (link) => {
      const [courses, nextExpiry, done, attended, lastOrder, graded, overdue] = await Promise.all([
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
        // Course-level access only: a rented lesson expiring tomorrow is not the plan ending.
        db.entitlement.findFirst({
          where: { userId: link.student.id, endsAt: { gt: now }, lessonId: null, liveSessionId: null },
          orderBy: { endsAt: "asc" },
          select: { endsAt: true, course: { select: { grade: { select: { country: { select: { timeZone: true } } } } } } },
        }),
        db.lessonView.count({ where: { userId: link.student.id, completedAt: { gte: weekStart } } }),
        db.liveAttendance.count({ where: { userId: link.student.id, joinedAt: { gte: monthStart } } }),
        db.order.findFirst({
          where: { OR: [{ userId: link.student.id }, { beneficiaryId: link.student.id }], status: "PAID" },
          orderBy: { paidAt: "desc" },
          select: { total: true, currency: true, paidAt: true },
        }),
        db.submission.findMany({
          where: { studentId: link.student.id, status: "GRADED", score: { not: null } },
          select: { score: true, assignment: { select: { maxScore: true } } },
          take: 200,
        }),
        db.assignment.count({
          where: {
            dueAt: { lt: now },
            course: { entitlements: { some: { userId: link.student.id, OR: [{ endsAt: null }, { endsAt: { gt: now } }] } } },
            submissions: { none: { studentId: link.student.id } },
          },
        }),
      ]);
      return {
        link,
        courses: courses.length,
        nextExpiry: nextExpiry?.endsAt ?? null,
        nextZone: nextExpiry?.course ? courseZone(nextExpiry.course) : "Asia/Dubai",
        done,
        attended,
        lastOrder,
        homeworkAverage: average(graded.filter((s) => s.score !== null).map((s) => ({ value: s.score!, max: s.assignment.maxScore }))),
        overdue,
      };
    }),
  );

  return (
    <main className="mx-auto grid max-w-3xl gap-8 px-4 py-12">
      <ParentNav current="children" />
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
          {children.map(({ link, courses, nextExpiry, nextZone, done, attended, lastOrder, homeworkAverage, overdue }) => (
            <li key={link.id} className={panel}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-h3 font-semibold">{link.student.name}</h2>
                <form action={unlinkParent}>
                  <input type="hidden" name="id" value={link.id} />
                  <ConfirmButton
                    action={unlinkParent}
                    confirmText={t("confirmUnlink")}
                    className="text-small text-down underline-offset-4 hover:underline"
                  >
                    {t("unlink")}
                  </ConfirmButton>
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
                <dd>{nextExpiry ? dateIn(nextZone).format(nextExpiry) : t("noExpiry")}</dd>
                <dt>{th("homeworkAverage")}</dt>
                <dd className="num">{homeworkAverage ? `${homeworkAverage.avg}%` : "—"}</dd>
                <dt>{th("overdue")}</dt>
                <dd className="num">{overdue}</dd>
                <dt>{t("lastPayment")}</dt>
                <dd>{lastOrder?.paidAt ? `${formatMoney(lastOrder.total, lastOrder.currency, locale)} · ${date.format(lastOrder.paidAt)}` : t("noPayment")}</dd>
              </dl>
              {/* Live lectures open an external meeting, so a guardian consents once per child. */}
              {link.student.guardianConsent ? (
                <p className="text-small text-ink-muted">
                  {t("consentDone", { date: date.format(link.student.guardianConsent.consentedAt) })}
                </p>
              ) : (
                <form action={recordChildConsent} className="grid gap-2 rounded-lg border border-hairline bg-raised p-3">
                  <input type="hidden" name="studentId" value={link.student.id} />
                  <p className="text-small text-ink-muted">{t("consentBody", { name: link.student.name })}</p>
                  <button type="submit" className="btn btn-outline justify-self-start">
                    {t("consentCta", { name: link.student.name })}
                  </button>
                </form>
              )}
              <div className="flex flex-wrap gap-4 text-small">
                <Link href={`/parent/children/${link.student.id}`} className="text-pen underline underline-offset-4">
                  {th("viewChild")}
                </Link>
                <Link href="/parent/requests" className="text-pen underline underline-offset-4">
                  {th("requests")}
                </Link>
                {/* Checkout asks which linked child the course is for. */}
                <Link href="/courses" className="text-pen underline underline-offset-4">
                  {t("buyFor", { name: link.student.name })}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
