// A quiz that lives on another site (Google Forms). Our pages decide who gets the link and log each open; they cannot stop a
// subscriber from sharing a link they have seen, so each opener also gets a code the teacher can match to a student.
import { createHmac } from "node:crypto";

/** Where the student's code goes in the teacher's pre-filled link. */
export const STUDENT_TOKEN = "{student}";

/** A quiz link may only point at Google Forms: https, forms.gle or docs.google.com/forms. */
export function isAllowedQuizLink(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    if (u.hostname === "forms.gle") return true;
    return u.hostname === "docs.google.com" && u.pathname.startsWith("/forms/");
  } catch {
    return false;
  }
}

/**
 * A short code that stands for one student on one assignment: an HMAC with the server's secret, so it cannot be worked out
 * or forged from outside, and it never carries the student's id. The teacher sees it in the form's responses.
 */
export function studentCode(studentId: string, assignmentId: string): string {
  const secret = process.env.AUTH_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "dev-only");
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(`quiz:${assignmentId}:${studentId}`).digest("hex").slice(0, 10).toUpperCase();
}

/** The teacher's link with this student's code in place of the placeholder (a link without the placeholder is returned as is). */
export function quizUrlFor(template: string, code: string): string {
  return template.split(STUDENT_TOKEN).join(encodeURIComponent(code));
}

/** The student, among `studentIds`, whose code is `code`. Null when nobody matches. */
export function studentForCode(code: string, assignmentId: string, studentIds: string[]): string | null {
  const wanted = code.trim().toUpperCase();
  if (!wanted) return null;
  return studentIds.find((id) => studentCode(id, assignmentId) === wanted) ?? null;
}
