import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export type SubscriberFilter = { q?: string; country?: string; grade?: string; course?: string; status?: string; page?: string };

export const PAGE_SIZE = 50;

/** Students matching the back-office filters; status is judged on the chosen course when one is picked. */
export function subscriberWhere(f: SubscriberFilter, now = new Date()): Prisma.UserWhereInput {
  const q = f.q?.trim();
  const course = f.course ? { courseId: f.course } : {};
  const current = { startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] };
  return {
    role: "STUDENT",
    ...(q && {
      OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { email: { contains: q, mode: "insensitive" } }],
    }),
    ...(f.grade ? { gradeId: f.grade } : f.country ? { grade: { country: { code: f.country as never } } } : {}),
    AND: [
      ...(f.course ? [{ entitlements: { some: course } }] : []),
      ...(f.status === "active" ? [{ entitlements: { some: { ...course, ...current } } }] : []),
      ...(f.status === "expired" ? [{ entitlements: { some: course } }, { entitlements: { none: { ...course, ...current } } }] : []),
    ],
  };
}

/** One page of students (or every match, for the CSV), each with their entitlements newest first. */
export function findSubscribers(f: SubscriberFilter, opts: { all?: boolean } = {}) {
  const page = Math.max(1, Number(f.page) || 1);
  return db.user.findMany({
    where: subscriberWhere(f),
    orderBy: { createdAt: "desc" },
    skip: opts.all ? 0 : (page - 1) * PAGE_SIZE,
    take: opts.all ? 10_000 : PAGE_SIZE,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      createdAt: true,
      grade: { select: { nameAr: true, nameEn: true, country: { select: { nameAr: true, nameEn: true } } } },
      entitlements: {
        where: { liveSessionId: null },
        orderBy: { startsAt: "desc" },
        select: { startsAt: true, endsAt: true, accessType: true, lessonId: true, course: { select: { titleAr: true, titleEn: true } } },
      },
    },
  });
}

/** True while an entitlement is open at `now`. */
export const isCurrent = (e: { startsAt: Date; endsAt: Date | null }, now = new Date()) => e.startsAt <= now && (!e.endsAt || e.endsAt > now);
