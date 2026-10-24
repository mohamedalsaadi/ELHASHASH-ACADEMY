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
