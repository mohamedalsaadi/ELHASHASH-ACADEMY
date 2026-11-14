// What a course needs before students can see it. Blocking checks stop the publish; warnings only show.
import { db } from "./db";

export type PublishIssue = "title" | "description" | "content" | "package";
export type PublishWarning = "cover" | "teacher";

export type ReadinessInput = {
  titleAr: string;
  titleEn: string;
  descAr: string | null;
  descEn: string | null;
  coverKey: string | null;
  teacher: { photoUrl: string | null; bioAr: string | null; bioEn: string | null };
  lessons: { kind: "VIDEO" | "EXAM_STRUCTURE" | "PAST_QUESTIONS" | "PDF"; videoId: string | null; pdfKey: string | null; pdfPages: number; questions: number }[];
  skus: { accessType: string; active: boolean; price: number; aedPrice: number | null }[];
};

export type Readiness = { blocking: PublishIssue[]; warnings: PublishWarning[] };

/** A lesson counts only when there is something for a student to open. */
const hasContent = (l: ReadinessInput["lessons"][number]) =>
  l.kind === "VIDEO" ? !!l.videoId : l.kind === "PDF" ? !!l.pdfKey || l.pdfPages > 0 : l.questions > 0;

/** Pure rules, so they are unit-tested without a database. */
export function evaluateReadiness(c: ReadinessInput): Readiness {
  const blocking: PublishIssue[] = [];
  if (!c.titleAr.trim() || !c.titleEn.trim()) blocking.push("title");
  if (!c.descAr?.trim() && !c.descEn?.trim()) blocking.push("description");
  if (!c.lessons.some(hasContent)) blocking.push("content");
  // The AED price is what is charged; a package without one is display-only. Rentals and live seats are not the course.
  const sellable = c.skus.some((s) => s.active && s.accessType !== "RENTAL" && s.accessType !== "LIVE" && s.price > 0 && (s.aedPrice ?? 0) > 0);
  if (!sellable) blocking.push("package");
  const warnings: PublishWarning[] = [];
  if (!c.coverKey) warnings.push("cover");
  if (!c.teacher.photoUrl || (!c.teacher.bioAr && !c.teacher.bioEn)) warnings.push("teacher");
  return { blocking, warnings };
}

export async function courseReadiness(courseId: string): Promise<Readiness> {
  const course = await db.course.findUniqueOrThrow({
    where: { id: courseId },
    select: {
      titleAr: true,
      titleEn: true,
      descAr: true,
      descEn: true,
      coverKey: true,
      instructor: { select: { photoUrl: true, bioAr: true, bioEn: true } },
      units: { select: { lessons: { select: { kind: true, videoId: true, pdfKey: true, pdfPages: true, _count: { select: { questionItems: true } } } } } },
      skus: { select: { accessType: true, active: true, price: true, aedPrice: true } },
    },
  });
  return evaluateReadiness({
    titleAr: course.titleAr,
    titleEn: course.titleEn,
    descAr: course.descAr,
    descEn: course.descEn,
    coverKey: course.coverKey,
    teacher: course.instructor,
    lessons: course.units.flatMap((u) => u.lessons.map((l) => ({ kind: l.kind, videoId: l.videoId, pdfKey: l.pdfKey, pdfPages: l.pdfPages.length, questions: l._count.questionItems }))),
    skus: course.skus,
  });
}
