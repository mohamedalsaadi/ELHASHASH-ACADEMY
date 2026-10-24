import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/** Admin pages and actions are for instructors and admins only; everyone else gets a 404. */
export async function requireStaff() {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "ADMIN" && role !== "INSTRUCTOR")) notFound();
  return session.user;
}

/** Prices and the full course list are the owner's alone. */
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
