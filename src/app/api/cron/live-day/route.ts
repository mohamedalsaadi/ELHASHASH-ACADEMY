import { NextResponse } from "next/server";
import { remindLiveToday } from "@/lib/live-alerts";

export const dynamic = "force-dynamic";

/** Every morning: a same-day reminder (in-app and email) for each live session starting in the next 24 hours. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ...(await remindLiveToday()) });
}
