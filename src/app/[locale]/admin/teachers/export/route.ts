import { auth } from "@/auth";
import { csvResponse } from "@/lib/csv";
import { db } from "@/lib/db";

/**
 * One row per teacher, grade, subject and currency: how many students hold access and what the
 * sales split was. Refund rows are already netted into the sums, so the figures match the ledger.
 */
export async function GET(req: Request, { params }: { params: Promise<{ locale: string }> }) {
  const session = await auth();
  const me = session?.user && (await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } }));
  if (me?.role !== "ADMIN") return new Response("Not found", { status: 404 });

  const ar = (await params).locale === "ar";
  const now = new Date();

  const [groups, courses, entitlements, users, grades, subjects] = await Promise.all([
    db.ledgerEntry.groupBy({
      by: ["instructorId", "gradeId", "subjectId", "currency"],
      _sum: { gross: true, vat: true, platformFee: true, instructorNet: true },
    }),
    db.course.findMany({ select: { id: true, instructorId: true, gradeId: true, subjectId: true } }),
    db.entitlement.findMany({
      where: { startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      select: { userId: true, courseId: true },
    }),
    db.user.findMany({ select: { id: true, name: true } }),
    db.grade.findMany({ select: { id: true, nameAr: true, nameEn: true } }),
    db.subject.findMany({ select: { id: true, nameAr: true, nameEn: true } }),
  ]);

  const courseById = new Map(courses.map((c) => [c.id, c]));
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const gradeName = new Map(grades.map((g) => [g.id, ar ? g.nameAr : g.nameEn]));
  const subjectName = new Map(subjects.map((s) => [s.id, ar ? s.nameAr : s.nameEn]));

  // Distinct students per teacher, grade and subject, from the access they hold now.
  const students = new Map<string, Set<string>>();
  for (const e of entitlements) {
    const c = courseById.get(e.courseId);
    if (!c) continue;
    const key = `${c.instructorId}|${c.gradeId}|${c.subjectId}`;
    const set = students.get(key) ?? new Set<string>();
    set.add(e.userId);
    students.set(key, set);
  }

  // KWD, BHD and OMR have three decimals in minor units; the rest have two.
  const thousand = (c: string) => c === "KWD" || c === "BHD" || c === "OMR";
  const amount = (minor: number | null, currency: string) => ((minor ?? 0) / (thousand(currency) ? 1000 : 100)).toFixed(thousand(currency) ? 3 : 2);

  const rows: unknown[][] = [
    ["teacher", "grade", "subject", "currency", "students", "sales", "vat", "platform", "teacher_net"],
    ...groups.map((g) => {
      const key = `${g.instructorId}|${g.gradeId}|${g.subjectId}`;
      return [
        g.instructorId ? (userName.get(g.instructorId) ?? g.instructorId) : "",
        g.gradeId ? (gradeName.get(g.gradeId) ?? "") : "",
        g.subjectId ? (subjectName.get(g.subjectId) ?? "") : "",
        g.currency,
        students.get(key)?.size ?? 0,
        amount(g._sum.gross, g.currency),
        amount(g._sum.vat, g.currency),
        amount(g._sum.platformFee, g.currency),
        amount(g._sum.instructorNet, g.currency),
      ];
    }),
  ];

  return csvResponse(rows, `teachers-${now.toISOString().slice(0, 10)}.csv`);
}
