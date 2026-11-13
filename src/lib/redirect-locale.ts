import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";

/**
 * Redirects inside the visitor's own language. A bare `redirect("/courses/...")` from a server action lands on the default
 * (Arabic) site, so an English student was thrown into Arabic in the middle of a practice run or an exam.
 */
export async function redirectLocal(path: string): Promise<never> {
  return redirect(`/${await getLocale()}${path}`);
}
