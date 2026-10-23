// Pure helpers for admin form input; kept apart from staff.ts so tests don't load auth.

/** Accepts a YouTube link in any common form, or the bare 11-character id. */
export function youtubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  return s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/)?.[1] ?? null;
}

/** "2027-01-31" as a Cairo calendar day. ponytail: fixed UTC+2, so summer-time days end an hour late; use a tz library if that ever matters. */
export function cairoDay(value: string, edge: "start" | "end"): Date | null {
  if (!value) return null;
  return new Date(`${value}T${edge === "start" ? "00:00:00" : "23:59:59"}+02:00`);
}

export function toDayInput(d: Date | null): string {
  return d ? new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(d) : "";
}
