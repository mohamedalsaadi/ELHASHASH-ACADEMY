/** Whole years on a UTC date, so a birthday today counts as the new age. */
export function ageOn(dateOfBirth: Date, now = new Date()): number {
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const month = now.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (month < 0 || (month === 0 && now.getUTCDate() < dateOfBirth.getUTCDate())) age -= 1;
  return age;
}

/** Null (a legacy account with no birth date) is treated as an adult. The migration grandfathers them. */
export function isMinor(dateOfBirth: Date | null | undefined, now = new Date()): boolean {
  return Boolean(dateOfBirth && ageOn(dateOfBirth, now) < 18);
}

/** "YYYY-MM-DD" from a date input. Rejects impossible dates and a future birthday. */
export function parseBirthDate(value: string | null | undefined, now = new Date()): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date > now) return null;
  // Reject 2026-02-31, which Date would roll into March.
  if (date.toISOString().slice(0, 10) !== value) return null;
  return date;
}
