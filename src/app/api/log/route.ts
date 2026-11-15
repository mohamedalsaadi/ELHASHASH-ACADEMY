import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/site-log";

export const dynamic = "force-dynamic";

/** The only browser-side sources allowed to write, and only for signed-in staff. */
const SOURCES = new Set(["client.vdo_upload"]);

export async function POST(req: Request) {
  const session = await auth();
  const me = session?.user ? await db.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true } }) : null;
  if (!me || (me.role !== "ADMIN" && me.role !== "INSTRUCTOR")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { source?: string; level?: string; message?: string; path?: string; meta?: { size?: number; type?: string } };
  if (!b.source || !SOURCES.has(b.source) || !b.message) return NextResponse.json({ error: "bad request" }, { status: 400 });
  await logEvent({
    level: b.level === "ERROR" ? "ERROR" : "INFO",
    source: b.source,
    message: b.message,
    path: b.path,
    userId: me.id,
    // Only a size and a type tag: nothing free-form beyond the message.
    meta: { size: Number(b.meta?.size) || 0, type: String(b.meta?.type ?? "").slice(0, 40) },
  });
  return NextResponse.json({ ok: true });
}
