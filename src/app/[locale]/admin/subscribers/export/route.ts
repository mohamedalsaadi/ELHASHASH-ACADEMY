import { pick } from "@/lib/content";
import { auth } from "@/auth";
import { toDayInput } from "@/lib/admin-input";
import { csvResponse } from "@/lib/csv";
import { db } from "@/lib/db";
import { findSubscribers, isCurrent, type SubscriberFilter } from "@/lib/subscribers";

/** The filtered subscriber list as CSV; the BOM lets Excel read the Arabic as UTF-8. */
export async function GET(req: Request, { params }: { params: Promise<{ locale: string }> }) {
  // requireAdmin's notFound() is for pages; a route answers 404 itself.
  const session = await auth();
  const me = session?.user && (await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } }));
  if (me?.role !== "ADMIN") return new Response("Not found", { status: 404 });

  const ar = (await params).locale === "ar";
  const f = Object.fromEntries(new URL(req.url).searchParams) as SubscriberFilter;
  const now = new Date();
  const rows = await findSubscribers(f, { all: true });
  const lines = [
    ["name", "phone", "email", "country", "grade", "joined", "course", "plan", "status", "ends"],
    ...rows.map((u) => {
      const e = u.entitlements.find((x) => isCurrent(x, now)) ?? u.entitlements[0];
      return [
        u.name, u.phone, u.email,
        u.grade && (pick(ar, u.grade.country.nameAr, u.grade.country.nameEn)),
        u.grade && (pick(ar, u.grade.nameAr, u.grade.nameEn)),
        u.createdAt.toISOString().slice(0, 10),
        e && (pick(ar, e.course.titleAr, e.course.titleEn)),
        e?.accessType,
        e ? (isCurrent(e, now) ? "active" : "expired") : "",
        toDayInput(e?.endsAt ?? null, e?.course.grade?.country.timeZone ?? "Asia/Dubai"),
      ];
    }),
  ];
  return csvResponse(lines, `subscribers-${now.toISOString().slice(0, 10)}.csv`);
}
