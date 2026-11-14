import { createNotification } from "./notify";

/** The teacher is told when a review becomes visible: stars and course only, never the student or the text. Bell only. */
export function notifyTeacherOfReview(r: { reviewId: string; stamp: number; teacherId: string; stars: number; titleAr: string; titleEn: string }) {
  return createNotification({
    userId: r.teacherId,
    kind: "REVIEW_NEW",
    titleAr: `تقييم جديد: ${r.stars} من 5`,
    titleEn: `New rating: ${r.stars} out of 5`,
    bodyAr: r.titleAr,
    bodyEn: r.titleEn,
    href: "/teachers/" + r.teacherId,
    email: false,
    dedupeKey: `review:${r.reviewId}:${r.stamp}`,
  });
}
