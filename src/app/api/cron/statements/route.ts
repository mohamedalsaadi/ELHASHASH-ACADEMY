import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notify";
import { summarizeStatements } from "@/lib/statements";

export const dynamic = "force-dynamic";

/**
 * Runs on the first of the month for the previous UTC month. It writes one statement per teacher and
 * currency, never touches an acknowledged statement, and re-runs idempotently.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const period = start.toISOString().slice(0, 7);

  const rows = await db.ledgerEntry.findMany({
    where: { createdAt: { gte: start, lt: end }, instructorId: { not: null } },
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
  const buckets = summarizeStatements(rows, period);
  let created = 0;

  for (const b of buckets) {
    const number = `ST-${period}-${b.instructorId}-${b.currency}`;
    const existing = await db.teacherStatement.findUnique({
      where: { instructorId_period_currency: { instructorId: b.instructorId, period, currency: b.currency } },
      select: { id: true, status: true },
    });
    if (existing) {
      if (existing.status === "OPEN") {
        await db.teacherStatement.update({ where: { id: existing.id }, data: { ...b, number } });
      }
      continue;
    }
    await db.teacherStatement.create({ data: { ...b, number } });
    created += 1;
    await createNotification({
      userId: b.instructorId,
      kind: "SYSTEM",
      titleAr: `كشف ${period} جاهز`,
      titleEn: `Your ${period} statement is ready`,
      bodyAr: "راجع مستحقاتك وأقرّها من صفحة الأرباح.",
      bodyEn: "Review and acknowledge your earnings on the earnings page.",
      href: "/teacher/earnings",
      dedupeKey: `statement:${b.instructorId}:${period}:${b.currency}`,
    });
  }

  return NextResponse.json({ ok: true, period, created, statements: buckets.length });
}
