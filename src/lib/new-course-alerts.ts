import { db } from "@/lib/db";

const BATCH = 500;

/**
 * Tells every student of a newly published school course's grade (so the same country): one in-app notice each,
 * no email, safe to run twice. Goes through the whole grade in batches, subscribers or not.
 */
export async function notifyNewCourse(courseId: string) {
  const c = await db.course.findUnique({ where: { id: courseId }, select: { slug: true, titleAr: true, titleEn: true, gradeId: true, subjectId: true, published: true } });
  if (!c?.published || !c.gradeId || !c.subjectId) return;
  let after: string | undefined;
  for (;;) {
    const students = await db.user.findMany({
      where: { role: "STUDENT", deletedAt: null, gradeId: c.gradeId },
      select: { id: true },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(after ? { cursor: { id: after }, skip: 1 } : {}),
    });
    if (students.length === 0) return;
    await db.notification.createMany({
      data: students.map((s) => ({
        userId: s.id,
        kind: "NEW_COURSE" as const,
        titleAr: `كورس جديد لصفك: ${c.titleAr}`,
        titleEn: `New course for your grade: ${c.titleEn}`,
        href: `/courses/${c.slug}`,
        dedupeKey: `newcourse:${courseId}:${s.id}`,
      })),
      skipDuplicates: true,
    });
    if (students.length < BATCH) return;
    after = students[students.length - 1].id;
  }
}
