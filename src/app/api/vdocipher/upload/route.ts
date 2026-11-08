import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createUpload } from "@/lib/vdocipher";

export const dynamic = "force-dynamic";

/** Teachers and the owner ask for an upload slot; the secret key stays here. */
export async function POST(req: Request) {
  const session = await auth();
  const me = session?.user ? await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } }) : null;
  if (!me || (me.role !== "ADMIN" && me.role !== "INSTRUCTOR")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { title } = (await req.json().catch(() => ({}))) as { title?: string };
  try {
    return NextResponse.json(await createUpload(title?.trim() || "Dhirwa lesson"));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}
