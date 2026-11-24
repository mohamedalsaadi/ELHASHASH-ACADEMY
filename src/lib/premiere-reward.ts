import { db } from "./db";
import { createNotification } from "./notify";
import { REWARD_PREFIX } from "./referral-reward";

/** Watching a free stream live earns this percent off one course; checkout applies it like a referral reward. */
export const ATTEND_REWARD_PERCENT = 5;

/** One code per viewer per stream, so a reload or a second device never mints a second discount. */
export const attendRewardCode = (premiereId: string, userId: string) => `${REWARD_PREFIX}P-${premiereId}-${userId}`.toUpperCase();

/** Mints the attendee's discount once and tells them; later calls change nothing. */
export async function grantAttendReward(premiereId: string, userId: string) {
  const { count } = await db.coupon.createMany({
    data: [{ code: attendRewardCode(premiereId, userId), percentOff: ATTEND_REWARD_PERCENT, funding: "PLATFORM", ownerId: userId, perUser: 1, maxRedemptions: 1 }],
    skipDuplicates: true,
  });
  if (count === 1) {
    await createNotification({
      userId,
      kind: "SYSTEM",
      titleAr: `حصلت على خصم ${ATTEND_REWARD_PERCENT}% لحضورك البث المباشر`,
      titleEn: `You earned ${ATTEND_REWARD_PERCENT}% off for joining the live stream`,
      bodyAr: "يُطبَّق تلقائيًا على دورة واحدة عند الدفع، إذا لم يكن على الطلب خصم آخر.",
      bodyEn: "It applies by itself to one course at checkout, when the order has no other discount.",
      href: "/courses",
      dedupeKey: `premiere-reward:${premiereId}:${userId}`,
    });
  }
  return count === 1;
}
