// The invite-a-friend ad: one source for the popup, the email and the shareable picture, so the three never disagree.
// The words live in messages/{ar,en}.json under "referralAd"; this file only reads them and the admin switch.
import { createTranslator } from "next-intl";
import { db } from "@/lib/db";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

export type AdLocale = "ar" | "en";

type T = (key: string, values?: Record<string, string | number>) => string;

/** A translator for the "referralAd" namespace, usable on the server (the email) as well as in tests. */
export const referralAdT = (locale: AdLocale) =>
  createTranslator({ locale, messages: (locale === "ar" ? ar : en) as never, namespace: "referralAd" } as never) as unknown as T;

/** Teachers and admins have no referral link and nothing to invite friends to, so the ad is not for them. */
export const adRoles = (role: string | undefined) => role !== "INSTRUCTOR" && role !== "ADMIN";

/**
 * Whether the popup may show at all: an admin switched it on and the reward is above zero (zero turns referrals off,
 * and an ad for a reward that does not exist would be false).
 */
export async function getReferralAd(): Promise<{ enabled: boolean; percent: number }> {
  const row = await db.platformSetting.findUnique({ where: { id: "singleton" }, select: { referralPopupEnabled: true, referralRewardPercentOff: true } });
  const percent = row?.referralRewardPercentOff ?? 0;
  return { enabled: Boolean(row?.referralPopupEnabled) && percent > 0, percent };
}

/** The message a signed-in student or parent sends with their link. */
export const referralShareText = (locale: AdLocale, link: string) => referralAdT(locale)("shareText", { link });
