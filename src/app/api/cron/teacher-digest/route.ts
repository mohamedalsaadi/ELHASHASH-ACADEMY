import { cronRoute } from "@/lib/cron-log";
import { NextResponse } from "next/server";
import { sendTeacherDigests } from "@/lib/teacher-digest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 07:30 Gulf time: one email to each teacher who has something waiting. Nothing is sent to a teacher with an empty queue. */
async function run() {
  return NextResponse.json({ ok: true, ...(await sendTeacherDigests()) });
}

export const GET = cronRoute("teacher-digest", run);
