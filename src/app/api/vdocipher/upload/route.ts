import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/site-log";
import { createUpload } from "@/lib/vdocipher";

export const dynamic = "force-dynamic";

/** Teachers and the owner ask for an upload slot; the secret key stays here. */
export async function POST(req: Request) {
  const session = await auth();
  const me = session?.user ? await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } }) : null;
  if (!me || (me.role !== "ADMIN" && me.role !== "INSTRUCTOR")) {
    await logEvent({ level: "WARN", source: "vdocipher.slot", message: "Upload slot refused: not signed in as staff", userId: session?.user?.id ?? null });
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { title } = (await req.json().catch(() => ({}))) as { title?: string };
  try {
    const ticket = await createUpload(title?.trim() || "Dhirwa lesson");
    await logEvent({ source: "vdocipher.slot", message: "Upload slot opened", userId: session?.user?.id, meta: { videoId: ticket.videoId } });
    return NextResponse.json(ticket);
  } catch (e) {
    console.error(e);
    await logEvent({ level: "ERROR", source: "vdocipher.slot", message: e instanceof Error ? e.message : "Upload slot failed", userId: session?.user?.id });
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}
