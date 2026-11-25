import { couponState } from "./coupons";
import { db } from "./db";
import { createNotification } from "./notify";
import { REWARD_PREFIX } from "./referral-reward";

/** Watching a free stream live earns this percent off one course; checkout applies it like a referral reward. */
export const ATTEND_REWARD_PERCENT = 5;
/** The discount ends this many hours after the stream ends, so the offer is a reason to decide now. */
export const ATTEND_REWARD_HOURS = 48;

/** One code per viewer per stream, so a reload or a second device never mints a second discount. */
export const attendRewardCode = (premiereId: string, userId: string) => `${REWARD_PREFIX}P-${premiereId}-${userId}`.toUpperCase();

/** When an attendee's discount stops working: the stream's end (or now, with an unknown length) plus the offer window. */
export const attendRewardEnds = (streamEnd: Date) => new Date(streamEnd.getTime() + ATTEND_REWARD_HOURS * 3_600_000);

/** Mints the attendee's discount once and tells them; later calls change nothing. */
export async function grantAttendReward(premiereId: string, userId: string, streamEnd: Date) {
  const { count } = await db.coupon.createMany({
    data: [{ code: attendRewardCode(premiereId, userId), percentOff: ATTEND_REWARD_PERCENT, funding: "PLATFORM", ownerId: userId, perUser: 1, maxRedemptions: 1, endsAt: attendRewardEnds(streamEnd) }],
    skipDuplicates: true,
  });
  if (count === 1) {
    await createNotification({
      userId,
      kind: "SYSTEM",
      titleAr: `حصلت على خصم ${ATTEND_REWARD_PERCENT}% لحضورك البث المباشر`,
      titleEn: `You earned ${ATTEND_REWARD_PERCENT}% off for joining the live stream`,
      bodyAr: `صالح ${ATTEND_REWARD_HOURS} ساعة بعد نهاية البث. يُطبَّق تلقائيًا على دورة واحدة عند الدفع، إذا لم يكن على الطلب خصم آخر.`,
      bodyEn: `Valid for ${ATTEND_REWARD_HOURS} hours after the stream ends. It applies by itself to one course at checkout, when the order has no other discount.`,
      href: "/courses",
      dedupeKey: `premiere-reward:${premiereId}:${userId}`,
    });
  }
  return count === 1;
}

/** When this viewer's discount from this stream ends, or null when they have none or it can no longer be used. */
export async function attendOfferEnds(premiereId: string, userId: string, now = new Date()): Promise<Date | null> {
  const c = await db.coupon.findUnique({ where: { code: attendRewardCode(premiereId, userId) } });
  if (!c?.endsAt) return null;
  const paid = await db.order.count({ where: { couponId: c.id, status: "PAID" } });
  return couponState(c, paid, paid, now) === "ok" ? c.endsAt : null;
}
