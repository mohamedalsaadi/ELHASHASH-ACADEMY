import type { Currency } from "./pricing-engine";

/** KWD, BHD and OMR count in fils (1/1000); the rest in 1/100. */
export function minorPerUnit(currency: Currency): 1000 | 100 {
  return currency === "KWD" || currency === "BHD" || currency === "OMR" ? 1000 : 100;
}

/** Admin price input in major units to minor units, rounded to 0.01 so 3-decimal amounts stay a multiple of 10 fils (a Stripe rule). */
export function toMinor(major: number, currency: Currency): number {
  return Math.round(major * 100) * (minorPerUnit(currency) / 100);
}

// Prices are stored in minor units; show them with Western digits (see DESIGN.md, Digits).
export function formatMoney(minor: number, currency: Currency, locale: string): string {
  const region = currency.slice(0, 2);
  const per = minorPerUnit(currency);
  return new Intl.NumberFormat(locale === "ar" ? `ar-${region}-u-nu-latn` : `en-${region}`, {
    style: "currency",
    currency,
    minimumFractionDigits: minor % per === 0 ? 0 : per === 1000 ? 3 : 2,
  }).format(minor / per);
}

/** Live sessions are scheduled and shown in the course's country time; skill courses use UAE time. */
export function courseZone(course: { grade: { country: { code: string } } | null }): string {
  return course.grade?.country.code === "EG" ? "Africa/Cairo" : "Asia/Dubai";
}

export function formatWhen(d: Date, zone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", {
    timeZone: zone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(d);
}
