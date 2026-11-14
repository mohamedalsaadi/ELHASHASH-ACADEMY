import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notify";
import { payableOn, statementCutoff, statementStart, summarizeStatements } from "@/lib/statements";

export const dynamic = "force-dynamic";

/**
 * Runs on the first of the month. One statement per teacher and currency, labelled with the previous month, covering the
 * ledger from where the teacher's last statement ended up to 14 days before today (the refund hold: a sale younger than that
 * waits for the next statement). It never touches an acknowledged statement and re-runs idempotently.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const period = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  const to = statementCutoff(now);
  const payableAt = payableOn(now);

  // ponytail: reads every ledger row before the cutoff and filters per teacher; add a lower bound if the ledger passes ~100k rows.
  const rows = await db.ledgerEntry.findMany({
    where: { createdAt: { lt: to }, instructorId: { not: null } },
    select: {
      createdAt: true,
      currency: true,
      instructorId: true,
      gross: true,
      vat: true,
      net: true,
      platformFee: true,
      platformDiscount: true,
      corporateTax: true,
      instructorNet: true,
      instructorPayout: true,
    },
  });
  // Where each teacher's window starts: the end of their latest earlier statement in that currency.
  const earlier = await db.teacherStatement.findMany({ where: { period: { lt: period } }, orderBy: { period: "desc" }, select: { instructorId: true, currency: true, period: true, coversTo: true } });
  const last = new Map<string, (typeof earlier)[number]>();
  for (const s of earlier) if (!last.has(`${s.instructorId}|${s.currency}`)) last.set(`${s.instructorId}|${s.currency}`, s);
  const startOf = (instructorId: string, currency: string) => statementStart(last.get(`${instructorId}|${currency}`) ?? null);

  const inWindow = rows.filter((r) => r.instructorId && r.createdAt >= startOf(r.instructorId, r.currency));
  const buckets = summarizeStatements(inWindow, period);
  let created = 0;

  for (const b of buckets) {
    const number = `ST-${period}-${b.instructorId}-${b.currency}`;
    const window = { coversFrom: startOf(b.instructorId, b.currency), coversTo: to, payableAt };
    const existing = await db.teacherStatement.findUnique({
      where: { instructorId_period_currency: { instructorId: b.instructorId, period, currency: b.currency } },
      select: { id: true, status: true },
    });
    if (existing) {
      if (existing.status === "OPEN") {
        await db.teacherStatement.update({ where: { id: existing.id }, data: { ...b, ...window, number } });
      }
      continue;
    }
    await db.teacherStatement.create({ data: { ...b, ...window, number } });
    created += 1;
    await createNotification({
      userId: b.instructorId,
      kind: "SYSTEM",
      titleAr: `كشف ${period} جاهز`,
      titleEn: `Your ${period} statement is ready`,
      bodyAr: "راجع مستحقاتك وأقرّها من صفحة الأرباح. يُدفع عادةً في العاشر من هذا الشهر بعد إقرارك.",
      bodyEn: "Review and acknowledge your earnings on the earnings page. It is normally paid on the 10th of this month, once you acknowledge it.",
      href: "/teacher/earnings",
      dedupeKey: `statement:${b.instructorId}:${period}:${b.currency}`,
    });
  }

  return NextResponse.json({ ok: true, period, created, statements: buckets.length });
}
