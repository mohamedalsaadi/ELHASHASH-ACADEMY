// Prices are stored in minor units; show them with Western digits (see DESIGN.md, Digits).
export function formatMoney(minor: number, currency: "EGP" | "AED", locale: string): string {
  const region = currency === "AED" ? "AE" : "EG";
  return new Intl.NumberFormat(locale === "ar" ? `ar-${region}-u-nu-latn` : `en-${region}`, {
    style: "currency",
    currency,
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
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
