import { auth } from "@/auth";
import { isCourseStaffDb } from "@/lib/staff";

const PURPOSES = ["assignment", "cover", "lessonpage", "questionmedia"];

/**
 * Says why an upload would be refused. The Blob client library turns every refusal from /api/blob/upload into the same
 * "Failed to retrieve the client token", so the uploader asks here when that happens and shows the real reason.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const purpose = url.searchParams.get("purpose") ?? "";
  const courseId = url.searchParams.get("courseId") ?? "";
  const reason = async () => {
    const session = await auth();
    if (!session?.user) return "not signed in (sign in again)";
    if (!process.env.BLOB_READ_WRITE_TOKEN) return "the file store is not connected (BLOB_READ_WRITE_TOKEN is missing)";
    if (!PURPOSES.includes(purpose) || !courseId) return "unknown upload type";
    if (!(await isCourseStaffDb(session.user.id, courseId))) return "this account is not the owner or the teacher of this course";
    return null;
  };
  const why = await reason();
  return Response.json({ ok: !why, reason: why }, { headers: { "Cache-Control": "no-store" } });
}
