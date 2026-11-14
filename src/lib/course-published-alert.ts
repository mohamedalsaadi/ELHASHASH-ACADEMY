import { db } from "@/lib/db";
import { notifyAdmins } from "@/lib/notify";

/** Tells every admin a course just went live and whose it is. In-app only; the morning briefing counts them too. */
export async function notifyCoursePublished(courseId: string) {
  const c = await db.course.findUnique({ where: { id: courseId }, select: { titleAr: true, titleEn: true, instructor: { select: { name: true } } } });
  if (!c) return;
  await notifyAdmins({
    kind: "SYSTEM",
    titleAr: `نُشرت دورة: ${c.titleAr}`,
    titleEn: `A course was published: ${c.titleEn}`,
    bodyAr: `المعلم: ${c.instructor.name}`,
    bodyEn: `Teacher: ${c.instructor.name}`,
    href: `/admin/courses/${courseId}`,
    email: false,
    dedupeKey: `course-published:${courseId}:${Date.now()}`,
  });
}
