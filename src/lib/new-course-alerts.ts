import { db } from "@/lib/db";

/**
 * Tells students about a newly published school course: those in the same grade who already hold a course of the
 * same subject. One in-app notice each (no email), at most 500 per course, safe to run twice.
 */
export async function notifyNewCourse(courseId: string) {
  const c = await db.course.findUnique({ where: { id: courseId }, select: { slug: true, titleAr: true, titleEn: true, gradeId: true, subjectId: true, published: true } });
  if (!c?.published || !c.gradeId || !c.subjectId) return;
  const now = new Date();
  const students = await db.user.findMany({
    where: {
      role: "STUDENT",
      deletedAt: null,
      gradeId: c.gradeId,
      entitlements: {
        some: {
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
          course: { subjectId: c.subjectId, gradeId: c.gradeId, id: { not: courseId } },
        },
      },
    },
    select: { id: true },
    take: 500,
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
}
