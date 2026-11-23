export type PremiereStage = "cancelled" | "signin" | "countdown" | "watch" | "ended";

/**
 * What a visitor sees for a premiere, and the one place that decides whether a playback token may be created:
 * only the "watch" stage gets one. A signed-out visitor and anyone before the start never reach it; staff
 * (an admin or the course's instructor) may preview at any time. `endsAt` is startsAt plus the video length,
 * or null when the length is unknown, in which case the video never counts as ended.
 */
export function premiereStage(p: {
  now: Date;
  startsAt: Date;
  endsAt: Date | null;
  replay: boolean;
  cancelled: boolean;
  signedIn: boolean;
  staff: boolean;
}): PremiereStage {
  if (p.cancelled && !p.staff) return "cancelled";
  if (!p.signedIn) return "signin";
  if (p.staff) return "watch";
  if (p.now < p.startsAt) return "countdown";
  if (p.endsAt && p.now >= p.endsAt && !p.replay) return "ended";
  return "watch";
}

/** Real numbers are shown on the page only from these sizes: a small count reads as an empty room. */
export const PROOF_MIN = 20;
export const WATCHING_MIN = 10;
/** A viewer counts as watching if their player pinged within this many seconds (it pings every 30 s). */
export const SEEN_WINDOW_SEC = 75;

/** Started and not yet over. With an unknown length the stream never ends. */
export function inLiveWindow(now: Date, startsAt: Date, durationSec: number | null): boolean {
  return now >= startsAt && (!durationSec || now.getTime() < startsAt.getTime() + durationSec * 1000);
}

/** The number, or null when it is below the size worth showing. */
export const shownCount = (n: number, min: number) => (n >= min ? n : null);

/** The live point in seconds, kept inside the video (and one second short of its end so the last frame is not seeked past). */
export function liveAtSec(nowMs: number, startsAtMs: number, durationSec: number): number {
  return Math.min(Math.max((nowMs - startsAtMs) / 1000, 0), Math.max(durationSec - 1, 0));
}

/** Seconds into the video a viewer who arrives late should start at; 0 before the start or past the end. */
export function liveOffsetSec(now: Date, startsAt: Date, durationSec: number | null): number {
  const sec = Math.floor((now.getTime() - startsAt.getTime()) / 1000);
  if (sec <= 0 || !durationSec || sec >= durationSec - 5) return 0;
  return sec;
}
