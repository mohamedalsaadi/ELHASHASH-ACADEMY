import { NextResponse } from "next/server";
import { purgeOldAnalytics } from "@/lib/analytics";
import { purgeClosedTickets } from "@/lib/support";

export const dynamic = "force-dynamic";

/**
 * The retention job the privacy policy promises: behavioural events after 180 days, support
 * tickets 90 days after they close. Vercel runs it daily; it is idempotent, so a retry is safe.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const [analytics, tickets] = await Promise.all([purgeOldAnalytics(), purgeClosedTickets()]);
  return NextResponse.json({ ok: true, analytics, tickets });
}
