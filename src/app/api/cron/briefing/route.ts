import { cronRoute } from "@/lib/cron-log";
import { NextResponse } from "next/server";
import { sendBriefing } from "@/lib/briefing";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 06:00 Gulf time: the owner morning briefing (in-app and email), once a day. */
async function run() {
  return NextResponse.json({ ok: true, ...(await sendBriefing()) });
}

export const GET = cronRoute("briefing", run);
