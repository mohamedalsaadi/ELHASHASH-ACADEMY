import { cronRoute } from "@/lib/cron-log";
import { NextResponse } from "next/server";
import { remindLiveToday } from "@/lib/live-alerts";

export const dynamic = "force-dynamic";

/** Every morning: a same-day reminder (in-app and email) for each live session starting in the next 24 hours. */
async function run() {
  return NextResponse.json({ ok: true, ...(await remindLiveToday()) });
}

export const GET = cronRoute("live-day", run);
