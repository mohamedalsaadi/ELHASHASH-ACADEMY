"use client";

import { Link } from "@/i18n/navigation";
import { useEffect, useRef, useState } from "react";

const API = "https://player.vdocipher.com/v2/api.js";
/** The lesson counts as watched at this share of the video, or when it ends, whichever comes first. */
const WATCHED = 0.9;

type Video = {
  currentTime: number;
  duration: number;
  readyState?: number;
  addEventListener: (e: string, cb: () => void) => void;
  removeEventListener?: (e: string, cb: () => void) => void;
};
type Api = { getInstance: (frame: HTMLIFrameElement) => { video: Video } };

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
}: {
  src: string;
  title: string;
  onWatched?: () => Promise<void>;
  next: { href: string; label: string; doneLabel: string } | null;
  /** Seconds to jump to once the video is ready: a premiere viewer arriving late joins at the live point. */
  startAt?: number;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  // The first token is kept for the life of this player: a page re-render (any server action on the lesson page) issues a
  // new token, and changing the iframe src would restart the video the student is watching.
  const [url] = useState(src);
  const watched = useRef(onWatched);
  const [done, setDone] = useState(false);
  useEffect(() => {
    watched.current = onWatched;
  });
  const enabled = !!onWatched || !!startAt;

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
    const attach = () => {
      const api = (window as unknown as { VdoPlayer?: Api }).VdoPlayer;
      const el = frame.current;
      if (video || !api || !el) return;
      const v = (video = api.getInstance(el).video);
      v.addEventListener("ended", finish);
      v.addEventListener("timeupdate", tick);
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
      video?.removeEventListener?.("ended", finish);
      video?.removeEventListener?.("timeupdate", tick);
    };
  }, [enabled, startAt]);

  return (
    <div className="relative size-full">
      <iframe ref={frame} src={url}title={title} allow="encrypted-media; fullscreen" allowFullScreen className="size-full" />
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
