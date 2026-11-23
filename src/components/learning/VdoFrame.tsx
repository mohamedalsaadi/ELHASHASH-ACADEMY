"use client";

import { Link } from "@/i18n/navigation";
import { useEffect, useRef, useState } from "react";
import { liveAtSec } from "@/lib/premiere";

const API = "https://player.vdocipher.com/v2/api.js";
/** The lesson counts as watched at this share of the video, or when it ends, whichever comes first. */
const WATCHED = 0.9;
/** A live viewer may drift this many seconds from the live point (buffering, a slow start) before being moved back to it. */
const DRIFT = 4;
/** Height of our own control bar, which covers the player's (and so its timeline and pause button). Matches `h-14`. */
const BAR = "3.5rem";

type Video = {
  currentTime: number;
  duration: number;
  readyState?: number;
  playbackRate?: number;
  muted?: boolean;
  play?: () => Promise<void> | void;
  addEventListener: (e: string, cb: () => void) => void;
  removeEventListener?: (e: string, cb: () => void) => void;
};
type Api = { getInstance: (frame: HTMLIFrameElement) => { video: Video } };

/**
 * A recording shown as a stream: no timeline, no pause, no speed change, and the viewer is kept at the live point.
 * `startsAtMs` and `nowMs` (the server's clock when the page was made) give the live point without trusting the viewer's clock.
 */
export type LiveMode = { startsAtMs: number; nowMs: number; durationSec: number; labels: { mute: string; unmute: string; fullscreen: string } };

const clock = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, "0");
  return `${h ? `${h}:` : ""}${mm}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * The protected player. When the student has watched the video it calls `onWatched` (a server action that completes the
 * lesson) and shows a "completed / next lesson" pill over the corner of the player. It never refreshes the page, because a
 * refresh would re-issue the playback token and could spend another play.
 */
export function VdoFrame({
  src,
  title,
  onWatched,
  next,
  startAt,
  live,
}: {
  src: string;
  title: string;
  onWatched?: () => Promise<void>;
  next: { href: string; label: string; doneLabel: string } | null;
  /** Seconds to jump to once the video is ready: a premiere viewer arriving late joins at the live point. */
  startAt?: number;
  /** Premiere in its live window: lock the player so the recording behaves like a stream. */
  live?: LiveMode;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const player = useRef<Video>(undefined);
  // The first token is kept for the life of this player: a page re-render (any server action on the lesson page) issues a
  // new token, and changing the iframe src would restart the video the student is watching.
  const [url] = useState(src);
  const watched = useRef(onWatched);
  const [done, setDone] = useState(false);
  const [locked, setLocked] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [canFull, setCanFull] = useState(false);
  const liveRef = useRef(live);
  useEffect(() => {
    watched.current = onWatched;
    liveRef.current = live;
  });
  const isLive = !!live;
  const enabled = !!onWatched || !!startAt || isLive;

  useEffect(() => {
    if (!enabled) return;
    let fired = false;
    let video: Video | undefined;
    const finish = () => {
      if (fired) return;
      fired = true;
      watched.current?.().then(
        () => setDone(true),
        () => {
          fired = false; // try again on the next event
        },
      );
    };
    const tick = () => {
      if (video && video.duration > 0 && video.currentTime / video.duration >= WATCHED) finish();
    };
    const undo: Array<() => void> = [];
    const attach = () => {
      const api = (window as unknown as { VdoPlayer?: Api }).VdoPlayer;
      const el = frame.current;
      if (video || !api || !el) return;
      const v = (video = api.getInstance(el).video);
      player.current = v;
      const on = (e: string, cb: () => void) => {
        v.addEventListener(e, cb);
        undo.push(() => v.removeEventListener?.(e, cb));
      };
      on("ended", finish);
      on("timeupdate", tick);
      if (startAt) {
        const seek = () => {
          try {
            v.currentTime = startAt;
          } catch {
            // The player refused the seek: the viewer simply starts from the beginning.
          }
          v.removeEventListener?.("loadedmetadata", seek);
        };
        if ((v.readyState ?? 0) >= 1) seek();
        else v.addEventListener("loadedmetadata", seek);
      }
      const L = liveRef.current;
      if (L) {
        const skew = L.nowMs - Date.now();
        const liveAt = () => liveAtSec(Date.now() + skew, L.startsAtMs, L.durationSec);
        let started = false;
        let lastSnap = 0;
        // Anything that moves the viewer away from the live point (arrow keys, a scrub that got through) is undone.
        const snap = () => {
          if (!started || Date.now() - lastSnap < 3000 || Math.abs(v.currentTime - liveAt()) <= DRIFT) return;
          lastSnap = Date.now();
          try {
            v.currentTime = liveAt();
          } catch {
            // Refused: nothing more to do, the timeline is hidden anyway.
          }
        };
        on("playing", () => {
          started = true;
          setLocked(true);
        });
        on("seeked", snap);
        on("timeupdate", snap);
        on("pause", () => {
          const atEnd = v.duration > 0 && v.currentTime >= v.duration - 1;
          if (started && !atEnd) void Promise.resolve(v.play?.()).catch(() => {});
        });
        on("ratechange", () => {
          if (v.playbackRate && v.playbackRate !== 1) v.playbackRate = 1;
        });
        const timer = setInterval(() => setElapsed(liveAt()), 1000);
        setElapsed(liveAt());
        undo.push(() => clearInterval(timer));
      }
    };
    const load = () => {
      if ((window as unknown as { VdoPlayer?: Api }).VdoPlayer) return attach();
      const s = document.createElement("script");
      s.src = API;
      s.async = true;
      s.onload = attach;
      document.head.appendChild(s);
    };
    load();
    return () => {
      undo.forEach((f) => f());
    };
  }, [enabled, startAt, isLive]);

  useEffect(() => setCanFull(!!document.fullscreenEnabled), []);

  const toggleMute = () => {
    const v = player.current;
    if (!v) return;
    v.muted = !muted;
    setMuted(!muted);
  };
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrap.current?.requestFullscreen?.();
  };

  return (
    <div ref={wrap} className="relative size-full bg-stage">
      <iframe ref={frame} src={url} title={title} allow="encrypted-media; fullscreen" allowFullScreen className="size-full" />
      {live && (
        <>
          {/* Our bar sits over the player's own, so there is no timeline, pause or speed menu to reach. */}
          <div className="absolute inset-x-0 bottom-0 z-10 flex h-14 items-center gap-3 bg-stage px-4 text-small text-stage-ink">
            <span aria-hidden="true" className="live-dot size-2 rounded-full bg-down" />
            <span className="num font-semibold" dir="ltr">
              {clock(elapsed)}
            </span>
            <span className="flex-1" />
            <button type="button" onClick={toggleMute} className="rounded-full px-3 py-1.5 font-semibold hover:bg-stage-ink/15">
              {muted ? live.labels.unmute : live.labels.mute}
            </button>
            {canFull && (
              <button type="button" onClick={toggleFull} className="rounded-full px-3 py-1.5 font-semibold hover:bg-stage-ink/15">
                {live.labels.fullscreen}
              </button>
            )}
          </div>
          {/* Once playing, taps on the picture do nothing: a tap would pause it. Before that the player's own play button works. */}
          {locked && <div className="absolute inset-x-0 top-0 z-10" style={{ bottom: BAR }} />}
        </>
      )}
      {done && (
        <div className="absolute end-3 top-3 flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-small font-semibold shadow-paper" role="status">
          <span>{next?.doneLabel}</span>
          {next?.href && (
            <Link href={next.href} className="text-pen underline underline-offset-4">
              {next.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
