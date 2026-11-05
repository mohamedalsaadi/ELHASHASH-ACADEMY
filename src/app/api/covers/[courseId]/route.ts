import { streamBlob } from "@/lib/blob";
import { db } from "@/lib/db";

/** A course cover is a marketing image, so it is served without a session. */
export async function GET(_request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const course = await db.course.findUnique({ where: { id: courseId, published: true }, select: { coverKey: true, coverType: true } });
  if (!course?.coverKey) return new Response(null, { status: 404 });
  return streamBlob(course.coverKey, course.coverType, "public, max-age=31536000, immutable");
}
