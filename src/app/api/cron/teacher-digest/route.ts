import { NextResponse } from "next/server";
import { sendTeacherDigests } from "@/lib/teacher-digest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 07:30 Gulf time: one email to each teacher who has something waiting. Nothing is sent to a teacher with an empty queue. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ...(await sendTeacherDigests()) });
}
