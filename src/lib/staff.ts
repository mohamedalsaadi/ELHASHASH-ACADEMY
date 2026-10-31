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
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!user || (user.role !== "ADMIN" && user.role !== "INSTRUCTOR")) notFound();
  return { ...session.user, role: user.role };
}

/** Prices, the back office and the full course list are the owner's alone. */
export async function requireAdmin() {
  const me = await requireStaff();
  if (me.role !== "ADMIN") notFound();
  return me;
}

/** Admins edit every course; an instructor only the courses they teach. */
export async function assertCourse(me: Awaited<ReturnType<typeof requireStaff>>, courseId: string) {
  if (me.role === "ADMIN") return;
  if (!(await db.course.count({ where: { id: courseId, instructorId: me.id } }))) notFound();
}

/** A teacher may only create courses inside a slot the owner granted. Admins are unrestricted. */
export async function assertSlot(me: Awaited<ReturnType<typeof requireStaff>>, gradeId: string, subjectId: string) {
  if (me.role === "ADMIN") return;
  if (!(await db.teacherSlot.count({ where: { userId: me.id, gradeId, subjectId } }))) notFound();
}

/**
 * The database-backed form of isCourseStaff, for route handlers where notFound() is wrong.
 * A route must not trust the role in the session cookie: it survives a demotion.
 */
export async function isCourseStaffDb(userId: string, courseId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return (await db.course.count({ where: { id: courseId, instructorId: userId } })) > 0;
}
