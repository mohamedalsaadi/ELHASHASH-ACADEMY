import { pick } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/brand/Mark";
import { db } from "@/lib/db";
import { groupEarnings, monthKey } from "@/lib/earnings";
import { formatMoney } from "@/lib/format";
import type { Currency } from "@/lib/pricing-engine";
import { requireStaff } from "@/lib/staff";
import { TeacherNav } from "../TeacherNav";
import { acknowledgeReceipt, acknowledgeStatement } from "./actions";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/teacher/earnings", "teacher", { key: "navEarnings", noindex: true });
}

const th = "py-2 text-start text-label font-medium text-ink-muted";
const td = "border-t border-hairline py-3";

/** The teacher's share of every sale, by month and by course, read from the immutable ledger. */
export default async function EarningsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireStaff();
  const t = await getTranslations("teacher");
  const ar = locale === "ar";

  const rows = await db.ledgerEntry.findMany({
    where: { instructorId: me.id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, currency: true, courseId: true, gross: true, instructorNet: true },
  });
  // The ledger keeps no foreign key to courses (rows outlive them), so titles are looked up beside it.
  const courses = await db.course.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.courseId))] } }, select: { id: true, titleAr: true, titleEn: true } });
  const titles = new Map(courses.map((c) => [c.id, pick(ar, c.titleAr, c.titleEn)]));
  const byMonth = groupEarnings(rows, (r) => monthKey(r.createdAt));
  const byCourse = groupEarnings(rows, (r) => r.courseId).sort((a, b) => b.net - a.net);
  const monthName = new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const day = new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", { dateStyle: "medium", timeZone: "UTC" });
  const money = (n: number, c: Currency) => formatMoney(n, c, locale);

  const [receiptRows, statements] = await Promise.all([
    db.ledgerEntry.findMany({
      where: { instructorId: me.id, kind: "SALE" },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        orderId: true,
        createdAt: true,
        instructorPayout: true,
        currency: true,
        order: {
          select: {
            documents: {
              where: { kind: "INVOICE" },
              select: { id: true, number: true, acks: { where: { teacherId: me.id }, select: { acknowledgedAt: true } } },
            },
          },
        },
      },
    }),
    db.teacherStatement.findMany({
      where: { instructorId: me.id },
      orderBy: [{ period: "desc" }, { currency: "asc" }],
    }),
  ]);

  // One row per order even when the teacher has several lines in it.
  const receiptMap = new Map<string, { documentId: string; number: string; createdAt: Date; payout: number; currency: Currency; acknowledged: boolean }>();
  for (const r of receiptRows) {
    const doc = r.order.documents[0];
    if (!doc) continue;
    const existing = receiptMap.get(r.orderId);
    if (existing) existing.payout += r.instructorPayout;
    else
      receiptMap.set(r.orderId, {
        documentId: doc.id,
        number: doc.number,
        createdAt: r.createdAt,
        payout: r.instructorPayout,
        currency: r.currency,
        acknowledged: doc.acks.length > 0,
      });
  }
  const receiptList = [...receiptMap.values()].slice(0, 20);

  // Statements and what was paid stay visible even when there are no ledger rows to chart.
  const statementsSection = (
      <section className="card grid gap-3 p-6">
        <h2 className="font-display text-h2 font-semibold">{t("statementsTitle")}</h2>
        {statements.length === 0 ? (
          <p className="text-small text-ink-muted">{t("noStatements")}</p>
        ) : (
          <ul className="grid gap-2">
            {statements.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-2 text-small">
                <span className="grid gap-0.5">
                  <span className="font-semibold">{s.period} · {s.currency}</span>
                  <a href={`/api/documents/statement/${s.id}/pdf`} className="text-pen underline underline-offset-4">
                    PDF
                  </a>
                  <span className="text-ink-muted">{t("salesRefunds", { sales: s.salesCount, refunds: s.refundCount })}</span>
                  {s.coversTo && (
                    <span className="text-label text-ink-muted">{t("covers", { from: day.format(s.coversFrom ?? new Date(0)), to: day.format(new Date(s.coversTo.getTime() - 1)) })}</span>
                  )}
                  <span className="text-label">
                    {s.paidAt
                      ? t("paidOn", { date: day.format(s.paidAt), ref: s.paidReference ?? "" })
                      : s.status === "ACKNOWLEDGED"
                        ? t("dueOn", { date: s.payableAt ? day.format(s.payableAt) : "" })
                        : t("payWaitsAck")}
                  </span>
                </span>
                <span className="num font-semibold">{money(s.instructorPayout, s.currency)}</span>
                {s.status === "ACKNOWLEDGED" ? (
                  <span className="text-up">{t("acknowledged")}</span>
                ) : (
                  <form action={acknowledgeStatement}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="text-pen underline underline-offset-4">{t("acknowledge")}</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
  );

  return (
    <main className="mx-auto grid max-w-4xl gap-10 px-4 py-12">
      <div className="grid gap-4">
        <h1 className="font-display text-h1 font-semibold">{t("navEarnings")}</h1>
        <TeacherNav current="earnings" />
      </div>
      <p className="max-w-[60ch] text-ink-muted">{t("earningsLede")}</p>

      {rows.length === 0 ? (
        <>
          <EmptyState>
            <p className="text-ink-muted">{t("noSales")}</p>
          </EmptyState>
          {statements.length > 0 && statementsSection}
        </>
      ) : (
        <>
          <section className="card grid gap-3 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-h2 font-semibold">{t("byMonth")}</h2>
              <a href={`/${locale}/teacher/earnings/export`} className="btn btn-outline text-small">
                {t("exportCsv")}
              </a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-small">
                <thead>
                  <tr>
                    <th className={th}>{t("month")}</th>
                    <th className={th}>{t("sales")}</th>
                    <th className={th}>{t("gross")}</th>
                    <th className={th}>{t("yourShare")}</th>
                  </tr>
                </thead>
                <tbody>
                  {byMonth.map((g) => (
                    <tr key={`${g.key}${g.currency}`}>
                      <td className={td}>{monthName.format(new Date(`${g.key}-01T00:00:00Z`))}</td>
                      <td className={`${td} num`}>{g.sales}</td>
                      <td className={`${td} num`}>{money(g.gross, g.currency)}</td>
                      <td className={`${td} num font-semibold`}>{money(g.net, g.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card grid gap-3 p-6">
            <h2 className="font-display text-h2 font-semibold">{t("byCourse")}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-small">
                <thead>
                  <tr>
                    <th className={th}>{t("coursesTaught")}</th>
                    <th className={th}>{t("sales")}</th>
                    <th className={th}>{t("yourShare")}</th>
                  </tr>
                </thead>
                <tbody>
                  {byCourse.map((g) => (
                    <tr key={`${g.key}${g.currency}`}>
                      <td className={td}>{titles.get(g.key)}</td>
                      <td className={`${td} num`}>{g.sales}</td>
                      <td className={`${td} num font-semibold`}>{money(g.net, g.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card grid gap-3 p-6">
            <h2 className="font-display text-h2 font-semibold">{t("receiptsTitle")}</h2>
            {receiptList.length === 0 ? (
              <p className="text-small text-ink-muted">{t("noReceipts")}</p>
            ) : (
              <ul className="grid gap-2">
                {receiptList.map((r) => (
                  <li key={r.documentId} className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-2 text-small">
                    <span className="grid gap-0.5">
                      <span className="num font-semibold" dir="ltr">{r.number}</span>
                      <span className="text-ink-muted">{day.format(r.createdAt)}</span>
                    </span>
                    <span className="num">{money(r.payout, r.currency)}</span>
                    {r.acknowledged ? (
                      <span className="text-up">{t("acknowledged")}</span>
                    ) : (
                      <form action={acknowledgeReceipt}>
                        <input type="hidden" name="id" value={r.documentId} />
                        <button className="text-pen underline underline-offset-4">{t("acknowledge")}</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {statementsSection}
        </>
      )}
    </main>
  );
}
