import { cronRoute } from "@/lib/cron-log";
import { NextResponse } from "next/server";
import { purgeOldAnalytics } from "@/lib/analytics";
import { db } from "@/lib/db";
import { KEEP_DAYS } from "@/lib/site-log";
import { purgeClosedTickets } from "@/lib/support";

export const dynamic = "force-dynamic";

/**
 * The retention job the privacy policy promises: behavioural events after 180 days, support
 * tickets 90 days after they close, and the site log after 30 days (the log trims itself on write, which an idle site never does).
 * Vercel runs it daily; it is idempotent, so a retry is safe.
 */
async function run() {
  const [analytics, tickets, siteLog] = await Promise.all([
    purgeOldAnalytics(),
    purgeClosedTickets(),
    db.siteLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_DAYS * 86_400_000) } } }).then((r) => r.count),
  ]);
  return NextResponse.json({ ok: true, analytics, tickets, siteLog });
}

export const GET = cronRoute("retention", run);
