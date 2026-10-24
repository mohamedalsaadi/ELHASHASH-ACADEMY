// Pure helpers for admin form input; kept apart from staff.ts so tests don't load auth.

/** Accepts a YouTube link in any common form, or the bare 11-character id. */
export function youtubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  return s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/)?.[1] ?? null;
}

/** "2026-11-02T18:30" (a datetime-local value) as wall-clock time in `zone`, summer time included. */
export function wallTime(value: string, zone: string): Date | null {
  if (!value) return null;
  const wall = new Date(`${value.length === 16 ? `${value}:00` : value}Z`);
  // "GMT+03:00" at that instant; ponytail: read at the wall-clock instant, so only the DST switch hour itself can be off.
  const name = new Intl.DateTimeFormat("en", { timeZone: zone, timeZoneName: "longOffset" }).formatToParts(wall).find((x) => x.type === "timeZoneName")!.value;
  const [, sign, h, m] = name.match(/([+-])(\d{2}):(\d{2})/) ?? [, "+", "00", "00"];
  return new Date(wall.getTime() - (sign === "-" ? -1 : 1) * (Number(h) * 60 + Number(m)) * 60_000);
}

/** "2027-01-31" as a Cairo calendar day. */
export function cairoDay(value: string, edge: "start" | "end"): Date | null {
  return value ? wallTime(`${value}T${edge === "start" ? "00:00:00" : "23:59:59"}`, "Africa/Cairo") : null;
}

/** The datetime-local value showing `d` in `zone`. */
export function toTimeInput(d: Date, zone: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: zone, dateStyle: "short", timeStyle: "short" }).format(d).replace(" ", "T");
}

export function toDayInput(d: Date | null): string {
  return d ? new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(d) : "";
}
