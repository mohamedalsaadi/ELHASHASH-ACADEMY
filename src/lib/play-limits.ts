// Pure play-limit rules, kept apart from the database so tests stay fast.
// A "learner" is the student whose access is used. A parent watching for a child under 13 plays as that learner,
// so the parent and the child share every count and may not watch at the same time.

/** A refresh or re-open within this window of a play from the same viewer and IP is the same play (the player token lives 5 minutes). */
export const REPLAY_WINDOW_MS = 300_000;
/** The look-back for the IP cap and for everything below. */
export const IP_WINDOW_MS = 86_400_000;
/** Another person's play this recently counts as "still watching". ponytail: no heartbeat from the player, so this is a guess; use VdoCipher's playback events if it blocks too much. */
export const TOGETHER_WINDOW_MS = 900_000;
/** Two countries inside this window cannot be one family on one trip. */
export const COUNTRY_WINDOW_MS = 21_600_000;

/** The look-back for the device cap. */
export const DEVICE_WINDOW_MS = 30 * 86_400_000;

export type PlayVerdict = "ok" | "plays" | "ips" | "devices" | "together" | "location";
export type PlayEventLite = { userId: string; lessonId: string; ip: string; country: string | null; at: number };

export function judgePlay(p: {
  now: number;
  viewerId: string;
  lessonId: string;
  ip: string;
  country: string | null;
  /** The learner's plays in the last IP_WINDOW_MS, whoever pressed play. */
  events: PlayEventLite[];
  /** All the learner's plays of this lesson, ever. */
  lessonPlays: number;
  maxPlays: number | null;
  maxIps: number | null;
  /** This browser's cookie id (null when the cookie is missing: the check is skipped), the ids that played in DEVICE_WINDOW_MS, and the cap. */
  deviceId?: string | null;
  knownDevices?: string[];
  maxDevices?: number | null;
}): PlayVerdict {
  const since = (e: PlayEventLite) => p.now - e.at;
  if (p.events.some((e) => e.userId !== p.viewerId && since(e) < TOGETHER_WINDOW_MS)) return "together";
  if (p.country && p.events.some((e) => e.country && e.country !== p.country && since(e) < COUNTRY_WINDOW_MS)) return "location";
  const ips = new Set(p.events.map((e) => e.ip));
  if (p.maxIps != null && !ips.has(p.ip) && ips.size >= p.maxIps) return "ips";
  if (p.maxDevices != null && p.deviceId && !p.knownDevices?.includes(p.deviceId) && (p.knownDevices?.length ?? 0) >= p.maxDevices) return "devices";
  const replay = p.events.some((e) => e.userId === p.viewerId && e.lessonId === p.lessonId && e.ip === p.ip && since(e) < REPLAY_WINDOW_MS);
  if (p.maxPlays != null && !replay && p.lessonPlays >= p.maxPlays) return "plays";
  return "ok";
}
