import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { clientIp } from "@/lib/client-ip";
import { db } from "@/lib/db";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import { logEvent } from "@/lib/site-log";

export const dynamic = "force-dynamic";

/** Written by signed-in staff only (the admin video and PDF uploaders). */
const STAFF_SOURCES = new Set(["client.vdo_upload", "client.pdf_upload"]);
/** Anyone's browser may report these: crashes and failed fetches on the public pages. */
const PUBLIC_SOURCES = new Set(["client.error", "client.unhandled", "client.checkout", "client.upload"]);

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { source?: string; level?: string; message?: string; path?: string; meta?: { size?: number; type?: string; digest?: string } };
  const source = b.source ?? "";
  if (!b.message || !(STAFF_SOURCES.has(source) || PUBLIC_SOURCES.has(source))) return NextResponse.json({ error: "bad request" }, { status: 400 });

  let userId: string | null = null;
  if (STAFF_SOURCES.has(source)) {
    const session = await auth();
    const me = session?.user ? await db.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true } }) : null;
    if (!me || (me.role !== "ADMIN" && me.role !== "INSTRUCTOR")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    userId = me.id;
  } else {
    // Anonymous reports: same site only, and a per-address cap, so the log cannot be flooded from outside.
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).host !== new URL(req.url).host) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const key = `client-log:${clientIp(req.headers)}`;
    if (await isLimited(key, 20, 10 * 60_000)) return NextResponse.json({ ok: true, limited: true });
    await recordAttempt(key);
    userId = (await auth())?.user?.id ?? null;
  }

  const path = typeof b.path === "string" && b.path.startsWith("/") ? b.path.slice(0, 200) : null;
  await logEvent({
    level: b.level === "ERROR" ? "ERROR" : "INFO",
    source,
    message: String(b.message).slice(0, 300),
    path,
    userId,
    // Only a size, a type tag and an error digest: nothing free-form beyond the message.
    meta: { size: Number(b.meta?.size) || 0, type: String(b.meta?.type ?? "").slice(0, 40), digest: String(b.meta?.digest ?? "").slice(0, 40) },
    sample: 60_000,
  });
  return NextResponse.json({ ok: true });
}
