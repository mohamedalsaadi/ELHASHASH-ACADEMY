// Prices are stored in minor units; show them with Western digits (see DESIGN.md, Digits).
export function formatMoney(minor: number, currency: "EGP" | "AED", locale: string): string {
  const region = currency === "AED" ? "AE" : "EG";
  return new Intl.NumberFormat(locale === "ar" ? `ar-${region}-u-nu-latn` : `en-${region}`, {
    style: "currency",
    currency,
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}
