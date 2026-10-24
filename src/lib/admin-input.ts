// Pure helpers for admin form input; kept apart from staff.ts so tests don't load auth.

/** Accepts a YouTube link in any common form, or the bare 11-character id. */
export function youtubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  return s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/)?.[1] ?? null;
}

/** "2027-01-31" as a Cairo calendar day, with Egypt's summer time (UTC+3) taken into account. */
export function cairoDay(value: string, edge: "start" | "end"): Date | null {
  if (!value) return null;
  const wall = new Date(`${value}T${edge === "start" ? "00:00:00" : "23:59:59"}Z`);
  // "GMT+03:00" for that day; ponytail: read at the wall-clock instant, so only the DST switch hour itself can be off.
  const zone = new Intl.DateTimeFormat("en", { timeZone: "Africa/Cairo", timeZoneName: "longOffset" }).formatToParts(wall).find((x) => x.type === "timeZoneName")!.value;
  const [, sign, h, m] = zone.match(/([+-])(\d{2}):(\d{2})/) ?? [, "+", "02", "00"];
  return new Date(wall.getTime() - (sign === "-" ? -1 : 1) * (Number(h) * 60 + Number(m)) * 60_000);
}

export function toDayInput(d: Date | null): string {
  return d ? new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(d) : "";
}
