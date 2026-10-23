import { notFound } from "next/navigation";
import { auth } from "@/auth";

/** Admin pages and actions are for instructors and admins only; everyone else gets a 404. */
export async function requireStaff() {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "ADMIN" && role !== "INSTRUCTOR")) notFound();
  return session.user;
}
