// Calling codes offered in the phone picker: the seven catalog countries, each with its region for the country name.
// Any other country picks "other" and types the whole number with a +.
export const DIAL_CODES = [
  { dial: "971", region: "AE" },
  { dial: "966", region: "SA" },
  { dial: "965", region: "KW" },
  { dial: "974", region: "QA" },
  { dial: "973", region: "BH" },
  { dial: "968", region: "OM" },
  { dial: "20", region: "EG" },
] as const;

/** The picker's two parts back from a stored number. Anything that is not +<known code><digits> stays whole under "other". */
export function splitPhone(value: string): { dial: string; national: string } {
  if (value.startsWith("+")) {
    const hit = DIAL_CODES.find((c) => value.slice(1).startsWith(c.dial));
    if (hit) return { dial: hit.dial, national: value.slice(1 + hit.dial.length) };
  }
  return { dial: value ? "" : DIAL_CODES[0].dial, national: value };
}

/** The number to store: +<code><digits without the trunk 0>, or the typed text as it is under "other". */
export function joinPhone(dial: string, national: string): string {
  if (!dial) return national.trim();
  const digits = national.replace(/\D/g, "").replace(/^0+/, "");
  return digits ? `+${dial}${digits}` : "";
}

/** Numbers saved before the picker are local ("0501234567"); the same person now has "+971501234567". Look for both. */
export function phoneCandidates(login: string): string[] {
  if (login.startsWith("+")) return [login];
  const national = login.replace(/^0+/, "");
  return DIAL_CODES.map((c) => `+${c.dial}${national}`);
}
