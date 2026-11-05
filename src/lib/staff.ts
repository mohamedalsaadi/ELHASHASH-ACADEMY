import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * Admin pages and actions are for instructors and admins only; everyone else gets a 404.
 * The role is read from the database, not the sign-in cookie, so a disabled or deleted account loses access at once.
 */
export async function requireStaff() {
  const session = await auth();
  if (!session?.user) notFound();
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || (user.role !== "ADMIN" && user.role !== "INSTRUCTOR"))
    notFound();
  return { ...session.user, role: user.role };
}

/** The role as stored now, for pages that redirect rather than 404 after a demotion. */
export async function dbRole(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user?.role ?? null;
}

// Teachers run their own courses (prices included); only the owner manages teachers, slots, promotions and money.
export async function requireAdmin() {
  const me = await requireStaff();
  if (me.role !== "ADMIN") notFound();
  return me;
}

/** Admins edit every course; an instructor only the courses they teach. */
export async function assertCourse(
  me: Awaited<ReturnType<typeof requireStaff>>,
  courseId: string,
) {
  if (me.role === "ADMIN") return;
  if (
    !(await db.course.count({ where: { id: courseId, instructorId: me.id } }))
  )
    notFound();
}

/** The countries a teacher works in: the ones the owner approved, plus those of any grade they were granted (invite or by hand). */
export async function teacherCountryIds(userId: string): Promise<string[]> {
  const [granted, slots] = await Promise.all([
    db.teacherCountry.findMany({ where: { userId }, select: { countryId: true } }),
    db.teacherSlot.findMany({ where: { userId }, select: { grade: { select: { countryId: true } } } }),
  ]);
  return [...new Set([...granted.map((g) => g.countryId), ...slots.map((s) => s.grade.countryId)])];
}

/**
 * A teacher may open any grade and subject of their own country, as long as that grade teaches the subject.
 * The slot is recorded on first use, so slot-based features see it. Admins are unrestricted.
 */
export async function assertSlot(
  me: Awaited<ReturnType<typeof requireStaff>>,
  gradeId: string,
  subjectId: string,
) {
  if (me.role === "ADMIN") return;
  const [taught, countries] = await Promise.all([
    db.gradeSubject.findUnique({
      where: { gradeId_subjectId: { gradeId, subjectId } },
      select: { grade: { select: { countryId: true, active: true } } },
    }),
    teacherCountryIds(me.id),
  ]);
  if (!taught?.grade.active || !countries.includes(taught.grade.countryId))
    notFound();
  await db.teacherSlot.createMany({
    data: [{ userId: me.id, gradeId, subjectId }],
    skipDuplicates: true,
  });
}

/**
 * The database-backed form of isCourseStaff, for route handlers where notFound() is wrong.
 * A route must not trust the role in the session cookie: it survives a demotion.
 */
export async function isCourseStaffDb(userId: string, courseId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return (
    (await db.course.count({ where: { id: courseId, instructorId: userId } })) >
    0
  );
}
