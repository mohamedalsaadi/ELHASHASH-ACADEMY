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

/** Seconds into the video a viewer who arrives late should start at; 0 before the start or past the end. */
export function liveOffsetSec(now: Date, startsAt: Date, durationSec: number | null): number {
  const sec = Math.floor((now.getTime() - startsAt.getTime()) / 1000);
  if (sec <= 0 || !durationSec || sec >= durationSec - 5) return 0;
  return sec;
}
