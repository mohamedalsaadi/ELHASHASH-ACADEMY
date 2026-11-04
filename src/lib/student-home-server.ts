// Loads the student home from the database; the shaping lives in student-home.ts so it can be tested.
import { cardInclude } from "@/lib/catalog";
import { db } from "@/lib/db";
import { liveInstructor } from "@/lib/live";
import { buildHome } from "@/lib/student-home";

/** Null when there is no grade to show: the page then asks for one. `gradeId` overrides the saved grade (the ride shows the grade of the chosen country). */
export async function getStudentHome(userId: string, now = new Date(), gradeId?: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      grade: {
        include: {
          country: { select: { code: true, nameAr: true, nameEn: true, timeZone: true } },
          subjects: {
            where: { subject: { active: true } },
            orderBy: { order: "asc" },
            include: { subject: { select: { id: true, slug: true, nameAr: true, nameEn: true, icon: true } } },
          },
        },
      },
    },
  });
  const grade =
    gradeId && gradeId !== user?.grade?.id
      ? await db.grade.findUnique({
          where: { id: gradeId },
          include: {
            country: { select: { code: true, nameAr: true, nameEn: true, timeZone: true } },
            subjects: {
              where: { subject: { active: true } },
              orderBy: { order: "asc" },
              include: { subject: { select: { id: true, slug: true, nameAr: true, nameEn: true, icon: true } } },
            },
          },
        })
      : user?.grade;
  if (!user || !grade) return null;

  const weekAhead = new Date(now.getTime() + 7 * 86_400_000);
  const [courses, rules, live] = await Promise.all([
    db.course.findMany({ where: { published: true, gradeId: grade.id }, orderBy: { createdAt: "desc" }, include: cardInclude(now) }),
    db.bundleRule.findMany({ where: { active: true }, include: { subjects: { select: { id: true } } } }),
    db.liveSession.findMany({
      where: {
        cancelledAt: null,
        startsAt: { gte: now, lt: weekAhead },
        course: { published: true, gradeId: grade.id, ...liveInstructor },
      },
      orderBy: { startsAt: "asc" },
      take: 6,
      include: { course: { select: { slug: true, titleAr: true, titleEn: true } } },
    }),
  ]);
  const entitlements = await db.entitlement.findMany({
    where: { userId, courseId: { in: courses.map((c) => c.id) }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    select: { courseId: true },
    distinct: ["courseId"],
  });

  const home = buildHome({
    subjects: grade.subjects.map((g) => g.subject),
    courses,
    ownedCourseIds: entitlements.map((e) => e.courseId),
    rules: rules.map((r) => ({ id: r.id, percentOff: r.percentOff, minSubjects: r.minSubjects, subjectIds: r.subjects.map((s) => s.id) })),
    now,
  });
  return { name: user.name, grade, live, ...home };
}
